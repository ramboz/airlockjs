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

/**
 * Extract the ECID from an Edge interact response — the exact read alloy makes
 * to persist it: the first `identity:result` handle's payload entry whose
 * `namespace.code === "ECID"`. Defensive: returns `null` (never throws) on a
 * missing/empty handle or a response with no ECID namespace.
 * @param {{ handle?: Array<{ type?: string, payload?: Array<{ id?: string, namespace?: { code?: string } }> }> } | null | undefined} response
 * @returns {string | null}
 */
export function extractEcidFromInteractResponse(response) {
  const handles = (response && response.handle) || [];
  for (const h of handles) {
    if (h && h.type === "identity:result") {
      for (const entry of h.payload || []) {
        if (entry && entry.namespace && entry.namespace.code === "ECID") return entry.id;
      }
    }
  }
  return null;
}
