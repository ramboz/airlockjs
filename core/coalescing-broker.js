/**
 * The coalescing broker (spec 014-02) — ADR-0008's concurrent-first-mint fix,
 * carried from the rig (`rig/alloy-coalescing-broker.js`, spec 012-02) into
 * `core/`, on top of 014-01's round-trip egress dispatch
 * (`core/wrapped-sdk-host.js`). core/airlock.js and core/chamber.worker.js are
 * UNTOUCHED — this is a new, parallel module, exactly like
 * core/connector-host.js and core/wrapped-sdk-host.js before it.
 *
 * ARCHITECTURE: the broker is a MAIN-THREAD, SHARED-across-chambers concern —
 * ONE broker instance wraps the real egress dispatch (the fetch that actually
 * leaves the page); EVERY chamber's `createWrappedSdkHost` is wired with
 * `caps.egress.dispatch = (req) => broker.handleInterceptedFetch(req)`, so the
 * broker sits as the SINGLE coalescing point above each chamber's own 014-01
 * per-chamber round-trip dispatch — the same relationship core/airlock.js's
 * dispatch would have to a per-connector round trip in production. When two
 * chambers both read an empty identity and both first-mint, the broker holds
 * the second mint and returns the FIRST's server-assigned ECID, so both
 * chambers attach ONE ECID — retiring the concurrent-first-mint
 * split-identity fault WITHOUT SharedArrayBuffer (AD-4): the only
 * synchronization is the broker's own single-threaded serialization + an
 * async hold.
 *
 * The load-bearing invariant (spec 012-02 AC2, preserved verbatim): a first
 * mint is registered SYNCHRONOUSLY in the in-flight table INSIDE
 * handleInterceptedFetch, BEFORE the real dispatch is awaited. Main is
 * single-threaded, so a concurrently-arriving second handler always observes
 * the first already registered — there is no window in which two mints both
 * slip past into a real dispatch.
 *
 * A second identity mint is suppressed in BOTH windows:
 *   (a) IN-FLIGHT — it arrives while the first is still awaiting its Edge
 *       response → HELD on the in-flight promise → receives the one ECID when
 *       the first resolves;
 *   (b) LATE — it arrives after the first completed but before this chamber
 *       minted → suppressed via the retained COMPLETED-mint association, not
 *       re-dispatched.
 * Either way exactly ONE `interact` egresses per coalesced identity.
 *
 * THE REJECT-PATH (spec 012-02's craft fix — the load-bearing carry for
 * 014-02, preserved EXACTLY): a first-mint dispatch FAILURE (e.g. an Edge 5xx
 * / network failure) settles every chamber HELD in-flight with the SAME
 * failure — `rejectInFlight(err)` — instead of leaving their `await pending`
 * hanging forever. `completed` is deliberately left UNPOPULATED on failure, so
 * a retry for the same identity mints fresh rather than replaying the
 * failure (self-heal). Without this, a held chamber would hang forever on a
 * first-mint dispatch failure — see test/coalescing-broker-core.test.js's
 * bounded-timeout regression test.
 *
 * `completed`-association invalidation-on-reset is NOT built here (carried
 * forward, docs/refinement-todo.md item (e)): the map is bounded today by
 * datastream cardinality, not by chamber lifetime, so there is no leak, but a
 * chamber-reset path that should re-mint is not yet modeled.
 *
 * VENDOR-NEUTRAL (014-02 arch-review): the broker is a generic keyed-coalescing
 * mechanism; what counts as a coalescable identity mint (and how to read the
 * minted identity out of a response) is connector-specific and INJECTED —
 * `recognize` + `extractIdentity`. The alloy recognizer lives in the connector
 * (`connectors/alloy/xdm-mint.js`), so `core/` has no vendor coupling and no
 * `core/ → rig/` import (architecture.md Module boundaries).
 *
 * Pure — no `self`/`postMessage`/DOM at module top level — so it imports and
 * unit-tests directly in Node (test/coalescing-broker-core.test.js), exactly
 * like core/connector-host.js and core/wrapped-sdk-host.js.
 */

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
 * @param {(req: object) => { isMint: boolean, mintKey: string | null }} opts.recognize
 *   connector-specific: recognize a coalescable identity mint (e.g. the alloy
 *   recognizer, connectors/alloy/xdm-mint.js). INJECTED so core stays vendor-neutral.
 * @param {(parsedResponseBody: object) => (string | null)} opts.extractIdentity
 *   connector-specific: read the minted identity (e.g. ECID) out of a parsed
 *   response body. INJECTED.
 */
export function createCoalescingBroker({ dispatch, recognize, extractIdentity, coalescing = true, onHeldInFlight, onFirstMint } = {}) {
  if (typeof dispatch !== "function") throw new TypeError("createCoalescingBroker: dispatch must be a function");
  if (typeof recognize !== "function") throw new TypeError("createCoalescingBroker: recognize must be a function");
  if (typeof extractIdentity !== "function") throw new TypeError("createCoalescingBroker: extractIdentity must be a function");

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
    const recognition = recognize(req);

    // Coalescing OFF, or a non-mint interact: pass straight through — always a
    // real egress. (OFF is the fault's red side; non-mint is AC4's pass-through.)
    if (!coalescing || !recognition.isMint) {
      const response = await realDispatch(req, { role: coalescing ? "passthrough" : "off", recognition });
      const ecid = ecidOf(response, extractIdentity);
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
      return { ...response, ecid: ecidOf(response, extractIdentity), coalesced: "held-in-flight", recognition };
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
      const ecid = ecidOf(response, extractIdentity);
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
function ecidOf(response, extractIdentity) {
  try {
    return extractIdentity(JSON.parse(response.body));
  } catch (e) {
    return null;
  }
}
