import { describe, expect, it } from "vitest";
import { EventEmitter } from "node:events";
import { createHash } from "node:crypto";
import { attachCaptureRecorder, AlloyPinError, ALLOY_SHA256 } from "../probes/adobe-compatibility/capture-recorder.mjs";
import { buildManifest, finishFixture, scrubText, LABELS } from "../probes/adobe-compatibility/capture-fixture.mjs";
import { checkFixtureManifest } from "../rig/fixture-manifest.mjs";

const ORIGIN = "https://page.example";
function req(url, { method = "GET", body = null, type = "xhr" } = {}) {
  return {
    url: () => url, method: () => method, resourceType: () => type,
    postDataBuffer: () => (body === null ? null : Buffer.from(body)),
    allHeaders: async () => ({ "content-type": "application/json" }),
    failure: () => ({ errorText: "net::ERR_BLOCKED_BY_CLIENT" }),
  };
}
function res(request, status, body, headers = { "content-type": "application/json" }) {
  return { request: () => request, status: () => status, allHeaders: async () => headers, body: async () => Buffer.from(body) };
}

describe("capture recorder", () => {
  it("records full fan-out beyond Edge and bounds it", async () => {
    const ctx = new EventEmitter();
    const rec = attachCaptureRecorder(ctx, { pageOrigin: ORIGIN, limits: { maxRequests: 3, maxBodyBytes: 4 } });
    const edge = req("https://edge.adobedc.net/ee/v1/interact?x=1", { method: "POST", body: "abcdefgh" });
    const sync = req("https://dpm.demdex.net/id");
    ctx.emit("request", req(`${ORIGIN}/page.css`));
    ctx.emit("request", edge);
    ctx.emit("response", res(edge, 200, '{"ok":true}'));
    ctx.emit("request", sync);
    ctx.emit("response", res(sync, 204, ""));
    ctx.emit("request", req("https://a.example/1"));
    ctx.emit("request", req("https://a.example/2"));
    const { requests, dropped } = await rec.records();
    expect(requests.map(r => r.url)).toEqual(["https://edge.adobedc.net/ee/v1/interact?x=1", "https://dpm.demdex.net/id", "https://a.example/1"]);
    expect(requests[0]).toMatchObject({ status: 200, request_body: "abcd", request_body_truncated: true, request_body_bytes: 8, response_body: '{"ok' });
    expect(requests[0].response_headers["content-type"]).toBe("application/json");
    expect(dropped).toBe(1);
  });

  it("verifies the Alloy pin and aborts on mismatch or absence", async () => {
    const bytes = Buffer.from("not-alloy");
    const ctx = new EventEmitter();
    const rec = attachCaptureRecorder(ctx, { pageOrigin: ORIGIN });
    await expect(rec.verifyAlloy()).rejects.toThrow(AlloyPinError);
    const a = req(`${ORIGIN}/vendor/alloy.min.js`, { type: "script" });
    ctx.emit("request", a);
    ctx.emit("response", { ...res(a, 200, "not-alloy"), body: async () => bytes });
    await expect(rec.verifyAlloy()).rejects.toThrow(/does not match the pin/);
    const ok = attachCaptureRecorder(ctx, { pageOrigin: ORIGIN, alloySha256: createHash("sha256").update(bytes).digest("hex") });
    const b = req(`${ORIGIN}/vendor/alloy.min.js`, { type: "script" });
    ctx.emit("request", b);
    ctx.emit("response", { ...res(b, 200, ""), body: async () => bytes });
    await expect(ok.verifyAlloy()).resolves.toMatchObject({ loads: [{ bytes: 9 }] });
    expect(ALLOY_SHA256).toMatch(/^7dd09409/);
  });

  it("records failed requests", async () => {
    const ctx = new EventEmitter();
    const rec = attachCaptureRecorder(ctx, { pageOrigin: ORIGIN });
    const r = req("https://edge.adobedc.net/ee/v1/interact");
    ctx.emit("request", r);
    ctx.emit("requestfailed", r);
    expect((await rec.records()).requests[0].failure).toMatch(/BLOCKED/);
  });
});

describe("capture fixture", () => {
  const input = {
    url: `${ORIGIN}/?x=1`, referrer: null, viewport: { width: 1280, height: 800 }, locale: "en-US",
    timezone: "America/New_York", egress: { region: "non-eea", exit_id: "default" },
    browser: { name: "chromium", version: "140.0.0.0" }, mode: "headed", profileKind: "fresh",
  };
  const empty = { cookies: [], localStorage: {}, sessionStorage: {} };
  const manifest = buildManifest({ capturedAt: "2026-11-19T17:00:00.000Z", input, alloySha256: ALLOY_SHA256, before: empty, after: { ...empty, cookies: [{ name: "kndctr_x_AdobeOrg_identity", value: "abc" }] } });

  it("builds manifests that pass the shared check", () => {
    expect(checkFixtureManifest(manifest)).toEqual({ ok: true, errors: [] });
  });

  it("scrubs withheld IDs to labels and rejects credentials", () => {
    const withheld = { analyticsReportSuite: "SECRETSUITE-1", targetPropertyToken: "tok-0000-1111", targetEnvironmentId: "env99" };
    const { text, counts } = scrubText("a SECRETSUITE-1 b tok-0000-1111 c env99", withheld);
    expect(text).toBe(`a ${LABELS.analyticsReportSuite} b ${LABELS.targetPropertyToken} c ${LABELS.targetEnvironmentId}`);
    expect(counts.analyticsReportSuite).toBe(1);
    const done = finishFixture({ manifest, capture: { n: 1 }, requests: [{ body: "SECRETSUITE-1" }], withheld });
    expect(done.text).not.toContain("SECRETSUITE-1");
    expect(() => finishFixture({ manifest, capture: {}, requests: [{ h: { authorization: "Bearer abcdefghijkl" } }], withheld }))
      .toThrow(/credential_findings/);
    expect(() => finishFixture({ manifest, capture: {}, requests: [], withheld: {} })).toThrow(/withheld_ids_missing/);
    const bad = structuredClone(manifest);
    delete bad.input_state.mode;
    expect(() => finishFixture({ manifest: bad, capture: {}, requests: [], withheld })).toThrow(/manifest_invalid/);
  });
});
