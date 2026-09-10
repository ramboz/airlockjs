---
slice: 041-04 — declarative instrumentation-config selection
pass: compliance
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-09-10T17:41:32Z
prompt_source: review.py implementation ... 'declarative' (re-run)
---

VERDICT: pass

## Reasoning
Slice 041-04's two ACs are fully met and non-vacuously tested. AC1: `"ga4-gtag"` is registered in
`KNOWN_CONNECTOR_TYPES`, dispatched by `bootConnector` to `bootGa4Gtag` paired with `GA4_GTAG_MANIFEST_EVENTS=["*"]`,
gated by `validateConnectorEntry` (accepts well-formed, rejects missing measurementId + unknown type), and mirrored by
the schema `ga4GtagConnector` $def (measurementId required; streamCookieName/consentDefault/endpoint/ctx optional;
additionalProperties:false; type const disambiguates the oneOf). AC2: the switch case threads `{...rest, ...governance}`
with no exemption; the equivalence test proves the config path produces byte-identical createAirlock inputs as standalone
bootGa4Gtag. The endpoint override is genuinely wired (opts.endpoint defaults to GA4_GTAG_COLLECT_ENDPOINT, flows into
connectorConfig.endpoint + endpoints:[endpoint]; connector consumes it; tests confirm custom-endpoint egress + ceiling
widening + default preserved). Every new-feature test fails on revert.

## Specific issues
- None.

## Reconciliation notes (folded)
- Deviation log + sweep were `_TBD` — filled at reconciliation.
- The endpoint field was a no-op until the in-slice gap-fix (schema/switch threaded it, bootGa4Gtag hardcoded it) — now
  fixed + tested; recorded in the deviation log.
- Config-path endpoint override was only transitively covered (via equivalence); the standalone override test now also
  asserts `initMsg().endpoint` [FOLDED], so both the connectorConfig + ceiling sides are pinned.
