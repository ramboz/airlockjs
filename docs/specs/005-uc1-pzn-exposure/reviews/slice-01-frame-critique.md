---
slice: 005-01 — exposure capture → GA4 + no-flicker invariant
pass: frame-critique
verdict: pass
reviewer: jig:reviewer (adversarial frame-critique)
reviewed_at: 2026-08-27T15:35:04Z
prompt_source: review.py frame-critique docs/specs/005-uc1-pzn-exposure/spec.md exposure slice-01-exposure.md
---

# 005-01 frame-critique — VERDICT: PASS

The single load-bearing premise — the applied experiment/variant is durably readable
at lazy-boot from body[data-experiment]/[data-variant] — SURVIVED its strongest attack.
The natural kill-shot (aem-experimentation writes the dataset on <main>, not <body>) is
defeated by the vendored plugin's explicit main→document.body remap
(plugins/experimentation/src/index.js:477 + :862-863), set synchronously in the eager
window before body:appear, and never removed by the lazy phase. Confirmed for both
forced-control and forced-challenger. Dedup (keyed on experiment+variant), the
once-fired eager event, and window.__flicker checkability all hold against the source.
The irreducibly perceptual flash gap is correctly kept load-bearing on a human-review
DoD item.
Three residual notes, all folded before READY_FOR_REVIEW: (a) fast-bounce hole (exposure
lost if bounce faster than lazy boot — accepted AD-8, now stated); (b) AC4's
paint-timestamp leg made corroborating-only (headless-unreliable), the exp-applied<appear
mark ordering is the load-bearing proof; (c) page-level-only scope (section-level
experiments write the dataset on the section, not body) documented.
