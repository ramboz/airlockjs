# First-journey admission: bounded local preparation

Implements [slice 059-13](../docs/specs/059-google-ads-full-compatibility/slice-13-validation-admission.md)
and its [proposed limits](../docs/specs/059-google-ads-full-compatibility/plan.md#proposed-native-capture-envelope---approval-required).
This is a network-agnostic operator utility, **not** a browser guard, either
vendor replacement, capture executor, comparison engine, or live-send approval.
There is no CLI or arbitrary live-network dispatch mode.

## Trusted inputs and evidence layers

An authority is a **trusted operator attestation**, not an authenticated owner
identity, signature, or independently verified owner decision. The caller must
obtain genuine current authority separately. This slice writes no approved live
authority. The tests construct only synthetic `local-control` records in memory,
with real HTTP receivers at literal `127.0.0.1`. That evidence layer is expressly
not live approval. `operator-attestation` is a schema label, not authentication.

The caller supplies a plain data record, with exactly the keys below. Unknown,
missing, malformed or wider fields reject. `schema_version` is exactly `1`;
`status` must be `"approved"` (including a synthetic approved **local-control**
test attestation). Missing/proposed/expired records cannot reserve a case.

```js
{
  schema_version: 1,
  status: "approved",
  evidence_layer: "local-control", // or "operator-attestation", never inferred
  authority_id: "<private nonempty operator reference, at most 128 UTF-8 bytes>",
  source_revision: "<40 or 64 lowercase hex characters>",
  expires_at_ms: /* finite nonnegative wall-clock milliseconds */,
  journal_dir: "<fixed absolute normalized private directory>",
  limits: {
    observed_requests: 64, google_dispatches: 20, meta_dispatches: 8,
    url_bytes: 2048, request_bytes: 65536, response_bytes: 2097152,
    retained_bytes: 8388608, duration_ms: 60000
  },
  cases: [{
    case_name: "google-stock",
    input_digest: "<64 lowercase hex characters, supplied case input digest>",
    ownership_marker: "<private nonempty exact marker, at most 128 UTF-8 bytes>",
    scopes: [{
      id: "initial",
      url: "http://127.0.0.1:12345/receive?dup=one&dup=two&encoding=%2f",
      method: "POST", transport: "fetch", resource: "Fetch",
      mode: "dispatch", parent_scope: null, required_response: true
    }]
  }]
}
```

This is a schema illustration, **not an authority to copy into a live run**.
There are one to four unique fixed cases: `google-stock`, `google-chamber`,
`meta-stock`, `meta-chamber`. Each has 1–64 unambiguous scopes; IDs are
`[a-z][a-z0-9-]{0,63}`. Parent scopes must exist in the same case with no cycle.
Methods: `GET`, `POST`, `HEAD`, `OPTIONS`, `PUT`, `PATCH`, `DELETE`.
Transports: `fetch`, `xhr`, `beacon`, `image`, `script`, `document`.
Resources: `Fetch`, `XHR`, `Ping`, `Image`, `Script`, `Document`.
These are exact executor labels, not evidence those browser surfaces are supported.
Modes: `dispatch` or `local`; response policy is a strict boolean.

Local-control scopes accept only HTTP URLs with the literal authority host
`127.0.0.1`, not alternative integer/abbreviated IPv4 spellings;
operator-attestation scopes require HTTPS. Neither permits URL credentials,
fragments, whitespace or backslashes. URL matching uses the complete **original string**:
no query sorting, duplicate removal, percent-encoding normalization, host grant,
automatic redirects, scope discovery or expansion. Parsing is not fetching.

All policy primitives are detached and frozen before reservation. Caller
mutation cannot expand an admitted policy or remove response requirements.
The record binds its journal directory, source revision and per-case input
digest; the invocation must match the latter two. The component compares pins;
it does **not** compute a source checkout/case-input digest or verify it against
the actual executor. Accessors, proxies, hostile JavaScript in-process, clock
providers that lie, and false trusted attestations are outside this boundary.

## API and cooperating executor contract

```js
import { reserveCase } from "./first-journey-admission.mjs";

const gate = reserveCase({
  authority, case_name: "google-stock",
  source_revision: pinnedRevision, input_digest: pinnedCaseInputDigest,
  prerequisites: null
});
const permission = gate.admit({
  url: exactObservedUrl, method: "POST", transport: "fetch", resource: "Fetch",
  ownership_marker: observedOwnershipMarker, parent_ordinal: null,
  headers: serializedObservedHeaderBytes, // Buffer, including cookies if present
  body: observedBodyBytes                // Buffer, empty Buffer if absent
});
if (permission.allowed && permission.action === "dispatch") {
  // Separate, trusted executor dispatches ONCE, only after this permission.
  // Each redirect/follow-up MUST return to admit(), without automatic following.
  // Executor retains faithful headers/body, then attests full completion:
  gate.complete({
    ordinal: permission.ordinal, headers: retainedResponseHeaderBytes,
    body: retainedResponseBodyBytes, complete: true
  });
}
// After settling/aborting owned requests, removing observers and closing owned
// resources, supply real cleanup evidence. A false/missing field is failure:
const result = gate.terminate({
  observers_removed: true, pending_requests_settled: true, owned_resources_closed: true
});
```

All methods are synchronous. `reserveCase` performs exclusive, durable
reservation **before returning any dispatch permission**. A chamber invocation
requires `prerequisites: { stock_completed: true, candidate_eligible: true }`
with exactly those strict boolean attestations. They assert successful stock
completion and all applicable candidate gates (including C2/C3, boundary,
implementation and independent evaluation). The module does **not** prove them
or promote a candidate from a successful-looking report/snapshot on disk.
Stock invocations require `prerequisites: null`.

An optional trusted `clock: { monotonic: () => number, wall: () => number }`
supports deterministic tests. Defaults are `performance.now()` and `Date.now()`.
Function references are captured once. Values must be finite nonnegative
numbers, never coerced; either clock rolling back or throwing fails closed.
The absolute monotonic deadline starts before validation/reservation, includes
durable reservation and termination, and is never renewed. Exactly 60,000 ms
is within budget; one over fails. Wall time must remain strictly below expiry
at reservation and throughout every active operation, including `report()`.
The utility is cooperative, not a watchdog: it cannot preempt blocked code or
enforce a deadline if the executor stops calling it. A terminal report is a
historical local outcome, not evergreen authority to dispatch.

`admit` returns only `{ allowed, action, ordinal, result }`, with action
`dispatch`, `local` or `stop`. Ordinals are zero-based and allocated only for
admitted observations. Local fulfillment is determined by the trusted scope,
not an observation field. If a scope requires `parent_scope`, its observation
must identify an actually admitted earlier ordinal of that exact scope;
unparented scopes require `parent_ordinal: null`. A link is admission evidence,
not proof of causality, an HTTP redirect status, or a browser ownership marker.
`complete` accepts exactly the four illustrated fields, and `terminate` exactly
the three cleanup booleans. `report`, `complete` and `terminate` return fresh
sanitized snapshots.

The executor must faithfully supply the complete observed URL, method,
transport/resource, marker, serialized header bytes and body bytes, and report
every observation, including locally fulfilled requests. Only actual Buffers
are accepted for headers/bodies; strings, typed arrays and caller size counters
are not. The module uses the intrinsic typed-array byte-length getter, not an
overridable `byteLength` field, computes budgets synchronously, and retains only
counts and completion metadata, not raw bytes. Buffers may subsequently be mutated
without changing reserved budgets. This is **not** proof that observations
match a browser's final headers/cookie attachment or actual wire bytes.

Every active observation counts toward 64, including a rejected observation.
The first over-limit observation reports 65; no further admissions are possible.
Dispatch reservations are synchronous and capped at 20 Google / 8 Meta per
case, including redirects/follow-ups. Local fulfillments consume observations
and retention, not dispatch slots. All byte ceilings are inclusive:
2,048 UTF-8 URL bytes, 65,536 combined request header/body bytes,
2,097,152 combined retained response header/body bytes **per response**, and
8,388,608 combined retained original URL, request header/body and response
header/body bytes per case. URL bytes count toward both their own ceiling and
the aggregate retention ceiling, not the 65,536-byte request header/body ceiling.
No streaming/truncation fallback, size coercion, reset, refund or retry exists.

Unknown fields/scopes, scope or marker changes, invalid parents, limits,
deadline/expiry/clock failures and invalid response evidence latch failure.
Completion must be strict `true`, for an admitted ordinal, once only.
Termination requires every scope-declared required response and strict complete
cleanup evidence. Every successful case also needs **at least one dispatched
request with a complete response**: an empty/local-only/uncompleted pass is not
candidate eligibility. Failure cannot recover through later completion or
termination. Repeated termination invalidates a prior success; repeated calls
after failure remain failures. No API method dispatches or closes external
resources on the caller's behalf.

## Durable one-shot journal

Use a dedicated fixed directory per trusted authority on a local filesystem
with reliable exclusive creation/fsync semantics. The utility creates it with
mode `0700`, or rejects an existing nonprivate/symlink/nondirectory target.
The journal's parent is fsynced even when adopting an existing directory:
another process may have stopped between creation and parent fsync. It exclusively
creates `<fixed-case>.reserved` with mode `0600`, writes a fixed
spent record, fsyncs the file and directory, then checks the deadline/expiry
again. Existing private regular reservations are **spent**, never reused.
Symlinks, nonregular files, multiply linked files, wrong ownership and wrong
permissions reject. It does not chmod unsafe existing targets into acceptance.
An I/O failure after creation leaves the slot spent, not rolled back.

Termination appends/fsyncs a fixed `closed` record to the same regular private
file, verifying the original inode/device. Neither record is an approval,
success certificate, source snapshot, or stock/candidate eligibility receipt.
No authority values, source/input digests, request data or public reports are
written to the ledger. No path override or journal reset API exists.
A second instance or external process using the same record/directory cannot
reserve the case, even after failure, closure or process interruption.
An interruption before the exclusive creation itself has not reserved a slot.

Trusted journal ancestors/filesystem and exclusive access by the operator are
assumptions. Journal tampering, deleting/copying the directory, or duplicating/
altering authorization itself is **outside the trust boundary**, not magical
process containment. The utility cannot prevent a sender from ignoring it.
Only owned test artifacts are deleted by tests, never by the module.

## Public results, failure categories, and nonclaims

Snapshots expose only schema version, fixed case or null, fixed evidence layer
(`local-control`, `operator-attestation`, `none`), state, category, numeric counts,
and explicit false claims. States: `reserved`, `active`, `succeeded`, `failed`.
Categories: `reserved`, `admitted`, `completed`, `success`, `authority_invalid`,
`candidate_prerequisite`, `slot_spent`, `journal_invalid`, `clock_invalid`,
`authority_expired`, `deadline`, `already_terminated`, `observed_limit`,
`request_invalid`, `url_limit`, `scope_mismatch`, `parent_invalid`,
`request_limit`, `retained_limit`, `dispatch_limit`, `response_invalid`,
`response_duplicate`, `response_limit`, `cleanup_invalid`, `response_missing`,
`empty_case`. The first failure remains latched.

Counts are observed/admitted requests, dispatches, local fulfillments, completed
responses and retained bytes. They are admission bookkeeping, **not** actual
vendor traffic counts. Neither results nor surfaced operational errors contain
raw URLs, paths, IDs, authority, cookies, headers, bodies or value-derived
digests. Filesystem errors and clock exceptions are sanitized at their narrow
boundaries; there is no success-shaped catch/fallback.

Every result explicitly retains `live_guard_qualified: false`,
`vendor_dispatch_proved: false`, `vendor_receipt_proved: false`,
`chamber_compatibility_proved: false`, `attribution_proved: false`, and
`candidate_eligibility_proved: false`, including a local success.
This does **not** qualify browser interception, resource ownership, SDK
execution, actual vendor dispatch/receipt, response-driven native scope, command
cardinality, complete wire recording, comparison/attribution, first-slice DoR,
performance or Servo readiness. Full live guard qualification and fresh explicit
permission remain separate gates; both first journeys' open gates stay open.

## Focused verification and witnessed TDD

Run from the repository root with Node 24:

```sh
PATH=/opt/homebrew/bin:$PATH npx vitest run rig/first-journey-admission.test.mjs --reporter=dot
PATH=/opt/homebrew/bin:$PATH npx eslint rig/first-journey-admission.mjs rig/first-journey-admission.test.mjs
```

The test-only red command was the first command above with
`2>&1 | tail -n 18`: **131 failed / 131**, before the module existed
(`Cannot find module '/rig/first-journey-admission.mjs'`). The pipe's exit code
was the tail command's; the Vitest failure summary is the witnessed result.
A supplemental edge-case red command was:

```sh
set -o pipefail; PATH=/opt/homebrew/bin:$PATH npx vitest run rig/first-journey-admission.test.mjs --reporter=dot 2>&1 | tail -n 76
```

It witnessed **6 failed / 137 passed (143 total)** before fixes to literal URL
validation, overridden Buffer lengths and nonenumerable cleanup attestations.
The final green command was:

```sh
set -o pipefail; PATH=/opt/homebrew/bin:$PATH npx vitest run rig/first-journey-admission.test.mjs --reporter=dot 2>&1 | tail -n 12
```

Initial implementation result: **143 passed / 0 failed**, one test file.
Integration then witnessed a URL-retention regression test fail (70 counted
bytes versus 124 expected). Original URL bytes are now included in aggregate
retention; exact-limit and one-byte-over request/response controls include them.
Independent compliance review then found that adopting a directory did not
sync its parent. A four-case subprocess regression witnessed both adoption
cases fail while both fresh-directory controls passed. Parent fsync is now
unconditional before slot creation; injected parent-fsync failure denies
permission with zero dispatch reservations.
Final coordinator validation is **150 admission tests plus 204 existing
comparison tests (354 passing in one run)**, with the craft-review valid-retry
control included. This remains local admission/comparison-tool evidence only.
The focused ESLint command
above passed with zero lint errors/warnings. npm emits an existing
`Unknown user config "always-auth"` warning; no global configuration was changed.
Tests also witness exactly one winner among four concurrent external Node
processes, as well as external-process rejection after an interrupted reservation.

The suite covers all six acceptance criteria. Real local receivers count
positive arrivals and enforced-denial zero arrivals, and the deliberate
**bypass** control receives traffic despite denial. That nonzero sensitivity
result expressly disproves standalone containment. Redirects are manually
re-admitted; marker loss aborts before a second arrival. Tests close all owned
servers/connections and remove temporary journals. No SDK, browser/profile,
vendor code, authenticated account or real collector participates.
