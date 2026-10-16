---
status: DONE
dependencies: [adr-0033]
last_verified: 2026-10-16
kind: feature
frame_review: true
---

## Slice 059-13 - Paired validation admission component

**Goal:** An operator can exercise the first Google/Meta paired-validation
admission rules against actual local receiving sinks, and get a bounded,
sanitized result before a separate browser capture executor is allowed to use
them. This is a preparation utility, not either replacement's implementation.

**DoR:**
- [x] The proposed four-case limits and no-retry rule are recorded in
      [the first-journey plan](plan.md#proposed-native-capture-envelope---approval-required).
- [x] Ordinary offline repository work is authorized; no new live-send approval
      is inferred. Qualification uses synthetic inputs and loopback receivers.
- [x] The component is network-agnostic. Tests alone perform HTTP requests, to
      literal IPv4 loopback only. It imports no browser, SDK or network client.
- [x] It changes no runtime/public contract, deployment or closed record.

**Acceptance Criteria:**

1. **Explicit scope, no implicit approval.** A network-agnostic module accepts a
   closed, versioned operator authority record and exact request scopes for at
   most `google-stock`, `google-chamber`, `meta-stock`, `meta-chamber`.
   Missing/proposed/expired/malformed authority, unknown keys/cases or wider
   limits fail visibly before a slot or request is admitted. The record binds
   its fixed private journal directory, source revision and each case's input
   digest. Authority records are trusted operator attestations, not authenticated
   owner decisions; no approved live authority is created by this slice.
   Loopback qualification is explicitly a different evidence layer.
2. **One-shot cases.** A case is reserved durably before its first request using
   exclusive file creation. A second instance/process sharing that record cannot
   reuse the slot; failure, closure or interruption never refunds it. Private
   directory/file permissions are enforced, symlink/nonregular ledger targets
   are rejected, and input objects cannot mutate an admitted policy afterward.
   A candidate additionally requires explicit true caller attestations for
   successful stock completion and candidate eligibility. These are external
   prerequisites, not facts the component independently proves. No journal-path
   override, reset or retry API is supplied.
3. **Exact admission and finite budgets.** Match complete URL bytes, method and
   transport; preserve query order/duplicates, never infer a broad host grant.
   Local fulfillment is declared in the trusted scope, not chosen by a request.
   Scope entries with required parent scope admit only an actually admitted
   earlier parent ordinal. Each redirect/follow-up is a new admission. Count
   all observed requests toward 64, dispatches toward 20 Google / 8 Meta per
   case. Enforce 2 KiB URLs, 64 KiB combined request headers/body, 2 MiB retained
   response bytes and 8 MiB aggregate retained request/response bytes.
   Reserve counters synchronously before returning dispatch permission.
4. **Fail closed through termination.** One monotonic 60-second case deadline
   includes reservation, response retention and termination; authority expiry
   also remains enforced. Unknown destinations, method/transport/marker changes,
   missing/invalid parents, limit violations, clock rollback/nonfinite values
   and missing required response or cleanup evidence stop further admission.
   Duplicate response completion or repeated termination cannot turn failure
   into success. No successful on-disk snapshot is used as independent stock
   completion evidence. A rejected case remains spent.
5. **Real receiver controls.** Hermetic tests use real loopback HTTP receiving
   sinks for positive, enforced-denial, deliberate bypass-sensitivity, redirect
   re-admission and ownership-marker-loss controls. Verify receiver arrival
   counts, one-shot/concurrent reservation, candidate prerequisites, every
   numerical boundary, response/deadline/cleanup failures and output privacy.
   All owned receivers, sockets and temporary artifacts close after completion;
   no vendor SDK, real collector or authenticated profile is touched.
6. **Honest operator contract.** Provide module usage and targeted commands.
   Results expose only fixed case/category/count/state data, not authority
   paths, IDs, URLs, cookies, headers, bodies or their value-derived digests.
   Explicitly retain `live_guard_qualified: false`, vendor dispatch/receipt,
   chamber compatibility and attribution as unproved. A passing local admission
   component does not qualify browser interception, resource ownership,
   response-driven native scope, command cardinality, the complete wire
   recorder, first-slice DoR or Servo readiness. Full live guard qualification
   and fresh explicit permission remain separate gates.

**DoD:**
- [x] Witnessed failing tests precede implementation; focused tests/lint pass.
- [x] Independent compliance, craft and reconciliation passes clear.
- [x] Exact API, trusted-input boundary, limits and nonclaims are documented.
- [x] Source/spec/index prose is reconciled without changing first-slice status.

**Anti-horizontal-phasing check:** The operator gets an executable receiving-
sink verdict for a bounded admission policy, not just a schema or design.

## Assumptions

None.

### Deviation log (after reconciliation)

- Delivered only the network-agnostic admission module, hermetic tests and
  operator guide; no runtime, public contract, build or dependency changes.
- Initial implementation witnessed 131 failing tests, then six additional
  failures among 143 tests. Coordinator integration added a failing original-
  URL retention control (70 counted bytes versus 124 required), then included
  URL bytes in aggregate accounting and exact/one-byte-over boundaries.
- The initial independent compliance finding is preserved in `433cb74`:
  adopting a journal directory could omit parent fsync. Two adoption variants
  failed while two fresh-directory controls passed. Parent fsync now always
  precedes slot creation; injected failure permits zero dispatch reservations.
  Actual corrected compliance review passes.
- Craft review passes. Its nonblocking valid-retry coverage nit was addressed:
  a valid in-scope observation with unused budget remains denied after a
  marker failure, with the original failure and zero dispatches preserved.
- Parent validation is 150 admission tests plus 204 existing comparison tests,
  all passing in one runner; focused ESLint and whitespace checks pass.
- No AC was removed or relaxed. Fixed limits, cooperative executor assumptions
  and all false live/compatibility claims remain explicit.

### Reconciliation sweep

- **Updated:** this slice, its three deliverables, active spec/plan and derived
  status board. Review evidence records actual frame, compliance and craft
  passes; original failed compliance remains in Git history.
- **Updated:** `docs/memory/learnings.md` records the crash-durability and
  URL-accounting lesson without claiming browser qualification.
- **No-op:** runtime/connectors/adapters/contracts/builds/dependencies and
  Accepted/closed records. No module-boundary decision or convention change
  was made; no new ADR or global tool configuration is needed.
- **No-op:** `CLAUDE.md`, root `README.md`, architecture/product vision,
  inbox and refinement todo; their authoring-only status and existing tracked
  first-journey blockers remain accurate. The operator guide is linked here.
- **Deferred, not waived:** full browser/SDK guard, complete native wire and
  independent chamber producer/evaluation, C2/C3, fresh live permission and
  candidate eligibility. Both first product slices remain authoring review.
  The owner supplies a new explicit live grant or complete retained captures;
  the coordinator then owns qualified guard/native evidence and first-slice
  readiness, not a self-approved loop.
- **Leanness:** four fixed cases, exact request scopes, one small operator
  module; no dispatcher, live CLI, policy discovery, reset/refund, generic
  plugin mechanism or new package was added.

### Close-out (post-DONE)

- [x] Regenerate/check the board; preserve both first journeys' open gates.
