---
slice: 019-01 — input-side payload denylist governance (all crossings, GA4 E2E)
pass: compliance
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-08-31T12:59:23Z
prompt_source: review.py compliance (richer-skill none)
---

# Compliance — 019-01. VERDICT: pass (independent jig:reviewer).
All seven ACs met by non-vacuous tests: E2E seam tests parse the REAL mapped GA4 body/posted batch across all
three crossings (drain, flushNow, sync) and fail if governance is removed; non-mutation asserts the crossed
object is a distinct copy while getState() retains the raw field; AC7 proves the diagnostic carries the field
NAME but never the value. push() stays governance-free (INP-safe). Deviations acceptable (pinned match
semantics per ADR-0012's delegation; governParams early-return). Nit: a dead assertion (test:173 `.not.toThrow`
missing `()`) — FIXED. Post-review changes (see deviation log): (1) the DEFAULT_DENYLIST off-by-default posture
this pass recorded was ESCALATED to the maintainer, who chose ALWAYS-ON — the code + AC6 framing + tests were
updated accordingly (back-compat now a content property; a clean payload is byte+ref identical, a password
strips even unconfigured); (2) the craft blocker (case-variant leak) was fixed; (3) fail-open now surfaces a
diagnostic. 266 tests green.
