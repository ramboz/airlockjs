---
slice: 022-01 — governed page-view RUM beacon (+ A/B grounding)
pass: compliance
verdict: pass
reviewer: jig:reviewer (orchestrator)
reviewed_at: 2026-09-01T15:39:13Z
prompt_source: review.py compliance
---

Compliance (022-01) — PASS. Follows the wire-protocol connector archetype (ConnectorFactory: manifest/init/handle, hosted via core/connector-host.js) exactly like GA4. Manifest declares endpoints + purposes per ADR-0006/0007 (purposes.egress:[] DELIBERATE — the not-consent-gated RUM class per the maintainer decision + lightweight-decision 2026-08-31). No secrets / live identifiers (synthetic ids, the ot.aem.live public default). TDD (RED-first confirmed by the implementer). eslint clean under the 021-03 config. Targeted tests only (suite-hang avoided). Deviation log + reconciliation sweep present; the open production-wiring fork is FLAGGED, not orphaned.
