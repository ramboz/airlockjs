// Wrapped-SDK host — spec 014-01, AC2/AC3/AC6 (pure piece, no real Worker).
//
// core/wrapped-sdk-host.js is the MAIN-THREAD host that answers a wrapped-SDK
// chamber's round-trip egress (intercepted-fetch -> caps.egress.dispatch ->
// intercepted-fetch-response) and reconciles its cookie write-back into a
// jar sink. This tests the module directly against a FAKE chamber (a plain
// object satisfying `{ postMessage, onMessage }`, no Worker) + FAKE caps (no
// real network) — the design point the module docstring calls out ("testable
// WITHOUT a real Worker"). The real-Worker, real-fetch-to-a-stub proof is
// rig/alloy-core-host.mjs (AC1/AC2/AC3/AC4, browser rig, not unit-testable).
//
// (a) round-trip dispatch: an intercepted-fetch is answered via
//     caps.egress.dispatch and the response is posted back to the chamber.
// (b) AC6 hardening: a dispatch that never settles is rejected (status:0)
//     within a bounded timeoutMs — tested with a bounded vitest timeout so a
//     regression (the pre-fix hang) fails the TEST fast, not the suite
//     (mirrors test/alloy-coalescing-broker.test.js's bounded pattern).
// (c) cookie-writeback reconciliation drops origin-incompatible attributes
//     (domain=/secure/samesite=) before reaching the jar sink.
import { describe, it, expect } from "vitest";
import { createWrappedSdkHost, reconcileForBrokerJar } from "../core/wrapped-sdk-host.js";

/**
 * A minimal fake chamber: records every `postMessage`, and lets the test
 * `emit()` a message as though the chamber sent it (calls the host's
 * registered handler synchronously, mirroring how a real worker's onmessage
 * callback fires). `nextPost()` returns a promise that resolves with the
 * NEXT posted message — the host's dispatch is internally async (it awaits
 * caps.egress.dispatch), so tests await this instead of racing it.
 */
function makeFakeChamber() {
  const posted = [];
  let handler = null;
  let onPost = null;
  return {
    posted,
    postMessage(msg) {
      posted.push(msg);
      if (onPost) {
        const cb = onPost;
        onPost = null;
        cb(msg);
      }
    },
    onMessage(cb) {
      handler = cb;
    },
    emit(msg) {
      handler(msg);
    },
    nextPost() {
      return new Promise((resolve) => {
        onPost = resolve;
      });
    },
  };
}

describe("createWrappedSdkHost — round-trip egress dispatch (spec 014-01 AC2, ADR-0010)", () => {
  it("dispatches an intercepted-fetch via caps.egress.dispatch and posts the response back to the chamber", async () => {
    const chamber = makeFakeChamber();
    const seenRequests = [];
    const caps = {
      egress: {
        dispatch: async (req) => {
          seenRequests.push(req);
          return {
            status: 200,
            statusText: "OK",
            headers: { "content-type": "application/json" },
            body: '{"ok":true}',
          };
        },
      },
    };
    createWrappedSdkHost({ chamber, caps });

    const posted = chamber.nextPost();
    chamber.emit({
      type: "intercepted-fetch",
      id: "af-1",
      url: "https://adobedc.demdex.net/ee/v1/interact",
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    const msg = await posted;

    expect(seenRequests).toEqual([
      {
        url: "https://adobedc.demdex.net/ee/v1/interact",
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      },
    ]);
    expect(msg).toEqual({
      type: "intercepted-fetch-response",
      id: "af-1",
      status: 200,
      statusText: "OK",
      headers: { "content-type": "application/json" },
      body: '{"ok":true}',
    });
  });

  it("a rejecting dispatch (e.g. a network error) still posts a status:0 response back (never hangs)", async () => {
    const chamber = makeFakeChamber();
    const caps = {
      egress: {
        dispatch: async () => {
          throw new Error("network down");
        },
      },
    };
    createWrappedSdkHost({ chamber, caps });

    const posted = chamber.nextPost();
    chamber.emit({
      type: "intercepted-fetch",
      id: "af-2",
      url: "https://x.example/ee/v1/interact",
      method: "POST",
      headers: {},
      body: "{}",
    });
    const msg = await posted;

    expect(msg).toMatchObject({
      type: "intercepted-fetch-response",
      id: "af-2",
      status: 0,
      statusText: "network down",
    });
  }, 2000); // bounded — a broken error path fails fast instead of hanging to the default

  it("tracks every dispatched request in mainDispatch (the count + requests the rig asserts EXACTLY ONE against)", async () => {
    const chamber = makeFakeChamber();
    const caps = { egress: { dispatch: async () => ({ status: 200, statusText: "OK", body: "{}" }) } };
    const host = createWrappedSdkHost({ chamber, caps });

    const posted = chamber.nextPost();
    chamber.emit({ type: "intercepted-fetch", id: "af-3", url: "https://x/ee/v1/interact", method: "POST", headers: {}, body: "{}" });
    await posted;

    expect(host.getState().mainDispatch).toEqual({
      count: 1,
      requests: [{ url: "https://x/ee/v1/interact", method: "POST", body: "{}" }],
    });
  });
});

describe("createWrappedSdkHost — AC6 hardening: fetch-shim timeout", () => {
  it("a never-settling dispatch is REJECTED (status:0) within timeoutMs, not hung — bounded assertion", async () => {
    const chamber = makeFakeChamber();
    // Deliberately never resolves/rejects — the fault a real hung vendor-fetch
    // reproduces. Without the timeout backstop, the chamber's pending fetch
    // (and thus sendEvent) would hang forever; this proves the host settles
    // it (rejects) on its own, bounded by timeoutMs.
    const caps = { egress: { dispatch: () => new Promise(() => {}) } };
    createWrappedSdkHost({ chamber, caps, timeoutMs: 30 });

    const posted = chamber.nextPost();
    chamber.emit({
      type: "intercepted-fetch",
      id: "af-4",
      url: "https://x.example/ee/v1/interact",
      method: "POST",
      headers: {},
      body: "{}",
    });
    const msg = await posted; // resolves once the 30ms timeout backstop fires

    expect(msg.type).toBe("intercepted-fetch-response");
    expect(msg.id).toBe("af-4");
    expect(msg.status).toBe(0);
    expect(msg.statusText).toMatch(/timed out/i);
  }, 2000); // bounded — a regression (the pre-fix hang) fails fast instead of hanging the suite

  it("a dispatch that settles just BEFORE the timeout still wins (no spurious timeout response)", async () => {
    const chamber = makeFakeChamber();
    let releaseDispatch;
    const gate = new Promise((r) => {
      releaseDispatch = r;
    });
    const caps = {
      egress: {
        dispatch: async () => {
          await gate;
          return { status: 201, statusText: "Created", body: "ok" };
        },
      },
    };
    createWrappedSdkHost({ chamber, caps, timeoutMs: 40 });

    const posted = chamber.nextPost();
    chamber.emit({ type: "intercepted-fetch", id: "af-5", url: "https://x/ee/v1/interact", method: "POST", headers: {}, body: "{}" });
    releaseDispatch(); // let the real dispatch win, well within the 40ms bound
    const msg = await posted;
    expect(msg).toMatchObject({ id: "af-5", status: 201, statusText: "Created", body: "ok" });

    // no spurious timeout response fires afterwards: wait PAST timeoutMs and confirm
    // exactly one post (the settled guard held; no double-post from the elapsed timer).
    await new Promise((r) => setTimeout(r, 70));
    expect(chamber.posted.length).toBe(1);
  }, 2000);
});

describe("createWrappedSdkHost — cookie write-back reconciliation (spec 014-01)", () => {
  it("reconciles a cookie-writeback into the jar sink, dropping origin-incompatible attributes", () => {
    const chamber = makeFakeChamber();
    let reconciled = null;
    const caps = {
      egress: { dispatch: async () => ({ status: 200, body: "" }) },
      cookies: {
        reconcile: (v) => {
          reconciled = v;
        },
      },
    };
    createWrappedSdkHost({ chamber, caps });

    chamber.emit({
      type: "cookie-writeback",
      value: "AMCV_TEST@AdobeOrg=MCMID|12345; Domain=airlock.example; Path=/; Secure; SameSite=None",
    });

    expect(reconciled).toBe("AMCV_TEST@AdobeOrg=MCMID|12345; Path=/");
  });

  it("records every write-back verbatim in getState().writeBacks (pre-reconciliation), alongside the reconciled sink value", () => {
    const chamber = makeFakeChamber();
    const reconciledValues = [];
    const caps = {
      egress: { dispatch: async () => ({ status: 200, body: "" }) },
      cookies: { reconcile: (v) => reconciledValues.push(v) },
    };
    const host = createWrappedSdkHost({ chamber, caps });

    chamber.emit({ type: "cookie-writeback", value: "kndctr_SPIKE_identity=srv-store-abcd1234; Domain=airlock.example; Secure" });

    expect(host.getState().writeBacks).toEqual(["kndctr_SPIKE_identity=srv-store-abcd1234; Domain=airlock.example; Secure"]);
    expect(reconciledValues).toEqual(["kndctr_SPIKE_identity=srv-store-abcd1234"]);
  });

  it("tolerates a caps with no cookies sink (no throw)", () => {
    const chamber = makeFakeChamber();
    const caps = { egress: { dispatch: async () => ({ status: 200, body: "" }) } };
    createWrappedSdkHost({ chamber, caps });
    expect(() => chamber.emit({ type: "cookie-writeback", value: "a=b; Secure" })).not.toThrow();
  });

  it("reconcileForBrokerJar is exported standalone and matches the wired behavior", () => {
    expect(reconcileForBrokerJar("a=b; Domain=x; Secure; SameSite=None; Path=/")).toBe("a=b; Path=/");
    expect(reconcileForBrokerJar("plain=value")).toBe("plain=value"); // no attrs to drop
  });
});

describe("createWrappedSdkHost — driveEvent lifecycle (init -> configured -> event -> result)", () => {
  it("queues the event on driveEvent(), posts it once the chamber reports phase:configured, and resolves on result", async () => {
    const chamber = makeFakeChamber();
    const caps = { egress: { dispatch: async () => ({ status: 200, body: "" }) } };
    const host = createWrappedSdkHost({ chamber, caps });

    host.init({ config: {} });
    const drive = host.driveEvent({ type: "page_view" });

    // Still waiting for "configured" — no event message posted yet.
    expect(chamber.posted.some((m) => m.type === "event")).toBe(false);

    chamber.emit({ type: "phase", name: "install" });
    chamber.emit({ type: "phase", name: "configured" });
    expect(chamber.posted[chamber.posted.length - 1]).toEqual({ type: "event", event: { type: "page_view" } });

    chamber.emit({ type: "result", summary: { booted: true }, ready: [] });
    const result = await drive;

    expect(result).toEqual({ summary: { booted: true }, ready: [] });
    expect(host.getState().phases).toEqual(["install", "configured"]);
  });

  it("driveEvent REJECTS if the chamber reports fatal (a boot/sendEvent crash is observable, not silently hung)", async () => {
    const chamber = makeFakeChamber();
    const caps = { egress: { dispatch: async () => ({ status: 200, body: "" }) } };
    const host = createWrappedSdkHost({ chamber, caps });

    host.init({});
    const drive = host.driveEvent({ type: "page_view" });
    chamber.emit({ type: "fatal", message: "boom", phase: "load" });

    await expect(drive).rejects.toThrow("boom");
    expect(host.getState().fatal).toMatchObject({ message: "boom" });
  });

  it("driveEvent REJECTS a re-entrant second call (single-slot; can't silently clobber the first)", async () => {
    const chamber = makeFakeChamber();
    const caps = { egress: { dispatch: async () => ({ status: 200, body: "" }) } };
    const host = createWrappedSdkHost({ chamber, caps });

    host.init({});
    const first = host.driveEvent({ type: "page_view" }); // in flight, unsettled
    await expect(host.driveEvent({ type: "second" })).rejects.toThrow(/already in flight/i);
    // the first is untouched — it still resolves normally once the chamber reports back
    chamber.emit({ type: "phase", name: "configured" });
    chamber.emit({ type: "result", summary: { booted: true }, ready: [] });
    await expect(first).resolves.toMatchObject({ summary: { booted: true } });
  });
});
