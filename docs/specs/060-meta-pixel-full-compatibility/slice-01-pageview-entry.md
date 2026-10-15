---
status: DRAFT
dependencies: [adr-0033, 058-01, 058-02, 058-03]
last_verified:
kind: feature
frame_review: true
arch_review: true
---

## Slice 060-01 - Replace bootstrap and first PageView

**Goal:** An integrator replaces the native snippet, submits the first PageView
through fbq and sees actual governed chamber dispatch with a truthful comparison.

**DoR:**
- [ ] ADR-0033 is Accepted; this frame and the proposed boundary fit are reviewed.
- [ ] Parent supplies current capture/boot/seal/seam evidence without modifying
      ADR-0017's frozen contracts.
- [ ] 058-01/02/03 qualify the exact Meta recorder, positive `native_attempt`
      reference and comparison surface; the present no-beacon case is unresolved.
- [ ] Explicit private handles supply pinned resources, owned page/source,
      browser/profile/settings and a separate finite actual-dispatch grant.

**Acceptance Criteria:**

1. An adopter uses the documented replacement boot path and existing fbq calls
   with native `fbevents.js` absent. Pre-ready and post-ready init/PageView calls
   traverse capture, ordered serialized chamber processing and mediated dispatch;
   the report distinguishes worker execution from attempted and actual wire.
2. The pinned native bootstrap's applicable callable/queue/alias, duplicate
   installation and readiness behavior is reproduced under identical inputs.
   Argument snapshot/mutation, ordering, repeated init and return/error behavior
   are observed, not inferred from an empty queue or a published bootstrap alone.
3. The PageView comparison applies spec C1-C9: complete requests/responses and
   browser/DOM effects, including dependency/configuration traffic. New/private
   fields are classified and owned, not omitted. Initialization alone is not
   assumed to generate the explicitly requested PageView.
4. Default-on and exact `meta-pixel=off` policy are preserved on the owned setup.
   An exact duplicate off suppresses Meta initialization even beside another
   value. Pair these negatives with a qualified enabled positive; two silent
   profiles cannot pass. No persistent opt-out or consent API is invented.
5. Removing a PageView, adding an extra send, altering the Pixel/URL/value,
   blocking runtime/configuration, disabling the observer and substituting the
   known empty reference each fails or becomes inconclusive as appropriate.
   HTTP 200, callable fbq, one Pixel record and owner Test Events receipt cannot
   replace the missing automated positive.
6. The operator receives per-call/request correlation and a visible held,
   dropped, denied, unavailable or incomplete explanation without identifiers
   in public output. No main-thread mapping/hash work, direct-connector shortcut,
   unrestricted fallback or stable-core signature change is introduced.
7. With separately approved live evidence, actual official-endpoint
   dispatch/response and any newly correlated receipt are recorded as separate
   layers. The historical owner-confirmed receipt stays unpaired and
   not agent-witnessed; attempts are not upgraded to delivery.

**DoD:**
- [ ] C1-C9 and every numbered criterion have witnessed positive/failing controls.
- [ ] Targeted integration/contract tests and applicable lint pass; native absence
      and actual serialized dispatch are evidenced, not mocked away.
- [ ] Independent compliance, craft, architecture and reconciliation reviews pass.
- [ ] Adopter instructions, exact evidence and unresolved support rows are updated.

**Anti-horizontal-phasing check:** The integrator gets a first actual
replacement PageView plus an actionable report, not a queue/parser-only layer.

## Assumptions

- Unverified: current entry/bridge seams can preserve the reference's fbq
  invocation behavior without changing the frozen synchronous/void push API.
- Unverified: a positive automated native PageView and relevant actual browser
  response evidence can be acquired with the approved boundaries. Current
  automated/owner differences have unknown cause.

### Close-out (post-DONE)

- [ ] Parent regenerates/checks the board, records durable learnings and adjusts
      primers only if warranted; no new release or other-vendor claim is implied.

### Deviation log (after reconciliation)

Not implemented. No deviations, reviewed behavior or validation pass is claimed.

### Reconciliation sweep

Pending implementation. Capture/boot documentation, stable contracts, support
inventory, shared site/Adobe coexistence and parent-owned board require a real
sweep; none is marked checked or updated by this DRAFT.
