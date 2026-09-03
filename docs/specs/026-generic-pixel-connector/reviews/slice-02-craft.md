---
slice: 026-02 — more vendors as configs: the archetype generalises across real GET pixels
pass: craft
verdict: pass
reviewer: jig:reviewer (independent)
reviewed_at: 2026-09-03T01:17:41Z
prompt_source: review.py pr-review
substrate: non-interactive
---

Craft (026-02) — PASS. The archetype generalises with zero connector code: connector.js untouched; linkedin.js/bing.js
are genuinely declarative config fixtures with thin factories, no per-vendor branching/logic. The
eventMap:{page_view:null} idiom is clean (rides the interpreter's hasOwnProperty + null-omit rules, no new code) —
strong evidence the flat paramMap is output-key-agnostic, not Meta-shaped. Tests real + non-vacuous: the AC3
table-driven generality across 3 vendors through one connector; the PII-strip tests wire email into payloadDenylist
(email NOT in DEFAULT_DENYLIST, so non-vacuous) and (post-remediation) assert a surviving field for selective strip;
endpoint-confinement grants consent first to isolate the ceiling from the consent gate, distinct evil-origins per
vendor (no copy-paste leakage). The 4 config-contract findings (eventMap string|null; static protocol-boilerplate
params; consent-class invariant in-sample; multi-endpoint unexercised) are all sound → 026-03. Nits (non-blocking):
the empty-git-diff test is worktree-vs-index (the grep is the durable guard — noted + the grep hardened in
remediation); hardcoded connector.js line numbers in doc comments (rot risk, house style). No blockers.
