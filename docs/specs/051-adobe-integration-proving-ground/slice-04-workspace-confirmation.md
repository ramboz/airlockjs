---
status: DONE
dependencies: [051-01, adr-0031]
last_verified: 2026-10-09
kind: feature
frame_review: true
arch_review: true
---

## Slice 051-04 — scoped workspace confirmation

**Goal:** An operator can supply explicitly confirmed Target profile permissions when the
documented API omits another property's workspace metadata, without disguising unknown API data
as an empty assignment or bypassing fresh resource checks.

**Grounding:** The real 051-01 report recorded 11 required checks ready and one unknown.
`responses.mjs` rejects the omitted optional `Property.workspaces` rather than inventing a default.
The inspected Target Admin OpenAPI has no default, workspace endpoints or collection filters.
On 2026-10-09 the owner supplied an Admin Console screenshot and explicit confirmation:
the selected Airlock profile includes only the dedicated Airlock property, with three other
properties available but excluded and no automatic assignment rule. The screenshot and exact
selectors remain private. This says nothing about unrelated credential profiles or delivery
environments; property permission exclusions are not Target environment routing.

This new slice extends the operator evidence contract. Closed 051-01 and its evidence remain
unchanged historical records. No stable runtime API, accepted ADR or release gate is changed.

**DoR:**
- [x] Explicit scoped owner confirmation and private screenshot provenance available.
- [x] Existing utility, request inventory and omission regression inspected.
- [x] Independent frame review of the versioned extension and conflict precedence.
- [x] Synthetic ready/unknown/conflict/freshness/redaction fixtures prepared before implementation:
      `test/fixtures/adobe-workspace-evidence.json` plus existing invented preflight fixture.

### Operator evidence extension

The existing invented fixture set and its one-time prepared harness supply all baseline
request/resource/credential replies. Before production edits, implementation prepares a
synthetic workspace envelope from those selectors/digest at the fixture's frozen clock, with
an invented 64-hex screenshot digest and private authority reference. Construct the specified
ready/omission/conflict/stale variants in tests; never use the real screenshot or private values.

Add optional `--workspace-evidence <path>` to the existing CLI, with duplicate/unknown/positional
refusal unchanged. Read it through the existing bounded private-file parser; no new live endpoint,
credential source, arbitrary transport or mutation. Existing input and routing envelopes remain
version 1. Reports become schema version **2**, retaining the same closed row/enum/key set and
adding this documented evidence policy. No report exposes raw selectors, labels, hashes or paths.

The private envelope has exactly:

- `kind:"airlock.adobe-preflight.workspace-evidence"`, `schema_version:1`,
  `basis:"owner-admin-console-confirmation"`;
- `observed_at`, `confirmed_at`, `expires_at`: original UTC RFC3339 timestamps;
  observation <= confirmation <= run start, observation at most 24 hours old and expiry covering
  the entire run deadline. Aggregation never renews observation or expiry;
- `provenance:{authority_ref,record_ref,screenshot_sha256}`: nonempty private references under
  the existing 250-character ceiling, lowercase SHA-256 screenshot digest;
- `bindings`: exact copy of the approved input's full `selectors`;
- `credential_identity_sha256`: the existing non-secret identity digest calculation, matching
  current credentials and approved scope evidence, never a token decode;
- `included_property_ids`: exactly one canonical decimal ID, the selected property;
- `permission_inventory_complete:true`, `automatic_assignment_disabled:true`,
  `owner_confirmed_saved_configuration:true`.

Booleans accept structural false values but cannot establish readiness. Unknown fields,
duplicate keys, malformed scalars/versions/types/symlinks/depth/size use configuration exit 2
before requests; an unavailable optional file leaves the API path intact and supplies no evidence.
Structurally valid mismatched selectors/identity/provenance/included IDs block the required
workspace check. Stale/future/expired/incomplete evidence is unverified. Use existing report
reasons/actions, with no new secret-bearing error text.

### API and manual precedence

Always execute the same bounded property collection when its fresh selected-property prerequisite
passes. Require valid resource IDs, consistent total/count, no duplicates/truncation/next-page
hints, and exactly one selected property with its exact fresh workspace assignment.
Known additional assignment to the selected workspace is a blocked scope conflict.
Malformed present workspace values, missing selected-property assignments, failed HTTP reads,
partial lists or exceeded limits **cannot** be repaired by owner evidence.

Only absent `workspaces` on non-selected properties may leave an otherwise valid, complete
collection pending owner confirmation. Do not treat absence as empty. Without acceptable owner
evidence the required check stays unverified, exit nonzero. With fresh exact evidence and no API
conflict, mark this required row ready with `evidence_basis:"owner_ui_confirmation"`,
`freshness:"accepted_owner_window"` and `http_status:null`. This basis covers only the named
profile's included properties, not exclusive application-wide permissions.

When all assignments are present and complete, retain the ordinary `api_read` result. Supplied
owner evidence still must be validated: mismatched, stale or contradictory evidence cannot be
silently ignored to produce a ready report. Earlier unknowns can be superseded only by a proven
scope/unsafe conflict; explicit API conflicts always win over manual confirmation.
All other required/optional rows, routing semantics, network controls and outcome disclaimers
remain unchanged. A workspace screenshot does not renew routing or owner-selection evidence.

**Acceptance Criteria:**

1. **Usable versioned path.** The real CLI accepts the new private handle and emits schema-v2
   reports. Baseline invocations without workspace evidence retain their prior check states and
   exits, apart from the declared report version.
2. **Bounded exact evidence.** Validate the entire closed envelope, original timestamp precision,
   deadline coverage and current credential/input bindings using existing primitives. Reports
   and stderr disclose only fixed primitives, including every refusal/error path.
3. **No missing-data inference.** A complete collection with an omitted non-selected assignment
   becomes ready only through the approved confirmation basis. Missing/expired/incomplete evidence
   stays unknown; never invent `[]`, make the row optional or add a force-ready flag.
4. **Conflict and error preservation.** Fresh selected-property/tenant prerequisites and strict
   list completeness remain required. Additional known assignments, wrong selected scope,
   malformed present data, partial/denied/transient reads and transport limits cannot be overridden.
   Test conflict ordering independently of response row order.
5. **Evidence separation.** A manual ready row says owner confirmation, never API assignment proof.
   Invalid supplied evidence cannot be hidden by a fully known API list. Other gates and all
   historical reports remain intact; no product/activation/deployment authority is implied.
6. **Grounded operational result.** Run with the exact private screenshot/owner confirmation only
   after contract review and tests. Record the real ready/blocked/unverified result in R-012;
   any other required unknown blocks 051-02 rather than being waived.

**DoD:**
- [x] Meaningful CLI regressions witnessed red-to-green, plus existing preflight/core tests.
- [x] Independent compliance, craft, architecture and reconciliation verdicts recorded.
- [x] Operator guide, live facts, dependency links, board and memory reconciled.
- [x] Original 051-01 records/accepted decisions untouched; real product gates not inferred.

## Assumptions

The owner-confirmed screenshot represents saved permissions for the exact selected profile and
property. Its digest is provenance, not a cryptographic signature or API readback. Fresh API checks
can corroborate current owned selectors but cannot audit hidden application-wide grants.

### Implementation / TDD witness — 2026-10-09

The standalone slice was confirmed READY_FOR_IMPLEMENTATION and transitioned with `workflow.py`
to IN_PROGRESS before edits. No overview status was manually authored. Tests first hydrated the
invented workspace template once from a pristine baseline fixture, then mutated independent
copies; no real selectors, screenshots, credentials or private sources were accessed.

- Red: `npm test -- test/adobe-workspace-evidence.test.js` — 85 failed / 56 passed.
  The executable rejected the new handle (exit 2 instead of 1); the baseline report was still
  v1; manual omission readiness, invalid-supplied-evidence and conflict-order cases failed.
- Green: `npm test -- test/adobe-workspace-evidence.test.js test/adobe-preflight-cli.test.js
  test/adobe-preflight-transport.test.js test/adobe-preflight-evidence.test.js
  test/contract-stability.test.js` — 455 passed / 0 failed (141 new, 278 existing, 36 frozen-core).
- Full default `npm test` — 2,337 passed / 0 failed across 125 files.
- Targeted ESLint on all five changed code files (including normally ignored probes) and
  `node --check` on all three probe modules passed; `git diff --check` passed.

The implementation adds only the private handle/closed validator, exact original-precision
freshness/bindings evaluator, internal structural collection result and report-v2 evidence policy.
Unknown omitted assignments are never defaulted; validated complete collections are scanned for
known conflicts independently of omission row order. All existing fixed rows/claims and the
12-request transport contract remain unchanged. The only baseline fixture expectation edited
was the report version; private input/routing envelopes remain v1.

**Implementation handoff, before reviews/live execution:** operator guidance and open tasks
were updated; DoD boxes remained unchecked. Required independent
reviews and AC6's private live run/R-012 result are explicitly pending with the parent; no
implementation/readiness/reconciliation verdict or real ready result is claimed here.

### Deviation log (after reconciliation)

Implementation and all required independent reviews/reconciliation are complete; this slice is DONE.
No code-scope deviations. The implementer did not access private evidence; the parent subsequently
ran AC6 at 2026-10-09T15:39:14.468Z with the exact owner-bound envelope. Compliance had reviewed
AC1-5 with the operational run pending; this parent run followed that pass and preceded craft/
architecture, which inspected the supplied redacted report without claiming to execute it.
The report returned ready/
exit 0, 12 required ready, four optional unknown and 12 requests. Workspace basis is explicitly
owner confirmation/null HTTP, original routing freshness unchanged. R-012 records the result;
no SDK, deployment, activity activation or product proof followed. Independent implementation
passes are recorded, and historical v1 reports remain intact.
No new dependencies, endpoints, authority, runtime/core changes or closed 051-01 edits.

### Reconciliation sweep

| Disposition | Paths |
|---|---|
| `updated` | `probes/adobe-compatibility/{contract,preflight,responses}.mjs`, its README: closed envelope, omission-only path, v2 semantics, actual report and remaining gates. |
| `updated` | `test/adobe-workspace-evidence.test.js`, `test/adobe-preflight-harness.js`, `test/fixtures/{adobe-workspace-evidence,adobe-preflight}.json`: invented hydrated variants and report-version expectation; no real inputs. |
| `updated` | This slice, open `051/{spec,plan,tasks}.md`, `slice-02-test-baseline.md`, and `reviews/slice-04-*.md`: actual owner evidence dependency/readiness and independent verdicts, not premature stock acceptance. |
| `updated` | R-012, primer and Adobe release live guidance: latest explicit preparation-ready result separately from dated unknown history and wider release obligations. |
| `updated` | Derived spec board/audit and bounded memory learning: owner confirmation applies to selected profile, not global credential exclusivity or delivery-environment routing. |
| `preserved/no-op` | Closed 051-01 records/reviews, accepted ADRs, runtime/core/contracts/conventions/dependency manifests and other product specs. No behavior/authority weakening or historical rewriting. |

Ownership is the workspace diff against integrated `origin/main` at `ae48e1d`, not the helper's
stale-local-`main...HEAD` list. Earlier reframe and 051-01 paths in that helper inventory are
deliberately excluded from this slice: root README, contracts README, architecture/vision,
accepted decisions/index, adoption/validation guides, release/inbox/refinement/research indexes
and prior 015-050 records belong to inherited main. Their precise prior dispositions remain in
closed 051-01's Changed-path dispositions table; that record is referenced, never rewritten here.
Current 051-04-owned paths are exactly the updated groups above and `reviews/slice-04-*.md`.

Leanness: no generic provisioner, arbitrary fetcher, new endpoint, dependency or browser SDK bridge.
Known private-filesystem cancellation residual N1 survives unchanged. No inbox item or unrelated
residual is retired. The independent reconciliation verdict passed; lifecycle helpers derived DONE.

### Close-out (post-DONE)

- [x] Regenerate/audit the board without clearing the unexecuted stock/product gates.
