/**
 * Broker-side async mint coalescing — spec 012-02, AC1/AC2/AC3/AC5 (pure,
 * browser-safe piece).
 *
 * ADR-0008's mechanism, made concrete: the single-threaded MAIN-thread broker
 * (parallel to core/airlock.js, never editing it) sees every intercepted
 * wrapped-SDK `fetch` (delivered by 012-01's chamber interception). When two
 * chambers both read an empty identity and both first-mint, the broker holds the
 * second mint and returns the FIRST's server-assigned ECID, so both chambers
 * attach ONE ECID — retiring the concurrent-first-mint split-identity fault
 * WITHOUT SharedArrayBuffer (AD-4): the only synchronization is the broker's own
 * single-threaded serialization + an async hold.
 *
 * The load-bearing invariant (AC2): a first mint is registered SYNCHRONOUSLY in
 * the in-flight table INSIDE handleInterceptedFetch, BEFORE the real dispatch is
 * awaited. Main is single-threaded, so a concurrently-arriving second handler
 * always observes the first already registered — there is no window in which two
 * mints both slip past into a real dispatch.
 *
 * A second identity mint is suppressed in BOTH windows:
 *   (a) IN-FLIGHT — it arrives while the first is still awaiting its Edge
 *       response → HELD on the in-flight promise → receives the one ECID when the
 *       first resolves;
 *   (b) LATE — it arrives after the first completed but before this chamber
 *       minted → suppressed via the retained COMPLETED-mint association, not
 *       re-dispatched.
 * Either way exactly ONE `interact` egresses per coalesced identity.
 *
 * NO node builtins — imported directly by the browser harness AND the Node unit
 * tests (same decision core both places, per rig/coherency-model.mjs's pattern).
 */
import { recognizeInteract, extractEcidFromInteractResponse } from "./alloy-xdm-mint.js";

/**
 * @param {object} opts
 * @param {(req: object, meta: object) => Promise<{ status?: number, statusText?: string, headers?: object, body?: string }>} opts.dispatch
 *   perform the REAL egress (main-thread network fetch in the browser; a fake in
 *   tests). Called ONLY for a request that is not coalesced away.
 * @param {boolean} [opts.coalescing=true] master switch — OFF reproduces the
 *   split-identity fault (both mints egress); ON retires it (one egress).
 * @param {(key: string) => void} [opts.onHeldInFlight] invoked synchronously when
 *   a mint is HELD in the in-flight window. The rig uses it to release its
 *   gate-able stub, so the in-flight window is deterministically constructed
 *   (AC5) rather than raced-for.
 * @param {(key: string) => void} [opts.onFirstMint] invoked when a first mint is
 *   registered (observability).
 */
export function createCoalescingBroker({ dispatch, coalescing = true, onHeldInFlight, onFirstMint } = {}) {
  if (typeof dispatch !== "function") throw new TypeError("createCoalescingBroker: dispatch must be a function");

  /** @type {Map<string, Promise<object>>} mintKey -> the first mint's in-flight response promise. */
  const inFlight = new Map();
  /** @type {Map<string, { ecid: string | null, response: object }>} mintKey -> completed-mint association. */
  const completed = new Map();
  /** Every REAL egress that actually left the broker (the assertion surface). */
  const egress = [];
  /** Every coalescing decision, in order (observability for the rig JSON). */
  const decisions = [];

  async function realDispatch(req, meta) {
    const response = await dispatch(req, meta);
    const norm = normalizeResponse(response);
    egress.push({ url: req.url, role: meta.role, mintKey: meta.recognition.mintKey });
    return norm;
  }

  async function handleInterceptedFetch(req) {
    const recognition = recognizeInteract(req);

    // Coalescing OFF, or a non-mint interact: pass straight through — always a
    // real egress. (OFF is the fault's red side; non-mint is AC3's pass-through.)
    if (!coalescing || !recognition.isMint) {
      const response = await realDispatch(req, { role: coalescing ? "passthrough" : "off", recognition });
      const ecid = ecidOf(response);
      const coalesced = coalescing ? "passthrough" : "off";
      decisions.push({ url: req.url, isMint: recognition.isMint, coalesced });
      return { ...response, ecid, coalesced, recognition };
    }

    const key = recognition.mintKey;

    // Window (b) — LATE: the first mint for this identity already completed; this
    // chamber minted after the fact. Suppress via the completed-mint association;
    // do NOT re-dispatch.
    if (completed.has(key)) {
      const assoc = completed.get(key);
      decisions.push({ url: req.url, isMint: true, coalesced: "late-suppressed", mintKey: key });
      return { ...assoc.response, ecid: assoc.ecid, coalesced: "late-suppressed", recognition };
    }

    // Window (a) — IN-FLIGHT: a first mint for this identity is still awaiting its
    // Edge response. HOLD on its promise; the rig's onHeldInFlight releases the
    // gate-able stub so the first can now complete (deterministic construction).
    if (inFlight.has(key)) {
      const pending = inFlight.get(key); // capture BEFORE any await / delete
      if (typeof onHeldInFlight === "function") onHeldInFlight(key);
      const response = await pending;
      decisions.push({ url: req.url, isMint: true, coalesced: "held-in-flight", mintKey: key });
      return { ...response, ecid: ecidOf(response), coalesced: "held-in-flight", recognition };
    }

    // FIRST mint for this identity. Register the in-flight promise SYNCHRONOUSLY —
    // this line runs BEFORE the `await realDispatch` below, so a concurrently-
    // arriving second handler (single-threaded main) always sees it (AC2).
    let resolveInFlight;
    let rejectInFlight;
    const promise = new Promise((resolve, reject) => { resolveInFlight = resolve; rejectInFlight = reject; });
    // Observed synchronously so a first-mint failure with no held awaiter never
    // surfaces as an unhandled rejection — held chambers still see the failure
    // via their OWN `await pending` below (a promise supports many consumers).
    promise.catch(() => {});
    inFlight.set(key, promise);
    if (typeof onFirstMint === "function") onFirstMint(key);

    try {
      const response = await realDispatch(req, { role: "first-mint", recognition });
      const ecid = ecidOf(response);
      completed.set(key, { ecid, response }); // retain the association for late suppressions
      resolveInFlight(response); // release any chambers held in-flight
      return { ...response, ecid, coalesced: "first", recognition };
    } catch (err) {
      // The real dispatch failed (e.g. an Edge 5xx / network failure). Settle any
      // chambers HELD in-flight with the same failure instead of leaving their
      // `await pending` hanging forever — do NOT populate `completed`, so a retry
      // mints fresh rather than replaying the failure.
      rejectInFlight(err);
      throw err;
    } finally {
      inFlight.delete(key);
    }
  }

  return {
    handleInterceptedFetch,
    // Observability the rig + tests assert over.
    egress,
    decisions,
    inFlightCount: () => inFlight.size,
    completedCount: () => completed.size,
    egressCount: () => egress.length,
  };
}

/** Normalize a dispatch result to a stable shape (status/headers/body). */
function normalizeResponse(response) {
  const r = response || {};
  return {
    status: r.status != null ? r.status : 200,
    statusText: r.statusText || "",
    headers: r.headers || { "content-type": "application/json" },
    body: r.body != null ? r.body : "",
  };
}

/** Extract the ECID a response carries (parsing its JSON body), or null. */
function ecidOf(response) {
  try {
    return extractEcidFromInteractResponse(JSON.parse(response.body));
  } catch (e) {
    return null;
  }
}
