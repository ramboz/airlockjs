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

/**
 * The THIRD ADR-0007 enforcement point: the SEAL (spec 017-03, point ③).
 * `resolveConsent` above is a per-purpose lookup; `egressVerdict` folds a
 * beacon's GOVERNING purpose(s) — the connector's declared `purposes.egress`
 * (AC5, vendor-neutral: this file has no GA4/MP specifics) — into ONE
 * dispatch verdict, per ADR-0007's denial-behaviour matrix:
 *
 *   - **pending** (no signal yet) -> **hold** (AC1/AC2: buffer at the seal,
 *     flush-on-arrival once the purpose grants — the caller's job, not this
 *     pure function's).
 *   - **denied** (non-strict) -> **send**: a STORAGE-purpose denial is
 *     017-02's cookie-capability concern (deny the `_ga` write) and a
 *     DATA-USE-purpose denial is 017-01's mapper-reshape concern (MP
 *     `consent` DENIED, still POSTs) — neither holds the beacon at the seal.
 *     Do NOT collapse denied into hold/drop here; that would double-enforce a
 *     denial ADR-0007 already routes elsewhere.
 *   - **granted** -> **send**.
 *   - **strict** regime (AC3, a declared no-processing regime) -> **drop** on
 *     ANY purpose that is not `"granted"` (pending OR denied) — no beacon at
 *     all, distinct from a held beacon (which still exists, buffered).
 *
 * Severity order is `send < hold < drop`: across MULTIPLE governing purposes
 * (AC5, fail-closed), the WORST verdict wins — once any purpose escalates the
 * verdict, a later purpose's `"send"` never downgrades it back.
 *
 * Pure — no DOM, no mutable state, no GA4/MP specifics. The caller (the seal
 * in `core/airlock.js`) owns the buffer/flush/drop side effects; this
 * function only classifies.
 *
 * @param {Record<string, string>|null|undefined} vector the host-supplied
 *   consent vector (`resolveConsent`'s shape).
 * @param {string[]|null|undefined} purposes the beacon's governing purpose(s)
 *   (a connector's declared `purposes.egress`, e.g. GA4's
 *   `["analytics_storage"]`). An empty/absent list resolves to `"send"` — no
 *   governing purpose means nothing for the seal to gate on.
 * @param {{ strict?: boolean }} [opts] `strict`: a declared strict/
 *   no-processing regime (ADR-0007 AC3 — this slice's chosen boot-property
 *   option among the ADR's still-open "where is the regime declared"
 *   question, not a pinned seam contract).
 * @returns {"send"|"hold"|"drop"}
 */
export function egressVerdict(vector, purposes, { strict = false } = {}) {
  let verdict = "send"; // severity: send < hold < drop
  for (const p of purposes || []) {
    const state = resolveConsent(vector, p);
    if (strict && state !== "granted") return "drop"; // strict: any un-granted -> drop
    if (state === "pending" && verdict === "send") verdict = "hold"; // pending -> hold (no signal yet)
    // denied (non-strict) -> send (a storage-purpose denial is 017-02's cookie
    // concern, a data-use denial is 017-01's mapper-reshape concern; the
    // beacon still egresses); granted -> send.
  }
  return verdict;
}
