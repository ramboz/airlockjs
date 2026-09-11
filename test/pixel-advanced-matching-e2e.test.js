// END-TO-END advanced matching (spec 026-04 AC1/AC2/AC3 + the SECURITY
// invariant): the REAL pixel chamber (core/pixel-chamber.worker.js) hashes the
// raw identity with REAL WebCrypto SHA-256 and posts it back; the REAL airlock
// (core/airlock.js) caches those hashes and merges them into the closing unload
// `/tr` GET. Nothing is re-implemented: the chamber's own `{type:"identity",ud}`
// output is PUMPED into the airlock's worker.onmessage (the worker→main channel),
// so a genuine round-trip is exercised and the SHA-256 is real (not a synthetic
// placeholder). The expected hashes are computed INDEPENDENTLY via node:crypto.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createHash } from "node:crypto";
import { createAirlock } from "../core/airlock.js";
import { createMetaPixelConfig } from "../connectors/pixel/vendors/meta.js";

const sha256hex = (s) => createHash("sha256").update(String(s), "utf8").digest("hex");
async function waitFor(pred, tries = 200) {
  for (let i = 0; i < tries; i += 1) {
    if (pred()) return;
    await new Promise((r) => setTimeout(r, 1));
  }
}

const RAW_XID = "11111111-1111-4111-8111-111111111111";
const RAW_EMAIL = " User@Example.COM ";
const RAW_PHONE = "(415) 555-0100";

class FakeWorker {
  constructor(url) { FakeWorker.last = this; this.url = String(url); this.messages = []; this.onmessage = null; this.terminated = 0; }
  postMessage(m) { this.messages.push(m); }
  terminate() { this.terminated++; }
}
function makeListenerRegistry() {
  const map = new Map();
  return {
    addEventListener: (t, fn) => { if (!map.has(t)) map.set(t, new Set()); map.get(t).add(fn); },
    removeEventListener: (t, fn) => { const s = map.get(t); if (s) s.delete(fn); },
    fire: (t, ev) => { for (const fn of [...(map.get(t) || [])]) fn(ev); },
  };
}

describe("026-04 END-TO-END — real chamber hash → real airlock cache → unload merge", () => {
  let chamberSelf, registry;
  const chamberIdentityMsgs = () =>
    chamberSelf.postMessage.mock.calls.map((c) => c[0]).filter((m) => m && m.type === "identity");

  beforeEach(async () => {
    // The REAL chamber, wired to a capturing fake `self` (its worker→main output).
    chamberSelf = { postMessage: vi.fn() };
    globalThis.self = chamberSelf;
    vi.resetModules();
    await import("../core/pixel-chamber.worker.js");
    // The REAL airlock, over the FakeWorker harness + unload listeners.
    FakeWorker.last = null;
    vi.stubGlobal("Worker", FakeWorker);
    registry = makeListenerRegistry();
    vi.stubGlobal("addEventListener", registry.addEventListener);
    vi.stubGlobal("removeEventListener", registry.removeEventListener);
    vi.stubGlobal("requestIdleCallback", () => 1); // keep the ring resident until the unload flush
  });
  afterEach(() => { delete globalThis.self; vi.unstubAllGlobals(); });

  it("external_id (boot) + em/ph (setIdentity) hash for real, cache, and ride the closing GET as ud[...] — with NO raw, EVEN under a payloadDenylist covering them (AC1/AC2/AC3 + SECURITY)", async () => {
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);

    const config = createMetaPixelConfig({ externalId: RAW_XID });
    const airlock = createAirlock({
      trackers: 1, workFactor: 0, endpoints: [config.endpoint], ctx: {}, unloadCritical: [],
      connector: "pixel", connectorConfig: config, egressPurposes: ["ad_storage"],
      consent: { ad_storage: "granted" },
      // AC2: a denylist covering the identity fields must NOT strip the hashed ud[...]
      // (the identity feed bypasses input governance BY DESIGN — value egresses only hashed).
      payloadDenylist: ["email", "em", "ph", "external_id"],
    });

    // Drive the REAL chamber with the SAME boot config + a setIdentity PII feed.
    chamberSelf.onmessage({ data: { type: "init", ...config } });
    chamberSelf.onmessage({ data: { type: "identity", raw: { em: RAW_EMAIL, ph: RAW_PHONE } } });
    await waitFor(() => chamberIdentityMsgs().length >= 3); // external_id + em + ph hashed by the real chamber

    // PUMP the chamber's real identity output into the real airlock (the worker→main channel).
    for (const m of chamberIdentityMsgs()) FakeWorker.last.onmessage({ data: m });

    // The closing beacon.
    airlock.push({ event: "page_view" });
    registry.fire("pagehide");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe("GET");
    const sp = new URL(url).searchParams;
    expect(sp.get("ud[external_id]")).toBe(sha256hex(RAW_XID)); // no normalization
    expect(sp.get("ud[em]")).toBe(sha256hex("user@example.com")); // trim+lowercase
    expect(sp.get("ud[ph]")).toBe(sha256hex("4155550100")); // digits, leading zeros stripped

    // SECURITY — no raw identity value (or normalized-but-unhashed value) anywhere on the wire.
    expect(url).not.toContain(RAW_XID);
    expect(url).not.toContain("User@Example.COM");
    expect(url).not.toContain("user@example.com");
    expect(url).not.toContain("4155550100");
  });

  it("AC7 — the emitted external_id hash is the SYNTHETIC id's hash, never the fixture's real redacted value", async () => {
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    const config = createMetaPixelConfig({ externalId: RAW_XID });
    const airlock = createAirlock({
      trackers: 1, workFactor: 0, endpoints: [config.endpoint], ctx: {}, unloadCritical: [],
      connector: "pixel", connectorConfig: config, egressPurposes: ["ad_storage"], consent: { ad_storage: "granted" },
    });
    chamberSelf.onmessage({ data: { type: "init", ...config } });
    await waitFor(() => chamberIdentityMsgs().length >= 1);
    for (const m of chamberIdentityMsgs()) FakeWorker.last.onmessage({ data: m });
    airlock.pushCritical({ event: "page_view" });

    const hex = new URL(fetchMock.mock.calls[0][0]).searchParams.get("ud[external_id]");
    expect(hex).toBe(sha256hex(RAW_XID));
    // The fixture's real external_id hash was never in the tree (it is the literal
    // "REDACTED_SHA256"); assert we never reproduce that placeholder as a hash either.
    expect(hex).not.toBe("REDACTED_SHA256");
    expect(hex).not.toBe(sha256hex("REDACTED_SHA256"));
  });
});
