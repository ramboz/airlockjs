/**
 * GA4 Measurement-Protocol consent shaping (spec 017-01, ADR-0007 point ①) —
 * the vendor-specific half of the consent reshape. Reads the vendor-neutral
 * `core/consent.js` resolver (connector -> core is allowed; the reverse is
 * not — test/core-boundary.test.js) and shapes ONLY the two DATA-USE
 * purposes (`ad_user_data`, `ad_personalization`) into the MP `consent`
 * object `map.js:74` already consumes (`if (ctx.consent) body.consent =
 * ctx.consent`) — the reshape mechanism pre-exists this slice; this module
 * feeds it.
 *
 * The two STORAGE purposes (`analytics_storage`, `ad_storage`) are
 * deliberately NOT shaped here — the MP body has no field for them; a
 * storage deny is enforced at the cookie-write capability, 017-02's job, not
 * the mapper's (ADR-0007's three-point split).
 *
 * PENDING (no signal yet) is OMITTED, never fail-safe-DENIED: 017-01 reshapes
 * only EXPLICITLY-signaled data-use purposes — ADR-0007's "denied — reshape
 * and send" behaviour applies to an actual denial, not to silence. A pending
 * purpose that should HOLD the beacon is the seal's job (017-03), not this
 * shaper's; collapsing pending into denied here would both double-enforce it
 * (once wrongly here, once correctly at the seal) and send Google a
 * misleading "DENIED" signal for a purpose the host never actually decided.
 */
import { resolveConsent } from "../../core/consent.js";

/** The two ADR-0007 purposes the MP `consent` object carries (map.js's shape). */
const DATA_USE_PURPOSES = ["ad_user_data", "ad_personalization"];

/** GA4 MP consent literal values, keyed by the core resolver's own vocabulary. */
const MP_VALUE = { granted: "GRANTED", denied: "DENIED" };

/**
 * Shape a host consent vector into the GA4 MP `consent` object.
 *
 * @param {Record<string, string>|null|undefined} vector the host-supplied
 *   ADR-0007 consent vector (core/consent.js's shape).
 * @returns {{ ad_user_data?: "GRANTED"|"DENIED", ad_personalization?: "GRANTED"|"DENIED" }|undefined}
 *   the MP `consent` object map.js consumes, or `undefined` when NO data-use
 *   purpose is explicitly signaled — so `ctx.consent` stays absent and
 *   `map.js`'s `if (ctx.consent)` guard omits `body.consent` (back-compat: an
 *   unset-consent host produces a byte-identical body to before this slice).
 */
export function shapeMpConsent(vector) {
  /** @type {Record<string, "GRANTED"|"DENIED">} */
  const consent = {};
  for (const purpose of DATA_USE_PURPOSES) {
    const state = resolveConsent(vector, purpose);
    if (state === "pending") continue; // no signal yet — omit, don't fail-safe to DENIED
    consent[purpose] = MP_VALUE[state];
  }
  return Object.keys(consent).length > 0 ? consent : undefined;
}
