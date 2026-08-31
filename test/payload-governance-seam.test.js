import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createAirlock } from "../core/airlock.js";

// Spec 019-01 (ADR-0012) — the payload denylist wired at BOTH governance
// points core/airlock.js owns: the async `sendBatch` chokepoint (drain() +
// flushNow()) and the sync/critical dispatcher (pushCritical + the
// unloadFlush ring-tail, both funneled through the SAME
// `criticalDispatchGated`). Uses the SAME FakeWorker pattern
// test/consent-seal.test.js / test/push-contract.test.js use — no real
// Worker needed.
//
// Non-mutation is asserted directly against getState() (AC4): the local
// event log/projection must retain the raw field even though the crossing
// (the posted batch / the mapped beacon body) does not carry it.

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

const endpoints = ["https://t0.example/collect"];
const ctx = { clientId: "1234567890.1700000000", sessionId: "1724668790" };

let fetchMock;
beforeEach(() => {
  FakeWorker.last = null;
  fetchMock = vi.fn(() => Promise.resolve());
  vi.stubGlobal("Worker", FakeWorker);
  // Drain synchronously by default so drain()'s posted batch is inspectable
  // right after push() (matches push-contract.test.js's idiom). Individual
  // tests that need the ring NOT to auto-drain (flushNow / unloadFlush)
  // override this with a non-firing stub.
  vi.stubGlobal("requestIdleCallback", (cb) => {
    cb({ didTimeout: false, timeRemaining: () => 0 });
    return 1;
  });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const make = (opts) =>
  createAirlock({ trackers: 1, workFactor: 0, endpoints, ctx, unloadCritical: [], ...opts });

const eventsMsg = () => FakeWorker.last.messages.find((m) => m.type === "events");

describe("AC2/AC6 — Point (A): drain()'s sendBatch chokepoint", () => {
  it("a denied field is absent from the batch drain() posts; a benign field passes through", () => {
    const airlock = make({ payloadDenylist: ["email"] });
    airlock.push({ event: "cta_engage", email: "a@b.c", link_text: "Buy" });

    const msg = eventsMsg();
    expect(msg.batch[0].params.email).toBeUndefined();
    expect(msg.batch[0].params.link_text).toBe("Buy");
  });

  it("AC4 — getState() still shows the raw field (the local log/projection is unaffected)", () => {
    const airlock = make({ payloadDenylist: ["email"] });
    airlock.push({ event: "cta_engage", email: "a@b.c" });

    expect(airlock.getState("cta_engage.params.email")).toBe("a@b.c");
  });

  it("the log's descriptor object is untouched — the crossing uses a governed COPY, not the log's own object", () => {
    const airlock = make({ payloadDenylist: ["email"] });
    airlock.push({ event: "cta_engage", email: "a@b.c", link_text: "Buy" });

    const logged = airlock.getState("cta_engage");
    expect(logged.params.email).toBe("a@b.c"); // raw field retained locally
    const msg = eventsMsg();
    expect(msg.batch[0]).not.toBe(logged); // different descriptor object crossed
    expect(msg.batch[0].params).not.toBe(logged.params);
    expect(msg.batch[0].params.email).toBeUndefined();
  });

  it("AC7 — emits a redacted payload-governance diagnostic naming only the field, never the value", () => {
    const onDiagnostic = vi.fn();
    const airlock = make({ payloadDenylist: ["email"], onDiagnostic });
    airlock.push({ event: "cta_engage", email: "a@b.c" });

    expect(onDiagnostic).toHaveBeenCalledWith(
      expect.objectContaining({ level: "warn", kind: "payload-governance", disposition: "stripped", field: "email" }),
    );
    for (const [record] of onDiagnostic.mock.calls) {
      expect(JSON.stringify(record)).not.toContain("a@b.c"); // never the value
    }
  });

  it("a nested dotted-path denial is copy-on-write: crossing lacks it, log keeps it, sibling subtree stays shared", () => {
    const airlock = make({ payloadDenylist: ["user.email"] });
    airlock.push({ event: "signup", user: { email: "a@b.c", name: "Jo" }, other: { x: 1 } });

    const logged = airlock.getState("signup");
    expect(logged.params.user.email).toBe("a@b.c"); // local log fully intact
    expect(logged.params.user.name).toBe("Jo");

    const crossedParams = eventsMsg().batch[0].params;
    expect(crossedParams.user.email).toBeUndefined();
    expect(crossedParams.user.name).toBe("Jo"); // sibling key on the cloned object retained
    expect(crossedParams.other).toBe(logged.params.other); // off-path subtree structurally SHARED
  });
});

describe("AC2/AC6 — Point (A): flushNow() shares the identical sendBatch chokepoint", () => {
  it("flushNow() governs the not-yet-drained ring the same way drain() does", () => {
    vi.stubGlobal("requestIdleCallback", () => 1); // never auto-fires -> push() does not drain
    const airlock = make({ payloadDenylist: ["email"] });
    airlock.push({ event: "cta_engage", email: "a@b.c", link_text: "Buy" });

    expect(eventsMsg()).toBeUndefined(); // not yet drained

    airlock.flushNow();

    const msg = eventsMsg();
    expect(msg.batch[0].params.email).toBeUndefined();
    expect(msg.batch[0].params.link_text).toBe("Buy");
    expect(airlock.getState("cta_engage.params.email")).toBe("a@b.c"); // still local, unaffected
  });
});

describe("AC6 — always-on default: a clean payload is byte-unchanged, but a DEFAULT-denied field strips even unconfigured", () => {
  it("a clean payload (no DEFAULT-denied field) crosses byte-unchanged even with no host payloadDenylist", () => {
    const airlock = make(); // no payloadDenylist at all — DEFAULT_DENYLIST is still active (always-on)
    airlock.push({ event: "cta_engage", email: "a@b.c", link_text: "Go" });

    const msg = eventsMsg();
    // `email`/`link_text` are NOT in the tiny built-in set, so they pass through untouched.
    expect(msg.batch[0].params.email).toBe("a@b.c");
    expect(msg.batch[0].params.link_text).toBe("Go");
    // A clean payload's params object is the SAME reference (governPayload returns
    // the original when nothing is stripped — no needless clone on the hot path).
    expect(msg.batch[0].params).toBe(airlock.getState("cta_engage").params);
  });

  it("a DEFAULT-denied field (password) IS stripped even with NO host payloadDenylist wired (the always-on point)", () => {
    const airlock = make(); // unconfigured — the footgun deployment
    airlock.push({ event: "cta_engage", password: "hunter2", link_text: "Go" });

    const msg = eventsMsg();
    expect("password" in msg.batch[0].params).toBe(false); // stripped by the built-in default
    expect(msg.batch[0].params.link_text).toBe("Go"); // benign field survives
    // Non-mutation: the local log still holds the raw field.
    expect(airlock.getState("cta_engage").params.password).toBe("hunter2");
  });
});

describe("AC3 — Point (B): the sync/critical dispatcher governs before mapToMp (pushCritical)", () => {
  it("a denied field is absent from the synchronously-mapped GA4 beacon body; a benign field is present", () => {
    const airlock = make({ payloadDenylist: ["email"] });
    airlock.pushCritical({ event: "page_view", email: "a@b.c", link_text: "Buy" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body.events[0].params.email).toBeUndefined();
    expect(body.events[0].params.link_text).toBe("Buy");
  });

  it("AC7 diagnostic fires on the sync path too", () => {
    const onDiagnostic = vi.fn();
    const airlock = make({ payloadDenylist: ["email"], onDiagnostic });
    airlock.pushCritical({ event: "page_view", email: "a@b.c" });

    expect(onDiagnostic).toHaveBeenCalledWith(
      expect.objectContaining({ level: "warn", kind: "payload-governance", disposition: "stripped", field: "email" }),
    );
  });

  it("no payloadDenylist wired: pushCritical dispatches byte-unchanged (back-compat)", () => {
    const airlock = make();
    airlock.pushCritical({ event: "page_view", email: "a@b.c" });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.events[0].params.email).toBe("a@b.c");
  });
});

describe("AC3 — Point (B): the unloadFlush ring-tail shares the SAME criticalDispatchGated governance", () => {
  it("a pushed-but-undrained event is governed when the pagehide ring-tail flush fires at teardown", () => {
    const registered = {};
    vi.stubGlobal("addEventListener", (evt, handler) => { registered[evt] = handler; });
    vi.stubGlobal("requestIdleCallback", () => 1); // never auto-drains -> event stays in the ring
    const airlock = make({ payloadDenylist: ["email"] });

    airlock.push({ event: "page_view", email: "a@b.c", link_text: "Buy" });
    expect(fetchMock).not.toHaveBeenCalled(); // still buffered

    registered.pagehide(); // simulate teardown -> unloadFlush() -> criticalDispatchGated

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.events[0].params.email).toBeUndefined();
    expect(body.events[0].params.link_text).toBe("Buy");
    // the local log still has the raw field (push() logged it before teardown)
    expect(airlock.getState("page_view.params.email")).toBe("a@b.c");
  });
});

describe("default denylist merges with a host-configured payloadDenylist (defense-in-depth)", () => {
  it("a DEFAULT_DENYLIST field (password) is stripped even when the host only configured a different field", () => {
    const airlock = make({ payloadDenylist: ["email"] });
    airlock.push({ event: "signup", password: "hunter2", email: "a@b.c", link_text: "Buy" });

    const msg = eventsMsg();
    expect(msg.batch[0].params.password).toBeUndefined();
    expect(msg.batch[0].params.email).toBeUndefined();
    expect(msg.batch[0].params.link_text).toBe("Buy");
  });

  it("the built-in default is ALWAYS-ON — a password is stripped even with no host payloadDenylist (maintainer decision 2026-08-31), while a clean payload stays byte-identical", () => {
    const airlock = make(); // no payloadDenylist at all — the default still engages
    airlock.push({ event: "signup", password: "hunter2" });
    expect(eventsMsg().batch[0].params.password).toBeUndefined(); // stripped by the always-on default

    // ...but a payload with NONE of the denied fields is unchanged (content back-compat).
    const clean = make();
    clean.push({ event: "view", link_text: "Read" });
    expect(clean.getState("view").params.link_text).toBe("Read");
  });
});
