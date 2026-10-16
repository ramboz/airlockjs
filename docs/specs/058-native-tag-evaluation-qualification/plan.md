# Plan - native tag evaluation qualification

Keep the first delivery local and operator-visible. Inspect prior art, review
the frame, then implement 058-01 with failing controls before code. Reuse safe
mechanisms where they fit; do not generalize the intentionally Adobe-specific
recorder or modify Adobe's evidence while building an advertising reference.

058-02 follows only after the exact no-send surface is qualified. Missing native
events stay blocked. 058-03 consumes an independently qualified reference, not
an empty trace or a comparator-generated expected payload.

The preparation grant is shared 25,000 AI credits and a four-active-hour
checkpoint, not unlimited per agent. No live sends, new runtime capabilities,
site changes or full vendor implementation are authorized. Credit observability
must be stated honestly; no hard cap is claimed merely because it is written.

## 058-01 bounded implementation contract

- Entry: `node rig/native-tag-qualification.mjs --output-dir <new-private-dir>`.
  Importing the module is inert. Use existing Playwright and the installed
  Chrome channel, not a new downloaded browser or vendor runtime.
- Grounded local runtime on 2026-10-16: Node `v24.10.0`, Google Chrome
  `155.0.8059.79` at initial framing (executed `--version`). The shared host
  later updated to `155.0.8059.80`; the old pin correctly refused it before
  fixture execution. The current candidate explicitly targets `.80` and must
  rerun the complete controls. Retain `.79` receipts as their original cohort,
  not evidence for `.80` or any native-vendor reference. Other builds remain
  inconclusive until an explicit fresh qualification.
- The only accepted surface is `core-http`: fixed synthetic fetch GET/POST,
  image, XMLHttpRequest, beacon, redirect and response-linked fan-out cases.
  No arbitrary URL, script, vendor account or fixture input is accepted.
  Frames, dedicated workers, service workers, WebSockets and browser/background
  traffic are **not qualified**; requesting a broader surface is rejected
  before launch. This is not permission to run arbitrary native/customer code
  behind a merely HTTP-tested guard.
- Two independent layers remain active: an outer rule permits only this run's
  exact loopback origins; the tested inner rule permits/denies the tripwire.
  Positive and deliberately bypassed controls can allow the exact loopback
  tripwire but can never disable the outer no-external rule.
- Every claimed case has matched positive, enforced and bypassed-control legs.
  Actual tripwire arrivals, not a request callback alone, prove the positive
  and bypass controls. A generic successful transport cannot qualify another.
- Hard ceilings: 64 retained requests, 2,048 URL bytes, 64 KiB per request body,
  1 MiB per response body, 4 MiB aggregate retained body bytes, 5-second read
  settling and 60-second run wall limit. Fixed cases remain below these caps;
  reaching a cap is explicit `inconclusive`, never truncation plus success.
  These are fixture safety limits, not claimed native payload/performance bands.
- Reports use the overview's schema/state/exit contract. Add structured
  per-case positive/enforced/bypass counts, tested and unqualified surfaces,
  request/response completeness and a finite source/browser manifest. Original
  URLs/headers/query multimaps/bodies belong only in owner-only private files.
- Falsifiable controls: empty/dropped capture, unavailable or hung response read,
  altered body, guard bypass and broken positive tripwire. Each must prevent a
  `qualified` result for its affected criterion without enabling external egress.
- Keep code confined to `rig/native-tag-qualification.mjs`, targeted
  `rig/native-tag-qualification.test.mjs`, its explicit
  `vitest.native-qualification.config.js` and a small operator guide if needed.
  Real Chrome checks use that dedicated configuration, following the existing
  separate-oracle pattern; do not introduce a browser requirement into the
  default hermetic test suite or silently skip a missing-browser qualification.
  The default config excludes only this new browser-test path; existing test
  selection and the global oracle's thresholds/components remain unchanged.
  Preserve Adobe files, `core/`, connectors, global oracle/config/approvals and
  the site. Reuse the existing recorder's finite-stop principles, not its
  intentionally Adobe-only routing/POST/JSON contract.
- TDD provides local feedback; the coordinator owns the final integrated
  validation receipt and required review/transition evidence. No full-suite,
  benchmark, deployment or live qualification belongs to this slice.
- Compliance follow-up retains accepted response/terminal listeners during
  settlement, adds timing/abort and per-leg missing-branch controls, and keeps
  one absolute deadline active through cleanup/output. A loopback-only browser
  server gives a public, explicitly owned process handle for forced cleanup;
  it does not attach to existing browser profiles or qualify page WebSockets.
  Deadline fault probes use disclosed lower 10-second/1-second limits.
- Architecture follow-up starts that same clock/watchdog before acquiring the
  output directory. Acquisition timeout is distinguished from an unavailable
  input location; neither can start the fixture or mutate an existing directory.
  A late filesystem completion is quarantined before any further execution.

## Close-out checkpoint (2026-10-16)

The owner approved up to one additional active hour to finish the existing local
slice, within the same shared 25K preparation working ceiling. The prior
conservative outer checkpoint elapsed during the overnight pause; it is not
being silently reset into a new implementation or live-event phase. Exact
credit accounting remains unavailable.

The current runner's 28 fixed-fixture controls pass on Node24.10.0/Chrome
155.0.8059.80. The unchanged adjacent Adobe recorder suite passes all 133 cases
under Node22.16.0; its Node24 import-monkeypatch incompatibility is recorded in
the slice validation log without modifying the test. Compliance, craft,
architecture correction and reconciliation reviews have recorded passes.
Lifecycle transitions and local commits preserve those actual gates; they do
not qualify 058-02/03 or either vendor implementation spec, which remain open.
