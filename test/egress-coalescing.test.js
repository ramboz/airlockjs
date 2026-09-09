// Core-egress coalescing seam (spec 040-02, ADR-0021 Option C) — the OPTIONAL
// `coalesce(requests) -> EgressRequest[]` hook wired into `core/airlock.js`'s
// dispatch, AFTER the per-request egress verdict (`egressVerdict`) and the
// endpoint-ceiling check, BEFORE `fetch`. Drives `worker.onmessage` directly
// against the real seam via the SAME hermetic FakeWorker harness
// test/consent-seal.test.js / test/endpoint-ceiling-seam.test.js use — no real
// Worker needed.
//
// This is a DIFFERENT mechanism from `core/coalescing-broker.js` (Alloy's
// identity-mint deduper on the round-trip `caps.egress.dispatch` path,
// ADR-0008) — nothing here imports or exercises that module (ADR-0021
// Amendment 2026-09-09; slice-02 Assumptions).
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createAirlock } from "../core/airlock.js";

class FakeWorker {
  constructor(url, opts) {
    FakeWorker.last = this;
    this.url = String(url);
    this.opts = opts;
    this.messages = [];
    this.onmessage = null;
    this.onerror = null;
  }
  postMessage(m) { this.messages.push(m); }
  terminate() {}
}

const DECLARED_A = "https://collect.example/mp/collect";
const DECLARED_B = "https://collect.example/mp/other";
const EVIL = "https://evil.example/steal";
const ctx = { clientId: "1234567890.1700000000", sessionId: "1724668790" };

beforeEach(() => {
  FakeWorker.last = null;
  vi.stubGlobal("Worker", FakeWorker);
});
afterEach(() => vi.unstubAllGlobals());

const make = (opts) =>
  createAirlock({
    trackers: 1,
    workFactor: 0,
    endpoints: [DECLARED_A, DECLARED_B],
    ctx,
    unloadCritical: [],
    ...opts,
  });

const readyMsg = (reqs) => ({ data: { ready: reqs, dropped: [] } });

describe("AC3 — a same-group burst coalesces via the injected hook", () => {
  it("groups same-endpoint survivors into ONE hook call and dispatches the hook's (fewer) merged output", () => {
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    const coalesce = vi.fn((requests) => [{ url: DECLARED_A, method: "POST", body: `merged:${requests.length}` }]);
    make({ coalesce });

    FakeWorker.last.onmessage(
      readyMsg([
        { url: `${DECLARED_A}?tid=1`, method: "POST", body: '{"n":1}' },
        { url: `${DECLARED_A}?tid=2`, method: "POST", body: '{"n":2}' },
        { url: `${DECLARED_A}?tid=3`, method: "POST", body: '{"n":3}' },
      ]),
    );

    expect(coalesce).toHaveBeenCalledTimes(1);
    expect(coalesce.mock.calls[0][0].map((r) => r.url)).toEqual([
      `${DECLARED_A}?tid=1`,
      `${DECLARED_A}?tid=2`,
      `${DECLARED_A}?tid=3`,
    ]);

    // Load-bearing: WITHOUT the 040-02 wiring, each of the 3 survivors would
    // dispatch as its own fetch (today's default) — this count would be 3,
    // not 1, if the hook were removed/unwired.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      DECLARED_A,
      expect.objectContaining({ method: "POST", body: "merged:3", keepalive: true }),
    );
  });
});

describe("AC2 — a cross-endpoint pair is NOT merged (group key = origin+path)", () => {
  it("calls the hook once PER endpoint group, never combining two different endpoints", () => {
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    const coalesce = vi.fn((requests) => requests); // identity passthrough
    make({ coalesce });

    FakeWorker.last.onmessage(
      readyMsg([
        { url: DECLARED_A, method: "POST", body: "a" },
        { url: DECLARED_B, method: "POST", body: "b" },
      ]),
    );

    // If the grouping key were coarser than origin+path (a bug), this would
    // collapse to ONE call carrying both requests together.
    expect(coalesce).toHaveBeenCalledTimes(2);
    expect(coalesce.mock.calls[0][0]).toEqual([expect.objectContaining({ url: DECLARED_A })]);
    expect(coalesce.mock.calls[1][0]).toEqual([expect.objectContaining({ url: DECLARED_B })]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    // Cross-group dispatch follows first-seen group order (A before B) — the
    // Map preserves insertion order, so the observable fetch order is stable.
    expect(fetchMock.mock.calls[0][0]).toBe(DECLARED_A);
    expect(fetchMock.mock.calls[1][0]).toBe(DECLARED_B);
  });
});

describe("AC1 — governance-safe on INPUTS: a denied/held/ceiling-blocked request never reaches the coalescer", () => {
  it("a ceiling-blocked (undeclared endpoint) input is absent from what the hook receives", () => {
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    const coalesce = vi.fn((requests) => requests);
    make({ coalesce, onDiagnostic: vi.fn() });

    FakeWorker.last.onmessage(
      readyMsg([
        { url: EVIL, method: "POST", body: "exfil" },
        { url: DECLARED_A, method: "POST", body: "ok" },
      ]),
    );

    // If governance ran AFTER (or not at all before) coalescing, the hook
    // would see 2 requests, including the undeclared one.
    expect(coalesce).toHaveBeenCalledTimes(1);
    expect(coalesce.mock.calls[0][0]).toHaveLength(1);
    expect(coalesce.mock.calls[0][0][0].url).toBe(DECLARED_A);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(DECLARED_A, expect.anything());
  });

  it("a consent-held (pending purpose) input never reaches the coalescer at all", () => {
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    const onDiagnostic = vi.fn();
    const coalesce = vi.fn((requests) => requests);
    make({ coalesce, onDiagnostic, egressPurposes: ["analytics_storage"] }); // consent defaults -> pending -> hold

    FakeWorker.last.onmessage(readyMsg([{ url: DECLARED_A, method: "POST", body: "{}" }]));

    // Non-vacuous: the request WAS held — the consent seal ran and emitted its
    // held diagnostic — so the hook being un-called is BECAUSE the seal ran
    // BEFORE coalescing, not merely because coalesce wiring is absent. If the
    // seal ran after (or not before) coalescing, the hook would see the held
    // request and this held diagnostic would not precede it.
    expect(onDiagnostic).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "consent", disposition: "held" }),
    );
    expect(coalesce).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("AC1 — governance-safe on the OUTPUT: a hook-emitted off-endpoint URL is caught before dispatch", () => {
  it("re-runs the endpoint ceiling on each hook output — an off-endpoint output is held, not fetched, with an endpoint-ceiling diagnostic", () => {
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    const onDiagnostic = vi.fn();
    const coalesce = vi.fn(() => [{ url: EVIL, method: "POST", body: "exfil" }]);
    make({ coalesce, onDiagnostic });

    FakeWorker.last.onmessage(readyMsg([{ url: DECLARED_A, method: "POST", body: "{}" }]));

    // Load-bearing: WITHOUT the output re-check (AC1's ADR-0021:88 closure),
    // this off-endpoint output would be fetched unchecked.
    expect(fetchMock).not.toHaveBeenCalled();
    expect(onDiagnostic).toHaveBeenCalledWith(
      expect.objectContaining({ level: "error", kind: "endpoint-ceiling", disposition: "held", destination: EVIL }),
    );
  });

  it("a hook output that DOES name a declared endpoint dispatches normally alongside a held sibling", () => {
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    const onDiagnostic = vi.fn();
    // One group's hook SPLITS into a good + a bad output.
    const coalesce = vi.fn(() => [
      { url: DECLARED_A, method: "POST", body: "ok" },
      { url: EVIL, method: "POST", body: "exfil" },
    ]);
    make({ coalesce, onDiagnostic });

    FakeWorker.last.onmessage(readyMsg([{ url: DECLARED_A, method: "POST", body: "{}" }]));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(DECLARED_A, expect.objectContaining({ body: "ok" }));
    expect(onDiagnostic).toHaveBeenCalledWith(expect.objectContaining({ kind: "endpoint-ceiling", destination: EVIL }));
  });
});

describe("coalesce hook edge returns — undefined / empty are safe no-ops", () => {
  it("a hook returning undefined dispatches nothing and does not throw (the `|| []` guard)", () => {
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    const coalesce = vi.fn(() => undefined);
    make({ coalesce });

    expect(() =>
      FakeWorker.last.onmessage(readyMsg([{ url: DECLARED_A, method: "POST", body: "{}" }])),
    ).not.toThrow();
    expect(coalesce).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("a hook returning [] dispatches nothing (the connector chose to drop the group)", () => {
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    const coalesce = vi.fn(() => []);
    make({ coalesce });

    FakeWorker.last.onmessage(readyMsg([{ url: DECLARED_A, method: "POST", body: "{}" }]));
    expect(coalesce).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("AC3 — cross-cycle: two separate `worker.onmessage` deliveries never merge", () => {
  it("groups PER cycle — a second delivery does not join the first cycle's group", () => {
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    const coalesce = vi.fn((requests) => requests);
    make({ coalesce });

    FakeWorker.last.onmessage(readyMsg([{ url: DECLARED_A, method: "POST", body: "1" }]));
    FakeWorker.last.onmessage(readyMsg([{ url: DECLARED_A, method: "POST", body: "2" }]));

    // If cycle state leaked into a shared group (a stateful bug), this would
    // collapse into fewer hook calls carrying both bodies together.
    expect(coalesce).toHaveBeenCalledTimes(2);
    expect(coalesce.mock.calls[0][0]).toHaveLength(1);
    expect(coalesce.mock.calls[1][0]).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("AC3 — default path (no `coalesce` declared) stays BYTE-IDENTICAL to pre-040-02 dispatch", () => {
  it("no coalesce key at all: one fetch per survivor, in ready-order, mixed with a ceiling-held sibling (order pinned)", () => {
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    const onDiagnostic = vi.fn();
    make({ onDiagnostic }); // no `coalesce` at all

    FakeWorker.last.onmessage(
      readyMsg([
        { url: DECLARED_A, method: "POST", body: "send-1" },
        { url: EVIL, method: "POST", body: "held" },
        { url: DECLARED_B, method: "POST", body: "send-2" },
      ]),
    );

    // Exactly the pre-restructure shape: 2 fetches (the declared ones), in
    // ready-order, the undeclared one held with exactly one diagnostic —
    // this is the observable order the phase-1/phase-2 split must preserve.
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]).toEqual([DECLARED_A, expect.objectContaining({ body: "send-1" })]);
    expect(fetchMock.mock.calls[1]).toEqual([DECLARED_B, expect.objectContaining({ body: "send-2" })]);
    expect(onDiagnostic).toHaveBeenCalledTimes(1);
    expect(onDiagnostic.mock.calls[0][0]).toMatchObject({ kind: "endpoint-ceiling", disposition: "held", destination: EVIL });
  });

  it("a non-function `coalesce` (e.g. an object) is treated as absent — no grouping", () => {
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    make({ coalesce: {} });

    FakeWorker.last.onmessage(
      readyMsg([
        { url: DECLARED_A, method: "POST", body: "1" },
        { url: DECLARED_A, method: "POST", body: "2" },
      ]),
    );

    // A non-function coalesce must NOT crash the dispatch and must NOT merge
    // — two survivors to the same endpoint still dispatch as two fetches.
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("consent-hold ordering (heldBeacons/beaconSeq/diagnose) is preserved across the restructure", () => {
    const onDiagnostic = vi.fn();
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    const airlock = make({ onDiagnostic, egressPurposes: ["analytics_storage"] }); // pending -> hold

    FakeWorker.last.onmessage(
      readyMsg([
        { url: DECLARED_A, body: '{"n":1}' },
        { url: DECLARED_A, body: '{"n":2}' },
      ]),
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(onDiagnostic).toHaveBeenCalledTimes(2);
    const [first, second] = onDiagnostic.mock.calls.map((c) => c[0]);
    expect(first).toMatchObject({ kind: "consent", disposition: "held", beaconId: expect.stringMatching(/#1$/) });
    expect(second).toMatchObject({ kind: "consent", disposition: "held", beaconId: expect.stringMatching(/#2$/) });

    // heldBeacons flush (setConsent) still works unchanged on top of the restructure.
    onDiagnostic.mockClear();
    airlock.setConsent({ analytics_storage: "granted" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("strict-drop ordering (diagnose per item, zero fetch) is preserved across the restructure", () => {
    const onDiagnostic = vi.fn();
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    make({ onDiagnostic, egressPurposes: ["analytics_storage"], consentStrict: true });

    FakeWorker.last.onmessage(
      readyMsg([
        { url: DECLARED_A, body: "1" },
        { url: DECLARED_B, body: "2" },
      ]),
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(onDiagnostic).toHaveBeenCalledTimes(2);
    for (const [record] of onDiagnostic.mock.calls) {
      expect(record).toMatchObject({ kind: "consent", disposition: "dropped" });
    }
  });
});
