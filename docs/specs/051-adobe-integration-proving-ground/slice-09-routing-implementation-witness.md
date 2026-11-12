# 051-09 bounded native routing — source implementation witness

Scope: [slice09](slice-09-focused-chamber-journey.md), current bounded routing
increment only. The slice was already IN_PROGRESS and claimed at entry;
prior readiness/claim is recorded in the historical implementation witness.
The fresh routing frame critique was PASS. No claim, review-evidence edit,
review checkbox or lifecycle transition was performed here.

Authority is the owner's separate **2026-10-26T21:59:57.102Z** routing grant,
not ADR-0045 acceptance. ADR-0045 was not edited. This document records
implementation evidence, **not an independent implementation-review verdict**.

## Source delta

- The existing probe contract exports the fixed Edge domain and a frozen array
  of exactly16 literal HTTPS origin+pathname destinations. Only
  `privacy/set-consent` and `interact`, base plus `or2`, `va6`, `irl1`, `ind1`,
  `jpn3`, `sgp3`, `aus3`, are admitted. No wildcard, collect, demdex,
  additional host or caller endpoint authority.
- Probe configure explicitly sets that edgeDomain; the actual host pins the
  same host in config-integrity and uses the same closed endpoint array.
  Existing core endpoint-ceiling/config-integrity APIs are unchanged.
- Same datastream pin, analytics/personalization purposes, cookie names,
  payload filtering, bounded original SDK results, correlated errors,
  render/trusted-click/order and cancellation checks remain.
- No classic-worker production edit was required. Default connector,
  ALLOY_EVENTS=['page_view'], byte-for-byte default configure/page options,
  public boot, frozen core and connector manifest remain unchanged.

## TDD evidence

Established Node: `/opt/homebrew/bin/node`, **v24.10.0**.

| Checkpoint | Passed | Failed |
|---|---:|---:|
| Original four-file baseline | 142 | 0 |
| Tests-first routing RED, before any production routing edit | 115 | 57 |
| Minimal source routing edit, before fixture accounting correction | 163 | 9 |
| Correct held-request versus dispatched-request accounting | 172 | 0 |
| Additional per-route tenant guards and original-result assertions | 188 | 0 |

Initial RED included the missing domain constant/configure option and real host
initialization rejecting the controlled native consent route. These were
behavioral/contract assertions, not a collection/import failure. Tests were
not committed; this witnessed RED is the TDD note. The nine intermediate
failures were a test accounting error: a held event is still an intercepted
request, but not a dispatch. The helper now checks one completed consent
dispatch plus the exact rejected intercepted URL; delayed/cancelled tests
still require exactly the completed consent and **no additional late request**.
The later tenant guard additions passed on first run; no RED is claimed for them.

Final selection: **102 focused +86 existing regression tests**, all passing.
All16 routes are positively admitted through the actual host and bundled
classic-worker handler with a controlled SDK. Wrong, missing and polluted
tenants are held on every route. Unknown region/action/host, old demdex and
HTTP remain refused. Either denied purpose blocks initialization; SDK consent
rejection retains the correlated init/sdk-rejected error and prevents fetch.
The positive one-instance chain performs consent initialization before fetch,
host-confirmed render, PAGE+DISPLAY, distinct CUSTOM and trusted INTERACT.
Unknown init/options, duplicate boot, correlation, malformed original results,
non-render, untrusted click and cancellation regressions remain.

The profile SDK stand-in now emits native consent traffic by default and
derives routes/tenant from actual configure options. Only profile governance
uses the new grant; legacy fake defaults and exact default-worker assertions
remain separate. This is **not official bundle execution or serialization**.

Validation commands (no full suite/rig/browser):

```sh
/opt/homebrew/bin/node node_modules/vitest/vitest.mjs run test/adobe-chamber-journey.test.js test/alloy-connector.test.js test/alloy-decisions.test.js test/eds-boot-alloy.test.js --maxWorkers=1
/opt/homebrew/bin/node node_modules/eslint/bin/eslint.js connectors/alloy/alloy-chamber.worker.js test/adobe-chamber-journey.test.js
/opt/homebrew/bin/node node_modules/eslint/bin/eslint.js probes/adobe-compatibility/chamber-journey-contract.mjs probes/adobe-compatibility/chamber-journey-worker.mjs probes/adobe-compatibility/chamber-journey-host.mjs --no-ignore --no-warn-ignored --global TextEncoder --global URL --global setTimeout --global clearTimeout
```

Targeted tests and both ESLint commands pass. The in-memory esbuild worker
bundle is part of the controlled test setup, not source deployment.

## Boundary, deviations and remaining work

The old known routing refusal is superseded only in this approved source
profile; dated failures remain in the historical witness. At implementation
handoff, independent routing-delta review was outstanding. Scoped compliance,
craft and architecture subsequently passed, with188 tests independently rerun
by the parent. This witness is not itself an independent verdict. No known routing
defect remains in the controlled acceptance surface.

Actual SDK execution/vendor serialization, native browser render/trust,
session-loss/native custody and live parity claims are **FALSE / unproved**.
AC6/7, live operator/setup/artifact/deployed-byte/remaining-case gates remain
separate and unexecuted. No browser, credentials/private input/old case read,
actual SDK evaluation, network/vendor, daemon, deployment, EDS push, signal,
native control, case/reservation, dependency/package change, commit or push.
No unrelated WIP, stock-baseline/canonical source/checkpoint/cost/native
capsule or memory file was touched.

Spec deviations: none. Test accounting correction is recorded above, not a
grant/control weakening. No separate inbox item was discovered.

## Timebox

Actual start: **2026-10-26T22:08:22Z**.
Actual source checkpoint end: **2026-10-26T22:13:05Z**.
Elapsed wall: **283 seconds (4 minutes43 seconds)**, within the20-minute handoff.
This work is charged against the
inherited remaining compatibility allowance and outer30-active-minute routing
checkpoint; neither is reset. The parent retains allowance accounting.
