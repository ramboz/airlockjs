---
slice: 020-01 — alloy XDM-governance feasibility probe
pass: frame-critique
verdict: needs-changes
reviewer: jig:reviewer
reviewed_at: 2026-08-31T16:22:06Z
prompt_source: review.py frame-critique (tailored)
---

# Frame-critique — 020-01 (alloy XDM-governance feasibility probe). VERDICT: needs-changes → RESHAPED.

The frame-critique caught the load-bearing flaw + independently surfaced the same read-minimization finding
the orchestrator had grounded: the probe treated alloy's `events[].xdm` as a "vendor-built body with
strippable sensitive fields," co-weighting a payload-strip against consent in a binary "strip-at-seal vs
read-minimization" verdict. Grounded evidence contradicts it: `toXdm` (connector.js:195-206) is a 2-field
allowlist (eventType + web.webPageDetails, no arbitrary params); `connector.js:67` sets `context:[]`
(ambient collection disabled); `connector.js:97` declares `reads` as those two fields; the live capture
confirms a minimal body with no consent field. So the body is ALREADY read-minimized by construction (a
third placement) — the "safe to strip" set is empty, the strip half is a near-non-problem, and the two halves
must be split with consent elevated.

RESHAPE applied (addresses the needs-changes + the maintainer's authoritative consent correction):
- Split the two halves (payload vs consent) — different feasibility answers.
- Payload: rescoped to "confirm toXdm+context:[] already minimize the body; residual fields; optional thin
  defense-in-depth strip, Edge-safe" — expect "no strip needed."
- Consent: CORRECTED — alloy consent is the `setConsent` COMMAND (configure→setConsent→sendEvent), NOT XDM
  body injection (maintainer, 2026-08-31). The frame-critique had elevated "consent-injection at the seam,"
  which is also the wrong mechanism; the reshape replaces it with the setConsent-command path (map ADR-0007
  vector → Adobe 2.0 consent shape → drive setConsent in the chamber alloy-boot glue; delegate-and-send).
- Outcome: expanded from binary to per-half dispositions; trending "both halves feasible via idiomatic paths."

The reframe is authoritatively grounded (the domain expert's setConsent correction + the frame-critique's own
prescription + the live capture), so no re-critique was run; the live rig is the empirical validation.
Reviewer: jig:reviewer (independent, read-only).
