---
slice: 010-01 — purchase schema shape + golden + validator coverage
pass: reconciliation
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-08-28T01:25:07Z
prompt_source: review.py reconciliation
---

Reconciliation 010-01 — PASS. Deviation log + sweep faithful to landed code. validate.mjs carries exactly 5 purchase negative controls (original 3 + scalar item-element items:["SKU"] + price-as-string). ga4-mp.md now states the two-layer split (schema=item shape; connector validatePurchase=purchase business rules), no longer overstating parity. OQ15->RESOLVED in refinement-todo (body matches the validator); oracle.sh no-op accurate (score_ga4_mp_conformance widens coverage purely via validate.mjs, no purchase/validatePurchase ref in oracle.sh); ga4-mp.md updated real. Schema matches deviation-log item 1 (items minItems:1 array of $defs/item, anyOf[item_id|item_name], numeric price/quantity, scalar additionalProperties retained). Golden realistic + in mustPass. No map.js/core/oracle.sh mutation; no closed spec/ADR altered; no _TBD_ stub. No issues.
