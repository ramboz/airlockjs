---
slice: 026-03 — the config contract (`PixelVendorConfig`): pin + validate + conformance
pass: craft
verdict: pass
reviewer: jig:reviewer (independent)
reviewed_at: 2026-09-03T01:46:33Z
prompt_source: review.py pr-review
substrate: non-interactive
---

Craft (026-03) — PASS. Strong craft. The PixelVendorConfig type is faithful to the shipped interpreter (all 7
fields, no invented ones; the discriminated union matches handle()'s switch; coverage bound + null-omits idiom +
stricter-than-runtime documented first-class with accurate connector.js line-refs). The validator is genuinely
pure/import-free, ACCUMULATES all errors (better authoring UX than bail-on-first), fails safe on every hostile
shape (null/non-object/array/null-spec), and correctly does NOT cross-validate {from:event} against eventMap
(which would wrongly reject LinkedIn's intentional page_view:null). The rejection table asserts the specific
offending field + a positive control (robustly non-vacuous). Nits (applied): the from:"static" guard rejected only
a MISSING value, waving through value:{}/null/true that the type forbids + the interpreter String()s to
"[object Object]" in a live URL — hardened to reject non-string|number (+ a new reject test); the JSDoc number
overstatement corrected. The AC5 empty-diff test's post-commit green-by-construction weakness noted (deviation log).
