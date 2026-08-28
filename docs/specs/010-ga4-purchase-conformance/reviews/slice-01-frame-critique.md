---
slice: 010-01 — purchase schema shape + golden + validator coverage
pass: frame-critique
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-08-28T01:05:19Z
prompt_source: review.py frame-critique
---

Frame-critique 010-01 — VERDICT PASS. The load-bearing assumption (schema can accept an items[] array while keeping other params scalar, and a real mapToMp purchase then satisfies the rest of the pinned schema) survives all three attacks: (a) the restructuring is textbook JSON Schema 2020-12 — named properties.items array subschema + retained additionalProperties: anyOf[scalar], with propertyNames still applied; (b) `items` passes the param-name pattern, `purchase` is a well-formed non-reserved event name, a realistic purchase carries ~6-10 params (far under maxProperties:25); (c) the 4 existing goldens have no `items` key so they resolve through additionalProperties unchanged — zero regression. NON-BLOCKING note folded in: A2 ("items requires item_id or item_name") is accurate to GA4 ecommerce docs but cited only as folk-knowledge — add the GA4 ecommerce-items provenance URL to ga4-mp.md when extending the schema; and note the hermetic schema is intentionally STRICTER than GA4's lenient /debug endpoint (by design, per the hermetic-half-authoritative stance), not a false gate.
