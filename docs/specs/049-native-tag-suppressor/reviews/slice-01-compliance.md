---
slice: 049-01 — runtime-`<script>` suppression (CWV-win core, dist-shipped)
pass: compliance
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-09-15T19:28:54Z
prompt_source: review.py implementation docs/specs/049-native-tag-suppressor/spec.md runtime-
---

Compliance (implementation) pass on slice **049-01** — reviewer `jig:reviewer`, prompt via
`review.py implementation docs/specs/049-native-tag-suppressor/spec.md runtime- <deliverables>`.

**VERDICT: pass.** All six ACs implemented + backed by non-vacuous tests:
- AC1 (vendor-neutral, full 6-method insertion surface) — met; grep guard confirmed clean; pre-fetch neutralization (refuses native insertion), not a MutationObserver.
- AC2 (network-0 real-browser proof) — met; `rig/tag-suppressor.mjs` gates on the dual network-0 + sentinel-absent assertion, injects via the real `insertBefore` idiom (+ the other methods), under a CSP byte-identical to `rig/sanitize-boundary.mjs`'s (TT + strict-dynamic); GATING in `ci.yml`.
- AC3 (carve-out, allow-before-suppress) — met; unit + rig-proven, mutation-verified.
- AC4 (partial migration, `?id=` discrimination) — met; unit + rig-proven.
- AC5 (per-suppression 028 diagnostic) — met.
- AC6 (served dist sibling) — met; `build.mjs` entry + `DIST_ARTIFACTS` + all three pinned ref-root assertions updated.

**One latent nit flagged + RESOLVED in the post-review fix round:** AC5's diagnostic originally nested a `matcher` object (would have made the suppressor the first nested-value emitter into spec-028's flat-record collector). Flattened to primitive `matcherHost`/`matcherPathname`/`matcherQuery` fields, so the 028 flat-record invariant holds. Re-verified after the fix: `npx vitest run` = 1906 passed; `node rig/tag-suppressor.mjs` = pass (23 assertions, all 6 methods network-0 + sentinel-absent); eslint clean; build green.
