---
status: DRAFT
dependencies: [058-01, 058-02]
last_verified:
frame_review: true
arch_review: true
---

## Slice 058-03 - Value-preserving comparison controls

**Goal:** An operator compares complete scenario sequences and sees material
collection differences without redaction or gap ownership manufacturing equality.

**DoR:**
- [ ] The reference and evidence layer are independently qualified.
- [ ] The vendor's scenario inventory and path-specific nondeterminism rules exist.

**Acceptance Criteria:**

1. Reports distinguish actual matching values, preserved relationships,
   presence-only evidence, unknown fields, forbidden dispatch and missing
   evidence. A known gap or unknown field cannot qualify full replacement.
2. Compare request sequence/multiplicity, methods/destinations, duplicate query
   values, body/headers, cookies, transaction/event references and fan-out/redirect
   links. Every exclusion is named, justified and scope-visible.
3. Same-input normalization/hashing and cross-request identity continuity are
   checked before privacy transformation. Equal redaction sentinels alone fail
   the value-equality requirement.
4. Deliberately drop a request, alter routing/value/consent/identity, duplicate
   a conversion, truncate a response and substitute an empty reference. Each
   control must fail or become inconclusive as specified; none may exit 0.
5. Local controls may qualify the comparator, but cannot claim actual chamber
   execution, native vendor receipt, matching or attribution. Vendor specs own
   those actual scenario gates and browser-side outcomes.
6. A changed runtime/configuration/browser pin marks the reference stale and
   prevents a fresh compatibility pass until requalified. It does not silently
   change production collection or authorize a live recapture.

**DoD:**
- [ ] Mutation controls, targeted tests and required independent reviews pass.
- [ ] The report contract and operator procedure are documented.
- [ ] Servo readiness/suitability may proceed only with their actual prerequisites;
      a green existing GA4/unit oracle is not a Google/Meta qualification artifact.

**Anti-horizontal-phasing check:** The operator obtains a complete comparison
result with actionable differences and explicit evidence boundaries.

### Close-out (post-DONE)

- [ ] Regenerate/check the board; consolidate comparison and drift learnings.

### Deviation log (after reconciliation)

Not implemented.

### Reconciliation sweep

Pending implementation.
