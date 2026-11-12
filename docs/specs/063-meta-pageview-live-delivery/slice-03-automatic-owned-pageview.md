---
status: DONE
dependencies: [063-02]
last_verified: 2026-11-05
kind: feature
frame_review: true
arch_review: true
---

## Slice 063-03 - One automatic owned-page PageView trial

**Goal:** The owned POC page can send one PageView automatically after its
actual test-consent signal, using site-owned configuration instead of an
operator arm call. The trial remains default-off and ends disabled.

The owner requested end-to-end execution on 2026-11-04 and explicitly allowed
reusing the existing already-public test Pixel in site-owned configuration.
That exception applies only to `adobe-rnd/aem-eds-airlock-poc`; no Pixel value
belongs in Airlock source, chat, logs or receipts. Existing site-test access
does not require repeated prompts. No new SDK, identity feature, event type
or full-replacement programme is authorized.

**DoR:**
- [x] Owner execution and site-only configuration exception recorded privately.
- [x] Airlock baseline `e3d3fce17fac42d84ed8a96e8ee52cb506294837`.
- [x] Site baseline `f2a7f213bdc1982a752b407290e1c373e5196504`.
- [x] 063-02 source and deployed positive/no-send observations available.
- [x] Fresh pinned Sol framing pass and normal readiness/claim.

**Acceptance Criteria:**

1. Reuse the existing `prepareOwnedPoc`/owned binding and actual module worker.
   Add a bounded automatic entry without changing old manual-call behavior,
   localhost binding, stable core/contracts, production build or other vendors.
   The existing exact `pageview-v1` document profile and `meta-pixel=off`
   gate remain. No global `fbq`/`_fbq`, native Meta SDK or new event/identity
   capability is installed.
2. Load one fixed same-origin JSON path,
   `/tools/airlock-meta/automatic-config.json`, only on eligible POC pages.
   No configurable importer/destination, redirect, credential, retry or poll.
   Bound the preparation deadline and JSON body size. HTTP, parse, shape,
   expiry and cleanup failures have fixed redacted diagnostics.
   The source-owned file starts and ends disabled.
3. Config is a closed plain-data record with `enabled`, `pixelId`,
   `documentURL`, `notBefore`, `notAfter`, `maxPageViewsPerDocument`.
   Require a boolean switch and literal budget 1. Snapshot values without
   invoking accessors or accepting unknown/prototype fields. Disabled config
   uses the existing site Pixel, empty document and zero window. Enabled
   config binds that same Pixel, one exact eligible document and a positive
   finite UTC epoch-millisecond window at most six minutes.
   Reject invalid, future/expired or mismatched active configuration without
   creating work. No silent success-shaped fallback.
4. Subscribe before the site's initial `consent.update`. Reuse the actual
   site signal, not an inferred grant from the URL. Initial pending may wait
   within the active window; denied consent terminates the automatic attempt
   without replay on regrant. After the first actual granted signal, spend
   the automatic attempt before invoking the existing arm function once.
   Repeated boot, signals, manual/automatic collision or failure cannot send
   twice in one document. Preserve in-flight revocation/abort and existing
   no-replay checks. No catch-up, keepalive, fallback or automatic retry.
5. Expose bounded redacted automatic state/outcome and cleanup. The live
   operator only opens the page and observes that state; it supplies no
   Pixel/config via injected script and performs no manual arm call.
   The page fetches the actual published site configuration.
   Missing consent/config or expiry cannot leave indefinite timers/listeners.
6. Preserve the exact eight query keys, fixed destination, GET/CORS,
   credentials omitted, redirects forbidden, no-referrer/no-store and
   existing three-second Fetch cap. Keep the worker-side mapping, host
   correlation, strict seal, immutable Pixel/document/window and pre-Fetch
   one-send spending. No cookies, browser identifiers, SDK flags or user data.
7. Witness SDK-free red/green checks for disabled/missing/malformed config,
   oversized/error/redirect config responses, active/future/expired windows,
   consent ordering, pending/denied/regrant, repeats/collisions, cleanup and
   response outcomes. Use actual serialized/package worker tests with all
   upstream vendor traffic intercepted. Normal test discovery must not
   require the external site checkout; configured qualification must exercise
   the real staged site bootstrap/consent path with zero skipped owning cases.
   Preserve old manual and vendor-isolation regressions.
8. The site change is limited to its bootstrap, new JSON configuration,
   staged entry, owning tests and README. Reuse the existing public Pixel
   through generated site configuration; no actual Pixel value in Airlock
   source/examples or test outputs. Keep head/consent policy, Adobe/Google
   bindings, manifests and SDK pins unchanged. Use the existing three-asset
   layout and scoped generated-file lint metadata.
9. Fresh explicitly pinned Sol compliance, craft and architecture review
   precede publication or live traffic; a fresh native Terra writer owns
   source implementation. Publish disabled first using non-force exact-ref
   checks, then verify decoded served code/config bytes. Activate one exact
   document/window, verify its actual served active bytes before the visit,
   and permit only one controlled operator visit and at most one
   allowed Meta request. Count/block any second attempt and never refund the
   budget. Record actual initial consent, module worker, browser resourceType,
   exact request policy, automatic outcome, response access and cleanup
   without logging private values.
10. Disable configuration after the attempt, including failure, and verify
    the published disabled bytes. Preserve private immutable approval,
    activation, attempt, response and disable records. Reconcile documents
    and fresh review before normal completion. No account UI/reporting gate
    or individual Meta receipt is required; historical receipt remains likely
    received, not individually verified. 063-01 and closed records are unchanged.

**Budget boundary:** source caps one send per document instance. The live
operator makes one visit and permits one Meta request, with an exact document
and at most six-minute active window. This static-site design does not add
or claim a global visitor counter or exclusion of unrelated visitors. No
generic ledger/keeper/isolation infrastructure is introduced. The final state
is disabled; broader rollout is outside the slice.

**DoD:**
- [x] Witnessed red/green, targeted regressions and source lint.
- [x] Fresh pinned Sol source compliance, craft and architecture recorded.
- [x] Default-off publication and exact served-byte readback.
- [x] One automatic owned-page trial observed; configuration disabled afterward.
- [x] Honest deviation/sweep and fresh reconciliation; local records committed.

## Grounding

`adapters/meta-pixel-owned-poc.js:17-84` already prepares actual consent,
spends an attempt before adapter creation and returns a redacted arm outcome.
`connectors/meta-pixel/pageview-prototype.js:31-55` validates the owned
binding; the host dispatch keeps its consent/window and pre-Fetch budget checks.
At site baseline, `scripts/scripts.js:211-234` prepares the entry before
eager/lazy/delayed loading. `scripts/consent-check.js:16-46` emits the initial
test state during delayed loading. Head native Meta suppression is independent
and its existing binding matches the reserved Pixel.

## Assumptions

The new fixed JSON file will be served with the required content type and
reviewed decoded bytes on the existing code-sync path. Verify this after a
disabled publication, before activation. Config propagation may lag a push;
bounded asset reads do not authorize a repeated page visit or Meta send.

### Deviation log

Source checkpoint, not full reconciliation: Airlock source is
`8133417cb7ce4f7d836ae902f0e1f65ed8343b5c`; isolated disabled site source
is `bd532191d2c75e125dbe5a15b29dc7b69a369b8b`.
The interruption left uncommitted source and test logs, with no publication.
A fresh explicitly pinned native Terra context preserved and completed that
work. The published site baseline remained `f2a7f21`; its automatic JSON was
404 at recovery, so no automatic trial was resumed or repeated.

The coordinator independently ran all 247 configured targeted cases across
13 files, with zero skips, plus all 65 site checks. Actual site lint has the
same 12 errors and one warning as its baseline. All eight frozen site
surfaces are unchanged. Source red witnesses cover missing implementation
and site bootstrap/config; the original browser RED was an infrastructure
timeout, not a behavioral red witness. Fresh Sol compliance passes source
AC1-8 and remains needs-changes solely for unperformed operational AC9/10.
Fresh Sol craft and architecture pass. Craft N1, deterministic clock
hardening for one 150ms expiry test, is deferred as nonblocking test polish.

The automatic entry cleans its terminal resources. The old manual surface
and its listeners remain until manual arm or page exit; this preserves old
manual behavior and in-flight revocation. No global visitor counter is
introduced or claimed.

### Observed automatic trial

After source review, the coordinator published disabled site source
`bd532191d2c75e125dbe5a15b29dc7b69a369b8b` from unchanged `f2a7f21`.
All five code/config files matched decoded source bytes on preview and live
before activation. The initial propagation mismatches were bounded file
readbacks, not page visits or measurement retries.

Activation `f434971dba4dfc169642d9378c96ac8c6d92640e` bound one exact
document and a six-minute window. Both origins' active bytes were verified
before the single headed Chromium `151.0.7922.34` visit. The operator
neither injected the Pixel/config nor called the manual arm surface.
The actual page signal was granted; native Meta globals were absent.
One module worker and one GET/fetch request with the exact eight keys were
observed at `2026-11-05T14:58:51.221Z`. Cookie header was absent.
No blocked Meta attempt, Meta SDK request or retry occurred.
All five browser-loaded code/config hashes matched the active reviewed state.
The automatic state completed with HTTP 200; browser headers also showed 200.

The browser reported `net::ERR_ABORTED`, and body collection was not
performed. Source cancels its body; the flag's cause and a per-event product
receipt are not proven. Receipt remains likely received, not individually
verified. This does not close 063-01.

Ordinary context/browser cleanup reported no failure. The operator's final
disable commit `c2af5f8c66620c9ba9881796f70b9364f6e75108` restored the
original disabled JSON bytes and was verified on both preview/live.
The case budget is spent. The private hash-bound summary is
`meta-auto-trial-summary.json`, SHA-256
`3ba369222b8ebd76f52c930aff4c5bca0f062f0506095d8f0587e63fe7f15e78`.
The original result SHA-256 is
`c4663e643de1c60e12e75522082021fc775bc23ed70ac964452ce2e0ab04f53c`.
Fresh pinned Sol full observed-evidence compliance passes; reconciliation
retains its own gate.

The first reconciliation pass caught a stale source-checkpoint paragraph in
the guide that still listed completed operational steps as outstanding.
It was corrected to reference the recorded trial/final disable and the
owning lifecycle. A fresh narrow Sol reconciliation correction passes.
No source or live trial was repeated to resolve that documentary finding.

### Reconciliation sweep

- Updated: owning guide, spec overview, plan/tasks and work-plan handoff
  reflect automatic page-load behavior, site-only public binding exception,
  source gates, one trial and final disabled state.
- No-op: 063-01/02 and their original criteria/evidence. No closed record,
  private original, timing qualification or spent grant was rewritten.
- No-op: stable core/contracts, production EDS boot/build/distributions,
  dependency manifests, accepted decisions and SDK pins.
  The finite source diff and eight frozen site hashes preserve this scope.
  Adobe/Google behavior and the site consent policy remain unchanged.
- No-op: inbox, vocabulary and conventions. No new domain term or
  contributor-wide rule was introduced; optional clock-test N1 stays here
  rather than becoming unrelated programme work. Memory consolidation
  finds no new durable item outside these owning records.
- No-op: full 059/060 and native acquisition remain paused.
  This is one controlled automatic PageView, not full compatibility,
  attribution or a granular product receipt.
- Leanness: one fixed config file and automatic consumer of the existing
  latch/worker. No new global visitor counter, generic runner, ledger,
  keeper, isolation service or automatic successor.
- Routing: the user-directed `meta-pixel-chamber` consolidation received
  the reviewed source checkpoint. This existing wave finishes here; future
  fresh Meta source work starts from that shared branch. No Airlock main
  merge/push or competing consolidation was performed.

### Close-out (post-DONE)

- [x] Regenerate/check board and record final disabled state.
