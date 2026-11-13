---
status: DONE
skill:
use_cases: [UC-5, UC-6, UC-7, UC-9]
---

> **Rescoped 2026-11-12 by spec 066 (Meta parity inventory).** The live Test Events readback becomes a live-only row checked at the release check. Slice 063-01 stays with its claim holder, who closes it. *Update 2026-11-13 (owner decision O10): 063-01 is closed as ABANDONED with the claim released, and the spec rolls up to DONE.* Slices 063-02 and 063-03 stay DONE.

# Spec 063: One Meta PageView delivery

> Local provisional reservation, 2026-11-04. No push or pull request.

## Overview

The worker can build a PageView, but its response so far has come from localhost.
We want one worker-generated PageView to appear in the existing dedicated
Pixel's Test Events view. A default-off allowance will bind one destination,
Pixel and controlled document. This keeps the change small, while leaving native
compatibility and attribution untested.

The owner approved the source plan through the plan approval control after
selecting no `_fbp` or other browser identifiers. Framing, source changes and
targeted SDK-free tests are permitted. A live send needs separate approval of
the reviewed source, explicit test consent and owner-operated readback.
No live grant exists at framing.

The baseline is clean `03e9a3a1b7054fb6e4676946da292b57ac7dbe4a` on the
deliberately inherited `meta-behavioral-poc` history. Completed 061/062 and their
receipts stay unchanged. Full 059/060, native acquisition and production
deployment remain outside this observational proof of concept (POC).

## Grounded starting point

- Both constructors require a literal localhost endpoint:
  `adapters/meta-pixel-prototype.js:285-286` and
  `connectors/meta-pixel/pageview-prototype.js:107-108`.
- The host dispatch separately checks its request envelope and uses omitted
  credentials, forbidden redirects and an abort signal
  (`adapters/meta-pixel-prototype.js:400-425`). It wires the existing strict
  consent seal and endpoint ceiling (`:707-718`).
- The ceiling deliberately drops query values. Existing tests demonstrate the
  localhost query-correlation gap (`core/endpoint-ceiling.js:12-19,45-50`;
  `test/meta-prototype-request-correlation.test.js:50-94`). The new live mode
  must not inherit unrestricted Pixel/event/query authority.
- The bridge already carries numeric status and `statusText`
  (`core/wrapped-sdk-host.js:448-467`). An opaque response has status zero and
  no readable body or headers. See
  [MDN Response.type](https://developer.mozilla.org/en-US/docs/Web/API/Response/type)
  and the [Fetch Standard](https://fetch.spec.whatwg.org/#concept-filtered-response-opaque).
- The existing fixture serves the module closure, and the old entry supplies
  granted consent automatically (`rig/meta-behavioral-poc.mjs:6-59`;
  `rig/meta-behavioral-page.js:3-19`). The new live entry must obtain explicit
  consent rather than use that old convenience function.
- R-015 records an unchanged dedicated Pixel and historical owner Test Events
  observation, not an authenticated read API or a correlated worker receipt
  (`docs/research/R-015-google-meta-first-journey-evidence.md:26-40,195-203`).

## Assumptions

The current unchanged Test Events Browser detail view has not been inspected
for source-URL/time visibility or this no-cookie worker path. The exact
readback control is a selected-Pixel Browser event detail exposing the
controlled document URL and event/receive time. Establish it with the owner
before requesting the live grant. If it requires a token, helper or account
change, stop and name that requirement rather than assume authority.

The approved minimal PageView may not be displayed by Meta. Missing receipt
will be reported as unobserved, with no second send or inferred rejection.

## Source-stage transport decision

An SDK-free actual-worker/browser check observed no request with the originally
proposed `no-cors` plus `redirect: "error"` options. The owner approved switching
to CORS mode while keeping redirects forbidden. A CORS response-access failure
may happen after transmission; it is not evidence that Meta rejected the event.
No live permission or other scope changed.

## Separate additional one-use decision

The original plan allowed one case with no automatic second send. After that
approved request dispatched and its receipt remained unobserved, the owner
cleared the Test Events list and requested another case. The separate explicit
choice "Approve one new send now" authorized exactly one fresh-marker attempt
under the same source, destination, Pixel, consent and no-cookie constraints.
This is a narrow exception to the original one-case execution budget, not reuse
of its spent grant or permission for application retries or a third send.

## Decomposition

One rules/path slice delivers the narrow adapter-to-worker-to-Meta operation
and owner-visible receipt. Source-only work cannot complete it. A separate
infrastructure spike, native reference run or generalized runner is unnecessary.

## Slices

- [063-01 - Deliver one consented test PageView](slice-01-once-pageview.md)
- [063-02 - Prepare one owned-site worker PageView](slice-02-owned-site-poc.md)
- [063-03 - One automatic owned-page PageView trial](slice-03-automatic-owned-pageview.md)

## Separate owned-site source integration

On 2026-11-04 the owner approved the small owned-site source plan, using
the site's existing test-consent state and explicit one-shot arming.
063-02 owns that reviewed source and staged asset increment. It does not
depend on a positive Test Events receipt, change 063-01's criteria or grant
deployment/live execution. Current delivery evidence is likely received,
not individually verified. Both earlier live grants are spent.

## Separate automatic page-load trial

The owner then requested a bounded automatic page-load trial and permitted
the existing public Pixel in site-owned configuration only. 063-03 owns that
new behavior, normal source gates, one controlled trial and final disable.
It preserves the manual path and does not amend either earlier slice,
add identities/events, or reopen the full-replacement programme.
