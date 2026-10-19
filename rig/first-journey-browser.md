# Local browser admission and original-byte capture

This is the fixed first-party qualification for
[059-14](../docs/specs/059-google-ads-full-compatibility/slice-14-browser-admission.md).
It connects [059-13 admission](first-journey-admission.md) to actual Chromium
request/response interception and real receiving sinks. It is not a Google or
Meta runner, an arbitrary-URL browser service, a native reference producer,
a chamber producer, or a qualified live guard.

The owner's 2026-10-19 conditional four-case approval is separate. **None of its
slots are reserved or spent here.** All authorities created here are synthetic
`local-control` records; the fixed `google-stock` gate name selects the local
20-dispatch ceiling, not an advertising account or real conversion.

## Run

Use the pinned Node 24.10.0, Chrome 155.0.8059.80, macOS 27.0.1 / Darwin 27.0.0
cohort. The runner refuses a different cohort and uses its own fresh browser
server/context, not a personal profile or the browser MCP.

```sh
PATH=/opt/homebrew/bin:$PATH node rig/first-journey-browser.mjs \
  --output-dir /absolute/new/private-directory

PATH=/opt/homebrew/bin:$PATH npx vitest run rig/first-journey-browser.test.mjs
AIRLOCK_BROWSER_QUALIFICATION=1 PATH=/opt/homebrew/bin:$PATH \
  npx vitest run rig/first-journey-browser.test.mjs
```

The second test command actually launches the pinned browser and receiving
sinks; unset the variable for hermetic input/output validation only. The tests
remove their own temporary artifacts after checking them. Use the CLI to keep
private receipts. `--mode headed` runs the same synthetic fixtures headed;
neither mode executes a vendor SDK. There is no live-mode switch.

Every synthetic context explicitly grants `local-network-access` only to its
fresh literal-loopback fixture origin. Without this scoped grant, Chrome's
Local Network Access check blocked the WebSocket positive itself
(`ERR_BLOCKED_BY_LOCAL_NETWORK_ACCESS_CHECKS`), which would make a zero-arrival
negative uninformative. No browser security feature is disabled, no persistent
profile permission is changed, and no vendor origin inherits this test grant.
This overridden local-test permission is recorded in the cohort; it is not a
native-default permission or performance comparison.

`runBrowserQualification({ outputDir, control?, mode? })` is the equivalent
module entry. Options are closed. Output must be a new absolute directory with
an existing nonsymlink parent. Directory and raw files are created `0700` and
`0600`; existing paths are never overwritten. Ancestor filesystem/operator
ownership is trusted, as in the admission journal. Do not place artifacts
inside Git or a public serving directory.

## What is actually exercised

Eight fixed fixture surfaces each have matched positive, enforced-denial and
deliberate-bypass legs: Fetch GET/POST, XMLHttpRequest, Image, Beacon, external
Script, a 307 redirect with HTTP-framed empty body, and fanout. The enforced
leg aborts its sink request before continuation. The bypass leg deliberately
does not apply that denial, and must show nonzero receiver arrivals. The
matrix fails if a denial is removed, a positive branch never reaches its sink,
or an observed original differs from the receiver.

The new `qualification-loopback-chrome`/`.sb` pair is separate from the existing
no-send native launcher. The policy denies network by default, permits
Seatbelt's `localhost` IP selector and required Unix sockets, and directly
denies both known mDNSResponder socket aliases and its Mach service.
The fixed receivers bind only literal `127.0.0.1`.
Seatbelt rejected a numeric host in its `remote ip` selector on this host, so
the policy uses its supported `localhost:*` form. Matched zero-query resolver
connection positives and denied confined attempts are required for both aliases.
These controls do not constitute a matched public-IP/native egress boundary.

Interception is installed before navigation. Context routing rejects non-root
frame contexts; request-stage CDP admission catches each redirect hop.
Fixture fulfillment is exact and local. No official SDK, downloaded script,
arbitrary fixture, proxy, personal authentication or real collector is used.
The generated fixture sets an inline `data:` favicon to avoid an incidental
browser favicon request; it is not hidden from a recorded real site.

The fixtures declare their JavaScript transport explicitly. Chromium reports
Fetch as `XHR` in this instrumented cohort; the raw resource label is retained
separately from the declared fixture API. **A browser resource label is not
independent proof of a vendor's initiating JavaScript API.**

Binary POST originals come from CDP `postDataEntries.bytes`, not a text
round-trip or the expected fixture value. Missing originals stop admission.
Response originals come from response-stage `Fetch.getResponseBody`; 204 or
an explicit sole `Content-Length: 0` is separately labeled HTTP-framed empty.
The receiving sink independently compares body bytes, method, status and
declared response headers. Final request/response extra-info, initiators,
duplicate headers, raw response header text and cookie observations are
retained. Redirect target cookie attachment is checked against the receiver,
including both separate Set-Cookie values. Request/response byte accounting
uses the retained structured-header representation and body bytes, not a claim
to exact TCP/TLS framing.

The 059-13 gate reserves counters before CDP continuation. Final
browser-controlled headers are checked again once available, including their
retention cost. **This post-dispatch final-header check is not a proof of a
universal pre-dispatch final-wire byte cap.** That remains a live-executor
qualification obligation; this runner cannot approve itself for native sends.

## Fixed negative controls

Use `--control NAME` to run the entire matched positive matrix, then its
linked expected failure. Expected controls return exit **2**, not zero.
Inspect `negative.detected`, its intended category, matched positive link,
receiver counts and actual command completion; nonzero alone is insufficient.

| Control | Required failure |
|---|---|
| `missing-body` | Deliberately unavailable original response prevents completion. |
| `late-read` | A bounded deliberately delayed read fails its specific read deadline. |
| `response-limit` | One-over response bytes fail instead of truncating. |
| `request-limit` | One-over original request bytes do not reach the receiver. |
| `url-limit` | Overlong observed URL is denied before continuation. |
| `wrong-transport` | A Script request cannot reuse a Fetch request's scope. |
| `invalid-parent` | A direct request to a redirect-only target lacks its observed parent. |
| `nonempty-redirect` | Unreadable nonempty 307 body stops before the target. |
| `marker-loss` | Redirect target missing the exact ownership marker is denied. |
| `query-order` | Reordered duplicate query values do not match exact scope. |
| `unsupported-frame` | An attempted child frame cannot yield success. |
| `unsupported-popup` | Extra page is rejected and the owned context closes. |
| `unsupported-worker` | Worker/CSP violation is an explicit stopped case. |
| `unsupported-service-worker` | The pinned context's blocked-registration warning stops the case. |
| `unsupported-websocket` | WebSocket routing closes the unsupported surface. |
| `cleanup-failure` | First close fails; guards remain installed until successful retry. |
| `output-failure` | A provisional zero report cannot certify failed completion publication. |
| `output-deadline` | Publication deadline failure leaves no completion attestation. |

Unsupported-surface controls have separate **matching surface bypass positives**,
not a generic Fetch positive: a frame, popup, worker, service worker or WebSocket
actually reaches its local sink when the corresponding restriction is deliberately
removed. These cases are explicitly labeled guard-bypassed; they do not qualify
capture or safety for those surfaces. Service-worker bypass uses its own fresh
context with service workers allowed, then closes it; ordinary cases block them.
The negative service-worker warning is pinned Playwright behavior, not proof that
unrelated/unobserved service-worker implementations are all covered.

The local fixture's CSP forbids frames/workers and the context blocks service
workers. Target, frame, worker and WebSocket listeners are additional failure
signals, not independent proof that observing a target after creation prevents
all its possible traffic. Context routing, CSP and process policy have distinct
roles. Unwitnessed target/service-worker variants remain explicit native/live
qualification gaps, not silently successful surfaces.

## Known original-byte gap

A separate real confined probe compared an invalid-UTF-8 binary POST through
a nonempty 307 and a second receiving sink. Both POSTs and final response
matched original bytes and the final receiver saw both cookies. Intermediate
redirect response bytes were unavailable through both Playwright response
capture and `Fetch.getResponseBody`. `Network.streamResourceContent` returned
no intermediate buffered data; its subsequent data event contained only the
four-byte final response. Three observation paths therefore did not recover
the intermediate eight-byte body.

This is not proof that every possible capture mechanism fails. It is a concrete
gap in the tested mechanisms. The fixed runner aborts such a response before
its redirected target; it never substitutes empty bytes, copied expected bytes,
a locally replayed response or an opaque load event. Empty-framed redirects
remain separately testable. An actual native case encountering this gap must
remain inconclusive and spent under its finite authority.

## Output and completion

`capture.json` contains synthetic raw originals, receiving-sink observations
and source-linked local case records. `report.json` contains fixed categories,
counts, cohort/source pins, matrix outcomes and closure checks.
`completion.json` binds the report/capture digests and **producer result**, after
owned context/process/server cleanup. Its `result_exit_code` is not an observed
CLI exit; `command_exit_observed` is always false. No process can attest its own
future final exit before writing its last file. Require the caller's separately
observed actual command exit and matching digests, not this file alone.
Real-browser tests launch the CLI as a child and check its actual exit status.
Output/deadline controls deliberately leave a provisional zero-result report
without a completion artifact while the actual command exits nonzero.
These are failed diagnostics, never passes.

Receipt publication uses synchronous exclusive writes, file fsync and directory
fsync, so a timed-out asynchronous writer cannot publish success after return.
The output directory's parent entry is also synced. Source provenance includes
the admission module, resolved Playwright entry/version and lockfile alongside
the runner, launcher and policy. This identifies the executing dependency cohort;
it is not a claim to have verified every installed dependency byte.

The absolute 60-second budget starts before output preparation and includes
launch, every observation, settlement, cleanup and output. The owner process
has a watchdog and may kill only its own browser process. Interception stays
installed until the owned context closes; a failed close keeps the owned context
and its guard listeners for retry. Failure cleanup still runs when the success
budget is exhausted, and any overrun remains nonqualified. Filesystem syscalls
and a cooperative controller cannot promise instantaneous physical preemption
during an OS stall; the external caller must also bound and observe command exit.
It is not a machine-wide firewall or an enforceable credit meter.

Every outcome retains false vendor-dispatch/receipt, native execution, chamber
compatibility, matching, attribution, full-support and `live_guard_qualified`
claims. Complete live path policy, fresh owned setup, scheduling, source pins,
native response-dependent scope and the first product slices' C2/C3 and
independent implementation/evaluation gates are still required.
