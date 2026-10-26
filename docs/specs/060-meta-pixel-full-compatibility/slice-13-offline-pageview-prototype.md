---
status: DONE
dependencies: [adr-0017, adr-0033]
last_verified: 2026-10-26
kind: feature
frame_review: true
arch_review: true
---

## Slice 060-13 - Exercise an offline SDK-free PageView prototype

**Goal:** A developer runs first-party `fbq("init", ...)` and
`fbq("track", "PageView")` calls through a real serialized worker and governed
loopback dispatch, then sees exactly what the prototype does not reproduce.
This is staged construction, not customer support or a smaller parity target.

**DoR:**
- [x] ADR-0017's experimental standalone/event-payload seams and ADR-0033's
      complete-replacement target are read; no frozen interface changes.
- [x] Current legacy connector/worker and wrapped-host source are inspected.
- [x] The supplied historical redacted PageView fixture is local data only,
      not original native wire, complete responses or same-input identity proof.
- [x] The bounded prototype frame and reuse boundary are independently reviewed.

**Acceptance Criteria:**

1. An explicitly experimental, source-only standalone adapter exposes a
   synchronous, void-returning `fbq` capture function and a flush/report seam.
   Calls made before worker readiness retain capture order and value snapshots.
   The first supported sequence is init followed by explicit PageView; init
   itself never sends. Only synthetic test Pixel IDs are admitted in this
   prototype. Unsupported calls, malformed/uncloneable inputs, duplicate init
   and PageView-before-init have visible bounded outcomes, not silent success
   or assertions about native error behavior.
2. Command interpretation, retained Pixel state and GET construction occur
   in the first-party chamber via the unchanged connector-host interface.
   The only initial wire fields are `id`, `ev`, `dl`, `rl`, `if`, `sw`, `sh`,
   and `tz`, grounded in the supplied capture-derived fixture. Page context
   is explicitly captured as data; no vendor SDK, invented SDK version,
   identity, experiment flag, cookie encoding or remote configuration is added.
3. Reuse unchanged `createWrappedSdkHost` for serialized request/response
   mediation, endpoint ceiling and strict `ad_storage` consent enforcement.
   The trusted adapter additionally permits only the explicitly supplied
   `http://127.0.0.1:<port>/tr/` destination, GET without body, no credentials
   or redirects. No default vendor dispatch, proxy, cookie capability or
   native fallback exists. Denied/pending consent and off-ceiling requests
   produce zero sink arrivals and visible held/failed outcomes; later grant
   does not silently replay an earlier denied command.
   The worker awaits each correlated mediated response before posting that
   command's result. A status-zero response remains held/failed; host counters
   or `driveEvent` completion alone are not receiver evidence. Flush/report
   success requires the example's independently observed local arrivals.
4. A real Node worker-thread bridge runs the actual first-party chamber
   entry and structured-cloned messages against a real loopback receiver.
   This proves only Node execution/serialization/local receipt, not browser
   transport, a malicious-code sandbox or native C2/C3. Browser worker code
   applies the existing egress-confinement module before connector imports.
   A denied ambient-fetch attempt and two distinguishable PageViews must
   exercise actual worker code, not returned expected requests.
5. A local executable example and tests show positive, denied, queued,
   changed-page-context and unsupported-command behavior. All owned worker,
   server and socket handles close in `finally`; tests have finite deadlines.
   No Docker, browser launch, SDK execution, external network, production
   navigation, vendor event, old control replay or live authority is needed.
6. A report compares the union of generated query fields and every actual
   field present in the supplied fixture's selected beacon. Annotation keys
   are explicitly enumerated, not a generic underscore exclusion. Preserve
   field/value/type differences, structured/unavailable values and redaction
   limits; never normalize `fbp` into `_fbp`, erase fields or turn equal
   redaction sentinels into identity equivalence. Omitted experiment flags,
   missing original bytes/order, responses, browser/cookie effects and
   attribution remain explicit gaps. Overall compatibility is inconclusive,
   even if a supported literal field matches. Public output names fields
   and dispositions, not raw identity values.
7. Existing production boots, core modules, frozen contracts, build outputs,
   package/version and old source/evidence originals stay unchanged. This
   prototype is not selected by `bootMetaPixel` or deployed/published.
   Slice060-01 and its full native/whole-wire/live/performance DoR and C1-C9
   remain open; this slice cannot qualify or waive them.

**DoD:**
- [x] Executable first-party adapter/chamber and local example are implemented.
- [x] Positive and meaningful negative controls run, including actual worker/
      loopback execution, native absence and visible gaps.
- [x] Targeted tests/lint and frozen-contract/legacy regressions pass.
- [x] Independent compliance, craft, architecture and reconciliation pass.
- [x] Documentation, truthful support status and derived board are updated.

**Anti-horizontal-phasing check:** One runnable capture-to-worker-to-receiver
journey and its gap report; not another isolated parser or runner framework.

## Grounding and approach

- `core/connector-host.js:40-113` retains state and contains event failures.
- `core/wrapped-sdk-host.js:418-450,553-590` already mediates response data
  and serializes one in-flight drive; the adapter queues its own calls.
- `core/confine-pixel-chamber.js:29-33` is reusable first-import confinement.
- `test/fixtures/meta-tr-pageview.redacted.json` supplies the limited field
  vocabulary; its omitted flags/redactions are limitations, not exclusions.
- Keep the prototype in separately named connector/adapter source modules
  with a fixed first-party Node bridge and ordinary local tests/example.
  Do not extend `core/airlock.js`'s worker-selection tree or the production build.
  There is no retained native SDK or browser/custodian dependency.

## Assumptions

- Unverified until execution: the existing wrapped-host message protocol
  can serve this first-party connector without changing its frozen surface.
  A real-worker/local-receiver test must demonstrate this before closing.
- Native queue, callback, duplicate-init and error semantics are not
  established by these deliberate prototype rules; production equivalence
  remains060-01 work.

### Deviation log

Pre-code frame review passed. Its completion-order clarification requires
correlated transport settlement before worker result, rather than treating
the wrapped host's dispatch counter or result callback as receipt evidence.
Original full-compatibility criteria are not revised.

- Reused the existing mediated host without any frozen/core/build change.
  New first-party worker code, a source-only adapter, ordinary Node bridge,
  loopback example, gap reporter and focused tests are separate from production.
  The local GET encoding is bounded at8192 characters; context and queue
  limits are prototype rules, not native behavior or performance claims.
- Initial static compliance passed. Craft found three blockers: capture-hook
  disposal/reentrancy could strand/reorder commands; disposal errors were
  swallowed; example cleanup could skip later resources after an earlier failure.
  Five new regression cases failed before correction. A guarded final capture
  commit, visible retained cleanup rejection and independent aggregate cleanup
  fixed them; a fresh narrow correction review passed.
- A coverage nit led to controlled delivery of an actual stale callback after
  terminal timeout. This is distinct from real-worker stalled-receiver tests,
  not physical late-browser/process-loss evidence. Further assertions cover
  event-driven repeated cleanup rejection and sanitized aggregate/cause retention.
- Parent final validation:36 prototype tests plus133 selected unchanged
  host/contract/seam regressions pass,169 combined. The implementer's earlier
  28 new/168 old runs are different selectors/epochs, not additive coverage.
  Parent independently executed the corrected local example:2 distinct
  PageViews, pending0/denied0/grant-without-new-command0, actual worker thread
  and withheld ambient fetch. Each comparison contains20 selected reference
  fields and remains inconclusive. No browser, Docker, SDK or vendor ran.

### Reconciliation sweep

- updated - prototype guide,060 overview/plan/tasks and architecture distinguish
  actual offline construction from the twelve unfinished compatibility journeys.
  Usage and report describe the fixed synthetic/loopback-only source seam.
- updated - reviewed failures, causal regressions, separate static/actual
  evidence, cleanup-error behavior and full reference-field gap reporting.
- no-op - core, stable contracts, production EDS boots, build/package/version,
  accepted decisions, existing fixtures, original failed local-control evidence
  and every native/live permission or slot. This is not deployed or published.
- no-op -060-01 full DoR/C1-C9 and complete vendor scope; cookies/identity,
  SDK/configuration/whole wire/browser behavior, CWV and attribution stay open.
- no-op - existing inbox/refinement work is not closed by this prototype.
  The shipped legacy Pixel behavior and fixtures are preserved.
- updated - memory records response correlation versus independent receipt.
  No convention, glossary quota or hot-cache primer change is needed.
- updated - independent documentation reconciliation passed its bounded
  product-prototype scope; regenerate/check the board from lifecycle records.
