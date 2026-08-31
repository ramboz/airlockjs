// Consent vector state — the vendor-neutral core of ADR-0007's purpose-dimensioned
// consent model (spec 017-01, AC1). ADR-0006's grant law is `granted = declared ∩
// host-policy ∩ consent`; ADR-0007 turns that consent term from a single global
// switch (AD-9) into a VECTOR — one independently-grantable signal per PURPOSE
// (the Consent Mode v2 four, plus `functional`/`personalization`) — because
// "analytics yes, ads no" cannot be expressed with one boolean, and GA4's own
// Consent Mode natively carries four distinct signals.
//
// The vector is consumed at THREE enforcement points (ADR-0007): the cookie/
// storage capability (deny the write — 017-02), the connector's MAPPER (reshape
// the payload for a denied *data-use* purpose — THIS slice, 017-01), and the
// SEAL (hold-pending for a purpose with no signal yet — 017-03). This module
// supplies only the shared, vendor-neutral piece all three read: the taxonomy
// plus a pure per-purpose resolver. No GA4/MP specifics live here — the MP
// `consent`-object SHAPING is the GA4 connector's job
// (connectors/ga4/consent.js), which imports and reads this resolver
// (connector -> core is allowed; the reverse is not — test/core-boundary.test.js).
//
// PENDING is the default, not DENIED: a purpose absent from the vector, an
// unrecognized purpose name, or an unrecognized value all resolve to "pending"
// — "no signal yet" — never silently to "denied" and never to "granted".
// Fail-to-pending, not fail-to-deny/fail-to-allow, because pending carries its
// OWN enforcement meaning at each consumption point (e.g. the seal's
// hold-and-flush-on-arrival, 017-03) that collapsing it into denied would lose.

/**
 * The ADR-0007 purpose taxonomy: the Consent Mode v2 four
 * (`analytics_storage`, `ad_storage`, `ad_user_data`, `ad_personalization`)
 * plus the two starter extensions (`functional`, `personalization`). A
 * purpose NOT in this list is unrecognized — `resolveConsent` treats it as
 * pending without ever consulting the vector for it.
 */
export const CONSENT_PURPOSES = [
  "analytics_storage",
  "ad_storage",
  "ad_user_data",
  "ad_personalization",
  "functional",
  "personalization",
];

/**
 * Resolve one purpose's consent state from a host-supplied vector.
 *
 * Pure — no DOM, no globals, no GA4/MP specifics (this file stays vendor-
 * neutral; test/core-boundary.test.js's sibling boundary guard covers the
 * core-> rig/ direction, this module simply never imports anything).
 *
 * @param {Record<string, string>|null|undefined} vector the host-supplied
 *   per-purpose consent vector (any subset of CONSENT_PURPOSES as keys; a
 *   purpose absent from the vector has no signal yet). Values are matched
 *   case-insensitively (`"granted"`/`"GRANTED"`, `"denied"`/`"DENIED"`).
 * @param {string} purpose the purpose to resolve — normally one of
 *   CONSENT_PURPOSES; any other string resolves to "pending".
 * @returns {"granted"|"denied"|"pending"} "pending" for an unrecognized
 *   `purpose`, an absent vector entry, or an unrecognized value — "no signal
 *   yet" is the uniform default, never a silent deny or a silent allow.
 */
export function resolveConsent(vector, purpose) {
  if (!CONSENT_PURPOSES.includes(purpose)) return "pending";
  const raw = vector == null ? undefined : vector[purpose];
  if (typeof raw !== "string") return "pending";
  const normalized = raw.toLowerCase();
  if (normalized === "granted") return "granted";
  if (normalized === "denied") return "denied";
  return "pending";
}
