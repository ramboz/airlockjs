// OneTrust consent-input driver (spec 047-01) — the FIRST concrete driver on
// ADR-0007's consent-input seam. ADR-0007 pins consent as a per-purpose VECTOR fed
// IN through a driver ("Consent Mode gtag, IAB __tcfapi, or a host callback"); this
// module is the code that PRODUCES that vector from OneTrust and hands it to the
// existing `adapters/eds/index.js` `consent` boot param — another SOURCE onto the
// same seam, not a new seam. The egress half (hold-until-granted + flush-on-accept)
// already shipped (spec 045 / ADR-0023); this driver only produces the vector that
// drives it.
//
// SOURCE SURFACE — decided by ADR-0026 (Option A), grounded by the §A5 opt-out
// experiment: read OneTrust's OWN resolved-consent surface, `OnetrustActiveGroups`
// (equivalently the `OptanonConsent` cookie `groups=<id>:1|0` flags) — a
// comma-delimited GRANTED-group-id string, e.g. `",1,BG394,4,"`. A mapped group
// PRESENT in the granted set => its purposes granted; a mapped group ABSENT while
// OneTrust is resolved => denied (fail-safe direction). The driver NEVER reads
// `GetDomainData().Status` for grant state — the opt-out experiment proved it is the
// configured DEFAULT (does not flip on opt-out), so reading it would grant an
// opted-out user; `GetDomainData()` may supply group taxonomy/names only.
//
// MAPPING — via a HOST-PROVIDED `{ <groupId>: ConsentPurpose[] }` map (a driver
// INPUT / site config, not hardcoded). The grounded reference site (erp.intuit.com,
// US) map is the single coarse entry `{ "4": [the four] }` (group 4 = the sole
// lever) — see `ERP_INTUIT_GROUP_PURPOSE_MAP`. A different OneTrust site supplies
// its own map.
//
// FAIL-TO-PENDING (safety-critical, mirroring `core/consent.js`'s resolver): an
// absent/malformed OneTrust surface, an unknown group id, or an unmapped purpose =>
// the purpose is OMITTED (so `resolveConsent` yields pending -> the seal HOLDS) —
// NEVER a silent `granted`. A denied/unresolved boot must leak no ad beacon.
//
// HOST-NEUTRAL, EGRESS-FREE, PURE LEAF: this module opens no worker, performs no
// egress, and IMPORTS NOTHING (so it cannot pull in GA4/MP or connector specifics —
// it emits only the vendor-neutral `core/consent.js` vector). The OneTrust-specific
// read is DEPENDENCY-INJECTED (the caller passes the resolved-group string, or the
// host global object to read it off) so the pure mapping is unit-testable WITHOUT a
// live OneTrust — no ambient DOM/global is touched here.

/**
 * The Consent Mode v2 four this driver targets — MVP8's ad-conversion scope, a
 * strict subset of `core/consent.js`'s `CONSENT_PURPOSES` (the names match core's
 * taxonomy EXACTLY). `functional` / `personalization` are deliberately out of scope
 * (spec 047 § Out of scope), so a host map entry naming them is ignored.
 */
export const CONSENT_MODE_V2_PURPOSES = ["analytics_storage", "ad_storage", "ad_user_data", "ad_personalization"];

/**
 * The grounded reference-site (erp.intuit.com, US) host map (§A5,
 * `rig/onetrust-map-probe.mjs`): group `4` (Advertising-Targeting) is the SINGLE
 * consent lever for the whole CM v2 vector on that site — denying it denied all four
 * signals; `BG394` is slaved to `4`. Expressible as one coarse per-group entry
 * (ADR-0026 kill-criterion NOT triggered). Exported as the default/reference map; a
 * different OneTrust deployment supplies its own (EEA/opt-in granularity is the §A5
 * residual, re-verified at MVP7-9 EEA parity).
 */
export const ERP_INTUIT_GROUP_PURPOSE_MAP = Object.freeze({
  4: ["ad_storage", "analytics_storage", "ad_user_data", "ad_personalization"],
});

/**
 * Parse OneTrust's resolved granted-group string into `{ resolved, granted }`.
 *
 * OneTrust's `OnetrustActiveGroups` is ALWAYS comma-wrapped when the CMP has
 * resolved (e.g. `",1,BG394,4,"`, or `",1,"` after opt-out — essential group `1`
 * always stays). "Resolved" is therefore signalled by a comma-delimited value
 * yielding >=1 group id: an absent (`null`/`undefined`/non-string), empty, or
 * unstructured value (no delimiter, or only delimiters) is treated as NOT resolved —
 * the §A4 "present but not yet fully resolved" state — so the mapper omits every
 * purpose (pending), never denies or grants on a surface that never resolved.
 *
 * @param {unknown} activeGroups the `OnetrustActiveGroups` value.
 * @returns {{ resolved: boolean, granted: Set<string> }}
 */
function parseActiveGroups(activeGroups) {
  if (typeof activeGroups !== "string" || !activeGroups.includes(",")) {
    return { resolved: false, granted: new Set() };
  }
  const granted = new Set();
  for (const part of activeGroups.split(",")) {
    const id = part.trim();
    if (id) granted.add(id);
  }
  return { resolved: granted.size > 0, granted };
}

/**
 * Invert the host `{ groupId: purpose[] }` map into `Map<purpose, groupId[]>` over
 * the CM v2 four ONLY, case-normalizing each declared purpose to core's lowercase
 * taxonomy. A non-object map, a non-array entry, a non-string purpose, or an
 * out-of-scope purpose (e.g. `functional`) is skipped — so a malformed map degrades
 * to "nothing covered" (every purpose omitted -> pending), never a throw.
 *
 * @param {Record<string, string[]>|null|undefined} groupPurposeMap
 * @returns {Map<string, string[]>}
 */
function coverageByPurpose(groupPurposeMap) {
  /** @type {Map<string, string[]>} */
  const coverage = new Map();
  if (!groupPurposeMap || typeof groupPurposeMap !== "object") return coverage;
  for (const [groupId, purposes] of Object.entries(groupPurposeMap)) {
    if (!Array.isArray(purposes)) continue;
    for (const raw of purposes) {
      if (typeof raw !== "string") continue;
      const purpose = raw.toLowerCase();
      if (!CONSENT_MODE_V2_PURPOSES.includes(purpose)) continue; // out-of-scope / unknown purpose ignored
      const groups = coverage.get(purpose) ?? [];
      groups.push(String(groupId));
      coverage.set(purpose, groups);
    }
  }
  return coverage;
}

/**
 * The PURE mapping (fixture-testable, no DOM/global): resolve OneTrust's granted-group
 * string + a host group->purpose map to a `core/consent.js`-shaped vector over the
 * Consent Mode v2 four.
 *
 * For each CM v2 purpose the host map covers, when OneTrust is RESOLVED: the purpose
 * is `"granted"` if ANY covering group is in the granted set (OR semantics — a
 * purpose enabled by any consented group is granted), else `"denied"` (a mapped
 * group absent while resolved is a real denial). A purpose no mapped group covers is
 * OMITTED. When OneTrust is NOT resolved (absent/malformed/pending surface) EVERY
 * purpose is omitted — the fail-to-pending default (the seal holds), never a silent
 * grant or deny.
 *
 * @param {unknown} activeGroups the `OnetrustActiveGroups` granted-group string.
 * @param {Record<string, string[]>|null|undefined} groupPurposeMap the host map.
 * @returns {Record<string, "granted"|"denied">} a vector whose keys are a subset of
 *   `CONSENT_MODE_V2_PURPOSES` and whose values are exactly `"granted"`/`"denied"`
 *   (matching `core/consent.js`); an omitted purpose resolves to pending downstream.
 */
export function mapOnetrustConsent(activeGroups, groupPurposeMap) {
  const { resolved, granted } = parseActiveGroups(activeGroups);
  /** @type {Record<string, "granted"|"denied">} */
  const vector = {};
  if (!resolved) return vector; // absent/malformed/unresolved -> omit all (pending)
  const coverage = coverageByPurpose(groupPurposeMap);
  for (const purpose of CONSENT_MODE_V2_PURPOSES) {
    const groups = coverage.get(purpose);
    if (!groups || groups.length === 0) continue; // unmapped purpose -> omit (pending)
    vector[purpose] = groups.some((groupId) => granted.has(groupId)) ? "granted" : "denied";
  }
  return vector;
}

/**
 * The INJECTED read of OneTrust's resolved surface: read `OnetrustActiveGroups` off
 * the host global object handed in (`win`). Guarded + host-neutral — a missing `win`,
 * a `win` without the surface (OneTrust absent / not yet present), or a non-string
 * value all return `null`, NEVER a throw. Reads ONLY the resolved-consent surface —
 * never `GetDomainData().Status` (ADR-0026 / §A5: configured-default).
 *
 * The caller (a host adapter with DOM access — `adapters/eds/index.js`) passes its
 * own global object; this module touches no ambient global, so the mapping stays
 * fixture-testable without a live OneTrust.
 *
 * @param {{ OnetrustActiveGroups?: unknown }|null|undefined} win the host global object.
 * @returns {string|null} the granted-group string, or `null` when unavailable.
 */
export function readOnetrustActiveGroups(win) {
  if (!win || typeof win !== "object") return null;
  const value = win.OnetrustActiveGroups;
  return typeof value === "string" ? value : null;
}

/**
 * Boot-facing composition: read OneTrust's resolved surface (via the injected read /
 * host global) and map it through the host group->purpose map to the consent vector
 * the `adapters/eds/index.js` boot feeds as its `consent` param.
 *
 * An explicit `activeGroups` (even `null`) is used verbatim (the test / already-read
 * seam); otherwise the surface is read from `win` via `read`. An absent/unresolved
 * surface yields an empty `{}` vector — every purpose pending — which the boot still
 * wires as `consent` so the seal HOLDS (fail-to-pending), never fail-to-send.
 *
 * @param {object} [options]
 * @param {Record<string, string[]>} [options.groupPurposeMap] the host group->purpose map.
 * @param {unknown} [options.activeGroups] an explicit granted-group string override
 *   (skips the read — the test / pre-read seam).
 * @param {(win: unknown) => (string|null)} [options.read] the injected read (default
 *   `readOnetrustActiveGroups`).
 * @param {{ OnetrustActiveGroups?: unknown }} [options.win] the host global object to read from.
 * @returns {Record<string, "granted"|"denied">} the `core/consent.js`-shaped vector.
 */
export function resolveOnetrustBootConsent({ groupPurposeMap, activeGroups, read = readOnetrustActiveGroups, win } = {}) {
  const source = activeGroups !== undefined ? activeGroups : read(win);
  return mapOnetrustConsent(source, groupPurposeMap);
}
