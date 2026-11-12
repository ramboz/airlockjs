# 051-09 focused chamber journey — source implementation witness

Scope: [slice09](slice-09-focused-chamber-journey.md), owner priority
2026-10-26T15:28:33.302Z. Status confirmed READY_FOR_IMPLEMENTATION before edits;
standard helper claimed only051-09 IN_PROGRESS. Frame critique is passing.
This witness is implementation evidence, **not an independent review verdict**.
No REVIEWED/DONE transition or review checkbox was applied.

**Historical epoch:** the native routing refusal recorded below is superseded
for the opt-in profile by the owner's separate2026-10-26T21:59:57.102Z grant
and [routing implementation](slice-09-routing-implementation-witness.md).
The routing delta subsequently passed fresh scoped compliance/craft/architecture;
prior reviews alone were not a verdict on its changed bytes. The parent
independently observed188 controlled tests passing. AC6/7 remain unexecuted.

**Prior parent checkpoint:** the production source epoch passed compliance,
craft and architecture, with139 controlled tests after the two corrections.
The later offline live-plan check adds three guard controls (142 total) and
identifies a native routing-readiness gap; production authority is unchanged.
The official reviews cover source preparation only. Actual AC6/7 remain
unexecuted, the slice stays IN_PROGRESS, and no live admission follows.

## Delivered source boundary

- `probes/adobe-compatibility/chamber-journey-contract.mjs`: closed literal
  protocol, exact config/fields and descriptor-only bounded JSON copying,
  stock synthetic HTML qualification and original native proposition identity.
- `probes/adobe-compatibility/chamber-journey-worker.mjs`: ordered retained-SDK
  handler; only configure/setConsent/sendEvent, fixed fetch/page/custom/interact
  roles plus correlated host-render acknowledgement and cancellation.
- `connectors/alloy/alloy-chamber.worker.js`: explicit probe selection after
  the existing shim/load/confinement path. Legacy factory is not co-booted.
  Default init/event/consent/decisions behavior remains the legacy branch.
  Probe failures never fall back to ambient fetch. Cancelling closes pending
  intercepted requests and prevents new late requests/results.
- `probes/adobe-compatibility/chamber-journey-host.mjs`: actual host driver,
  independent result listener alongside unmodified `createWrappedSdkHost`;
  same tenant/endpoint/consent/payload/cookie fences. Pre-reserved safe fill,
  actual host completion/read-back/visibility before ACK; native owned-control
  click listener before INTERACT. No generic command API or callback transport.
- `test/adobe-chamber-journey.test.js`: controlled SDK/Worker/renderer/click/
  dispatch seams driving the real new orchestration and bundled worker source.
- `probes/adobe-compatibility/README.md`: direct API, source test command,
  ownership limits, default guarantees and still-mandatory actual gates.

No frozen core, connector manifest/default vocabulary, public `boot(config)`
schema, official SDK, distribution artifact/build entry, runner machinery,
private input/record, source client or operational resource was changed.
The worker's static source import couples the probe handler to the existing
classic-worker build; it is inert until the single profile is selected.

## TDD and source evidence

Initial real behavioral RED:10 failed/1 passed, because the existing worker
ignored the fixed profile and emitted no correlated init result (not a missing
module/import failure). Subsequent behavioral RED checkpoints:

| Checkpoint | Failed | Passed |
|---|---:|---:|
| Late cancellation fetch, unknown init option, duplicate boot continuation | 3 | 28 |
| Immediate click-listener cancellation and malformed scalar completion | 2 | 31 |
| Callback error escape, sparse result data, stock readiness-span grammar | 3 | 42 |
| Whole result-envelope byte bound | 1 | 45 |
| Host steps silently accepting caller options | 1 | 46 |
| Non-Error host promise rejection failing to close the journey | 1 | 47 |

Each checkpoint was followed by a minimum source correction and green rerun.
Host orchestration tests were written before its implementation; the initial
observed behavioral RED above is the worker-profile test, not a claim that every
later added assertion was individually witnessed failing. One intermediate
test-placement error and a RED callback-test unhandled rejection were corrected;
neither is counted as product proof.

Final required selection: **134 passed,0 failed** across four files
(48 focused journey +86 existing Alloy connector/decisions/EDS boot tests),
Node24.10.0, one Vitest worker. Targeted ESLint and syntax checks passed for
the changed worker, tests and all three probe modules; probe modules were
explicitly linted because the repository default ignores `probes/`.

Coverage includes original returned data/identity, exact native four-role
options/order, no duplicate Analytics/notifications, actual host ACK ordering
and refusal of worker render flags, unsafe/foreign/malformed/empty offers,
non-render, missing consent, failed/swallowed fill, invisible/rejected host
completion, untrusted/foreign click, SDK rejection, invalid/non-clone-safe and
oversize data, unknown options/order, in-flight/repeated/stale completions,
timeouts/cancelled late work, and the existing egress/tenant/cookie/payload
fences. A controlled projection of the actual default worker additionally
asserts its exact original configure/page options and absence of probe results.

## Acceptance boundaries and deviations

AC1–5 have bounded SOURCE implementation and controlled tests, pending required
independent compliance/craft/architecture. No claim of actual Alloy execution,
browser-native trust/visibility, SDK final serialized dispatch, Adobe receipt or
stock/chamber parity follows. AC6/7 remain **live-blocked/unexecuted**.

No expansion beyond the owner-approved fixed profile was needed. The restricted
JSON/HTML admission is intentional prototype scope, not full SDK result/offer
compatibility. Render ACK is host proof only; the worker's own acknowledgement
is not proof. Caller supplies trusted paint/visibility observations and retains
Worker lifetime custody. Dispose is bounded protocol cancellation, not a native
custodian or a guarantee to abort an already dispatched request.

At this earlier source epoch the demdex interact ceiling was unchanged;
stock's configured Edge domain was not silently admitted. A real off-ceiling
SDK request had to remain a
blocked/divergent finding. The official Alloy2.31.1 pin remains provenance data;
no artifact was booted/read or pin refreshed by this work.

No live run, deployment, vendor request, browser, Docker/daemon action, secret/
private fixture read, signal, commit or harness expansion occurred. No separate
inbox item was discovered. Existing051-02/03/full-SDK criteria and052/053 DRAFT
states/dependencies, operational ownership/setup/case/cost gates and archives
remain unchanged.

## Timebox

Implementation start: **2026-10-26T15:38:46Z**. Work stopped at the source
checkpoint, before the45-minute limit; exact end/wall seconds accompany the
handoff. Charge the entire wall interval against the inherited20365 seconds,
not a fresh allowance. The inherited accounting files were not read or
overwritten; parent accounting remains authoritative.

## Parent recovery and compliance correction — 2026-10-26

The implementation worker was no longer reachable at pickup. These persisted
files, not a recovered final agent report, are the handoff. The parent reran
the four-file selection:134 passed before review. Exact implementer end time
is unavailable; the full interval from the prior15:37:33.356605Z handoff
through16:25:29Z is conservatively charged2876 seconds, leaving17489 seconds
before further parent work. This is not a claim that the worker met its
45-minute checkpoint or remained active for the whole charged interval.

Independent compliance found one stale-placement write: reservation ownership
was checked before fetch and after painting, but not immediately before fill.
Three new orchestration regressions witnessed an actual unwanted fill after
release during fetch, reassignment after fetch or disconnection. The host now
rechecks connection and the original reservation marker before any write,
retaining all post-paint checks. The corrected selection passes137 tests
(51 focused and86 existing). A narrowed independent compliance recovery pass
accepted that correction; original and recovery findings are retained privately.
Craft/architecture and actual live acceptance remain separate.

The craft pass then found a fill-to-paint cancellation race: disposal between
those steps could install a fresh local waiter after closure and leave render
pending indefinitely. Two controlled regressions witnessed unsettled render
for microtask disposal after fill and synchronous disposal inside the paint
callback. Render now rechecks closure before paint, and a local waiter created
after closure immediately rejects while retaining observation of the supplied
promise. Both regressions pass with no timer or render ACK; the four-file
selection now passes139 tests (53 focused and86 existing). A narrowed independent
craft recovery accepted that correction. Probe lint uses explicit standard
TextEncoder/URL/timer globals because probes are outside the default ESLint
environment groups; the first forced run without those globals reported seven
environment-only no-undef findings, not a code pass.

## Historical offline live-plan check — 2026-10-26 (before routing amendment)

Before any proposed supervised pair, the pinned152336-byte2.31.1 source was
read offline, not evaluated. Its native consent request builder uses
`privacy/set-consent` (byte65278); default Edge domain is `edge.adobedc.net`
(byte43424), with a separate native URL builder. The then-current profile called
setConsent from pending, while its host ceiling permitted only
demdex/interact. That is a known routing-readiness gap, not a live SDK result.

The controlled SDK fixture previously omitted setConsent network behavior.
Two new assertions witnessed RED because initialization resolved without
exercising that boundary. A fixture-only `consentUrl` option now emits a
controlled consent request: the real host/worker orchestration rejects both
the default-Edge consent route and consent on the existing host, without
dispatch. A third case covers the default-Edge event route. These are
negative guard controls, not a consent serialization implementation or a
production fix.

The four-file selection passes142 tests (56 focused +86 existing); production
worker/host/connector code, default behavior, grants and SDK bytes are unchanged.
The earlier source reviews apply to that unchanged production epoch. No live
case should be spent rediscovering this source-known refusal. A profile-only
stock-routing alignment needs its own explicit authority/contract decision;
the supervised operational proposal does not grant it.
