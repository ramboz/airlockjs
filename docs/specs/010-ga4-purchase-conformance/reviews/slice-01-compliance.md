---
slice: 010-01 — purchase schema shape + golden + validator coverage
pass: compliance
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-08-28T01:19:54Z
prompt_source: review.py implementation
---

Compliance 010-01 — PASS. All 4 ACs met. AC1 schema models params.items as minItems:1 array of $defs/item (anyOf[required item_id|item_name], price/quantity number) while other params keep scalar anyOf[string,number,boolean]. AC2 purchase golden in mustPass, faithfully matches mapToMp output (client_id, single purchase event, session_id String, engagement_time_msec:100, no user_id/consent). AC3 three mustFail controls each bite a distinct rule. AC4 the 4 prior goldens + 7 prior negative controls unchanged; deliverable set contract-only. Contract doc records the items shape + strictness rationale + provenance URL. RECONCILIATION NOTE: making items a named property applies the array shape to ANY event with an items param, not only purchase — GA4-reserved ecommerce semantics, acceptable, worth a deviation-log line.
