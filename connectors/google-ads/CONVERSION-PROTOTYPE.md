# Offline Google conversion prototype — experimental, not native-compatible

This source-only example sends synthetic conversion data through an actual
first-party Node worker and an independently observed loopback HTTP receiver.
It constructs one small conversion request, not Google's complete protocol.
No vendor SDK, Docker, browser, download, account or production request is used.
Production Google/Meta boots and the package/build are unchanged.

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
primitive properties. `send_to` must match exactly. Optional `value` is a
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

For local routing experiments, `experimentalRouting: true` allows a literal
loopback endpoint with a one-to-20-digit destination in its conversion path.
`gtag("config", "AW-<destination>")` must match that path, and the conversion
`send_to` must use the same destination plus an alphanumeric, underscore or
hyphen label of at most 128 characters. Mismatches reject without dispatch.
This is a bounded local rule, not a claim about native Google validation or
authorization to send to Google. The default remains the fixed synthetic route.

Main synchronously captures/clones primitive data and returns `undefined`.
The chamber interprets commands, retains config, validates types and builds
the query. Config options, duplicate config, pre-config conversions, unknown
commands/keys, arrays, nested objects, accessors and callbacks reject visibly.
The pure connector independently enforces own-data-property parameter/context
records too; inherited values or getters cannot supply optional wire fields.
Callbacks reject the **whole** call; none are executed or silently stripped.
These are deliberate prototype rules, **not native gtag validation/queue/
config/callback semantics**.

`setConsent({ ad_storage: "granted" })` controls the host seal, not native
Google Consent Mode. Pending/denied conversions are dropped; grant does not
replay them. Defaults: 32 queued calls (maximum 128), 256 lifetime admissions
and bounded outcome history, 16 flush waiters, 2-second startup/command and
1-second transport deadlines. Timeouts and lost correlation terminate the
adapter rather than allowing late results to settle another command.
`flush` reports outcomes, not independent receipt; the example observes the
receiver separately. Repeated `dispose` preserves cleanup failure.

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
with `fullCompatibility: false`.

Missing behavior includes config/page/remarketing companions, the first-party
primary alternative, response-linked fetch/fallback/redirect/cookie branches,
identity/click IDs, Consent Mode, callbacks/navigation, browser transport and
headers/cookies, deduplication/matching/attribution/backend receipt and CWV.
Original request/response bytes, native values/endpoints and historical
runtime/configuration/version are unavailable; historical context is not a
fresh same-input native reference. Node first-party execution is not browser
qualification or a sandbox for adversarial Node modules. Full 059-01/native/
whole-wire/live/C2-C3 obligations remain open.
