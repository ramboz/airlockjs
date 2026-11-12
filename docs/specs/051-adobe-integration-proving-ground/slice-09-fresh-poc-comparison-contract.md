# Fresh POC comparison contract

**Status:** Accepted for source-only implementation under delegated POC
technical scope. Independent implementation review remains required.

The two retained arms have different native wire bytes. Some differences are
at known timing, identity and request-tracing fields. Others involve opaque
state. This contract proposes a closed, per-arm comparison for a future POC
pair. It keeps original bytes and fails closed where the evidence does not
establish a field's role.

The coordinator selected this direction under delegated POC autonomy after the
owner was unavailable. This is not an individual owner approval, an accepted
decision record, or a release-wide compatibility rule. It authorizes no SDK
execution, job, publication, or other effect. The reviewed causal
boundary-witness proposal is also accepted for source-only implementation.

## Current evidence and scope

The [supervised operator contract](slice-09-supervised-operator-contract.md)
requires comparison of semantics and each arm's original proposition identity.
The [fresh source contract](slice-09-fresh-pair-source-contract.md) requires
comparison of original wire data, results, proposition identity, and rendering
without hiding page URL or proposition differences. The current fresh checker
requires exact request-body bytes and, except for its existing native collect
transport case, exact response status and body bytes
(`probes/adobe-compatibility/fresh-pair-wire.mjs:217-229`).

The [offline contract](slice-09-official-sdk-offline-contract.md#comparison-and-normalization)
describes candidate request-ID, timestamp, identity, and queue-duration
rules for a different checkpoint. It does not grant these rules to a fresh
live pair. Its queue-duration section records the pinned Alloy 2.31.1
calculation; its witness records that the pinned SDK writes `state:store`
response payloads to its cookie jar. These observations do not establish the
meaning of every state key.

This proposal covers the fixed positive stock/chamber POC pair only. It does
not modify historical readers, retained captures, default SDK behavior,
tenant or endpoint fences, consent, rendering, notification, STOP, request
caps, or the causal serialization gate.

## Version and evidence binding

A source implementation must use exact fresh job schema version 3. It must explicitly select
`fresh-poc-semantic-comparison-v1` and the separately reviewed causal
boundary-evidence version in its closed schema. The start loader checks both
before consumption and binds the immutable job digest to the evidence.
Version 2 and older jobs retain their existing rules. A version 2 capture,
missing sidecar, unversioned record, or cross-version combination cannot
qualify under this contract.

Each arm supplies its original private request and response bytes, existing
recorder records, admissions, body witnesses, original SDK results and host
facts, plus the required new boundary evidence. Each request joins by arm,
ordinal, request UUID, URL and body hashes, method, content type and body byte
count. The body witness and response must belong to that same request. The
five requests and their ordering are fixed. Missing, duplicate, foreign,
extra, unjoined, or partially completed evidence blocks the pair.

The new boundary evidence must independently establish serialized egress. Its
schema and acceptance are outside this document and are not assumed here.
Attempt 6 has no such evidence and its original chamber DOM differs from the
new renderer candidate. It remains UNKNOWN and cannot qualify under this
contract.

## Closed comparison

Parse original bounded UTF-8 JSON with the existing duplicate-key-rejecting
`parseJson` facility in `probes/adobe-compatibility/contract.mjs`. Retain and
bind the original bytes and hashes. Compare object key sets, array lengths and
order, value types and every leaf. Object member order and insignificant JSON
whitespace are not behavioral differences. Unclassified numbers must be safe
integers with equal JavaScript numeric values and types, using `Object.is` so
negative zero remains distinct. Their JSON number spellings need not match.
Noninteger or unsafe numeric leaves block comparison. All other unclassified
leaves must match exactly. A difference is permitted only at an exact path and
under all of the conditions below. Do not remove fields, replace values,
rewrite bodies, or pass normalized data to the SDK or server.

Cross-arm URL origins, tenant/datastream, path, method, content type and
response status remain governed by the existing fixed transport rules. The
request URL `requestId` is a UUID unique within its arm and joined to that
arm's original admission and body witness. It is not required to equal the
other arm's UUID. All other query parameters remain exact.

### Event timestamp

For each corresponding event request, the only eligible location is
`/events/0/xdm/timestamp`. Both fields must be present as canonical UTC
ISO-8601 strings with millisecond precision. Each must fall within that arm's
recording and job window and no later than its authentic paused-request
observation. Event timestamps must be nondecreasing in the fixed event order.
The event array must contain exactly one event. The consent request has no
event timestamp exception. Missing, asymmetric, malformed, out-of-window or
out-of-order values block comparison.

### Queue duration

For each corresponding event request, the only eligible location is
`/meta/queueTimeMillis`. Both values must be finite integers in `0..300000`.
Each must fit within the elapsed wall-clock interval from its arm's recording
start to that request's authentic paused-request observation. The relevant
clock observations must be valid and nonregressing. Consent has no
queue-duration exception. Missing, asymmetric, fractional, negative,
out-of-range or unbounded values block comparison. This rule compares the
observed duration's role, not performance or its literal value.

### Identity

An eligible response identity appears only at the `id` member of a payload
entry under a matching `identity:result` handle. Corresponding handles and
payload entries must have the same order, count, field set, types and
namespace. The namespace must be the fixed ECID namespace. IDs must be
nonempty bounded strings, stable for that namespace within the same arm, and
retained in the original response. A different ID in the other isolated arm
is eligible only after those checks.

If `/events/0/xdm/identityMap/ECID/<index>/id` appears, it must appear in both
arms with the same container shape and count. Each nonempty ID must join to
that arm's previously observed ECID identity. Other identity-map fields,
namespaces, presence and ordering remain exact. A missing, changed or
ambiguous within-arm identity blocks comparison.

### Opaque state

The only candidate request locations are
`/meta/state/entries/<index>/key` and `/meta/state/entries/<index>/value`.
The only candidate response locations are `key` and `value` in matching
`state:store` handle payload entries. A state difference cannot pass merely
because it is under one of these paths.

For a candidate **response creation or update**, each arm must first establish
that the entry is in its own original, successfully completed and validated
`state:store` response. That response body joins to its original request and
boundary evidence. Both entries must have the same established role, response
ordinal, handle and payload position, and exact non-key/value metadata.
The role, permitted creation or update, origin, domain, path, secure scope and
expiry interpretation must be grounded in pinned SDK or public protocol
evidence and a reviewed, bounded producer observation where needed. An
unknown role or unproved scope blocks the response difference. A creating
response is not required to match an earlier response, and it cannot serve
as its own earlier source.

For a candidate **request echo**, each arm must prove an exact key/value
match to the latest earlier eligible response entry in that same arm. The
proof identifies the source response ordinal, handle and payload position.
Both arms must have the same established source role and positions. There
must be no duplicate or ambiguous source, intervening superseding or deleting
write, expired entry, or unproven origin, domain, path or secure scope.
Neither scope nor expiry can be inferred from a key's name or a successful
function return.

The present evidence shows exact per-arm key/value matches to prior responses.
It does not establish every state key's role, the latest still-valid update, or
cookie-scope interpretation. The existing chamber writeback path passes
granted writes through `reconcileForBrokerJar`, which strips domain, Secure
and SameSite before `document.cookie`; raw SDK intent and domain-probe success
do not establish the resulting browser cookie attributes or stock equivalence.
In the retained event requests, both arms have
three distinct keys and the same key set. Their order differs in three
requests; this is a key permutation, not proof of established role
equivalence. Array order remains exact. A future permutation rule needs
separate public grounding, role uniqueness and duplicate-policy review.
Unmatched state entries, changed order, new fields, asymmetric structures and
unknown roles block comparison.

### Response request ID

The earlier literal-equality check found that the response field differs from
the URL UUID. Its relationship was then unknown. The verified public
[Adobe Edge API reference](https://api.github.com/repos/AdobeDocs/data-collection-apis/git/blobs/a4e4b5761289e71d1f7444fbaab2377dded47db1)
documents an external tracing ID with a 16-hex entropy suffix at its request
parameter and `InteractResponse` definitions. The retained public artifact is
Git blob `a4e4b5761289e71d1f7444fbaab2377dded47db1`, SHA-256
`1a8e1c3dfb781bad2f43fbf51c197a080af0608c407d67ba2a0b28033d11fa36`.
All six retained 200 responses (three per arm) independently passed boolean
checks for their own original request UUID prefix and exact 16-hex suffix.
Their values remain private.

For each fixed successful 200 JSON response, top-level `/requestId` must be a
string consisting of that same arm's original URL request UUID, `-`, and
exactly 16 ASCII hexadecimal characters. Verify it against the request already
joined to that arm's admission, body witness and recorder response. The
valid full strings may differ across arms. Preserve both original strings,
bodies and hashes. Missing, asymmetric, malformed, wrong-prefix, foreign-arm,
truncated, extra-suffix and bare-UUID values block. A 204 response has an
exactly empty body and no JSON exception. This field is for tracing and
correlation; the rule does not claim that logging is absent or broaden any
handle, payload, routing or decision exception.

## Invariants and tests

Business data, page and custom events, event options, consent, destination,
tenant, scope, activity, experience, offer content and hash remain exact.
Within each arm, the fetch response must join the original SDK proposition,
and DISPLAY and INTERACT must each reference that arm's original proposition
ID, scope and scopeDetails. Native consent, response validation, rendered
content, trusted interaction, notification order and strict DOM parity
remain required. Comparison is not a substitute for any of these gates.

Before any implementation review, invented paired fixtures must cover:

- Valid independently generated timestamps, queue durations and ECIDs, plus
  missing, asymmetric, malformed, out-of-window, out-of-order, changed
  namespace and broken within-arm identity continuity.
- First response state creation and later updates, followed by request echoes
  joined to the latest eligible earlier same-arm response. Cover duplicate,
  foreign-arm, self-sourced, later, superseded, expired, wrong-scope,
  reordered, unmatched and unknown-role refusals. An identical state key
  alone is not a value or provenance match.
- Per-arm response request-ID prefix and suffix validation, including missing,
  foreign-arm, truncated, malformed, extra-suffix and bare-UUID refusals.
  A forged URL-ID join must fail; the 204 body remains empty.
- One changed business, consent, tenant, routing, offer, proposition or native
  notification field at a time; each must block even when all candidate
  dynamic fields satisfy their own checks.
- Duplicate JSON keys, safe-integer numeric equality and spelling, unsafe and
  noninteger numbers, unequal structures, extra fields, array reordering,
  cross-job evidence, absent causal sidecars and legacy-version promotion.
  Original bytes and hashes must remain unchanged in every case.

## POC state proof amendment

The coordinator selected a POC-only host cookie policy under delegated
technical autonomy. This selection is not an individual owner field approval
or a release compatibility decision. The new source and this amendment need
independent review before any publication or live use.

The chamber may accept a cookie input only after the existing Core name grant
has approved it. For the configured organization's identity, consent and
cluster names, the POC policy writes a host-only cookie on the owned HTTPS
page with `Path=/`, `Secure` and `SameSite=Lax`. It preserves the approved
value and supported expiry or deletion semantics. Unknown names, duplicate
or unsupported attributes, unexpected paths and observable setter refusals
are sticky faults. The host must stop further SDK actions and egress after a
fault. The existing cookie probe and all legacy profiles keep their original
behavior. Core, SDK bytes and grants do not change.

This is a declared chamber governance difference, not recovery of the SDK's
original cookie attributes or proof of stock-equivalent persistence. Stock
keeps its native SDK policy. Readback can detect some failed writes, but it
cannot distinguish an idempotent write from a silent refusal when an
identical value was already present. The proof checks the stored postcondition
and lineage; it does not claim a browser setter acknowledgement.

Select this amendment only from a new exact version 3 job whose validated
digest binds `fresh-poc-semantic-comparison-v2`, cookie policy
`fresh-poc-host-cookie-v1`, state evidence version 1 and boundary evidence
version 1. Carry the exact policy and proof version through the capsule and
private capture. The existing version 3 comparison-v1 job and all earlier
versions retain their rules. A capture without the new evidence cannot be
promoted.

For each fixed original request, take the evidence while that request is held
in the serialized gate, after the previous completed response and before the
next reservation and release. Bind the evidence to the job digest, pair, arm,
ordinal, original request UUID, URL hash and body hash. Keep the authentic
early pause separately. These snapshots describe stored state while held, not
state at request construction.

After the fifth original response is finished and its body validated, and
the fifth SDK operation and page journey have completed, take one distinct
final stored-state observation before capture and closure. Bind it to the
same job, pair and arm and to the fifth request identity, URL and body
hashes, response status and response-body hash. This is not a sixth request,
admission or SDK command. Its inputs and stored cookies must join the latest
own response, including any update in response five. Missing or late final
evidence blocks the pair.

The owned page's raw CDP `Network.getCookies` lookup uses exactly three local
reads: `https://<owned-host>/`, `https://state-proof.<owned-host>/`, then the
same primary URL. The descendant URL is derived in code, not supplied by a
caller. No DNS lookup, navigation or network request to that URL is allowed.
The first request requires an empty jar. At later requests the primary reads
must each contain exactly the three unique configured-org state keys and
agree on their complete raw metadata and values. The chamber descendant read
must contain none of those cookies. Stock's descendant result is recorded
without imposing the chamber policy. Missing metadata, duplicate or foreign
cookies, expired entries, changes between the primary reads, unsupported
fields, a missing chamber `sameSite`, or a scope mismatch block the proof.
Each read remains under the existing owner, STOP and deadline guards.
The approved-input trace is read immediately before and after the three CDP
reads and must be unchanged. Its prior prefix must remain intact across
requests. Stock's passive setter observer retains its own original inputs;
it does not apply the chamber policy.

For a version 2 state refusal, retain the first fixed failure stage and its
allowlisted diagnostic code alongside `state_refused` in the existing private
gate evidence. Preserve bounded
original input results, raw read results and owner stamps as they arrive,
including an unfinished bracket. Each captured value is limited to 131072
bytes; an oversized or non-JSON value has an explicit status instead. These
partial observations are diagnostics, not a valid state-proof record. Do not
include their values or exception text in safe output. Earlier modes keep
their existing evidence shape. This does not identify a historical refusal
whose original inputs were not retained.

At the version 2 reservation boundary, the optional private diagnostic
`state_failure.reservation:{step,reason}` distinguishes `normal-page`,
`reservation-callback`, `arm-guard` and `owner-admission`. Reasons come from
a closed source/STOP/deadline/custody/admission or filesystem category set;
unknown exceptions are `unclassified`. No message, stack, cause or exception
object is retained in that field. Existing refusal codes, admission accounting
and proof schemas are unchanged. This improves future diagnostics only; it
does not identify the inner cause of an already sealed refusal.

The budget is five held triples plus one final triple: 18 raw local cookie
reads per arm. Every start and completion stamp for those reads, the held and
final observation stamps, page-completion observation and boundary events
share the owner's monotonic and wall-clock chronology. Reject any wall-clock
regression in the combined chronology and any equal monotonic stamps with
different wall times. Page or worker trace counters are separate clock
domains; cookie expiry is state data, not an owner event or setter ACK.
Neither the final triple nor its waits extend an existing deadline or reset
an allocation.

Raw CDP field presence matters. The installed Playwright cookie API fills a
missing SameSite with `Lax` and does its own domain filtering; neither can
prove the chamber policy. A separate local fixture confirmed the raw CDP
primary/descendant distinction and the difference between absent SameSite
and explicit Lax using invented cookies. A second offline fixture completed
the same three lookups while a locally fulfilled invented POST was paused.
Neither fixture establishes actual SDK state, a live wire response or native
lifetime qualification.

For response state creation and update, retain each arm's original completed,
validated response and require the established role and exact non-value
metadata. For each later request, every state value must match the latest
still-valid earlier response for that unique key in the same arm. Join the
response, approved chamber input and actual stored cookie evidence without
reconstructing attributes or changing raw bytes. Stock evidence must retain
its own native scope and provenance. Missing or ambiguous source, input,
scope, expiry, supersession or arm binding blocks the pair.

For the representation join, Alloy 2.31.1 pins `js-cookie` 3.0.5. Its
verified module SHA-256 is
`545c6839c0e4b425f658bfa614cfac12f83cd89067bdd4a82066c41871e86012`;
the same default write rule is present in the pinned served SDK at byte 2335.
Apply only that exact forward rule to a bounded original response value:
`encodeURIComponent(value).replace(/%(2[346BF]|3[AC-F]|40|5[BDE]|60|7[BCD])/g, decodeURIComponent)`.
The result must match the untouched setter value and stored CDP value. Invalid
Unicode, overflow or a non-string value blocks. This establishes a
representation link, not actual persistence or scope. Do not decode,
rewrite the original wire bodies or use a general value normalizer.

For an original integer `maxAge` M in seconds and canonical setter expiry E
in milliseconds, the pinned formatter implies the SDK date-provider time was
in `[E - M*1000, E - M*1000 + 1000)`. This is a derived consistency bucket,
not a measured setter time. The bucket must intersect the interval from that
same response request's actual release invocation to the relevant held or
final observation. It must not use response completion as the setter's lower bound.
The setter expiry must equal the raw CDP expiry, remain valid at observation,
and belong to the latest own response. Reject unsafe arithmetic, reversed
clocks, impossible intervals, wrong TTL, expiry, deletion or supersession.
The inference assumes the SDK date provider and the owner observations use
the same wall-clock basis; any evidence of clock regression or an unsupported
clock basis blocks qualification.

In the pinned 152,336-byte Alloy 2.31.1 SDK (SHA-256
`7dd09409bb07d47b1b2289eec4ca15d67084a85a3d832bef6c73180889da32e8`),
the CookieTransfer dependency binding at byte 46313 supplies
`dateProvider:()=>new Date`. This is a static byte observation, not SDK
execution or clock attestation. It grounds native `Date` for that path only;
it does not establish a shared clock basis or behavior for other providers.

Only `/meta/state/entries` may compare as a unique map of the exact three
grounded roles after this proof succeeds. This does not mutate the original
array. Duplicate or extra keys and any unproved role fail. Response handle and
payload order, every other array and all business, routing, consent,
proposition and notification fields retain their existing exact rules.
Attempt 6 still lacks this evidence and remains UNKNOWN.

Passing these source tests would establish only the stated supplied-record
checks. It would not establish a live pair, native execution, downstream
product receipt, or completion of slice 051-09.

The source candidate changes the POC page, worker-facing cookie sink and
local gate/observer code. The v2 loader uses a separate code-owned cohort for
POC commit `7e9daf235fba423ec50e8693610d5a0f860d7776` and its observed
page and worker bytes. The earlier native cohort remains unchanged. The loader
still requires the exact source, assets and served inventories. This binding
does not authorize an actual job, SDK execution or entry.

## Fresh-configure deletion amendment

**Status: accepted for source-only implementation under delegated POC scope;
independent implementation review remains required. No execution is authorized.**
The pinned Consent component clears stored consent when identity is absent.
The coordinator's offline public-component witness exercised that branch and
`js-cookie` 3.0.5 with invented inputs. The pinned SDK byte anchors at 66815
and 65809 bind the missing-identity branch and remove delegation to the
152,336-byte SDK identified above. This is a conditional source finding. It
does not identify attempt 7's missing inputs or its refusal cause.

The selection is exact job schema 3, transport
`poc-native-collect-v1`, boundary evidence 1, comparison
`fresh-poc-semantic-comparison-v3`, cookie policy
`fresh-poc-host-cookie-v1`, and state evidence 2. State evidence 2 is a new,
closed version of the existing record and final shapes, bound to the same job
digest, pair and arm; its schema version is 2. No combination may select it
by structural resemblance or a caller's readiness claim. Earlier
jobs, evidence versions, comparison rules and cohort pins remain unchanged.
In particular, v2 must still reject the deletion trace.

For each arm, retain the first approved-input entry unchanged and require it
to be exactly one configured-org consent removal. The name is
`kndctr_<org-with-@-replaced-by-_>_consent`, subject to the pinned
`js-cookie` name encoding; reject an org whose encoded name cannot be joined
exactly to the existing configured-org policy. The value is empty. The pinned
`js-cookie` default instance uses `path=/`, and its `remove` sets
`expires=-1`: it formats `Date.now() - 86400000` as a canonical UTC string at
whole-second precision. The public Alloy 2.31.1 package's
`components/Consent/createStoredConsent.js` passes only the consent name to
the default jar's `remove`; `components/Consent/index.js` and
`utils/cookieJar.js` bind that jar to `js-cookie`. The pinned SDK's remove
implementation and default-jar binding are at bytes 1893 and 2397. Thus the
unmodified native setter string is
`<encoded-name>=; path=/; expires=<canonical-UTC>`. Reject other names, a
nonempty value, `Domain`, `Secure`, `SameSite`, `Max-Age`, duplicate or
unrecognized attributes, or extra deletions.

The public package archive used for the source checks has SHA-256
`0b2dfbf7ea1a47f453a929a7d54648da76984bcc369b2d2df23b1ca7efc29b67`.
If E is the parsed deletion expiry in milliseconds, the source-derived
formatter bucket for the originating realm's `Date.now()` is
`[E + 86400000, E + 86401000)`. The observable predicate requires a canonical
UTC E strictly earlier than the first held owner wall observation. This
state-data check inherits the existing v2 wall-basis assumption; unsupported
or contradictory clock evidence blocks qualification. Parse E as a finite
safe millisecond value and require an exact `toUTCString()` round trip. Bind
the comparison to the first held observation in that arm, including when
revalidating later and final records. It does not impose the derived bucket
as an observed timestamp or prove that this precise one-day calculation
occurred. Page, worker and owner clocks remain distinct. Do not sort their
monotonic values together, invent timestamps, or infer a native ACK from
cookie expiry.

At the first held request require one deletion input, identical before and
after the three raw reads, and the existing empty primary/descendant/primary
snapshot. The first request's state entries field must be absent. Require
the same deletion as the unchanged first entry in every later and final
trace. Each following input must join exactly once, in order, to an eligible earlier
response state update and its existing stored-cookie and request proof.
The removal is not a response update and is not removed or rewritten from the
original trace. The existing 15-input cap includes it. Missing, duplicate,
wrong-name, malformed, changed, late or faulted removals and any unjoined
write fail closed. No extra reads, SDK calls, request slots or deadline are
added.

For stock, the approved trace is the original input seen by the installed
document-cookie observer. For chamber, it is the unchanged input received by
the existing policy sink after the Core broker's existing reconciliation;
that input is not proof of the worker's pre-reconciliation bytes. The sink's
existing governance and Core behavior do not change. Both arms still need
their own exact lineage and the original response, request, rendering and
notification checks.

### Limits and implementation surfaces

The approved-input and held-state checks establish a bounded postcondition.
They do not identify which setter caused the observed absence, when an
individual setter executed, whether the jar was empty before configure, or
the worker's original attributes before Core reconciliation. Stock installs
its observer before `initMartech`; chamber awaits `configure` before
`setConsent`. These source orderings and the public witness support the
candidate shape, but do not attribute a particular observed input to the SDK.
No new setter-attribution, pre-configure jar or timestamp proof is required.
Missing evidence for those stronger claims remains a limitation.

The prospective source delta would need closed v3 selection and a separately
unbound code-owned served cohort in `fresh-pair-execution-job.mjs` and
`fresh-pair-native-cohort.mjs`; the existing storage selector must use that
same exact selection. Wire the selected version through
`fresh-pair-execution-arm.mjs`, `fresh-pair-execution.mjs`,
`supervised-journey-page.mjs`, and the existing gate and state-evidence
validators in `stock-baseline-browser.mjs`, `fresh-pair-wire.mjs` and
`fresh-poc-cookie-lineage.mjs`. Reuse the existing observer and sink traces.
Do not add a side channel, reset or filter a trace, change Core, or add reads.
A changed page or worker build needs
a new reviewed source and actual served-cohort binding before any future job.
Existing `7e9daf...` and older pins cannot be relabelled.

Before implementation, independently review the exact deletion grammar,
expiry predicate and its clock limits, both-arm mediation, version selectors
and source binding. Synthetic red-to-green tests must
cover both arms, every refusal above, unchanged v2 behavior, cross-version
and unbound-cohort rejection, partial/faulted evidence, and unchanged
response-to-setter-to-stored-state-to-request lineage. This proposal grants
no publication, live admission, allocation, SDK execution or retry.

## Proposed configured POC baseline

**Status: independently frame-reviewed and authorized for source-only
implementation under delegated POC scope. Implementation review remains
required; no execution is authorized.** The coordinator selected this
POC-only route under delegated execution authority. The owner's generic
instruction to work autonomously was not an individual option selection or
approval to widen the cookie boundary.

The pinned SDK includes BrandConcierge in its default component list. During
configure, its component factory removes the configured-org `bc_session_id`
cookie when `conversation.stickyConversationSession` is false. The earlier
fixed configure inputs omitted `conversation`, so the SDK validator defaulted
the option to false. The logging wrapper preserves the jar's bound `remove`;
the pinned remove implementation writes a deletion without checking whether
the cookie exists. If configure reaches that factory, the current three-role
observer and sink cannot accept that removal. The reviewed consent-only
amendment above is therefore insufficient for that default configuration.
An earlier configure failure can prevent the factory from being reached.
These observations do not identify attempt 7's cause.

The untouched public component and logging wrapper were exercised with an
invented org and an absent-cookie stub jar. False produced one removal with
the configured-org name and apex-domain argument; true produced none. The
controlled test did not run the whole SDK or prove a browser setter outcome.
The native SDK is bound to the public finding by its component map, configure
factory loop, validator, removal and jar byte anchors. The retained stock
integration merges its defaults with the caller's web SDK config and forwards
that result to configure. The earlier fixed stock and chamber inputs both
omitted `conversation`.

### Exact proposed selection and wiring

Keep the deletion amendment's schema 3 / native transport / boundary 1 /
comparison v3 / cookie policy 1 / state evidence 2 selection. Add a required,
exact top-level job field `sdk_config_profile` with the sole value
`poc-sticky-conversation-v1` for that combination. The field is absent from
all earlier job combinations. Reject a missing, different, extra or mixed
field before effects, including in start and stop validation. The v3 served
cohort stays explicitly unbound. Structural validity, an injected marker,
or a caller result cannot bind it or select another cohort.

For v3 only, carry the validated profile and existing job digest through
`fresh-pair-execution-arm.mjs` into the page capsule. The capsule must reject
missing, unexpected or mismatched profile/version combinations before
starting either arm. No profile value may be read from the public runtime
config, URL or an SDK result. Keep the public config's closed shape and
existing hash unchanged.

In the stock arm, the supervised page's existing integration wrapper adds
exactly `conversation: { stickyConversationSession: true }` to the first
argument of `initMartech` for this profile, before calling the original
integration function. The original integration then forwards its merged web
SDK config to the unmodified SDK configure call. Reject a pre-existing
`conversation` field rather than overriding or merging it. No change to the
standalone stock entry or integration bytes is needed.

In the chamber arm, pass the same exact profile through the bounded
`journeyConfig` and existing host-to-worker initialization. Permit it only
with the native POC transport and its measured context and cookie-probe
inputs. The worker adds exactly the same conversation object to its fixed
`alloy("configure", ...)` options before that call. Missing or invalid
profiles do not acquire a default. Earlier journey configurations omit the
field and keep their original SDK options.

Bind the exact profile to the job digest and the independently checked pair
comparison selection. A mixed profile, absent profile, modified capsule,
wrong arm or mismatched evidence must refuse rather than fall back. Reuse
the existing source-pin, inventory and loader checks. A future cohort must
bind the new page and worker bytes and its exact served source commit after
separate review and actual serving evidence. Do not invent pins, reuse old
cohort pins or modify the unchanged standalone stock asset pin.

### Evidence, limits and review

The configured baseline suppresses an unused BrandConcierge cleanup; it is
not the SDK's default configuration and does not establish BrandConcierge or
full-SDK compatibility. It does not change the three-role policy, grants,
Core, SDK or integration bytes. No unapproved write is filtered or hidden,
and the consent deletion prefix and all subsequent state lineage rules stay
unchanged. No observer reads, SDK calls, requests, cases or budgets are added.

Independent review must examine the actual stock forwarding and chamber
worker paths, profile/version coupling, source and served-byte binding,
old-mode preservation and the absence of fallback. Before any code change,
review this proposal. If either unchanged integration or SDK path cannot
accept the option, or the option prevents a required Analytics or Target
behavior, stop and report the evidence. Do not change protected boot or Core
as a workaround. A source-only stub or static check cannot establish product
behavior; the existing actual Analytics and Target proof remains open.

After review and separate authorization, deterministic source-only tests
must exercise both exact configure argument objects and the original
integration forwarding path with invented inputs; reject missing, false,
wrong, extra, mixed-version and tampered profile values; verify no fallback
or unbound-cohort admission; and preserve prior-mode argument objects and
refusals. They must retain the existing state, diagnostics and resource
regressions. Any later browser, SDK, live admission, publication or retry
requires its own authority. This section does not complete 051-09.
