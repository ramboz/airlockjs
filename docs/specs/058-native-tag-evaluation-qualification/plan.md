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
  `155.0.8059.79` (executed `--version`). Record the actual launched browser
  version in the report; a changed build needs an explicit new qualification.
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
  `test/native-tag-qualification.test.js`, and a small operator guide if needed.
  Preserve Adobe files, `core/`, connectors, global oracle/config/approvals and
  the site. Reuse the existing recorder's finite-stop principles, not its
  intentionally Adobe-only routing/POST/JSON contract.
- TDD provides local feedback; the coordinator owns the final integrated
  validation receipt and required review/transition evidence. No full-suite,
  benchmark, deployment or live qualification belongs to this slice.
