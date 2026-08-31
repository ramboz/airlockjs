---
slice: 018-01 — the active-markup sanitizer boundary
pass: craft
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-08-31T05:40:02Z
prompt_source: review.py craft (richer-skill none)
substrate: non-interactive
---

# Craft review — 018-01. VERDICT: pass (independent, jig:reviewer).
Within AC4's conservative-denylist scope (mXSS out of scope), the denylist is correct+complete: isEventHandlerAttr
(/^on/i) covers the on* surface; isDangerousUrl strips control/whitespace before a case-folded startsWith
(tab-split + entity-encoded schemes handled by the parser decode, rig v-obfuscated proves it); STRIPPED_TAGS/
ACTIVE_URL_ATTRS match the named sets + are pinned. Two-phase static-snapshot walk correct; <template>.content
recursion closes a real bypass; whole-doc querySelectorAll while serializing only body.innerHTML. Fail-safe
airtight (no path returns raw input); tests non-vacuous; the proof is a real GATING CI step.
Non-blocking nits — APPLIED: (1) ci.yml browser-oracle header comment "two structural asserts" → "three";
(2) TT-memoization first-write-wins caveat recorded in the deviation log. Strengths logged (fail-closed, atomic
sanitize+TT, template recursion, honest noscript non-reproduction).
