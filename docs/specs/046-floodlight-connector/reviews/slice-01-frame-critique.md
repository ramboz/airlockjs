---
slice: 046-01 — core DC page-load beacon off-thread (Consent-Mode + auiddc, parity-confirmed)
pass: frame-critique
verdict: needs-changes
reviewer: general-purpose
reviewed_at: 2026-09-13T04:09:35Z
prompt_source: review.py frame-critique docs/specs/046-floodlight-connector/spec.md 046-01 slice-01-core-dc-beacon.md
---

VERDICT: needs-changes (pre-implementation frame-critique). All findings folded before this record.

REASONING:
The single load-bearing assumption (spec §A2, baked into AC1/AC3/AC4 + the two-slice sizing) was that DC's
parity-significant attribution — `auiddc` + the Floodlight identity (`src`/`type`/`cat`) + custom `u<n>` — rides the
query-delimited `ccm/collect?tid=DC-<id>` form, so 046-01 reuses AW's `appendParam`/`&` builder, redactor, replay, and the
038 `URL.searchParams` oracle wholesale. The frame did not survive its own grounding: R-009 enumerates those attribution
fields EXCLUSIVELY on the `;`-delimited `ad.doubleclick.net/activity` form (`R-009:145`) and names the linker id an
"activity ping" field (`R-009:191`), while DC's `ccm/collect` row (`R-009:146`) is un-enumerated. The recommendation was
grounded by analogy to AW (whose `ccm/collect` WAS enumerated with `auid`, `R-009:143`, + a committed fixture) — DC's own
capture points the other way. Not a hard fail only because A2 was honestly marked OPEN + `arch_review: true` + DoR-gated on
the capture — but the ACs were written around the recommendation before the gating evidence existed.

SPECIFIC ISSUES:
- **A2 — the endpoint/wire pick.** R-009 locates DC attribution on the `;`-delimited `activity` form, which no existing
  connector (`appendParam`+`&`) or 038 oracle (`fieldsFromUrl` via `URL.searchParams`) handles (params ride the URL path),
  so reproducing it needs a NEW `;`-delimited encoder + redactor/descriptor + oracle path — materially larger than AW's
  reuse. Two downstream failure modes: (i) if attribution rides `activity`, AC1/AC3/AC4 pinned to `ccm/collect` are
  misdirected; (ii) if DC's `ccm/collect` simply doesn't carry `auiddc`/`src`/`type`/`cat`, the connector is
  attribution-thin or a false-green fixture (ADR-0020 forbids). Deeper: Floodlight identity IS `src`/`type`/`cat`, which
  `tid=DC-<id>&en=page_view` may not express.
- **A4 (secondary, correctly gated).** `auiddc` `_gcl_au`-derived is asserted not field-confirmed (`_gcl_dc` the named
  alternative); blast radius is one cookie name, handled as a deviation-logged adjustment — a note, resolved from the same
  capture as A2.

FOLD (2026-09-12): spec §A2 rewritten — the `ccm/collect` recommendation is WITHDRAWN as ungrounded for DC; the framing now
states R-009 leans `;`-delimited `activity`, names the new-encoder + `;`-oracle cost, and names the `core/endpoint-ceiling.js`
pathname/`ord`-cachebuster downstream break. The Overview endpoint-decision section + the parity-harness reuse bullet are
made conditional on §A2. Slice 046-01: ACs re-written endpoint-agnostic with a new **AC0** making the endpoint+wire pick the
FIRST (capture-confirmed → arch-ratified) step; the DoR now requires the capture to confirm field carriage PER ENDPOINT (not
merely that a `ccm/collect` request fires); AC5 requires a ceiling-safe endpoint declaration for the chosen wire; A4 folded
as a note resolved from the same capture.

Reviewer substrate: general-purpose subagent running the jig frame-critique rubric; read-only (Read/Glob/Grep); no authoring
context; grounded against R-009, `rig/parity/google-ads-replay.js`, `connectors/{consent-mode,google-ads}`, and the AW
committed fixture.
