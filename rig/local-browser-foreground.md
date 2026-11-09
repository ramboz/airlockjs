# Fixed local foreground procedure

## Private Google browser-operation packet - 2026-11-09

The owner accepted the Google-only model in
[ADR-0050](../docs/decisions/adr-0050-google-browser-operations.md) and authorized
reviewed local implementation. That decision does not authorize Google traffic,
cookies, credentials, official SDK execution, deployment or changes to network
or system trust. Existing manual/default Google and Meta modes stay unchanged.
The older Meta-to-Google proposals and observations below remain historical.

The private, SDK-free command is fixed:

```sh
node rig/local-browser-foreground.mjs --google-browser-operations
```

Ordinary tests never launch it. Before issuance, review the exact current source
cohort, installed browser metadata, launcher/policy hashes, owned acquisition and
stop paths. The current pin is Chrome `156.0.8078.80`; plist metadata alone is not
proof of a launched version. Source checks the actual version before navigation.
The existing Seatbelt launcher and request/WebSocket guards remain required.
Install guards before the inert preflight page. Receiver allow/deny/bypass
preflight must pass before any product navigation. A failed gate stops the packet;
there is no automatic retry or alternative confinement mechanism.

One issued packet permits one browser root, at most eight fixture/context pairs,
eight workers, 256 observed requests and 24 measurement attempts. Its 120-second
interval includes publication and cleanup; work stops by 100 seconds. URL,
request/header, response and retained-evidence limits are 8,192 bytes, 64 KiB,
2 MiB and 8 MiB respectively. Ordinary source/review time extensions do not
extend an issued browser interval.

The fixed cases cover readable and opaque secondary results, unreadable primary
data, a reachable but CSP-disallowed receiver, a 307 redirect, revocation and
lifecycle loss. Independent receivers must observe GET200/POST302/GET200 with
two authored operations for the readable case. Holding the final response must
hold settlement. Loaded iframe navigation bytes and enforcing response CSP must
be retained. A disallowed redirect must produce a browser CSP observation with
zero receiver arrivals, without a harness abort. An unexpected path on an
allowed recipient is permitted. A 307 preserves POST; it is not evidence that
the runtime enforces 302 or an exact physical request count.

Consent/permission withdrawal, owned worker loss, frame identity loss,
deadlines and disposal deny future authored calls and discard late results.
Cancellation cannot guarantee zero subsequent arrivals. An opaque result means
the operation settled with HTTP unknown. Required unreadable primary data stops
before the secondary. No recorder response is fed into the runtime.

**Recorded outcome:** the first source safety review found three blockers:
effective CSP upgrade permissions, final absolute deadlines and the parent's
broad frame policy. Terra corrected them with witnessed RED/GREEN controls, and
a fresh pinned Sol source closure passed. The command was then issued once on
Chrome156.0.8078.80. Independent receivers observed the readable
GET200/POST302/GET200 chain with two authored operations and an allowed
unexpected final path. Actual frame navigation bytes/CSP were retained.

The opaque case stopped at `response-body-unavailable`; its secondary POST
recorded `net::ERR_ABORTED`. The cause is unresolved, and no completed opaque
runtime observation is retained. The CSP-negative and remaining browser cases
did not run. Own-realm origin enforcement is still unqualified without that
paired negative control. No retry or replacement launcher was issued.

Whole CLI exit1/3.83s was observed externally. The producer reported3566ms,
69 observed request events, eight measurement attempts and1799497 retained bytes. All three
contexts/fixtures and both observed workers closed; root exit/close were0 and
the exact root/profile were independently absent. Its aggregate cleanup field
remains `UNKNOWN-or-failed-see-errors`. Descendant-tree absence and agent-loss
cleanup remain UNKNOWN. Private0600/fsynced artifacts retain the raw report,
receiver/frame evidence, source cohort and external completion/cleanup receipt.

Later source review corrected bounded streaming-response cleanup. A separate
fake-based control corrected the private body counter: the frozen attempt has
66 captured bodies, one unavailable redirect body and one failed body, despite
its old counter68. That report is not rewritten. Final corrected source hashes
have no browser run; the retained observations belong only to the issued cohort.

Retain the exact source cohort, private stdout/stderr, receiver/frame evidence,
owned handles and cleanup dispositions. The caller must independently observe
whole-CLI completion after exit. Root exit alone does not establish descendant
cleanup; unknown ownership stays UNKNOWN. Known owned termination/error paths
invalidate immediately, while genuinely unobservable OS loss can only fail by
deadline. Native cookies, CORS/client context, performance and product receipts
remain separate gaps. Full059-01 stays READY_FOR_REVIEW/non-clearing and059-15
stays IN_PROGRESS.

## Legacy Meta-to-Google proposal

This prepares a proposed owner-supervised, headed **Meta → Google** run against
the existing first-party fixtures. It does not qualify native compatibility or
unattended shutdown. Source/operational review and a separate owner decision
must precede any issuance; tests of this module do **not** issue it or launch Chrome.

The static browser selection is now `156.0.8078.80`, based on installed Chrome
plist metadata only. This source-only preparation is not a browser run,
qualification or execution grant. Owner presence, acceptance of agent-loss
cleanup as UNKNOWN, and final finite admission remain pending.

The `.76` source-only proposal was reviewed separately. Its supervised attempt
stopped at external preflight because the installed Chrome metadata had changed
to `.80`, before browser acquisition or output allocation. That approval does
not authorize this revised case. The `.48` browser observations remain historical.

## Current owner-selected acknowledgment

**Historical outcome:** the one separately approved EOF sequence passed both real
local browser journeys on Chrome156.0.8078.48. Meta received two distinct local
PageViews and Google two distinct conversions, with actual module workers,
zero-send consent controls, held-response barrier and held503 failure.
Native whole-command exit0/11.22s; Meta8644ms and Google2148ms, each within its
original interval including publication/normal cleanup. Parent independently
compared exact payload/source/response hashes and confirmed both exact root
PIDs/profiles absent. HTTP204, native parity and agent-loss cleanup remain
unqualified; earlier failures remain failures.

**Historical preflight refinement:** changing only204→200 did not remove the abort:
the one HTTP200 attempt also stopped before product work (exit1/7.82s), with
normal cleanup. The present owner separately approved one further supervised
sequence testing strict zero-body consumption. The preflight now waits for
actual EOF on the200 stream before reporting success, rejects content/missing
stream/wrong framing/read failure, and releases the reader without canceling a
successfully completed stream. Its final body-consumed state is retained.
All network-failure checks remain fatal. A witnessed pending-versus-headers RED
and55 offline controls support only this completion-contract correction;
the browser's internal abort cause is not established by this one successful
cohort. It demonstrates the corrected local sequence, not a universal browser fix.

The later source-closure correction uses a separate inert `/preflight` document
and updated exact module expectations. It has only controlled-event and Node
HTTP evidence. The historical Chrome cohort does not qualify these changed
sources. That correction retained the `156.0.8078.48` pin; the coordinator
reported an installed `.76` at the time, without launching it.

After the separately approved corrected attempt still failed on
`net::ERR_ABORTED` despite page Fetch204 and recorded empty framing, the present
owner selected: **“Try empty HTTP200 locally; keep204 unqualified.”**
Only this local fixture's successful acknowledgment changes: HTTP200 with
`Content-Length: 0`, `Content-Type: text/plain; charset=utf-8`, no body.
Both page controllers and the independent recorder require200; all unreadable
bodies and unexpected network failures remain fatal. HTTP204 is explicitly
rejected by this path, not silently reclassified as success.

This is a local-test workaround, not a diagnosis/fix of Chromium or native
HTTP204 compatibility. Prototype adapters, connector mapping, core and native
requirements are unchanged. The owner approved **one** further supervised
Meta→Google sequence under the same60s/vendor limits, cleanup included,
stop-first-failure and no automatic retry. Both earlier failed sequences and
their frozen sources/evidence remain intact. Interruption remains loss-UNKNOWN.

## Recorded attempt - 2026-10-26

The owner permitted supervised foreground execution and the procedure was
issued once. Meta preflight independently received one synthetic local GET and
completed204; the browser observed204 but response-body recording did not
complete, so the procedure failed before any product worker or journey.
Google was not acquired because a first-vendor failure stops the sequence.
The exact underlying protocol failure is unresolved; sanitized error codes
are not enough to diagnose it.

Parent-observed native exit1/8.07 seconds and normal root exit/close0, exact
profile absence, closed context/local fixture/sockets are retained privately.
No signal, vendor SDK, vendor request or production navigation occurred.
This is not a successful060-14 or059-20 run. The failed source/output are
preserved; no automatic retry or alternative launcher is authorized by this
record. The next correction must address the named preflight recorder and
retain the original failure, not broaden the execution framework.

## Historical bounded recorder correction (8b800d7)

The recorder unconditionally requested a browser body for HTTP204, although
that status has no content by HTTP framing. A controlled unavailable-body
regression failed before the correction. HTTP204 now records zero bytes with
`responseBodyState: "empty-http-framing"` without requesting a CDP body resource;
other statuses still require readable actual bytes (`captured-bytes`), and an
unavailable body fails explicitly. This follows the existing qualification
recorders rather than adding a new transport or relaxing missing-body checks.

An independent loading failure remains fatal even after204. Future request
failures retain only a `net::ERR_...` code of at most96 characters, otherwise a
fixed unavailable sentinel; URLs and arbitrary protocol messages are not retained.
Review found the initial regex lacked a length bound; an oversized-code failing
control preceded that correction. Exact96/97-character and private-text controls
pass. The narrow read-only finding-closure review passes;49 offline controls
pass, not an actual Chrome journey or whole-slice acceptance.

Two explanations of the historical attempt remain distinct: the confirmed
HTTP204 body-contract defect could explain failed body acquisition, but an
independent loading failure could also invalidate capture. The original report
omitted its specific failure reason, so its exact protocol cause is unresolved.
The failed source and raw receipt are unchanged. No browser retry was issued;
a new finite supervised attempt needs explicit admission, not reuse of the
consumed attempt.

## Fixed entry and ownership

The entry is `node rig/local-browser-foreground.mjs`, with **no arguments or
configuration options**. The parent must redirect stdout to a newly created,
exclusive, private JSON artifact, not a terminal or Git file: each vendor's
`privateOwnership` contains the exact owned PID/profile for an UNKNOWN handoff.
`privateEvidence` retains the synthetic receiver documents, correlated command
checkpoints and actual request/response/worker observations, not just counters.
There is no output-path option. Do not pipe through an uploader or retry a
failed/nonempty run.

The proposed entry selects Chrome **156.0.8078.80**, headed, through unchanged
`rig/qualification-loopback-chrome` and its exact existing Seatbelt policy.
The installed plist is metadata, not proof of the launched binary's version.
The procedure rejects a different browser-reported version before navigation.
The parent must check the proposed cohort and source identities before any
acquisition; these checks do not establish atomic custody of the executable.
Playwright creates each fresh profile; no personal/shared MCP browser is used.
The WebSocket listener and connection are literal `127.0.0.1`. Pending
acquisitions are retained before awaiting them, including late resolutions.

Each vendor has its own original 60 seconds, starting before fixture creation:
work ends at 50 seconds; cleanup and vendor-output publication use the reserve.
Completed vendor records are streamed **before** the next vendor starts. The
footer completes one ordinary JSON document, recording actual stdout callbacks;
interruption may leave an incomplete artifact. The parent must independently
observe the actual whole-CLI exit afterwards, require the aggregate
`normalJourneyChecks: "PASS"`, and verify both publication receipts. Producer
output cannot attest to its own future exit.

## What the fixed run does

- Install exact local manifest/method/body/URL routes before creating each page;
  serve actual fixture assets, never fulfill substitutes. Block service workers,
  WebSockets, unexpected frames/pages, unknown resources and all external URLs.
  Grant local-network access only for the current fixture origin.
- On the first fresh fixture/context, load the fixed inert `/preflight` page.
  Product pages, scripts and workers are rejected in this phase. Send a fixed
  canonical synthetic query with page Fetch to the **actual HTTP receiver**:
  hold/release one positive, enforce an exact local abort and independently
  observe zero new arrivals, then remove only that denial and observe one
  bypass-positive arrival. Close this fixture before product navigation.
- Use a second fresh fixture/context for the real adapter's module-worker
  journey. Observe its worker event, complete loaded-source graph and hashes;
  independently require zero pending/denied/grant-without-command arrivals.
  Start positives without awaiting the command promise; observe the first
  held receipt while its correlated result is absent, release it, then require
  both exact documents, actual empty200 responses and command/worker disposal.
- Use a third fresh fixture/context for a held **503**. The second queued
  command is explicitly locally aborted, so this control receives exactly one
  failed measurement and **no 2xx**, with a failed page/outcome and no
  qualification. It is not a retry of the product fixture.
- Independently attempt every context, connection, server and fixture close.
  Require actual non-signal exit and stdio-close callbacks, server close
  resolution/event, absent owned profile, closed worker and zero fixture sockets.
  If normal close fails, only the retained exact child may receive SIGKILL;
  that cannot produce PASS. Never scan/kill by name or remove a failed profile.

Limits are shared across the three fixtures **within each vendor**: 64 observed
requests, 8 measurement attempts, 8192 URL bytes, 64 KiB request/header bytes,
2 MiB response bytes and 8 MiB cumulative retained evidence. The expected
sequence has 7 measurement attempts: 2 preflight receipts + 1 preflight abort,
2 product receipts, 1 error receipt + 1 error-control abort. Overruns, missing
observations and unknown surfaces fail; no counter or HTTP status alone passes.
The controlled-event tests count 56 Meta and 62 Google requests under these
limits. They model separate main and worker module requests; they do not
measure Chrome caching or establish the counts of a future browser run.

The proposed local Google response-chain extension is not implemented. Its
secondary stage requires a manual HTTP302 and its `Location`. Browser Fetch
exposes a manual redirect as an opaque-redirect response, so the existing
adapter cannot read that status, header or body as it can in Node. This is a
source and browser-platform blocker, not an observed Chrome result. Do not
launch the proposed chain or infer empty response bytes. No Fetch bypass or
replacement transport is approved by this procedure.

Source and evidence for this stop:

- The [adapter](../adapters/google-ads-prototype.js) uses
  `redirect: "manual"` and requires a readable response body and secondary
  `Location`. The [worker](../connectors/google-ads/conversion-prototype.worker.js)
  requires secondary status302 and that header before it issues the final GET.
- [MDN's Response.type reference](https://developer.mozilla.org/en-US/docs/Web/API/Response/type)
  describes `opaqueredirect` as status0, empty headers and a null body. This
  platform finding is not an observation of Chrome in this packet.
- The [Node worker control](../test/google-manual-worker-chain.test.js) first
  receives the actual local POST and302, then returns a browser-shaped
  opaque-redirect **model** to the adapter. A matched unmodified Node control
  reaches all three local receivers. Neither control is a browser run.

## Scope and stop

The receiver is independent HTTP evidence, not controller JSON or transport
settlement. Public vendor fields are redacted; only `privateOwnership` contains
raw owned profile/PID data. Source hashes bind the exact launcher, policy,
procedure, fixture and actually served module graph.

The Seatbelt source belongs to a **legacy loopback cohort**, not a current
native/public-IP full-guard proof. No public DNS/IP probe, SDK, Docker, provider,
production or vendor request belongs to this procedure. Meta's eight local
fields do not establish its twenty historical fields. Google's twelve
historical rows/62 names, 39 primary names, five local mappings/34 missing names
and missing response-linked branch remain unchanged. Native identity, cookies,
response behavior, attribution and performance are unqualified.

`fullCompatibility` and `interruptionLossQualification` always remain false.
Interruption/agent loss remains **UNKNOWN**, with owner cleanup of the exact
test browser; retained promises and signal handling do not guarantee cleanup
after loss of the producer. Do not inject browser-loss/TERM experiments here.

Offline checks only:

```sh
/opt/homebrew/Cellar/node/24.10.0/bin/node <resolved-vitest-cli> run test/local-browser-foreground.test.js test/local-browser-journeys.test.js
/opt/homebrew/Cellar/node/24.10.0/bin/node <resolved-eslint-cli> rig/local-browser-foreground.mjs test/local-browser-foreground.test.js
```

The controlled-browser tests use synthetic browser/worker events and real
literal-loopback **Node HTTP**, not Chrome execution or native guard evidence.
The CLI serialization test imports the foreground entry as main only inside
Vitest, after mocking Playwright, the fixture factory and stdout. It does not
launch Chrome or issue a real foreground command.
