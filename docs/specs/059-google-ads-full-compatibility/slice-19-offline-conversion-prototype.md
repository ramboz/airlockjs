---
status: RECONCILED
dependencies: [adr-0017, adr-0033, 060-13]
last_verified: 2026-10-26
kind: feature
frame_review: true
arch_review: true
claimed_by: google-and-meta-feasibility
---

## Slice 059-19 - Exercise an offline SDK-free Google conversion

**Goal:** A developer sends queued synthetic `gtag` config/conversion calls
through a real first-party worker and governed loopback receiver, preserving
controlled routing/value relationships while exposing missing native behavior.
This is staged construction, not a complete conversion or replacement claim.

**DoR:**
- [x] ADR-0017/0033 and the completed060-13 local product boundary are read.
- [x] The existing Google connector supports page loads only; inspected
      native policy/reference source grounds primary conversion field names.
- [x] Existing page-load fixtures are synthetic vocabulary, not conversion
      evidence; they cannot be relabelled as a positive conversion reference.
- [x] The offline prototype frame and temporary reuse boundary pass review.

**Acceptance Criteria:**

1. A separate experimental standalone adapter captures synchronous, void
   `gtag("config", "AW-0000000000")` and
   `gtag("event", "conversion", params)` calls. Primitive argument and bounded
   own-property parameter/context snapshots retain capture order before
   worker readiness. Reentrant/disposed capture cannot strand or reorder work.
   Unknown commands/options/callbacks, duplicate config, malformed data and
   pre-config conversions have visible bounded outcomes. These prototype
   rules do not assert native queue, validation, callback or config semantics.
2. Retained config/state, command interpretation and URL construction run in
   a first-party chamber through unchanged `createConnectorHost`. Only the
   synthetic destination above and `SYNTHETIC_LABEL` are accepted; config
   emits zero requests as a deliberate prototype limitation. One conversion
   produces a GET to the configured literal loopback equivalent of
   `/pagead/conversion/0000000000/`, preserving `send_to` destination/label,
   `value` to `value`, `currency` to `currency_code`, `transaction_id` to
   `oid`, and captured page URL to `url`. Do not invent value/currency/
   transaction defaults: omitted, empty and zero remain distinct wherever
   admitted by the explicit prototype schema. Preserve values without
   lossy numeric coercion; nonfinite/unsupported values reject visibly.
3. Reuse unchanged wrapped request/response host, endpoint ceiling and strict
   `ad_storage` enforcement. The trusted driver permits only one explicitly
   configured `http://127.0.0.1:<port>/pagead/conversion/0000000000/` base,
   GET without headers/body, credentials omitted and redirects rejected.
   Pending/denied produce zero receiver arrivals; grant does not replay them.
   This drop rule is not Google's basic/advanced Consent Mode equivalence.
4. A real Node worker bridge runs the actual chamber module with first-import
   confinement. Await the exact correlated mediated response before command
   result; distinguish attempts, local receipt and transport settlement.
   Observe at least two conversions with changed controlled values/transaction
   IDs and page context. Unknown/failing/late responses, worker loss and
   timeouts are visible and terminal where correlation could be lost.
   No returned script, callback or follow-up URL is executed or followed.
5. A local executable example and meaningful positive/negative tests independently
   observe the receiver and close every owned worker/server/socket handle,
   even if an earlier cleanup fails. Cleanup failures remain visible/rejected.
   Demonstrate zero init/config sends, ordered snapshots, route/value mutation
   rejection, unsupported callbacks, consent controls and no late cross-command
   settlement. Ordinary first-party Node/loopback only: no Docker, browser,
   vendor SDK, external request, account/billing or production operation.
6. The report names preserved input-to-local-wire relationships and exact
   missing conversion behaviors; it is always inconclusive for native
   compatibility. Separate synthetic contract assertions from retained native
   evidence. A synthetic page-load fixture cannot score conversion parity.
   Account for missing config/page/remarketing companions, first-party primary
   variant, response-linked fetch/fallback/redirect/cookie branches, identity,
   Consent Mode, callbacks/navigation, browser transport, deduplication,
   matching/attribution and CWV. If an explicitly supplied sanitized native
   ledger is used, cover every observed row/field and its limitations; no raw
   private IDs, URLs, cookies, payloads or value-derived hashes enter Git/output.
   Missing ledger input is visible, not filesystem discovery or new capture.
7. Existing production Google/Meta boots, core modules, frozen contracts,
   build/package/version and closed evidence originals stay unchanged.
   Existing Meta prototype behavior must regress cleanly. Reuse ordinary local
   transport helpers only when it reduces real duplication without broadening
   endpoint policy or creating another runner framework.059-01 and all full
   native/whole-wire/live/C2-C3 criteria remain open and unchanged.

**DoD:**
- [x] Executable adapter/chamber/local example and honest report implemented.
- [x] Real worker/local receiver positives and meaningful negatives executed.
- [x] Targeted new/Meta/contract/host/legacy tests and applicable lint pass.
- [x] Compliance, craft, architecture and reconciliation reviews pass.
- [x] Usage, prototype/full-support distinction, learnings and board updated.

**Anti-horizontal-phasing check:** One executable command-to-worker-to-receiver
conversion journey with an actionable gap report, not an isolated mapper.

## Grounding and approach

- `connectors/google-ads/connector.js:54-64,166-173` only maps page loads.
- `rig/native-stock-policy.mjs:190-198,262-267` names the GET primary route
  and controlled `label`, `value`, `currency_code`, `oid`, `url` relationships.
  Its Google first-party variant and auxiliaries remain separate branches.
- `rig/native-tag-reference.mjs:455-470` independently checks these primary
  route/value relationships; this catalog is not a whole response reference.
- The explicitly supplied private retained ledger was hash-verified as data,
  not executed. A value-free field projection accounts for12 rows,62 unique
  query names and39 ordered pairs in primary ordinal10; response-linked
  ordinal11 remains unqualified. It contains no private values, URLs, IDs or
  source digest. Field presence cannot establish native value/endpoint equality.
-060-13 demonstrates the existing connector/wrapped hosts with actual Node
  messages and local receipt. Keep vendor-specific mapping in a separately
  named Google connector/worker and opt-in source adapter, never core or build.
- Follow current two-caller inline-mirror discipline for vendor-specific
  capture glue. Reuse a small ordinary receiver helper if appropriate; do
  not introduce a generic tag framework or silently couple Google to Meta mapping.

## Assumptions

- Unverified until execution: the first-party conversion parameter capture/
  response correlation fits existing hosts without a frozen-contract change.
- Native omission/coercion/deduplication/callback and secondary-response
  semantics remain unverified; prototype choices cannot stand in for them.

### Deviation log

- The implementation adds separately named Google prototype source, a fixed
  Node bridge, receiver/example, reporter, safe field-only fixture and five
  focused test files. No existing implementation/helper was modified;
  specialized glue is a second-caller inline mirror, not a new framework.
- The public fixture is JSON-data-identical to the explicitly supplied safe
  projection. Private original ledger/check hashes were verified only in
  session artifacts; no raw private values/URLs/IDs or source digest entered Git.
  A page-load fixture was not used as conversion evidence.
- Initial static compliance passed. Craft found three blockers: malformed
  UTF-16 silently changed under URL encoding; encoded overflow became a
  terminal transport failure that lost the next conversion; direct connector
  calls could transmit inherited properties/getters. Six new cases failed
  before correction. Well-formed string admission, null-prototype own-data
  snapshots and a pre-egress8192-character encoded ceiling fixed them;
  a fresh narrow correction review passed.
- Nonblocking review suggestions added positive null-prototype records and a
  well-formed non-ASCII round trip through the actual receiver. These schema/
  encoding restrictions are prototype rules, not native validation claims.
- Parent final validation passed43 new and310 unchanged Google/Meta/host/
  contract tests,353 combined, plus selected lint. Earlier345/189/351 runs
  are different selectors/source epochs, not additive coverage.
- Parent independently ran the corrected real-worker/local example:2 actual
  arrivals,2 transactions/pages,0 init/config/pending/denied/grant replay,
  withheld ambient fetch and closed owned worker/receiver/sockets. Report
  covers every retained row/name/duplicate and keeps INCONCLUSIVE; no vendor
  conversion, callback, secondary branch, browser, CWV or attribution passed.
- Original059-01/C1-C9, full target and all native/live authority stay unchanged.

### Reconciliation sweep

- updated - prototype usage/schema/limits,059 overview/plan/tasks, architecture
  and review history distinguish real offline construction from full support.
- updated - source/value preservation, causal fixes, native-shape inventory
  versus local assertions, response correlation and independent receipt evidence.
- no-op - existing Meta source, core, frozen contracts, EDS/production boots,
  build/package/version, accepted decisions, prior fixtures/closed records and
  failed local-control originals. No deployment, publication or external traffic.
- no-op -059-01/C1-C9 and browser/native/response/whole-branch/CWV/matching/
  attribution gates. Prototype config/consent rules are not native semantics.
- no-op - inbox/refinement residuals remain broader product work; neither the
  legacy Ads subset nor the new prototype is a full replacement.
- updated - memory records own-data validation and lossless text/encoded bounds.
- updated - independent documentation reconciliation passed the bounded
  prototype scope; regenerate/check the board from the lifecycle records.
