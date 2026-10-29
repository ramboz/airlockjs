# Experimental offline PageView prototype

This SDK-free source entry exercises capture → real worker → governed local GET
→ independently observed receipt. It is **not Meta Pixel compatibility**, an
eight-field product subset, a production boot, or a browser qualification.
`bootMetaPixel`, builds, installed handles and stable contracts are unchanged.

Run the first-party Node example (no browser, SDK or external requests):

```sh
/opt/homebrew/Cellar/node/24.10.0/bin/node rig/meta-pageview-prototype.mjs
```

It binds only `127.0.0.1` on an ephemeral port, runs the actual module worker
through a fixed `worker_threads` bridge, and closes its worker/server/sockets.
The historical fixture's document URL is captured **as data**, never fetched.
Output contains field names/types/dispositions, not identity or URL values.
Receiver arrivals, host attempts and command completion are separate evidence.
The gap report always remains inconclusive.

## Standalone source seam

Import `createMetaPixelPrototype` from `adapters/meta-pixel-prototype.js`.
Supply `endpoint: "http://127.0.0.1:<port>/tr/"` explicitly and a trusted
`consent: { ad_storage: "granted" | "pending" | "denied" }`. Missing consent
holds. There is no remote default. The browser default creates a module Worker;
this path is source-only and **not browser-tested**. Node tests inject a real
`{ postMessage, onMessage, onError, dispose }` bridge to the same worker entry.

- `fbq("init", "000000000000000")` captures synchronously, returns `undefined`,
  and never sends. By default only the existing synthetic all-zero Pixel ID is
  accepted. The separate `experimentalRouting: true` opt-in accepts a one-to-
  32-digit ID for local routing experiments; it does not enable vendor egress.
  Use synthetic IDs for these experiments.
- `fbq("track", "PageView")` captures and enqueues a page snapshot.
- With the opt-in `experimentalPageViewData: true`,
  `fbq("track", "PageView", { value, currency })` also snapshots those two
  optional fields and emits `cd[value]` and `cd[currency]`. Value must be a
  finite number; currency must be a well-formed string of at most 64
  characters. Unknown keys, accessors and unsupported values reject the
  whole call. These are experimental admission rules, not native semantics.
- With both `experimentalPageViewData: true` and
  `experimentalScalarEventData: true`, event data can additionally contain
  `region`, `content_category`, `content_name`, `search_string`,
  `content_type`, `predicted_ltv`, `num_items`, `status` and
  `delivery_category`. Strings are well-formed and at most 64 UTF-16 code
  units; lifetime value is finite, item count is a nonnegative safe integer,
  and status is boolean. `content_type` accepts `product` or `product_group`;
  delivery accepts `in_store`, `curbside` or `home_delivery`. Undefined
  fields are omitted; null, unknown fields, accessors and nested/array values
  reject the entire call unless explicitly enabled below. The added fields use
  `cd[...]` keys; order and conversion to strings are prototype choices, not
  qualified native behavior.
- With both `experimentalPageViewData: true` and
  `experimentalContentIds: true`, event data can contain `content_ids` as an
  ordinary same-realm array of up to 16 strings or nonnegative safe integers.
  Strings must be nonempty, well-formed and at most 64 UTF-16 code units;
  negative zero, sparse arrays,
  accessors, extra properties and other values reject the whole command.
  Empty arrays are retained and undefined is omitted. The chamber encodes the
  snapshot as one JSON value in `cd[content_ids]`, retaining element order,
  duplicates and string/number types. This encoding and these limits are
  **unverified prototype choices**, not observed native behavior.
- With both `experimentalPageViewData: true` and
  `experimentalContents: true`, event data can contain `contents`, an array
  of at most 16 ordinary objects containing exactly `id` and `quantity`.
  The local subset accepts nonempty, well-formed string IDs of at most 64
  UTF-16 code units or nonnegative safe integer IDs; quantity is a finite,
  nonnegative number no greater than `Number.MAX_SAFE_INTEGER`, including
  fractions. Negative zero, null, accessors, sparse arrays, extra properties
  and unsupported fields such as `item_price` reject the whole command. Empty
  arrays are retained and undefined is omitted. Each nested record is
  snapshotted before queuing and revalidated in the chamber, which emits one
  JSON value in `cd[contents]`. The type restrictions, required keys, size
  bounds, empty handling and wire encoding are **unverified prototype
  choices**, not native behavior or catalog proof.
- With both `experimentalPageViewData: true` and
  `experimentalEventIds: true`, `fbq("track", name, data, { eventID })`
  accepts the documented fourth argument. With multi-Pixel routing enabled,
  `fbq("trackSingle", pixelId, name, data, { eventID })` accepts the
  documented fifth argument. `data` must be a supported record, even when
  empty; the options record must contain exactly one own data property
  `eventID`, a nonempty well-formed string of at most 64 UTF-16 code units.
  The input is snapshotted and the chamber emits its value as `eid` on each
  selected local request. The bound, errors, empty-value handling and wire
  representation are experimental, not native-qualified. Custom-event option
  positions are unverified and remain unsupported. Repeating an event ID does
  not suppress a browser event; this path does not generate IDs, send server
  events or establish backend deduplication.
- With `experimentalRouting`, `experimentalMultiPixelRouting` and
  `experimentalSyntheticAdvancedMatching` all enabled, the documented
  `fbq("init", pixelId, identity)` position accepts only the two per-instance
  synthetic records returned by `adapter.syntheticIdentity(0)` and
  `adapter.syntheticIdentity(1)`. Values are randomly generated in memory;
  do not use customer data. Other fields, values, prehashed inputs, accessors
  and extra properties reject the whole init. The input is snapshotted,
  revalidated and hashed in the chamber; init sends no request. The worker
  privately retains the synthetic fixture allowlist and per-Pixel hashes until
  disposal. Later selected events attach the hash as a local
  `ud[external_id]` field through the consent seal. Duplicate init is rejected,
  and there is no update or clear command; worker disposal ends the retained
  state. A held request is not replayed, while a later newly submitted,
  consent-granted event uses the retained synthetic hash. These are local
  prototype choices, not qualified native behavior. The multi-Pixel
  prerequisite also provides validated, host-correlated result summaries.
  Public adapter state omits inputs and hashes; the private host and local
  receiver retain request URLs containing hashes. Do not log, publish or
  export those URLs or the input values.
- With both `experimentalRouting: true` and
  `experimentalMultiPixelRouting: true`, up to four distinct synthetic IDs
  can be initialized. `track` broadcasts to all in initialization order;
  `trackSingle` targets one initialized ID. Duplicate, unknown and excess IDs
  reject without dispatch. These ordering and error rules are prototype
  choices; native multi-Pixel behavior has not been captured.
- With `experimentalEvents: true`, `track` additionally accepts the 17
  standard names listed in spec 060, and `trackCustom` accepts a nonempty,
  well-formed name of at most 50 UTF-16 code units. When multi-Pixel routing is
  also enabled, `trackSingle` and `trackSingleCustom` provide targeting.
  The existing `experimentalPageViewData` opt-in also allows the same
  `value`/`currency` record on these events; the separate scalar opt-in above
  adds its listed properties, and the separate content-ID opt-in adds that
  array; the separate contents opt-in adds its bounded array of item records.
  Other arrays, objects and unrecognized fields reject.
  No native conversion event or general
  custom-event serialization was captured, and the admission rules, field
  encoding and order here are working assumptions.
- With `experimentalTagConsent: true`, `fbq("consent", "revoke")` and
  `fbq("consent", "grant")` are admitted as global tag commands, including
  before init. They capture no page context and never request transport.
  Malformed commands reject without changing tag consent. Without the opt-in,
  both commands remain unsupported. The local tag permission initially
  permits dispatch, but the independent host `ad_storage` consent must also
  be granted. A tag grant never changes or overrides host consent.
  An admitted revoke tightens the trusted seal immediately, including for
  remaining branches of an in-flight broadcast and older queued events. A
  later grant permits only newly captured events: it does not release a
  held or previously captured event invalidated by a revoke. An already
  dispatched request cannot be recalled. Commands rejected by queue or
  session limits do not alter tag permission.
  These timing, initial-state, global-scope and no-replay rules are local
  safety choices. The retained native control reports no PageView for a
  revoke before init; it does not establish native grant, replay, later
  transitions, collection, storage or multi-Pixel behavior.
- Multi-Pixel commands dispatch one branch at a time through the seal. Their
  redacted outcomes list branch ordinals, statuses and dispositions, plus
  selected and submitted-to-host counts (which include holds, not just network
  dispatches); a mixture is `partial`, never success. A
  status-zero transport failure stops remaining branches and the adapter;
  a non-2xx response does not imply receipt or prevent later branches.
  Consent is checked for each branch, and held branches are not replayed.
  A command timeout can terminate before a branch summary is returned.
  Malformed or inconsistent multi-Pixel worker summaries terminate with
  `invalid-worker-result` rather than exposing extra fields or values. Branch
  counts and statuses must match the host's own responses; a worker cannot
  report settlement without a corresponding response.
- When tag consent is enabled, single-Pixel outcomes are also checked against
  host responses, consent commands cannot dispatch, and malformed worker
  summaries terminate the adapter. `consent-updated` means only that the
  local command was processed; it is not evidence of host consent or native
  behavior.
- `await flush()` observes bounded command/transport outcomes, **not receipt**.
  `transport-settled` means a correlated 2xx response, not vendor acceptance.
- `setConsent(vector)` governs subsequent dispatch. Held commands are dropped;
  grant does not replay them. This is a prototype rule, not native semantics.
- `getState()` returns redacted outcomes/counters. `await dispose()` terminates
  owned work. Init, command and transport deadlines are finite; a timed-out
  command makes the instance terminal so late results cannot settle another.
  Disposal errors reject with a sanitized message and remain visible in
  `cleanupFailure`; they are not reported as successful closure. The example
  attempts adapter, chamber and receiver cleanup independently before
  surfacing any aggregate failure.

Main captures only six own primitive context properties (no cookie access).
The default capture reads `document.URL`, `document.referrer`, frame status,
`window.screen.width/height`, and `Date#getTimezoneOffset`. Tests provide
`captureContext()` explicitly:

| Context key | Chamber validation | Query field |
| --- | --- | --- |
| `pageURL` | Absolute HTTP(S), no credentials/whitespace/control characters, ≤2048 characters | `dl` |
| `referrer` | Same URL rule, or empty string | `rl` |
| `inFrame` | Boolean | `if` |
| `screenWidth`, `screenHeight` | Integers, 0–32768 | `sw`, `sh` |
| `timezoneOffset` | Integer minutes, −1440–1440 | `tz` |

The chamber supplies `id` and `ev` in addition to those context fields, plus
the opted-in event fields above when supplied. Extra context is not
captured. By default args are limited to three primitive values (strings ≤64
characters); multi-Pixel routing allows four for targeted data calls. The
event-ID opt-in permits a fourth argument for `track` and, with multi-Pixel
routing, a fifth for `trackSingle`.
Data records are limited to the opted-in fields listed above.
Other objects, arrays, accessors and functions are not copied.
Malformed/unsupported calls and extra arguments remain visible rejections,
not native error-semantic claims. Reentrant capture is rejected; disposal
inside a capture hook cannot enqueue work or strand `flush()`.
Defaults: queue 32, outcome history 256,
session admissions 256, simultaneous flush waiters 16; response data ≤4096
bytes and the complete percent-encoded GET URL ≤8192 characters. Oversized
encoding is rejected inside the chamber before transport. The lifetime
admission cap bounds the unchanged host's history to at most 1,024 dispatched
requests in multi-Pixel mode. The command deadline covers the entire broadcast,
not each branch separately.

The unchanged connector host retains state inside the chamber. The unchanged
wrapped host enforces the endpoint ceiling and strict `ad_storage`; the adapter
additionally requires the literal loopback destination and GET without supplied
headers/body. Fetch uses `credentials: "omit"` and `redirect: "error"`.
There is no proxy, cookie grant, ambient worker fetch, SDK wrapper or fallback.
Node confinement is not a malicious-code sandbox.

## Evidence limits

The comparison uses the union of **every actual query/reference field** in the
selected historical redacted beacon. Only seven explicitly named annotation
keys are metadata; other underscore fields are not hidden. Repeated query
values, arrays, structured fields, missing/extra values, different types and
redactions stay visible. `fbp` is never renamed `_fbp`. Matching synthetic IDs
or redaction sentinels cannot prove identity equivalence.

The fixture omits 38 experiment flags and lacks original bytes/order, complete
response/header/browser/cookie/consent behavior and equivalent native inputs.
It contains a PageView `cd[region]=us` wire field, but does not establish
the original input-to-wire relationship, general custom-data serialization,
content-ID array serialization, or contents item serialization.
The supplied references do not establish native event-ID wire encoding,
actual deduplication or server/browser correlation for this prototype.
Meta documents the third init argument, but the retained beacon does not prove
the input-to-`ud[external_id]` relationship, normalization, hashing behavior,
per-Pixel identity lifetime, account transitions or matching efficacy. The
synthetic-only local path does not implement other matching fields or
prehashed email.
Loopback Fetch is not native vendor Image/Fetch transport. Matching,
attribution, other commands, performance and C2/C3 remain unproved. Nothing
here completes or waives060-01 or its full native/whole-wire/live criteria.
