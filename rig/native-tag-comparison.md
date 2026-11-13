# Offline native sequence comparison

This command qualifies a **named comparison layer**, not a replacement SDK.
It never starts a browser, executes a retained SDK, downloads resources, sends
vendor events, changes collection, or authorizes recapture.

```sh
node rig/native-tag-comparison.mjs \
  --inputs /absolute/private/comparison-inputs.json \
  --output-dir /absolute/private/new-comparison-output
```

API: `await runNativeComparison({ inputs, outputDir, control? })`.
Paths must be absolute. The output directory must not exist. The return value
and its nested objects are frozen. CLI stdout is that same public JSON contract.
Exit states are `qualified` (0), `nonconformant` (1), `inconclusive` (2), and
`invalid_input` (3). Unknown flags, repeated flags and unsupported controls fail.

## Exact manifest contract

No directory discovery is performed. Supply only explicitly selected files:

```json
{
  "schema_version": 1,
  "layer": "native_attempt",
  "reference": {
    "report": { "path": "/absolute/private/reference-report.json", "sha256": "<byte SHA-256>" },
    "capture": { "path": "/absolute/private/reference-capture.json", "sha256": "<byte SHA-256>" },
    "completion": { "path": "/absolute/private/reference-completion.json", "sha256": "<byte SHA-256>" }
  },
  "candidate": {
    "report": { "path": "/absolute/private/candidate-report.json", "sha256": "<byte SHA-256>" },
    "capture": { "path": "/absolute/private/candidate-capture.json", "sha256": "<byte SHA-256>" },
    "completion": { "path": "/absolute/private/candidate-completion.json", "sha256": "<byte SHA-256>" }
  },
  "candidate_kind": "reference_control",
  "expected_pins": {
    "profile": "meta-pageview",
    "node_version": "<source version>",
    "browser_version": "<source version>",
    "os_release": "<source release>",
    "macos_version": "<source version>",
    "runtime_sha256": "<source byte SHA-256>",
    "configuration_sha256": "<source byte SHA-256 or null for Google>",
    "network_policy_sha256": "<source byte SHA-256>"
  },
  "rules": { "identities": [], "hashes": [] },
  "authorization": "<source-owner scope and authorization>"
}
```

Allowed layers: `native_attempt`, `whole_wire`, `local_control`.
Allowed candidate kinds: `reference_control`, `observed_sequence`. The latter
does **not** assert independent acquisition or actual chamber execution.
All digest strings are lowercase, 64-character SHA-256 of the **file bytes**.
Only `configuration_sha256` may be null. All fields shown are required; extra
manifest, descriptor, pin, rule or selector fields are rejected. The one
optional addition is `rules.fields` (see [native field rules](#native-field-rules--frozen-corpus-classes)).

Each completion file has exactly this schema:

```json
{
  "schema_version": 1,
  "run_id": "<same report and capture run>",
  "report_sha256": "<selected report file byte digest>",
  "capture_sha256": "<selected capture file byte digest>",
  "completed": true,
  "exit_code": 0,
  "overall": "qualified",
  "source_owner_attestation": "<owner's witnessed successful completed command>"
}
```

The owner must have witnessed successful command completion, not merely found a
qualified-looking report. A report can be written before a command finally fails.
Missing, failed or mismatched completion evidence is inconclusive. The local
attestation is a trusted source-owner statement, **not an independently signed
authentication mechanism**. This comparator cannot establish that an owner
statement is truthful. It never manufactures receipts from report snapshots.

## Native source validation and boundaries

Supported native schemas are the retained `native-tag-reference.mjs` v1 Meta
PageView and Google Ads conversion profiles. Report/capture identity, byte
digests, counts, case summaries, positive observations, controls, no-send guard,
cleanup, provenance and all eight expected pins are checked. Private case
snapshots legitimately have a null `qualified_positive_run_id`: the recorder
snapshots them before grading. Public case summaries must link to the actual
source run, and every other summary field must match the private snapshot.

Native cleanup must contain all four own fields `owned_processes_exited`,
`servers_closed`, `contexts_closed`, and `signal_listeners_detached`, each
strictly boolean true. A partial all-true object is not complete proof.
Local fixtures instead require the closed declaration `{ "complete": true }`;
native field names do not substitute for it. Missing, false, string or null
cleanup proof is inconclusive; unrelated optional metadata remains optional.

Native guard counters must be explicitly present safe integers with exact
pinned-profile values: process positive arrivals 1, positive status 200,
confined arrivals 0; resolver positive connections 2 and confined denials 2;
HTTP attempts 1, aborted 1, arrivals 0. All qualified markers and the process
navigation-denied marker must be boolean true; resolver query-payload-sent must
be boolean false. Missing fields, strings, null, fractions, negatives and other
counts are inconclusive `forbidden_dispatch`, never coerced into proof.

Meta's five cases and Google's four cases remain separate:

* Meta: baseline, query-disabled, consent-revoked, value1, value2.
* Google: baseline, query-disabled, value1, value2. Google's
  `consent_negative_linked: false` is required and correct for this profile.

The guard-tripwire request sequence is retained and compared; it is not a vendor
measurement and is **not excluded**. Native source resources remain pinned.
Expected primary destinations, owned selectors, document references, value
contrast and available same-case auxiliary identities are checked on originals.
The legacy source gate checks the asserted guard counters; it does not reconcile
the actual guard-tripwire observations against those counters. Exact source
copies can therefore test comparison mechanics without independently proving
that control. The stricter read-only seam below closes this gap for distinct
consumers without changing this comparator's existing behavior.

The supplied exact native reference copies qualify only comparator self-controls.
They are not independent candidates. No cross-run native nondeterministic-field
coverage is qualified. Available CDP request-stage headers do not establish
complete cookie attachment, and local response size/digest metadata is not an
actual vendor response. Native artifacts have no complete vendor response,
redirect, cookie-acceptance or initiator proof. Requesting `whole_wire` therefore
returns `whole_wire_unavailable`, even for byte-identical copies.

All vendor dispatch/receipt, matching, reporting, attribution, chamber
compatibility and full-support claims always remain false. Nothing here closes
vendor inventories, changes production collection or permits Servo/full vendor
work. Those gates need their own evidence and prerequisites.

## Read-only native-attempt inspection

`await inspectNativeAttempt({ reference, expected_pins })` reuses the native
validators without manufacturing a candidate or self-comparing a reference.
The arguments use the same three original resource handles and eight expected
pins shown above. This stricter seam also reconciles the fixed guard document/
tripwire rows, URLs, types, abort/local-fulfillment state, fixture digest and
receiver evidence with the control counters. It rejects missing/unknown guard
observations even when counts and hashes have been refreshed.

The seam requires canonical private originals, bounded no-follow/nonblocking
regular-file reads, unambiguous JSON and immutable identity/digest rechecks.
It returns frozen original report/capture/completion data and snapshots, not
network permission or a new native producer. Local-complete stand-ins,
whole-wire promotion and the spent/incomplete inspected-stock schema reject.
It starts no producer, SDK or browser.

The separate [attempt/chamber diagnostic](chamber-comparison.md) uses this
seam, the unchanged genuine-worker capture inspector and an independently
supplied whole-CLI completion witness. It keeps the chamber producer distinct
and its legacy/local/cohort/input gaps visible. It does not add a chamber
candidate kind or normalization rule to `runNativeComparison`.

## Comparison and fixed exclusions

With empty rule arrays, all original values are exact. The full recorded request
sequence is ordered, including fixture, guard, runtime, primary, auxiliary and
other provided records. Multiplicity, method, destination, category/resource
type, query pairs, URL encoding, captured headers and request-body bytes/states
are material. Ordered pairs retain duplicates; they are never converted into a
dictionary. URL/query redundancy and canonical base64 round trips are validated.
Local complete sequences additionally compare response bytes/headers/cookies,
request cookies, completeness and ordinal redirect/fanout edges.

Known capture fields outside the request array (source, scenario, input and
available relationship records) are also material. Unknown schema fields at
any recognized level are explicit `unknown_fields` inconclusive evidence, not
ignored extensions. Missing/unavailable evidence cannot be promoted to equality.
Raw redaction sentinels, including decoded body sentinels, block qualification;
the tool cannot prove arbitrary opaque strings are not secretly redacted.

The only exclusions are fixed, named and counted across both inputs:

| Public name | Exact disposition | Reason |
|---|---|---|
| `observer_run_identity` | Native capture run ID and private-case positive-run linkage, after validation | Observer linkage, not wire values |
| `observer_times` | Native request `observed_at`, case `started_at`/`stopped_at`, receiver `at` | Recorder clocks |
| `observer_network_and_process_ids` | Native request `network_id`, capture `browser_process_ids` | Recorder-local handles, not observed edges |
| `generated_fixture_metadata` | Private-case `fixture_sha256`; local-response `body_bytes`/`body_sha256` only when provenance is `generated_synthetic` | Generated fixture bookkeeping, not vendor responses |

These exclusions do not touch URL query timestamps, request header/body values,
retained-resource response digests, or any recorded local response/edge. There
is no generic field ignore, gap whitelist, replacement rule, regex DSL or eval.

## Closed relationship rules — local controls only

Nonempty rules are supported **only** for declared `local_control` fixtures.
Native inputs with any nonempty identity/hash rules are explicitly inconclusive
`native_normalization_unsupported`; those rules are never silently ignored.
An owner must not reinterpret account destinations, action labels, controlled
values, consent or pins as variable native identities. Native-side variation is
handled only by the separate [native field rules](#native-field-rules--frozen-corpus-classes)
below. The supplied native manifests have empty rule arrays unless they declare
`rules.fields`.

Selectors identify exactly one recorded original field:

```json
{ "request": 0, "field": "query", "index": 2 }
{ "request": 0, "field": "header", "name": "X-Private-Identity" }
```

`request` is the zero-based sequence ordinal. `index` selects a query-pair
occurrence, not a query name; duplicates remain distinct. Header selection is
case-sensitive and must select exactly one occurrence. No JSON path, arbitrary
expression, substring replacement or dynamic field traversal is accepted.
Selectors may not overlap across rules.

**Closed local target policy (compatibility tightening):** identity selectors
may target only query keys `id`/`client_id`, or the exact header
`X-Private-Identity`. Hash input selectors may target only query key
`synthetic_hash_input` or header `X-Private-Hash-Input`; digest selectors may
target only query key `synthetic_sha256` or header `X-Private-SHA256`.
The decoded query key is checked at the selected ordinal on **both original
inputs**, before any replacement. Arbitrary query/header names, opaque Cookie
or whole-body selectors, and all routing/action/value/currency/consent/pin
fields are rejected as `rule_target_unsupported` (exit 3), not ignored.
The formerly accepted arbitrary local selectors are intentionally incompatible.
Native nonempty rules remain inconclusive, irrespective of this local policy.

Identity rule:

```json
{
  "groups": [
    [{ "request": 0, "field": "query", "index": 2 },
     { "request": 1, "field": "query", "index": 2 }],
    [{ "request": 2, "field": "query", "index": 2 },
     { "request": 3, "field": "query", "index": 2 }]
  ]
}
```

At least two groups, each with at least two selectors, must prove actual
nonempty reuse within a group and distinctness across groups **on both sides**.
Only then are selected fields represented by internal group symbols.
Collapsed or unlinked groups fail; equal redaction markers cannot pass.

Hash rule:

```json
{
  "input": { "request": 0, "field": "query", "index": 0 },
  "digest": { "request": 0, "field": "query", "index": 2 },
  "normalization": "trim_lowercase_utf8"
}
```

This example requires `synthetic_hash_input` at query index 0 and
`synthetic_sha256` at query index 2; the indices do not grant semantic authority.

Normalization is only `identity` or `trim_lowercase_utf8` (JavaScript `trim()`
then `toLowerCase()`, encoded as UTF-8). Each original digest must equal SHA-256
of its actual normalized input; merely being 64 hexadecimal characters is not
proof. The normalized inputs must still compare equal across sides. Digest
values are not replaced by a common “present” marker.

Selected query values retain an encoding skeleton: literal versus `+` versus
percent encoding, including hex-letter case and byte positions. The original
query keys/order and nonselected URL bytes remain exact. This is deliberately
conservative: different encoded lengths/spellings can remain nonconformant even
when a declared semantic relationship is valid.

## Native field rules — frozen-corpus classes

Policy amendment (spec 064-03, ADR-0061 point 10; **independent review
required**). This replaces "native path-specific normalization is not
implemented". It is shared toolkit work for Adobe, Google and Meta; the
implementation is `field-rules.mjs` plus `applyFieldRules` in the comparator.

Native manifests may add an optional `rules.fields` array (absent = exact
comparison, as before). Each rule puts the selected fields in exactly one class
and must name the frozen-corpus fixtures it was derived from:

| Class | Rule keys | Both sides must satisfy |
|---|---|---|
| `generated` | `format`, `relation` | value matches `format`; `relation` `equal` (one value across the selectors), `distinct` or `none` |
| `input_derived` | `source`, `transform` | value equals `transform(source value)` on the same side; `source` is another selector and stays compared exactly |
| `server_context` | `context`, `allowed` | value is in the enumerated `allowed` set (≤16) **and identical on both sides** (same input state, same server answer); `context` is `egress_region`, `served_config` or `response` |
| `volatile` | `format` | present, and matches `format`; nothing else is checked |

Every rule also has `selectors` (1–8, same four selector forms as above,
`body_utf8` only for `input_derived`) and `derived_from`, 1–32 distinct SHA-256
digests of the corpus fixtures the rule was read from. A rule with no corpus
digest is rejected (`field_rule_corpus_missing`): rules are bounded to the
frozen corpus, never invented at comparison time. The comparator checks the
digest shape only; that each digest names a committed corpus fixture is the
reviewer's and the held-out check's job (ADR-0061 point 7), not enforced here. "Fixed" is the default:
anything not selected compares exactly.

`format.kind` is one of `uuid`, `hex`, `decimal`, `base64url`, `token`,
`epoch_ms` (13 digits), `epoch_s` (10 digits), with `min`/`max` length for the
variable kinds. `transform` is one of `identity`, `lowercase`, `sha256_hex`,
`trim_lowercase_sha256_hex`, `base64`, `base64url`. There is no generic ignore,
regex DSL, expression or eval, and unknown keys or values are invalid manifest
input (exit 3; `invalid_field_rule`, `invalid_field_format`,
`invalid_field_transform` or `field_rule_corpus_missing`).

Closed policy:

- Original values are validated on **both** sides before any replacement. A
  failed rule is `field_rule_violation` (nonconformant, exit 1), not an ignore.
- `generated` and `volatile` may not target routing, action, amount, currency,
  consent or page-identity keys (`ev`, `id`, `pixel_id`, `send_to`, `label`,
  `value`, `currency`, `currency_code`, `cd[value]`, `cd[currency]`, `consent`,
  `gcs`, `gcd`, `gdpr`, `gdpr_consent`, `dp`, `dl`, `en`): `rule_target_unsupported`
  (exit 3). Those fields stay exact, input-derived or server-context.
- A `volatile` rule is only for fields shown to have no relationship to any
  other value; a field that links to a cookie, storage, another request or a
  response uses `generated` (with `relation`) or `input_derived`.
- Identity values (`fbp`, `fbc`, `fbclid`, `gclid`, `gbraid`, `wbraid`, `auid`,
  `mid`, `ecid`) may be `generated` only with `relation` `equal` or `distinct`,
  never `volatile` or relation `none`: a link to a cookie or another request
  must be proven, not waved through.
- Selectors may not overlap across any rule (`overlapping_rules`), and an
  `input_derived` source may not be a target of any rule, so it stays exact.
- Selected query values keep which escape spellings occurred (literal, `+`,
  percent with letter case) but not their length, because a rule covers values
  of different lengths. Query keys/order and unselected URL bytes stay exact.
- "Fixed" is not a rule class: it is the default for every unselected field.
- Field rules are native-only. On a local layer they are inconclusive
  (`field_rules_native_only`); identity/hash rules on native stay unsupported.
- Each applied rule counts once in `preserved_relationships`.
- The evaluator proves only what the rule states. It does not prove the rule is
  right: that is the held-out recordings check in ADR-0061 point 7.

## Complete local synthetic schema

For response/cookie/redirect/fanout mechanics, use `layer: "local_control"` and
`expected_pins.profile: "local-synthetic"`. These are **declared local fixtures**,
not fabricated native SDK evidence. Both sides still need report/capture byte
digests and owner completion attestations. A complete capture is:

```js
{
  schema_version: 1, kind: "local_complete_sequence", run_id: "local-run",
  complete: true,
  requests: [{
    ordinal: 0, case: "baseline", url: "https://fixture.invalid/?a=1&a=2",
    query_pairs: [["a", "1"], ["a", "2"]],
    method: "POST", resource_type: "Fetch", category: "conversion",
    headers: [["Content-Type", "text/plain"], ["Cookie", "example=one"]],
    headers_state: "complete",
    cookies: [["example", "one"]], cookies_state: "complete",
    body_base64: "aGVsbG8=", body_state: "captured",
    response: {
      status: 200, headers: [["Set-Cookie", "example=two"]],
      cookies: [["example", "two"]], headers_state: "complete",
      cookies_state: "complete", body_base64: "b2s=", body_state: "captured",
      complete: true
    },
    redirect_to: null, fanout_to: []
  }]
}
```

Every shown field is required. Bodies can be `absent` with `body_base64: null`;
`unavailable`/`truncated` are inconclusive. Cookie/header arrays are ordered
name/value pairs with duplicates preserved. Redirect and fanout targets are
valid zero-based request ordinals. All provided categories/types are compared.

The local report contains `schema_version`, matching `run_id`,
`evidence_layer: "local_control"`, all eight pin fields (network policy also
repeated under `provenance.network_policy_sha256`), `overall: "qualified"`,
`exit_code: 0`, `errors: []`, `capture_complete: true`,
`counts: { recorded_requests: N }`, `guard: { qualified: true }`,
`cleanup: { complete: true }`. These are local declarations checked for
consistency, not claims about a native execution environment.

## Falsifiable controls

Optional CLI `--control NAME` (or API `control`) first requires a real passing
comparison. It then clones the validated originals, verifies a mutation really
changed them, reconciles redundant counts/case summaries, and runs the **same
comparator**. No altered bytes are represented as source-attested artifacts.
Source semantic qualification is not rerun on deliberately changed canonical
clones; structural validation, pins and comparison are still enforced.
After dropping the tail request, incoming redirect targets to that ordinal
become null and incoming fanout occurrences of it are removed; all surviving
links retain their order/multiplicity. This reconciles the mutation clone,
not the original evidence, so strict edge validation still runs and the
intended sequence difference reaches the same comparator.

| Control | Intended result/category |
|---|---|
| `drop` / `duplicate` | Remove a request / duplicate a conversion; `sequence` |
| `route` | Destination path change; `destination` |
| `value` / `identity` | Change an actual fixed recognized query field; `query` |
| `consent` | Change an actual consent query field, or native baseline's declared consent state; `query` or `scenario_evidence` |
| `response-truncation` | Shorten available local response bytes, keeping valid base64; `response` |
| `edge-loss` | Remove available local redirect/fanout links; `edges` |
| `empty-reference` | Empty positive reference; `missing_positive_reference` |
| `equal-redaction` | Put the same redaction marker on both sides; `redacted_values` |
| `stale-pin` | Change a browser pin; `stale_pins` |

Response truncation is a valid complete recorded shorter body, not a malformed
base64/parser failure masquerading as comparison proof. Native response/edge
controls are unavailable because those native captures do not contain the
required evidence. A control without a usable target is inconclusive
`control_unavailable`, not a qualified mutation. It cannot exit 0. The public
control record links its positive run ID/exit code and reports `applied`,
`detected` and its expected fixed category. Only an intended category counts as
detection; unrelated input failures yield `control_not_detected`.

## Privacy, limits and operator checks

`report.json` contains the value-free public contract. It exposes only fixed
categories, ordinals/counts, fixed evidence boundaries and source-file byte
digests—not raw values, paths, rule names or per-value hashes.
`evidence.reference`/`evidence.candidate` separately count captured/absent/
unavailable request bodies, complete local responses, metadata-only responses,
unavailable native measurement/auxiliary vendor responses, and unproved cookie
attachment/redirect/fanout evidence. `counts.presence_only` counts metadata-only
response records, never verified response bytes. Unknown-field occurrences are
counted across both sources; missing/forbidden counters are issue-category
indicators for the requested layer, not a claim that other layers are complete.
`comparison.json` contains original private inputs, attestations, full values,
rules and detailed comparisons (plus the linked positive and mutated clones
for controls). Treat **both files** as owner-only. Output uses a new exclusive
0700 directory and exclusive 0600 files. Existing directories, final symlinks,
FIFOs/nonregular resources, byte-digest mismatches and output errors cannot
yield success. Source files are read-only.

Bounds: one absolute 10-second clock covers acquisition, reads, validation,
comparison and output; 64 KiB manifest; 2 MiB per resource; nesting depth 24;
100,000 tree nodes per JSON; 256 requests; 32 rules total; 32 selectors per
identity rule; 256 pairs per header/cookie/query array; 128 differences.
Exceeding a bound is explicit and never a truncated successful comparison.
The comparator makes no claim that partially published report files are
completed commands: trust the returned CLI state and, for later consumption,
a separately witnessed completion attestation.

Run the hermetic targeted tests (no browser environment needed):

```sh
npx --no-install vitest run rig/native-tag-comparison.test.mjs
```

Before adopting a result, check its layer, candidate kind, completion evidence,
pin cohort, fixed exclusions and limitations. A local control pass or the
legacy curated parity/unit oracle is not a Google/Meta native qualification,
actual chamber execution, complete vendor behavior or Servo-readiness artifact.
