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
> (GA4's rewire path → a same-protocol gtag connector). The **parity contract this harness enforces** — beacon-field
> parity, per-field gap ownership, drift-as-regression-guard, hard gaps owner-re-decided — is
> [ADR-0020](../../decisions/adr-0020-parity-contract-anti-drift.md).

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

- **Capture front-end** — `rig/lh-r010.mjs`'s recon (built 2026-09-07) extracts vendor requests from a Lighthouse
  `network-requests` log. Its default pattern set targets **runtime loaders** for CWV-blocking (matched Meta
  `fbevents.js`, GA4/Ads/Floodlight `gtag/js`) and **some beacons** (GA4 `/g/collect`, Floodlight
  `ad.doubleclick.net/activity`) — but **not Meta's `/tr` beacon** (`www.facebook.com/tr`), which the harness must add
  (grounded correction 2026-09-08). The harness reuses this to source captures; the new work is **beacon-endpoint
  patterns** + a **redaction step** + a stable fixture format (real captures stay local — R5 / ADR-0020).
- **airlock replay primitives** — `connectors/pixel/connector.js` `createPixelConnector(config).handle(evt)` returns
  **`[{ url, method: "GET" }]`** (an **array** — zero-or-one; `[]` for an unmapped event; `connector.js:149`) to the Meta
  `/tr` beacon (`connectors/pixel/vendors/meta.js`). **airlock's Meta connector is identity-free by construction** — it
  projects `id`/`ev` + non-PII standard params only and **deliberately omits `_fbp`/`fbc` (first-party cookie identity)
  and `ud[...]` (advanced-matching, which browser `fbevents.js` sends on the *GET* query string)** (`meta.js:10-14`) — so
  the oracle's *expected* result on a real Meta capture is a **dropped-identity gap** (closed by 026-04 + the
  first-party-cookie follow-up), not a green pass. `connectors/ga4/map.js` `mapToMp(evt, ctx)` returns the MP body
  (`map.js:56-76`); `rig/generic-capture.js` `createGenericCapture({beacon})` drains descriptors to a beacon spy.
- **The GA4 oracle seed** — R-009(a)'s `/g/collect` → airlock field-map (maps / partial / none), capture-confirmed on
  the reference page 2026-09-07.
- **NOT the oracle** — `connectors/pixel/validate.js` validates a `PixelVendorConfig`'s *shape*, not beacon *parity*
  (its own docstring: "matches the documented shape — never read it as the interpreter would have thrown"). The
  semantic beacon diff is **new**.

## The oracle: one classified-diff engine, two descriptor kinds (ADR-0018)

The oracle is **never raw URL equality** (ADR-0018 Rabbit Holes). It is a **classified diff** over the *container's*
attribution-bearing field set — every field lands in one of three buckets, and a **`pass` means no attribution-bearing
field is dropped or divergent**:

- **maps** — the container field is present in airlock's beacon and equal after normalisation.
- **normalised-out** — a nondeterministic field (cache-buster, timestamp, hit-sequence, ordering) excluded before the
  compare.
- **dropped / none** — an **attribution-bearing field the container sends that airlock does not emit**. This is the
  category a naive equality diff misses, and it is **first-class**: reported, never silently excluded (which would be a
  false pass) and never collapsed into an unreachable always-diff.

Two **descriptor kinds** feed the one engine (a *frame-critique correction*, 2026-09-08 — the earlier draft split these
into two different oracles and mis-modelled the same-protocol case as pure equality):

| Descriptor | When | Shape |
|---|---|---|
| **Same-protocol** | airlock speaks the container's own protocol — Meta Pixel `/tr` GET (026); GA4 once the gtag connector (039) ships | field names match 1:1 (an identity translation); compare values **and** classify container fields airlock omits as **dropped** |
| **Semantic field-map** | airlock legitimately speaks a *different* protocol — GA4 via the Measurement Protocol today | a per-vendor translation table (the R-009 map) resolves container field → airlock field, then the same three-bucket classification |

The same-protocol descriptor is just the field-map's **identity-translation special case** — so 038-01 builds the engine
+ the classification, and 038-02 adds a translation table to the *same* engine. **Grounding the reference set:** the
attribution-bearing set is the *container's* (from a redacted capture + the vendor's documented params), **not** airlock's
connector — grounding it in the artifact under test would blind the oracle to exactly the fields airlock drops.

## Assumptions

<!-- Spec 064-02 / ADR-0020 §1–§2 — grounding-by-probe (risk-gated). -->

- **Grounded (read/built 2026-09-08):** the capture front-end (`rig/lh-r010.mjs`), the pixel replay (`connectors/pixel/connector.js:149`),
  the MP replay (`connectors/ga4/map.js:56-76`), and the GA4 field-map seed (R-009). `rig/generic-capture.js` exposes a
  connector-agnostic drain-to-beacon primitive (header read 2026-09-08) — a replay-dispatch reuse candidate, exact fit
  to confirm at implementation.
- **Assumption (per vendor):** the *attribution-bearing field set* is the **container's** — grounded from a redacted
  capture of the container's beacon **plus the vendor's documented params** (Meta: `id`/`ev`/`_fbp`/`fbc`/`ud[...]` +
  event data; GA4: R-009's map), **never** from airlock's own connector (that would blind the oracle to exactly the
  fields airlock drops — the frame-critique's central correction, 2026-09-08). Each container field is classified
  **maps / normalised-out / dropped**; getting the set or a classification wrong is the harness's central risk (a false
  pass hides a real attribution loss), so slice frame-critiques target it.
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
