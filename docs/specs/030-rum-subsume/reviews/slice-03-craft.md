---
slice: 030-03 — the page-side replace + no double-count
pass: craft
verdict: pass
reviewer: general-purpose
reviewed_at: 2026-09-04T01:59:56Z
prompt_source: review.py implementation 030 'page-side replace'
substrate: non-interactive
---

**Verdict: PASS** (implementation review returned PASS with two Medium hardening points; both applied + re-verified green).
- **Hardening 1 — the `error` assertion tightened to a strict delta.** Was `fetchError.length >= 1` (weaker than AC2's "exactly one"); now snapshots the error-beacon count before the synthetic dispatch and asserts the delta is exactly 1 — "exactly one governed beacon PER dispatched error," robust to page-load error-event noise. Re-ran green.
- **Hardening 2 — the RUM top-wait decoupled from the GA4 boot flag.** The wait short-circuited on `__airlockBootFailed` (GA4, set before the RUM boot) — an unrelated GA4 failure could spuriously red the RUM checks. Now keyed off `__airlockRumBootFailed` only. Re-ran green.
- **Wording reconciled:** AC1/DoD "byte-unchanged" → "behaviorally inert / default-off" (the served HTML gains an inert inline flag script; behavior is unchanged, not the bytes).
- **Citations refreshed:** the guard insertion shifted aem.js line numbers (sendBeacon 120→124, sendPing('top') 124→128) — the rig comment + slice grounding updated.
- **Non-vacuous (two independent reds):** the pre-flag replace run was RED; disabling the aem.js neutralization guard reds `replace_zero_inline_sampleRUM` (double-count). Transport attribution grounded: airlock egresses via fetch (airlock.js:300, egress.js:80), denies sendBeacon in-worker; sampleRUM via sendBeacon (aem.js:124). The main-thread fetch (inside worker.onmessage) is genuinely observable by the page-side fetch wrap.
