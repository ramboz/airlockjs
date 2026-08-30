---
slice: 015-01 — fail-closed enforcement (hold + alert)
pass: frame-critique
verdict: pass
reviewer: general-purpose
reviewed_at: 2026-08-30T21:07:23Z
prompt_source: review.py frame-critique docs/specs/015-mvp3-config-integrity-enforcement/spec.md 015-01 slice-01-fail-closed-enforcement.md
---

## Frame-critique — slice 015-01 (config-integrity enforcement) — needs-changes → all applied → pass

Five findings, two co-primary; all applied — the spec was substantially reshaped.
- **[1] WRONG (primary) — override-as-default + AC contradiction → FIXED.** AC2 (pollution→override) vs
  AC3 (duplicate=pollution→hold) were the same input, opposite outcome; and silently correcting-and-sending
  the clearest attack inverts the threat response + forwards the attacker-shaped body to the honest tenant.
  **Fix:** the default is now **HOLD (fail-closed) on any deviation**, matching 013-03; override became a
  named opt-in OPTION (015-02); the ALERT ships WITH the enforcement (015-01), not deferred.
- **[5] WRONG (co-primary) — host-blindness → FIXED.** `pinnedDispatchUrl` rewrites only `configId`,
  preserving the chamber's host — so at this unbuilt-seal seam a `evil.com?configId=<honest>` egress would
  be "corrected" and STILL sent to evil.com (leaking the honest datastream). **Fix:** the control now
  verifies the **HOST too** (hold on host ≠ pinned host), so override can never forward to an unconfined
  destination.
- **[3] OVER-CLAIMED — GA4 scope → FIXED.** GA4 is NOT immune: its `handle` maps in the chamber, so a
  compromised GA4 chamber can emit `?measurement_id=<attacker>` (same-class threat). **Fix:** GA4 scoped
  out as a deliberate **deferral** (tracked), not "can't be re-pointed"; only its sync unload path is
  genuinely immutable (so binding to the async seam still side-steps the 014 sync-gating problem).
- **[4] OVER-CLAIMED — not vendor-neutral → FIXED.** The control hardcoded `"configId"`. **Fix:** `core/`
  holds the generic pin-host+tenant-key mechanism; the tenant-key param name is INJECTED per connector
  (`configId` alloy / `measurement_id` GA4), the 014-02 precedent.
- **[2] SOUND (feasibility) — refined.** The pin is real + chamber-immutable, but threaded via
  `host.init({config})`, not the imaginary `createWrappedSdkHost` config path — DoR corrected.

### Net
The disposition flipped from a dangerous override-default (silent correct-and-send, host-blind) to a
fail-closed hold-default that verifies host + tenant and alerts inline, with override as an explicit
opt-in trade — before the ADR is Accepted + the other enforcement specs bind to it.
