# Native stock capture: pre-admission blocked

This is the **pre-admission checkpoint** of [059-15](../docs/specs/059-google-ads-full-compatibility/slice-15-native-stock-capture.md),
not a qualified native capture. A conditional executor is implemented, but
there is no admitted real case and the stock CLI remains disabled.
All owner stock/chamber slots remain unreserved and unspent.

## Current implementation checkpoint

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

### Current blocker: browser-internal HTTP retries

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
reservation, browser or SDK startup. No official SDK, public provider or
actual owner journal was used. Both owner timing decisions leave the strict
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
that source snapshot. The subsequent conditional native executor and fixed
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

All fourteen local controller cases and eleven relay cohorts must be
verified on current source before considering admission. None establishes
default-browser TLS parity or vendor receipt/matching/attribution. The frame, compliance, craft and architecture code reviews passed, including
the narrow authenticated-source-cohort update. Reconciliation and genuine
operational bindings remain open; the earlier baseline and interim local
passes cannot substitute for the unexecuted native case.

The inspected-admission frame and subsequent complete-code compliance
corrections passed. That review exposed and fixed reservation accessor/
proxy handling, incomplete producer-source comparison and missing traversal
of capture-index child originals. Every producer now binds the same full
source/test/driver/Chrome/decoder-dependency closure, and every referenced
private original is verified and snapshotted before qualification.

Current parent qualification passed all fourteen SDK-absent controller cases
and eleven relay cohorts with the corrected verifier. Reconciliation,
original-location approval and current setup/source/
coordination/window bindings are still required; no native case is admitted.

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
source preparation, not zero SDK activity or a live stock event:
configuration has not executed, all four original event slots remain unspent,
and real case admission still requires refreshed source-bound reviews,
qualification and operational permissions.

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
or authorize networking; all three claims remain false. The actual owner
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

What remains unexecuted is an admitted native Meta PageView case using both
official source resources and the real collector. Complete native dependent
branches, ordinary-browser TLS equivalence, Google live transport/companion
qualification, actual SDK-absent chamber replacement, performance and
downstream outcomes are not established. The isolated init-only source
preparation is neither that stock reference nor permission to execute it.

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
Independent review and the coordinator own the blocker decision and any later
admission. There is no request here to execute an official SDK, spend a case,
mutate an account, deploy, grant consent or approve a Servo component.
