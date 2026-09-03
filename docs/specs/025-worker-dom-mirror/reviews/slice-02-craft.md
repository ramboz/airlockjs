---
slice: 025-02 — the mirror core: synthetic tag off-thread through airlock's own mirror, INP-safe
pass: craft
verdict: pass
reviewer: jig:reviewer (independent, 2 rounds)
reviewed_at: 2026-09-03T00:32:24Z
prompt_source: review.py pr-review
substrate: non-interactive
---

Craft (025-02) — NEEDS-CHANGES → PASS after remediation. Strong build. The security crux — the mutation-apply
allowlist — is genuine (closed tag/attr sets, data-* prefix, on*/URL attrs refused by construction) and enforced
at the correct trust boundary: applyOne always runs evaluateOp before any real-DOM write, so injection refusal
holds even if a hostile tag bypasses the mirror and postMessages a raw op stream. The style-value guard is on both
write paths. The AC5b/AC4 tests are real + falsifiable (the first-chunk-discipline test proves the coordinator
drives the REAL scheduler.chunk synchronously before any await; AC5b fails a sync-blast coordinator). AC2 is
grounded on the byte-unmodified fixture read from disk. Blocker (same as compliance): the coordinator's real-DOM
apply could throw synchronously under AC6's hostile-op threat model, uncaught. FIXED at both layers — try/catch
backstop in applyOne (kind:dom-apply-threw + refuse, batch continues — backstops the unpredictable cyclic-append
HierarchyRequestError the policy can't detect) + a genuine pre-refusal allowlist regex for the predictable
name-token vectors; the new coverage test is falsifiable (throwing appendChild at position 3 of 4, asserting
applied=3/refused=1 proves the batch continued past the throw; fails against pre-fix code). Nits addressed: the
misleading "by default" AC4 title reworded; the unreachable default: branch kept as harmless defensive code.
Deferrals within AC7's coverage bound: full value-level style sanitization must cover LAYOUT abuse (fixed/absolute
overlay clickjacking) not just URL schemes, and id-based DOM-clobbering hardening — both → 025-03's sanitizer.
