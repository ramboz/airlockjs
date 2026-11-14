import { EventEmitter } from "node:events";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { FIXTURE_ROOTS, scanFixtureFiles } from "./fixture-credentials.mjs";
import { checkFixtureManifest } from "./fixture-manifest.mjs";
import {
  META_CAPTURE_ROOT, META_CORPUS, buildMetaManifest, corpusState, createNativeRecorder, egressLabel,
  launchOptions, recordingDir,
} from "./meta-capture.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const inputState = {
  url: "https://test.example.invalid/", referrer: null, viewport: { width: 1280, height: 800 },
  locale: "en-US", timezone: "Europe/Paris", egress: egressLabel("eea", "exit-eea-1"),
  browser: { name: "chromium", version: "130.0.0.0" }, mode: "headed", profile_kind: "fresh",
  loaded_digests: { script_sha256: "a".repeat(64), config_sha256: null },
  storage_before: { cookies: [], local_storage: {}, session_storage: {} },
  storage_after: { cookies: [{ name: "_fbp", value: "fb.1.1.1" }], local_storage: {}, session_storage: {} },
};

describe("066-03 Meta corpus layout (AC2)", () => {
  it("covers S0 to S18 once each, under a root the shared credential check scans", () => {
    expect(META_CORPUS.map(s => s.id)).toEqual(Array.from({ length: 19 }, (_, i) => `S${i}`));
    expect(FIXTURE_ROOTS).toContain(META_CAPTURE_ROOT.split("/").slice(0, 2).join("/"));
    expect(recordingDir("S4", "eea", "purchase")).toBe(`${META_CAPTURE_ROOT}/S4-standard-events/purchase/eea`);
  });
  it("rejects unknown states, kinds the state does not record, and path-like variants", () => {
    expect(() => corpusState("S19")).toThrow("unknown_state");
    expect(() => recordingDir("S16", "repeat")).toThrow("unknown_kind");
    expect(() => recordingDir("S1", "base", "../x")).toThrow("bad_variant");
  });
  it("supports headed and headless only", () => {
    expect(launchOptions("headless")).toEqual({ headless: true });
    expect(launchOptions("headed")).toEqual({ headless: false });
    expect(() => launchOptions("new")).toThrow("bad_mode");
  });
  it("records EEA egress as a label plus opaque ID and rejects host-like IDs", () => {
    const m = buildMetaManifest({ capturedAt: "2026-11-14T10:00:00Z", inputState });
    expect(m.vendor).toBe("meta-pixel");
    expect(checkFixtureManifest(m).ok).toBe(true);
    expect(() => buildMetaManifest({
      capturedAt: "2026-11-14T10:00:00Z",
      inputState: { ...inputState, egress: egressLabel("eea", "proxy.example.com:8080") },
    })).toThrow("egress");
  });
});

function fakePage() {
  const page = new EventEmitter();
  page.off = page.removeListener;
  return page;
}
function fakeRequest(url, { redirectedFrom = null } = {}) {
  return {
    url: () => url, method: () => "GET", resourceType: () => "image", headers: () => ({ accept: "*/*" }),
    postDataBuffer: () => null, redirectedFrom: () => redirectedFrom, failure: () => null,
    abort() { throw new Error("native request aborted"); },
    continue() { throw new Error("native request intercepted"); },
    fulfill() { throw new Error("native request fulfilled"); },
  };
}
const fakeResponse = (request, status, body, headers = {}) => ({
  request: () => request, status: () => status, statusText: () => "OK", headers: () => headers,
  body: async () => { if (body instanceof Error) throw body; return Buffer.from(body); },
});

describe("066-03 no-abort native recorder (AC2)", () => {
  it("records the redirect chain, headers and a zero-length body as such, without touching requests", async () => {
    const page = fakePage();
    const rec = createNativeRecorder(page, { now: () => "t" });
    const first = fakeRequest("https://native.example.invalid/tr?id=1");
    const second = fakeRequest("https://native.example.invalid/tr/next", { redirectedFrom: first });
    page.emit("request", first);
    page.emit("response", fakeResponse(first, 302, "", { location: "/tr/next" }));
    page.emit("request", second);
    page.emit("response", fakeResponse(second, 200, "", { "content-type": "image/gif" }));
    await rec.settled();
    const [a, b] = rec.entries();
    expect(a.response).toMatchObject({ status: 302, headers: { location: "/tr/next" }, body_length: 0, body_base64: "" });
    expect(b).toMatchObject({ redirected_from: 0, response: { status: 200, body_length: 0 } });
    rec.detach();
    expect(page.listenerCount("request")).toBe(0);
  });
  it("keeps a failed request and an unreadable body as recorded rows, not as errors", async () => {
    const page = fakePage();
    const rec = createNativeRecorder(page);
    const failed = { ...fakeRequest("https://native.example.invalid/a"), failure: () => ({ errorText: "net::ERR_BLOCKED" }) };
    const unreadable = fakeRequest("https://native.example.invalid/b");
    page.emit("request", failed);
    page.emit("requestfailed", failed);
    page.emit("request", unreadable);
    page.emit("response", fakeResponse(unreadable, 200, new Error("no body")));
    await rec.settled();
    const [a, b] = rec.entries();
    expect(a.failure).toBe("net::ERR_BLOCKED");
    expect(b.response).toMatchObject({ status: 200, body_error: "no body", body_length: null });
  });
});

describe("066-03 credential check over seeded fixtures (AC3)", () => {
  it("fails a seeded bad recording and passes a clean one", async () => {
    const dir = await mkdtemp(join(tmpdir(), "meta-capture-"));
    try {
      const bad = join(dir, "bad", "S1-pageview-fresh", "default", "base");
      const good = join(dir, "good", "S1-pageview-fresh", "default", "base");
      await mkdir(bad, { recursive: true });
      await mkdir(good, { recursive: true });
      const page = fakePage();
      const rec = createNativeRecorder(page);
      const req = { ...fakeRequest("https://native.example.invalid/tr"), headers: () => ({ cookie: "_fbp=fb.1.1.1; c_user=1000" }) };
      page.emit("request", req);
      page.emit("response", fakeResponse(req, 200, ""));
      await rec.settled();
      await writeFile(join(bad, "requests.json"), JSON.stringify(rec.entries()));
      await writeFile(join(good, "requests.json"), JSON.stringify([{ request_headers: { cookie: "_fbp=fb.1.1.1" }, url: "https://native.example.invalid/tr" }]));
      await writeFile(join(good, "manifest.json"), JSON.stringify(buildMetaManifest({ capturedAt: "2026-11-14T10:00:00Z", inputState })));
      const found = await scanFixtureFiles([join(dir, "bad")], dir);
      expect(found.map(f => f.rule)).toContain("meta_session_cookie");
      expect(await scanFixtureFiles([join(dir, "good")], dir)).toEqual([]);
    } finally { await rm(dir, { recursive: true, force: true }); }
  });
  it("finds nothing in committed Meta captures", async () => {
    expect(await scanFixtureFiles([join(root, META_CAPTURE_ROOT)], root)).toEqual([]);
  });
});

describe("066-03 no copies of the shared tooling (AC1)", () => {
  it("imports the shared manifest check instead of redefining it", async () => {
    const src = await readFile(join(root, "rig/meta-capture.mjs"), "utf8");
    expect(src).toContain('from "./fixture-manifest.mjs"');
    expect(src).not.toMatch(/c_user|datr|COOKIE_RULES|VENDORS\s*=/);
  });
});
