/**
 * The credential/cookie TRANSPORT-parity ledger — spec 038-03, feeding ADR-0018 E10 (ADR-0020
 * commitments 1 + 3). NOT a `diffParity` extension: the cross-site cookie is not a beacon field —
 * it rides the browser's credentialed request, opaque to page JS, absent from the beacon URL — so
 * this is a REPORT GENERATOR over each vendor descriptor's declarative `transport` field
 * (rig/parity/oracle.js's `ParityDescriptor` typedef), never a diff against a captured fixture.
 *
 * Two gap classes, TWO distinct owners (the frame-critique's keystone correction —
 * docs/specs/038-parity-harness/reviews/slice-03-frame-critique.md):
 *
 *  - **cross-site cookie** (Meta `fr`, DoubleClick `IDE`) — a THIRD-PARTY cookie on the VENDOR's
 *    own origin. airlock's egress carries no cookies at all (`core/egress.js`'s `fetchInit` sets
 *    only `method`/`body`/`keepalive` — no `credentials`/`mode`), so this is a gap wherever the
 *    container's request would have carried it — the 3p-cookies-**allowed** cohort only. On
 *    **blocked**, the browser drops the cookie from the container's own request too, so there is
 *    nothing for airlock to diverge from — no gap there. Owner: **E10**, read directly off the
 *    descriptor's `transport.crossSiteCookies` entry (a security-boundary decision, never derived
 *    from the gap map).
 *  - **first-party identity** (Meta `_fbp`/`fbc`; GA4 `cid`) — a FIRST-PARTY cookie on the
 *    PUBLISHER's own origin, so it survives third-party-cookie blocking and is the container's
 *    cookieless fallback on BOTH cohorts. Whether airlock itself emits it is READ from the
 *    descriptor's own `gapMap` (grounded, never re-declared here): a field IN the gap map is a gap
 *    airlock has not closed yet, on BOTH cohorts — the blocked-cohort correction (never "no gap" by
 *    default just because the cross-site cookie is already absent there); a field NOT in the gap
 *    map is one airlock already emits (GA4's `cid`, from `_ga`) — gap-free.
 *
 * Descriptor input contract: every descriptor passed in MUST carry a `transport` declaration; a
 * descriptor with none throws rather than silently reporting a false gap-free cell (never a false
 * green).
 */

const CROSS_SITE_CLASS = "cross-site-cookie";
const FIRST_PARTY_CLASS = "first-party-identity";
const COHORTS = /** @type {const} */ (["allowed", "blocked"]);

const QUESTION =
  "For each vendor and cohort (third-party-cookies-allowed vs blocked), which attribution " +
  "transport does airlock drop today, and who owns closing it?";

const NOTE =
  "Transport-parity only (ADR-0020 commitment 3 / ADR-0018 E10) — this ledger does not gate a " +
  "pass/fail verdict the way rig/parity/report.js's beacon-field parity does; it is the INPUT an " +
  "E10 author reads to decide whether to re-attach a purpose-gated credentialed cross-site " +
  "transport. The cross-site cookie is DOCUMENTED, not live-observed — it is opaque to page JS and " +
  "absent from the beacon URL (a future, R5-gated CDP-level enhancement could confirm a specific " +
  "request carried it). No live identifiers anywhere in this report: every name below is a " +
  "vendor-documented cookie/field NAME, never a captured VALUE.";

/** @param {string} cookie */
function crossSiteConsequence(cookie) {
  return (
    "airlock's egress carries no cross-site cookies (core/egress.js's fetchInit sets only " +
    `method/body/keepalive — no credentials/mode), so \`${cookie}\` never reaches the vendor from ` +
    "airlock on this cohort, even though the container's credentialed request would carry it."
  );
}

/** @param {string} field */
function firstPartyConsequence(field) {
  return (
    `airlock does not emit \`${field}\` on its beacon today (see the descriptor's gapMap), so it ` +
    "is dropped on this cohort even though the container's first-party fallback would carry it."
  );
}

/**
 * @typedef {Object} TransportGap
 * @property {"cross-site-cookie"|"first-party-identity"} class
 * @property {string} name - the cookie or field name (never a value — R5).
 * @property {string} owner
 * @property {string} consequence
 *
 * @typedef {Object} CohortCell
 * @property {TransportGap[]} gaps
 * @property {boolean} gapFree
 *
 * @typedef {Object} VendorTransportRow
 * @property {string} vendor
 * @property {{ allowed: CohortCell, blocked: CohortCell }} cohorts
 */

/**
 * One vendor's per-cohort gap classification (AC2/AC3), reasoned entirely off the descriptor's own
 * `transport` declaration + `gapMap` — no captures, no fixtures, no I/O.
 * @param {import("./oracle").ParityDescriptor} descriptor
 * @returns {VendorTransportRow}
 */
function buildVendorRow(descriptor) {
  const transport = descriptor.transport;
  if (!transport) {
    throw new Error(
      `transport-report: descriptor "${descriptor.vendor}" declares no \`transport\` field (spec ` +
        "038-03 AC1) — refusing to report a silent gap-free false-green.",
    );
  }
  const gapMap = descriptor.gapMap || {};
  const attributionFields = descriptor.attributionFields || [];
  const crossSiteCookies = transport.crossSiteCookies || [];
  const firstPartyIdentity = transport.firstPartyIdentity || [];

  // Completeness guard (arch-review 2026-09-08): the "not in gapMap -> airlock already emits it ->
  // gap-free" inference below is sound ONLY because diffParity independently gates every first-party
  // field — and it gates a field only when the field is in `attributionFields` (oracle.js iterates
  // that set alone). A first-party field OUTSIDE attributionFields would be invisible to BOTH
  // surfaces: absent from the gap map here it reads gap-free, yet diffParity never checks it either,
  // so a real drop would false-green on every cohort. Fail loud rather than let a future descriptor
  // introduce that blind spot (both shipped descriptors already satisfy it: Meta _fbp/fbc, GA4 cid).
  for (const field of firstPartyIdentity) {
    if (!attributionFields.includes(field)) {
      throw new Error(
        `transport-report: descriptor "${descriptor.vendor}" lists first-party identity "${field}" ` +
          "in transport.firstPartyIdentity but not in attributionFields — the \"absent from gapMap " +
          "=> gap-free\" inference is only sound when diffParity also gates the field (its drop shows " +
          "as `dropped`). Add it to attributionFields (and gapMap, if airlock doesn't emit it yet).",
      );
    }
  }

  /** @type {TransportGap[]} */
  const allowedGaps = [];
  /** @type {TransportGap[]} */
  const blockedGaps = [];

  for (const { cookie, owner } of crossSiteCookies) {
    // ALLOWED only — on blocked, the browser drops this cookie from the container's OWN request
    // too, so airlock's absence of it is not a divergence there (AC2).
    allowedGaps.push({ class: CROSS_SITE_CLASS, name: cookie, owner, consequence: crossSiteConsequence(cookie) });
  }

  for (const field of firstPartyIdentity) {
    const gap = gapMap[field];
    if (!gap) continue; // NOT in the gap map -> airlock already emits this field -> no gap, either cohort
    // IN the gap map -> a gap on BOTH cohorts — the blocked-cohort correction (AC2/AC3): the
    // container's cookieless fallback carries it there too, and airlock still doesn't emit it.
    const consequence = firstPartyConsequence(field);
    allowedGaps.push({ class: FIRST_PARTY_CLASS, name: field, owner: gap.owner, consequence });
    blockedGaps.push({ class: FIRST_PARTY_CLASS, name: field, owner: gap.owner, consequence });
  }

  // Build each cohort cell from the single COHORTS list (craft-review 2026-09-08) so this producer
  // and the renderer's `for (const c of COHORTS)` can't drift to different key sets, and `gapFree`
  // is computed here exactly once (the cell's single source of truth).
  const gapsByCohort = { allowed: allowedGaps, blocked: blockedGaps };
  const cohorts = /** @type {{ allowed: CohortCell, blocked: CohortCell }} */ ({});
  for (const cohortName of COHORTS) {
    const gaps = gapsByCohort[cohortName];
    cohorts[cohortName] = { gaps, gapFree: gaps.length === 0 };
  }
  return { vendor: descriptor.vendor, cohorts };
}

/**
 * The per-vendor x per-cohort transport ledger (spec 038-03 AC2/AC3/AC4) — the E10 input.
 * @param {Object} args
 * @param {readonly import("./oracle").ParityDescriptor[]} args.descriptors
 * @returns {{ question: string, vendors: VendorTransportRow[], note: string }}
 */
export function buildTransportLedger({ descriptors }) {
  return { question: QUESTION, vendors: descriptors.map(buildVendorRow), note: NOTE };
}

/**
 * A readable Markdown table over the ledger (AC4 — "an E10 author reads"). One row per
 * vendor x cohort x gap, or a single "gap-free" row when a cohort carries none (so GA4's
 * gap-free contrast is visible, not just absent).
 * @param {ReturnType<typeof buildTransportLedger>} ledger
 * @returns {string}
 */
export function renderTransportMarkdown(ledger) {
  const lines = [
    "# Transport-parity ledger (feeds ADR-0018 E10)",
    "",
    ledger.question,
    "",
    "| Vendor | Cohort | Gap class | Name | Owner | Consequence |",
    "|---|---|---|---|---|---|",
  ];
  for (const vendor of ledger.vendors) {
    for (const cohortName of COHORTS) {
      const cell = vendor.cohorts[cohortName];
      if (cell.gapFree) {
        lines.push(
          `| ${vendor.vendor} | ${cohortName} | — | — | — | gap-free — airlock emits every ` +
            "attribution transport the container uses on this cohort |",
        );
        continue;
      }
      for (const gap of cell.gaps) {
        lines.push(`| ${vendor.vendor} | ${cohortName} | ${gap.class} | ${gap.name} | ${gap.owner} | ${gap.consequence} |`);
      }
    }
  }
  lines.push("", ledger.note);
  return lines.join("\n");
}
