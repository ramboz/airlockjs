/**
 * Consent Mode v2 STATE (`gcs`) + DEFAULTS (`gcd`) + the `npa` (non-personalized-ads) flag — spec
 * 044-01 (the extract-on-third-caller convention, docs/conventions.md § Code); `npa` folded in by
 * spec 046-01.
 *
 * `gcs`/`gcd` EXTRACTED VERBATIM (behavior-preserving) from `connectors/ga4/gtag.js` (spec
 * 039-02/039-05), where they were module-internal, because the gtag-family carries the SAME
 * `gcs`/`gcd` across vendors: GA4 gtag (spec 039, 1st caller), Google Ads (spec 044, 2nd caller), and
 * Floodlight (spec 046, 3rd caller) all emit byte-identical Consent-Mode carriage (verified on the
 * 2026-09-11 R-009 §(b) capture, where the AW/DC/GA4 pings share `gcs=G111`/`gcd=13r3r3r3r5l1`).
 *
 * `npa` EXTRACTED (spec 046-01) from `connectors/google-ads/connector.js` (spec 044-01, where it was
 * connector-local — AW's 1st, sole caller) now that Floodlight is its 2nd caller. Two callers is
 * technically ahead of the strict rule-of-three, but the convention explicitly allows this ("a
 * genuine reuse ... MAY extract on the 2nd caller when a 3rd is imminent", docs/conventions.md
 * § Code): `npa` is byte-identical gtag-family Consent-Mode carriage exactly like `gcs`/`gcd`, this
 * module is already the proven home for that carriage (a 3rd `npa` caller is exactly as plausible as
 * `gcs`/`gcd`'s own 3rd-caller Floodlight arrival was), and leaving `npa` connector-local while its
 * `gcs`/`gcd` siblings moved here would fork the SAME encoder family across two homes for no reason.
 *
 * The encoders are now the SINGLE home; `connectors/ga4/gtag.js` and `connectors/google-ads/
 * connector.js` import them (their prior behavior unchanged — test/ga4-gtag.test.js's and
 * test/google-ads.test.js's assertions stay green), rather than each gtag-family connector
 * re-authoring the same live-grounded strings/flag.
 *
 * A pure module — no DOM, no globals; the ONE dependency is `core/consent.js`'s `resolveConsent`
 * (a connector→core import — allowed and correct, per this module's `connectors/` home). It DOES
 * encode Google-specific Consent-Mode wire-shape (the `gcs`/`gcd`/`npa` strings/flag) — that vendor
 * coupling is exactly why it lives connector-side, NOT in the vendor-neutral `core/` (docs/
 * conventions.md § Code home rule). See each function's doc comment for the live-grounding
 * provenance (carried over from the 039/044 slices this code was proven under).
 */
import { resolveConsent } from "../core/consent.js";

/** The two Consent-Mode v2 STORAGE purposes `gcs` carries, in the documented digit ORDER
 *  (`G1<ad_storage><analytics_storage>`) — `gcs` ignores the two DATA-USE purposes
 *  (`ad_user_data`/`ad_personalization`), unlike `gcd`. */
const GCS_PURPOSES = ["ad_storage", "analytics_storage"];

/** `resolveConsent`'s `"granted"|"denied"` states, keyed to their `gcs` digit. `"pending"` is
 *  deliberately ABSENT — handled by `encodeGcs`'s early-return, never reaches this lookup. */
const GCS_DIGIT = { granted: "1", denied: "0" };

/**
 * Encode the Consent-Mode v2 **STATE** string `gcs` (`G1<ad_storage><analytics_storage>`, e.g.
 * `G111` all-granted / `G100` all-denied — both live-observed anchors) from a host-supplied
 * ADR-0007 consent vector. A pure function of the vector — no default-config input, unlike `gcd`.
 *
 * PENDING omission (mirrors `connectors/ga4/consent.js`'s "no signal yet — omit, don't fail-safe to
 * DENIED"): `gcs` is a JOINT positional string — a single digit cannot be omitted while keeping the
 * other — so if EITHER governing purpose (`ad_storage`/`analytics_storage`) is `"pending"`, this
 * returns `undefined` and `gcs` is omitted from the beacon ENTIRELY, never a partial/guessed `G1XY`.
 *
 * @param {Record<string, string>|null|undefined} vector the host-supplied ADR-0007 consent vector
 *   (`core/consent.js`'s shape).
 * @returns {string|undefined} the `gcs` STATE string, or `undefined` when either governing purpose
 *   has no signal yet.
 */
export function encodeGcs(vector) {
  const states = GCS_PURPOSES.map((purpose) => resolveConsent(vector, purpose));
  if (states.some((state) => state === "pending")) return undefined; // joint string — omit entirely, never a partial guess
  return `G1${states.map((state) => GCS_DIGIT[state]).join("")}`;
}

/** The four Consent-Mode v2 purposes `gcd` carries, in the live-grounded POSITION ORDER — each of
 *  the four single-signal-granted anchors in `test/fixtures/parity-ga4-consent-gcd.redacted.json`
 *  pins ONE position independently, so this order is live-grounded, not asserted from docs. Unlike
 *  `GCS_PURPOSES`, `gcd` carries all four — including the two DATA-USE purposes `gcs` ignores. */
const GCD_PURPOSES = ["ad_storage", "analytics_storage", "ad_user_data", "ad_personalization"];

/** `resolveConsent`'s `"granted"|"denied"` states, keyed to their `gcd` letter — for the
 *  live-grounded default-DENIED config only (see `encodeGcd`'s doc comment). `"pending"` is
 *  deliberately ABSENT — handled by `encodeGcd`'s early-return, never reaches this lookup. */
const GCD_LETTER = { granted: "r", denied: "q" };

/**
 * Is the host's DECLARED Consent-Mode default denied for all four `gcd` purposes? `consentDefault`
 * mirrors `ctx.consent`'s vector shape (the SAME `resolveConsent` reads) but carries the container's
 * boot-time `gtag('consent','default',{...})` declaration — a DIFFERENT axis than the CURRENT
 * per-visit `ctx.consent` vector `encodeGcs`/`encodeGcd` resolve.
 *
 * Absent/`undefined`/`null` `consentDefault` defaults to denied-all: airlock's own consent-governed
 * target IS deny-by-default + update-on-grant (ADR-0007's posture), so an unset declaration is
 * treated as that common case, not as "unknown -> omit" — this is what lets `gcd` emit out of the
 * box for airlock's target deployment. A PRESENT `consentDefault` is checked per-signal via the SAME
 * `resolveConsent`; any purpose absent from it or not exactly `"denied"` fails the check (scopes to
 * the live-grounded denied-all default only — the default-GRANTED letters are unobserved).
 * @param {Record<string, string>|null|undefined} consentDefault
 * @returns {boolean}
 */
function isDeniedAllDefault(consentDefault) {
  if (consentDefault === undefined || consentDefault === null) return true;
  return GCD_PURPOSES.every((purpose) => resolveConsent(consentDefault, purpose) === "denied");
}

/**
 * Encode the Consent-Mode v2 **DEFAULTS** string `gcd` for the live-grounded default-denied
 * deployment — `13<L>3<L>3<L>3<L>5l1` over `[ad_storage, analytics_storage, ad_user_data,
 * ad_personalization]`, `L(granted)="r"` / `L(denied)="q"`. Unlike `encodeGcs` (a pure function of
 * the vector alone), `gcd` ALSO depends on the host's DECLARED default (`consentDefault`) — the
 * `"13…3…3…3…5l1"` framing is the STRUCTURAL CONSTANT observed for THAT declared default
 * (denied-all + `wait_for_update:10`), not derived from the vector.
 *
 * Scope gate — returns `undefined` (omitted from the beacon via the caller's omit-when-undefined
 * append rule, never a guessed value) when:
 *  - the DECLARED default is not denied-all (`isDeniedAllDefault` false): the default-GRANTED
 *    letters are UNOBSERVED, so guessing risks a WRONG string — a tracked, HONEST known non-parity
 *    gap for the unsupported default-granted config.
 *  - ANY of the four governing signals is `"pending"`: `gcd` is a JOINT positional string like
 *    `gcs`, so a single pending signal omits the WHOLE string rather than guess a partial one.
 *
 * @param {Record<string, string>|null|undefined} vector the SAME raw ADR-0007 consent vector
 *   `encodeGcs` reads (`config.ctx.consent`) — the CURRENT per-visit update state.
 * @param {Record<string, string>|null|undefined} consentDefault the host's declared Consent-Mode
 *   default (`config.ctx.consentDefault`) — see `isDeniedAllDefault` for shape/semantics/default.
 * @returns {string|undefined} the `gcd` DEFAULTS string, or `undefined` when out of scope
 *   (non-denied-all declared default) or undecidable (a pending governing signal).
 */
export function encodeGcd(vector, consentDefault) {
  if (!isDeniedAllDefault(consentDefault)) return undefined; // unsupported config — known non-parity gap, never guessed
  const states = GCD_PURPOSES.map((purpose) => resolveConsent(vector, purpose));
  if (states.some((state) => state === "pending")) return undefined; // joint string — omit entirely, never a partial guess
  const [adStorage, analyticsStorage, adUserData, adPersonalization] = states.map((state) => GCD_LETTER[state]);
  return `13${adStorage}3${analyticsStorage}3${adUserData}3${adPersonalization}5l1`;
}

/** The two DATA-USE purposes governing `npa` (non-personalized ads) — the SAME two purposes `gcd`
 *  carries under its `ad_user_data`/`ad_personalization` positions, read jointly here. */
const NPA_PURPOSES = ["ad_user_data", "ad_personalization"];

/**
 * Encode the `npa` (non-personalized ads) flag from the host consent vector: `"0"` (personalized
 * ads OK — the live-observed granted-state anchor `npa=0`, R-009 §(b)) when BOTH `ad_user_data` and
 * `ad_personalization` are granted, `"1"` (non-personalized) otherwise. A pure function of the
 * vector alone (like `encodeGcs`, unlike `encodeGcd`'s extra `consentDefault` axis). `npa` is always
 * present (a single digit; unlike the joint `gcs`/`gcd` strings, it is never omitted) — EXTRACTED
 * here (spec 046-01) from `connectors/google-ads/connector.js` (spec 044-01), see the module doc
 * comment above for the extraction rationale.
 * @param {Record<string, string>|null|undefined} vector the host consent vector.
 * @returns {"0"|"1"}
 */
export function encodeNpa(vector) {
  const granted = NPA_PURPOSES.every((purpose) => resolveConsent(vector, purpose) === "granted");
  return granted ? "0" : "1";
}
