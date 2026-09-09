---
slice: 039-01 — core /g/collect page_view beacon
pass: frame-critique
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-09-08T21:47:40Z
prompt_source: review.py frame-critique <spec> 'core /g/collect' <slice>
---

Frame-critique verdict: **pass** (independent jig:reviewer, read-only, pre-implementation). Both hard grounding citations verified against source: `connectors/ga4/cookies.js:146` (`sourceGa4Ctx` returns `{clientId, sessionId}`) and `connectors/pixel/connector.js:149` (`{url, method:"GET"}` off-thread GET pattern). The load-bearing assumption attacked — that a core-only `/g/collect` page_view beacon (session-state + Consent Mode deferred to 02/03) is a coherent, independently-verifiable deliverable — survives: ADR-0019 kill-criterion #2 defers console parity to MVP9, and the slice honestly scopes verification to the 038 same-protocol oracle on the core field set (lab), not the console.

Non-blocking note carried to reconciliation: ADR-0019 (Accepted, last_verified 2026-09-07) still lists "field-for-field confirmation of the `/g/collect` map" as an OPEN question and frames the wire shape as "documented, not measured," while spec 039 cites R-009(a) as capture-confirming it (2026-09-07). The reviewer judged the assumption TRUE per R-009 — so the ADR text reads stale, not the spec wrong. Amending an Accepted record requires owner approval (skill reconciliation rule / issue #125); surfaced, not applied.
