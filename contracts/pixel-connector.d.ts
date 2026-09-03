/**
 * PixelVendorConfig — the config contract for `createPixelConnector`
 * (spec 026-03, the Rules axis that closes the "one connector + N configs"
 * archetype 026-01/026-02 proved).
 *
 * DESCRIPTIVE of the SHIPPED interpreter — `connectors/pixel/connector.js`'s
 * `createPixelConnector(config)` (its config destructure, connector.js:74-82;
 * its `handle()` interpretation of `paramMap`/`eventMap`, connector.js:125-149)
 * — grounded field-by-field against that source, NOT an invented DSL or an
 * aspirational shape. Every field below documents something the interpreter
 * ALREADY reads today; adding a field here without a matching interpreter
 * read would be a contract drift, not a description.
 *
 * Wire method is always **GET** — `handle()` unconditionally returns
 * `{ url, method: "GET" }` and never sets `body` (connector.js:146-149).
 * There is no POST/JSON-body vocabulary in this type.
 *
 * VALIDATION: see `connectors/pixel/validate.js`'s `validatePixelVendorConfig`
 * for a runtime guard against this shape. That guard is DELIBERATELY
 * STRICTER than the interpreter (which fails soft on a malformed config,
 * see connector.js:143,146) — it exists to catch a config author's mistake
 * at authoring time, not to describe runtime tolerance. Do not read this
 * type's field requirements ("required") as "the interpreter throws
 * otherwise" — it usually does not; see each field's own doc comment.
 *
 * COVERAGE BOUND (AC6 — R-007 / ADR-0014 coverage-honesty discipline): this
 * type covers **GET wire-protocol pixels only** — the archetype 026-01/026-02
 * proved end-to-end against three real vendors (Meta Pixel, LinkedIn Insight,
 * Bing UET). Two axes are explicitly OUT OF SCOPE here, deferred to
 * **026-04** (real-driver-gated — not built speculatively, per spec 026's
 * "Of the config triple..." decomposition):
 *   - **Identity / advanced-matching** — hashed email/phone (`ud[...]`-style
 *     fields) and first-party cookie identity (`_fbp`/`fbc`, `_uetsid`/
 *     `_uetvid`, `li_fat_id`). This connector was DELIBERATELY designed
 *     without that surface (the AC8 identity-free invariant both 026-01 and
 *     026-02 reviews praised) — it needs in-chamber hashing, a per-field
 *     consent class, and a new governance path, none of which this type
 *     pins.
 *   - **POST / a JSON request body.** No real POST pixel motivated it as of
 *     026-02; `ctx`-body access is a security-relevant surface this
 *     connector structurally lacks today (it never reads `ctx`).
 * A `PixelVendorConfig` therefore describes a SUBSET of martech — config-
 * shaped wire-protocol GET pixels — not "everything a tag could need."
 */

import type { ConsentPurpose } from "./connector";
import type { CapabilityRequest } from "./capability";

/**
 * One `paramMap` entry: WHERE an output query-parameter's value comes from
 * (connector.js:136-144's `handle()` switch, described verbatim):
 *
 *  - `{ from: "static", value }` — a fixed literal, e.g. a vendor's pixel/
 *    partner/tag id under whatever query key that vendor uses (Meta's `id`,
 *    LinkedIn's `pid`, Bing's `ti`), or a fixed protocol literal (LinkedIn's
 *    `fmt: "gif"`). `value` is typed `string | number` here as a useful
 *    authoring contract: every shipped config's static value is a **string**
 *    (Meta `id`, LinkedIn `pid`/`fmt`, Bing `ti`); `number` is supported (the
 *    interpreter `String()`s it, connector.js:143) but not currently used by
 *    any shipped config. This narrowing is stricter than BOTH the interpreter
 *    (which `String()`s any scalar) AND — until 026-03's review hardening —
 *    the validator; `validatePixelVendorConfig` now enforces it (rejects a
 *    static value that is neither string nor number).
 *  - `{ from: "event" }` — the VENDOR event name this config's `eventMap`
 *    produced for `event.type` (Meta's `ev`, Bing's `evt`, LinkedIn's
 *    `conversionId`). That mapped value may itself be `null` (see
 *    `PixelVendorConfig["eventMap"]`'s doc below) — in which case this
 *    entry's output key is OMITTED, never sent as the literal string
 *    `"null"` (connector.js:142).
 *  - `{ from: "params", key }` — `event.params[key]` (or
 *    `event.payload[key]` for the contract-shaped `AirlockEvent` form —
 *    mirrors `connectors/ga4/connector.js`'s same `params || payload`
 *    bridge), included ONLY when that source value is present
 *    (`undefined`/`null` -> omitted, never an empty-string query param,
 *    connector.js:142).
 *
 * A `paramMap` key NOT listed here can never reach the query string, no
 * matter what `event.params` carries — the connector serializes only what
 * the declarative config projects (spec 026 AC8's "only governed
 * `event.params`" half; the OTHER half — that `event.params` itself is
 * already governance-stripped of denylisted PII before this connector ever
 * sees it — is `core/airlock.js`'s job, ADR-0012, not this type's).
 */
export type PixelParamSpec =
  | { readonly from: "static"; readonly value: string | number }
  | { readonly from: "event" }
  | { readonly from: "params"; readonly key: string };

/**
 * The declarative pixel-vendor config `createPixelConnector` interprets
 * (connector.js:74-82's destructure). Every field is DATA the interpreter
 * reads; see the module doc comment above for the honest coverage bound.
 */
export interface PixelVendorConfig {
  /**
   * Registry/manifest name (`manifest.name`, e.g. `"airlock/pixel/meta"`).
   * Optional — the interpreter defaults to `"airlock/pixel"` when omitted
   * (connector.js:75).
   */
  readonly name?: string;

  /**
   * The vendor's GET beacon endpoint, e.g.
   * `"https://www.facebook.com/tr"`. Marked REQUIRED here because a config
   * without a real endpoint cannot do its one job — but note the
   * interpreter itself fails SOFT on a missing/empty `endpoint`: it still
   * builds a URL via `String(endpoint)` (connector.js:146), which for
   * `undefined` literally produces the string `"undefined"` as the request
   * URL rather than throwing. `validatePixelVendorConfig` rejects that case
   * explicitly, as an authoring-time mistake the interpreter itself will
   * not catch.
   */
  readonly endpoint: string;

  /**
   * Site event type -> vendor event name. **Value is `string | null`** —
   * the sharpest 026-02 finding (connector.js:128,140,142). Most vendors
   * map to a `string` vendor-event name (Meta's `page_view -> "PageView"`,
   * Bing's `page_view -> "pageLoad"`). A vendor whose base tag carries NO
   * event-name key at all (LinkedIn Insight's base pixel) instead maps a
   * key to `null` (`{ page_view: null }`).
   *
   * The **`null`-omits idiom is FIRST-CLASS, not an edge case**: the key
   * must still be PRESENT — so `handle()`'s `hasOwnProperty` routing check
   * (connector.js:127) still matches and a beacon still fires — but its
   * `{ from: "event" }` `paramMap` projection is OMITTED from the query
   * string rather than sent as the literal string `"null"`
   * (connector.js:142). This is DIFFERENT from an event type absent from
   * `eventMap` entirely (not even a `null`-valued key present) — that maps
   * to ZERO requests, never a throw and never a partial/garbled beacon
   * (connector.js:127).
   */
  readonly eventMap: Record<string, string | null>;

  /**
   * Output query-parameter name -> where its value is sourced from. See
   * `PixelParamSpec`. A key absent from `paramMap` can never reach the URL,
   * no matter what `event.params`/`event.payload` carries.
   */
  readonly paramMap: Record<string, PixelParamSpec>;

  /**
   * Consent purpose(s) this vendor's egress serves (ADR-0007), fed into
   * `manifest.purposes.egress` / `.endpoints` (connector.js:102-105).
   * DECLARED, NOT ENFORCED (mirrors `ConnectorManifest.purposes` in
   * ./connector — disclosure only; the grant resolver is MVP3). Every
   * shipped pixel config uses `["ad_storage"]` — an ads/remarketing signal,
   * per the Consent Mode v2 taxonomy. Optional — the interpreter defaults
   * to `[]` when omitted.
   */
  readonly egressPurposes?: readonly ConsentPurpose[];

  /**
   * The declared/advisory endpoint set (`manifest.endpoints`,
   * connector.js:89-94) — ADR-0006: the host allow-list at
   * `core/airlock.js`'s endpoint ceiling is authoritative regardless of
   * what a connector declares here. Optional — defaults to `[endpoint]`
   * when omitted (or absent/empty), the common single-destination case
   * every shipped vendor config in this slice uses.
   */
  readonly endpoints?: readonly string[];

  /**
   * Additional manifest capability requests, merged with the always-on
   * `{ egress: true }` this connector requests unconditionally
   * (connector.js:100). Optional. No shipped pixel config requests
   * `cookies` — identity-honest by construction (AC9 structural half); a
   * future cookie-identity follow-up (out of this type's coverage bound)
   * would add it here.
   */
  readonly capabilities?: CapabilityRequest;
}
