---
slice: 048-02 — bootFloodlight + worker chamber + `{type:"floodlight"}` config type + composite membership (consent-gated)
pass: frame-critique
verdict: pass
reviewer: jig:reviewer (frame-critique)
reviewed_at: 2026-09-15T00:11:38Z
prompt_source: /tmp/claude-503/-Users-ramboz-Projects-misc-airlock--claude-worktrees-tealium-inp-instrumentation-17ba9c/9f678cbf-3d87-4d40-985c-9272ed2921fb/scratchpad/fc-048-02.txt
---

# Frame-critique — 048-02 (bootFloodlight) · VERDICT: pass
The load-bearing A1-floodlight assumption (both DC beacon forms — ccm/collect + activity — route through ONE bootFloodlight chamber / one connector / one config / one egressPurposes) is CONFIRMED TRUE by the connector source: createFloodlightConnector takes one config, its handle emits both forms from one call (ccm at index 0; activity appended when src set, gated by hasActivityIdentity), one manifest declares both endpoints, and createFloodlightRemap is already key-aware per form. The chamber+boot pattern itself was ratified in 048-01.
Non-blocking residual (folded into AC2): the `endpoints` ceiling is NOT a single-element mirror of 048-01. Floodlight is two-origin, so when activity is configured bootFloodlight must pass a TWO-element, data-dependent ceiling [ccm, "ad.doubleclick.net/activity;src=<id>"], the second built with the SAME core/path-matrix.js join the connector uses (reuse the connector's activityCeilingEndpoint derivation, don't rebuild inline) + matched by the segment-anchored prefix ceiling (ADR-0025 / 046-02 AC4). A naive single-element mirror would hold the activity beacon forever. AC4/AC5 already gate both forms end-to-end.
