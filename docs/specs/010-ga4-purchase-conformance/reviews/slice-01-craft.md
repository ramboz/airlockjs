---
slice: 010-01 — purchase schema shape + golden + validator coverage
pass: craft
verdict: pass
reviewer: pr-review
reviewed_at: 2026-08-28T01:19:54Z
prompt_source: review.py pr-review
substrate: non-interactive
---

Craft 010-01 — PASS (no blockers). STRENGTHS: anyOf[required item_id|item_name] is the idiomatic ">=1 of" pattern; the golden is realistic + faithful (param order mirrors mapToMp spread-then-append; value 59.98 = price 29.99 x qty 2). NITS (ADDRESSED post-review): (1) negative controls missed a scalar item ELEMENT and price-as-string -> ADDED both mustFail controls (close AC1 price/quantity-number mutation coverage). (2) ga4-mp.md overstated schema/validatePurchase parity (schema enforces only non-empty items, not transaction_id/currency/negative-value) -> CORRECTED to a two-layer split (schema=item shape; connector=purchase business rules). (3)[nit] item-level additionalProperties string has no maxLength (params-level capped 100) — permissive-by-design, noted. RECONCILIATION NOTE: schema/runtime split (schema doesnt enforce purchase-required-fields; map.js does) now stated in ga4-mp.md.
