---
status: DRAFT
skill:
use_cases: [UC-2]
---

<!-- jig self-defining vocabulary (soft, forward-only): expand each acronym on first use and link the term to docs/memory/glossary.md (or jig's lexicon). See docs/workflow.md "Self-defining vocabulary". -->

# Spec 039: GA4 gtag-protocol connector

> **Implements [ADR-0019](../../decisions/adr-0019-ga4-gtag-protocol-connector.md) (Accepted).** The GA4 rewire/parity
> path is an **additive, off-thread `/g/collect` gtag-protocol connector** — airlock speaks the container's *own*
> protocol, so GA4 parity becomes a **same-protocol beacon diff** (the strongest oracle) rather than the lossy
> Measurement-Protocol field-map. It needs **no `api_secret`** (`tid` + origin, like the container), and — decisively —
> it leaves the **frozen MP connector (surface 1, ADR-0017) untouched**, so it is purely additive: no stable-core break.
> Verified by the [038 parity harness](../038-parity-harness/spec.md)'s same-protocol oracle.

## Overview

A container's GA4 tag loads `gtag.js` and emits a **GET** beacon to `/g/collect`, query-string encoded, authed by
`tid` + request origin (no secret). This connector reproduces that beacon **off-thread**, through the same governed
egress airlock already uses for GET pixels (spec 026). The MP connector (`connectors/ga4/map.js`) stays as-is for
server-side / trusted-secret contexts; this is a **sibling**, not a replacement.

**This is a *stateful* connector, not a GET-beacon config (ADR-0019).** The event fields map trivially, but a
container's `/g/collect` beacon also carries **session state** (`sid`/`sct`/`seg`/`_fv`/`_ss`/`_nsi`) and **Consent
Mode** (`gcs`/`gcd`) that `gtag.js` computes from a stateful on-page runtime and the `_ga_<stream>` cookie it maintains.
Reaching parity means reproducing that computation and **becoming the `_ga_<stream>` session writer** — the real work
ADR-0019's kill-criterion #1 and open questions flagged, and the reason this is its own spec, not a line in 026.

## What already exists (reuse — grounded 2026-09-08)

- **Identity sourcing** — `connectors/ga4/cookies.js`: `parseGaClientId` / `parseGaSessionId` / `findGaStreamCookie` /
  `sourceGa4Ctx` (`cookies.js:36,53,79,146`) already read `_ga` / `_ga_<stream>` (consent-gated, 017-02). The gtag
  connector reuses these for `cid`/`sid` and **extends** them into the session *writer* (slice 03).
- **Off-thread GET egress** — the pixel connector proves governed GET-beacon dispatch from the worker
  (`connectors/pixel/connector.js:149` → `{ url, method: "GET" }`; `core/airlock.js` egress).
- **The target wire shape** — R-009(a)'s `/g/collect` field-map, **capture-confirmed on the reference page 2026-09-07**
  (`v`/`tid`/`cid`/`sid`/`sct`/`seg`/`en`/`ep.`/`epn.`/`_et`/`dl`/`dr`/`dt`/`gcs`/`gcd`/`_fv`/`_ss`/`_nsi`).
- **Untouched by design** — `connectors/ga4/map.js` (the MP body) + `contracts/ga4-mp*` (frozen surface 1). This spec
  adds a module; it does not modify or deprecate the MP path.
- **NOT reused as-is** — `connectors/ga4/consent.js` shapes the MP `consent` *object* (two data-use purposes); the gtag
  path needs `gcs`/`gcd` Consent-Mode *encoding* (a new encoder, slice 02).

## Assumptions

<!-- Spec 064-02 / ADR-0020 §1–§2 — grounding-by-probe (risk-gated). -->

- **The `/g/collect` wire shape is capture-confirmed, not fully documented.** R-009(a) confirmed the `page_view` field
  set on one real capture; the exact encoding of the session-state fields (`sct`/`seg`/`_fv`/`_ss`/`_nsi`) and their
  update rules across pages are inferred from that capture + documented gtag behavior, and are **confirmed per event
  type on a redacted capture** before the connector's shape is frozen. This is the connector's central risk (a wrong
  session-state rule yields a beacon that diffs clean but mis-attributes in the console).
- **`gcs`/`gcd` encoding** — the Consent-Mode state string (`G111`) and defaults string are reproduced from the consent
  vector; the exact digit semantics are grounded on the capture + documented Consent Mode v2.
- **Cookie-write governance mirrors the MP identity path** — writing `_ga_<stream>` is gated on `analytics_storage`
  exactly as `sourceGa4Ctx`'s `_ga` write already is (017-02), reusing that seam rather than inventing a new one.

## Decomposition

**SPIDR — Path first, then Rules, then Data.** Each slice ships a *more-parity-complete beacon* that the 038 harness's
same-protocol oracle can verify end-to-end — never an internal-only layer.

- **039-01 (happy Path):** the **core `/g/collect` page_view beacon** — `tid`/`cid`/`en`/`dl`/`dr`/`dt`/`ep.`/`epn.`/
  `_et`, `sid` sourced from an existing `_ga_<stream>` cookie or the per-page fallback (as MP does today). No new session
  state yet. Delivers: a rewired GA4 `page_view` reaches `/g/collect` off-thread with the core attribution fields.
- **039-02 (Rules):** **Consent Mode carriage** — encode `gcs`/`gcd` from the consent vector onto the beacon. Delivers:
  the beacon carries Consent-Mode state, closing the MP path's consent gap.
- **039-03 (Data + Rules):** **session-state reproduction + `_ga_<stream>` writer** — compute `sct`/`seg`/`_fv`/`_ss`/
  `_nsi` and **write `_ga_<stream>`** (consent-gated), so sessions persist across pages. Closes **OQ13-2**. Delivers:
  session-continuity parity — the hard stateful half ADR-0019 sized.

## Slices

- [039-01 — core /g/collect page_view beacon](slice-01-core-collect-beacon.md)
- [039-02 — Consent Mode carriage (gcs/gcd)](slice-02-consent-mode.md)
- [039-03 — session-state + _ga_<stream> writer (closes OQ13-2)](slice-03-session-state-writer.md)
