---
bug: 001
pass: craft
verdict: pass
reviewer: jig:reviewer (initial and scoped follow-ups)
reviewed_at: 2026-10-29T17:08:18Z
prompt_source: pr-review skill craft pass and targeted reviewer prompts
---

The initial craft review passed with nits: reverse exact-key coverage, placeholder caveat and stale refinement text. Those were addressed. Subsequent targeted reviewers examined the materially changed placeholder and report paths; the last bounded review passed the final sentinel correction. This is a composite review, not a single full-diff review after every edit. Unknown fields and URL components still require inspection; the original oracle API can expose raw inputs.
