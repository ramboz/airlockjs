# Bounded offline native-attempt references

[Slice 058-02](../docs/specs/058-native-tag-evaluation-qualification/slice-02-native-reference.md)
implements **one retained Meta PageView profile**. The Google candidate below
adds one newly pinned conversion profile, not full support for either vendor.
The evidence layer is `native_attempt`: Chromium attempted
HTTP requests that were aborted before network transmission. A locally fulfilled
script's HTTP 200 is **not** an observed vendor HTTP response.

## Preconditions and entry points

Use the existing dependencies, macOS `27.0.1` / Darwin `27.0.0`, Node
`v24.10.0`, and installed Google Chrome `155.0.8059.80`. No installation,
download, account access, existing browser attachment, or automatic repair is
performed. A changed/missing prerequisite is inconclusive before native code.
The fixed launcher must have its executable bit (`0755`).

```sh
export PATH=/opt/homebrew/bin:$PATH
node rig/native-tag-reference.mjs \
  --inputs /absolute/private/inputs.local.json \
  --output-dir /absolute/private/new-reference-directory
```

Importing the module is inert. Its only exported entry point is:

```js
await runNativeReference({ inputs, outputDir, mode: "headed", control: "boundary-only" });
```

Omit `control` for native acquisition. `boundary-only` executes **only** fixed
local controls and always returns inconclusive (`native_execution_not_requested`).
It never executes the supplied SDK/configuration, and cannot qualify synthetic
bytes as a native reference. The only other mode is `headless-diagnostic`: a
separate real browser cohort, without user-agent/webdriver spoofing or bot-filter
overrides. The known headless no-beacon result is inconclusive, not a passing
empty baseline. No arbitrary script, destination, browser executable, account
selector, command, or budget flag is accepted.

## Explicit private input

The manifest is bounded JSON with exactly these fields:

- `schema_version: 1`, `profile: "meta-pageview"`;
- `owned_origin`, `document_url` (HTTPS, no credentials/fragments, same origin);
- `pixel_id` (the explicitly owned decimal selector);
- `runtime`, `configuration`, each with exactly `path` (absolute regular file),
  `sha256`, `request_url`, and `response_status: 200`;
- `source_capture_sha256` and a nonempty `authorization` statement.

Only the explicit files are read; directories, caches, other sessions and
credentials are never searched. URLs are at most 2 KiB; the manifest is at most
32 KiB; each native resource is at most 2 MiB. Symlink resources are refused.
Files are opened nonblocking before checking regular-file status, so a FIFO
cannot strand a filesystem open and keep the command alive past its deadline.
Hashes are checked against file bytes. For native execution, the bounded profile
also requires these already-retained official-byte pins:

| Resource | SHA-256 |
|---|---|
| Runtime | `9e4b581a7483e88873ad835a840ffaaff1c85b3be28951e12e8207a318e7776b` |
| Configuration | `807a33e31707b75434ac6aeda5aa8fc9073d6795ca8a9671ff6535edc308d921` |

A self-consistent placeholder body/hash is not official-runtime evidence.
Runtime URL must be the exact official `en_US/fbevents.js` URL; configuration
must be the official `signals/config/<owned selector>` path. At execution,
**the entire original request URL, including query/order, must match** the
manifest. A path-only match is never a fallback. New native bytes require a
separately qualified profile. The Google source-acquisition pass below is a new
cohort and does not recover the original recording's missing runtime bytes.

### New Google source cohort (058-04)

[Slice 058-04](../docs/specs/058-native-tag-evaluation-qualification/slice-04-google-native-reference.md)
adds a separately gated `google-ads-conversion` profile. Actual selected native
receipts pass; the slice record carries its formal lifecycle state. Source
acquisition alone is not a pass.
The owner separately approved inert downloads of the owned official tag's
script/configuration resources. This is not authority for measurement requests,
site/account changes, campaigns or a live conversion.

Acquisition is outside the runner: credential-free exact-resource GETs, no
redirects/retries, at most eight requests, 2 MiB per file, 8 MiB total and a
20-second request timeout. Exact source URLs, response headers/status/time and
bytes remain private. An unknown dependency is observed and blocked offline,
then classified before any separately approved inert download; it is never an
automatic browser/network fallback.

The Google private manifest uses exactly:

- `schema_version: 1`, `profile: "google-ads-conversion"`;
- `owned_origin`, `document_url`, `conversion_id`, `conversion_label`;
- `runtime` with `path`, `sha256`, `request_url`, `response_status: 200`;
- `dependencies`, an array of the same exact-resource shape;
- `source_capture_sha256`, `source_acquisition_sha256`, `authorization`.

The newly retained loader pin is
`318a26b825f07b60faec698d5e771434c36e3f7f248640988c1c0be5220c3e50`.
An empty dependency array means no additional bytes are pinned yet, not that the
runtime has no dependencies. Every observed missing dependency still blocks
qualification.

The fixed Google matrix is baseline/query-disabled/value1/value2, using a
generated standard `dataLayer`/`gtag` bootstrap and unmodified source bytes.
An owned primary conversion must preserve the action, value, currency and
transaction relationships; every observed auxiliary remains in the capture.
Google consent behavior is not inferred from Meta's revoke-negative. Actual
measurement responses, response-dependent fan-out and full Google behavior are
outside this pre-response attempted-reference layer.

The first guarded Google diagnostic observed owned primary conversions plus
additional measurement-shaped auxiliary attempts. Some measurement endpoints
use the browser's `Script` resource type: that does not make their responses
authorized script/configuration downloads. They remain aborted, not fulfilled.
Repeated transport attempts may be affected by interception errors; this trace
cannot stand in for an uninterrupted native response/fallback sequence.

The narrow auxiliary catalog is grounded in the pinned loader's exact
host/path literals and the retained guarded trace:

| Origin and path | Required private relationship |
|---|---|
| `googleads.g.doubleclick.net/pagead/viewthroughconversion/<owned-id>/` | Exact owned destination and generated document |
| `www.google.com/rmkt/collect/<owned-id>/` | Exact owned destination and generated document |
| `www.google.com/ccm/collect` | Exact single owned `tid`/`tids` and generated document |
| `ad.doubleclick.net/ccm/s/collect` | Single nonempty `auid` matching the unique owned primary value in the same case |

These are classifications of retained **aborted attempts**, never network
permissions or locally fulfilled responses. The selector-free last route has
source-pin and run-local correlation evidence, not independent ownership
authentication or a complete initiator-chain proof. Unmatched/foreign/ambiguous
relationships and any other route remain inconclusive.

Selected parent receipts preserve 43 requests: six primary conversion attempts
and 24 auxiliary attempts, all aborted, with baseline/value1/value2 each
observing two primary plus eight auxiliaries. The query-disabled case has none.
The integrated 90-case rerun passed with both vendor inputs and actual native
value mutations enabled. The preceding run had an unknown-auxiliary failure
whose temporary capture was deleted; its cause remains unknown. Diagnostic
retention is now corrected, not the catalog broadened to erase the failure.
A separate retained Chrome new-tab contamination correctly stays inconclusive.
These are scoped passing observations, not universal repeatability.

## Independently witnessed no-send boundaries

1. A headed ordinary Chrome, containing **no native SDK**, navigates to this
   run's ephemeral literal-loopback receiver and must produce one HTTP 200 arrival.
   An otherwise matched fresh confined Chrome must produce zero arrivals and
   denied navigation. These are actual receiver counts, not stdout comparisons.
2. Under the same fixed policy file used by the Chrome launcher, a bounded
   helper tests both known mDNSResponder Unix-socket aliases. Ordinary connects
   must succeed; confined connects must fail with EPERM/EACCES. It sends no
   resolver-query payload. Missing positive service visibility or a successful
   confined connection blocks native execution, never silently skips the check.
3. The confined browser runs a generated local document whose fixed fetch
   tripwire must be observed and aborted by request-stage CDP Fetch interception,
   with zero receiver arrivals. Only after all three controls pass may native code run.

`offline-reference-chrome` execs `/usr/bin/sandbox-exec` with the shared fixed
`offline-reference-network.sb` policy file, then the fixed installed Chrome
binary. Both launcher and policy hashes are retained:

```text
(version 1) (allow default) (deny network*)
(allow network* (local unix-socket) (remote unix-socket))
(deny network*
  (literal "/var/run/mDNSResponder")
  (literal "/private/var/run/mDNSResponder"))
(deny mach-lookup (global-name "com.apple.mDNSResponder"))
```

Unix IPC is necessary for Chrome's SingletonSocket. Failure is inconclusive:
there is **no unconfined-native fallback** and no global host-network change.
The Playwright BrowserServer is owned by this run, listens only on `127.0.0.1`,
and communicates with Chrome by pipe/Unix IPC. Node's driver RPC is outside the
denied Chrome process; it is not evidence for page WebSockets. Cleanup uses only
the processes returned by this run's public BrowserServer handles.

Before document execution, CDP Fetch is installed at request stage. Its only
actions are exact local fulfillment of the generated document / pinned native
scripts, or abort. All other HTTP attempts are retained, then aborted. Favicon
is an explicit aborted non-measurement category only for the exact query-free
browser `Other` GET with no request body. Script/fetch/query/POST variants are
unknown dependencies or auxiliaries, never favicon exceptions. Unknown dependencies/auxiliaries
or fulfilled-script URL mismatches block qualification.

Generated CSP uses a nonce and `strict-dynamic`, requires Trusted Types for
script sinks, and forbids frames, workers, objects and page WebSocket schemes
(`connect-src`/`img-src` allow HTTPS only). The generated default Trusted Types
policy accepts **only the exact pinned script URLs**. The unmodified SDK may
create its own Trusted Types policies; the fixture does not artificially prohibit
those policy names. CSP violations are retained and make a run inconclusive.
Unexpected page/frame/worker/service-worker/WebSocket targets also block closure;
an unsupported popup is closed, not silently omitted from the capture.
No claim is made for iframe, worker, WebSocket or arbitrary native-code coverage.
The process policy denies direct IP networking and the explicitly qualified
resolver IPC channels, rather than inferring DNS closure from an HTTP tripwire.
This is a pinned local macOS profile, not a universal claim about arbitrary
helper processes, operating systems or SDKs.

## Fixed native scenarios and provenance

Every case uses fresh isolated browser storage in the owned fresh browser profile.
The generated title, body, fixture URL, stock queue/init/PageView bootstrap and
custom inputs are **synthetic fixture provenance**, not the source production
document or its cookies/consent. The original source document and source response
metadata remain separately identified in private output. Native resource bytes
are never modified; only the bootstrap's source assignment uses TrustedScriptURL.

| Case | Fixed behavior |
|---|---|
| `baseline` | Native init + PageView; exactly one owned attempt required |
| `query-disabled` | Generated query switch executes no runtime/init/PageView |
| `consent-revoked` | Native `fbq("consent","revoke")` before init/track; runtime executes but native queue holds init/track, no config or measurement request |
| `value1` | Native PageView with synthetic value `13.25`, currency `USD` |
| `value2` | Native PageView with synthetic value `29.75`, currency `USD` |

The value cases require actual differing `cd[value]` and the same currency,
owned ID and event relationship. Every native attempt must identify the exact
generated document. Consent stays at native default except for the explicit
revocation control. Its native callable/held-queue state and lack of config/
measurement are required; removing the actual revoke call falsifies the negative
marker. Disabled and revoked absence are linked to the same run's positive.
Other consent states, grant/replay and transition semantics remain unproved.

## Capture, limits and completion

Private `capture.json` retains original request URL, ordered duplicate query
pairs, method, available CDP request-stage headers, original body bytes as base64
(or explicit absence/unavailability), request order, resource/source relationships,
locally fulfilled response hashes, CSP violations and private failure detail.
Independent receiver arrivals are retained separately in `receiver_requests`.
Aborted measurements have no vendor response, redirect or receipt evidence.

The directory must be new (`0700`); files are exclusive-created (`0600`).
Public API/stdout JSON contains only classifications, counts, cohort/provenance
hashes and errors, never selectors, cookies, source URLs, raw bodies or private
paths. `report.json` is the pre-publication private snapshot; stdout/API includes
the final elapsed duration. Consumers require the completed command's exit status
as well as the report: an output failure or partial directory is never a pass.

One absolute 60-second budget starts **before directory acquisition** and covers
inputs, launch, controls, five Meta or four Google 5-second case windows, live-set capture draining,
owned-resource cleanup and output. Settlement is bounded at 5 seconds. Limits
are 64 requests, 2 KiB URLs, 64 KiB request bodies/headers and 2 MiB per native
resource. Any limit, missing body/header, missing positive/dependency, late
capture, cleanup failure or timeout is inconclusive. Late uncancellable work is
stopped/quarantined before any subsequent native execution; published results
are immutable. A timed-out filesystem operation may leave an incomplete directory.

| State | Exit |
|---|---|
| `qualified` — this exact native-attempt profile and linked controls complete | 0 |
| `nonconformant` — reserved for complete material mismatch evidence | 1 |
| `inconclusive` — missing evidence/prerequisite or explicitly control-only run | 2 |
| `invalid_input` — malformed/unsupported invocation, manifest or existing output | 3 |

Vendor dispatch/receipt, chamber compatibility, matching, attribution and full
support claims are **always false**, including on a qualified profile.

## Focused author validation

The real-browser configuration is explicit; the exact new path is excluded
from the default hermetic suite. Missing browser/sandbox is a failing boundary
test, not an automatic skip.

```sh
npx --no-install vitest run --config vitest.native-qualification.config.js \
  rig/native-tag-reference.test.mjs
```

Synthetic tests prove parser/control mechanics only. To additionally run the
actual retained native reference test, explicitly set
`AIRLOCK_META_REFERENCE_INPUTS` to the private manifest path. Optionally set
`AIRLOCK_META_HEADLESS_DIAGNOSTIC=1` for the genuine headless no-beacon negative.
Without the private handle, the native operator tests are visibly skipped; no
native qualification is inferred. The headless negative requires actual pinned
runtime/config fulfillment, bootstrap execution, a callable initialized SDK,
empty native queue, one Pixel/event record and zero measurement attempts;
an unrelated dependency failure cannot impersonate that result.
Formal review and final integrated validation
belong to the parent workflow, not these author-feedback runs.

Set `AIRLOCK_GOOGLE_REFERENCE_INPUTS` to the explicit private new-cohort manifest
to include actual Google positive and changed/missing-value native tests.
Without that handle they are visibly skipped, never Google qualification.
A failing private Google positive retains its temporary diagnostic directory
and reports that generated location; it does not relax the expected result.
