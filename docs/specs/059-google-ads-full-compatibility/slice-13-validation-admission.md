---
status: IN_PROGRESS
dependencies: [adr-0033]
last_verified:
kind: feature
frame_review: true
claimed_by: google-and-meta-feasibility
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
- [ ] Witnessed failing tests precede implementation; focused tests/lint pass.
- [ ] Independent compliance, craft and reconciliation passes clear.
- [ ] Exact API, trusted-input boundary, limits and nonclaims are documented.
- [ ] Source/spec/index prose is reconciled without changing first-slice status.

**Anti-horizontal-phasing check:** The operator gets an executable receiving-
sink verdict for a bounded admission policy, not just a schema or design.

## Assumptions

None.

### Deviation log (after reconciliation)

Pending implementation.

### Reconciliation sweep

Pending implementation.

### Close-out (post-DONE)

- [ ] Regenerate/check the board; preserve both first journeys' open gates.
