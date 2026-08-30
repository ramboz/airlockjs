// Spec 013-03 — the seam-side config-integrity check (the demonstrated mitigation).
//
// Threat (verified vs ADR-0004/ADR-0006 in the 013-03 frame-critique): the egress seal keys
// on endpoint HOST/PATH, but the tenant-routing key — the datastream, carried as alloy's
// `configId` query param — rides OUTSIDE that key. So a compromised chamber that re-points its
// alloy to an ATTACKER datastream on the SAME allowed host (adobedc.demdex.net) sends the
// user's identity/analytics to the attacker while every host-allow-list check passes. Neither
// ADR carries a tenant-scoped control.
//
// Host-owned config at boot is necessary but NOT sufficient: the whole alloy runtime lives IN
// the chamber, so compromised code can re-`configure` alloy OR bypass alloy and craft its own
// `?configId=<attacker>` fetch. The ENFORCEABLE control is at the egress SEAM — the
// orchestrator's main-thread dispatch (ADR-0004), the chokepoint every intercepted interact
// crosses.
//
// CRITICAL (013-03 craft review): a naive "parse the chamber's URL and compare" is evadable by
// the very adversary in the threat model — it TRUSTS a URL the hostile chamber fully controls
// (parameter pollution `?configId=<honest>&configId=<attacker>`, encoding, a path-embedded id).
// So the robust posture is TWO-fold:
//   1. DETECT + FAIL CLOSED: parse *all* configId params (getAll — pollution-aware); an absent,
//      duplicated, or mismatched configId HOLDS at the seal (fail closed, not open).
//   2. OVERRIDE, don't just compare: the seam RE-DERIVES the dispatch URL with the host-pinned
//      configId (pinnedDispatchUrl) — whatever the chamber put there is discarded — so the
//      control does not depend on trusting the chamber's self-report at all.
// This is demonstrated here (not yet wired into core/ — parallel-and-minimal, tracked debt),
// and the ADR-0006 config-integrity addition must specify "re-derive/override", not
// "parse-and-compare", and bind at BOTH egress seams (worker mapBatch + unload fast path, OQ16).

/**
 * Parse ALL `configId` query params from an intercepted interact URL (getAll, not get — a
 * hostile chamber can parameter-pollute to slip a value past a naive single-value read).
 * @param {string} interactUrl
 * @returns {string[]} every configId present (0, 1, or many)
 */
export function outboundDatastreams(interactUrl) {
  try { return new URL(interactUrl, "https://airlock.local").searchParams.getAll("configId"); }
  catch { return []; }
}

/**
 * The seam-side config-integrity DETECTOR. FAILS CLOSED: an outbound interact whose datastream
 * is absent, duplicated (pollution), or != the host pin is HELD at the seal.
 * @param {string} interactUrl the intercepted interact the chamber handed to dispatch
 * @param {string | null} pinnedDatastream the host-pinned datastream (orchestrator-owned)
 * @returns {{ verdict: "allow" | "hold", outboundDatastreams: string[], pinnedDatastream: string | null, reason: string }}
 */
export function checkConfigIntegrity(interactUrl, pinnedDatastream) {
  const outbound = outboundDatastreams(interactUrl);
  const ok = outbound.length === 1 && outbound[0] === pinnedDatastream && pinnedDatastream != null;
  const reason = ok ? "ok"
    : outbound.length === 0 ? "config-integrity: no configId on an alloy interact — fail closed (hold)"
    : outbound.length > 1 ? "config-integrity: multiple configId params (parameter pollution) — fail closed (hold)"
    : "config-integrity: outbound configId != host-pinned datastream — same-host tenant re-route held at the seal";
  return { verdict: ok ? "allow" : "hold", outboundDatastreams: outbound, pinnedDatastream, reason };
}

/**
 * The ENFORCEMENT posture: re-derive the dispatch URL carrying EXACTLY the host-pinned
 * datastream, discarding whatever configId(s) the chamber supplied. An override cannot be
 * evaded by pollution/encoding the way a parse-and-compare can, because it never trusts the
 * chamber's value. (The detector above still HOLDS on deviation — override is the alternative
 * "correct + send" posture; a production seam pairs override with a hold-and-alert on deviation.)
 * @param {string} interactUrl
 * @param {string} pinnedDatastream
 * @returns {string} the dispatch URL with exactly one configId = the host pin
 */
export function pinnedDispatchUrl(interactUrl, pinnedDatastream) {
  const url = new URL(interactUrl, "https://airlock.local");
  url.searchParams.delete("configId"); // drop ALL chamber-supplied configId(s), including pollution
  url.searchParams.set("configId", pinnedDatastream); // exactly one, the host's
  return url.toString();
}
