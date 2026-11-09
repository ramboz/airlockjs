---
status: Accepted
dependencies: [adr-0017, adr-0043]
last_verified: 2026-11-09
frame_review: true
---

# ADR-0050: Private Google browser-managed redirect operations

The browser can follow Google's POST-to-GET redirect without exposing the
intermediate response. This private experiment lets it do that within a pinned
recipient-origin ceiling. Airlock still approves each new operation, but cannot
approve hidden hops, constrain their paths or count every physical request.

## Status

Accepted (2026-11-09)

The existing integration owner confirmed cross-lane assignment of0050 to the
Google lane on2026-11-09 after explicit current noncompetition checks with
the Adobe and Meta allocation owners. This is a coordinated feature-line
allocation, not a global/main/remote reservation. The owner accepted the exact Google-only
model and reviewed local implementation on 2026-11-09. Formal acceptance follows
this materialized record's own pinned Sol frame critique.

The helper's `new` command has no explicit-number option. This record follows
its ADR template under that confirmed allocation instead of auto-allocating
from the Google branch's incomplete local maximum. This narrow scaffolding
deviation does not bypass frame review, `record-review`, `accept` or `index`.

The approval question was:

> Do you accept this Google-only model: Airlock checks consent and the exact
> initial destination before each request it issues, then the browser may
> redirect to any path/query/account or label within the pinned Google origins?
> Airlock cannot recheck consent at hidden hops, enforce exact network-request
> counts, guarantee zero arrivals after cancellation, or claim HTTP success for
> a hidden response. Existing modes stay unchanged. Acceptance would authorize
> reviewed local implementation only, with no Google traffic or cookie permission.

The owner's exact answer was:

> Accept this model and implement locally (Recommended)

The private receipt is `google-browser-operation-owner-acceptance.json` in the
accepting coordinator's retained artifacts. It pins the accepted source-backed
proposal's SHA-256:
`751261085b9dcc66c851811a7069948ac68704d6ab9231a9026b758cc06fc332`.
That proposal's earlier readiness review is not this ADR's frame review or
implementation evidence.

## Context

Ordinary browser Fetch hides the intermediate manual redirect response.
The existing experimental adapter requests `redirect: "manual"` and requires
readable response data. Its worker then requires status 302 and Location before
authoring a final GET (`adapters/google-ads-prototype.js:621-655`;
`connectors/google-ads/conversion-prototype.worker.js:67-91`, at87d97dec).
Node's readable manual 302 does not qualify this browser path.

The retained reference describes GET 200, response-linked POST 302 and redirected
GET 200. The primary is an event/data frame despite its JSON MIME type.
Original final response bytes, initialization and current full native closure
remain missing. Offered fallback URLs are not observed execution. Existing
bounded semantic parsing stays with the trusted first-party mapper, never a
second main-thread mapper or an executed response script.

ADR-0043 requires a separate evidenced decision for redirects and opacity
(`docs/decisions/adr-0043-google-meta-request-authority.md:151-179`).
ADR-0017 freezes capability descriptors and seam drivers; its experimental
configuration carve-out does not extend those types
(`docs/decisions/adr-0017-airlock-1-0-api-contract.md:60-89`).
The shared wrapped-host readable response and existing manual experiment
cannot honestly represent the new opaque outcome.

## Decision Options Considered

| Option | Disposition |
|---|---|
| Keep manual Fetch, XHR or a service worker | These do not expose the ordinary browser's raw intermediate redirect. The current path stops rather than completing the selected chain. |
| Let the adopter page Fetch follow | Its connection policy may admit other vendors. There is no narrower per-Fetch CSP. A separately admitted whole-page ceiling is possible but is not selected. |
| Dedicated transport worker | A separate policy is possible, but adds an asynchronous handoff between the host's final live-authority check and dispatch. |
| Fixed script-free same-origin transport iframe | Selected. Capture its own-realm Fetch/Request built-ins and invoke them synchronously after the host's final checks. Its enforcing response CSP supplies the recipient ceiling, subject to actual browser proof. |
| Edge/server response envelope or Node dispatch | Changes the vendor client, cookies, browser headers and network path, and adds a backend. It does not establish native browser parity. |
| CDP/extension response bridge | May observe independent evidence, but is unavailable to ordinary adopters and cannot supply runtime responses here. |
| Native executable, guessed final URL, executed vendor response, synthetic 200 | Changes or bypasses the selected SDK-free, response-driven model. Not selected. |

## Recommended Decision

Add a **private, default-off Google-only browser-operation branch** in the
standalone experimental adapter/mapper path. This is a narrow exception to
ADR-0043's prototype redirect rejection for that branch. It does not supersede
all of ADR-0043, amend ADR-0017, alter frozen descriptors/seams/core, replace
shared-host manual results, or change existing default/manual/production Google
and Meta paths.

### Execution and authority

The trusted first-party mapper worker retains command/configuration state,
constructs the real five-field primary and parses only genuinely readable,
bounded response data with the existing parser. The host owns the worker/port,
private envelopes and operation ledger. Bind instance, epoch, command,
operation and parent IDs, finite deadlines and declared branch order.
Malformed, duplicate, foreign, stale or contradictory messages fail visibly.

Immediately before each newly authored browser call, the host checks current
consent, current purpose permissions for **every** potential recipient,
exact initial destination/method, owned identity/epoch and remaining deadline.
After asynchronous waits it checks again. No asynchronous transport-worker
handoff or untrusted callback may intervene between that final check and the
browser API invocation. One active command and one outstanding branch per
instance, bounded queues/bytes/resources and init/command/transport deadlines
remain structural requirements. Numeric performance qualification stays open.

Use an actual fixed static same-origin document URL. The document is empty
and script-free. Its enforcing **response** CSP denies scripts, workers,
child frames and objects; `connect-src` admits only the pinned recipient
origins, without wildcard or general self. The parent frame policy must admit
the fixed asset. Pin the trusted hosting bytes/policy, retain exact Window and
document identity, and capture Fetch/Request built-ins from that document's
own realm. Invoke with an approved URL/plain init or that realm's Request,
never an unchecked cross-realm Request.

An unready, detached, navigated, replaced or policy-invalid realm retires
the capability and aborts owned operations. This is not about:blank, srcdoc,
report-only CSP or a late meta policy. Hosting the fixed asset with the
required response policy is an adoption requirement. Static hosting that
cannot serve that policy is unsupported by this path. No backend/account,
system trust or network configuration change is selected.

### The two authored operations

1. The primary is redirect-rejecting and response-readable. Same-origin access
   or actual vendor CORS must expose the required event/data bytes. An opaque,
   missing, malformed or oversized primary stops before the secondary.
   Do not switch required data to no-CORS, synthesize fields, infer URLs or
   execute the offered fallback.
2. The worker authors the secondary from the parsed response. The host issues
   its approved bodyless POST with browser-managed redirects. The browser
   owns the real 302 and final GET. There is **no** separately authored final GET.
   A response-independent secondary may use a case-pinned compatible
   no-CORS mode with safelisted headers. Required unreadable data still stops.

Credentials are **omit** for local construction. Neither acceptance nor an
opaque result grants cookies, credentials, real identity or vendor traffic.
No application retry, fallback, restart or replay is added.

### Settlement and enforcement limits

Private outcomes distinguish `readable`, `opaque`, `rejected`, `aborted` and
`timed-out`, with only actually observed fields. A readable result exposes only
the browser's final response, not a complete hidden chain. An opaque result
means **operation settled, HTTP outcome unknown**. Never invent status 200,
headers/body, HTTP success, native compatibility or product receipt.
The runtime ledger counts `authoredOperations`; independent receivers and
recordings count observed physical requests. Observations must never become
privileged runtime response providers.

Production ceilings pin supported HTTPS host/port origins. Local HTTP
construction accounts for CSP's insecure-to-secure scheme/port upgrade rules.
The accepted redirect ceiling admits **any** redirected path, query, account
or label within its origins. CSP path expressions do not restore redirected
path confinement. It cannot enforce hidden-hop methods, origin order, an exact
physical request count or a per-hop live-consent checkpoint.

Revocation, permission loss, worker loss and disposal immediately invalidate the
epoch, deny future authored calls, abort pending work best effort and discard
late responses. Later grant cannot revive/replay it. Abort cannot recall bytes,
undo server processing or guarantee zero later arrivals. Browser redirects,
preflights and network handling are not one-for-one with authored operations.

If a case needs exact hidden paths, live checks at every physical hop or a hard
physical attempt budget, this branch does not support it. Existing modes retain
their prior guarantees rather than silently adopting these limits.

## Assumptions

- **A1, high risk, not yet browser-proved:** invoking captured own-realm Fetch
  uses the transport document's CSP rather than the parent page's broader
  connection policy. Actual browser positive and disallowed-recipient redirect
  controls must demonstrate this before claiming enforcement.
- **A2, adoption prerequisite:** the trusted static host serves the pinned
  document bytes and enforcing response policy consistently. A separate
  verification fetch alone cannot prove a particular navigation's response;
  document identity and independent actual-loaded-response evidence are needed
  for local qualification. Compromised trusted hosting/parent/mapper is outside
  ADR-0043's trusted-boundary guarantee.
- **A3, unresolved native fact:** actual Google primary CORS exposes all
  required bytes under the selected ordinary-browser mode. Local synthetic
  CORS cannot establish this. Opacity blocks the real conversion before any
  secondary.

## Kill criteria

- The actual realm-CSP negative control fails. Stop this browser path without
  broadening the recipient policy or replacing the runtime transport with a
  privileged observer.
- The required primary is not readable, or the static host cannot serve the
  pinned enforcing response policy. That case is unsupported by this path.
- A future case requires per-hidden-hop authority or a hard physical-send
  budget. Keep it unsupported instead of claiming these accepted limits meet it.

## Consequences

The existing 059 plan/tasks own one finite local construction packet under
059-01. The old three-authored-dispatch/manual 302 packet remains historical.
This branch's revised criteria explicitly disposition its redirect ownership,
path/method authority, hidden-hop consent, physical accounting and opaque
settlement. Full 059-01 stays READY_FOR_REVIEW/non-clearing; 059-15 stays
IN_PROGRESS. Completed 059-20/21 and Accepted records remain unchanged.

Before any browser acquisition, review exact source, installed browser,
finite owned handles/stop and existing Seatbelt/request/WebSocket/receiver
preflight gates. Stop at a failed no-external prerequisite. No new safety
framework, repeated launcher investigation or automatic Chrome launch in tests.
Actual local proof needs the ordinary page, real mapper module worker and
iframe-realm Fetch, independent GET 200 / POST 302 / GET 200 receipts with two authored
operations, readable final-response barrier, separate opaque secondary and
unreadable-primary stop. Negative controls cover disallowed origins, permitted
unexpected paths, 307/extra hops without false guarantees, consent/permission
change, realm/worker loss, deadlines, disposal and honest cleanup.

Direct browser dispatch avoids substituting a server's cookie jar/network path,
but proves no cookie, source-IP, client-context, header, CORS or performance
parity. Native first-party cookie continuity, complete initialization,
secondary/final bytes, callback behavior, calibrated performance and Google
product receipt remain open. No full-conversion or deployability claim follows.

## Open questions

The iframe-realm browser proof, real primary CORS, native cookie/client-context
semantics, complete response bytes and calibrated performance remain evidence
gates. They do not reopen the owner's bounded redirect tradeoff or grant a
live case. The finite local packet records its actual outcomes in the existing
059 plan and reviews.

## References

- [Fetch response filtering](https://fetch.spec.whatwg.org/#concept-filtered-response-opaque-redirect)
- [Fetch method and Request construction](https://fetch.spec.whatwg.org/#fetch-method)
- [HTTP redirect Fetch](https://fetch.spec.whatwg.org/#http-redirect-fetch)
- [CSP request matching](https://www.w3.org/TR/CSP3/#match-request-to-source-list)
- [CSP redirected URL/path matching](https://www.w3.org/TR/CSP3/#match-url-to-source-expression)
- [Response types and opacity](https://developer.mozilla.org/en-US/docs/Web/API/Response/type)
- [Existing 059 plan](../specs/059-google-ads-full-compatibility/plan.md)
- [ADR-0043](adr-0043-google-meta-request-authority.md)
- [ADR-0017](adr-0017-airlock-1-0-api-contract.md)
