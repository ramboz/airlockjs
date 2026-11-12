---
status: IN_PROGRESS
dependencies: [062-01]
last_verified:
kind: feature
frame_review: true
arch_review: true
claimed_by: meta-live-delivery
---

## Slice 063-01 - Deliver one consented test PageView

**Goal:** The owner sees one actual-worker PageView in the existing dedicated
Pixel's Test Events view, correlated to one controlled document and send window.

**DoR:**
- [x] Owner approved framing, source changes and targeted SDK-free checks.
- [x] Owner selected no `_fbp` or other browser identifiers.
- [x] Clean assigned baseline, closed 061/062 and current boards inspected.
- [x] Fresh explicitly pinned Sol framing review passes.
- Live readiness is a later gate: reviewed source, current URL/time Test Events
  readback and a new explicit one-send/consent grant. It is not source authority.

**Acceptance Criteria:**

1. Default behavior remains localhost-only. A separate default-off live binding
   admits only `https://www.facebook.com/tr/`, one private Pixel and one
   controlled local document. Both adapter and worker connector validate the
   binding; no arbitrary URL, wildcard, other event/Pixel or incompatible
   experimental feature widens it. Core/contracts and production boot stay
   unchanged.
2. The real serialized worker owns event mapping. Live host dispatch requires
   its active plain PageView command, exact Pixel/document and exactly one of
   each query key `id`, `ev`, `dl`, `rl`, `if`, `sw`, `sh`, `tz`. Reject unknown
   or duplicate keys, alternate destination/path/port, URL credentials,
   fragments, normalization tricks, headers and bodies. Use a top-level
   `http://127.0.0.1:<port>/meta-delivery/<one-use-marker>` document, empty
   referrer and bounded existing screen/timezone captures. No persistent
   identity, cookie access, click IDs, user data or SDK metadata.
3. Keep the existing endpoint ceiling and strict `ad_storage` seal. Consent
   starts ungranted; missing/pending/denied gives zero sends. Capture consent
   generation even with cookie mode off, recheck before Fetch and invalidate
   a command across revoke/regrant. Revocation aborts in-flight Fetch where
   possible without claiming to undo prior transmission. Held work never
   replays.
4. Permit at most one application Fetch invocation and one helper-observed
   allowed event request. Spend the allowance before invoking Fetch, regardless
   of result. GET only, `mode: "cors"`, `credentials: "omit"`,
   `redirect: "error"`, `referrerPolicy: "no-referrer"`, `cache: "no-store"`,
   bounded abort signal. No application retry, fallback, keepalive or second
   send. Browser-controlled IP/metadata disclosure remains explicit.
5. Report JavaScript response access honestly. CORS can reject response access
   after a GET was sent; Fetch failure must remain separate from browser-observed
   request/HTTP status and does not prove Meta rejection. Readable CORS responses
   carry their actual status. If an opaque response is encountered, report
   `response-unavailable`, status zero and unavailable body/headers rather than
   fabricate HTTP success. Preserve distinct hold/error/abort/timeout outcomes.
6. Supply one default-off SDK-free live entry using existing fixture resources,
   actual adapter and module worker, explicit consent and a fresh nonpersistent
   headed Chromium context with service workers blocked. Allow only the
   document/module resources and single approved event; abort other page
   requests. No native runtime, authenticated profile or account mutation.
   Launch is bounded to 10 seconds, event phase to 15 seconds, Fetch to
   3 seconds, ordinary cleanup to 10 seconds and the full operation to
   6 minutes. Await attempted adapter/context/browser/fixture cleanup and
   report failures, not physical containment or hidden-retry assurance.
7. Before a live attempt, obtain separate owner approval bound to the reviewed
   source, installed browser, existing private Pixel, document marker, UTC
   window and explicit granted test consent. The owner first establishes the
   selected Pixel's unchanged Browser Test Events detail view exposes URL/time,
   with a redacted before-view. No assumed API, credential or account-setting
   change. Missing view, token, helper or permission is a named stop condition.
8. After at most one approved send, the owner observes for at most 5 minutes
   from dispatch and confirms the new PageView's exact marker-bearing source
   URL and time relationship. Preserve private redacted before/after evidence
   and owner confirmation, source/browser/counts/consent/transport/cleanup
   provenance in new exclusive mode-0600 output. Never log/commit the Pixel,
   raw URLs/payloads, credentials or identities. Label it owner-confirmed UI,
   not API-verified. Absent correlation is unobserved; unreadable UI is
   readback unavailable. Neither implies rejection or satisfies receipt.
9. Preserve closed records, private originals, full 059/060, accepted decisions
   and native/SDK acquisition pause. Update only the directly related guide,
   new slice and work-plan handoff. No production deployment, attribution/full
   parity claim, broader runner or automatic successor. A source-only result
   remains incomplete for this slice's receipt criterion.

**DoD:**
- [x] Witnessed SDK-free red/green policy, consent, budget and response tests.
- [x] Actual SDK-free worker/browser with intercepted response covers the path.
- [x] Targeted regression selectors, changed-file ESLint and diff check pass.
- [ ] Fresh pinned Sol compliance, craft and required architecture passes.
- [ ] Separate one-send grant and correlated owner UI receipt are recorded.
- [ ] Deviation log, sweep and fresh pinned Sol reconciliation pass.

## Assumptions

The current Test Events Browser detail view and minimal no-cookie event receipt
remain unobserved. Establish URL/time readback before live approval, and keep
receipt unobserved if the bounded attempt does not appear. No retries follow.

## Owner-approved transport correction

The first SDK-free actual-browser check observed a worker but no event request:
Chromium refuses `no-cors` combined with `redirect: "error"` before dispatch.
The owner selected "Use CORS mode, keep redirects forbidden (Recommended)".
This changes source AC4 to CORS mode without widening destinations, credentials,
send budget or live authority. SDK-free browser checks must distinguish a
readable CORS response from one sent GET whose response access is denied.

**Anti-horizontal-phasing check:** The slice includes the actual worker send
and an owner-visible receipt, not just endpoint configuration.

### Deviation log

Not reconciled. At the source-only checkpoint, source work was approved and
live execution was not. The later separate execution decisions are recorded
below; neither grants further execution.

- Chromium rejected the original no-CORS/forbidden-redirect combination before
  dispatch. The owner approved CORS mode with redirects still forbidden.
- Live responses do not need body/header collection for this delivery goal.
  Their known HTTP status is preserved independently of bounded body cleanup;
  body/headers are explicitly not collected or unavailable.
- The helper checks its own imported worktree's commit and executable/manifests
  changes, not the caller's working directory. Documentation-only changes remain
  allowed. These two source-review corrections have witnessed regressions.
- The initial app-created Terra session returned idle without source work and
  was told to stop. Fresh native Terra contexts implemented source with exclusive
  file ownership in this worktree. The Sol coordinator did not implement runtime
  source. Every required reviewer was explicitly pinned Sol.
- The final review rerecord initially reused prompts after the helper had
  consumed their candidate sidecars. That produced `not-shown`/`none` metadata,
  inconsistent with the richer-skill attribution. A fresh normal candidate,
  prompt and Sol rubric pass corrects the provenance; metadata is not hand-edited.
  The new craft pass records optional N1: replace timed negative-only forged
  request assertions with an explicit rejection acknowledgement. It is deferred
  as nonblocking test polish, without changing this reviewed runtime snapshot.

## Source-only handoff (before live approval)

Runtime source is `e522032c62421c09ba31ab5f564f15383c10d35f`, following
`44b1ba7` and `879fdb9`. The seven targeted files pass 173 tests. The
coordinator independently ran all 46 new tests, changed-file ESLint and diff
check. Actual Chromium/module-worker cases fulfill Meta requests locally:
readable CORS, rejected response access and a forbidden redirect each observe
one initial request without retry or redirect-target request. In the denied
case, the synthetic fulfilled 204 is separate from unavailable browser status.

Fresh Sol craft and architecture pass. Full compliance remains needs-changes
only for unperformed AC7/8, with no remaining source blocker. No live grant,
owner URL/time readiness or Test Events receipt exists. Do not advance to
REVIEWED, reconcile the full slice or claim delivery from this source handoff.

## Owner readback preparation

After that source checkpoint, the owner supplied the current Test Events
individual-event view. It shows a Browser PageView with URL and receive time.
The screenshot is from their existing site test, not this worker or a newly
commissioned native reference. A private copy preserves the visible fields
without transcribing identifiers into source.

URL/time readback visibility is now established. The new worker event is still
unobserved, and a separate one-send/granted-consent approval remains absent.
The server/API panel and its test code are not used. No account setting changed.

## Approved live observations, receipt unobserved

The owner then selected "Approve this one send now" for clean `b3a7a83`,
runtime source `e522032`, headed Chromium `151.0.7922.34`, the existing Pixel,
granted test consent, no cookies/identifiers, forbidden redirects and no retry.
One actual module-worker GET/fetch PageView dispatched at
`2026-11-04T21:51:18.942Z`. JavaScript and browser response headers each showed
HTTP 200. One event request was observed, with the exact eight permitted keys,
zero denied page requests and no reported ordinary cleanup failure.

The owner cleared the previous Test Events list and requested another attempt.
The first grant remained spent and its receipt stayed unobserved. After the
separate explicit choice "Approve one new send now", a fresh-marker case ran
once on the same unchanged source/settings. It dispatched at
`2026-11-04T21:55:48.434Z`, again with one actual-worker GET/fetch PageView,
HTTP 200 in JavaScript/browser, zero denied requests and no reported cleanup
failure. This was a new case and grant, not reuse or an application retry.

The recorder also flags each event request as failed and its response body as
unavailable. The live source deliberately cancels body collection; the report
preserves these flags rather than claiming complete response-body success or
proving their cause. Header status, body availability and product receipt stay
separate.

The owner selected "No matching event appeared in that window" for the second
case, but that negative was recorded at `21:59:21.481Z`, 86.953 seconds before
the proposed `22:00:48.434Z` endpoint. The original does not corroborate a full
five-minute negative. A separate hash-bound timing qualification preserves the
original and classifies this as an early negative or unresolved timing.
Neither document has a correlated Test Events receipt. Both grants are spent.
Result: **unobserved**, not delivered, rejected or full parity. No third send
is authorized.

The owner asked about `test_event_code`. It was not included in the approved
browser request. The screenshot presents a code under server/GraphAPI testing;
its applicability to this minimal browser path was not established. No code,
credential, SDK flag or extra query field was copied into the request.
Clarifying the supported Browser Test Events association is a remaining
integration question, not an automatic research or execution successor.

Private originals include separate exclusive mode-0600 approvals, dispatch,
completion and observation-closure files for each case. The first dispatch
SHA-256 is `ab2112f1093862bb9d917a4ad697f4a467852d8a05fdc078551de061e1360fd3`;
the second is `4faa294f05bbe3556e3b6b96f457a233daf3dfa283f5e6d97f609e1ff07d4895`.
The private two-case redacted summary preserves the remaining hashes,
source/browser, counts, flags and owner decisions without Pixel or payload values.
The original second observation is unchanged; its timing qualification SHA-256
is `a13af107094ceacccc8a94fa7341b571eb7f1b1b79b86893d1993d967b71fe54`.
The separate qualified summary includes that supplement without overwriting
the earlier aggregate.

One later readback-only check was offered outside the original window. The
owner could see aggregate activity, reporting four events today and the last
activity about 20 minutes earlier, but could not see the controlled-document
details. This is owner-reported unattributed activity, not a correlated worker
receipt or a full-window negative. No request, tracked-site load, setting change
or source execution accompanied that late check.

The private late-readback SHA-256 is
`ad1142e4f790e265281ab0a28fccefdd427f12a42ee0d815d36769eff84046b9`.
The final redacted result SHA-256 is
`67adccf6630caed7c1ded807165f61341f2bef572518ca69decdb4c822822f05`.
All previously hashed case originals remain unchanged. AC8 is still unmet;
no full REVIEWED, RECONCILED or DONE transition is claimed.

### Reconciliation sweep

Source and operational handoff are recorded; full reconciliation is blocked by
AC8's unobserved receipt and the normal REVIEWED gate. Source/worker/fixture
remain unchanged after `e522032`; guide, work plan and private evidence are
updated. Closed 061/062, full 059/060, accepted decisions, production boot,
contracts and SDK pins are unchanged. No account configuration or server API
was used. No further execution is commissioned.

### Close-out (post-DONE)

- [ ] Regenerate and check the derived board.
- [ ] Check primer/memory/inbox hygiene without rewriting closed records.
