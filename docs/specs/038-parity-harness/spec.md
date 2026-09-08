---
status: DRAFT
skill:
use_cases: [UC-2]
---

<!-- jig self-defining vocabulary (soft, forward-only): expand each acronym on first use and link the term to docs/memory/glossary.md (or jig's lexicon). See docs/workflow.md "Self-defining vocabulary". -->

# Spec 038: Parity harness

> **MVP7's centrepiece ([ADR-0018](../../decisions/adr-0018-reframe-onto-adoptable-one-point-oh.md) E5).** The
> vendor-generic **parity harness** confirms that a vendor tag rewired from a tag-manager container onto airlock reaches
> the vendor boundary carrying the **same attribution-bearing fields** as the container's tag did. Parity is the
> co-equal half of the 1.0 bar (see the vision `## Use cases` — "CWV without parity is a demo; parity without CWV is a
> port"), and it is the gate every real-site rewire (MVP9) depends on. Grounded by [R-009(a)](../../research/R-009-gtag-family-fidelity.md)
> (the GA4 field-map, capture-confirmed 2026-09-07) and [ADR-0019](../../decisions/adr-0019-ga4-gtag-protocol-connector.md)
> (GA4's rewire path → a same-protocol gtag connector).

## Overview

The harness is a four-stage pipeline — **capture → replay → per-protocol semantic oracle → report** — that is
**vendor-generic in shape** and **per-protocol in its oracle**:

- **Capture** — extract the *container's* vendor beacon from a network log of the real page, and **redact** it to a
  fixture (no live identifiers — ADR-0018 R5 / ADR-0020). Each real site supplies its own redacted captures as oracle
  input.
- **Replay** — run airlock's connector for the same logical event and produce airlock's beacon.
- **Oracle (per-protocol)** — compare the two at the **vendor boundary**, on the attribution-bearing field set,
  normalising nondeterministic fields. Two shapes (ADR-0018 §"What parity means"): a **same-protocol beacon diff** where
  airlock speaks the container's protocol, and a **semantic field-map** where airlock legitimately speaks a *different*
  one.
- **Report** — pass, or a field-level diff naming exactly which attribution-bearing fields diverged.

This spec ships the **harness (the build)**, not a parity *result* — the results are produced when a real site's
redacted captures are fed through it (the MVP6-036 build/run split, reused here).

## What already exists (reuse — grounded 2026-09-08)

- **Capture front-end** — `rig/lh-r010.mjs`'s recon (built 2026-09-07) already extracts the container's live vendor
  beacons from a Lighthouse `network-requests` log (it matched Meta `fbevents.js`/`signals`, GA4 `gtag/js` + `/g/collect`,
  Google Ads `gtag/js`, Floodlight `gtag/js` + `ad.doubleclick.net/activity` on `stage.erp.intuit.com`). The harness
  reuses this to source captures; the new work is the **redaction step** + a stable fixture format.
- **airlock replay primitives** — `connectors/pixel/connector.js` `createPixelConnector(config).handle(evt)` returns
  `{ url, method: "GET" }` (the Meta/pixel beacon; `connector.js:149`); `connectors/ga4/map.js` `mapToMp(evt, ctx)`
  returns the MP body (`map.js:56-76`); `rig/generic-capture.js` `createGenericCapture({beacon})` drains descriptors to
  a beacon spy the airlock way (browser + Node).
- **The GA4 oracle seed** — R-009(a)'s `/g/collect` → airlock field-map (maps / partial / none), capture-confirmed on
  the reference page 2026-09-07.
- **NOT the oracle** — `connectors/pixel/validate.js` validates a `PixelVendorConfig`'s *shape*, not beacon *parity*
  (its own docstring: "matches the documented shape — never read it as the interpreter would have thrown"). The
  semantic beacon diff is **new**.

## The two per-protocol oracle shapes (ADR-0018)

| Shape | When airlock uses it | How it judges parity |
|---|---|---|
| **Same-protocol beacon diff** | airlock speaks the container's own protocol — Meta Pixel GET (spec 026), and GA4 once [ADR-0019](../../decisions/adr-0019-ga4-gtag-protocol-connector.md)'s gtag connector (spec 039) ships | Normalise nondeterministic fields (cache-busters, timestamps), then compare the attribution-bearing field set for **equality** |
| **Semantic field-map** | airlock legitimately speaks a *different* protocol — GA4 via the Measurement Protocol today | Map container fields → airlock fields via a per-vendor table (the R-009 field-map); classify each **maps / partial / none** and surface the gaps (session, consent) as first-class report output, never paper over them |

The oracle is **semantic, never raw URL equality** (ADR-0018 Rabbit Holes): vendor hits carry nondeterministic fields;
every per-vendor oracle normalises to the attribution-bearing set first.

## Assumptions

<!-- Spec 064-02 / ADR-0020 §1–§2 — grounding-by-probe (risk-gated). -->

- **Grounded (read/built 2026-09-08):** the capture front-end (`rig/lh-r010.mjs`), the pixel replay (`connectors/pixel/connector.js:149`),
  the MP replay (`connectors/ga4/map.js:56-76`), and the GA4 field-map seed (R-009). `rig/generic-capture.js` exposes a
  connector-agnostic drain-to-beacon primitive (header read 2026-09-08) — a replay-dispatch reuse candidate, exact fit
  to confirm at implementation.
- **Assumption (per vendor):** the *attribution-bearing field set* — which fields "count" for parity vs which are
  nondeterministic noise — is grounded per vendor from R-009 (GA4) and spec 026 (`PixelVendorConfig`), and each new
  vendor's set is confirmed on a redacted capture before its oracle is trusted. Getting this set wrong is the harness's
  central risk (a false pass hides a real attribution loss), so slice frame-critiques target it.
- **Assumption:** redaction is complete — the fixture format carries the field *vocabulary* and synthetic values only;
  no live `cid`/`tid`/pixel-id/hashed-match survives into the repo (R5 / ADR-0020). Enforced by a redaction step with a
  denylist + a test that a fixture contains no known-identifier shapes.

## Decomposition

**SPIDR — Data axis, split by vendor / oracle-shape.** The pipeline stages (capture → replay → oracle → report) are
**not** the split axis: a "capture-only" or "oracle-only" slice touches no vendor boundary and delivers no parity
verdict — horizontal phasing. Instead each slice delivers the **whole pipeline end-to-end for one oracle shape**, on the
vendor that exercises it most cheaply first (simplest data first).

- **038-01 (simplest data — same-protocol):** the vendor-generic harness core **plus** the same-protocol beacon-diff
  oracle, proven on **Meta Pixel** (spec 026's GET connector already exists, so replay is free). Fixture → replay →
  same-protocol diff → report. Delivers the harness *shape* + the first oracle.
- **038-02 (harder data — different protocol):** the **semantic field-map** oracle, on **GA4** — container `/g/collect`
  → airlock egress via the R-009 field-map, classifying maps/partial/none and surfacing the session/consent gaps. Runs
  against the MP connector now; ready to re-point at the gtag connector (spec 039) when it lands.
- **038-03 (context data — transport):** capture + report the **credential / cookie context** per cohort
  (third-party-cookies-allowed vs blocked). The harness *observes and reports* the transport-parity signal; the
  *response* (whether airlock re-attaches a credentialed transport) is the separate ADR-0018 **E10** decision this slice
  feeds, not one it makes.

## Slices

- [038-01 — vendor-generic harness core + same-protocol oracle (Meta Pixel)](slice-01-harness-core-same-protocol-meta.md)
- [038-02 — semantic field-map oracle (GA4)](slice-02-semantic-field-map-ga4.md)
- [038-03 — credential/cookie context + per-cohort report (feeds E10)](slice-03-credential-context-cohorts.md)
