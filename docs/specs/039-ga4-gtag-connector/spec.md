---
status: DONE
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

A container's GA4 tag loads `gtag.js` and emits a beacon to `/g/collect`, authed by `tid` + request origin (no
secret). **Transport is event-count-dependent (observed live 2026-09-08):** a single event goes out **GET**,
query-string encoded; **≥2 events** batched in one dispatch go out **POST** (shared params on the query string, one
`en=…` line per event in the body). This connector reproduces the **single-event GET** off-thread through the same
governed egress airlock already uses for GET pixels (spec 026, slice 039-01). The batched-POST form is **not**
reproduced here: under the 038 same-protocol oracle (a field-level semantic diff, "never raw URL equality") N GETs and
one batched POST classify identically, so batching buys no *parity* — and batch/coalesced egress is a first-class
cross-cutting performance capability the library should own at the core, not a gtag-specific detail. It is therefore
lifted out to a dedicated cross-connector egress-batching spec (see 039-04, DEFERRED, for the provenance). The MP
connector (`connectors/ga4/map.js`) stays as-is for server-side / trusted-secret contexts; this is a **sibling**, not a
replacement.

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
  (`v`/`tid`/`cid`/`sid`/`sct`/`seg`/`en`/`ep.`/`epn.`/`_et`/`dl`/`dr`/`dt`/`gcs`/`gcd`/`_fv`/`_ss`/`_nsi`), and the
  **session-state transition rules + Consent-Mode + transport re-observed live on the same reference page 2026-09-08**
  (GA4 stream on a Tealium-managed 4-vendor stack; OneTrust consent). Directly observed (see the redacted multi-page
  fixture `test/fixtures/parity-ga4-collect-multipage.redacted.json`): the `_ga_<stream>` **GS2 grammar**
  (`GS2.1.s{sid}$o{sct}$g{engaged}$t{lastHit}…`) and its transitions across first-visit / same-session continuation /
  post-30min-timeout new session; the beacon↔cookie map (`sid←s`, `sct←o`, `seg←g`; `_ss`/`_nsi` iff new session; `_fv`
  iff new client); the transport split (single→GET, batch→POST-body); and `gcs=G111` (granted state) + `gcd=13r3r3r3r5l1`
  (Consent-Mode defaults, shared across all Google tags on the page, derived from the container's declared consent
  default — not a per-event computation).
- **Untouched by design** — `connectors/ga4/map.js` (the MP body) + `contracts/ga4-mp*` (frozen surface 1). This spec
  adds a module; it does not modify or deprecate the MP path.
- **NOT reused as-is** — `connectors/ga4/consent.js` shapes the MP `consent` *object* (two data-use purposes); the gtag
  path needs Consent-Mode *encoding* — a new `gcs` state encoder (slice 02) and a separate `gcd` defaults encoder
  (slice 05).

## Assumptions

<!-- Spec 064-02 / ADR-0020 §1–§2 — grounding-by-probe (risk-gated). -->

- **The session-state update rules are OBSERVED, not inferred (2026-09-08).** The earlier draft rested these on a single
  R-009 page_view + documented behavior; they have since been **directly observed** on the reference page by driving
  `_ga_<stream>` transitions across reloads (first-visit / same-session continuation / post-30min-timeout new session —
  see `test/fixtures/parity-ga4-collect-multipage.redacted.json`). Residual (still not live-observed): the exact
  `seg`-engagement threshold (2nd-pageview vs >10s vs conversion — observed to flip 0→1 on the 2nd pageview, but the
  timing boundary is documented, not measured), and the GS2 `j`/`l`/`h` sub-fields (constant `j60`/`l0`/`h0` across all
  observations — treated as opaque, carried verbatim, not authored). A wrong engagement-timing rule mis-attributes
  *engaged-session* counts in the console; the session-boundary rule itself is now grounded.
- **`gcs` (state) is a pure vector function with both anchors observed; `gcd` (defaults) co-varies and is derived
  separately.** `gcs` = the Consent-Mode STATE string, `G1<ad_storage><analytics_storage>` (documented Consent Mode v2) —
  both anchors **live-observed** 2026-09-08 (`G111` all-granted / `G100` all-denied); slice 039-02. `gcd` was observed to
  **co-vary with consent** (`13r3r3r3r5l1` granted / `13q3q3q3q5l1` denied), so it is neither a carry-verbatim constant
  nor a pure vector function — it is derived from (declared default + resolved vector) per Consent Mode v2, with the full
  letter grammar grounded on the two anchors + documentation and confirmed on more captures before freezing; slice
  039-05. (This corrects an intermediate draft that mis-modeled `gcd` as a carried constant, itself correcting the
  original mis-citation of `gcd` as "reproduced from the R-009 capture" — R-009 recorded presence only.)
- **Cookie-write governance reuses the MP consent GATE, but the write DISCIPLINE is new.** Writing `_ga_<stream>` is
  gated on `analytics_storage` exactly as `sourceGa4Ctx`'s `_ga` write already is (017-02) — that consent seam is
  reused. But the existing `_ga` write is create-if-absent (`connectors/ga4/cookies.js:171`, `if (rawGa == null)`) and
  never updates; the `_ga_<stream>` session writer must **read-modify-write every cycle** (advance `o`/`g`/`t`, apply the
  timeout boundary). The gate is reused; the mutate-every-page discipline is genuinely new work (slice 039-03).

## Decomposition

**SPIDR — Path first, then Rules, then Data.** Each slice ships a *more-parity-complete beacon* that the 038 harness's
same-protocol oracle can verify end-to-end — never an internal-only layer.

- **039-01 (happy Path):** the **core `/g/collect` page_view beacon** — `tid`/`cid`/`en`/`dl`/`dr`/`dt`/`ep.`/`epn.`/
  `_et`, `sid` sourced from an existing `_ga_<stream>` cookie or the per-page fallback (as MP does today). No new session
  state yet. Delivers: a rewired GA4 `page_view` reaches `/g/collect` off-thread with the core attribution fields.
- **039-02 (Rules):** **Consent Mode STATE carriage (`gcs`)** — derive `gcs` from the consent vector onto the beacon
  (`G111` granted / `G100` denied, both live-observed). Delivers: the beacon carries the Consent-Mode state, closing the
  MP path's consent-state gap.
- **039-03 (Data + Rules):** **session-state reproduction + `_ga_<stream>` writer** — compute `sct`/`seg`/`_fv`/`_ss`/
  `_nsi` and **write `_ga_<stream>`** (consent-gated, read-modify-write), so sessions persist across pages. Closes
  **OQ13-2**. Delivers: session-continuity parity — the hard stateful half ADR-0019 sized.
- **039-05 (Rules):** **Consent-Mode DEFAULTS carriage (`gcd` derivation)** — derive `gcd` from (declared default +
  resolved vector); it co-varies with consent (`13r…` granted / `13q…` denied, observed), so it is neither
  carry-verbatim nor a pure vector function. Delivers: the modeling-signal half of Consent-Mode parity `gcs` doesn't
  cover.
- **039-04 (Rules) — DEFERRED:** batched POST transport / per-cycle coalescing. Lifted out to a dedicated cross-connector
  egress-batching spec: under the 038 field-level oracle it buys no verifiable *parity*, and batching is a core
  cross-cutting perf capability, not a gtag detail. Parked for provenance.

## Slices

- [039-01 — core /g/collect page_view beacon](slice-01-core-collect-beacon.md)
- [039-02 — Consent Mode state carriage (gcs)](slice-02-consent-mode.md)
- [039-03 — session-state + _ga_<stream> writer (closes OQ13-2)](slice-03-session-state-writer.md)
- [039-05 — Consent-Mode defaults carriage (gcd derivation)](slice-05-consent-defaults-gcd.md)
- [039-04 — batched POST transport (per-cycle coalescing) — DEFERRED → cross-connector egress-batching spec](slice-04-batched-post-transport.md)
