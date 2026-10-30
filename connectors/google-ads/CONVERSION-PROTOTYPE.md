# Offline Google conversion prototype — experimental, not native-compatible

This source-only example sends synthetic conversion data through an actual
first-party Node worker and an independently observed loopback HTTP receiver.
It constructs one small conversion request, not Google's complete protocol.
No vendor SDK, Docker, browser, download, account or production request is used.
Production Google/Meta boots and the package/build are unchanged.

Command capture inspects parameter records synchronously on the main thread.
It enumerates own keys before rejecting an oversized record, and JavaScript
proxy traps can run during inspection even though ordinary getters are
rejected. The accepted field limits therefore do not bound worst-case
main-thread work or establish isolation from untrusted input. Use controlled
synthetic inputs; Core Web Vitals qualification remains open.

```sh
node rig/google-ads-conversion-prototype.mjs
# This checkout's installed local executable:
/opt/homebrew/Cellar/node/24.10.0/bin/node rig/google-ads-conversion-prototype.mjs
```

No arguments or environment credentials are needed. The example opens a
random port on **127.0.0.1 only**, runs pending/denied/no-replay controls, then
observes two conversions with different values, currencies, transactions and
page context. It closes its worker, server and sockets before returning.
Errors fail the executable; cleanup attempts every resource independently,
retaining sanitized aggregate failures and the original cause.

### Retained same-input attempt comparison

On 2026-10-29, an offline comparison used the explicitly supplied 058-04
Google reference and its original pins and completion attestation. The strict
native-attempt reader passed before and after the run. Baseline, value1 and
value2 each supplied their retained conversion input and document URL to a
separate first-party Node worker and independent literal-loopback receiver.
Each local receiver observed exactly one GET; each host reported one dispatch
and a local 204 settlement. All three workers, receivers and sockets closed.
Raw values and URLs were passed through local process memory and loopback only;
they were not printed or written to files. The executed command was ephemeral;
its private script and sanitized result were reconstructed after the run. The
original result is a transcription, not an independently witnessed completion
record. A later execution of that reconstructed script reproduced the same
counts and controls on this branch, with exit zero and no reported diagnostics.

Each case's two retained primary attempts were aborted before transmission.
For all six attempts, the local receiver matched the original destination-ID
relationship and the exact `label`, `value`, `currency_code`, `oid` and `url`
relationships: 30 field comparisons. In-memory mutations of each field and
the local route were rejected by their corresponding comparison controls.
The 24 retained auxiliary attempts were counted but not compared or reproduced.
The local run injected a direct Node HTTP transport to the receiver; it did
not exercise the default fetch implementation.

This is a **selected field-relationship comparison**, not identical wire or
journey evidence. The native attempts used vendor endpoints and a native-default
consent context; the local endpoint was loopback and the host seal was
explicitly granted. Their consent equivalence is unverified. The local
comparison did not issue the `js` command; the separate opt-in marker below
does not implement native SDK initialization. The prototype does not reproduce
native config traffic or auxiliaries. The decoded field checks do not compare
request encoding, headers, method, sequence or complete payloads. The native
attempts had no vendor response or receipt; local 204 responses are not vendor
success. Scope, multi-destination and native Consent Mode behavior, full
compatibility and production readiness remain unproved.

The reusable offline tool runs the same limited comparison against an explicitly
supplied Google native-attempt reference:

```sh
node rig/google-ads-attempt-comparison.mjs --inputs /absolute/private/inputs.json
```

The mode-0600 input file, in an owned mode-0700 directory, contains exactly:

```json
{
  "schema": "airlock.google-ads-prototype-attempt-comparison.v1",
  "reference": {
    "report": { "path": "/absolute/private/report.json", "sha256": "<original digest>" },
    "capture": { "path": "/absolute/private/capture.json", "sha256": "<original digest>" },
    "completion": { "path": "/absolute/private/completion.json", "sha256": "<original digest>" }
  },
  "expected_pins": {
    "profile": "google-ads-conversion",
    "node_version": "<original version>",
    "browser_version": "<original version>",
    "os_release": "<original release>",
    "macos_version": "<original version>",
    "runtime_sha256": "<original digest>",
    "configuration_sha256": null,
    "network_policy_sha256": "<original digest>"
  }
}
```

Supply the original canonical handles, byte digests and pins explicitly; no
reference discovery, input rewriting or output files are provided. The strict
reader validates the original reference and completion before and after the
local cases. The original manifest and reference identities are rechecked.
The tool emits fixed counts, status and false claims only, never input values,
URLs, paths or error text. Values cross only the local worker and literal
loopback HTTP receiver. The transport uses direct Node HTTP without a proxy.
The tool closes resources even on a failed case and reports cleanup failures.

Exit 0 means the selected local relationships matched; its overall result
is still `inconclusive`, not native qualification. Exit 1 reports a selected
relationship difference, exit 2 an incomplete reference or local run, and
exit 3 invalid input. Even a match leaves the consent, endpoint, auxiliary,
transport, response and compatibility limitations above unchanged. The owner
must separately authorize each use of private reference inputs; this command
does not authorize browser, vendor or live activity.

The reusable tool was also run against the retained 058-04 reference described
above: all three cases completed, with 30 selected field comparisons matching.
It returned `inconclusive` and did not qualify the untested behavior.

## Experimental standalone seam

`createGoogleAdsPrototype` in `adapters/google-ads-prototype.js` returns
`{ gtag, flush, getState, setConsent, dispose }`; it never installs `window.gtag`.
The fixed Node bridge is in `rig/google-ads-conversion-prototype-node.worker.mjs`.
The browser Worker factory is source plumbing only: no browser qualification
is claimed by the Node tests.

An explicit literal endpoint is mandatory:
`http://127.0.0.1:<port>/pagead/conversion/0000000000/`.
There is **no default vendor destination** or arbitrary worker-code option.
The host reuses unchanged `createWrappedSdkHost` with endpoint ceiling and
strict `ad_storage`, plus a literal-base GET-only driver: no request headers
or body, credentials omitted, redirects rejected. Receiver response bodies
are size-bounded data, never scripts, callbacks, follow-up URLs or cookies.

Supported queued calls:

```js
gtag("config", "AW-0000000000"); // retains synthetic config; deliberately sends NOTHING
gtag("event", "conversion", {
  send_to: "AW-0000000000/SYNTHETIC_LABEL",
  value: 28.75,
  currency: "CAD",
  transaction_id: "offline-example-only",
});
```

The third argument is a plain/null-prototype own-property record with at most these four
primitive data properties, plus the optional callback pair described below.
`send_to` must match exactly. Optional `value` is a
finite Number, `currency` a string up to 64 characters, and `transaction_id`
a string up to 128 characters. No numeric coercion or defaults: zero and
empty currency/transaction strings survive; omitted and explicit `undefined`
optional fields are omitted. An empty-string value is unsupported.
Captured context has only `pageURL` and `referrer` (absolute HTTP(S), no
URL credentials; empty referrer allowed), at most 2048 characters each.
Currency, transaction and URL strings must be well-formed Unicode; invalid
UTF-16 is rejected rather than silently replaced by URL encoding. The worker
rejects a complete encoded GET over8192 characters before requesting transport,
without making the instance terminal or losing the next valid conversion.
Use synthetic, non-PII page and transaction data only.

### Experimental purchase classification

The [Google Ads new-customer guidance](https://support.google.com/google-ads/answer/12077475?hl=en)
shows a `gtag("event", "purchase", ...)` call containing `send_to` and
`new_customer`, and discusses true, false and unspecified classifications.
It limits acquisition reporting to Purchase conversions. Its printed example
uses placeholders and contains an apparent stray bracket; it is not an
executable fixture or evidence for an exact request encoding.

With `experimentalPurchase: true`, the standalone adapter and worker accept
the following bounded, synthetic input:

```js
gtag("event", "purchase", {
  send_to: "AW-0000000000/SYNTHETIC_LABEL",
  value: 12.5,
  currency: "USD",
  new_customer: true,
});
```

The supplied classification must be a boolean or omitted; an explicit
`undefined` is treated as omission. The experiment does not infer a value from
cookies or identity. `new_customer` is an event-only field: it is not accepted
on `conversion`, in scopes or on config. All other keys, routing, context,
scope and consent rules remain those of the existing local prototype. The
callback opt-in remains conversion-only. The existing dataLayer and
multi-destination opt-ins can carry this bounded command; host consent is
still checked independently for every branch, and held events do not replay.

For the literal-loopback receiver only, the worker adds the **hypothetical**
fields `airlock_event=purchase` and, when provided,
`airlock_new_customer=true` or `airlock_new_customer=false`. These distinguish
local purchase/unknown/true/false cases; they are not Google wire fields or a
proposed production protocol. Google documentation's inconsistent `vndc` /
`vdnc` troubleshooting text does not establish a native wire mapping.
The existing conversion relationship report does not evaluate purchase input
and cannot qualify this experiment. Native purchase routing, wire encoding,
customer data, attribution, reporting, browser behavior and production
compatibility remain unverified. No account or real customer data is used.
The option defaults to false and does not change installed globals or
production behavior.

### Experimental direct-Ads purchase cart subset

[Google's cart guidance](https://support.google.com/google-ads/answer/14943675?hl=en)
says cart data is processed only on purchase events. Its table lists direct
Google Ads item fields `id`, `price` and `quantity`, while distinguishing
Analytics/Firebase `item_id`; its introductory note instead says `item_id` is
essential. This internal conflict is unresolved. The following implements only
an explicitly local direct-Ads **`id` subset**; it does not resolve the conflict,
translate between schemas or establish native behavior.

`experimentalPurchaseCart: true` requires `experimentalPurchase: true`. It
adds an optional, event-only `items` array to the local purchase command:

```js
gtag("event", "purchase", {
  send_to: "AW-0000000000/SYNTHETIC_LABEL",
  currency: "USD",
  items: [{ id: "synthetic-sku", price: 12.5, quantity: 2 }],
});
```

The local subset requires one to ten dense items, each an own-data record with
exactly `id`, `price` and `quantity`. The ID is a nonempty well-formed string
of at most 128 UTF-16 code units; price is a finite nonnegative number other
than negative zero; quantity is a positive safe integer up to 1,000,000.
These limits and required fields are local restrictions, not claims about
Google's validation. Empty arrays, `item_id`, mixed schemas, extra keys,
accessors and invalid or excessive values reject the whole command. Duplicate
IDs are preserved, not deduplicated. Omitted or explicitly undefined `items`
omits the cart. Items are not accepted in scopes, configs or conversions.

Main snapshots the nested own-data records before queueing; the worker repeats
validation on the received copy. Array length is checked before enumerating,
and a changed length, keys, element identity or item value observed during
rechecking is refused. Proxy traps can spoof observations and key enumeration
can invoke them synchronously; accepted field limits are not a hard work bound
or untrusted-input isolation. dataLayer values are captured when drained, not
when pushed.

The literal-loopback request uses a single **invented local-only**
`airlock_items` field containing a JSON array, preserving item order and field
association. The existing encoded URL ceiling still applies. This encoding
is not Google's wire format. The existing conversion report does not evaluate
cart inputs. There is no native comparison, feed matching, item-id translation,
price/unit arithmetic, customer or product reporting, attribution or browser
qualification; no production cutover or parity is implied. Use synthetic
non-PII IDs only. Consent, no-replay, multi-destination and resource limits
continue to apply as described above.

### Experimental bootstrap command

`experimentalBootstrap: true` additionally accepts `gtag("js", new Date())`.
The main-side adapter snapshots the Date's time value synchronously as an
integer millisecond primitive; the Date object itself never crosses into the
worker. The worker independently checks the finite Date range and acknowledges
the command without dispatch. The host accepts that acknowledgement only for
the matching in-flight bootstrap command and sequence. Its outcome is
`bootstrap-accepted`, not proof that a vendor SDK initialized.

The adapter captures the Date time intrinsic at module load and invokes it
without calling methods or accessors on the supplied object. Invalid Dates,
non-Dates and proxies reject. This loopback experiment assumes a trusted
same-realm runtime and ordinary JavaScript intrinsics when the module loads;
pre-load primordial compromise is not covered. The captured method must match
the expected native source string or the opt-in fails closed. That string
check does not prove intrinsic authenticity or broader isolation; other engines
may also reject because their string representations are not qualified. A
trusted-realm solution, if needed for production, remains a separate unresolved
boundary decision. The option defaults off.

This command is a local, zero-send marker: it has no effect on configuration,
consent or conversion routing. Repetition and its order relative to other
commands are local prototype behavior, not native initialization semantics.
It does not reproduce native config/auxiliary traffic, encoding or parity.

### Experimental dataLayer entry

The generated 058-04 fixture uses `dataLayer.push(arguments)` for its standard
`gtag` bootstrap. `experimentalDataLayer: true` adds an explicit
`adapter.drainDataLayer(dataLayer)` entry point for that input shape; it does
not install or replace globals, patch `push`, or automatically watch the array.
Enable `experimentalBootstrap` separately to accept its `js` command. The caller
must explicitly drain newly appended calls.

The local entry accepts one same-realm array per adapter, at most 128 entries
for its lifetime, containing dense arguments-like objects with at most three own
data arguments. It bounds the array length before reading entries, refuses
holes, accessors and inconsistent lengths or replaced processed entries, and
does not truncate. Structural refusal occurs before forwarding the batch.
Each newly observed command is then passed in order through the existing
adapter capture, whose individual rejections and queue-overflow outcomes remain
visible. Already processed entries are not replayed, including after a consent
change; replacing or shortening the array is refused. The Date, parameters and
page context are snapshotted when drained, not when the page originally queued
them. Disposal releases the retained queue reference.

This is an explicitly invoked local assumption, not the native SDK's queue
draining, initialization, timing or consent ordering. Field limits do not
establish a hard main-thread work bound or isolate untrusted inputs: existing
parameter capture enumerates record keys synchronously and may invoke proxy
traps. Egress remains independently gated by the host seal, and this entry adds
no vendor request or parity claim.

For local routing experiments, `experimentalRouting: true` allows a literal
loopback endpoint with a one-to-32-digit destination in its conversion path.
This matches the 058-04 reference manifest's parser bound, not evidence that
Google accepts 32-digit destinations. The separate native-stock policy remains
unchanged.
`gtag("config", "AW-<destination>")` must match that path, and the conversion
`send_to` must use the same destination plus an alphanumeric, underscore or
hyphen label of at most 128 characters. Mismatches reject without dispatch.
This is a bounded local rule, not a claim about native Google validation or
authorization to send to Google. The default remains the fixed synthetic route.

### Experimental multi-destination routing

[Google documents](https://developers.google.com/tag-platform/gtagjs/reference/parameters)
`send_to` as a string or string array and describes
[multi-target routing](https://developers.google.com/tag-platform/gtagjs/routing).
Those sources and the retained one-conversion capture do **not** establish the
native request count, ordering, duplicate handling, failure or callback
semantics for arrays of labeled Ads conversions. The following is a local
experiment, not an observed Google fanout or a compatibility claim.

`experimentalMultiDestination: true` requires `experimentalRouting: true`
and an `additionalEndpoint`: a second literal 127.0.0.1 conversion endpoint
with a different numeric destination. There are exactly two predeclared
endpoints at most; no vendor or non-loopback endpoint is allowed. Configure
each selected destination separately before a conversion. A `send_to` string
or an array of one or two distinct configured destinations is accepted:

```js
gtag("config", "AW-111", { currency: "USD" });
gtag("config", "AW-222", { currency: "CAD" });
gtag("event", "conversion", { send_to: ["AW-111/LOCAL_ONE", "AW-222/LOCAL_TWO"], value: 3 });
```

The config parameters in this example additionally require
`experimentalParameterScopes: true`. The local policy builds one request per
selected destination, in array order, using that destination's config scope.
It rejects the entire command before dispatch if a destination is missing,
unconfigured, duplicated or invalid. Repeated config remains unsupported.
The host snapshots the array without executing getters, bounds its own length
before enumerating properties and rejects a changed length during capture.
The connector independently applies the same checks. The host checks each
request's sequence, selected endpoint and label before dispatch. The seal
checks current `ad_storage` independently for each request; a held branch
is dropped and never replayed. A non-2xx HTTP response allows the next branch
to proceed; a transport failure stops the sequence. These choices are all
experimental and must not be used to infer native duplicate, ordering,
partial-failure or consent behavior.

Completed conversion outcomes include redacted `branches`, indexed in input
order. Each is `transport-settled`, `held`, `failed`, or `not-attempted`,
with a host-observed status where available. A terminal interruption can
instead produce `unknown` for an in-flight branch. Different branch results
produce the aggregate `partial`, never full settlement. A settled HTTP
response proves neither independent receiver receipt nor vendor processing.
The host checks every worker-reported branch against its own correlated
response and rejects a fabricated, premature, duplicate or wrong-route result.
For an admitted callback, the existing experimental terminal/timeout policy
still applies to the whole command, not each branch.

This mode defaults off; without it arrays remain rejected. The existing
single-destination relationship report does not evaluate these arrays. Use
only the separate local receiver observations when exercising this option;
neither they nor the branch outcomes establish native parity. Qualifying
native behavior requires a pinned, same-input multi-label/multi-account
capture including branch requests/responses, ordering, duplicates, partial
failure, consent and callback completion, with separate authorization for
live activity.

For local command experiments, `experimentalParameterScopes: true` also
supports both `gtag("set", values)` and `gtag("set", key, value)`, plus
optional config values:

```js
gtag("set", { value: 10, currency: "USD" });
gtag("set", "transaction_id", "synthetic-order");
gtag("config", "AW-0000000000", { currency: "CAD" });
gtag("event", "conversion", {
  send_to: "AW-0000000000/SYNTHETIC_LABEL", value: 12,
});
```

In this experiment the worker retains independent global and destination-config
records, then resolves each conversion as global < config < event. Only `value`,
`currency` and `transaction_id` can be set in the first two scopes; `send_to`
remains mandatory on each event. Calls are captured by value and processed in
order. A valid `set` updates only supplied keys and reports `scope-updated`;
invalid updates are rejected atomically. An explicitly supplied `undefined`
overrides lower scopes and omits that field from the request; zero and empty
strings remain present. The existing duplicate-config rejection still applies.
Scope changes do not bypass the seal or replay a denied conversion. Each
adapter/chamber has its own scope state. These choices are **experimental
semantics**, not qualified native behavior; native key/value set semantics, other parameters,
repeated config and native undefined/consent behavior remain unverified.
The option defaults to false and works independently of experimental routing.

Main synchronously captures/clones primitive data and returns `undefined`.
The chamber interprets commands, retains config, validates types and builds
the query. Outside the scope opt-in, config options and `set` are rejected.
Duplicate config, pre-config conversions, unknown
commands/keys, arrays (except the explicitly opted-in `send_to` form above),
nested objects and accessors reject visibly.
The pure connector independently enforces own-data-property parameter/context
records too; inherited values or getters cannot supply optional wire fields.
Without the callback opt-in, callbacks reject the **whole** call; none are
executed or silently stripped.
These are deliberate prototype rules, **not native gtag validation/queue/
config/callback semantics**.

### Experimental host callback

[Google documents](https://developers.google.com/tag-platform/gtagjs/reference/parameters)
`event_callback` as a function called when event processing completes and
`event_timeout` as its timeout in milliseconds. This does not pin the native
timeout default, completion boundary or failure/consent behavior.

With `experimentalCallbacks: true`, one conversion can provide both an own
`event_callback` function and an explicit integer `event_timeout` from 10 to
10000 ms. The host retains the function; only the primitive event data crosses
to the worker. Other commands, incomplete metadata, accessors and out-of-range
timeouts are rejected as whole calls. Callback support is off by default and
does not install a global or add a DOM capability.

The **local experimental policy**, not a native finding, schedules the
callback once without arguments on a microtask when the worker result settles,
including held or rejected results, or when an admitted command reaches a
terminal worker failure. A timer starts on admission; if it wins, the callback
can run before dispatch or settlement. Timeout neither cancels nor retries the
conversion. Disposal cancels callbacks that have not yet run. The timer is
subject to the host event loop, not a real-time guarantee. This callback is
never evidence of dispatch, HTTP success, product receipt or attribution.

With the option enabled `getState().callbacks` gives bounded counts for
pending, invoked, timeout, cancelled and errors, without functions or error text.
Synchronous throws and rejected returned promises are counted, but `flush`
waits only for callback invocation, not asynchronous callback results.
Navigation/form behavior, native completion ordering, multi-target callbacks
and browser timing remain unqualified.

`setConsent({ ad_storage: "granted" })` controls the host seal, not native
Google Consent Mode. Pending/denied conversions are dropped; grant does not
replay them. Defaults: 32 queued calls (maximum 128), 256 lifetime admissions
and bounded outcome history, 16 flush waiters, 2-second startup/command and
1-second transport deadlines. Timeouts and lost correlation terminate the
adapter rather than allowing late results to settle another command.
An intercepted request must belong to the active conversion and have a fresh
request ID. The adapter checks the worker's request count, disposition and
status against the response it sent through the trusted host; an unsolicited
request, extra request or contradictory result terminates the adapter instead
of reporting settlement. This corroborates local host transport only, not the
worker's full native request semantics or an independent receiver.
`flush` reports outcomes, not independent receipt; the example observes the
receiver separately. Repeated `dispose` preserves cleanup failure.

### Experimental consent commands

[Google documents](https://developers.google.com/tag-platform/gtagjs/reference#consent)
`gtag("consent", "default", values)` and `gtag("consent", "update", values)`
with `granted` / `denied` purpose values. With
`experimentalConsentCommands: true`, this prototype accepts nonempty plain
records containing only the documented `ad_storage`, `analytics_storage`,
`ad_user_data` and `ad_personalization` purposes. The option is off by default.
Unsupported keys (including `wait_for_update` and region controls), values,
accessors and malformed commands reject as a whole; no timer, region selection
or implicit replay is implemented.

The local policy retains separate default and update values, merges partial
commands, and prefers an explicit update over a later default for that purpose.
An admitted valid denial tightens the host seal immediately, including for
branches of a conversion already in flight and earlier queued conversions; it
does not cancel a request already sent. Each pending denial remains effective
until its command is processed. A later grant takes effect only after its
serialized worker acknowledgment, and cannot bypass a different pending denial.
Once a denial is processed, it conservatively remains a hold until a later
processed grant for that purpose, even when a prior update would otherwise
outrank a new default. The ordinary update-over-default rule can still keep an
earlier update denial in force after a later default grant. Invalid or
unadmitted commands do not change the seal. These are local safety and ordering
choices, not findings about native gtag queues. A worker rejection or
contradictory acknowledgment for an admitted consent command terminates the
adapter instead of silently ignoring it. These commands do not call the trusted
host `setConsent` API or change the host's decision.

For local dispatch, **both** the independent host `ad_storage` signal and the
latest applicable tag `ad_storage` value must be granted. In addition, an
explicit denial of any other supported tag purpose holds the entire request,
as a conservative local policy rather than an implementation of native Google
consent behavior. An omitted or pending non-storage purpose does not itself
hold. The host seal evaluates these restrictions for each branch. The tag
starts with no value, so enabling this option
holds conversions until a tag default or update grants `ad_storage`. Host
`setConsent` still takes effect independently at the seal; tag commands cannot
grant past it. Holds are dropped, not buffered or replayed.

**The other three purposes are not fully modeled.** An explicit denial holds
the whole request, but the prototype does not implement their native
purpose-specific payload shaping or processing semantics; each
`consent-updated` outcome lists those supplied names in `unmodeledPurposes`,
without their values. In particular, the local hold for `ad_user_data: "denied"`
does not implement Google's data-use restrictions. This is a concrete blocker for
privacy qualification and production use, not a claim that those signals are
honored. The local request also carries no native Consent Mode fields or
modeling pings. Native wire, ordering, asynchronous wait, queue and data-use
semantics need separately authorized native evidence and review; no tag
command outcome establishes native compatibility or product receipt.

## Exactly five mapped fields, not the whole native primary

Only `label`, `value`, `currency_code`, `oid`, and `url` are mapped. Routing
and controlled input-to-local-wire relationships are synthetic assertions,
not native endpoint/value equality. Host dispatch attempts, independent
receiver arrivals and correlated response settlement are distinct evidence.

`test/fixtures/google-ads-conversion-native-shape.json` is an exact value-free
projection of the explicitly supplied **partial retained native shape**:
12 rows, 62 unique query names, primary ordinal 10 with 39 ordered pairs,
and response-linked ordinal 11 with 44 pairs, no observed response and no
`oid`. Ordered names, duplicate `random`, guard blocks and response limits
remain intact. It contains no native values, raw URLs, bodies, SDK bytes,
private identifiers or source digest. It is not synthetic conversion values,
a native replay, a complete chain or a compatibility oracle. The old synthetic
page-load fixture is not used as conversion evidence.

`rig/google-ads-conversion-prototype-report.mjs` is pure and accepts explicit
independent arrivals, controlled snapshots and the shape projection. It
accounts for every retained row/field/occurrence, including all 34 unmapped
primary names. Public output contains field names, counts, dispositions,
types and relationship booleans—not raw URLs or transaction/input values.
Missing/invalid projection is visible. The result is **always INCONCLUSIVE**
with `fullCompatibility: false`. To evaluate scoped values, explicitly pass
`experimentalParameterScopes: true` and a `scopeSnapshots` array aligned
one-for-one with the event snapshots and independent arrivals. Each entry
must have complete `global` and `config` own-data records at the event:

```js
scopeSnapshots: [{ global: { value: 10 }, config: { currency: "CAD" } }]
```

The report applies the experimental precedence to those caller-supplied
snapshots; it cannot establish that they describe actual worker state or prove
the preceding command history. Missing, invalid or misaligned snapshots fail
the local relationship checks. Field-level output identifies only the winning
scope, type, omission and comparison result, never the values. The default
direct-input report is unchanged.
For an input snapshot containing the callback pair, pass
`experimentalCallbacks: true` to the report as well. It validates but never
executes the function; a wire relationship is not evidence that the callback
ran or that its timing matched native behavior.
For an experimental destination, pass `experimentalRouting: true` to the
report as well; it checks that the snapshotted destination matches the
loopback path and that the observed label matches the call. The default report
continues to accept only the fixed synthetic route.

Missing behavior includes config/page/remarketing companions, the first-party
primary alternative, response-linked fetch/fallback/redirect/cookie branches,
identity/click IDs, Consent Mode, native callback/navigation semantics, browser transport and
headers/cookies, deduplication/matching/attribution/backend receipt and CWV.
Original request/response bytes, native values/endpoints and historical
runtime/configuration/version are unavailable; historical context is not a
fresh same-input native reference. Node first-party execution is not browser
qualification or a sandbox for adversarial Node modules. Full 059-01/native/
whole-wire/live/C2-C3 obligations remain open.
