---
status: DRAFT
dependencies: [060-01]
last_verified:
kind: feature
frame_review: true
arch_review: true
---

## Slice 060-02 - Report complete event and commerce data

**Goal:** A marketing engineer reports native-equivalent standard, custom and
commerce events through existing site calls without losing data or changing types.

**DoR:**
- [ ] 060-01 supplies the real replacement journey and qualified references.
- [ ] Pinned event/type/size/error vectors cover the overview's full vocabulary;
      scalar/array content-ID and nested-price disagreements are resolved by
      observations rather than choosing the easiest public example.
- [ ] Parent identifies existing mapper/governance/configuration seams; approved
      private inputs and scenario-specific actual-dispatch grants are available.

**Acceptance Criteria:**

1. For PageView and all seventeen standard events listed in the overview, the
   adopter's `track` inputs reach the real chamber and official endpoint with
   native event names, request counts and event-data relationships. This includes
   every documented per-event property and newly discovered native option.
2. Commerce journeys preserve exact catalog/content IDs, `content_type`,
   `contents` quantities and supported price data, value/currency, counts,
   delivery category and predicted lifetime value. Test scalar/array IDs,
   multiple items, zero/fractions, boolean status and supported Unicode/nesting.
   Do not infer input numbers from string-valued fixture fields.
3. `trackCustom` supports native name/parameter behavior, including the documented
   50-character boundary and custom properties on standard events. URL/property
   inputs used by custom conversions remain intact; no new conversion-specific
   browser command is invented. Backend rule recognition belongs to 060-11.
4. Missing/empty/null/undefined/nonfinite/invalid values, overlong names,
   oversized payloads, reserved keys and mutation after enqueue produce the
   observed native caller/event behavior and explicit operator evidence. No
   success-shaped omission or unreviewed relaxation of payload governance.
5. C1-C9 comparison covers full encoding, duplicate parameters, body/query
   transport choices, auxiliary requests, responses and browser effects.
   Scalar `cd[region]` in the historical capture does not prove native
   value/currency, array/object or conversion serialization.
6. Deliberately alter a monetary value/type, product ID/quantity, custom name,
   target, nested field or request count. Each corresponding control fails;
   stripping all custom data or relying on the synthetic Lead fixture cannot pass.
7. The operator can identify the originating call and field for a native
   difference, denial or capture gap without raw identity or private data in
   public output. Other generic-pixel vendors and frozen push behavior are
   unchanged as demonstrated by later targeted regression evidence.

**DoD:**
- [ ] Every event/property/error vector has passing and feature-removal controls.
- [ ] Targeted end-to-end serialization, contract and other-vendor regression
      tests plus applicable lint pass.
- [ ] Independent compliance, craft, architecture and reconciliation reviews pass.
- [ ] Native/private provenance and the public event-support ledger remain distinct.

**Anti-horizontal-phasing check:** The engineer completes real event/commerce
reporting with native-equivalent output and diagnostics, not just a new encoder.

## Offline observation - 2026-10-29

The retained no-send experiment used older SDK bytes and a synthetic fixture.
Its baseline PageView made one aborted measurement attempt without `cd[value]`
or `cd[currency]`; each of two controlled PageViews made one aborted attempt
with exactly one of each field matching its input. The fixture supplied numeric
values, although the private capture's input metadata stores their text form.
No vendor measurement was sent or response received.

An offline direct connector-host check using the same numeric value/currency
arguments, a synthetic Pixel ID and a different page/context found that the
060-13 prototype accepts the parameter-free PageView but drops each
three-argument PageView as `unsupported-command`. Its two-argument limit was
intentional; this is a concrete future event-data gap, not a regression in the
completed prototype. The private capture and scoped verifier remain in the
session artifacts. This is not a same-environment native/chamber comparison,
an official-backend receipt, proof of general serialization or evidence that
the prerequisites or acceptance criteria above have passed.

The existing generic Meta connector is a separate reuse candidate: in a direct
connector-host check with a synthetic ID, its `page_view` event produced the
same two selected field values for both controlled inputs and omitted both for
the baseline. It takes Airlock event parameters, not the native `fbq` call;
no worker, dispatch or backend receipt was exercised by this check. It does
not make the prototype or the full replacement compatible.

On 2026-10-29 the owner approved experimental construction before complete
native-response captures. The opt-in `experimentalPageViewData` path now
snapshots finite numeric `value` and string `currency`, sends their `cd[...]`
fields through the real first-party Node worker and governed loopback receiver,
and visibly rejects unsupported data. The prototype's default remains
unchanged. This selected-field local observation does not establish native
type handling, complete serialization, live delivery or acceptance of 060-02.
An independent local-receiver check subsequently matched the two selected
fields against the three retained aborted attempts, including the baseline
omissions. The controlled values matched, but the native and local contexts
differed; this is not a same-environment or complete-request comparison.

### Experimental construction - 2026-10-29

The separate `experimentalEvents` opt-in admits the 17 documented standard
names and bounded custom names, with `track`/`trackCustom` broadcast and
`trackSingle`/`trackSingleCustom` targeting when multi-Pixel routing is also
enabled. The existing data opt-in admits only finite numeric `value` and
bounded string `currency`; other fields reject rather than disappear. Actual
first-party Node worker and loopback tests exercise every listed standard name,
target selection, custom names, mutation snapshots and consent holds.

The historical capture shows PageView and one scalar custom-data field; the
Lead fixture is synthetic. The event names are a documented floor, not a
native conversion capture. Event mapping, custom name limits, routing order,
error behavior and event-data encoding remain experimental assumptions;
commerce arrays, event options, native responses, real vendor receipt and
every acceptance criterion above remain unqualified. No live event was sent.

The additional `experimentalScalarEventData` opt-in extends that local record
with region, content category/name/type, search string, predicted lifetime
value, item count, status and delivery category. The prototype admits only
bounded scalar types and enumerated content/delivery values; arrays, objects,
unknown keys and invalid types at that checkpoint rejected the complete call.
Serialized worker/loopback tests check PageView region, a multi-Pixel Purchase,
targeting, snapshotting, consent, invalid inputs and the encoded URL ceiling.

The retained fixture contains `cd[region]=us`, but its input is not retained;
the test uses `us` as a synthetic input and establishes the local wire shape,
not the native input relationship. The listed commerce vocabulary comes from
the documented floor above; scalar encoding, ordering, type/enum admission and
count bounds are prototype assumptions. This is not a native commerce capture,
array/nested serialization, full event support or a C1-C9 pass.

The separately gated `experimentalContentNameArray` extends the existing
`content_name` scalar with a bounded array of synthetic strings. Meta's
Magento plugin [tests one product name in an array](https://github.com/meta/meta-for-magento2/blob/5ab5527cdc72ec248b1385f8aa4c80baf81109ba/app/code/Meta/Conversion/Test/Unit/Block/Pixel/PurchaseTest.php#L217-L233)
and [places the result in its Purchase payload](https://github.com/meta/meta-for-magento2/blob/5ab5527cdc72ec248b1385f8aa4c80baf81109ba/app/code/Meta/Conversion/view/frontend/templates/pixel/purchase.phtml#L22-L40).
The local subset snapshots and revalidates arrays of up to 16 nonempty,
well-formed strings, each at most 64 UTF-16 code units, and emits one
JSON-stringified `cd[content_name]` value. Tests cover mutation, scalar and
targeted controls, custom Purchase composition, consent and refusals.
Bounds, empty arrays, multiple names, ordering, duplicates and the wire mapping
are prototype assumptions. The source does not establish native encoding.
No native request, receipt, parity or readiness criterion is claimed.

The separately gated `experimentalContentIds` path now snapshots bounded
`content_ids` arrays of strings and nonnegative safe integers, then emits one
JSON-stringified `cd[content_ids]` value via the worker and local receiver.
Tests exercise typed/ordered IDs, duplicates, snapshotting, routing, consent,
invalid arrays and the encoded URL ceiling. This mapping, empty-array handling
and size/type restrictions are explicit prototype choices: the documented
input vocabulary establishes neither native array wire encoding nor scalar
acceptance. Other arrays and nested `contents` remained unsupported at that
checkpoint. No native capture, backend receipt, parity or readiness gate is
claimed.

The separate `experimentalContents` opt-in accepts only documented item field
names `id` and `quantity`, snapshots the bounded array and nested records on
capture, and revalidates them in the serialized worker. It emits one
JSON-stringified `cd[contents]` value via the governed loopback receiver.
Tests exercise broadcast, targeted and custom events, mutation, consent,
malformed records, unsupported prices, combined event data and size limits.

The permitted string/integer ID and finite nonnegative numeric quantity
subset, required fields, bounds, empty/undefined behavior and JSON wire form
are local prototype choices, not captured native behavior. At that checkpoint,
price and other item fields were rejected. Native contents input-to-wire
evidence, backend receipt, catalog matching and all readiness/acceptance
gates remain open.

The separately gated `experimentalContentsItemPrice` admits an optional
numeric `item_price` in those same item records. Meta's Magento plugin
[tests a numeric price of 100 in its `getContents()` result](https://github.com/meta/meta-for-magento2/blob/5ab5527cdc72ec248b1385f8aa4c80baf81109ba/app/code/Meta/Conversion/Test/Unit/Block/Pixel/PurchaseTest.php#L152-L198)
and puts the result in its [`trackCustom` Purchase payload](https://github.com/meta/meta-for-magento2/blob/5ab5527cdc72ec248b1385f8aa4c80baf81109ba/app/code/Meta/Conversion/view/frontend/templates/pixel/purchase.phtml#L22-L40).
The local subset accepts finite, nonnegative numbers up to
`Number.MAX_SAFE_INTEGER`, excluding negative zero, and retains existing
unpriced items. Snapshots and worker revalidation feed the existing local JSON
mapping, with no total calculation. Tests cover custom Purchase composition,
routing, consent holds, no replay, invalid prices and existing defaults.
Optionality, bounds and JSON mapping are local assumptions; the source does
not establish native wire behavior. Other item fields remain unsupported.
The full Magento payload remains unqualified. No native request, receipt or
parity is claimed.

The separately gated `experimentalSetAgent` accepts a synthetic,
version-shaped `fbq("set", "agent", agent, pixelId)` command for an already
initialized local Pixel. Meta's Magento tracker
[calls that form immediately before the event](https://github.com/meta/meta-for-magento2/blob/5ab5527cdc72ec248b1385f8aa4c80baf81109ba/app/code/Meta/Conversion/view/frontend/web/js/metaPixelTracker.js#L34-L47);
its getter derives the string from
[source and plugin version](https://github.com/meta/meta-for-magento2/blob/5ab5527cdc72ec248b1385f8aa4c80baf81109ba/app/code/Meta/BusinessExtension/Helper/FBEHelper.php#L137-L171).
The local subset stores an accepted setting in the worker per Pixel, updates
it in command order, and emits it as `a` on subsequent governed loopback
requests. A retained PageView has an `a` field, but does not connect it to
this command. Format bounds, setting lifetime, replacement, per-Pixel behavior,
consent interaction and wire mapping are assumptions. Tests cover ordering,
refusals, worker messages, consent and no replay. Magento's full init/options
and plugin payload remain unsupported or unqualified; no native equivalence,
receipt, parity or readiness criterion is claimed.

A synthetic composition test now combines those local subsets with the
Purchase template's selected commerce fields, tracker-added `source` and
`pluginVersion`, the agent command and custom-event ID. It checks snapshots,
field association and independent consent holds in the worker and loopback
receiver. It does not execute Magento or its server-side request, establish
native encoding or qualify the complete plugin journey.

The separate `experimentalCustomProperties` opt-in accepts a bounded subset
of additional string-valued event properties, on the existing standard or
custom event calls. Meta's retained public conversion-tracking reference
([P7](spec.md#public-references)) identifies custom properties on events; the
retained `cd[region]` wire observation does not establish a general mapping
from arbitrary input names. The first-party worker and local receiver exercise
snapshots, routing, consent and refusals, emitting `cd[<key>]` as an explicit
prototype hypothesis. The original string-only subset, field count and length, reserved
names, omission/error behavior and wire ordering are not native-qualified.
Inputs are synthetic; no production cutover, native parity or 060-02
acceptance is claimed.

The separately gated `experimentalNumericOrderId` adds one non-string custom
property case. Meta's Magento plugin puts `order_id` in a
[`trackCustom` Purchase payload](https://github.com/meta/meta-for-magento2/blob/5ab5527cdc72ec248b1385f8aa4c80baf81109ba/app/code/Meta/Conversion/view/frontend/templates/pixel/purchase.phtml#L22-L40),
tests the getter with the [number 1](https://github.com/meta/meta-for-magento2/blob/5ab5527cdc72ec248b1385f8aa4c80baf81109ba/app/code/Meta/Conversion/Test/Unit/Block/Pixel/PurchaseTest.php#L236-L245),
and [passes the payload to fbq](https://github.com/meta/meta-for-magento2/blob/5ab5527cdc72ec248b1385f8aa4c80baf81109ba/app/code/Meta/Conversion/view/frontend/web/js/metaPixelTracker.js#L34-L47).
The local subset accepts only nonnegative safe integers other than negative
zero and sends their decimal string as `cd[order_id]`. Worker and loopback
tests cover capture, routing, refusals and consent holds. The plugin also passes a custom-event `eventID` option,
now supported for this local argument position as described in 060-10. The
complete plugin payload is not supported. The number limits, wire mapping
and other event routes remain assumptions rather than native observations.
Only synthetic IDs are used. No native request, backend receipt, parity or
readiness criterion is claimed.

## Assumptions

- Unverified: native type/coercion/size behavior is discriminable without losing
  the meaningful relationships to policy filtering and existing frozen APIs.
- Unverified: current mapper/configuration seams can support the complete event
  vocabulary without changing unrelated vendors; parent source evidence is needed.

### Close-out (post-DONE)

- [ ] Parent updates board/learnings and adopter vocabulary; retain all unresolved
      scenarios and do not label the full product complete from this slice.

### Deviation log (after reconciliation)

Not implemented; no conversion execution, type proof or review is claimed.

### Reconciliation sweep

Pending implementation: event documentation, support inventory, configuration/
governance, other-vendor behavior and stable contracts require reconciliation.
