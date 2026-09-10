---
slice: 041-04 — declarative instrumentation-config selection
pass: reconciliation
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-09-10T17:45:08Z
prompt_source: review.py reconciliation ... 'declarative'
---

VERDICT: pass

## Reasoning
The deviation log is honest and complete against what was built. All three logged items verified: (1) the endpoint-
override gap-fix is threaded end-to-end — `bootGa4Gtag` destructures `endpoint = GA4_GTAG_COLLECT_ENDPOINT` (:622) and
uses it at both `connectorConfig.endpoint` (:691) and the `endpoints:[endpoint]` ceiling (:692), tested for
custom-endpoint egress / no ceiling-hold / default-preserved; (2) `GA4_GTAG_MANIFEST_EVENTS` is a deliberate separate
const (future-divergence hedge); (3) both review-driven test tightenings exist (initMsg().endpoint assertion; non-string
measurementId rejection). Scope is genuinely mechanical registration (KNOWN_CONNECTOR_TYPES, switch case,
validateConnectorEntry gtag check, closed-oneOf schema $def with additionalProperties:false/required:[type,measurementId]);
governance threads identically to ga4/pixel (byte-equal equivalence test), no exemption; no undocumented deviation, no
over-build.

## Specific issues
- None.

## Reconciliation notes
- The docs/architecture.md connector-inventory update (gtag now bootable via bootGa4Gtag / type:"ga4-gtag") is correctly
  deferred to spec 041 close-out (with spec-status + board), consistent with the REVIEWED frontmatter. Non-blocking.
