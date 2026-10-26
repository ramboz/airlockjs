# Fixed local journey source fixtures

This prepares two SDK-free pages and a bounded localhost receiver. It is **not a
browser runner, execution approval or browser/worker qualification**. Slices
060-14 and 059-20 retain open actual browser acceptance criteria. This helper
itself never acquires a browser; its Node HTTP tests are not browser evidence.
The current 156.0.8078.48 metadata is not qualified by historical 155 evidence.
The separately supervised [foreground procedure](local-browser-foreground.md)
was later issued once and failed its first receiving preflight before any
product worker; Google was not acquired. Normal exact cleanup was observed,
but neither browser journey is complete.

## Source/local HTTP API

`startLocalBrowserJourneys()` from `./local-browser-journeys.mjs` takes **no
options**, reads the fixed source bytes before listening, and binds only
`127.0.0.1:0`. It has no CLI, proxy, directory discovery or browser dependency.
An ordinary Node HTTP caller can inspect a page and must always close the helper:

```js
import { startLocalBrowserJourneys } from "./rig/local-browser-journeys.mjs";

const fixture = await startLocalBrowserJourneys();
try {
  const page = await fetch(`${fixture.origin}/meta`);
  if (page.status !== 200) throw new Error("source-page-unavailable");
} finally {
  const closed = await fixture.close();
  if (closed.closure !== "closed") throw new Error("owned-cleanup-unknown");
}
```

Only `/meta`, `/google` and the explicitly listed transitive JS source modules
are served, using GET, no-store, nosniff and restrictive same-origin script/
worker/connect CSP. Source and generated-page SHA-256 manifests describe the
exact served bytes; cached source bytes do not change after listening.
Only `/tr/?…` and `/pagead/conversion/0000000000/?…` accept queries, in canonical
prototype field order/encoding with the fixed synthetic values in the controllers.
Unknown paths, aliases, extra fields, foreign Host/Origin, non-GET and bodies are
refused. This is not proof of browser-wide egress denial: CSP permits same-origin
requests, and unadmitted browser surfaces still require independent controls.

Fixed helper limits: 64 admitted HTTP request slots (including refusals),
8 measurement attempts shared across both receivers, 8,192-byte request target,
64-KiB headers/64 header pairs, 64-KiB declared body ceiling (all nonempty bodies
are rejected), 2-MiB per response and 8-MiB retained source/receipt data.
Excess requests are refused with bounded counters, not retained history.
At most 64 sockets are owned. First responses expire with HTTP 504 after 2 seconds.
Cleanup attempts the server and every owned socket, has a 2-second deadline,
and returns `closed` or `UNKNOWN` with bounded error codes. Automatic cleanup
reserves those 2 seconds inside the original 60-second helper lifetime.
These are Node helper bounds, not a browser clock/cleanup certificate.

## Interfaces for a separately approved future driver

No acquisition or navigation instructions are supplied. A future permitted driver
must independently own its fresh browser/profile, deadline, no-external-send
controls, worker/resource observations, receiving controls and final cleanup.
Use a fresh fixture per vendor interval; never treat one vendor as the other's proof.

The fixed page API is `beginNegativeControls()`, `beginPositiveControls()`,
`finishJourney()`, `runJourney()` and `getJourneyState()`. Commands take no inputs.
Nothing starts automatically. Queued init/config, pending, denied and
grant-without-command checks assert **adapter dispatch counters**, not receipts.
Two positive snapshots use only `https://example.test/…` as captured data, never
as navigation destinations. The unchanged adapter creates its actual module
worker; there is no injected chamber, Node bridge or main-thread vendor mapper.

The driver must observe zero receiver arrivals after negative controls. Start
positive controls without awaiting completion, independently observe the first
held arrival and absence of a settled positive result, then call the server's
`releaseFirstResponse("meta" | "google")`. Only the first response is withheld;
the second receives 204. `failFirstResponse(vendor)` instead releases fixed 503.
There is no HTTP control endpoint, arbitrary response body or configurable URL.
The driver must compare both arrivals/fields to captured inputs and correlate
actual worker events, requests and responses before invoking `finishJourney()`.

`getReceiverArrivals(vendor)` returns copies of independent **synthetic-only**
method/path/query/raw-field/status/time observations. `getState()` has counts and
cleanup state, not raw IDs, transactions or page URLs. Page state never certifies
receiver receipt or actual worker execution; worker events/resources are separate
driver observations. Page failure is visible. The page reserves 1 second for
adapter disposal inside its 20-second interval; completed page checks still say
INCONCLUSIVE, and worker exit needs independent observation.

## Validation and remaining gaps

`test/local-browser-journeys.test.js` uses real **Node HTTP clients**, not browser
outcomes. Its source-graph traversal is independent of the manifest builder.
Controlled-DOM tests cover missing Worker only; they are not browser tests.
Existing `test/{meta-pageview,google-ads-conversion}-prototype*.test.js` retain
the genuine Node-worker, consent, response-correlation and mapping regressions.

The existing [Meta prototype](../connectors/meta-pixel/README.md) and
[Google conversion prototype](../connectors/google-ads/CONVERSION-PROTOTYPE.md)
and their unchanged report modules remain authoritative for their gaps:
Google has 12 historical rows/62 names, only 5 of 39 primary names locally
mapped, 34 missing, an unimplemented response-linked branch and unavailable
native values/SDK/browser/cookie/CWV/outcome evidence. Meta's redacted historical
field comparison likewise is not complete native equivalence. No production
boot, core, frozen contract, build, native SDK or vendor behavior is changed.
