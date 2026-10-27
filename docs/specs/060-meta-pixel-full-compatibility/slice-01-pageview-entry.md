---
status: READY_FOR_REVIEW
dependencies: [adr-0033, 058-01, 058-02, 058-03]
last_verified:
kind: feature
frame_review: true
arch_review: true
claimed_by: google-and-meta-feasibility
---

## Slice 060-01 - Replace bootstrap and first PageView

**Goal:** An integrator replaces the native snippet, submits the first PageView
through fbq and sees actual governed chamber dispatch with a truthful comparison.

**DoR:**
- [x] ADR-0033 is Accepted for the target.
- [ ] This slice frame and proposed boundary fit are reviewed.
- [x] Parent supplies current legacy boot/seal/worker/source evidence without
      modifying ADR-0017's frozen contracts; gaps are recorded, not qualified away.
- [ ] 058-01/02/03 qualify the exact Meta recorder, positive `native_attempt`
      reference and comparison surface needed for this journey. A selected
      headed positive now exists; full native wire/independent chamber evidence
      is still missing, and the original headless cohort remains inconclusive.
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
   replace the complete independently qualified scenario reference.
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

## Readiness checkpoint - 2026-10-16

**Current reference preparation - 2026-10-27:**060-13/14 local construction
is DONE, but this full first journey remains READY_FOR_REVIEW and blocked before
implementation. The [bounded native-reference packet](meta-native-reference-plan.md)
uses existing058/059-15/18 owners and the sole additional grant. Per-case
execution mode and actual run approval are private session/case records,
not a new ADR or a native lease. Current cohort/guard/acquisition/setup/stop/permission gates
remain open. Original criteria above and all C1-C9 stay unchanged; neither
deferred operator slice is silently reopened.

**Current navigation:** the dated checkpoint and full criteria above are
preserved.060-13/14 are completed local construction, not admission to implement
full060-01. The bounded reference plan is the next reviewed preparation step.
The [delivery queue](../../releases/vendor-parity-assurance.md#googlemeta-delivery-queue-2026-10-26)
maps evidence/capability blockers and later feature owners without excluding
anything the first native-equivalent PageView actually requires.

**READY_FOR_REVIEW (authoring) / blocked before implementation**. The
blocked-draft frame pass is not boundary-fit or live authority approval.
The [first-path source plan](plan.md#first-journey-readiness-checkpoint---2026-10-16)
and actual built-worker probe establish a functioning legacy substrate, not
native bootstrap/PageView parity. The boot installed no `fbq`; its parameter-free
PageView carried only the configured ID/event, lacked 74 native query-field
occurrences in the retained baseline and used a different default path spelling.
Its main-side transport was Fetch, not the native reference's Image.

The 058-02 headed SDK/dependency-positive attempt is not missing anymore.
Do not conflate it with the older headless no-beacon or unpaired owner receipt.
Complete response/cookie/configuration/host effects, native queue semantics,
independent chamber capture and evidence-backed performance remain required.
The linked paired four-case plan requests authority; it does not grant it or
claim the existing no-send guard can be disabled for live use. No site,
runtime, account or `.servo` approval changed.

## Resumption note - 2026-10-19

The owner approved the bounded four-case envelope; every case remains unspent.
The historical 2026-10-16 checkpoint is preserved. Actual local browser/admission
controls do not close fresh setup, exact live policy, headed/native-default
wire, measured C2/C3 or independent chamber prerequisites. This product slice
remains in authoring review.

## Assumptions

- Unverified: current entry/bridge seams can preserve the reference's fbq
  invocation behavior without changing the frozen synchronous/void push API.
- The selected headed automated PageView attempt is grounded by 058-02; relevant
  actual response/cookie/host evidence remains unverified. The older headless
  and unpaired-owner observations keep their own scope and unresolved history.

### Close-out (post-DONE)

- [ ] Parent regenerates/checks the board, records durable learnings and adjusts
      primers only if warranted; no new release or other-vendor claim is implied.

### Deviation log (after reconciliation)

Not implemented. No deviations, reviewed behavior or validation pass is claimed.

### Reconciliation sweep

Pending implementation. Capture/boot documentation, stable contracts, support
inventory, shared site/Adobe coexistence and parent-owned board require a real
sweep; none is marked checked or updated by this DRAFT.
