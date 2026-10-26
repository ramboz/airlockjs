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
  and never sends. Only the existing synthetic all-zero Pixel ID is accepted.
- `fbq("track", "PageView")` captures and enqueues a page snapshot.
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

The chamber supplies only `id` and `ev` in addition to those fields. Extra
context is not captured. Args are limited to three primitive values (strings
≤64 characters); arbitrary objects/accessors/functions are not copied.
Malformed/unsupported calls and extra arguments remain visible rejections,
not native error-semantic claims. Reentrant capture is rejected; disposal
inside a capture hook cannot enqueue work or strand `flush()`.
Defaults: queue 32, outcome history 256,
session admissions 256, simultaneous flush waiters 16; response data ≤4096
bytes and the complete percent-encoded GET URL ≤8192 characters. Oversized
encoding is rejected inside the chamber before transport. The lifetime
admission cap also bounds the unchanged host's history.

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
Loopback Fetch is not native vendor Image/Fetch transport. Matching,
attribution, other commands, performance and C2/C3 remain unproved. Nothing
here completes or waives060-01 or its full native/whole-wire/live criteria.
