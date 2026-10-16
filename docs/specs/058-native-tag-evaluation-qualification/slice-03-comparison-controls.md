---
status: RECONCILED
dependencies: [058-01, 058-02, 058-04]
last_verified: 2026-10-16
frame_review: true
arch_review: true
claimed_by: google-and-meta-feasibility
---

## Slice 058-03 - Value-preserving comparison controls

**Goal:** An operator compares complete scenario sequences and sees material
collection differences without redaction or gap ownership manufacturing equality.

**DoR:**
- [x] The reference and evidence layer are independently qualified.
- [x] The selected scenario inventory and path-specific comparison policy exist
      in the explicitly supplied private ledger. Native control copies use exact
      values; broader cross-run nondeterminism remains unqualified.

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
- [x] The report contract and operator procedure are documented.
- [ ] Servo readiness/suitability may proceed only with their actual prerequisites;
      a green existing GA4/unit oracle is not a Google/Meta qualification artifact.

**Anti-horizontal-phasing check:** The operator obtains a complete comparison
result with actionable differences and explicit evidence boundaries.

## Bounded implementation contract (2026-10-16)

The owner said "ok, do it" to the next offline whole-sequence comparison gate.
This authorizes comparison tooling and its local controls, not additional
downloads, browser/vendor events, site/account changes or chamber implementation.
The earlier one-hour acquisition grant is closed. This is a separate bounded
mission within the same approximate shared preparation target; exact credit
metering remains unavailable. The coordinator chooses a conservative stop at
19:08:51Z, one hour after this request, without claiming an owner-specified
new numeric budget or an enforced credit cap.

- Deliver one offline `rig/native-tag-comparison.mjs` command/API, its hermetic
  targeted test file and operator guide. Reuse established bounded private-file,
  report/state and exclusive-output patterns; do not change the browser runner,
  legacy curated parity oracle, global oracle or `.servo` state.
- Inputs are an explicit private bounded manifest selecting reference/candidate
  report/capture files, their byte digests, expected reference cohort/pins,
  named evidence layer and finite comparison rules. No directory discovery,
  arbitrary executable, network dependency or automatic acquisition.
- Validate source/reference qualification, report/capture identities and counts,
  expected positive cases, exact runtime/configuration/browser pins, complete
  available records and raw-value provenance before comparison. A comparison
  control copy is explicitly labeled, never actual chamber execution.
  Require an explicit source-owner completed-command receipt tied to the same
  run and report/capture byte digests: a report file alone can precede a failed
  final return. Missing or unsuccessful completion evidence is inconclusive.
  A local attestation is not claimed as an independent cryptographic signature.
- Compare the complete ordered recorded request sequence, including destination,
  method, ordered duplicate query fields and encoding, captured headers/cookies,
  request/response bytes and completeness states, and recorded redirect/fan-out
  edges. Unknown fields or unavailable required evidence remain visible.
  Observation IDs/times and generated-fixture metadata have a fixed, documented
  non-wire disposition; there is no arbitrary field denylist or owned-gap pass.
- Exact private values are the default. Optional narrowly typed relationship
  rules identify individual recorded fields, validate nonempty identity reuse
  and distinctness, or validate same-input SHA-256 after explicit fixed
  normalization. They must validate original values and relationships before
  internal comparison symbols/privacy projection. No regex/eval, generic
  replacement, equal-redaction sentinels or presence-only hash proof.
  The selected native controls are exact-only: nonempty native normalization
  policies remain inconclusive until separately qualified. Local relationship
  controls cannot authorize normalizing a changed destination/action, value,
  consent setting or source pin into a match.
- Native-attempt comparisons consume the already qualified Meta/Google
  artifacts without re-executing them. Their missing vendor responses/cookie
  attachment/initiator proof cannot become whole-wire equality. A requested
  whole-wire result with these artifacts is inconclusive, even for an identical
  copy. Declared complete local synthetic sequences exercise response/cookie/
  redirect/fan-out mechanics without claiming vendor execution.
- A fixed mutation qualification mode links every failing control to an actual
  positive comparison. Apply request drop/duplication, destination/value/consent/
  identity changes, response truncation, edge loss, empty-reference,
  equal-redaction and stale-pin controls. Require the intended mutation and
  expected reason, not an unrelated earlier input failure.
- Public output contains only fixed categories/counts/ordinals and source-byte
  provenance; raw fields, values, rule names and detailed differences remain in
  new owner-only output. No per-value hashes leak into public output. Bound
  file sizes, nesting, record/rule/difference counts and the total run, including
  acquisition/output. Existing outputs, symlinks, FIFOs and deadline failures
  cannot yield success.
- A comparator/control pass never proves complete vendor replacement,
  dispatch/receipt, cookie acceptance, matching/reporting/attribution, browser
  host effects or actual chamber execution. 059/060 readiness remains separate
  even if this shared implementation slice eventually closes.

## Grounding

`test/parity-oracle.test.js:30-45` demonstrates the older oracle can pass
normalized-out and gap-owned omissions; `test/parity-google-ads.test.js:1-20`
uses a redacted real-shaped fixture. These are intentional historical contracts,
not reusable complete/value-preserving acceptance. Do not weaken or rewrite them.
`rig/native-tag-reference.mjs:58-137` provides the established private report and
bounded regular-file patterns. Explicit qualified Meta and Google artifact
handles are supplied in the private comparison manifest, not discovered.

## Assumptions

- The retained capture representations support exact observed-attempt comparison
  and falsifiable local response/relationship controls. They do not contain
  complete actual vendor responses; a broader requested layer must stop.
- A finite set of typed field relationships is sufficient for this comparator
  qualification. Undeclared native nondeterminism is not silently normalized;
  cross-run/vendor adoption needs separately evidenced scenario-specific rules.

### Close-out (post-DONE)

- [ ] Regenerate/check the board; consolidate comparison and drift learnings.

### Deviation log (after reconciliation)

Implemented the new offline command/API, hermetic tests and operator guide.
The older curated parity oracle and pinned native producers remain unchanged.
Source qualification requires a completed-command owner attestation tied to
run and file digests, not a qualified-looking report snapshot. Attestations
remain a trusted local statement, not independent cryptographic authentication.

Actual parent CLI checks cover 34 outcomes: exact Meta, Google and declared
local control copies pass; both native whole-wire requests are inconclusive;
29 intended mutations return nonzero with an applied/detected marker and a
linked qualified positive. Native controls change recorded attempts only.
Complete response/cookie/redirect/fan-out mechanics use declared local
synthetic data, not invented vendor responses. The initial 97-case hermetic suite and
focused lint pass without browsers, SDK execution, downloads or event dispatch.

Controls use a closed individual `--control NAME`, returning the intended
failing result rather than an aggregate success-shaped mutation result. The
parent's initial driver assumed an unsupported `mutations` suite flag and
correctly received invalid-input; the driver was corrected to exercise every
documented individual control. No expectation, comparator or oracle was relaxed.

Native comparison remains exact-only. Nonempty native normalization policies
are inconclusive; local typed relationship/hash controls do not authorize
normalizing routing/action/value/consent changes into equality. Original
values, query duplicates/encoding, body states and identities are checked
before privacy projection. Whole-wire, independent candidate/chamber,
matching/reporting/attribution and full-vendor readiness remain unproved.
The earlier Google lost-trace failure is not explained by this new consumer.

Initial compliance found two real gaps missed by the first 97 tests/34 CLI
checks: arbitrary local identity selectors could normalize protected value
changes, and dropping a linked tail could fail edge validation before reaching
the intended sequence comparison. The original needs-changes verdict is retained
in `9c5f6cd`. Regression tests first recorded 13 failures; closed synthetic
identity/hash target allowlists and dependent-edge reconciliation then produced
109 passing tests plus all 34 repeated CLI outcomes. Validation remains strict.
Previously accepted arbitrary/opaque local selectors now return
`rule_target_unsupported`; this is an intentional tightening before release.
Craft then found missing/coerced native guard counters could pass JavaScript
less-than checks. Its original blocker is retained in `a1eebb8`. Safe-integer,
exact pinned counters and strict guard markers now replace those checks, with
48 missing/type/range/count regressions. A different-case normalization
positive and actual input-projection-removal failure strengthen the hash proof.
The witnessed craft red baseline was 19 failed/139 passed; final parent
validation is 158 passing tests, focused lint and all 34 CLI outcomes repeated
with unchanged privacy/product-claim boundaries. Incomplete guard evidence is
now inconclusive, not accepted by coercion.
Architecture additionally found partial cleanup objects could omit required
native closure evidence. Its initial blocker is preserved in `e3fdc7f`.
Both native profiles now require all four cleanup own-properties strictly true;
local fixtures require their closed `complete: true` declaration. The witnessed
red baseline was 16 failed/188 passed, followed by 46 cleanup regressions and
final parent validation of 204 passing tests, focused lint and all 34 CLI
outcomes. No optional metadata field is globally reclassified as mandatory.
Actual compliance, craft and architecture follow-ups now clear the REVIEWED
gate; their initial blockers remain in Git. Reconciliation, implementation
commit and DONE remain separate required gates.

### Reconciliation sweep

- Scope: this pass starts after inherited branch checkpoint `b8fa41b`.
  Earlier ADR-0033, native qualifier/profile code and 059/060 authoring history
  are excluded except for directly named live documentation updates. No
  closed 058-01/02/04 record or Accepted decision is amended.
- Updated: `rig/native-tag-comparison.mjs`, its `.test.mjs` and `.md` provide
  one bounded offline consumer and procedure; no new dependency or framework.
- Updated: this slice, shared `plan.md`/`tasks.md`/`spec.md` and the regenerated
  `docs/specs/README.md` distinguish comparator proof from vendor readiness.
- Updated: `README.md` links the consumer and explains copied/local versus
  whole-wire evidence; `docs/architecture.md` preserves rig-local/no-runtime
  scope; `docs/refinement-todo.md` retains full-vendor/native-policy residuals.
- Updated: 059/060 `spec.md` and 060 `plan.md` consume named evidence layers,
  not copied-reference/rollup passes. No-op: 059 `plan.md` already requires
  case-specific complete reference and numerical/runtime readiness gates.
- Primer: `CLAUDE.md` retains the active checkpoint while review proceeds;
  remove the completed 058 active entry only after actual final DONE, carrying
  the bounded tool links and remaining gates into the still-active vendor entry.
- Updated: `docs/memory/learnings.md` preserves completed-command evidence and
  attestation trust limits. Memory summary/team check complete (existing opt-out).
  Coverage has zero missing/dangling use cases; nine older unrelated orphans
  remain unchanged. No-op: `docs/inbox.md` contains no item resolved by this
  scoped consumer; no UI/lightweight decision or convention change is introduced.
- No-op: core/connectors/frozen APIs, Adobe/site assets, native browser
  runners, legacy curated/global oracles, `.servo` and convention/approval
  state. No public runtime boundary or new load-bearing design choice changes;
  the stricter acceptance implements ADR-0033 rather than rewriting old gates.
- Deferred: actual native whole-wire responses/cookies/host effects, reviewed
  native cross-run policies, source-ownership authentication, complete vendor
  scenarios, numerical performance/readiness and chamber/outcome proof remain
  owned by 059/060 and further explicitly authorized evidence work.
- Leanness: a single rig-local consumer reuses established file/report
  patterns; no browser producer refactor or unrelated cleanup is introduced.
- Completed: actual post-implementation review evidence and REVIEWED gate.
- Pending: reconciliation review, post-DONE primer hygiene and actual
  reconciliation/commit/DONE gates.
