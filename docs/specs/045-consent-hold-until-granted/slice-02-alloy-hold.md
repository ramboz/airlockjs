---
status: DRAFT
dependencies: [adr-0023]
last_verified:
frame_review: true
arch_review: true
---

<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about runnable
     surfaces by probe first (run it / read source) or a citation, else mark them
     as assumptions in `## Assumptions` — never assert an unverified claim as fact. -->

## Slice 045-02 — apply hold-until-granted to alloy (preserving 034-01)

**Goal:** Refine **`core/wrapped-sdk-host.js`**'s consent enforcement — alloy's OWN path, separate from the core seal —
from today's **pending → DROP** to **hold + flush-on-grant** (the refinement *already named* at
`core/wrapped-sdk-host.js:106-109`), so alloy buffers under unresolved consent and fires on grant (the OneTrust-accept
flow). This **preserves 034-01's per-purpose strip**: under analytics-granted / personalization-denied the analytics
interact still **flows** (pzn data stripped), never held. Implements [ADR-0023](../../decisions/adr-0023-ad-pzn-egress-hold-until-consent.md)
for the alloy vendor, grounded per its captured behavior.

**DoR:**
- ✅ Two-path grounding (spec 045 §A1): alloy egress is enforced by `core/wrapped-sdk-host.js` (strict `egressVerdict` +
  the 034-01 per-purpose seam strip at `:336-338`; pending → DROP today), NOT the core seal — so 045-01 does not touch it.
- ✅ The refinement is pre-named (`:106-109`): "pending → DROP … a pending→hold+flush refinement mirroring 017-03 is a
  named follow-up." This slice IS that follow-up.

**Acceptance Criteria:**

1. **Ground A1 (the alloy egress topology) first.** Read `connectors/alloy/` + `core/wrapped-sdk-host.js`: determine
   whether alloy has a **personalization-only** egress that can hold independently, or whether `personalization` is
   always **co-carried** on the analytics interact (and therefore only *strippable* under 034-01, never *holdable*).
   Record the finding in the deviation log; it sets the exact hold semantics (per the ADR-0023 kill criterion).
2. **Pending consent → hold + flush (was DROP).** When consent is unresolved (pending) for alloy's governing purpose(s),
   `core/wrapped-sdk-host.js` **buffers** the egress and **flushes on a later grant** (mirroring 017-03), instead of
   dropping it. Witnessed by a test driving pending → (held) → `setConsent` grant → (flushed).
3. **034-01 preserved (the load-bearing invariant).** Under analytics-granted / personalization-denied, the alloy
   analytics interact **still flows** with personalization stripped — it is **not** held. All existing 034-01 tests
   (`test/eds-boot-alloy.test.js`, `test/alloy-consent.test.js`, `test/wrapped-sdk-host.test.js`) pass **unmodified**.
4. **Behavior-preserving otherwise + no core-seal coupling.** Full `npx vitest run` green; `core/consent.js` /
   `core/airlock.js` (the g-ads/GA4 path) are untouched by this slice. `arch_review: true` (alloy consent-enforcement
   change).

**DoD:**
- All ACs met; full suite green; A1 grounded + recorded.
- Compliance + craft + arch passes recorded; reconciliation walked.

**Out of scope (explicit):**
- The core seal `holdOnDenied` mode (045-01) and g-ads (044-02) — different path.
- Changing 034-01's strip semantics — this slice adds hold+flush, it does not alter the analytics-flows strip.

## Assumptions

**A1 (alloy egress topology — grounded in AC1).** See spec 045 §A1 + ADR-0023 A1/kill-criterion: if pzn is strip-only
(no separable pzn-only egress), the hold applies to the **pending** case (whole interact buffered until consent resolves)
+ the existing denied-pzn **strip**, and that scoped limit is documented — not a failure.

### Deviation log (after reconciliation)

_(pending implementation)_

### Reconciliation sweep

_(pending implementation)_

### Close-out (post-DONE)

- [ ] Spec 045 rolls up when 045-01 + 045-02 are DONE; regenerate the board.
