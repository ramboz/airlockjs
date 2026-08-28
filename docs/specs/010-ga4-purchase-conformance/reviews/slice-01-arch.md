---
slice: 010-01 — purchase schema shape + golden + validator coverage
pass: arch
verdict: pass
reviewer: arch-review
reviewed_at: 2026-08-28T01:19:55Z
prompt_source: review.py arch-review
substrate: non-interactive
---

Arch 010-01 — PASS (no load-bearing problem). Backward-compatible contract extension: items moved into properties with scalar additionalProperties retained; JSON Schema resolves properties before additionalProperties so the scalar contract for non-items params is preserved; propertyNames + maxProperties:25 still apply; the 4 existing goldens (no items key) unaffected. Oracle now covers purchase (golden mustPass; 3 biting negative controls) closing OQ15. Minimal-item model coherent with the schema-permissive/golden-exact oracle design (a typod item field is caught by the golden, not the schema). Hermetic-stricter-than-/debug honestly grounded in the authority model + real validatePurchase. NITS: item price/quantity permit negatives, item_id/item_name no maxLength (accepted minimal-model trade-offs). RECONCILIATION NOTE: validate.mjs exercises only schema-validation (part a); the golden-match half (part b) is not asserted in validate.mjs for ANY golden (pre-existing pattern) — log so a future slice does not assume npm run validate covers it.
