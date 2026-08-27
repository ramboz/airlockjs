---
slice: 006-01 — block instrumenter → `view_block` GA4
pass: frame-critique
verdict: pass
reviewer: jig:reviewer (adversarial frame-critique; FAIL round 1, PASS round 2)
reviewed_at: 2026-08-27T15:41:06Z
prompt_source: review.py frame-critique docs/specs/006-uc3-block-decoration/spec.md instrument slice-01-instrument.md
---

# 006-01 frame-critique — VERDICT: PASS (round 2; round 1 was FAIL)

Round 1 FAILED on two real flaws, both verified against the actual substrate:
(1) unscoped `data-block-status` discovery would also instrument the header/footer
CHROME blocks — loadHeader/loadFooter decorate them in body>header/footer during the
lazy phase, and under aem-up the proxied header has height at the top of the page and
would fire its own view_block at load, breaking the "single beacon" oracle; (2) the
sub-viewport testbed made the scroll-trigger unstageable (a demo block would be
above-the-fold and fire trivially; "never-in-view fires nothing" untestable).

Frame revised; round 2 PASS, both fixes verified grounded + testable: discovery
scoped to <main> as a LOAD-BEARING constraint (with an assertable negative — a
decorated header block gets no WeakMap entry, testable even offline since chrome
decoration is synchronous before the module 404); the testbed staged with a
below-the-fold demo block + spacer height + a never-in-view control, making the
ordered rig oracle (none before scroll → exactly one after → still one after out/in
→ none for control → none for chrome) actually observable. The added timing
assumption (main blocks decorated in loadEager, before the lazy boot) matches the
code. No new load-bearing assumption exposed.

One round-2 polish note folded before recording: the contract table's first row now
carries the "within `main` — chrome excluded" scope itself, so the oracle-reference
table is self-contained.
