---
slice: 038-01 — vendor-generic harness core + same-protocol oracle (Meta Pixel)
pass: compliance
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-09-08T16:39:44Z
prompt_source: review.py compliance docs/specs/038-parity-harness/spec.md 'Meta Pixel' <deliverables>
---

VERDICT: **pass** (independent `jig:reviewer`, read-only). All 7 ACs of slice 038-01 met with non-vacuous tests grounded in the real Meta connector — verified `SYNTHETIC_META_PIXEL_ID="000000000000000"` (meta.js:30, matches fixture), `eventMap` = page_view/lead only (grounds the Purchase→`[]` regression), bare `value`/`currency` not `cd[...]` (grounds the wire-fidelity gap entries), `handle()` → `[]` unmapped / `[{url,method:"GET"}]` otherwise, `parity:meta` script present, lh-r010 report shape mirrored. The classified-diff + gap-map oracle implements ADR-0020 verbatim (expected-dropped green / un-owned dropped red / present-but-unequal always divergent / gap-closed on a landed owner); AC4 keystone 3-fixture guard + a real subprocess `npm run parity:meta` (exit 0 pass / 1 fail) covered; vendor-genericity proven by a 2nd unrelated "widgetco" descriptor.

Non-blocking findings (→ reconciliation log):
- test/parity-meta.test.js:94-96 — vacuous `emitted` assertion (real replay coverage exists at :97-107 — cosmetic tidy).
- AC4(b) uses `id` not the spec's example `currency` as the un-owned drop — defensible (`cd[currency]` is an owned gap-map entry); log as an intentional, correct deviation.
- redact.js uses a fixed field-name denylist; a shape-level fixture scan would harden the R5 no-live-identifier guarantee as more vendors/captures are added.
Process: deviation log + reconciliation sweep still `_TBD_` (the reconciliation phase's job).
