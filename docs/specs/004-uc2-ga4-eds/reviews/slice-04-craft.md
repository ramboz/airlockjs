---
slice: 004-04 — end-to-end GA4 + before/after Lighthouse
pass: craft
verdict: pass
reviewer: general-purpose + pr-review skill (independent)
reviewed_at: 2026-08-27T15:12:35Z
prompt_source: review.py pr-review docs/specs/004-uc2-ga4-eds/spec.md Lighthouse <deliverables> --richer-skill pr-review
substrate: non-interactive
---

# 004-04 craft — VERDICT: pass

High craft, no blockers. Strengths: the e2e AC1 worker-path proof (natural idle-drain,
no manual flush, while-alive, no unload) genuinely isolates worker-cycle from ring-tail;
the lh-eds server-side no-op-module off/on toggle keeps the control honest (no prod flag);
distinct event names make push-XOR-pushCritical hold by construction; the closing-beacon
current-page_location test mutates loc.href before pagehide (non-vacuous ADR-0004 proof);
push-api.md prose is faithful to core.
Nits, all folded at reconciliation: (a) navigatesAway/opensElsewhere hardened so
mailto:/tel:/javascript:/modified/target=_blank/download/defaultPrevented clicks don't
emit a spurious outbound_click + pay a synchronous main-thread map (real-site correctness)
— with a new unit test, mutation-verified; folding it necessitated a faithful e2e-rig fix
(cancel the /signup navigation on `document` AFTER boot so the adapter sees an un-prevented
click, modelling a real outbound navigation rather than an anchor-prevented one — a
strengthening, not a workaround); (b) vestigial unloadCritical default dropped; (c) stale
endpoint comment fixed. Keepalive-budget note added to push-api.md (reconciliation note).
