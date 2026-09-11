/**
 * The Meta Pixel per-vendor parity descriptor — spec 038-01 AC7 ("the Meta specifics ... live in
 * a per-vendor descriptor, not the pipeline"). Every Meta-specific fact the oracle needs is DATA
 * here; `rig/parity/oracle.js` reads it through the generic `ParityDescriptor` shape and has no
 * Meta-specific code at all (proven independently in test/parity-oracle.test.js by a second,
 * unrelated descriptor through the same `diffParity`).
 *
 * The reference field set is the CONTAINER's (documented Meta `/tr` params — `id`/`ev`, the
 * `cd[...]` event-data namespace, `_fbp`/`fbc`, `ud[...]`), never airlock's own `meta.js` config —
 * grounding it in the artifact under test would blind the oracle to exactly the fields airlock
 * drops (spec 038 § "The oracle", the frame-critique's central correction).
 *
 * THE cd[...] WIRE-FIDELITY GAP — RESOLVED (spec 026-06, closes docs/inbox.md:27): Meta's
 * documented `/tr` wire form namespaces event data under `cd[...]` (`cd[value]`, `cd[currency]`,
 * `cd[content_name]`, `cd[content_category]`); `connectors/pixel/vendors/meta.js` used to emit
 * the BARE names (`value`, `currency`, …) instead, recorded here as an OWNED gap-map entry
 * ("026 wire-fidelity", green, `expected-dropped`) rather than a `wireNameMap` reconciliation —
 * mapping a spelling the vendor might never ingest would have been a false pass (ADR-0020's
 * false-shim prohibition). A real Meta `/tr` capture
 * (test/fixtures/meta-tr-pageview.redacted.json, `cd[region]=us`) since confirmed Meta's endpoint
 * DOES require the `cd[...]` namespace, so 026-06 fixed `meta.js` to emit it directly — these four
 * fields are no longer gap-map members (removed, not just flagged `gap-closed`) and now classify
 * as a real `maps` match against this descriptor's `attributionFields` below.
 */
import { createMetaPixelConfig, META_TR_ENDPOINT } from "../../../connectors/pixel/vendors/meta.js";

// The reverse of meta.js's OWN eventMap (site event -> Meta event name), so the capture ->
// logical-event derivation below can never drift out of sync with the shipped connector config.
const { eventMap } = createMetaPixelConfig();
const REVERSE_EVENT_MAP = Object.fromEntries(Object.entries(eventMap).map(([site, vendor]) => [vendor, site]));

/** @type {import("../oracle").ParityDescriptor} */
export const metaParityDescriptor = {
  vendor: "meta",
  protocol: "same-protocol",
  endpoint: META_TR_ENDPOINT,

  // The container's CURATED, documented Meta /tr attribution-bearing field set — id/ev (routing
  // + attribution), the four documented cd[...] event-data params, first-party cookie identity
  // (_fbp/fbc), and hashed advanced-matching (ud[...]). NOT every wire field fbevents.js could
  // ever send — deliberately curated (spec 038-01 AC3).
  attributionFields: [
    "id",
    "ev",
    "cd[value]",
    "cd[currency]",
    "cd[content_name]",
    "cd[content_category]",
    "_fbp",
    "fbc",
    "ud[em]",
    "ud[ph]",
  ],

  // Nondeterministic + deterministic-non-attribution — excluded before the compare (AC3's literal
  // denylist: cache-buster, timestamp, rdp, v, dl). Query-param ORDERING needs no listed field —
  // the oracle diffs parsed field-sets, never raw query strings (rig/parity/oracle.js's header).
  normaliseDenylist: ["rdp", "v", "dl", "ts", "cb"],

  // The same-protocol descriptor's MINIMAL wire-name table (spec 038 "two descriptor kinds") —
  // empty for Meta. id/ev/_fbp/fbc/ud[...] are already 1:1 by name; the cd[...] namespace is ALSO
  // 1:1 by name now that meta.js emits it directly (spec 026-06) — no translation needed either
  // way (identity, not a gap-map member — see the module doc comment above).
  wireNameMap: {},

  // ADR-0020 commitment 1 — every dropped attribution field owned by a named closing artifact.
  // The four cd[...] fields (value/currency/content_name/content_category) were REMOVED from here
  // by spec 026-06 (closes docs/inbox.md:27) — meta.js now emits them directly, so they classify
  // as a real `maps` match, not an owned gap.
  gapMap: {
    _fbp: { owner: "chamber cookie-capability follow-up" },
    fbc: { owner: "chamber cookie-capability follow-up" },
    "ud[em]": { owner: "026-04" },
    "ud[ph]": { owner: "026-04" },
  },

  // spec 038-03's transport declaration (feeds ADR-0018 E10, ADR-0020 commitment 3): Meta's
  // THIRD-PARTY cross-site cookie (`fr`, set on facebook.com — opaque to page JS, absent from the
  // beacon URL, owner E10) and its FIRST-PARTY identity fields (`_fbp`/`fbc`, publisher-origin
  // cookies fbevents.js sets). Owner for the first-party fields is deliberately NOT declared here —
  // rig/parity/transport-report.js reads it from THIS descriptor's own `gapMap` above, so the two
  // can never drift apart.
  transport: {
    crossSiteCookies: [{ cookie: "fr", owner: "E10" }],
    firstPartyIdentity: ["_fbp", "fbc"],
  },

  /**
   * Capture -> logical-event derivation (AC2/AC7): reconstructs the airlock-shaped
   * `{type, params}` `createPixelConnector(...).handle()` consumes FROM a captured container
   * beacon's fields — i.e. `event.params`' bare source keys (`value`/`currency`/…), which
   * `meta.js`'s `paramMap` then re-projects onto its `cd[...]` OUTPUT keys (spec 026-06). A
   * REPLAY-INPUT convenience only, independent of the oracle's own diff (`wireNameMap`/`gapMap`
   * above); it only answers "which event should be replayed", using the reverse of meta.js's own
   * `eventMap` so the two can never silently drift apart.
   * @param {Readonly<Record<string,string>>} containerFields
   * @returns {{ type: string|null, params: Record<string,string> }}
   */
  deriveLogicalEvent(containerFields) {
    const type = REVERSE_EVENT_MAP[containerFields.ev] ?? null;
    const params = {};
    if (containerFields["cd[value]"] !== undefined) params.value = containerFields["cd[value]"];
    if (containerFields["cd[currency]"] !== undefined) params.currency = containerFields["cd[currency]"];
    if (containerFields["cd[content_name]"] !== undefined) params.content_name = containerFields["cd[content_name]"];
    if (containerFields["cd[content_category]"] !== undefined) {
      params.content_category = containerFields["cd[content_category]"];
    }
    return { type, params };
  },
};
