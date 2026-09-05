---
slice: 036-02 — supported-subset live smoke (GA4 + alloy) + residuals checklist + run-procedure
pass: frame-critique
verdict: pass
reviewer: jig:reviewer (2 rounds: RUM-false-green r1, pass r2)
reviewed_at: 2026-09-05T22:24:00Z
prompt_source: review.py frame-critique docs/specs/036-real-site-validation-harness/spec.md 036-02 <spec> <slice>
---

VERDICT: pass (round 2)

## Frame-critique trail (2 rounds)

frame_review:true fired on Fork C (which residuals the harness EXERCISES vs the procedure DOCUMENTS)
+ the local-provability split — the green-but-hollow adoption-proof risk.

- **r1 — needs-changes.** AC2's "each residual names a reveal" was FALSE for the RUM cwv-superset gate.
  That gate (030-04) is a DOWNSTREAM property — the live ot.aem.live collector must KEEP the superset,
  "not truncated in a way that breaks the pipeline." ot.aem.live is fire-and-forget (2xx, no sync
  validation), so a captured beacon / 2xx / boot-health reveals only what airlock SENT, never what the
  collector KEPT — a structural false-green. Since __airlockOwnsRum neutralizes inline sampleRUM, a
  false-green ships airlock as RUM authority while the site silently loses CWV telemetry. Secondary:
  AC1's "alloy interact fired" had no shape oracle (a malformed XDM still POSTs + can 2xx).
- **r2 — PASS.** Both closed + grounded: AC2 RUM now requires DOWNSTREAM AEM RUM-data inspection
  (bundler/explorer; differential vs stock sampleRUM), a captured beacon explicitly NOT sufficient;
  AC1 alloy is presence-only ("FIRED"), the SHAPE + ECID write-back deferred to the spec-013 rigs
  (verified: rig/alloy-live-reprobe.mjs runs recognizeInteract + extractEcidFromInteractResponse +
  a jar write-back check). All named reveals confirmed to exist (endpoint-ceiling held diagnostic at
  wrapped-sdk-host.js:254 via onDiagnostic; boot-health hooks at scripts.js:259/270/276; the GA4
  MP-schema oracle). No green-but-hollow path survives; no new load-bearing assumption.

## Frame (as ratified)
A supported-subset live smoke rig (GA4 MP-schema conformance + alloy/RUM presence + boot-health,
reusing e2e.mjs's capture/oracle/health pattern), a named-live-residuals checklist where each residual
names an HONEST reveal (RUM superset = downstream inspection, NOT a wire-side beacon; endpoint-ceiling
breadth = the wrapped-SDK-host held diagnostic; real-bundle TT boot = boot-health), and the consolidated
operator run-procedure. Locally provable: GA4 conformance + alloy chamber boot-health (stub bundle). The
real-Edge interact shape + real ot.aem.live acceptance are the operator's creds-gated run, never faked.

## Non-blocking note applied at pass
- Citation precision: the cwv-loss stakes now rest on "__airlockOwnsRum neutralizes ALL inline sampleRUM
  egress (cwv included)" rather than the README quote that literally addresses the interaction/lifecycle
  checkpoints. Reasoning unchanged; attribution corrected.
