---
status: DONE
dependencies: [061-01]
last_verified: 2026-11-04
kind: feature
frame_review: true
arch_review: true
---

## Slice 062-01 - Correct pinned PageView behavior

**Goal:** The operator gets source-grounded timezone and authorized browser-cookie
behavior through the actual PageView worker, with a useful inventory of the
remaining gaps and one separately approved comparison.

**DoR:**
- [x] Owner approved this small source increment; exact clean base recorded.
- [x] No open tracked bug duplicates this combined follow-up.
- [x] Pinned timezone expression and current cookie grant boundary inspected.
- [x] Fresh pinned Sol frame review passes.
- Cookie implementation requires an existing authorized exact-name capability
  fit or the precise additional owner decision. That doesn't block independent
  timezone/triage construction.

**Acceptance Criteria:**

1. Establish timezone sign, units and wire format from the preserved 2.9.426
   configuration plugin. Keep the existing integer-minute context contract,
   correcting the connector's wire representation. Regressions cover UTC, both
   signs and fractional-hour offsets expressed as integer minutes.
2. Inspect pinned `_fbp` generation, validity, reuse, domain and lifetime
   behavior. Implement only through an explicitly authorized exact `_fbp`
   mediated capability and existing consent rules. No copied cookie/identity,
   fake identity, whole-jar grant or default-on authority. Pending, denied,
   missing and revoked consent cannot read/write cookie state or emit it.
   Missing capability and failed cookie access must be visible. If permission
   or a contract is missing, record the exact blocker and keep this criterion
   and whole increment incomplete.
3. Keep mapping, generated identity and cookie decisions in the worker.
   Host work is bounded capture and mediated fulfillment with name/consent
   checks. Preserve queue order, host seal, loopback ceiling, diagnostics,
   default behavior and behavior outside these directly related changes.
   No stable-core/production API change without a genuine scoped decision.
4. Triage all 68 missing query occurrences using the immutable headed receipt,
   source and known name inventory. Group meaningful PageView/context/identity
   behavior, SDK experiments/diagnostics and unknown aggregated names. State
   evidence and priority; don't infer 31 hidden names from a redacted aggregate,
   spoof SDK versions or create 68 invented tasks.
5. After source/tests are ready, obtain one specific new bounded controlled-pair
   approval. Preserve a new private redacted report against the same pinned
   source, explicit browser/mode/settings and the actual worker. Keep the
   native GET/image-aborted versus worker GET/fetch-synthetic204 distinction.
   Compare private relationships only in memory; no redacted/missing equality.
   Without approval/observed rerun, report unit-only outcomes and stay incomplete.
6. Preserve 061-01 and historical receipts/order supplement. Short usage/result
   handoff names commits, tests, cookie scope, prioritized gaps and observed
   versus unit-only outcomes. No live site capture, broader event rollout,
   isolation, guarded harness, SDK upgrade, deployment or automatic successor.

**DoD:**
- [x] Source-backed tests witness red/green timezone and authorized-cookie cases.
- [x] Cookie criterion is implemented within an explicit permission boundary.
- [x] Targeted prototype/browser tests and applicable lint pass.
- [x] One newly approved pinned native/worker comparison is observed.
- [x] Pinned Sol compliance, craft and architecture reviews pass.
- [x] Deviation/sweep and pinned Sol reconciliation pass.

**Anti-horizontal-phasing check:** The corrected event traverses the actual
worker/host and produces an actionable behavioral result, not a parser-only layer.

## Assumptions

The existing contract fit was unresolved at framing. The later exact grant,
source implementation and bounded observation resolve that narrow question.
They don't establish full cookie-attribute or failure-path equivalence.

## Exact cookie permission - 2026-11-04

The owner selected "Approve the exact _fbp grant for the controlled POC".
This authorizes a default-off, prototype-only exact `_fbp` read/write binding
through the existing mediated cookie API. Every host operation requires live
`ad_storage=granted`, including checks across asynchronous boundaries and before
identity-bearing dispatch. No other cookie or production boot is included.
At that checkpoint, source and SDK-free tests were permitted and a native rerun
was still unapproved. The separate later single-run grant is recorded below.

The existing wrapped-host writeback is not activated as-is: name scope alone
doesn't provide the needed consent gate, its reconciliation changes attributes,
and its state retains writebacks. The approved binding must preserve the narrow
scope without altering frozen core or using a whole-jar connector grant.

### Deviation log

- Timezone negation is implemented at the connector wire boundary. The original
  345-minute mismatch was independently reproduced, then the corrected mapping
  passed UTC, both signs and fractional-hour cases through the real worker.
- The explicitly approved cookie binding is default-off and prototype-only.
  Worker creation/reuse/domain decisions use the existing async capability
  shape; synchronous document-backed host effects enforce exact name, origin,
  bounded options and live consent. Revocation invalidates the active command
  even after regrant. Wrapped-host cookie writeback remains disabled.
- Native lifetime/attribute details aren't copied blindly. The existing
  capability expresses 90 days through `maxAge`, with `SameSite=Lax`. Invalid
  saved domain indexes trigger fresh-cookie generation rather than reuse;
  actual access or persistence failures remain visible. No in-memory
  identity fallback, SDK metadata spoofing or experiment imitation was added.
- The first broad cookie integration check found one changed legacy error
  category: invalid headless input returned a new generic replay error. Normal
  source correction restored `invalid-headless-option` and added the distinct
  `invalid-cookie-option`, with witnessed red/green tests.
- Synthetic packed-cookie cases verify birth time, payload, optional appendix
  and saved-domain refresh; malformed input regenerates without a captured seed.
  The actual SDK-free browser verifies cookie-to-wire creation and later reuse.
- The initial timezone commit bypassed repository hooks in the child. That
  limitation is retained. Parent independently ran source regression, lint,
  diff and redacted history scanning; subsequent child commits used normal hooks.
- At the source-only checkpoint, no post-change SDK comparison had run. The
  first approval question received only a
  coordinator continuation under existing source authorization, explicitly no
  owner grant or refusal. Source review/reconciliation proceeds; AC5 and the
  whole slice stayed open for a separate later owner grant and observation.
- The owner later supplied "yes, approved" for one headed pair. It executed
  once without source changes, patching or retry. This new grant superseded only
  the absence of run permission; it doesn't weaken earlier source/authority
  boundaries or authorize any successor.
- The first full reconciliation pass found that invalid saved domain indexes
  were described as visible failures. The source actually regenerates rather
  than reusing those cookies. Both live claims were corrected after a
  docs/CHANGELOG/guide sweep; no source or receipt changed and no rerun occurred.

## Historical source-only handoff (f4a5cd0) - 2026-11-04

The approved source and SDK-free work was handed off after scoped review. All 459
related Meta/local-browser tests across 43 files pass, changed-file ESLint and
`git diff --check` pass, and the explicit redacted history scan reports no leaks.
Source commits are `eb46f32`, `80b53f1`, `9cdaede` and `2fd8594`.

The source compliance, craft, architecture and documentation reviews found no
blocking source defect. At that checkpoint, the full compliance verdict remained
`needs-changes` solely because AC5 was unobserved. The normal full-review gate
was checked and stayed closed; no transition or bypass was used. Git history
preserves that verdict before the fresh post-observation reviews.

The original 68 missing occurrences are partitioned into 2 identity/attribution,
5 PageView/context, 7 SDK metadata/diagnostics, 23 experiment entries and 31
unknown aggregated names. The exact `_fbp` grant is now approved and its source
behavior is implemented. Remaining attribution, context and metadata behavior
is backlog, not silently included. Unknown names remain unknown.

That checkpoint was unit/SDK-free evidence only. The later single pair below
is a new observation, not a reconstruction from the old redacted receipts.
Completed 061-01 and its receipts are unchanged.

## Newly approved single pair - 2026-11-04

The owner supplied "yes, approved", relayed by the retained coordinator, for
ONE headed pair on the existing reviewed source. The scope was the same
preserved SDK 2.9.426/runtime and exact configuration, existing test Pixel,
fresh context per side, one init/PageView each, 15 seconds per page and
Airlock's exact `_fbp` mode enabled. Vendor requests were aborted, with only
the localhost receiver used for worker dispatch. No site load, source download,
identity seeding or copied cookie was allowed. The grant is now spent.

The existing helper ran once at clean
`f4a5cd0f03e9221b7b1b193fc387dd591e815d44` using `--headed --fbp`.
Runtime/configuration replayed once each with zero configuration mismatches.
Chromium was `151.0.7922.34`; service workers were blocked and the existing
local-network permission was limited to the Airlock virtual origin.

| Observation | Result |
|---|---|
| PageView count | One native and one actual module-worker PageView. |
| Timezone | Observed `tz` literal match, replacing the original mismatch. |
| Cookie-to-wire | Native and worker each match their own `_fbp` cookie. Cross-context IDs are volatile; no literal equality claimed. |
| Common fields | Eight literal matches: `dl`, `ev`, `id`, `if`, `rl`, `sh`, `sw`, `tz`. `fbp` present on both, classified volatile. |
| Native transport/response | GET/image deliberately aborted upstream; response unavailable and expected `request-failed` recorded. |
| Worker transport/response | GET/fetch, real module worker observed, synthetic localhost 204 and transport-settled outcome. |
| Observation time | Native 5190.62 ms; worker 115.21 ms. Both recorded windows below 15 seconds. |
| Cleanup | Helper returned exit 0 after awaited context, browser, fixture and output closes. This is API-level cleanup, not physical quiescence proof. |

The new report still has 68 native-only query occurrences: 1 identity/attribution,
5 context, 7 SDK metadata, 23 experiment entries and 32 unknown-name occurrences.
The original inventory remains 2/5/7/23/31. `fbp` is now present; the anonymous
aggregate increased from 31 to 32. We can't identify or trace its individual
entries, so unchanged total counts don't establish unchanged fields or semantics.

The receipt remains `overall: inconclusive`, `fullCompatibility: false`.
Cookie attributes/expiry, hidden retries, complete wire behavior, backend
receipt and attribution aren't established. No source was patched or pair
retried after this observation.

Private receipt: `meta-062-headed-controlled-pair.json` (exclusive, mode 0600).
SHA-256:
`ea93ea4e0fcf70ff1f6f529d1009eb2eaa520902ab87dfaeea2df26ef39120ea`.
The separate private `meta-062-observed-pair-provenance.json` binds source,
approval, settings, counts and cleanup without retaining raw identities.
All seven prior receipt hashes and the order supplement are unchanged.
Fresh full compliance, craft and required architecture reviews were explicitly
pinned to Sol and passed. The former AC5-only compliance block is replaced by
the fresh observation-based verdict, with its earlier state preserved in git.
The normal REVIEWED gate cleared without override.
The corrected fresh reconciliation pass also cleared its normal gate. No runtime
source or receipt changed during that documentation recovery.

### Reconciliation sweep

| Surface | Disposition |
|---|---|
| Connector/worker/prototype adapter | Updated timezone and the explicitly opted-in exact cookie path only. Default cookie behavior stays off; production boot/core/contracts unchanged. |
| Controlled fixture and report | Existing `--headed --fbp` procedure used once under the new grant; transient per-side relationships recorded without values. No source change or retry. |
| Tests/import closures | Updated directly coupled expectations and fixture module lists; all 459 related tests pass, including actual SDK-free worker/browser cases. |
| Guide/triage | Updated source hashes, cookie scope/differences and the finite 68-occurrence family partition. No experiment or SDK version is spoofed. |
| Private validation/receipts | Preserved new exclusive mode-0600 receipt and source/settings provenance. All 061 originals and the order supplement retain their hashes. |
| Closed records/accepted decisions | No-op. 061-01, full 059/060, 059-18 and accepted records remain unchanged. |
| Lifecycle | Historical source-only verdict is preserved in git. AC5 now has observed evidence; fresh required reviews and normal gates determine closure. |
| Architecture/decisions/conventions | Existing async cookie contract and explicit permission record suffice for this prototype binding. Scoped architecture review requires no new ADR or frozen contract change. Contributor conventions unchanged. |
| Memory/coverage/primers | No new durable memory item. Team opt-out checked; coverage has zero gaps/dangling links and nine unchanged advisory orphans. Existing guide pointer remains sufficient; there is no active 062 primer entry to compress on closure. |

### Close-out (post-DONE)

- [x] Derived board checked and exact private evidence/handoff preserved.
