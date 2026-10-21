# Native stock capture: Meta stock spent/inconclusive

[059-15](../docs/specs/059-google-ads-full-compatibility/slice-15-native-stock-capture.md)
has admitted **one original Meta stock case**, which is now permanently
spent/inconclusive. No complete native reference was obtained. The stock CLI
remains disabled; the separately gated native API executed once. Google stock,
Google chamber and Meta chamber remain unused, and the incomplete Meta stock
reference blocks its dependent chamber case.

## Additional Meta case interface (059-18 / ADR-0035)

The owner authorized **one additional** Meta stock case at
2026-10-21T18:33:04.581Z, delegating routine preparation and scheduling. This
does not refund the original spent/inconclusive case. Conditional additional
grant and inspection records now exist; they are not an executable case
permission, window, reservation or SDK execution.
The original `--execute` CLI remains disabled.

The existing `prepareInspectedMetaStock` / `runInspectedMetaStock` API has a
closed additional variant, not an authority registry or an override:

- Native authority ID: `meta-stock-additional-2026-10-21`; variant:
  `additional-meta-2026-10-21`. Only `meta-stock` is present in `cases`,
  initially `{reserved:false, admitted:false, spent:false}`. No Google or
  candidate authority is synthesized.
- Authority schema remains `schema_version:1`,
  `kind:"owner_conversation_authority"`, `status:"approved_conditional"`.
  Its closed fields additionally include `authority_variant`, `self_locator`
  (`path/dev/ino`), `lineage_baseline` (`path/sha256/dev/ino`), `commands`
  (`init:1,pageview:1,consent:"native-default"`) and `limits`. Native records
  cannot contain `synthetic_only`.
- The authority's basename is its fixed ID plus `.json`, beside the genuine
  original authority. Authoring establishes its own inode before final bytes
  and permissions are bound; copying it to another path/inode is not a grant.
  The separate location permission hashes the completed authority.
- `limits` is Meta-only: `physical_vendor_https_attempts:8`,
  `observations:64`, `url_bytes:2048`,
  `request_headers_and_body_bytes:65536`, `response_bytes:2097152`,
  `retained_aggregate_bytes:8388608`, `absolute_duration_ms:60000`.
  The shared runtime limits are unchanged.
- Manifest `binding.additional` contains exactly `variant` and
  `lineage_baseline`. That immutable baseline commits the original authority,
  actual spent `meta-stock.reserved`, and genuine new owner decision by
  canonical handles, SHA/device/inode. Native baseline/decision byte
  commitments are fixed in the validator. The original authority's historical
  unspent flags are **not** its actual consumption status: the separate
  canonical journal must be semantically spent and match that authority's
  exact ID/hash/case. Neither original file is ever written.
- `binding.scheduling` contains exactly `selected_by:"operator"`,
  `delegated:true`, `owner_message_at:"2026-10-21T18:33:04.581Z"` and
  `selected_at_ms` (not later than `window.not_before_ms`). The finite window
  remains at most 60 seconds including cleanup/publication. Selection is under
  owner delegation, **not** an exact owner-selected timestamp. A changed
  pre-admission window needs new context bindings, receipts and actual
  coordination; expired evidence or a consumed slot cannot be rescheduled.
- `inspection_permission` uses the separate closed
  `kind:"inspected-meta-additional-permission"`,
  `status:"approved_additional_reference_design"` record. Besides
  `schema_version/scope/owner_decision/lineage_baseline`, it explicitly records
  `original_authority_mutated:false`, `original_slots_reserved_or_spent:1`,
  `additional_slots_reserved_or_spent:0`. Scope uses the one additional slot,
  not the original, with no extra event/retry grant. Inspector trust, strict
  real upstream TLS, physical/byte limits and historical timing exceptions
  are unchanged.
- The location permission is the fixed sibling
  `meta-additional-case-permission.json`, with the existing location fields
  but `kind:"inspected-meta-additional-case-location"`. It binds the additional
  authority's locator, canonical slot, complete case context digest and exact
  expiry. The slot is `native-stock-slots-<fixed-additional-id>/meta-stock.reserved`.
  Output changes, copied permissions and parallel preparations cannot renew it.

The journal's optional `additional_binding` is the **complete manifest binding**,
not an approval flag. Additional reservations require the same closed lineage,
inspection/location permission, source/input/window/command envelope and
exclusive fsynced spend. The returned `canonical_record_identity` comes from
the written descriptor, not a newly discovered replacement. Reservation still
confers no network authority. All original/synthetic legacy paths retain their
existing limits and qualification-v1 behavior.

Every old setup/source/frame/compliance/craft/architecture/reconciliation and
actual nonoverlap/resource gate remains mandatory. In particular the genuine
dated setup report is not made fresh provider readback by this authorization.
The private prepared-plan/native-transport WeakMaps remain the only execution
handoff. Snapshots cover the complete additional lineage through script
continuation, reservation, cleanup and publication.

### Additional-path SDK-absent qualification

Native additional guard receipts require **both** the unchanged `qualification`
(fourteen controller / eleven relay cohorts) and `additional_qualification`.
The latter handles a closed
`airlock.sdk-absent-additional-meta-validation.v1` index with exact current
`source_pins`, false SDK claim, numeric zero public requests/actual owner slots,
and two ordered `cases` (H1/H2). Each row binds the fixture manifest, report,
capture, completion and independently observed `actual_child` by path/hash.
The reader follows the actual synthetic additional lineage and consumed slot,
source originals/resumption, original responses, actual child command/exit,
and complete closure/publication. It does not promote a local plan to native
authority, replace independent reviews or relabel old normal cohorts.

The AC6/7 compliance correction additionally derives the complete request row
from retained request bytes through the existing strict wire observer and
compiled policy, rather than trusting match flags. Exact ownership/URL/method,
ordered headers/byte counts, stream and logical IDs must agree with the
receiver and actual Network/Fetch evidence. Staged headers must agree with
their corresponding physical fields; the existing late-header distinction is
not an excuse for contradictions or request bodies.

This reader recognizes only the fixed normal H1/H2 first-party positives:
canonical nonempty base64 wire, the actual H1 status/framing or bounded H2
SETTINGS/ACK/header/DATA sequence, the pinned header decoder, exact original
response headers/status/length/body, and the fixed fixture PNG. It compares
whole retained request/response byte counts and hashes against both receiver
and broker, with matching peer/protocol and complete closure. H2's request ACK
is checked against both original control directions before the synchronous
request-only replay; full untouched wire remains the endpoint comparison.
Unknown framing/control shapes fail closed, not a new generic/native parser.

The opt-in test also retains 74 refreshed-hash contradiction archives derived
from copies of the genuine H1/H2 packet and causal evidence. Each archive
passes before its one contradiction, then must reject; genuine captures are
never edited. `genuine-original-negative-controls.json` binds those archives
and their genuine source captures. This is reader regression evidence, not
additional native authority or proof of arbitrary protocol surfaces.

```sh
PATH=/opt/homebrew/bin:$PATH node rig/meta-additional-qualification.mjs \
  --witness-additional --output-dir /absolute/private-parent/new-059-18-witness

AIRLOCK_ADDITIONAL_META_QUALIFICATION=1 \
AIRLOCK_ADDITIONAL_META_OUTPUT=/absolute/private-parent/new-059-18-tests \
PATH=/opt/homebrew/bin:$PATH node node_modules/vitest/vitest.mjs run \
  rig/meta-additional-qualification.test.mjs --maxWorkers=1
```

These are fixed first-party SDK-ABSENT programs using the existing confined
launcher and literal-loopback receivers. They never accept URLs, drivers,
native grants or public mode. Fixtures remain privately under `rig/out/059-18-*`;
the explicit witness folder retains the index and post-child receipts. An
external caller must separately preserve whole-command exit and final hashes.
New source/test/helper changes invalidate prior source-bound indices; refresh
the shared fourteen/eleven proof after final reviews as well as this proof.

The earlier fourteen/eleven refresh and initial additional-path indices remain
historical after this reader correction. Corrected-source additional tests
passed 100/100 (including the actual H1/H2 positives, 74 genuine-derived
contradictions and three reservation-mutation controls); closure regression
passed 632 with 33 opt-in skips. Removing the new broker-to-retained-wire hash
guard defeated both H1/H2 regressions, and exact source was restored. Parent
reviews and a fresh shared fourteen/eleven index are still required.

The subsequent craft correction closes the entire additional reservation
record: exact journal keys/schema version, spent Meta case, authority/source/
input/window/variant/lineage/binding relationships, and
`execution_prerequisites_proved_by_reservation:false`. Its safe-integer
`reserved_at_ms` must be inside the half-open case window and strictly earlier
than recorded resource closure (and thus the ordered capture/report/publication
times). A matching outer hash cannot validate an expired, late or malformed
reservation. Fifty H1/H2 refreshed-hash reservation controls accompany the
unchanged 74 packet controls, in `genuine-reservation-negative-controls.json`.

The qualification runner persists the actual child outcome before inspecting
originals. A failed startup/timeout stops with
`additional_qualification_child_failed`, without trying absent report/capture
paths or publishing an index. A real fixed-child Node startup failure witnesses
this ordering; no additional public program or dependency-injection mode was
added. The craft-corrected actual additional suite passed 151/151; affected
unit suites passed 264 with 19 opt-in skips and repository lint passed. Removing
the reservation-before-cleanup guard defeated both protocol regressions; exact
source was restored. All preceding indices remain historical, and parent
reviews/shared fourteen/eleven refresh and real admission remain separate.

### Mandatory fixed-child supervision (architecture correction)

`runAdditionalMetaQualification` no longer waits on `execFile(timeout:60000)`:
Playwright's SIGTERM handler is graceful, so that was not a finite shutdown
guarantee. It now calls `superviseAdditionalMetaChild` from
`meta-additional-supervision.mjs`. The helper accepts only the confined
additional fixture manifest, H1/H2, a fresh private output directory, and the
fixed `normal` / `stuck-shutdown` controls. No URL, executable, driver, clock,
timer or arbitrary program can be supplied.

Each child has a monotonic budget no longer than 59 seconds and no later than
its existing case-window expiry. Normal work stops at 40 seconds; TERM, a
bounded grace period, identity-checked STOP/inventory/KILL, browser cleanup,
endpoint observations and fsynced receipts have explicit reserves. Parent
waiting uses the actual Node `exit`, never an unbounded `close`/graceful-browser
promise. Parent pipe/IPC handles are closed and the child handle is unrefed
after the finite observation budget; an unproved child exit remains a durable
unknown/unqualified handoff, not a fictitious successful exit.

Ownership follows the 059-16 model, narrowly mirrored rather than changing that
producer: exact PID/birth/image hash/UID/process group, verified direct parent,
launch-created private profile device/inode/birth/path/UID, and literal-loopback
listeners owned by the Node child. Registration receipts are exclusive and
fsynced before acknowledged acquisition/shutdown. Pending launch is registered
before Playwright starts; only the pinned launcher-to-sandbox-to-Chrome exec
chain may refresh the same lifetime's image. Known exiting/zombie children are
not relabelled as live executables. Chrome's observed exact
`/usr/bin/profiles status -type enrollment` startup subprocess is tracked only
through its owned Chrome parent/group, not by a global name lookup or permission
claim. Every signal rechecks the specific lifetime; no process-name/group-wide
or shared-MCP kill is used.

After child exit, the parent observes all registered browser lifetimes stopped,
removes only the unchanged launch-created profile, checks registered endpoints,
and disposes of the two registered ephemeral TLS keys only after verified
process closure. Changed/unregistered resources remain unknown, unqualified
and explicitly recorded. This is per-case resource evidence, not host-wide
quiescence or an Adobe resource hold.

Additional proof now **requires** the actual child's `supervision` handle to
`airlock.additional-meta-supervision.v1`: exact command/current source closure,
durable acquisition registrations, actual exit, process/profile/port/key
disposition and the same finite timing. The private `--supervised-child` entry
requires IPC from this supervisor. Direct unsupervised additional execution is
blocked; original/synthetic legacy execution and the disabled stock CLI are
unchanged.

The genuine stuck control first allocates the owned confined Chromium,
consumes the fixed first-party response and saves
`supervision-abort-originals.json` without claiming closure. It then actually
stops that Chrome and ignores Node SIGTERM. The parent observes the TERM
receipt, escalates both owned lifetimes and proves process/profile/endpoint/
key cleanup. Its result stays **unqualified**, with actual SIGKILL recorded.
Matched normal H1/H2 remain positive. The new helper and its tests are included
in both fixed source closures.

Final architecture-correction results: **697 unit passes / 34 opt-in skips**,
repository lint pass, and **166 actual additional-suite passes**, including
the real forced-shutdown failure proof. The pre-signal birth guard was removed
to defeat its regression, then restored to exact source before the final runs.
Two early development failures before complete browser registration retain
**unknown browser/profile and unregistered-key disposition**; they are not silently cleaned,
refunded or qualified. A separate registered stopped-browser failure has a
recorded exact-identity late recovery, leaving its original failure unchanged.
These historical unknowns are a concrete parent resource-handoff caveat,
not evidence of global closure. Parent reviews, final shared fourteen/eleven
refresh and any real-case resource clearance/admission remain outstanding.

The subsequent architecture **reader-semantic** correction leaves that finite
termination design unchanged. A successful proof must now contain the complete
final `node_processes` inventory: an explicit empty array means absent; any
listed row must be the exact recorded Node PID/parent/group/UID/birth in an
actual zombie state with final `"zombie"`. Missing, live, unknown, duplicated,
malformed or unrelated group members reject despite closed/qualified flags.

The reader also validates closed ownership registrations in order:
`node`, `ports`, `browser-pending`, `browser-discovered`, `browser-ready`,
`resources-final`. Every snapshot binds its Node identity, cumulative ports,
complete key device/inode/birth/UID/size, browser/profile identity and member
lifetimes to the final ledger. Member ancestry must be rooted in the same
browser group. Only the observed pinned launcher/sandbox-to-Chrome image
transition is permitted before ready; browser-ready and final snapshots must
bind the final Chrome command hash and exact profile. Acquisition must precede
producer cleanup; final registration must follow the observed Node exit and
remain inside the same finite proof interval.

To make those relationships auditable, the producer adds **metadata only**:
the already-observed browser root command, actual Node exit wall timestamp,
and a final ownership-ledger registration. No signal, timeout, acquisition or
cleanup policy changed. Phase-only fixtures no longer pass. Eighty-two new
refreshed-hash controls run against independent copies of **both actual H1/H2
proofs**, without changing source manifests, slots, HTTP originals or original
supervision receipts. The reader preserves legitimate empty/zombie inventories
and a complete launcher exec transition.

Affected unit suites passed **361 / 20 opt-in skips**; final actual suite passed
**249/249**, including the stuck control and all 206 original/reservation/
supervision contradiction archives. Removing the new final Node disposition
guard defeated both protocol regressions; exact reader source was restored.
The first unchanged-source actual attempt was rejected by the existing
`additional_group_unanchored` supervisor denial (resources recorded closed,
qualification false); it remains intact and was not relabelled as a pass.
The fresh accepted proof is separate. Earlier unknown acquisitions, parent
operational review and shared fourteen/eleven requalification remain separate
readiness obligations, not retrospective successes.

### Reader-source checkpoint before the later ordering fix - 2026-10-21

The final reader/supervisor source has parent-executed **780 unit passes /
34 explicit opt-in skips** and targeted lint pass. The current shared
fourteen-controller/eleven-relay proof passed **99 controller / 352 regression**
tests and strict source/original verification. Independent inspection of the
current additional-path index passed; **4,496** post-exit original and command
witness hashes/device/inode identities were checked. The author's actual
249-pass suite and 206 contradiction archives are retained separately.
Earlier indices and failed attempts remain historical, not relabelled.

The genuine original authority, spent reservation and new owner-decision
bytes remain unchanged. The parent created only the new conditional grant
and inspected-permission data; no executable case permission, additional
reservation, selected live window or native SDK execution exists. The
prospective 20:30-20:31Z proposal was withdrawn before any hold or admission.
Routine finite scheduling is delegated, but exact case-bound receipts,
truthful dated setup/source evidence, current coordination and actual result
remain required.

Four exactly attributable temporary private keys from the two early failed
acquisitions have since been removed with recorded identity checks. That
disposes of those keys only: their historical browser/profile dispositions
remain **UNKNOWN**, not merely leftover directories. Named-panel registry
closure, absence of particular Node/proxy/SPKI-root markers, current relevant
helper quiescence and host-wide exclusion are different claims. The first
two do not establish the latter two. The separate Adobe lane retains its own
readiness gate; no review here clears it or grants broader process/profile
authority. New-case ownership and finite coordination must be established
without rewriting either old failure.

The subsequent independent current-helper assessment could not prove the
requested whole `stock_helpers` / `source_helpers` / `worker_tests` quiescence
from the retained ownership records. Both early ledgers lack a browser/group/
descendant anchor; current registered-subset observations and no-work-queued
reports do not fill that active-process evidence gap. A supported retained
no-acquisition record or attributable lineage/termination evidence is needed
for the stronger claim. This is not a historical-directory deletion condition,
a reason to promote failed proof or permission to inspect/kill unattributed
processes. No live window or finite hold was created.

### Craft turn-2 discovery ordering correction — pure-unit checkpoint

Polling and `browser-ready` could overlap while the first discovery had inserted
ownership but had not finished group inventory/publication. A local promise
chain now serializes that real acquisition. Each caller still scans afresh;
rejected discovery stays rejected. No phase-order relaxation, new program/API,
signal/escalation or deadline-policy change.

The deterministic regression executes the real supervisor/discovery/ledger
path with in-memory child-process, OS-query and TCP doubles. It holds the
inventory barrier, delivers overlapping ready IPC and requires no early ACK,
ordered publication, legitimate launcher exec and a fresh late-member scan.
The simulated child exits 2 and remains unqualified; no copied logic or
fabricated passing qualification is used. Red failed before the fix; removing
the real serialization defeated it again; exact source was restored. Pure
helper units passed **7**, with the real-browser opt-in skipped; lint passed.

Work resumed at **2026-10-21T21:47:00Z**, superseding the earlier 21:44 UTC idle
attestation. This source/pure-unit correction ran **no Chromium, loopback browser
qualification, benchmark or real case**. The preceding parent checkpoint and
its 4,496/shared source-bound proof are historical after this source change.
Fresh browser/shared qualification awaits separate parent permission and
review. Earlier failures and UNKNOWN browser/profile dispositions are unchanged.
No browser work is queued; this is not a renewed resource-clearance, hold or
execution-readiness claim.

### Current reviewed-source checkpoint - 2026-10-21

On the frozen ordering-corrected source, parent pure checks passed **781**
with **34 explicit opt-in skips**, and targeted lint passed. Fresh shared
fourteen-controller/eleven-relay qualification passed **99 controller /
352 regression** tests with actual outer exit 0 and strict post-exit current
source/original inspection. Compliance, craft and architecture each confirmed
bounded ordering-delta continuity, preserving their original findings and
actual review scopes rather than claiming a new full audit on every turn.

The additional suite ran exactly once and passed **250 tests**, actual outer
CLI exit 0 at **22:12:56.933532Z**. A private observer save-path preflight had
failed before Vitest/browser execution; its unchanged originals are retained.
The corrected save preflight used no browser, and the actual suite used a
distinct fresh output namespace with no source changes or hidden retry.

Normal H1/H2 qualified with complete original responses and owned closure.
Three mutation races exited 2, startup exited 1, and the forced stuck control
ended SIGKILL in **9,592 ms**; those controls remain unqualified. All **206**
contradiction archives are retained. The parent independently checked the
current additional reader and **10,051** artifact hashes/device/inode identities
plus **30** source-file locators; current additional/shared source vectors
match. Original authority/spent/decision and conditional new records are
unchanged. No executable case permission, real additional reservation, native
SDK, provider traffic or live window exists.

Checkpoint reconciliation passed for the IN_PROGRESS code checkpoint only;
exact case-bound setup/source/resource/nonoverlap evidence remains separate.
Historical browser/profile
UNKNOWNs and the blocked stronger whole-helper assertion are not cleared.
There is no host-wide exclusion, new cleanup authority, performance/CWV,
complete native wire, replacement or C2/C3 acceptance claim.

The first actual additional-path positives exited zero with complete original
responses/closure; an initial verifier cleanup-field-count error rejected their
outer qualification and is retained as a failure, not rewritten. Qualification
is not native/vendor acceptance. The actual additional operator result, live
coordination, reviews, source-wide final requalification and any native run
remain the parent's responsibility. Missing readiness stops before admission;
failure, interruption or zero HTTP after reservation is permanently spent.

## Actual Meta stock outcome - 2026-10-21

The owner separately approved the 16:15–16:16Z (09:15 PDT) window and
original-slot binding. After actual case-bound reviews and scoped coordination,
active-window preparation passed and the fixed caller ran once. The canonical
original Meta stock reservation was durably consumed before official source
execution. Actual caller exit was **2**, after **5,325.795 ms**, with
`unqualified_route_or_field`, `native_browser_error` and
`native_stock_inconclusive`. **Zero public upstream HTTP requests were forwarded.**

Both pinned official resources were fulfilled and their execution resumed.
The attempted PageView Image was blocked before forwarding. Full SDK
completion, source consumption and native processing were not established:
`native_sdk_executed` is null, `local_result` is null and the native reference
is incomplete. Zero forwarded HTTP is not zero SDK execution, a refunded slot
or an accepted empty reference. Private report, capture, completion and actual
external-command hashes remain unchanged.

All sixteen cleanup flags were verified true. The actual cleanup handoff at
**16:17:13.239Z** explicitly released the finite Adobe source/test/qualification
hold. That lane resumed code and SDK-absent work; its earlier closure receipt
is no longer current. No host-wide/shared-MCP closure is claimed.

Offline replay isolated two missing query keys, `mdc[data]` and
`mdc[version]`, emitted by the authenticated source cohort. The original
1,543-byte GET/Image had the exact owned Pixel, PageView and document, and no
duplicate query fields. The corrected pure policy permits that pair only for
`authenticated-2026-10-21`: both members must be present together; the version
is 32 lowercase hex characters; data has exactly `json_ld`, `opengraph`,
`schema_org` and `rdfa`, each containing only a nonempty canonical-base64 `b`.
Duplicate JSON members, including escape-equivalent names, reject. These are
observed shape constraints, not decoded-content semantics or universal Meta
coverage. Historical-cohort vocabulary and all original caps remain unchanged.

The unchanged original request now passes **eligibility only**, with dispatch,
source-byte verification and independent ownership-authentication claims still
false. Neither the request nor the failed reference was rewritten. Earlier
guard indices are historical after this policy-source change. Fresh
current-source qualification passed 99 controller and 351 regression tests
(one older browser opt-in skipped), with all fourteen controller cases,
eleven relay cohorts and referenced originals/cleanup/source/command witnesses
verified. Compliance, craft and architecture reviews passed for this offline
delta. These are SDK-absent, loopback-only controls and scoped code reviews,
not live acceptance. This correction
does not rerun, refund or qualify the spent case. Any future live attempt needs
new explicit owner authority and scope; no new namespace, automatic
rescheduling or chamber-slot substitution is permitted.

## Implementation and qualification history (pre-admission)

The owner clarified on 2026-10-19 that the 2 MiB response cap governs what our
recorder **retains and accepts**, with immediate cancellation and an
inconclusive result on overflow. It does not promise a hard ceiling on Chrome's
internal receive/decompression buffers. No event count, byte ceiling or
permission to accept truncated/reconstructed data increased. The owner
separately allowed an isolated-reference timing exception for later
browser-added request headers: staged headers/body must fit before sending;
final headers still must fit the accepted capture. An observed final overrun
cancels immediately and remains spent/inconclusive, even if bytes have already
reached the collector. This does not relax request counts, production or
candidate rules.
The original strong pre-continuation response hypothesis below remains
historical diagnostic evidence, not the clarified response requirement.

### Opaque-transport blocker: browser-internal HTTP retries

A fixed, SDK-free, first-party receiving-sink matrix now demonstrates a
different pre-admission failure. Both HTTP/1.1 connection-close and HTTP/2
REFUSED_STREAM/GOAWAY controls delivered **3 actual backend HTTP attempts
from 2 pre-send admissions**. At the Meta ceiling, the receiver observed
**9 attempts from 8 admissions**; the HTTP/2 retry used the same authenticated
tunnel, on a new stream.

The duplicate had only one Fetch pause, one `Network.requestWillBeSent`
and one final ExtraInfo observation. Neither logical request counting nor
CONNECT counting therefore enforces the declared physical-attempt ceiling in
this tested cohort. Denying replacement tunnels contained the H1/GOAWAY
controls only by producing an inconclusive transport failure; it did not
contain the same-tunnel H2 retry. This is not a guessed retry maximum or a
passing suppressed-retry reference.

Matched same-origin H1/H2 normal controls each delivered one request from one
admission. Separately, owned-like cross-origin Image controls reached no
collector because fresh-tunnel proxy authentication failed. The same-origin
counterexample is real; it is not qualification of the still-unproven
cross-origin opaque-native path. The inspected local experiment below is a
separate transport cohort, not a qualification of that opaque path.

The stock CLI remains unconditionally disabled before owner-file IO,
reservation, browser or SDK startup. That diagnostic matrix used no official
SDK, public provider or actual owner journal. Both owner timing decisions leave the strict
physical-request count requirement unchanged. The owner subsequently approved
the following local inspection experiment, followed by a separate
**conditional inspected Meta reference decision**, described below.

```sh
PATH=/opt/homebrew/bin:$PATH node rig/native-stock-capture.mjs \
  --witness-meta-counts --output-dir /absolute/private-parent/new-count-witness

AIRLOCK_META_COUNT_QUALIFICATION=1 PATH=/opt/homebrew/bin:$PATH \
  npx --no-install vitest run rig/native-stock-meta.test.mjs
```

The diagnostic child (`--qualify-meta-counts`) exits **2**, including when it
successfully witnesses the blocker. The external witness wrapper exits **0**
only if it observes that actual child exit, verifies source/receipt digests,
matched receiver controls and closure. Its zero is **not** native execution
qualification or live permission. Other qualification switches below exercise
earlier separate diagnostics, not the current count matrix.

The count probe retains `airlock.meta-transmission-count-blocker.v1`,
`airlock.meta-transmission-count-originals.v1` and
`airlock.meta-count-completion.v1` receipts. Its wrapper writes
`airlock.meta-count-command-witness.v1`; the producer still cannot attest its
own future exit. Actual-browser tests retain unique private directories in
the canonical OS temporary directory and print their paths. For durable
operator evidence, use the CLI with an explicit private location outside Git.

### Local inspected-network experiment

`reference-inspection.mjs` is a separate fixed first-party experiment, not a
replacement live switch for this blocked stock CLI. The owner approved local
qualification only on 2026-10-20. It uses the unchanged confined Chrome
launcher, a narrowly scoped generated inspector-certificate trust exception,
and independently validated upstream TLS to literal loopback fixtures. No
system trust, official SDK, public/DNS upstream, actual owner slot or existing
native-case permission changes.

Actual cold cross-origin H1/H2 Image positives each delivered two requests,
preserved the original HTTP application bytes in both directions, recovered
the original browser response bodies, and attached both partitioned cookies
set by the first response. Independent receiver streams are compared with
the inspector's accepted bytes; this is not merely an Image callback or a
copied expected request.

With a reused-H1 close, H2 REFUSED_STREAM or H2 GOAWAY at the eighth request,
the enforced receiver stopped at **8** while the inspector observed the
blocked ninth header start. Matched bypasses delivered **9**. The enforced
fault's final Image fails visibly; that is an inconclusive transport outcome,
not a successful complete reference with retries silently removed.

The broker verifies an actual owned browser peer using browser process
observations and the exact loopback connection. An untrusted Node peer,
wrong authority and absent logical authority reach no receiving HTTP
application. Separate untrusted-certificate and wrong-name controls fail for
actual upstream certificate errors, before HTTP. Generated private keys are
removed after all owned resources close.

```sh
AIRLOCK_REFERENCE_INSPECTION_QUALIFICATION=1 PATH=/opt/homebrew/bin:$PATH \
  npx --no-install vitest run rig/reference-inspection.test.mjs

PATH=/opt/homebrew/bin:$PATH node rig/reference-inspection.mjs \
  --qualify --output-dir /absolute/private-parent/new-inspected-probe
```

The producer's local-count success is exit **0**; a local blocker is exit
**2**, and invalid/setup/output failures exit **3**. The test independently
retains actual child completion and original receipt hashes. No exit implies
native stock execution or default-browser TLS parity. Independent review of
this experiment [passed within its local-only scope](../docs/specs/059-google-ads-full-compatibility/reviews/slice-15-local-inspection.md);
it remains separate from all required full-slice reviews.

The original count-only checkpoint was a GET-only framing proof. A subsequent
local composition now adds ordered HPACK fields, SETTINGS/ACK state, final
physical semantic checks, original H1/H2 response status/headers/bodies and
redirect edges, and bounded gzip/deflate/Brotli observation. This remains a
**fixed synthetic policy**, not the native Meta policy or a live controller.
The earlier scoped review does not cover these later additions. Their
[independent local composition review](../docs/specs/059-google-ads-full-compatibility/reviews/slice-15-local-composition.md)
found and then cleared two blockers: unclean close-delimited termination no
longer certifies a complete response or creates clean renderer EOF, and
failed-close/output paths preserve available case originals after cleanup.
The red/intermediate failures remain preserved. Socket clean-EOF observation
is not an additional TLS close-notify proof; this remains a local-only pass,
not full native qualification.

The current exact diagnostic cohort is Chrome **155.0.8059.85**. An automatic
update from 155.0.8059.80 first caused the unchanged gate to stop before any
case. That failed receipt is preserved; the new exact cohort was then
explicitly requalified. Historical 80-cohort evidence is not relabelled.

The composition provides these separate fixed diagnostic entries, each with
its own absolute sixty-second budget:

```sh
node rig/reference-inspection.mjs --qualify-request --output-dir /private-parent/new-request
node rig/reference-inspection.mjs --qualify-response --output-dir /private-parent/new-response
node rig/reference-inspection.mjs --qualify-compression --output-dir /private-parent/new-compression
node rig/reference-inspection.mjs --qualify-aggregate --output-dir /private-parent/new-aggregate
node rig/reference-inspection.mjs --qualify-deadline --output-dir /private-parent/new-deadline
node rig/reference-inspection.mjs --qualify-close-failure --output-dir /private-parent/new-close
node rig/reference-inspection.mjs --qualify-output-failure --output-dir /private-parent/new-output
node rig/reference-inspection.mjs --qualify-late-output --output-dir /private-parent/new-late-output
```

Use the pinned Node cohort and an existing operator-owned `0700` canonical
parent outside Git. Source/dependency digests, actual protocol results,
per-case originals and external command completion must accompany the report.
The first five cohorts (including plain `--qualify`) succeed only if all their
matched controls pass. Deadline/failed-close/output-collision diagnostics
intentionally exit **2**, while late publication exits **3** with no completion
receipt. A wrapper may witness that expected failure without turning it into a
successful capture.

Real request controls cover marker/path/method/header/URL checks before
forwarding, including exact and one-over headers. Response controls retain
nonempty redirect originals and actual browser redirect edges, stop on
truncation or unsupported informational/trailer behavior, and exercise
header-inclusive exact/over decoded responses under unknown-length gzip,
deflate and Brotli. Aggregate browser controls use a below/over pair; the
exact aggregate boundary is a separate ledger test. Failed-close ownership,
private output collision, deadline and late-output controls remain visible.

Every retained plaintext wire copy, logical URL, receiver evidence, ordered
semantic header observation and decoded original body shares the per-case
8 MiB ledger. Headers and decoded body share the 2 MiB response cap.
Serialization encodings are not new observation channels; this is not an
RSS or browser-internal-buffer claim. Independent sink equality uses
incremental digests rather than retaining another full duplicate wire stream.

Request bodies, informational responses, trailers, chunk extensions, HTTP/3,
server push, raw deflate, stacked/unknown codings, nondefault H2 frame-size
settings and oversized header tables remain explicitly unsupported. The TLS
fingerprint is intentionally different, so none of this establishes ordinary
browser-native TLS equivalence, vendor processing or attribution. Actual
stock execution remains blocked.

### Declared Meta policy binding

The pure wire observer also accepts the explicit
`DECLARED-META-PROFILE` mode. It compiles `createNativeStockPolicy`, checks
each physical final request, and requires an actual logical-observation
binding for its URL, method and resource type. Classification does not
authenticate ownership, verify executable source bytes or grant dispatch.
All original ordered header pairs remain budgeted and retained; the
classification-only header-object view is not substituted for wire evidence.

The fixed `--qualify-declared-meta` cohort exercises this mode with generated
fake selectors. Although browser URIs use `www.facebook.com/tr/`, the broker
maps only to literal loopback fixtures: no public provider or DNS path exists.
It includes actual Image positives, same-URL/GET/empty-body Fetch denials,
marker loss, missing/ambiguous bindings, redirects and below-interception
retries over H1/H2.

Network and Fetch IDs remain distinct. A redirect may reuse a Network ID only
with a new actual Fetch ID and an exact completed parent response. A hidden
retry reuses the earlier logical observation but gets a new physical and
policy ordinal. The pinned Chrome reports JavaScript fetch as Network
`Fetch` and interception `XHR`; the binding retains both and never invents
the profile's expected `Image` type.

The current 33-case local cohort passed with independent command completion
and source/receipt hashes. Its
[scoped binding review passed](../docs/specs/059-google-ads-full-compatibility/reviews/slice-15-declared-meta-binding.md);
a null-profile error-category nit was corrected with a witnessed regression.
It
still proves neither official SDK consumption nor a complete native-case
controller. Canonical reservation, all full-slice reviews and fresh
setup/source/coordination/window admission remain required.

### Conditional Meta reference authority

[ADR-0034](../docs/decisions/adr-0034-inspected-meta-stock-reference.md)
records the owner's later approval to use the inspected connection for the
existing `meta-stock` slot, only after all remaining gates pass. It retains
one PageView, eight physical attempts and the original sixty-second/byte
envelope; it does not add an event, renew a slot or permit a retry.

The separate permission must be bound to the private manifest alongside the
original authority. This is not immediate execution or an approved window.
Semantic/header/body/response/aggregate guard composition is implemented and
has current SDK-absent qualification. Frame, compliance, craft and architecture
code reviews passed; reconciliation and genuine case-bound reviews/permissions,
fresh setup/source/coordination and a finite window still gate execution.
Google, chamber and production inspection are not approved. Mandatory cohort
labelling keeps ordinary-browser TLS, matching and attribution unproved.
The executable stock entry remains disabled.

### Controller preparation checkpoint

`inspected-meta-stock.mjs` now provides closed private-manifest preparation
and a separate SDK-absent local controller. Preparation binds explicit input,
authority, inspection-permission, source/cohort/window and evidence handles;
it does not reserve an owner slot or authorize networking. Native preparation
returns an opaque blocked plan when any required binding/evidence is missing.
The implemented native run function requires that genuine prepared plan and
rechecks admission before the original reservation and SDK work. Neither the
local fixture nor a caller-authored object can supply a native transport lease.

The local-only plan uses fixed generated first-party scripts, fake selectors
and synthetic authority under private scratch. Its actual headed H1/H2
controls exercise the shared peer/two-TLS raw relay, source immutability,
before-script reservation ordering, bounds and failed cleanup/output
evidence. Synthetic source parsing and local journal reservation are expressly
not official SDK consumption or an actual owner reservation.

The first controller baseline retained twelve SDK-absent cases and eleven
relay cohorts; its reported 53 controller plus 285 regression tests belong to
that source snapshot. At the subsequent pre-admission checkpoint, the conditional native executor and fixed
`www.facebook.com:443` connector are implemented but **not yet admitted,
executed or reachable through the stock CLI**. Parent current-source
verification passed 67 controller tests and 285 relay/policy/decoder
regressions after adding a witnessed missing-reconciliation gate.

The closed manifest binds explicit retained-source, original authority and
separate inspection/case-location permissions; actual complete-code review
receipts for frame/compliance/craft/architecture/reconciliation; current
setup/source/coordination; and a finite case/observation window. The original
authority's path/hash/device/inode and canonical slot are fixed; a copied
authority or changed output cannot renew the case. Full installed
decoder/transitive dependency files are pinned, not only entry points.

The original conditional grant and old setup facts do not supply those new
operational bindings. Missing proof fails closed; no pass receipt or current
lease is generated by the executor. Post-execution native source-consumption
evidence is not circularly required before the first execution, and is not
asserted by SDK-absent qualification.

Review receipts preserve **discipline and context separately**. The outer
`kind` identifies frame, compliance, craft, architecture or reconciliation;
the common `059-15-inspected-meta-pre-admission-code` scope identifies the
subject, not a claim that every reviewer performed a full-code audit.
Frame-premise and documentation-reconciliation verdicts must retain those
limitations and must not be attributed to another discipline. Case-bound
continuity of an earlier review is not a newly performed audit, independent
rehash or reviewer shell exit. Preserve the actual reviewer completion and
supporting provenance alongside the closed receipt.

Executable evidence handles contain **only `path` and `sha256`**. Keep
verification notes outside the handle; otherwise the closed parser rejects
before reservation. A source/guard receipt is not execution authority.
Check packet shape before the fixed window; native `prepare` still performs
the final active-window validation. A packet or provenance failure means no
launch, no automatic rescheduling and no new canonical namespace.

The owner freshly confirmed the unchanged owned Meta setup and approved one
exact conditional stock window on 2026-10-21. That proposed 15:25–15:26Z case
was aborted at 15:24:52.462Z before admission because the required review
provenance was not complete in time. The original authority identity and
source pins were rechecked unchanged; the canonical slot and case output
were absent. No SDK or vendor request occurred. The coordination hold was
released on that verified handoff, not by expiry. Subsequent clarification
resolved the discipline/context misunderstanding; it does not revive that
aborted window or authorize a later one.

All fourteen local controller cases and eleven relay cohorts must be
verified on current source before considering admission. None establishes
default-browser TLS parity or vendor receipt/matching/attribution. The frame, compliance, craft and architecture code reviews passed, including
the narrow authenticated-source-cohort update. Reconciliation and genuine
operational bindings were still open at that checkpoint; the earlier baseline
and interim local passes did not substitute for native execution.

The inspected-admission frame and subsequent complete-code compliance
corrections passed. That review exposed and fixed reservation accessor/
proxy handling, incomplete producer-source comparison and missing traversal
of capture-index child originals. Every producer now binds the same full
source/test/driver/Chrome/decoder-dependency closure, and every referenced
private original is verified and snapshotted before qualification.

The pre-admission parent qualification passed all fourteen SDK-absent controller cases
and eleven relay cohorts with the corrected verifier. Reconciliation,
original-location approval and current setup/source/
coordination/window bindings were still required; no native case had then been admitted.

The subsequent craft pass exposed and then cleared a source-origin evidence
exemption and a nonfalsifiable late-publication control. Negative
source-authentication assertions now block, with a witnessed regression.
Actual fifteen-second SDK-absent windows now expire at the ordinary publication
guards: early originals remain intact, real deadline rejection prevents
completion, and a separately pinned finalization-failure sidecar records
expiry after owned resources have closed. Guard-removal mutations cause the
regressions to fail rather than returning a diagnostic-only success.

The current verifier requires the finalization sidecar's independently
post-exit digest, exact real failure category, original hashes and deadline
chronology. Resource cleanup remains strict; an intentional missed deadline
is not falsely labelled successful completion. Old diagnostic-injection and
400-test indices are historical, not substitutes for the corrected
fourteen-controller/eleven-relay qualification. Architecture review passed;
reconciliation and genuine source/permission/current-window evidence still
gate admission.

### Source-cohort preparation is a separate permission

Code architecture review passed; reconciliation and real admission remain open.
The historical source capture was located, but matching body hashes, URL labels
and HTTP 200 metadata did not supply retained authenticated-acquisition proof.
An owner-approved source-only check obtained a TLS-verified runtime whose bytes
differ from the historical pin and stopped before downloading configuration.
No old pin or actual event slot was silently replaced.

The owner subsequently approved a separate new-cohort preparation: one
network-denied SDK initialization with no PageView command, then at most one
authenticated download of the exact configuration source it requests. This
does not authorize a live collector request or a stock/chamber reservation.
SDK-absent guard receipts remain SDK-absent. The separately approved
initialization has now executed once: one init, no track/PageView command,
no browser network continuation, and a unique aborted configuration request
linked to the exact parsed new runtime. Its independent command and cleanup
were verified before one source-only authenticated configuration GET.

The new pair is separately labelled `authenticated-2026-10-21`; historical
pins and receipts remain intact. The declared-source catalog permits only
complete known pairs and rejects mixed historical/new resources. This is
source preparation, not zero SDK activity or a live stock event. At that
source-preparation checkpoint,
configuration has not executed, all four original event slots remain unspent,
and real case admission still requires refreshed source-bound reviews,
qualification and operational permissions. The actual later stock case above
supersedes that event-slot and execution status, not those historical receipts.

`createNativeStockPolicy` now compiles the two **declared** fixed profiles for
controller-side eligibility. It validates source URL/pin declarations, exact
owned selectors, direct Google USD 1/order/document relationships, per-route
query vocabularies, original encoding, unique fields, method/resource pairs
and same-case identities. Selector-free companions need the explicit scope
grant and an earlier admitted owned primary; an initialization token alone
is insufficient. Response/redirect links require a completed original
caller-attested response and exact target, never a host or source-shaped URL.

The constructor performs no source-file read, SDK execution or networking.
An eligible decision **always** has `dispatch_authorized: false` and
`source_bytes_verified: false`. It is not a replacement for canonical
reservation, source-byte validation, approved staged/final-header checks, complete
response capture or independent execution evidence.

```js
const policy = createNativeStockPolicy(privateDeclaredProfile);
const decision = policy.inspect(observedRequest);
// Do not send merely because disposition === "eligible".
// The controller must complete all remaining checks before forwarding:
// source bytes, one-shot case reservation, approved header/body checks,
// physical-attempt budgets, authenticated transport and cleanup limits.
policy.registerAdmission(decision, admittedOrdinal);
```

Admission and response registration are trusted controller evidence, not
cryptographic owner authentication or independently observed network activity.
The policy snapshots its configuration, rejects cross-policy/duplicate
admission objects, bounds response bookkeeping and scans JSON structural work
before parsing it. Its public summary contains no selectors, identities or
document values.

An unchanged retained-attempt replay classified the one basic Meta PageView
as eligible only. Against the new Google USD 1/order input it classified six
initialization routes eligible, rejected both original different-value/order
primaries, and deferred both selector-free requests without an admitted valid
new-case primary. No original request value was changed or normalized; these
aborted-attempt classifications are not live or full-native qualification.
The transport/controller work remains in progress, and `--execute` stays
unconditionally blocked.

`reserveStockSlot` now supplies private canonical **bookkeeping only** for a
prepared stock case. It reads a bounded operator-owned authority record,
checks its digest, fixed grant ID, exact ceilings and explicit at-most-60-second
window, then exclusively creates and syncs the case record under
`native-stock-slots-<authority_id>` beside that authority file. A changed output
directory, updated transcript contents or different source/input digests do not
renew a spent slot. Candidate keys reject before any authority-file read.
Arguments are snapshotted before a supplied clock callback can change them.
Unsafe permissions, symlinks, hardlinks and nonregular targets reject.

Reservation does not authenticate an owner, verify other preflight conditions
or authorize networking; all three claims remain false. At the initial
synthetic-only bookkeeping checkpoint, the actual owner
record has not been opened by this API, and no owner canonical slot was
created. Tests use only synthetic owner-shaped records in private scratch,
including four concurrent external processes with one winner. The helper does
not make `--execute` available. Its first prototype preceded these tests;
subsequent tests exposed and fixed a real mutable-input candidate-reservation
bug before any actual owner slot or SDK was touched.

`--execute google-stock` and `--execute meta-stock` unconditionally reject with
`pre_admission_blocked` (exit 3), **before filesystem, owner evidence, journal,
browser or SDK work**. Candidate and unknown keys reject with
`unsupported_case`. There is no override, reset, native manifest parser, live
switch, arbitrary URL/proxy/program interface or public fallback.

## Run the fixed first-party diagnostic

Pinned Node 24.10.0, Chrome 155.0.8059.80, macOS 27.0.1 / Darwin 27.0.0
are checked, not inferred from a requested profile. This synthetic browser is
headless; it is **not** headed/native-default qualification.

```sh
PATH=/opt/homebrew/bin:$PATH node rig/native-stock-capture.mjs \
  --qualify --output-dir /absolute/private-parent/new-probe

PATH=/opt/homebrew/bin:$PATH npx vitest run \
  rig/native-stock-policy.test.mjs rig/native-stock-egress.test.mjs \
  rig/native-stock-capture.test.mjs rig/native-stock-meta.test.mjs

AIRLOCK_NATIVE_STOCK_QUALIFICATION=1 PATH=/opt/homebrew/bin:$PATH \
  npx vitest run rig/native-stock-policy.test.mjs \
  rig/native-stock-egress.test.mjs rig/native-stock-capture.test.mjs
```

The parent directory must already be operator-owned `0700`; the output must
not exist. Symlinks at any ancestor, relative/noncanonical paths, existing
outputs and nonprivate parents reject. Use a private location outside Git.
The real-browser test retains unique `059-15-implementation-qualification-*`
directories under the supplied private evidence parent, including failed
attempts and an independent child-command witness. Unit scratch is removed.

Exit **2** means either a witnessed pre-admission blocker or an inconclusive
diagnostic, **never successful native qualification**. Check the fixed
`witnessed`, `errors`, control counts, cleanup and digests, not exit alone.
Exit **3** means input/setup/publication rejection. The older `--qualify`
diagnostic has no success exit; the count witness wrapper's zero has the
strictly diagnostic meaning described above.

## Earlier boundary diagnostics

The following describes the initial retained diagnostic, before both owner
timing decisions and the physical-count matrix. It is preserved as diagnostic
history, not the current admission contract. Later warm-tunnel header and
header-inclusive response-retention controls passed locally, but they did not
qualify a cold cross-origin native path or solve hidden physical retries.

Only generated first-party HTML and synthetic bytes run. The fixture document
is locally fulfilled at the single fixed test origin. Its receiving collectors
use actual browser TLS, separately negotiated HTTP/1.1 and HTTP/2, at the
fixed test authority on HTTPS 443. The authenticated CONNECT broker maps this
one authority **internally to a literal `127.0.0.1` TLS sink**. It has no DNS
or public upstream branch, and does not terminate TLS.

The existing loopback-confined launcher/resolver-denial policy is reused
unchanged. Each test context is fresh, service workers blocked, with a
first-party fixture CSP; no personal profile or local-network permission grant
is used. The generated certificate's exact SPKI exception applies only to this
synthetic launch. There is no system trust edit, global certificate bypass or
native launch path. Certificate/key files are generated privately, `0600`.
Proxy authentication exists only in ephemeral memory; it is never placed in
the capture, report, public output or test witness.

Each protocol has independently matched:

- Known positive / enforced denial / deliberate bypass: receiver counts 1/0/1.
- Missing/wrong credentials, wrong authority and no ticket: explicit 407/403
  broker reason categories, with an authenticated ticketed browser positive.
- Unknown path and missing ownership marker on an **already authenticated,
  reused connection**: denied target 0 / bypass target 1.
- Actual 307 redirect to that unknown target: denied target 0 / bypass target 1.
  The parent really reaches the sink; direct source correlation is not used.
- Original binary response comparison, final request headers against the
  receiving sink, cookie attachment from two real Set-Cookie fields, and
  absence of proxy authentication at the collector.

The last three controls demonstrate why tunnel authentication is **not** URL
authorization. Their synthetic exact-path controller is not a vendor policy.

## Initial diagnostic findings (historical)

### Final browser headers

The fixture first calibrates an input padding header with established cookies,
then creates a new, unmodified browser request. No native headers are rewritten.
Request-stage structured headers measured **65,528 bytes**, within the
**65,536-byte** cap. Actual ExtraInfo/final receiving-sink headers measured
**65,822 (H1)** and **65,891 (H2)** in the retained first green probe.
Both oversized requests arrived at the HTTP sink.

This is a deliberately failing **synthetic guard hypothesis**, not a passing
live guard. The receiving servers deliberately accept larger test headers so
their own parser limit/HTTP 431 cannot fake enforcement. Header accounting uses
the same sorted lowercase field-pair JSON/UTF-8 representation at all three
observation points; it is not a TLS/HPACK wire-framing claim.

The initial diagnostic implemented no opaque TLS application-record gate.
Handshake/Finished identification, TLS record fragmentation, resumption,
early data, client authentication, and per-stream ExtraInfo-to-record binding
therefore remain **unsupported**, not implicitly safe. This diagnostic stops
at the demonstrated prerequisite failure instead of supplying an unqualified
record gate, constant headroom or post-send check as live protection.

### Original decoded response, without replay

An actual gzip response has no Content-Length. **8,466 encoded bytes** expand
to **2,097,153 decoded bytes** (one over the 2 MiB ceiling).

Two independent observations are retained per protocol:

1. `Network.streamResourceContent` observes the original without replacement.
   A successful run returned 2 MiB already buffered, then a one-byte live
   delivery; the renderer's unchanged `arrayBuffer()` consumed all 2 MiB + 1.
   A retained earlier H2 attempt could not start the original stream after
   completion; that unavailable original remains explicitly unavailable.
   Stream availability is timing-dependent, not a guaranteed prerequisite.
2. Response-stage `Fetch.getResponseBody` withholds renderer continuation but
   returns the entire decoded **2 MiB + 1** original before its size can be
   checked. The controller then fails the response, never continuing it.
   Thus renderer denial works in this leg, but bounded decoded retention
   **before** observation does not.

No `takeResponseBodyAsStream`, reconstruction, replay/fulfillment, substituted
empty/expected body, header edit or cap widening is used. Original bytes are
compared to the actual synthetic sink payload. Private captures store recovered
originals losslessly gzip/base64 encoded; accounting and comparisons use their
**decoded** lengths, not storage compression. Missing original streams do not
become empty originals or passing captures.

These results distinguish physical encoded reception, decoded observation/
retention, and renderer continuation. They falsify the tested mechanisms as
the strong pre-continuation byte guard. They are **not** a proof that every
possible browser implementation or future mechanism is impossible.
Any limit observation stops new admissions in that context. The diagnostic
retains the genuine over-limit evidence and remains blocked; it never treats
the synthetic over-limit receipt as an in-envelope native case.

## Receipts, completion and resources

- `capture.json`: private synthetic raw requests/final headers, receiver
  originals, cookie/redirect observations and losslessly retained response
  originals. It contains no official SDK bytes, owned selectors or proxy auth.
- `report.json`: distinct `airlock.native-stock-pre-admission-blocker.v1`
  schema, fixed categories/counts, actual protocol results, cohort and source/
  dependency entry/lockfile digests. Every native/live/product claim is false.
- `completion.json`: exclusive, file/directory-fsynced receipt digests and
  **producer** exit 2. `command_exit_observed` is false. The test's separate
  `actual-child.json` records independently observed actual CLI exit, source
  pins and receipt digests; the producer cannot attest its future exit.

Output is exclusive `0700`/`0600`, with file, directory and output-parent
fsync. Existing receipts are never overwritten. No canonical owner slot record
is opened or created, so a changed output cannot spend or renew authority.

Guards remain through context closure. Failed close retains ownership/listeners
for cleanup; all owned observer promises, contexts, browser process, sockets,
HTTP/2 sessions, proxy and receiving servers must settle for a witnessed
result. The browser watchdog closes only owned resources at 45 seconds,
leaving cleanup/output within the absolute 60-second envelope. A failed/late
publication cannot yield a native-success receipt. Cooperative JS and
filesystem calls cannot guarantee physical preemption during an OS stall;
the independent caller bounds and observes actual command completion.

## Current implementation versus outstanding native evidence

The conditional Meta code implements the closed private manifest, original
canonical reservation, compiled policy, shared authenticated transport,
bounded original response/storage observation and cleanup/publication path.
Current SDK-absent controls and complete-code passes are recorded above.
These mechanisms are not missing implementation.

The admitted Meta stock case above did not produce a complete native PageView
reference. Its canonical slot is spent; offline correction cannot revive it.
Complete native dependent
branches, ordinary-browser TLS equivalence, Google live transport/companion
qualification, actual SDK-absent chamber replacement, performance and
downstream outcomes are not established. Neither the isolated init-only source
preparation nor the spent attempt is a complete stock reference.

**Historical diagnostic boundary:** the initial probe and retained-attempt
policy replay did not read actual owner authority or execute new official
source bytes. Their then-missing manifest/integration implementation is
superseded by the current controller code, not by retroactive qualification
of their original failed results.

The owner ceilings remain exactly 20 Google / 8 Meta requests, 64 observations,
2 KiB URL, 64 KiB request headers/body, 2 MiB response, 8 MiB aggregate and
60 seconds. Current local enforcement is qualified only for its fixed tested
surfaces/cohorts. Request bodies, trailers, informational responses and other
explicitly unsupported protocol branches still stop inconclusively. No
local path or initializer result proves headed native-default behavior,
complete vendor/chamber support, matching or attribution.

**Disposition:** keep 059-15 IN_PROGRESS with review/DoD boxes untouched.
Independent review and the coordinator own the blocker decision. Any later
actual attempt requires new explicit owner authority, not reuse of the spent
case. There is no request here to execute an official SDK, spend another case,
mutate an account, deploy, grant consent or approve a Servo component.
