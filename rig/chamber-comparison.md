# Offline native-attempt / chamber diagnostic (059-17)

This is an **attempt-layer diagnostic**, not a complete native/whole-wire
consumer. It never runs a producer, SDK, browser, network request or live case.
Historical no-send attempts do not renew source-origin leases or authority.

## Closed entry (Node 24)

```sh
PATH=/opt/homebrew/bin:$PATH node rig/chamber-comparison.mjs \
  --inputs /absolute/private/inputs.json --output-dir /absolute/private/NEW
```

Only those two flags are accepted. The JS entry is
`runChamberComparison({ inputs, outputDir })`. No callbacks, drivers,
normalization, URL overrides, arbitrary programs or control/live modes exist.

The exact manifest shape is:

```json
{
  "schema": "airlock.attempt-chamber-comparison.v1",
  "profile": "meta-pageview",
  "case": "baseline",
  "expected_pins": {
    "profile": "meta-pageview",
    "node_version": "ORIGINAL",
    "browser_version": "ORIGINAL",
    "os_release": "ORIGINAL",
    "macos_version": "ORIGINAL",
    "runtime_sha256": "ORIGINAL_64_HEX",
    "configuration_sha256": "ORIGINAL_64_HEX",
    "network_policy_sha256": "ORIGINAL_64_HEX"
  },
  "reference": {
    "report": { "path": "/absolute/private/report.json", "sha256": "ORIGINAL_64_HEX" },
    "capture": { "path": "/absolute/private/capture.json", "sha256": "ORIGINAL_64_HEX" },
    "completion": { "path": "/absolute/private/completion.json", "sha256": "ORIGINAL_64_HEX" }
  },
  "chamber": {
    "output": "/absolute/private/retained-chamber",
    "command": { "path": "/absolute/private/command.json", "sha256": "ORIGINAL_64_HEX" }
  }
}
```

The other supported profile is `google-ads-conversion` (both profile fields),
with its original `configuration_sha256: null`. Only baseline is supported,
mapped to the matching vendor's one chamber-positive case. Supply every full
original handle and original expected pin explicitly; no artifact discovery.

`inspectNativeAttempt({ reference, expected_pins })` is a read-only seam into
the existing native validator, including ALL cases, controls and observations.
It returns frozen original report/capture/completion and original snapshots.
It does not self-compare, fabricate a candidate, accept local-complete sequences
or the spent/incomplete inspected-stock schema, or imply whole-wire proof.
The old native comparator keeps its old API and behavior.

The consumer uses unchanged `inspectCapture(output)`: real worker, source,
serialization, final HTTP/independent sink and cleanup qualification. It also
requires the separately supplied `airlock.chamber-whole-cli-witness.v1` from
an external observer AFTER actual whole-CLI close: exit0, no signal/timeout,
at most 60 seconds, coherent wall/monotonic chronology, unchanged module/test
pins, exact output identity and final start/capture/report/publication/witness
digests. A producer snapshot or inner child witness is insufficient. An
external witness is evidence supplied by its owner, not a cryptographic
authentication of that owner's assertion.

## Outputs and meaning

Stdout and `report.json` contain only fixed categories/counts and false claims,
not source digests, run IDs, paths, values, cookies or value-derived tokens.

- **1 / nonconformant:** known observed-request differences exist.
- **2 / inconclusive:** no observed differences establish equivalence, or
  source/completion/evidence/publication is insufficient.
- **3 / invalid_input:** invalid options/manifest or unavailable exclusive output.
- There is **no exit0**, native-qualified, full-parity or replacement mode.

`comparison.json` is PRIVATE: full originals, literal projected measurement/
companion sequence, differences, identities, input/consent/cohort context and
source snapshots. Fixture/source/other-case/observer exclusions are counted;
they are preserved in these originals, not silently deleted.

`completion.json` is a private publication snapshot with final output digests,
not a future process-exit attestation. A valid diagnostic requires this file
AND an independently observed actual command exit consistent with stdout.
On failure, no completion is retained; `failure.json` is best-effort within the
deadline. An already-written report is an immutable original, not rewritten
to hide a later publication failure. Missing completion invalidates it.

All input files are canonical absolute, no-follow/nonblocking regular files,
single-link, owned, mode 0600, in owned mode-0700 immediate directories.
Ancestors cannot be symlinks. Output is a new mode-0700 directory with exclusive
mode-0600 files. Resources/trees and identities/digests are rechecked through
publication. Limits: 10 seconds offline, 64 KiB manifest, 2 MiB per native
resource, 8 MiB chamber aggregate, 256 native requests, 64 chamber observations,
128 private differences, depth 24/100,000 JSON nodes. JSON duplicate keys,
including escaped equivalents, fail before parsing can erase ambiguity.

The explicitly pinned consumer source closure is this module, its test/guide,
`attempt-evidence-io.mjs`, native comparator/test and chamber capture/test.
The chamber inspector separately pins its unchanged first-party/build/tool/
Node/OS/browser closure; it is re-inspected after publication IO.

## Evidence boundaries

URLs retain exact endpoint/spelling/encoding, ordered duplicate query pairs,
methods, Image versus Fetch/XHR, absent versus empty bodies and original bytes.
No loopback-to-vendor rewriting, common ID/document/consent sentinel, payload
replay or identity normalization is performed.

Retained native attempts are headed/native-default, older browser/source
cohorts, owned documents/IDs; the chamber is headless/legacy, explicit host
grant, fake IDs, page_view and a local sink. Google reference conversion is
not the chamber page-load event. These inputs are **not equivalent**, even
when a raw mechanics unit control has zero differences. Native request-stage
headers cannot prove final-header equality. Vendor responses, cookie acceptance,
edges, host effects, attribution, real replacement, C2/C3 and vendor outcomes
remain unavailable/open.

`compareObservedAttempts(reference, chamber)` is only a fixed-field raw-request
unit primitive. Nonempty arrays use exactly `url, query_pairs, method,
resource_type, body_state, body_base64, kind` (`measurement` or `companion`).
It returns counts and private differences, never source qualification.
Portable mocked seam units are NOT native, worker or whole-CLI evidence.
Actual retained-input runs and independently observed exits belong to the
parent handoff; do not execute a producer to obtain them.
