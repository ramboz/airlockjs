# Local native-tag recorder qualification

This tool qualifies a **fixed loopback HTTP fixture**, not Google Ads, Meta
Pixel, a chamber implementation or a production no-send boundary. No vendor
runtime, customer page, account configuration or arbitrary URL/script is accepted.

## Run

Install the repository's declared dependencies and use the locally qualified
Node `v24.10.0` and Chrome `155.0.8059.80`. The driver uses the existing Chrome
channel and a fresh isolated browser, not another session's browser/profile.
A changed or missing runtime is inconclusive; the tool does not download one.
The host updated from `.79` during preparation. Earlier `.79` receipts were
retained separately; they do not qualify this new cohort or native vendor work.

The driver starts its own loopback-only Playwright browser server and records
only that spawned browser's process handle for deadline cleanup. It never
attaches to or terminates a user's existing browser. The driver's private local
RPC connection is not a qualification of page WebSocket traffic.

```sh
node rig/native-tag-qualification.mjs --output-dir /your/new/private-directory
```

The directory must not exist. The tool creates it with mode `0700` and writes
`capture.json` and `report.json` with mode `0600`, without overwriting existing
files. Public stdout is a sanitized JSON summary; original URLs, ordered query
pairs, headers and bodies stay in the private capture.
The absolute run clock is armed before directory acquisition. A stalled
acquisition is inconclusive and cannot resume into fixture execution after
expiry. An uncancellable filesystem operation may leave an incomplete empty
directory; no private capture or qualification follows a timed-out acquisition.

| Overall | Exit | Meaning |
|---|---|---|
| `qualified` | 0 | This exact local fixture's required controls passed |
| `nonconformant` | 1 | A complete observation proves a material mismatch or guard leak |
| `inconclusive` | 2 | Missing/empty positive, capture/provenance/runtime/limit failure |
| `invalid_input` | 3 | Invocation/output location/surface/control rejected before execution |

All vendor-dispatch/receipt, matching, attribution, chamber and full-support
claims stay false. A local `qualified` result is not a full native reference.

## What is actually qualified

The finite `core-http` matrix covers fetch GET/POST, image, XMLHttpRequest,
beacon, an actual HTTP redirect losing its explicit owner parameter, and a
response-URL-linked fetch. Each has:

1. A matched positive leg whose independent receiving tripwire records arrival.
2. An equivalent enforced leg with an observed attempted request and zero arrival.
3. A loopback-only bypass leg whose arrival falsifies the enforcement condition.

The outer boundary always restricts fixture traffic to this run's exact literal
`127.0.0.1` origins, even during bypass controls. Chromium CDP Fetch interception
is active at request stage before fixture navigation and covers each tested
redirect hop. A Playwright `context.route` callback alone did not block the
redirect target in the original matched control; silence or route registration
is not accepted as enforcement proof.

Frames, dedicated workers, service workers, WebSockets, browser/background
traffic, arbitrary native code and actual vendor wire are **not qualified**.
Requesting a broader surface is rejected. Do not reuse this narrow local
fixture runner as permission to capture customer/Intuit pages or execute an
arbitrary SDK behind an HTTP-only policy.

The recorder retains raw body bytes once. The independent sink stores their
exact SHA-256/length witness, and comparison checks that witness against the
recorded bytes. Original binary bodies and duplicate query values are preserved.
HTTP-framed zero-length bodies are distinguished from unavailable bodies;
missing reads are not converted into empty values.

Limits are 64 retained requests, 2,048 URL bytes, 64 KiB request bodies,
1 MiB response bodies, 4 MiB aggregate decoded retained body bytes, 5-second
settling and a 60-second run cutoff. Reaching a limit is inconclusive. These
are local fixture safety limits, not native-vendor performance/payload bands.
Observation timestamps, runtime/source pins, coverage, errors and cleanup are
reported explicitly.

At observation cutoff, new requests are no longer admitted, but responses and
terminal events for already accepted requests remain observable through the
finite settlement window. Delayed reads, responses arriving during settlement,
non-guard transport aborts and settlement timeouts are separately classified.
The run deadline stays armed through settlement, owned-resource cleanup and
private output. On expiry it can force only the spawned browser process and
this run's receivers closed. Partial files from a nonzero run are not a pass;
consumers require the completed command's exit 0 as well as its report.

`report.json` is a pre-publication snapshot taken after resource cleanup. Its
observation window is persisted, but final `run_elapsed_ms` is returned only in
the API/stdout summary after output completes. Do not substitute a missing
saved elapsed value with zero or treat that snapshot alone as command completion.

## Falsification checks

These modes intentionally break the fixture/recorder/inner guard while keeping
the outer loopback restriction. They must never produce `qualified`:

```sh
node rig/native-tag-qualification.mjs \
  --output-dir /your/new/private-negative-directory --control guard-bypass
```

Supported controls: `empty-reference`, `dropped-request`, `missing-response`,
`hung-read`, `wrong-body`, `guard-bypass`, `broken-positive`,
`request-body-limit`, `response-body-limit`, `aggregate-body-limit`,
`request-limit`, `url-byte-limit`, `dropped-redirect-branch`,
`dropped-fanout-branch`, `late-response-timeout`, `transport-abort`,
`run-timeout`, `cleanup-timeout`, `output-timeout`, `directory-timeout`.

The deadline-fault controls lower the maximum to ten seconds and read settling
to one second while exercising the same shared deadline/cleanup mechanism.
Their reports disclose those actual lower limits.

`delayed-read` and `late-response` are positive timing probes, not failing
mutations: they must retain the accepted evidence during settlement and qualify
the complete local matrix. A normal result does not excuse either missing
branch relationships or missing positive controls in any leg.

Browser controls run separately from the default hermetic suite, with no
missing-browser skip that could look like a qualification pass:

```sh
npx --no-install vitest run --config vitest.native-qualification.config.js
```

## Remaining gates

[058-02](../docs/specs/058-native-tag-evaluation-qualification/slice-02-native-reference.md)
still needs a positive, pinned, actual native attempted-request reference.
Meta's automated no-beacon observation stays inconclusive despite owner-confirmed
normal-browser Test Events receipt. Complete Google response/fan-out capture,
full sequence comparison, actual chamber execution and product outcomes remain
separate obligations. No live resend or reference download is authorized here.
