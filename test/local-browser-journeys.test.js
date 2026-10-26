import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { request } from "node:http";
import { connect } from "node:net";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";
import { afterEach, describe, expect, it, vi } from "vitest";
import { startLocalBrowserJourneys } from "../rig/local-browser-journeys.mjs";

const fixtures = [];
afterEach(async () => {
  try {
    const closed = await Promise.all(fixtures.splice(0).map((fixture) => fixture.close()));
    for (const state of closed) {
      expect(state).toMatchObject({ closure: "closed", listening: false, openSockets: 0, pendingResponses: 0, errors: [] });
    }
  } finally {
    vi.unstubAllGlobals();
    vi.resetModules();
  }
});

async function start() {
  const fixture = await startLocalBrowserJourneys();
  fixtures.push(fixture);
  return fixture;
}

function get(origin, path, options = {}) {
  return new Promise((resolve, reject) => {
    const req = request(`${origin}${path}`, { agent: false, ...options }, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => resolve({
        status: response.statusCode, headers: response.headers, body: Buffer.concat(chunks).toString(),
      }));
    });
    req.on("error", reject);
    req.setTimeout(2500, () => req.destroy(new Error("HTTP-test-deadline")));
    req.end(options.body);
  });
}

function measurement(vendor, second = false) {
  const query = vendor === "meta" ? {
    id: "000000000000000", ev: "PageView",
    dl: second ? "https://example.test/meta-b#second" : "https://example.test/meta-a",
    rl: "", if: "false", sw: "412", sh: "823", tz: "-420",
  } : {
    label: "SYNTHETIC_LABEL", value: second ? "0" : "28.75", currency_code: second ? "" : "CAD",
    oid: second ? "synthetic-b" : "synthetic-a",
    url: second ? "https://example.test/google-b#second" : "https://example.test/google-a",
  };
  const path = vendor === "meta" ? "/tr/" : "/pagead/conversion/0000000000/";
  return { path: `${path}?${new URLSearchParams(query)}`, query };
}

async function until(predicate) {
  const deadline = performance.now() + 1000;
  while (!predicate()) {
    if (performance.now() >= deadline) throw new Error("HTTP-observation-deadline");
    await delay(5);
  }
}

describe("fixed fixture source and REAL Node HTTP only — NOT browser/worker qualification", () => {
  it("serves two fixed pages and the entire actual adapter/module-worker import closure", async () => {
    const fixture = await start();
    const discovered = new Set();
    const pending = [];
    for (const vendor of ["meta", "google"]) {
      const page = await get(fixture.origin, `/${vendor}`);
      expect(page.status).toBe(200);
      expect(page.headers["content-type"]).toBe("text/html; charset=utf-8");
      expect(page.body).toContain(`<script type="module" src="/rig/local-browser-journeys-${vendor}.js"></script>`);
      expect(page.body).not.toMatch(/<script(?![^>]*src=)/);
      expect(page.headers["content-security-policy"]).toBe(
        "default-src 'none'; script-src 'self'; worker-src 'self'; connect-src 'self'; img-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
      );
      expect(fixture.pageManifest.find((row) => row.path === `/${vendor}`)).toEqual({
        path: `/${vendor}`, bytes: Buffer.byteLength(page.body),
        sha256: createHash("sha256").update(page.body).digest("hex"),
      });
      pending.push(`/rig/local-browser-journeys-${vendor}.js`);
    }
    // Independent traversal of served imports and actual Worker URL references;
    // neither the server's allowlist nor its manifest supplies this graph.
    while (pending.length) {
      const path = pending.shift();
      if (discovered.has(path)) continue;
      discovered.add(path);
      const source = await get(fixture.origin, path);
      expect(source.status, path).toBe(200);
      expect(source.headers["content-type"]).toBe("text/javascript; charset=utf-8");
      expect(source.headers["cache-control"]).toBe("no-store");
      expect(source.headers["x-content-type-options"]).toBe("nosniff");
      expect(source.headers["content-security-policy"]).toContain("connect-src 'self'");
      const disk = await readFile(new URL(`..${path}`, import.meta.url));
      expect(source.body, path).toBe(disk.toString());
      expect(fixture.sourceManifest.find((row) => row.path === path)).toMatchObject({
        bytes: disk.length, sha256: createHash("sha256").update(disk).digest("hex"),
      });
      const specifiers = [
        ...[...source.body.matchAll(/^\s*import\s+(?:[^;"']+?\s+from\s+)?["']([^"']+)["']/gm)].map((match) => match[1]),
        ...[...source.body.matchAll(/new URL\(["']([^"']+)["'], import\.meta\.url\)/g)].map((match) => match[1]),
      ];
      for (const specifier of specifiers) {
        expect(specifier).toMatch(/^\.\.?\//);
        pending.push(new URL(specifier, `${fixture.origin}${path}`).pathname);
      }
    }
    for (const path of [
      "/adapters/meta-pixel-prototype.js", "/adapters/google-ads-prototype.js",
      "/connectors/meta-pixel/pageview-prototype.worker.js", "/connectors/google-ads/conversion-prototype.worker.js",
      "/core/confine-pixel-chamber.js", "/core/egress-confinement.js", "/core/connector-host.js",
      "/core/wrapped-sdk-host.js",
    ]) expect(discovered.has(path), path).toBe(true);
    expect(new Set(fixture.sourceManifest.map((row) => row.path))).toEqual(discovered);
  });

  it("records two independent HTTP-client arrivals per vendor, withholds only the first response and releases it explicitly", async () => {
    const fixture = await start();
    for (const vendor of ["meta", "google"]) {
      const first = measurement(vendor);
      let settled = false;
      const response = get(fixture.origin, first.path).then((result) => { settled = true; return result; });
      void response.catch(() => {});
      await until(() => fixture.getReceiverArrivals(vendor).length === 1);
      expect(settled).toBe(false);
      expect(fixture.getReceiverArrivals(vendor)[0]).toMatchObject({
        method: "GET", path: first.path.split("?")[0], query: first.path.split("?")[1],
        fields: Object.entries(first.query), status: null, response: "held",
      });
      expect(fixture.releaseFirstResponse(vendor)).toBe(true);
      expect((await response).status).toBe(204);
      expect(fixture.releaseFirstResponse(vendor)).toBe(false);
      const second = measurement(vendor, true);
      expect((await get(fixture.origin, second.path)).status).toBe(204);
      const arrivals = fixture.getReceiverArrivals(vendor);
      expect(arrivals).toHaveLength(2);
      expect(arrivals[1].fields).toEqual(Object.entries(second.query));
      for (const row of arrivals) {
        expect(row.rawFields).toEqual(row.query.split("&").map((field) => field.split("=")));
        expect(row.arrivedAt).toBeGreaterThan(0);
        expect(row.respondedAt).toBeGreaterThanOrEqual(row.arrivedAt);
        expect(row).toMatchObject({ status: 204, response: "finished" });
      }
      arrivals[0].fields[0][1] = "mutated-copy";
      expect(fixture.getReceiverArrivals(vendor)[0].fields[0][1]).not.toBe("mutated-copy");
    }
    expect(fixture.getState().measurementAttempts).toBe(4);
    expect(fixture.getState()).not.toHaveProperty("arrivals");
    expect(JSON.stringify(fixture.getState())).not.toContain("example.test");
  });

  it("refuses unknown paths, queries, aliases, traversal, methods, foreign Host/Origin and request/header/body overflow", async () => {
    const fixture = await start();
    for (const path of [
      "/", "/favicon.ico", "/meta/", "/google/", "/meta?x=1", "/google?",
      "/rig/local-browser-journeys-meta.js?v=1", "/adapters/eds/index.js",
      "/core/query-params.js", "/tr", "/tr/?", "/pagead/conversion/123/",
      "/control/meta/release", "/%6deta", "//meta", "/rig/../meta",
      "/rig/%2e%2e/meta", "/rig%2flocal-browser-journeys-meta.js",
      "/meta#fragment", "/META", "http://127.0.0.1/meta",
    ]) expect((await get(fixture.origin, "/", { path })).status, path).toBe(404);
    for (const method of ["HEAD", "POST", "PUT", "OPTIONS", "DELETE"]) {
      expect((await get(fixture.origin, "/meta", { method })).status).toBe(405);
    }
    expect((await get(fixture.origin, "/meta", { headers: { host: "example.test" } })).status).toBe(400);
    expect((await get(fixture.origin, "/meta", { headers: { origin: "https://example.test" } })).status).toBe(400);
    expect((await get(fixture.origin, "/meta", { headers: { "content-length": "1" }, body: "x" })).status).toBe(400);
    expect((await get(fixture.origin, "/meta", { headers: { "content-length": "65537" } })).status).toBe(413);
    expect((await get(fixture.origin, "/meta", { headers: { "transfer-encoding": "chunked" }, body: "x" })).status).toBe(400);
    expect((await get(fixture.origin, "/meta", { headers: { "x-oversize": "x".repeat(65537) } })).status).toBe(431);
    expect((await get(fixture.origin, "/meta", {
      headers: Object.fromEntries(Array.from({ length: 65 }, (_, index) => [`x-header-${index}`, "x"])),
    })).status).toBe(431);
    expect((await get(fixture.origin, "/", { path: `/${"x".repeat(8192)}` })).status).toBe(414);
    expect(fixture.getReceiverArrivals("meta")).toEqual([]);
    expect(fixture.getReceiverArrivals("google")).toEqual([]);
    expect(fixture.getState().refusedRequests).toBeGreaterThan(0);
  });

  it("rejects noncanonical/duplicate/extra/foreign measurement fields rather than retaining private input", async () => {
    const fixture = await start();
    const meta = measurement("meta").path;
    const google = measurement("google").path;
    for (const path of [
      meta.replace("?id=", "?%69d="), `${meta}&id=000000000000000`,
      `${meta}&unknown=private-input`, meta.replace("id=000000000000000", "id=123456789"),
      meta.replace("example.test", "private.invalid"),
      google.replace("SYNTHETIC_LABEL", "PRIVATE_LABEL"),
      google.replace("synthetic-a", "private-transaction"),
    ]) expect((await get(fixture.origin, path)).status).toBe(400);
    expect(fixture.getReceiverArrivals("meta")).toEqual([]);
    expect(fixture.getReceiverArrivals("google")).toEqual([]);
    expect(JSON.stringify(fixture.getState())).not.toMatch(/private|transaction|123456789/);
    expect(() => fixture.getReceiverArrivals("../meta")).toThrow("fixed-vendor-required");
    expect(() => fixture.releaseFirstResponse("https://example.test")).toThrow("fixed-vendor-required");
    await expect(startLocalBrowserJourneys({ root: "." })).rejects.toThrow("fixed-fixture-no-options");
  });

  it("bounds observed HTTP requests, measurement attempts, response bytes and retained data without configurable production limits", async () => {
    const fixture = await start();
    for (let index = 0; index < 64; index += 1) expect((await get(fixture.origin, "/meta")).status).toBe(200);
    expect((await get(fixture.origin, "/meta")).status).toBe(429);
    expect(fixture.getState()).toMatchObject({ observedRequests: 64, overLimitRequests: 1 });
    const receiver = await start();
    const first = get(receiver.origin, measurement("meta").path);
    void first.catch(() => {});
    await until(() => receiver.getReceiverArrivals("meta").length === 1);
    receiver.releaseFirstResponse("meta");
    expect((await first).status).toBe(204);
    for (let index = 1; index < 8; index += 1) {
      expect((await get(receiver.origin, measurement("meta", index % 2 === 1).path)).status).toBe(204);
    }
    expect((await get(receiver.origin, measurement("meta").path)).status).toBe(429);
    expect(receiver.getReceiverArrivals("meta")).toHaveLength(8);
    expect(receiver.getState().measurementAttempts).toBe(8);
    expect(receiver.limits).toEqual({
      observedRequests: 64, measurementAttempts: 8, urlBytes: 8192, requestBodyBytes: 65536,
      headerBytes: 65536, headerCount: 64, responseBytes: 2097152, retainedBytes: 8388608,
      sockets: 64, responseHoldMs: 2000, cleanupMs: 2000, lifetimeMs: 60000,
    });
    expect(receiver.getState().retainedBytes).toBeLessThanOrEqual(receiver.limits.retainedBytes);
    expect(receiver.sourceManifest.every((row) => row.bytes <= receiver.limits.responseBytes)).toBe(true);
    expect(Object.isFrozen(receiver.limits)).toBe(true);
  });

  it("closes every owned socket including a withheld response and incomplete HTTP connection, with idempotent bounded cleanup", async () => {
    const fixture = await start();
    const idle = connect({ host: "127.0.0.1", port: Number(new URL(fixture.origin).port) });
    idle.on("error", () => {});
    let pending;
    try {
      await once(idle, "connect");
      idle.write("GET /meta HTTP/1.1\r\n");
      pending = get(fixture.origin, measurement("meta").path);
      void pending.catch(() => {});
      await until(() => fixture.getReceiverArrivals("meta").length === 1);
      const closing = fixture.close();
      expect(fixture.close()).toBe(closing);
      let timer;
      let state;
      try {
        state = await Promise.race([
          closing, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("cleanup-test-deadline")), 2500); }),
        ]);
      } finally { clearTimeout(timer); }
      expect(state).toMatchObject({ listening: false, openSockets: 0, pendingResponses: 0, closure: "closed", errors: [] });
      expect(fixture.getState()).toEqual(state);
      expect(fixture.releaseFirstResponse("meta")).toBe(false);
      await expect(get(fixture.origin, "/meta")).rejects.toThrow();
      await pending.catch(() => {});
    } finally {
      idle.destroy();
      await pending?.catch(() => {});
    }
  }, 5000);

  it("makes a failed or unreleased first response visible, with no automatic receipt/retry", async () => {
    const fixture = await start();
    const failure = get(fixture.origin, measurement("meta").path);
    void failure.catch(() => {});
    await until(() => fixture.getReceiverArrivals("meta").length === 1);
    expect(fixture.failFirstResponse("meta")).toBe(true);
    expect((await failure).status).toBe(503);
    expect(fixture.getReceiverArrivals("meta")[0]).toMatchObject({ status: 503, response: "finished" });
    expect((await get(fixture.origin, measurement("google").path)).status).toBe(504);
    expect(fixture.releaseFirstResponse("google")).toBe(false);
    expect(fixture.getReceiverArrivals("google")).toHaveLength(1);
    expect(fixture.getReceiverArrivals("google")[0]).toMatchObject({ status: 504, response: "finished" });
    expect(fixture.getState()).toMatchObject({ pendingResponses: 0, measurementAttempts: 2 });
  }, 5000);

  it("records an aborted held HTTP request without inventing a status or response time", async () => {
    const fixture = await start();
    const controller = new AbortController();
    const response = get(fixture.origin, measurement("meta").path, { signal: controller.signal });
    void response.catch(() => {});
    await until(() => fixture.getReceiverArrivals("meta").length === 1);
    controller.abort();
    await expect(response).rejects.toThrow();
    await until(() => fixture.getReceiverArrivals("meta")[0].response === "aborted");
    expect(fixture.getReceiverArrivals("meta")[0]).toMatchObject({ status: null, respondedAt: null });
    expect(fixture.releaseFirstResponse("meta")).toBe(false);
    expect(fixture.getState().pendingResponses).toBe(0);
  });

  it("preserves omitted Google fields as absent, independently of zero and empty fields", async () => {
    const fixture = await start();
    const query = new URLSearchParams({ label: "SYNTHETIC_LABEL", url: "https://example.test/google-a" });
    const response = get(fixture.origin, `/pagead/conversion/0000000000/?${query}`);
    void response.catch(() => {});
    await until(() => fixture.getReceiverArrivals("google").length === 1);
    fixture.releaseFirstResponse("google");
    expect((await response).status).toBe(204);
    expect(fixture.getReceiverArrivals("google")[0].fields).toEqual([...query]);
  });

  it.each(["meta", "google"])("%s source controller fails closed when Worker is absent (controlled DOM globals, NOT a browser)", async (vendor) => {
    const display = { textContent: "" };
    const window = { addEventListener: vi.fn() };
    const fetch = vi.fn(() => { throw new Error("no-network-in-controller-unit-test"); });
    vi.stubGlobal("window", window);
    vi.stubGlobal("document", { getElementById: () => display });
    vi.stubGlobal("location", new URL(`http://127.0.0.1:43111/${vendor}`));
    vi.stubGlobal("Worker", undefined);
    vi.stubGlobal("fetch", fetch);
    if (vendor === "meta") await import("../rig/local-browser-journeys-meta.js");
    else await import("../rig/local-browser-journeys-google.js");
    expect(window.getJourneyState().phase).toBe("not-started");
    const result = await window.runJourney();
    expect(result).toMatchObject({
      vendor, phase: "failed", failure: "negative-controls-failed",
      receipt: "requires-independent-receiver-observation", overall: "INCONCLUSIVE", fullCompatibility: false,
      captureAndTransport: { terminalReason: "worker-unavailable", host: { dispatchAttempts: 0 } },
    });
    expect(result).not.toHaveProperty("workerLoaded");
    expect(result.disposal).toBe("adapter-dispose-resolved-worker-exit-needs-independent-observation");
    expect(display.textContent).toContain('"phase": "failed"');
    expect(JSON.stringify(result)).not.toMatch(/example\.test|synthetic-a|000000000000000/);
    expect(fetch).not.toHaveBeenCalled();
    expect((await window.runJourney("arbitrary-command")).phase).toBe("failed");
    expect(fetch).not.toHaveBeenCalled();
  });
});
