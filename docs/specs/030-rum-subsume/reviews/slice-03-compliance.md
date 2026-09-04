---
slice: 030-03 — the page-side replace + no double-count
pass: compliance
verdict: pass
reviewer: general-purpose
reviewed_at: 2026-09-04T01:59:56Z
prompt_source: review.py implementation 030 'page-side replace'
---

**Verdict: PASS.** All 4 ACs met by the deliverables.
- AC1 — the replace is param-gated (`?rum=airlock` → `window.__airlockOwnsRum`, set by a nonce'd inline flag BEFORE aem.js loads) at a SINGLE neutralization funnel: `aem.js`'s `sampleRUM.sendPing` gains `if (window.__airlockOwnsRum) return;` (every checkpoint funnels through sendPing), and `scripts.js` boots `bootHelixRum({forceSelect:true})` only under the flag. Default (no-param) testbed is behaviorally inert — `rig/e2e.mjs` green.
- AC2 — `rig/rum-replace.mjs` (mirrors e2e.mjs) proves, by TRANSPORT attribution (sampleRUM=sendBeacon, airlock=fetch), exactly one governed beacon per checkpoint: replace → 0 sendBeacon, exactly 1 fetch `top` (strict `===1`), exactly 1 fetch `error` per dispatch (strict delta), all confined to ot.aem.live; control → sendBeacon top fires, 0 airlock fetch.
- AC3 — scope boundary honest: top/error gated (deterministic); cwv/INP proven by the 030-02 unit test, non-gating in the rig; the enhancer's interaction/lifecycle set explicitly out of scope (RUM_MANUAL_ENHANCE).
- AC4 — no live ids: ot.aem.live network-stubbed; synthetic ephemeral id; forceSelect / pre-seeded isSelected are testbed-only determinism seams.
- Build emits all 5 worker siblings; bootHelixRum reachable from the served eds.js.
