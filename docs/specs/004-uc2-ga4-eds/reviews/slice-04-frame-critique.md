---
slice: 004-04 — end-to-end GA4 + before/after Lighthouse
pass: frame-critique
verdict: pass
reviewer: jig:reviewer (adversarial frame-critique; FAIL round 1, PASS round 2)
reviewed_at: 2026-08-27T14:28:54Z
prompt_source: review.py frame-critique docs/specs/004-uc2-ga4-eds/spec.md Lighthouse slice-04-e2e-and-lighthouse.md
---

# 004-04 frame-critique — VERDICT: PASS (round 2; round 1 was FAIL)

Round 1 FAILED on a real load-bearing flaw: the testbed has ONE interactive element
(the navigating /signup CTA), so AC1's "worker cycle" and AC2's "unload fast path"
were the same click — and a navigating click cannot complete the worker round-trip,
so AC1's beacon would be delivered by the synchronous ring-tail flush, false-greening
AC1's "capture → cycle → map → egress" claim. Plus two method flaws (independent LH
noise doesn't cancel in a single pair; LCP delta ~0 by construction so TBT is the
signal) and a missed ADR-0004 obligation (thread the live projection snapshot).

Frame revised; round 2 PASS. The primary fix is sound: because unloadFlush is wired
EXCLUSIVELY to visibilitychange→hidden / pagehide (core/airlock.js:82-85), a beacon
reaching collect while the page is still alive (no unload fired) can only be
worker-path — the ring-tail flush provably cannot satisfy it. AC1 now uses a
dedicated non-navigating element + distinct XOR-safe event names + a pre-unload
delivery oracle; AC3 runs ≥5 iterations/arm with median+spread and TBT as the
runtime-attributable number (acceptance band TBT delta ≤50ms, CLS ≤0.01).

Two round-2 notes folded before recording: (1) AC2's live-projection clause is
non-observable on the consent-free testbed (page_location is caller-current; a
stale-ctx impl emits a byte-identical beacon), so AC2 now verifies only current
page_location and marks the live-snapshot property carried-forward-unverified per
ADR-0004/OQ13 — a green AC2 must not be read as verifying it. (2) N + the ~0 band are
now pinned in AC3.
