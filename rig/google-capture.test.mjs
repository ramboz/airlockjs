import { EventEmitter } from "node:events";
import { mkdtemp, readFile, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { scanFixtureText } from "./fixture-credentials.mjs";
import {
  GOOGLE_CAPTURE_ROOT, GOOGLE_SEED_CLASSES, buildGoogleManifest, classifyRecordings, cookieAllowed,
  createNativeRecorder, queryPairs, recordDriftProbeA, recordFieldNoise, recordingDir, runDriftProbes, storeRecording,
} from "./google-capture.mjs";

const D = c => c.repeat(64);
const BEGIN = "/*cfg*/", END = "/*end*/";
const loader = (config, lib = "LIBRARY") => Buffer.from(`${lib}${BEGIN}${config}${END}TAIL`);
const locate = bytes => {
  const s = bytes.indexOf(BEGIN), e = bytes.indexOf(END);
  return s < 0 ? null : { start: s + BEGIN.length, end: e };
};
const retainedFor = bytes => {
  const region = locate(bytes);
  const lib = Buffer.concat([bytes.subarray(0, region.start), bytes.subarray(region.end)]);
  return { library_length: lib.length, library_sha256: recordDriftProbeA({ served: bytes, locateConfig: locate }).served.library.sha256, bytes };
};

describe("065-04 drift probe part A", () => {
  it("matches when only the per-id config region differs, and records the config baseline", () => {
    const retained = retainedFor(loader("id-one"));
    const a = recordDriftProbeA({ served: loader("id-two!"), locateConfig: locate, retained });
    expect(a.status).toBe("match");
    expect(a.retained_bytes_usable).toBe(true);
    expect(a.config).toBe("baseline_recorded");
    expect(a.served.config.length).toBe(7);
  });
  it("reports a moved library region with a coarse diff and marks retained bytes unusable", () => {
    const retained = retainedFor(loader("x"));
    const a = recordDriftProbeA({ served: loader("x", "LIBRARY2"), locateConfig: locate, retained });
    expect(a.status).toBe("library_changed");
    expect(a.retained_bytes_usable).toBe(false);
    expect(a.library.diff.first_diff_offset).toBe(7);
  });
  it("tracks the config region on day 2 and stays unresolved when it cannot be located", () => {
    const first = recordDriftProbeA({ served: loader("same"), locateConfig: locate });
    const again = recordDriftProbeA({ served: loader("same"), locateConfig: locate, priorConfigSha256: first.served.config.sha256 });
    expect(again.config).toBe("unchanged");
    expect(recordDriftProbeA({ served: loader("other"), locateConfig: locate, priorConfigSha256: first.served.config.sha256 }).config).toBe("changed");
    const none = recordDriftProbeA({ served: Buffer.from("no region"), locateConfig: locate });
    expect([none.status, none.config_region]).toEqual(["unresolved", "unlocated"]);
  });
});

const url = (q, host = "www.googletagmanager.com", path = "/g/collect") => `https://${host}${path}?${q}`;
describe("065-04 drift probe part B", () => {
  it("records per-region field noise and region-dependent fields", () => {
    const load = (region, rnd, dma) => ({ region, requests: [{ method: "POST", url: url(`tid=T&rnd=${rnd}&dma=${dma}`) }] });
    const noise = recordFieldNoise({ loads: [load("non-eea", "1", "0"), load("non-eea", "2", "0"), load("eea", "3", "1"), load("eea", "4", "1")] });
    const slot = "POST www.googletagmanager.com/g/collect#0";
    expect(noise.regions["non-eea"].slots[slot].fields.rnd.varies).toBe(true);
    expect(noise.regions.eea.slots[slot].fields.tid.varies).toBe(false);
    expect(noise.region_dependent).toEqual([`${slot} dma`]);
  });
  it("runs both parts through injected loaders", async () => {
    const out = await runDriftProbes({ fetchServed: async () => loader("c"), locateConfig: locate, regions: ["non-eea", "eea"], repeats: 2,
      loadState: async (_r, i) => [{ method: "GET", url: url(`n=${i}`) }] });
    expect(out.part_a.status).toBe("recorded");
    expect(out.part_b.regions.eea.loads).toBe(2);
  });
});

describe("065-04 classifier", () => {
  const rec = (sha256, region, q) => ({ sha256, region, requests: [{ method: "GET", url: url(q) }, { method: "GET", url: url("a=1", "pagead2.googlesyndication.com", "/ccm/collect") }] });
  const classes = [{ name: "collect", pathPrefix: "/g/collect" }, { name: "ccm", host: "pagead2.googlesyndication.com" }];
  it("emits comparator-shaped rules, fixed fields and request classes", () => {
    const out = classifyRecordings({ requestClasses: classes, recordings: [
      rec(D("a"), "non-eea", "tid=T&rnd=1700000000001&dma=0"), rec(D("b"), "eea", "tid=T&rnd=1700000000002&dma=1")] });
    expect(out.ok).toBe(true);
    expect(out.requests.map(r => r.class)).toEqual(["collect", "ccm"]);
    expect(out.fixed.map(f => f.name)).toContain("tid");
    const [rnd, dma] = out.rules.fields;
    expect(rnd).toMatchObject({ class: "generated", format: { kind: "epoch_ms" }, relation: "none", selectors: [{ request: 0, field: "query", index: 1 }] });
    expect(dma).toMatchObject({ class: "server_context", context: "egress_region", allowed: ["0", "1"] });
    expect(rnd.derived_from).toEqual([D("a"), D("b")]);
  });
  it("never classes an unseeded or fixed-seeded varying field, and follows a supplied seed table", () => {
    const set = [rec(D("a"), "x", "tid=A&n=1"), rec(D("b"), "x", "tid=B&n=2")];
    const out = classifyRecordings({ recordings: set });
    expect(out.ok).toBe(false);
    expect(out.unstable.map(u => u.reason)).toEqual(["no_class", "no_class"]);
    const seeded = classifyRecordings({ recordings: set, seeds: { n: { class: "volatile" }, tid: { class: "fixed" } } });
    expect(seeded.unstable.map(u => u.reason)).toEqual(["fixed_varies"]);
    expect(seeded.rules.fields).toHaveLength(1);
  });
  it("refuses protected keys and mismatched sequences", () => {
    const set = [rec(D("a"), "x", "gcs=G111"), rec(D("b"), "x", "gcs=G100")];
    const out = classifyRecordings({ recordings: set, seeds: { gcs: { class: "generated" } } });
    expect(out.unstable[0].reason).toBe("protected_field");
    const odd = { ...set[1], requests: [set[1].requests[0]] };
    expect(classifyRecordings({ recordings: [set[0], odd] })).toEqual({ ok: false, issues: ["sequence_mismatch"] });
  });
  it("seeds only generated and region fields by default", () => {
    expect(Object.keys(GOOGLE_SEED_CLASSES)).toContain("dma");
    expect(queryPairs(url("a=1&a=2"))).toEqual([["a", "1"], ["a", "2"]]);
  });
});

describe("065-04 cookie allow-list (3.4)", () => {
  it("allows the tag's own names and follows the configured prefix", () => {
    for (const n of ["_gcl_au", "_gcl_aw", "_gcl_ls", "_gac_gb_AW-1"]) expect(cookieAllowed(n)).toBe(true);
    expect(cookieAllowed("_fp_aw", { prefix: "_fp" })).toBe(true);
    expect(cookieAllowed("_gcl_aw", { prefix: "_fp" })).toBe(false);
  });
  it("gates GA4, first-party mode and test_cookie, and denies login names", () => {
    expect(cookieAllowed("_ga")).toBe(false);
    expect(cookieAllowed("_ga_ABC", { ga4: true })).toBe(true);
    expect(cookieAllowed("FPAU")).toBe(false);
    expect(cookieAllowed("FPAU", { firstPartyMode: true })).toBe(true);
    expect(cookieAllowed("test_cookie")).toBe(false);
    expect(cookieAllowed("test_cookie", { vendorDomain: true })).toBe(true);
    for (const n of ["SID", "HSID", "__Secure-3PSID", "SAPISID"]) expect(cookieAllowed(n, { ga4: true })).toBe(false);
  });
});

const inputState = (cookies = []) => ({
  url: "https://test.example.invalid/", referrer: null, viewport: { width: 1280, height: 800 },
  locale: "en-US", timezone: "Europe/Paris", egress: { region: "eea", exit_id: "exit-eea-1" },
  browser: { name: "chromium", version: "130.0.0.0" }, mode: "headed", profile_kind: "fresh",
  loaded_digests: { script_sha256: D("a"), config_sha256: null },
  storage_before: { cookies: [], local_storage: {}, session_storage: {} },
  storage_after: { cookies, local_storage: {}, session_storage: {} },
});

describe("065-04 capture driver", () => {
  it("lays recordings under a root the shared credential check scans", () => {
    expect(recordingDir("S1", "base")).toBe(`${GOOGLE_CAPTURE_ROOT}/S1/default/base`);
    expect(() => recordingDir("../x", "base")).toThrow("bad_path_segment");
  });
  it("records through page events only, never touching routing", async () => {
    const page = new EventEmitter();
    page.off = page.removeListener;
    page.route = () => { throw new Error("must not route"); };
    const rec = createNativeRecorder(page, { now: () => "t" });
    const req = { url: () => "https://x.invalid/a?b=1", method: () => "GET", headers: () => ({}), postDataBuffer: () => null };
    page.emit("request", req);
    page.emit("response", { request: () => req, status: () => 204, headers: () => ({}), body: async () => Buffer.alloc(0) });
    await rec.settled();
    expect(rec.entries()[0].response).toMatchObject({ status: 204, body_length: 0, body_base64: "" });
    rec.detach();
    expect(page.listenerCount("request")).toBe(0);
  });
  it("stores through the shared manifest and credential checks", async () => {
    const dir = await mkdtemp(join(await realpath(tmpdir()), "g0-"));
    try {
      const manifest = buildGoogleManifest({ capturedAt: "2026-11-13T00:00:00Z", inputState: inputState([{ name: "_gcl_au", value: "1.1.2.3" }]) });
      const digests = await storeRecording({ outputDir: join(dir, "ok"), manifest, entries: [{ url: "https://x.invalid/" }] });
      expect(Object.keys(digests)).toEqual(["manifest.json", "requests.json"]);
      expect(scanFixtureText(await readFile(join(dir, "ok/manifest.json"), "utf8"))).toEqual([]);
      const bad = buildGoogleManifest({ capturedAt: "2026-11-13T00:00:00Z", inputState: inputState([{ name: "mystery", value: "v" }]) });
      await expect(storeRecording({ outputDir: join(dir, "bad"), manifest: bad, entries: [] })).rejects.toThrow("cookie_not_allow_listed:mystery");
      await expect(storeRecording({ outputDir: join(dir, "cred"), manifest, entries: [{ h: ["Authorization", "Bearer abcdefgh12345"] }] })).rejects.toThrow("credential_found");
      expect(() => buildGoogleManifest({ capturedAt: "x", inputState: {} })).toThrow("manifest_invalid");
    } finally { await rm(dir, { recursive: true, force: true }); }
  });
});
