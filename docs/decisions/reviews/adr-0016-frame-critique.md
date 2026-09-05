---
adr: 0016
pass: frame-critique
verdict: pass
reviewer: general-purpose (independent frame-critique, 2 rounds)
reviewed_at: 2026-09-05T01:20:03Z
prompt_source: review.py frame-critique --adr 0016
---

VERDICT: pass (after one needs-changes round) — frame-critique, ADR-0016

An independent frame-critique reviewer pressure-tested the premise, the option space, and
decision-from-evidence (verifying claims against the probes + lockfile).

**First pass: needs-changes** — a load-bearing premise error, caught before the decision locked:
the Context claimed the stock bundle "must `importScripts` from a same-origin URL (004-01 forbids
cross-origin)." That conflated TWO distinct origin constraints — the *worker-script* URL (`new
Worker`, genuinely same-origin per 004-01) vs. the URL the worker *`importScripts`* for the stock
bundle — and **contradicted the ADR's own cited spike**, which proved by probe
(`probes/alloy-csp-spike/probe2.mjs:66` `cross_origin_importscripts_admitted_after_tt_fix`) that
cross-origin `importScripts` is green. The false premise silently excluded the arguably-dominant
option for buildless EDS: **load alloy cross-origin from Adobe's CDN via `bootAlloy({ bundleUrl })`**
(zero vendoring, zero redistribution).

**Rework:** Context now separates the two origin questions (probe-cited); Option C (cross-origin CDN)
added with real pros/cons and flagged as the previously-excluded option; Option D (opt-in
airlock-hosted artifact) steelmans "airlock provides it" bloat-free; the decision splits into D1
(don't ship — origin-independent grounds) + D2 (recommend same-origin byte-pinned on supply-chain
integrity / AD-7 / confinement + CSP-portability, **support cross-origin as a documented opt-in**).
CSP-portability honestly hedged as partially grounded. Apache-2.0 grounding preserved.

**Re-verify: pass** — premise fixed + probe-backed, option space honest + complete, decision follows
from corrected evidence, kill criteria distinguish a D2 recommendation-flip from a D1 reversal.

Non-blocking note: the reserved filename slug (`…-site-supplied`) is narrower than the refined
title; left as-is (a reserved identifier; nothing links by it, and the H1 carries the precise decision).

Reviewer: general-purpose (independent frame-critique, 2 rounds).
