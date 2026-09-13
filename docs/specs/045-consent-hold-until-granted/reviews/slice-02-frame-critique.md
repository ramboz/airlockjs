---
slice: 045-02 — apply hold-until-granted to alloy (via alloy's native `defaultConsent:"pending"` queue, preserving 034-01)
pass: frame-critique
verdict: pass
reviewer: general-purpose x2 (jig frame-critique, opus) + orchestrator creds-free rig probe
reviewed_at: 2026-09-13T00:48:50Z
prompt_source: review.py frame-critique ... 045-02 (2 rounds) + rig/alloy-consent-pending probe grounding
---

VERDICT: pass (after two needs-changes rounds + a grounding probe; final frame = alloy's native queue)

FRAME JOURNEY (two independent frame-critiques, both needs-changes, both addressed):
1. Frame-critique #1 (seam approach) — needs-changes: the originally-named `wrapped-sdk-host.js:106-109` seam
   "buffer+flush like 017-03" is INFEASIBLE — alloy's interact is a synchronous request-response round trip; leaving the
   chamber fetch pending HANGS (hold returns at `:377` before the `:430` timeoutMs timer) and DEADLOCKS single-slot
   `driveEvent` (`:574`); a fire-and-forget flush DISCARDS the response; under pending alloy self-suppresses
   (`shapeAlloyConsent`→`collect:"n"`). → Reframed to hold in the chamber (owner steer).
2. Frame-critique #2 (chamber-buffer) — needs-changes: plumbing sound, but the load-bearing premise (alloy replays a
   delayed interact on grant) was UNGROUNDED and the fake-Worker unit suite structurally cannot validate it (real 766KB
   alloy never runs in Node). Fix: gate the build on a live/rig alloy probe BEFORE building. Also: consider alloy's NATIVE
   `defaultConsent:"pending"` queue instead of a hand-rolled buffer; amend ADR-0023.

RESOLUTION (both #2 findings addressed):
- The DoR/kill probe was RUN (creds-free): `rig/alloy-consent-pending.mjs` drives the real @adobe/alloy@2.35.0 bundle
  (playwright, local origin, interact+set-consent intercepted/stubbed — no live Edge, no creds). GROUNDED:
  `defaultConsent:"pending"` queues a sendEvent (0 interacts); `setConsent(collect:"y")` + a valid set-consent round-trip
  ("User consented.") FLUSHES the queue (interact fires, sendEvent resolves with its decisions round-trip). Integration
  nuance grounded: the flush requires the set-consent request to egress + return a valid consent handle.
- The slice REFRAMED to alloy's NATIVE `defaultConsent:"pending"` queue (the reviewer's own recommendation) — the vendor's
  designed hold-until-consent, maximal fidelity, minimal custom code (no hand-rolled buffer, no seam change). ADR-0023 A1
  amendment queued in the close-out.

CURRENT FRAME (native-queue) assessment: SOUND + GROUNDED. The load-bearing premise is now empirically confirmed against
the real bundle (not a fake). The design uses the library's own mechanism, keeps the seam as the trusted backstop
(unchanged), and preserves 034-01. The remaining risk (live-Edge confirmation) is a named creds-gated nice-to-have, not a
blocker — the creds-free rig grounds the mechanism.

SPECIFIC ISSUES:
- [strength][spec] The final design implements the frame-critique's own recommendation (native queue) and is grounded by a
  committed creds-free rig — the exact DoR gate #2 demanded, satisfied before building.
- [nit][spec] ADR-0023 A1 originally locates the alloy hold at the seam (hold+flush) — now stale vs the native-queue
  realization. Amend during reconciliation (close-out item).
- [watch][impl] The flush depends on the set-consent request egressing + returning a valid consent response — the
  implementation must ensure the seam passes set-consent on grant (it does: consent is granted then) and the tests stub a
  valid consent response (an empty handle does NOT flush — grounded). Arch review to scrutinize.

RECONCILIATION NOTES:
- Package the probe as the permanent rig `rig/alloy-consent-pending.mjs` (grounding deliverable).
- Amend ADR-0023 A1 to the native-queue realization (close-out).

---
Reviewer substrate: general-purpose subagents (Opus) across two frame-critique rounds + a creds-free rig probe run by the
orchestrator; final frame reframed to alloy's native defaultConsent:"pending" queue (the reviewer's recommendation),
grounded against @adobe/alloy@2.35.0. Recorded as pass on the final grounded frame (the needs-changes findings are
resolved: probe run, native-queue adopted).
