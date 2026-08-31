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

// createWrappedSdkHost — config-integrity enforcement (spec 015-01, ADR-0011): the E2E-at-the-seam
// proof (AC6 of the slice) that a compromised chamber's re-pointed or foreign-host egress is HELD,
// alerted, and produces ZERO real dispatch, driving the REAL core seam (this module, not a stub of
// it) against the fake chamber + spying caps.egress.dispatch. The honest path stays unchanged and
// silent; a host built WITHOUT the configIntegrity option is untouched (opt-in gate, 014-01
// back-compat).
describe("createWrappedSdkHost — config-integrity enforcement (spec 015-01, ADR-0011)", () => {
  const HONEST_DS = "11111111-1111-1111-1111-111111111111"; // synthetic — not a live datastream
  const ATTACKER_DS = "99999999-9999-9999-9999-999999999999"; // synthetic
  const PIN = { pinnedHost: "adobedc.demdex.net", tenantKey: "configId", pinnedTenant: HONEST_DS };
  const HONEST_URL = "https://adobedc.demdex.net/ee/v1/interact?configId=" + HONEST_DS + "&requestId=r";

  /** A fresh fake chamber + spying dispatch + diagnostics collector, wired into a real host. */
  function makeSpyingHost(opts) {
    const chamber = makeFakeChamber();
    const dispatched = [];
    const diags = [];
    const caps = {
      egress: {
        dispatch: async (req) => {
          dispatched.push(req);
          return { status: 200, statusText: "OK", headers: {}, body: "{}" };
        },
      },
    };
    const host = createWrappedSdkHost({ chamber, caps, onDiagnostic: (r) => diags.push(r), ...opts });
    return { chamber, dispatched, diags, host };
  }

  it("honest host+tenant is dispatched normally and stays SILENT (no diagnostic, held: 0)", async () => {
    const { chamber, dispatched, diags, host } = makeSpyingHost({ configIntegrity: PIN });

    const posted = chamber.nextPost();
    chamber.emit({ type: "intercepted-fetch", id: 1, url: HONEST_URL, method: "POST", headers: {}, body: "{}" });
    const msg = await posted;

    expect(dispatched.length).toBe(1);
    expect(msg.status).toBe(200);
    expect(diags.find((d) => d.kind === "config-integrity")).toBeUndefined();
    expect(host.getState().held).toBe(0);
  }, 2000);

  it("a same-host tenant re-point is HELD + alerted — zero real egress", async () => {
    const { chamber, dispatched, diags, host } = makeSpyingHost({ configIntegrity: PIN });
    const url = `https://adobedc.demdex.net/ee/v1/interact?configId=${ATTACKER_DS}&requestId=r`;

    const posted = chamber.nextPost();
    chamber.emit({ type: "intercepted-fetch", id: 2, url, method: "POST", headers: {}, body: "{}" });
    const msg = await posted;

    expect(dispatched.length).toBe(0);
    expect(diags.find((d) => d.kind === "config-integrity")).toMatchObject({ level: "error", kind: "config-integrity", disposition: "held" });
    expect(msg.status).toBe(0);
    expect(host.getState().held).toBe(1);
  }, 2000);

  it("a foreign-host egress is HELD + alerted, even carrying the honest tenant", async () => {
    const { chamber, dispatched, diags, host } = makeSpyingHost({ configIntegrity: PIN });
    const url = `https://evil.com/ee/v1/interact?configId=${HONEST_DS}`;

    const posted = chamber.nextPost();
    chamber.emit({ type: "intercepted-fetch", id: 3, url, method: "POST", headers: {}, body: "{}" });
    const msg = await posted;

    expect(dispatched.length).toBe(0);
    expect(diags.find((d) => d.kind === "config-integrity")).toMatchObject({ level: "error", kind: "config-integrity", disposition: "held" });
    expect(msg.status).toBe(0);
    expect(host.getState().held).toBe(1);
  }, 2000);

  it("parameter pollution (two configId params) is HELD, not slipped past on the first value", async () => {
    const { chamber, dispatched, diags, host } = makeSpyingHost({ configIntegrity: PIN });
    const url = `https://adobedc.demdex.net/ee/v1/interact?configId=${HONEST_DS}&configId=${ATTACKER_DS}&requestId=r`;

    const posted = chamber.nextPost();
    chamber.emit({ type: "intercepted-fetch", id: 4, url, method: "POST", headers: {}, body: "{}" });
    const msg = await posted;

    expect(dispatched.length).toBe(0);
    expect(diags.find((d) => d.kind === "config-integrity")).toMatchObject({ level: "error", kind: "config-integrity", disposition: "held" });
    expect(msg.status).toBe(0);
    expect(host.getState().held).toBe(1);
  }, 2000);

  it("an absent configId is HELD, not allowed", async () => {
    const { chamber, dispatched, diags, host } = makeSpyingHost({ configIntegrity: PIN });
    const url = "https://adobedc.demdex.net/ee/v1/interact?requestId=r";

    const posted = chamber.nextPost();
    chamber.emit({ type: "intercepted-fetch", id: 5, url, method: "POST", headers: {}, body: "{}" });
    const msg = await posted;

    expect(dispatched.length).toBe(0);
    expect(diags.find((d) => d.kind === "config-integrity")).toMatchObject({ level: "error", kind: "config-integrity", disposition: "held" });
    expect(msg.status).toBe(0);
    expect(host.getState().held).toBe(1);
  }, 2000);

  it("back-compat: with NO configIntegrity option, an attacker-tenant url still dispatches normally (the gate is opt-in)", async () => {
    const { chamber, dispatched, diags, host } = makeSpyingHost({}); // no configIntegrity key at all
    const url = `https://adobedc.demdex.net/ee/v1/interact?configId=${ATTACKER_DS}&requestId=r`;

    const posted = chamber.nextPost();
    chamber.emit({ type: "intercepted-fetch", id: 6, url, method: "POST", headers: {}, body: "{}" });
    const msg = await posted;

    expect(dispatched.length).toBe(1); // no gate installed — dispatched exactly as 014-01 always did
    expect(msg.status).toBe(200);
    expect(diags.find((d) => d.kind === "config-integrity")).toBeUndefined();
    expect(host.getState().held).toBe(0);
  }, 2000);
});

// createWrappedSdkHost — config-integrity OVERRIDE option (spec 015-02, ADR-0011 §7): the opt-in,
// non-default disposition. Instead of holding, a deviation is RE-DERIVED to the host-pinned host +
// tenant (pinnedDispatchUrl — evasion-proof, never trusts the chamber's value) and SENT, still
// alerting (disposition: "overridden"). Availability-over-integrity; never silent. Default (hold)
// is unchanged (015-01). An INCOMPLETE pin can't be re-derived, so it holds even under override.
describe("createWrappedSdkHost — config-integrity override option (spec 015-02, ADR-0011)", () => {
  const HONEST_DS = "11111111-1111-1111-1111-111111111111"; // synthetic
  const ATTACKER_DS = "99999999-9999-9999-9999-999999999999"; // synthetic
  const PIN_OVERRIDE = { pinnedHost: "adobedc.demdex.net", tenantKey: "configId", pinnedTenant: HONEST_DS, disposition: "override" };
  const HONEST_URL = "https://adobedc.demdex.net/ee/v1/interact?configId=" + HONEST_DS + "&requestId=r";

  function makeSpyingHost(opts) {
    const chamber = makeFakeChamber();
    const dispatched = [];
    const diags = [];
    const caps = {
      egress: {
        dispatch: async (req) => {
          dispatched.push(req);
          return { status: 200, statusText: "OK", headers: {}, body: "{}" };
        },
      },
    };
    const host = createWrappedSdkHost({ chamber, caps, onDiagnostic: (r) => diags.push(r), ...opts });
    return { chamber, dispatched, diags, host };
  }

  it("override re-derives a same-host re-point to the pinned tenant + SENDS + alerts (not held)", async () => {
    const { chamber, dispatched, diags, host } = makeSpyingHost({ configIntegrity: PIN_OVERRIDE });
    const url = `https://adobedc.demdex.net/ee/v1/interact?configId=${ATTACKER_DS}&requestId=r`;

    const posted = chamber.nextPost();
    chamber.emit({ type: "intercepted-fetch", id: 1, url, method: "POST", headers: {}, body: "{}" });
    const msg = await posted;

    expect(dispatched.length).toBe(1); // SENT, not held
    const sent = new URL(dispatched[0].url);
    expect(sent.host).toBe("adobedc.demdex.net");
    expect(sent.searchParams.getAll("configId")).toEqual([HONEST_DS]); // re-derived to the pin
    expect(dispatched[0].url).not.toContain(ATTACKER_DS); // attacker value gone
    const diag = diags.find((d) => d.kind === "config-integrity");
    expect(diag).toMatchObject({ level: "error", disposition: "overridden" });
    // The alert must state the action ACTUALLY taken. reason names the deviation only —
    // it must NOT say "held"/"hold" on a dispatch that was corrected-and-SENT (015-02 review),
    // and must never carry the raw identifier value (013-01 redaction).
    expect(diag.reason).toContain("same-host tenant re-route");
    expect(diag.reason).not.toMatch(/hold|held/i);
    expect(diag.reason).not.toContain(ATTACKER_DS);
    expect(msg.status).toBe(200); // the chamber gets the real response
    expect(host.getState().overridden).toBe(1);
    expect(host.getState().held).toBe(0);
  }, 2000);

  it("override re-derives a FOREIGN host to the pinned host (never forwards to the attacker host)", async () => {
    const { chamber, dispatched, diags, host } = makeSpyingHost({ configIntegrity: PIN_OVERRIDE });
    const url = `https://evil.com/ee/v1/interact?configId=${HONEST_DS}`; // honest tenant, foreign host

    const posted = chamber.nextPost();
    chamber.emit({ type: "intercepted-fetch", id: 2, url, method: "POST", headers: {}, body: "{}" });
    await posted;

    expect(dispatched.length).toBe(1);
    expect(new URL(dispatched[0].url).host).toBe("adobedc.demdex.net"); // corrected to the pinned host
    expect(dispatched[0].url).not.toContain("evil.com");
    const diag = diags.find((d) => d.kind === "config-integrity");
    expect(diag).toMatchObject({ disposition: "overridden" });
    expect(diag.reason).toContain("foreign-host egress");
    expect(diag.reason).not.toMatch(/hold|held/i); // corrected-and-sent, not held
    expect(host.getState().overridden).toBe(1);
  }, 2000);

  it("override leaves the HONEST path untouched — dispatched normally, no alert, overridden: 0", async () => {
    const { chamber, dispatched, diags, host } = makeSpyingHost({ configIntegrity: PIN_OVERRIDE });

    const posted = chamber.nextPost();
    chamber.emit({ type: "intercepted-fetch", id: 3, url: HONEST_URL, method: "POST", headers: {}, body: "{}" });
    const msg = await posted;

    expect(dispatched.length).toBe(1);
    expect(dispatched[0].url).toBe(HONEST_URL); // untouched — no re-derive on a non-deviating dispatch
    expect(msg.status).toBe(200);
    expect(diags.find((d) => d.kind === "config-integrity")).toBeUndefined();
    expect(host.getState().overridden).toBe(0);
    expect(host.getState().held).toBe(0);
  }, 2000);

  it("override with an INCOMPLETE pin HOLDS (a misconfiguration can't be re-derived to a valid destination)", async () => {
    const incompletePin = { pinnedHost: "adobedc.demdex.net", tenantKey: "configId", pinnedTenant: null, disposition: "override" };
    const { chamber, dispatched, diags, host } = makeSpyingHost({ configIntegrity: incompletePin });
    const url = `https://adobedc.demdex.net/ee/v1/interact?configId=${ATTACKER_DS}&requestId=r`;

    const posted = chamber.nextPost();
    chamber.emit({ type: "intercepted-fetch", id: 4, url, method: "POST", headers: {}, body: "{}" });
    const msg = await posted;

    expect(dispatched.length).toBe(0); // held — no re-derive possible
    expect(msg.status).toBe(0);
    expect(diags.find((d) => d.kind === "config-integrity")).toMatchObject({ disposition: "held" });
    expect(host.getState().held).toBe(1);
    expect(host.getState().overridden).toBe(0);
  }, 2000);

  it("an explicit disposition:'hold' holds (parity with the default)", async () => {
    const holdPin = { pinnedHost: "adobedc.demdex.net", tenantKey: "configId", pinnedTenant: HONEST_DS, disposition: "hold" };
    const { chamber, dispatched, host } = makeSpyingHost({ configIntegrity: holdPin });
    const url = `https://adobedc.demdex.net/ee/v1/interact?configId=${ATTACKER_DS}&requestId=r`;

    const posted = chamber.nextPost();
    chamber.emit({ type: "intercepted-fetch", id: 5, url, method: "POST", headers: {}, body: "{}" });
    const msg = await posted;

    expect(dispatched.length).toBe(0);
    expect(msg.status).toBe(0);
    expect(host.getState().held).toBe(1);
    expect(host.getState().overridden).toBe(0);
  }, 2000);
});

// createWrappedSdkHost — endpoint ceiling + config-integrity composition (spec 016-02, ADR-0006):
// the E2E-at-the-COMPOSED-seam proof (AC6) that core/endpoint-ceiling.js's `checkEndpointCeiling`
// (016-01) is wired into this SAME seam, reconciled with 015's config-integrity onto non-overlapping
// axes — the ceiling runs FIRST on every intercepted egress (owns HOST+PATH); config-integrity's
// tenant check is scoped to run only when there is NO ceiling, OR the destination host equals its OWN
// `pinnedHost` (the interact) — so 015's control CODE is unchanged, and its no-ceiling standalone
// tests (above, and test/alloy-config-integrity.test.js) stay green. Case (f) below re-confirms that
// back-compat directly, against this same describe's fixtures.
describe("createWrappedSdkHost — endpoint ceiling + config-integrity composition (spec 016-02)", () => {
  const HONEST_DS = "11111111-1111-1111-1111-111111111111"; // synthetic — not a live datastream
  const ATTACKER_DS = "99999999-9999-9999-9999-999999999999"; // synthetic
  const INTERACT = "https://adobedc.demdex.net/ee/v1/interact";
  const PIN = { pinnedHost: "adobedc.demdex.net", tenantKey: "configId", pinnedTenant: HONEST_DS };

  /** A fresh fake chamber + spying dispatch + diagnostics collector, wired into a real host. */
  function makeSpyingHost(opts) {
    const chamber = makeFakeChamber();
    const dispatched = [];
    const diags = [];
    const caps = {
      egress: {
        dispatch: async (req) => {
          dispatched.push(req);
          return { status: 200, statusText: "OK", headers: {}, body: "{}" };
        },
      },
    };
    const host = createWrappedSdkHost({ chamber, caps, onDiagnostic: (r) => diags.push(r), ...opts });
    return { chamber, dispatched, diags, host };
  }

  it("(a) an UNDECLARED origin is HELD by the ceiling — zero real egress, before config-integrity ever runs", async () => {
    const { chamber, dispatched, diags, host } = makeSpyingHost({ configIntegrity: PIN, endpointCeiling: [INTERACT] });
    const url = `https://evil.com/x?configId=${HONEST_DS}`; // honest tenant — the ceiling doesn't care, it never gets that far

    const posted = chamber.nextPost();
    chamber.emit({ type: "intercepted-fetch", id: 1, url, method: "POST", headers: {}, body: "{}" });
    const msg = await posted;

    expect(dispatched.length).toBe(0);
    expect(msg.status).toBe(0);
    expect(diags.find((d) => d.kind === "endpoint-ceiling")).toMatchObject({ level: "error", kind: "endpoint-ceiling", disposition: "held" });
    expect(host.getState().ceilingHeld).toBe(1);
    // config-integrity never ran — the ceiling short-circuited before it (non-overlapping axes).
    expect(diags.find((d) => d.kind === "config-integrity")).toBeUndefined();
    expect(host.getState().held).toBe(0);
  }, 2000);

  it("(a2) a WRONG PATH on the ALLOWED host is HELD by the ceiling — the path confinement 015 lacks", async () => {
    const { chamber, dispatched, diags, host } = makeSpyingHost({ configIntegrity: PIN, endpointCeiling: [INTERACT] });
    const url = `https://adobedc.demdex.net/steal?configId=${HONEST_DS}`; // right host, wrong path, honest tenant

    const posted = chamber.nextPost();
    chamber.emit({ type: "intercepted-fetch", id: 2, url, method: "POST", headers: {}, body: "{}" });
    const msg = await posted;

    expect(dispatched.length).toBe(0);
    expect(msg.status).toBe(0);
    expect(diags.find((d) => d.kind === "endpoint-ceiling")).toMatchObject({ disposition: "held" });
    expect(host.getState().ceilingHeld).toBe(1);
    expect(host.getState().held).toBe(0); // config-integrity never reached
  }, 2000);

  it("(b) the declared interact + HONEST tenant is ALLOWED — dispatched, silent (no diagnostic)", async () => {
    const { chamber, dispatched, diags, host } = makeSpyingHost({ configIntegrity: PIN, endpointCeiling: [INTERACT] });
    const url = `${INTERACT}?configId=${HONEST_DS}&requestId=r`;

    const posted = chamber.nextPost();
    chamber.emit({ type: "intercepted-fetch", id: 3, url, method: "POST", headers: {}, body: "{}" });
    const msg = await posted;

    expect(dispatched.length).toBe(1);
    expect(msg.status).toBe(200);
    expect(diags.length).toBe(0);
    expect(host.getState().ceilingHeld).toBe(0);
    expect(host.getState().held).toBe(0);
  }, 2000);

  it("(c) the declared interact + ATTACKER tenant is HELD by config-integrity — unchanged from 015", async () => {
    const { chamber, dispatched, diags, host } = makeSpyingHost({ configIntegrity: PIN, endpointCeiling: [INTERACT] });
    const url = `${INTERACT}?configId=${ATTACKER_DS}&requestId=r`;

    const posted = chamber.nextPost();
    chamber.emit({ type: "intercepted-fetch", id: 4, url, method: "POST", headers: {}, body: "{}" });
    const msg = await posted;

    expect(dispatched.length).toBe(0);
    expect(msg.status).toBe(0);
    expect(diags.find((d) => d.kind === "config-integrity")).toMatchObject({ level: "error", kind: "config-integrity", disposition: "held" });
    expect(host.getState().held).toBe(1);
    expect(host.getState().ceilingHeld).toBe(0); // the ceiling allowed it (declared origin+path) — this hold is config-integrity's
  }, 2000);

  it("(d) the BENIGN reconciliation case: a declared 2nd origin with NO tenant key is ALLOWED, and the coverage gap is DISCLOSED", async () => {
    const twoOrigins = [INTERACT, "https://edge.adobedc.net/ee/v2/collect"];
    const { chamber, dispatched, diags, host } = makeSpyingHost({ configIntegrity: PIN, endpointCeiling: twoOrigins });
    const url = "https://edge.adobedc.net/ee/v2/collect"; // declared, but no configId at all

    const posted = chamber.nextPost();
    chamber.emit({ type: "intercepted-fetch", id: 5, url, method: "POST", headers: {}, body: "{}" });
    const msg = await posted;

    expect(dispatched.length).toBe(1); // ceiling allows it (declared); config-integrity is scoped OUT (not its pinnedHost)
    expect(msg.status).toBe(200);
    expect(diags.find((d) => d.kind === "config-integrity")).toMatchObject({
      level: "warn",
      kind: "config-integrity",
      disposition: "unpinned-declared-origin",
    });
    expect(host.getState().held).toBe(0);
    expect(host.getState().ceilingHeld).toBe(0);
  }, 2000);

  it("(e) the GAP case: an ATTACKER configId on the declared 2nd (non-pinnedHost) origin is ALLOWED by the controls — but SURFACED, never silent", async () => {
    const twoOrigins = [INTERACT, "https://edge.adobedc.net/ee/v2/collect"];
    const { chamber, dispatched, diags, host } = makeSpyingHost({ configIntegrity: PIN, endpointCeiling: twoOrigins });
    const url = `https://edge.adobedc.net/ee/v2/collect?configId=${ATTACKER_DS}`;

    const posted = chamber.nextPost();
    chamber.emit({ type: "intercepted-fetch", id: 6, url, method: "POST", headers: {}, body: "{}" });
    const msg = await posted;

    // The tenant-coverage gap is REAL: neither control holds an attacker tenant
    // on a declared non-pinnedHost origin (the ceiling only owns host+path;
    // config-integrity is scoped to pinnedHost) — proven here, not just
    // asserted in prose (016-02 AC4/AC6e).
    expect(dispatched.length).toBe(1);
    expect(msg.status).toBe(200);
    // ...but it is NEVER silent: the same disclosure diagnostic fires regardless
    // of which tenant rides the declared-but-unpinned origin.
    expect(diags.find((d) => d.kind === "config-integrity")).toMatchObject({
      level: "warn",
      disposition: "unpinned-declared-origin",
    });
    expect(host.getState().held).toBe(0);
    expect(host.getState().ceilingHeld).toBe(0);
  }, 2000);

  it("(f) back-compat: config-integrity with NO endpointCeiling still holds a foreign host on its OWN host check (015 standalone, unweakened)", async () => {
    const { chamber, dispatched, diags, host } = makeSpyingHost({ configIntegrity: PIN }); // no endpointCeiling key at all
    const url = `https://evil.com/ee/v1/interact?configId=${HONEST_DS}`;

    const posted = chamber.nextPost();
    chamber.emit({ type: "intercepted-fetch", id: 7, url, method: "POST", headers: {}, body: "{}" });
    const msg = await posted;

    expect(dispatched.length).toBe(0);
    expect(msg.status).toBe(0);
    expect(diags.find((d) => d.kind === "config-integrity")).toMatchObject({ level: "error", kind: "config-integrity", disposition: "held" });
    expect(host.getState().held).toBe(1);
    expect(host.getState().ceilingHeld).toBe(0);
  }, 2000);
});
