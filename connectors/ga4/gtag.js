/**
 * GA4 gtag-PROTOCOL connector — spec 039-01, implementing ADR-0019. A NEW
 * module, SIBLING to `connectors/ga4/map.js` (the Measurement Protocol
 * mapper) — this file does not import from, modify, or depend on `map.js` in
 * any way (039-01 AC4: the frozen MP surface, `map.js` + `contracts/ga4-mp*`,
 * stays byte-identical; see test/ga4-gtag.test.js's golden-hash assertions).
 *
 * A container's own GA4 tag loads `gtag.js` and sends its beacon to
 * `/g/collect`, authed by `tid` (measurement id) + request origin — NO
 * secret. That is the ADR-0019 adoption fix over the MP path (`map.js`'s
 * `mpUrl` requires an `api_secret`, a server-side trusted credential a
 * rewired browser-side tag cannot safely hold). This connector reproduces
 * that SAME wire protocol off-thread, through the SAME governed GET egress
 * `connectors/pixel/connector.js` already proves (spec 026).
 *
 * SCOPE (039-01 core + 039-02 Consent-Mode STATE + 039-03 session state +
 * 039-05 Consent-Mode DEFAULTS): the CORE, single-event `/g/collect` beacon —
 * `v`, `tid`, `cid`, `sid`, `en`, `dl`/`dr`/`dt`, `ep.<k>`/`epn.<k>` custom
 * params, `_et` (engagement time) — PLUS `gcs`, the Consent-Mode STATE string
 * (039-02, see `encodeGcs` below), PLUS `gcd`, the Consent-Mode DEFAULTS
 * string (039-05, see `encodeGcd` below — scoped to the live-grounded
 * default-denied deployment; omitted for any other declared default, a
 * tracked known non-parity gap, see that function's doc comment), PLUS
 * `sct`/`seg`/`_fv`/`_ss`/`_nsi`, the session-state fields (039-03, see
 * `appendSessionState` below) projected verbatim from the host-computed
 * `ctx.sessionState` — the STATEFUL half, since those values depend on cookie
 * history advanced by `connectors/ga4/cookies.js`'s `writeGa4SessionState`
 * (the `_ga_<stream>` read-modify-write writer that closes OQ13-2), called by
 * the HOST before this connector runs, mirroring how `ctx.clientId`/
 * `ctx.sessionId` are already host-sourced rather than derived here.
 * Transport is GET-only (a single captured event) — the batched-POST form
 * gtag uses for >=2 events is 039-04 (DEFERRED), out of scope.
 *
 * IDENTITY (039-01 AC2): `cid`/`sid` are NOT sourced by this module — they
 * arrive via `config.ctx`, sourced by the HOST exactly as the MP path does
 * today (`connectors/ga4/cookies.js`'s `sourceGa4Ctx`, reused unmodified;
 * mirrors `connectors/ga4/connector.js`'s `config.ctx` convention). This
 * connector never touches cookies, the DOM, or any ambient global.
 *
 * Pure — no `self`/`postMessage`/DOM — directly importable/testable in Node,
 * exactly like `connectors/ga4/map.js` and `connectors/pixel/connector.js`.
 */
import { resolveConsent } from "../../core/consent.js";

/** GA4's public collect endpoint (production; region-prefixed variants exist
 *  but are out of this slice's scope — `mapToMp`'s sibling doesn't need one
 *  either, since auth here is `tid` + origin, not a region-scoped secret). */
export const GA4_GTAG_COLLECT_ENDPOINT = "https://www.google-analytics.com/g/collect";

/** gtag.js's own protocol version query param — constant across every beacon
 *  (R-009(a)'s capture-confirmed field map). */
const PROTOCOL_VERSION = "2";

/** Event-payload keys the CORE mapping already projects onto `dl`/`dr`/`dt` —
 *  excluded from the custom `ep.<k>`/`epn.<k>` fan-out so a param never lands
 *  under BOTH its dedicated field and a custom-param spelling. */
const CORE_PAYLOAD_KEYS = new Set(["page_location", "page_referrer", "page_title"]);

/**
 * Append `key=value` to a query-part array, `encodeURIComponent`-escaping
 * both sides — omitted (never an empty-string param) when `value` is
 * `undefined`/`null`, mirroring `connectors/pixel/connector.js`'s own
 * omission rule.
 * @param {string[]} query
 * @param {string} key
 * @param {unknown} value
 */
function appendParam(query, key, value) {
  if (value === undefined || value === null) return;
  query.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
}

/** The two Consent-Mode v2 STORAGE purposes `gcs` carries, in the
 *  documented digit ORDER (`G1<ad_storage><analytics_storage>`) — `gcs`
 *  ignores the two DATA-USE purposes (`ad_user_data`/`ad_personalization`),
 *  unlike the MP path's `connectors/ga4/consent.js` shaper (039-02's Goal). */
const GCS_PURPOSES = ["ad_storage", "analytics_storage"];

/** `resolveConsent`'s `"granted"|"denied"` states, keyed to their `gcs`
 *  digit. `"pending"` is deliberately ABSENT — a pending purpose is handled
 *  by `encodeGcs`'s early-return, never reaches this lookup. */
const GCS_DIGIT = { granted: "1", denied: "0" };

/**
 * Encode the Consent-Mode v2 **STATE** string `gcs` (`G1<ad_storage>
 * <analytics_storage>`, e.g. `G111` all-granted / `G100` all-denied — both
 * live-observed anchors, `docs/specs/039-ga4-gtag-connector/slice-02-consent-
 * mode.md`) from a host-supplied ADR-0007 consent vector. A pure function of
 * the vector — no default-config input, unlike `gcd` (`encodeGcd` below,
 * 039-05: `gcd` co-varies with consent AND the host's declared Consent-Mode
 * default, so it is not a pure vector function).
 *
 * PENDING omission (mirrors `connectors/ga4/consent.js:48`'s "no signal yet
 * — omit, don't fail-safe to DENIED"): `gcs` is a JOINT positional string —
 * a single digit cannot be omitted while keeping the other — so if EITHER
 * governing purpose (`ad_storage`/`analytics_storage`) is `"pending"`, this
 * returns `undefined` and `gcs` is omitted from the beacon ENTIRELY, never a
 * partial/guessed `G1XY` (039-02 AC2's mixed-pending rule).
 *
 * @param {Record<string, string>|null|undefined} vector the host-supplied
 *   ADR-0007 consent vector (`core/consent.js`'s shape) — the SAME raw
 *   vector `resolveConsent`/`shapeMpConsent` read, NOT the MP-shaped
 *   `{ ad_user_data, ad_personalization }` object `connectors/ga4/consent.js`
 *   produces (that shape has no storage-purpose fields at all).
 * @returns {string|undefined} the `gcs` STATE string, or `undefined` when
 *   either governing purpose has no signal yet.
 */
function encodeGcs(vector) {
  const states = GCS_PURPOSES.map((purpose) => resolveConsent(vector, purpose));
  if (states.some((state) => state === "pending")) return undefined; // joint string — omit entirely, never a partial guess
  return `G1${states.map((state) => GCS_DIGIT[state]).join("")}`;
}

/** The four Consent-Mode v2 purposes `gcd` carries, in the live-grounded
 *  POSITION ORDER (`docs/specs/039-ga4-gtag-connector/slice-05-consent-
 *  defaults-gcd.md`'s Grounding note) — the four single-signal-granted
 *  anchors in `test/fixtures/parity-ga4-consent-gcd.redacted.json` each pin
 *  ONE position independently, so this order is live-grounded, not asserted
 *  from documentation. Unlike `GCS_PURPOSES`, `gcd` carries all four —
 *  including the two DATA-USE purposes `gcs` ignores. */
const GCD_PURPOSES = ["ad_storage", "analytics_storage", "ad_user_data", "ad_personalization"];

/** `resolveConsent`'s `"granted"|"denied"` states, keyed to their `gcd`
 *  letter — for the live-grounded default-DENIED config only (see
 *  `encodeGcd`'s doc comment). `"pending"` is deliberately ABSENT — a
 *  pending signal is handled by `encodeGcd`'s early-return, never reaches
 *  this lookup. */
const GCD_LETTER = { granted: "r", denied: "q" };

/**
 * Is the host's DECLARED Consent-Mode default denied for all four `gcd`
 * purposes? `consentDefault` mirrors `ctx.consent`'s vector shape (the SAME
 * `resolveConsent` reads) but carries the container's boot-time
 * `gtag('consent','default',{...})` declaration — a DIFFERENT axis than the
 * CURRENT per-visit `ctx.consent` vector `encodeGcs`/`encodeGcd` resolve.
 *
 * Absent/`undefined`/`null` `consentDefault` defaults to denied-all: airlock's
 * own consent-governed target IS deny-by-default + update-on-grant (ADR-0007's
 * posture), so an unset declaration is treated as that common case, not as
 * "unknown -> omit" — this is what lets `gcd` emit out of the box for
 * airlock's target deployment (the slice's WHAT-TO-BUILD gating note). A
 * PRESENT `consentDefault` is checked per-signal via the SAME `resolveConsent`
 * `encodeGcs` uses; any purpose absent from it or not exactly `"denied"` fails
 * the check (039-05 AC4 scopes to the live-grounded denied-all default only —
 * the default-GRANTED letters are unobserved, see `encodeGcd`'s doc comment).
 * @param {Record<string, string>|null|undefined} consentDefault
 * @returns {boolean}
 */
function isDeniedAllDefault(consentDefault) {
  if (consentDefault === undefined || consentDefault === null) return true;
  return GCD_PURPOSES.every((purpose) => resolveConsent(consentDefault, purpose) === "denied");
}

/**
 * Encode the Consent-Mode v2 **DEFAULTS** string `gcd` for the live-grounded
 * default-denied deployment (039-05, `docs/specs/039-ga4-gtag-connector/
 * slice-05-consent-defaults-gcd.md`'s Grounding note) —
 * `13<L>3<L>3<L>3<L>5l1` over `[ad_storage, analytics_storage, ad_user_data,
 * ad_personalization]`, `L(granted)="r"` / `L(denied)="q"`. Unlike `encodeGcs`
 * (a pure function of the vector alone), `gcd` ALSO depends on the host's
 * DECLARED default (`consentDefault` below) — the `"13…3…3…3…5l1"` framing
 * (leading `13`, `3` separators, trailing `5l1`) is the STRUCTURAL CONSTANT
 * observed for THAT declared default (denied-all + `wait_for_update:10`), not
 * something this function derives from the vector.
 *
 * Scope gate (AC4) — returns `undefined` (omitted from the beacon via
 * `appendParam`'s existing omission rule, never a guessed value) when:
 *  - the DECLARED default is not denied-all (`isDeniedAllDefault` false): the
 *    default-GRANTED letters are UNOBSERVED on the reference page (its
 *    declared default is fixed denied), so guessing here risks emitting a
 *    WRONG string. This is a tracked, HONEST **known non-parity gap** for the
 *    unsupported default-granted config (the 038 oracle scores the omission
 *    `expected-dropped`/`dropped` there, not a false parity claim) — NOT a
 *    claim that omission is safe against every container. See the slice's
 *    Assumptions for the resolution trigger.
 *  - ANY of the four governing signals is `"pending"` (039-02's discipline,
 *    mirrored): `gcd` is a JOINT positional string like `gcs`, so a single
 *    pending signal omits the WHOLE string rather than guess a partial one.
 *
 * @param {Record<string, string>|null|undefined} vector the SAME raw
 *   ADR-0007 consent vector `encodeGcs` reads (`config.ctx.consent`) — the
 *   CURRENT per-visit update state, not the declared default.
 * @param {Record<string, string>|null|undefined} consentDefault the host's
 *   declared Consent-Mode default (`config.ctx.consentDefault`) — see
 *   `isDeniedAllDefault`'s doc comment for shape/semantics/back-compat default.
 * @returns {string|undefined} the `gcd` DEFAULTS string, or `undefined` when
 *   out of scope (non-denied-all declared default) or undecidable (a pending
 *   governing signal).
 */
function encodeGcd(vector, consentDefault) {
  if (!isDeniedAllDefault(consentDefault)) return undefined; // unsupported config — known non-parity gap, never guessed
  const states = GCD_PURPOSES.map((purpose) => resolveConsent(vector, purpose));
  if (states.some((state) => state === "pending")) return undefined; // joint string — omit entirely, never a partial guess
  const [adStorage, analyticsStorage, adUserData, adPersonalization] = states.map((state) => GCD_LETTER[state]);
  return `13${adStorage}3${analyticsStorage}3${adUserData}3${adPersonalization}5l1`;
}

/**
 * Append the 039-03 session-state fields (`sct`/`seg`/`_fv`/`_ss`/`_nsi`) from the host-computed
 * `ctx.sessionState` — the STATEFUL counterpart to `encodeGcs` above (that one is a pure function
 * of the consent vector this module itself resolves; this one is not a pure function of anything
 * gtag.js holds, since the values depend on `_ga_<stream>` cookie HISTORY advanced by
 * `connectors/ga4/cookies.js`'s `writeGa4SessionState`, called by the HOST before this connector
 * runs — mirrors how `ctx.clientId`/`ctx.sessionId` are host-sourced, never derived here). Absent
 * `sessionState` (e.g. `analytics_storage` not granted, `writeGa4SessionState` returned `null`)
 * omits all five fields, same as an unset `ctx.consent` omits `gcs` (039-02's back-compat rule).
 * Each field is appended individually via `appendParam` — a key `writeGa4SessionState` never sets
 * for a given transition (e.g. `_fv` on a continuation) is `undefined` here and omitted, exactly
 * reproducing the observed "no `_fv`/`_ss`/`_nsi` on a continuation" rule (slice 039-03 AC2).
 * @param {string[]} query
 * @param {{ sct?: string, seg?: string, _fv?: string, _ss?: string, _nsi?: string }|null|undefined} sessionState
 */
function appendSessionState(query, sessionState) {
  if (!sessionState) return;
  appendParam(query, "sct", sessionState.sct);
  appendParam(query, "seg", sessionState.seg);
  appendParam(query, "_fv", sessionState._fv);
  appendParam(query, "_ss", sessionState._ss);
  appendParam(query, "_nsi", sessionState._nsi);
}

/**
 * @param {{ type: string, params?: Record<string, unknown> }} event
 *   The captured event — a GA4 event name + its params (the SAME
 *   `{ type, params }` descriptor shape `connectors/ga4/map.js`'s `mapToMp`
 *   consumes). `page_location`/`page_referrer`/`page_title` project onto
 *   `dl`/`dr`/`dt`; every OTHER param fans out to `ep.<k>` (string) /
 *   `epn.<k>` (number) — the container's own custom-param convention
 *   (R-009(a), capture-confirmed 2026-09-07).
 * @param {{ measurementId: string, ctx: { clientId: string, sessionId: string|number, engagementTimeMsec?: number, consent?: Record<string, string>, consentDefault?: Record<string, string>, sessionState?: { sct?: string, seg?: string, _fv?: string, _ss?: string, _nsi?: string } }, endpoint?: string }} config
 *   `ctx.consent` (039-02): the RAW ADR-0007 host consent vector (NOT the
 *   MP-shaped object `connectors/ga4/consent.js` produces) — the SAME single
 *   `config.ctx` sourcing path 039-01 already uses for identity, extended
 *   with the field `encodeGcs`/`encodeGcd` need. Absent/`undefined` resolves
 *   every purpose to `"pending"` (`core/consent.js`'s fail-to-pending
 *   default), so an unset-consent host omits `gcs`/`gcd` — back-compat with
 *   pre-039-02 beacons. `ctx.consentDefault` (039-05): the host's DECLARED
 *   Consent-Mode default (same vector shape) — gates `encodeGcd` to the
 *   live-grounded denied-all deployment; absent/`undefined` defaults to
 *   denied-all (see `isDeniedAllDefault`'s doc comment), so an unset host
 *   still emits `gcd` for airlock's own consent-governed target.
 *   `ctx.sessionState` (039-03): the host-computed session-state snapshot —
 *   normally `connectors/ga4/cookies.js`'s `writeGa4SessionState`'s return
 *   value, threaded the SAME single-sourcing-path way, and projected verbatim
 *   by `appendSessionState` above. Absent/`undefined` omits `sct`/`seg`/
 *   `_fv`/`_ss`/`_nsi` entirely — back-compat with pre-039-03 beacons.
 * @returns {{ url: string, method: "GET" }} A single beacon descriptor — wrapped
 *   into the `EgressRequest[]` array shape by `handle()` below (the
 *   `Connector.handle` contract, `contracts/connector.d.ts`).
 */
function mapToGtagCollect(event, { measurementId, ctx, endpoint }) {
  const source = (event && (event.params || event.payload)) || {};
  const query = [];

  appendParam(query, "v", PROTOCOL_VERSION);
  appendParam(query, "tid", measurementId);
  appendParam(query, "cid", ctx && ctx.clientId);
  appendParam(query, "sid", ctx && ctx.sessionId);
  // 039-03: session-state carriage, projected verbatim from the host-computed ctx.sessionState —
  // see appendSessionState's doc comment for why this is not a pure function like encodeGcs.
  appendSessionState(query, ctx && ctx.sessionState);
  appendParam(query, "en", event && event.type);
  appendParam(query, "dl", source.page_location);
  appendParam(query, "dr", source.page_referrer);
  appendParam(query, "dt", source.page_title);

  for (const [key, value] of Object.entries(source)) {
    if (CORE_PAYLOAD_KEYS.has(key)) continue;
    if (typeof value === "number" && Number.isFinite(value)) {
      appendParam(query, `epn.${key}`, value);
    } else {
      appendParam(query, `ep.${key}`, value);
    }
  }

  // 039-02: Consent Mode STATE. `encodeGcs` returns `undefined` (omitted by
  // `appendParam`) whenever either governing purpose is still pending — see
  // that function's doc comment for the joint-string/mixed-pending rule.
  appendParam(query, "gcs", encodeGcs(ctx && ctx.consent));
  // 039-05: Consent Mode DEFAULTS, threaded the SAME `ctx.consent` vector
  // plus the declared `ctx.consentDefault` gate. `encodeGcd` returns
  // `undefined` (omitted) for a non-denied-all declared default (a tracked
  // known non-parity gap, see its doc comment) or a pending governing signal.
  appendParam(query, "gcd", encodeGcd(ctx && ctx.consent, ctx && ctx.consentDefault));

  const engagementTimeMsec =
    ctx && typeof ctx.engagementTimeMsec === "number" ? ctx.engagementTimeMsec : 100;
  appendParam(query, "_et", engagementTimeMsec);

  const url = query.length ? `${endpoint}?${query.join("&")}` : String(endpoint);
  return { url, method: "GET" };
}

/**
 * Ship the core `/g/collect` gtag-protocol connector (039-01) + Consent-Mode
 * STATE carriage (039-02) + session-state carriage (039-03, the `_ga_<stream>`
 * writer that closes OQ13-2) + Consent-Mode DEFAULTS carriage (039-05, scoped
 * to the live-grounded default-denied deployment). NOT (yet) a full
 * `contracts/connector.d.ts` `Connector` — like `map.js`'s `mapToMp`, this
 * remains the pure mapping half (config/ctx threading was chosen over growing
 * this into a capability-holding `init(caps)` Connector, see
 * `writeGa4SessionState`'s doc comment in `connectors/ga4/cookies.js` — the
 * cookie-write capability lives entirely on the HOST side, the SAME place
 * `sourceGa4Ctx`'s own `_ga` write already lives, never inside this
 * connector); a `Connector`-conforming wrapper (mirroring
 * `connectors/ga4/connector.js`'s relationship to `map.js`) remains host-
 * wiring work for a later slice.
 *
 * @param {Readonly<{
 *   measurementId: string,
 *   ctx: { clientId: string, sessionId: string|number, engagementTimeMsec?: number, consent?: Record<string, string>, consentDefault?: Record<string, string> },
 *   endpoint?: string,
 * }>} [config] `measurementId` -> `tid`; `ctx` -> `cid`/`sid`/`_et`, sourced by
 *   the host exactly as the MP path does (039-01 AC2, `sourceGa4Ctx` reuse);
 *   `ctx.consent` (039-02) -> `gcs`, the raw ADR-0007 consent vector (see
 *   `mapToGtagCollect`'s doc comment); `ctx.consentDefault` (039-05) -> gates
 *   `gcd` to the live-grounded denied-all deployment (see `isDeniedAllDefault`'s
 *   doc comment); `endpoint` defaults to `GA4_GTAG_COLLECT_ENDPOINT`.
 * @returns {{ handle(event: { type: string, params?: Record<string, unknown> }): Array<{ url: string, method: "GET" }> }}
 */
export function createGa4GtagConnector(config = {}) {
  const { measurementId, ctx = {}, endpoint = GA4_GTAG_COLLECT_ENDPOINT } = config;

  /**
   * Map one event to a single-element `EgressRequest[]` carrying ONE
   * `/g/collect` GET beacon (039-01's single-event scope — batched POST for
   * >=2 events is 039-04, deferred). The array wrapper matches the
   * `Connector.handle` contract (`contracts/connector.d.ts`) that
   * `core/connector-host.js` consumes via `for (const req of requests)`,
   * mirroring the sibling `connectors/pixel/connector.js` /
   * `connectors/ga4/connector.js` return shape.
   * @param {{ type: string, params?: Record<string, unknown>, payload?: Record<string, unknown> }} event
   * @returns {Array<{ url: string, method: "GET" }>}
   */
  function handle(event) {
    return [mapToGtagCollect(event, { measurementId, ctx, endpoint })];
  }

  return { handle };
}
