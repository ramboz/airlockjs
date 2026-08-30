/**
 * Minting-Edge stub — spec 012-01, AC4 (pure pieces).
 *
 * AC4 replaces the in-chamber fetch stub with real interception: alloy's
 * worker-side `fetch` to `.../ee/v1/interact` is intercepted in the chamber and
 * routed into the orchestrator's main-thread dispatch (ADR-0004); the REAL
 * network fetch, on main, hits THIS minting-Edge stub. The stub server-assigns a
 * NEW ECID per call — ADR-0008's identity-mint is an async Edge round-trip whose
 * ECID is server-assigned from the response body, and two concurrent mints
 * yielding distinct ECIDs is precisely the fault broker coalescing (012-02) later
 * prevents. alloy persists the minted ECID synchronously into the AMCV_<ORGID>
 * cell (grounded R-004 + the executed chamber probe).
 *
 * These are the PURE pieces the rig's server handler + assertions build on, kept
 * out of the browser rig so they are directly unit-testable in Node:
 *   - `mintInteractResponse` builds the Edge `interact` response (fresh ECID);
 *   - `extractEcidFromInteractResponse` mirrors what alloy reads to persist it.
 *
 * The response SHAPE is grounded, not guessed: the executed chamber probe showed
 * alloy persists the ECID from the `identity:result` handle's `payload[].id`
 * (where `namespace.code === "ECID"`) into `AMCV_<ORGID>=MCMID|<ECID>`, and writes
 * the `state:store` handle's `kndctr_*_identity` entry verbatim.
 */
import { randomBytes } from "node:crypto";
// The pure XDM parse `extractEcidFromInteractResponse` was relocated to the
// browser-safe rig/alloy-xdm-mint.js (spec 012-02) so the in-browser coalescing
// broker can read a coalesced response without importing node:crypto. It is
// re-exported here so 012-01's importers (rig/alloy-chamber.mjs, the unit test)
// keep working unchanged — single source of truth, two entry points.
import { extractEcidFromInteractResponse } from "../connectors/alloy/xdm-mint.js";
export { extractEcidFromInteractResponse };

// The value the OLD in-chamber stub hardcoded (R-004's fetch stub). AC4's mint
// must differ from it — the point is a SERVER-assigned ECID, not a chamber
// constant. Exported so the unit test + rig can assert the difference.
export const OLD_INCHAMBER_STUB_ECID = "STUB-ECID-0123456789";

/**
 * Server-assign a fresh ECID: a 38-digit numeric string (the real Adobe ECID
 * shape). Unique per call by construction (18 random bytes + a monotonic
 * counter), so a regression that returns a constant is caught by the "two calls
 * yield distinct ECIDs" test and the rig's uniqueness assertion.
 * @returns {string}
 */
let mintCounter = 0;
export function mintEcid() {
  mintCounter += 1;
  // 18 random bytes -> a big decimal; concat the counter for guaranteed
  // uniqueness even under an (astronomically unlikely) random collision.
  const rand = BigInt("0x" + randomBytes(18).toString("hex")).toString();
  let digits = (rand + String(mintCounter)).replace(/\D/g, "");
  while (digits.length < 38) digits += rand;
  digits = digits.slice(0, 38);
  // A real ECID's leading digit is non-zero.
  if (digits[0] === "0") digits = "7" + digits.slice(1);
  return digits;
}

/**
 * Build the Edge `interact` response the minting stub returns for one call.
 * @param {string} [requestId] echoed back in the response (Edge shape).
 * @returns {{ response: { requestId: string, handle: Array<object> }, ecid: string }}
 */
export function mintInteractResponse(requestId = "airlock-mint-req") {
  const ecid = mintEcid();
  const response = {
    requestId,
    handle: [
      // alloy persists this into AMCV_<ORGID>=MCMID|<ECID> (grounded probe).
      { type: "identity:result", payload: [{ id: ecid, namespace: { code: "ECID" } }] },
      // and writes this kndctr_*_identity cookie verbatim (grounded probe).
      {
        type: "state:store",
        payload: [{ key: "kndctr_SPIKE_identity", value: "srv-store-" + ecid.slice(0, 8), maxAge: 34128000 }],
      },
    ],
  };
  return { response, ecid };
}

/** The html-content-item schema whose `data.content` is the HTML the host applies. */
const HTML_CONTENT_ITEM_SCHEMA = "https://ns.adobe.com/personalization/html-content-item";
let decisionCounter = 0;

/**
 * Build a `personalization:decisions` handle carrying ONE Target proposition for
 * the `__view__` scope — spec 012-03, AC1. This is the Edge-side shape alloy
 * surfaces as `result.propositions` under `renderDecisions:false` (headless):
 * `{ id, scope, scopeDetails, items: [{ schema, data: { content } }] }` (the
 * documented XDM Personalization proposition, grounded against alloy 2.35.0's
 * `personalization:decisions` / `__view__` / `html-content-item` tokens).
 *
 * @param {{ html?: string, scope?: string, propositionId?: string,
 *           activityId?: string, experienceId?: string }} [opts]
 * @returns {{ type: string, payload: Array<object> }}
 */
export function personalizationDecisionsHandle(opts = {}) {
  const {
    html = "<div data-airlock-decision>Personalized</div>",
    scope = "__view__",
    propositionId = "AT:airlock-" + (++decisionCounter),
    activityId = "airlock-activity-" + decisionCounter,
    experienceId = "airlock-experience-0",
  } = opts;
  const proposition = {
    id: propositionId,
    scope,
    scopeDetails: {
      decisionProvider: "TGT",
      activity: { id: activityId },
      experience: { id: experienceId },
      strategies: [{ algorithmID: "0", trafficType: "0" }],
      characteristics: { eventToken: "airlock-token" },
    },
    items: [
      {
        id: "airlock-item-" + decisionCounter,
        schema: HTML_CONTENT_ITEM_SCHEMA,
        data: { id: "airlock-data-" + decisionCounter, format: "text/html", content: html, type: "text/html" },
      },
    ],
  };
  return { type: "personalization:decisions", payload: [proposition] };
}

/**
 * Build an Edge `interact` response carrying BOTH the identity mint (012-01) AND a
 * `__view__` Target decision (012-03) — the response the decisions rig's stub
 * returns. alloy persists the ECID (unchanged 012-01 path) and surfaces the
 * proposition as `result.propositions` (renderDecisions:false), which the host
 * applies through `reserveSpace`.
 *
 * @param {{ html?: string, requestId?: string, activityId?: string, experienceId?: string }} [opts]
 * @returns {{ response: { requestId: string, handle: Array<object> }, ecid: string, proposition: object }}
 */
export function mintDecisionsResponse(opts = {}) {
  const { html, requestId, activityId, experienceId } = opts;
  const { response, ecid } = mintInteractResponse(requestId);
  const decisionsHandle = personalizationDecisionsHandle({ html, activityId, experienceId });
  response.handle.push(decisionsHandle);
  return { response, ecid, proposition: decisionsHandle.payload[0] };
}

/**
 * Gate-able minting-Edge stub — spec 012-02, AC5.
 *
 * The 012-01 stub minted a fresh ECID and responded immediately. To construct
 * the in-flight coalescing window DETERMINISTICALLY (not race for it), 012-02
 * needs RESPONSE-TIMING CONTROL: hold the FIRST mint's response until the SECOND
 * chamber's mint has arrived at the broker. This factory wraps the mint with a
 * park/release gate:
 *   - `handle({ reqBody, hold })` mints an ECID; if `hold`, it PARKS the response
 *     (returns a promise that resolves only when released) instead of replying;
 *   - `releaseFirst()` releases the oldest parked response — the broker calls it
 *     the moment the second mint is HELD in-flight, so the first can now complete
 *     and both chambers receive that one ECID.
 * With coalescing OFF the rig does not set `hold`, so both mints reply at once and
 * yield two distinct ECIDs (the split-identity fault). The gate is what makes both
 * outcomes deterministic + reproducible.
 *
 * @returns {{
 *   handle: (opts: { reqBody?: string, hold?: boolean }) => Promise<{ response: object, ecid: string }>,
 *   releaseFirst: () => boolean,
 *   releaseAll: () => number,
 *   parkedCount: () => number,
 *   calls: Array<{ ecid: string, reqBody?: string, held: boolean }>,
 * }}
 */
export function createGatedMintStub() {
  const parked = []; // FIFO of { release, ecid }
  let pendingReleases = 0; // releases that arrived BEFORE their parked interact
  const calls = []; // every mint served, in order

  return {
    handle({ reqBody, hold } = {}) {
      const { response, ecid } = mintInteractResponse();
      calls.push({ ecid, reqBody, held: !!hold });
      if (!hold) return Promise.resolve({ response, ecid });
      // Park: the response is minted now (fixed, deterministic) but withheld until
      // released — the in-flight window the broker's second mint lands inside.
      return new Promise((resolve) => {
        const entry = { release: () => resolve({ response, ecid }), ecid };
        // Release-before-park: the broker's release signal (a separate HTTP
        // request) can reach the server BEFORE this held interact does. An armed
        // pending release is consumed here so the in-flight construction never
        // deadlocks on that cross-request ordering.
        if (pendingReleases > 0) { pendingReleases -= 1; entry.release(); }
        else parked.push(entry);
      });
    },
    releaseFirst() {
      const p = parked.shift();
      if (p) { p.release(); return true; }
      // Nothing parked yet — arm a pending release for the next held interact.
      pendingReleases += 1;
      return false;
    },
    releaseAll() {
      let n = 0;
      while (parked.length) { parked.shift().release(); n += 1; }
      return n;
    },
    parkedCount() { return parked.length; },
    pendingReleaseCount() { return pendingReleases; },
    calls,
  };
}
