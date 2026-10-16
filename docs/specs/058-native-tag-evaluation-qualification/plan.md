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

## 058-02 offline pass (2026-10-16)

The owner approved up to two additional active hours for retained-input native
reference qualification, within the same shared 25K target, without new live
sends/deployments/account changes. Start is 15:29:46Z; conservative outer stop
is 17:29:46Z. Exact credit metering remains unavailable. Record partial blockers
instead of inventing missing native bytes.

The first bounded profile is saved Meta PageView on the actual headed Chrome
155.0.8059.80 cohort, with an all-fulfill/abort request-stage boundary and
unsupported-surface denial. Do not spoof browser evidence or disable native
BotBlocking to make headless green. Preliminary offline diagnostics preserve
one headed PageView attempt and the headless no-beacon as distinct outcomes.
Google requires actual retained loader/configuration/dependency bytes; current
response metadata alone cannot establish that closure.

### First profile implementation perimeter

- New `rig/native-tag-reference.mjs`, a fixed macOS Chrome-launch wrapper,
  its shared `rig/offline-reference-network.sb` policy,
  `rig/native-tag-reference.test.mjs` and a small operator guide. Include the
  new browser test only in the explicit native-qualification config and exclude
  its exact path from default collection; no other test/oracle/grant changes.
- CLI accepts only an explicit private input-manifest path and a new private
  output directory, with fixed `meta-pageview` baseline/disabled/native-revoked/
  value-contrast
  cases. No URL-supplied IDs, arbitrary commands/scripts or remote acquisition.
  Runtime/config files, source request URLs/status/digests and the owned document/
  Pixel selector come from that supplied manifest, never directory discovery.
- Only exact source-provenance resource URLs may be locally fulfilled. The
  synthetic document/bootstrap is explicitly generated fixture provenance, not
  a captured production page. Native script/config bytes remain unmodified.
  All other requests are captured then aborted; unknown dependencies and
  forbidden CSP surfaces are inconclusive.
- Enforce process-local IP-network/DNS denial before stock code, alongside
  request-stage all-fulfill/abort interception. A matched independent local
  receiver proves confinement without a vendor request. Never fall back to
  unconfined native execution when sandbox launch fails.
  The same policy additionally denies both canonical mDNSResponder socket
  aliases and its named Mach lookup; a matched zero-query Unix-connection
  helper must prove normal connection versus confined EPERM/EACCES before
  native code. HTTP receiver silence alone is not DNS qualification.
- A 60-second run cutoff covers acquisition, execution, owned-browser cleanup
  and private output. Use 5-second observation per case, at most64 requests,
  2KiB URL, 64KiB request body and 2MiB per supplied native resource. These
  are profile safety limits, not vendor performance bands. 058-01 principles
  are prior art, not inherited broad native-transport qualification.
- Public JSON keeps `native_attempt`, profile/mode/runtime/config hashes,
  source-versus-generated-fixture distinctions, positive/disabled/changed-input
  results and explicit error/limit states. No selectors/cookies/raw URLs/user
  values are printed. Original fields/responses stay in owner-only captures.
- Missing Google loader/config bytes remain blocked. A Meta profile pass never
  closes Google's input/evidence gaps or full vendor compatibility.
- Native consent-revoked observation is now a linked control: exact stock
  revoke-before-init holds the native init/track queue and suppresses config/
  measurement. A mutation removing that actual call must fail the negative
  marker. Other consent states and transitions remain unqualified.

### Offline pass outcome

The exact retained Meta headed profile now captures PageView attempts and linked
disabled/revoked/value controls without vendor dispatch. Its independently
witnessed process/known-resolver/HTTP boundaries, 63 combined explicit controls
and all required reviews are recorded in 058-02. The retained headless no-beacon
remains a genuine negative, not a reason to spoof browser evidence.

Google stays blocked: the saved capture lacks the official loader,
configuration/dependency bytes and complete auxiliary outcomes. No grant in this
pass permits reacquisition, download or resend. Shared comparison work 058-03,
the full vendor matrices, actual chamber/outcome proof and unattended readiness
remain future work. This outcome is within the approved two-hour preparation
pass; it does not reset the shared 25K target or claim exact cost metering.

## 058-04 Google source/offline pass (2026-10-16)

The owner explicitly selected "Approve read-only downloads and offline
qualification (Recommended)" for up to one active hour within the existing
shared preparation target. Start is 17:01:45Z; the conservative outer stop is
17:57:38Z. There is no reliable aggregate credit meter and no new allocation.

Google's owning session acquires only inert owned official script/configuration
resources and private provenance; the coordinator owns the fixed offline
profile. This is a new pinned source cohort. Historical missing runtime and
measurement responses, blocked auxiliaries and incomplete fan-out remain
unchanged. Measurement dispatch, site/account changes and full implementation
remain unauthorized. Source acquisition and native execution are separate:
every actual native execution retains the qualified process/resolver/HTTP
boundary, with all resources locally fulfilled or aborted before dispatch.

Add one vertical profile to the existing runner rather than copying the
containment implementation. Require actual owned primary conversion and
distinct-value relationships, preserve the existing Meta profile, and record
unknown browser/dependency behavior as inconclusive. Consent transitions and
measurement-response fan-out are not qualified by this pre-response profile.
No 058-03 comparison or vendor implementation phase starts automatically.

The initial guarded Google diagnostic captured owned primary conversions but
remained inconclusive on uncatalogued auxiliary attempts. These include a
measurement-response Script, not a newly authorized executable dependency.
Static source/ownership classification must precede a narrow auxiliary catalog;
all such requests remain aborted and retained. Interception can affect fallback
attempts, so this receipt is not an uninterrupted native response chain.
