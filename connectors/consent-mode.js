/**
 * Consent Mode v2 STATE (`gcs`) + DEFAULTS (`gcd`) encoders — spec 044-01 (the extract-on-third-caller
 * convention, docs/conventions.md § Code).
 * EXTRACTED VERBATIM (behavior-preserving) from `connectors/ga4/gtag.js` (spec 039-02/039-05),
 * where they were module-internal, because the gtag-family carries the SAME `gcs`/`gcd` across
 * vendors: GA4 gtag (spec 039, 1st caller), Google Ads (spec 044, 2nd caller), and Floodlight
 * (a sibling spec, prospective 3rd) all emit byte-identical Consent-Mode carriage (verified on the
 * 2026-09-11 R-009 §(b) capture, where the AW/DC/GA4 pings share `gcs=G111`/`gcd=13r3r3r3r5l1`).
 * The encoders are now the SINGLE home; `connectors/ga4/gtag.js` imports them (its 039 behavior is
 * unchanged — test/ga4-gtag.test.js's `gcs`/`gcd` assertions stay green), rather than each
 * gtag-family connector re-authoring the same live-grounded strings.
 *
 * A pure module — no DOM, no globals; the ONE dependency is `core/consent.js`'s `resolveConsent`
 * (a connector→core import — allowed and correct, per this module's `connectors/` home). It DOES
 * encode Google-specific Consent-Mode wire-shape (the `gcs`/`gcd` strings) — that vendor coupling is
 * exactly why it lives connector-side, NOT in the vendor-neutral `core/` (docs/conventions.md
 * § Code home rule). See each function's doc comment for the live-grounding provenance (carried over
 * from the 039 slices this code was proven under).
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
