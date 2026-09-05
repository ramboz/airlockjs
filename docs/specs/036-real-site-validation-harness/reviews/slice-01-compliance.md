---
slice: 036-01 — live CWV before/after harness (two-URL) + procedure
pass: compliance
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-09-05T22:03:05Z
prompt_source: review.py implementation docs/specs/036-real-site-validation-harness/spec.md 036-01 <deliverables>
---

VERDICT: pass

REASONING:
All seven ACs are met with real substance, not plumbing. AC1: rig/lh-core.mjs extracts the
median/summ/armSummary/computeDeltaMedian/withinTightBand/runLighthouseOnce engine and both lh-eds.mjs:42
and lh-live.mjs:55 import it — genuine reuse. AC2/AC3: bandDisposition (lh-core.mjs:103) discriminates on
profile — ga4 → by-construction LCP + tight band; any alloy → measured-no-claim + TBT band with
CLS-improvement-as-pass; two-deployment → band withheld + caveat. AC5's alloy fixture is real: the
config's placements match parsePlacements' exact field contract + the fixture's #airlock-harness-promo-slot,
so the reserve path actually fires (LCP candidate a separate element). Unit tests non-vacuous (each
bandDisposition assertion flips if the profile→band logic is wrong). AC6 procedure accurate; AC7
no-regression (lh-eds imports the engine, behaviour preserved). Verified conformance by mechanism +
the actual local dry-run the implementer ran for all 3 profiles + fallback.

NITS (non-blocking, dispositioned in the deviation log): bootHelixRum line-ref :272→:273/:270 (FIXED);
query_param echoed in two-deployment config (harmless, left).
