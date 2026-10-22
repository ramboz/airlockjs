---
adr: 0038
pass: frame-critique
verdict: pass
reviewer: jig:reviewerf535fe11-c1b6-4d93-8a16-a7e91801e193 turns0-1 conditional scopes
reviewed_at: 2026-10-22T00:14:27Z
prompt_source: review.py frame-critique docs/decisions/adr-0038-supervised-native-meta-resource-lifecycle.md
---

VERDICT: pass

REASONING:
The load-bearing assumption is that the pre-exec rendezvous can independently attribute its actual peer, launcher lifetime and profile, not merely authenticate a claimed PID with a secret. Pinned Playwright allocates the profile before launching the configured executable and existing confinement permits Unix sockets; this supports an interception point, not proven peer attribution. ADR0038 makes independently verified attribution a no-exec gate and unresolved capability a blocker instead of promoting local supervision into native capability. The frame survives as a conditional proposal within Accepted ADR0035's unchanged authority, not implementation readiness.

SPECIFIC ISSUES:
- Attribution and deadline assumptions remain unverified. A frame pass does not establish their capability; actual falsification and supported ownership remain required.

PROVENANCE:
Actual fresh read-only jig:reviewerf535fe11-c1b6-4d93-8a16-a7e91801e193 turn0, separately labelled ADR0038 verdict. No commands/tests/probes/SDK/browser/network/rehashes/process/profile actions or implementation verification.

BOOTSTRAP REFINEMENT FOLLOW-UP:
Actual same reviewer turn1, separately labelled ADR0038 PASS. The load-bearing risk is attribution of distinct L/H lifetimes before permitting L exec when H owns the TCP connection. Pinned profile/FD facts support a mechanical shell route, not execution proof. E dying before discovery is the strongest counterexample; the proposal withholds permission and records an unqualified case-scoped abort instead of treating enrollment/timeouts as attribution or closure. Conditional framing survives only for first-party falsification; earliest-seam attribution and bounded self-termination remain unproved. No reviewer commands/tests/rehashes or resource actions.
