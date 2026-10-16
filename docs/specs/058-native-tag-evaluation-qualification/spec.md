---
status: DONE
skill: spec-workflow
use_cases: [UC-7, UC-10, UC-11]
---

<!-- jig self-defining vocabulary (soft, forward-only): expand each acronym on first use and link the term to docs/memory/glossary.md (or jig's lexicon). See docs/workflow.md "Self-defining vocabulary". -->

# Spec 058: Native tag evaluation qualification

An operator must be able to distinguish a correctly observed request from an
empty, incomplete or fabricated reference. This is preparation for full Google
Ads and Meta Pixel replacement, not implementation of those tags.

## Overview

Under [ADR-0033](../../decisions/adr-0033-reframe-onto-full-google-meta-compatibility.md),
full replacement requires complete, value-preserving wire and browser behavior.
The present phase may build and qualify local tooling, but authorizes no new
live vendor events, production captures, site deployment or chamber feature work.

The operator-facing deliverable is a repeatable local qualification command and
machine-readable report that proves the recorder, no-send boundary and comparison
controls work before a vendor reference can be trusted.

**Local qualification checkpoint (2026-10-16):** 058-01 implements the fixed
`core-http` loopback qualifier and its falsifiable controls. Its exact validation
and scope are in the slice record and [operator guide](../../../rig/native-tag-qualification.md).
That local-only result cannot satisfy native-reference/comparison or
vendor-readiness gates, and conveys no live-send authority.

**Retained native-profile checkpoint (2026-10-16):** 058-02 now implements a
narrow Meta PageView attempted-reference profile using exact saved native bytes
in real headed Chrome, process-local IP/resolver denial and all-fulfill/abort
HTTP interception. Linked disabled/revoked/value controls pass without vendor
dispatch. Google lacked retained runtime/configuration/dependency bytes at that
checkpoint; its separately authorized new cohort is described below.
058-03, full vendor inventories and outcome/readiness gates remain open.

**New Google-profile checkpoint (2026-10-16):** 058-04 uses one newly acquired,
pinned official loader, unchanged native execution and the same no-send
boundaries. Selected baseline/off/value receipts capture six primary plus
24 auxiliary attempts, all aborted. Actual native value mutations and retained
Meta regressions pass; the slice record carries actual review/close-out state.
A preceding integrated
unknown-auxiliary failure lost its temporary trace and remains unexplained;
later passing receipts do not establish universal repeatability or repair
historical missing runtime/responses.

**Offline comparison checkpoint (2026-10-16):** 058-03 implements strict recorded
sequence/value comparison and individually falsifiable controls. Existing
native captures are consumed with explicit completed-command attestations;
copied-reference passes are not independent candidates or chamber evidence.
Full native wire remains inconclusive on missing responses/cookie/host evidence,
and native cross-run normalization is not qualified. Local complete synthetic
sequences exercise response/edge mechanics without vendor claims. Formal
close-out state remains in the slice record.

### Grounded starting point

- `probes/adobe-compatibility/stock-wire-recorder.mjs:113-283` is a passive
  Page observer with explicit settle/failure reporting. Its route, POST/JSON
  and Adobe response restrictions are intentional; it is not a generic
  Google/Meta collector. Preserve the Adobe implementation and its evidence.
- `test/adobe-stock-wire-recorder.test.js` is existing prior art for recorder
  tests, not evidence that advertising transports or a no-send guard are covered.
- Initial owned Google evidence preserves one primary conversion response but
  has blocked auxiliary requests, unavailable bodies and an unobserved fan-out
  response. Initial Meta automation loaded dependencies but observed no beacon;
  the owner's normal browser did show Test Events receipt. Neither is a full
  automated reference. Private inputs are supplied by an explicit local handle,
  never discovered by scanning other sessions or committed into fixtures.
  Later offline headed Meta evidence is the separately pinned 058-02 profile,
  not a relabeling of those original automated/owner observations.

### Required report contract

Every report identifies its schema version, run identity, evidence layer,
expected-positive scenario, actual recorded request count, bounded observation
window, request/response completeness, guard result, source/runtime/configuration
provenance and categorized errors. The closed overall states are:

| State | Meaning | CLI exit |
|---|---|---|
| `qualified` | All requirements for the explicitly named evidence layer pass | 0 |
| `nonconformant` | Complete observations demonstrate a material mismatch | 1 |
| `inconclusive` | Missing/empty positive reference, incomplete capture, unsupported observation or missing provenance | 2 |
| `invalid_input` | Invalid invocation or malformed input rejected before execution | 3 |

Local qualification cannot set vendor dispatch/receipt, matching, attribution,
chamber compatibility or full support claims true. A legitimate expected-zero
negative case is evaluated only alongside its qualified positive control; it
does not turn an empty positive reference into success.

### Safety and scope

- Use loopback sinks and locally fulfilled pinned resources; fail closed before
  fixture code executes. No customer/Intuit traffic, account mutations, campaigns,
  ad spend, live resends or proxy fallback. The completed 058-01/02 passes did
  not authorize vendor downloads. The separately approved 2026-10-16 Google
  pass permits only inert owned script/configuration downloads under 058-04;
  its offline runner still has no network-acquisition fallback.
- Declare the exact tested browser/transport surface. Each claimed transport
  needs a matched same-run positive that actually reaches its loopback tripwire,
  an enforced zero-arrival leg, and a loopback-only disabled-guard failing
  mutation. Generic GET/POST success cannot qualify a different transport.
  Unsupported or unsuccessful controls block a broader no-send claim.
- Keep observer and enforcer separate: a passive listener does not prevent a
  send. A route abort is attempted-request evidence, not backend dispatch.
- Keep original private values and exact data relationships available only in
  private output. Public output contains classifications/counts, not cookies,
  user data, raw vendor URLs or request contents.
- Do not change `core/`, connector behavior, Adobe harnesses, frozen contracts,
  global oracle thresholds, approved components or `.servo` approval state.

## Assumptions

The selected browser's request/response hooks and pre-execution controls can
cover the declared test transport surface without transmitting externally.
That must be demonstrated by local positive/negative controls; a Playwright
listener or route registration alone is not the proof.

## Decomposition

Use Rules/Paths: first a complete local receive/capture/report journey; then
native attempted-request acquisition with no external transmission; then
whole-sequence/value-preserving comparisons and falsifiable controls.
Each slice gives an operator an end-to-end result. No spike is needed to ship
the local qualifier; unknown native behavior remains an explicit blocked case.

## Slices

- [058-01 — local recorder and no-send qualification](slice-01-local-qualification.md)
- [058-02 — pinned native attempted-request reference](slice-02-native-reference.md)
- [058-03 — value-preserving comparison controls](slice-03-comparison-controls.md)
- [058-04 — owned Google conversion attempted-reference](slice-04-google-native-reference.md)

Vendor specifications [059](../059-google-ads-full-compatibility/spec.md) and
[060](../060-meta-pixel-full-compatibility/spec.md) consume named evidence layers,
not this spec's rollup status. No vendor family becomes complete because a
shared helper passes.
