# Plan - full Meta Pixel compatibility

This packet plans complete replacement, not a curated subset. It is DRAFT
authoring under a preparation-only grant; none of the runtime journeys below is
implemented, reviewed or authorized to execute by this document.

## Current grant and stop controls

The owner granted about 25,000 AI credits TOTAL across parent and both vendor
sessions, not per agent, and selected a four-active-hour preparation checkpoint.
Phase start: 2026-10-15T23:34:47Z. Conservative wall-clock stop:
2026-10-16T03:34:47Z, or sooner when the bounded deliverable is complete.
No hard automatic credit meter is exposed to this author. Do not describe the
written amount as an enforced cap or invent usage totals; parent coordinates
available usage observations and stops conservatively.

This turn may author/commit only this folder, derive frame-review flags, run
the existing read-only spec linter and `git diff --check`. It may not implement
runtime/tooling, execute browsers/SDKs/events, mutate accounts/sites, provision,
deploy, push, run tests/builds, start nested agents/loops or write approval state.
Shared 058, ADR/index/board, source discovery and formal reviews remain parent-owned.
The local 060 reservation must still pass parent's integration collision check.

## Dependency/evidence order

| Journey | Actual prerequisites, not list-order inference |
|---|---|
| 060-01 | ADR-0033 Accepted; 058-01, 058-02 and 058-03 actually qualified for the relevant Meta surface; positive automated native PageView and reviewed extension seams. |
| 060-02 | 060-01; event/custom-data reference vectors and approved scenario-specific evidence. |
| 060-03 | 060-01 and 060-02; second owned Pixel, per-Pixel settings and complete set/command discovery. |
| 060-04 | 060-03; observed privacy/consent state machine and owner's applicable policy. |
| 060-05 | 060-04; cookie/transport cohort evidence and a precise reviewed vendor-cookie operation. |
| 060-06 | 060-03, 060-04 and 060-05; same-input identity vectors and observed update/clear semantics. |
| 060-07 | 060-06; owned automatic-matching settings, synthetic form references and reviewed bounded capture. |
| 060-08 | 060-03, 060-04, 060-06 and 060-07; automatic-event/rule/metadata references and settings. |
| 060-09 | 060-02, 060-04, 060-05, 060-06 and 060-08; lifecycle transport references and separately governed no-JavaScript path. |
| 060-10 | 060-02, 060-03, 060-05 and 060-06; existing authorized server counterpart and explicit event-ID reference. |
| 060-11 | 060-08, 060-09 and 060-10; diagnostic/catalog/rule and lawful matching/attribution access where required. |
| 060-12 | 060-01 through 060-11; measured pinned performance baselines and complete feature/cohort ledger. |

All shared prerequisites must name their actual evidence layer, transport and
browser pin. 058's rollup or local-only network controls, a green unrelated
oracle or this packet's structural checks cannot qualify native Meta wire.

## Recorder/oracle qualification before implementation loops

Parent's 058 owns implementation and proof of the recorder/no-send/comparator.
The smallest Meta input gate is a finite owned PageView-only case:

1. Establish pre-code no-send and positive recorder visibility using a local
   instrumentation control, independent of the vendor. Cover the declared
   paths; unknown/unprotected egress is denied and broad protection claims block.
2. Supply pinned official runtime/configuration and provenance explicitly.
   Record actual init/PageView invocation and bounded observation state.
   Missing dependencies cannot trigger live fallback.
3. Require a real positive native PageView attempt in that same automated
   environment, with complete request fields and all auxiliary attempts.
   The current no-beacon/timeout is an explicit inconclusive control.
4. Prove missing/added requests, altered values/routing/identity, empty reference
   and unavailable response controls cannot produce PASS. Keep original private
   relationships available before redaction.
5. Pair default-on positives with exact-off and duplicate-off negatives. Two
   silent enabled/disabled cases do not qualify the gate.
6. Separately qualify actual dispatch, browser-controlled cookies/headers,
   response/redirect behavior, receipt, matching and attribution when those
   claims are required. No-send attempts do not supply those layers.

Owner normal-browser Test Events receipt remains positive owner evidence, not
the missing automated wire reference. No cause for the discrepancy is selected.
No new live event, normal-browser replay or servo invocation is authorized here.
Any future servo use additionally needs finite approved limits, independent
evaluations, lifecycle readiness, immutable criteria and component approval;
do not write `.servo` approval or suppress a failing criterion.

## Blocking discovery, owned by the affected journeys

| Unknown | Owner/journey and required resolution |
|---|---|
| Current source seams, boot/suppression, manifests, generic-pixel coexistence and unload handling | Parent supplies source-backed evidence before affected implementation, using available semantic tools or targeted reads per the project workflow. No runnable-code claim is inferred from historical records. |
| Complete fbq/set, invalid calls, argument snapshot/return/callback behavior | 01-03 compare official calls to observable browser/network results, including negative cases. |
| Event typing, nested commerce, scalar content IDs, limits and private encodings | 02 classifies actual native requests; P2/P7/P9 disagreements stay explicit. |
| Re-grant replay/retention, processing encodings/per-Pixel scope | 04 observes the state transitions; resolves P17 dpo/vdpo discrepancy without guessed encoding. |
| Cookie lifetimes/attributes, browser partitioning, headers/credentials/fan-out | 05/09 use equivalent profiles and actual browser transport observations; no fake ClickID or cookie seeding as first-visit proof. |
| Raw/prehashed normalization, external-ID rules, updates/logout | 06 preserves native same-input values and clears/merges only as established; CAPI rules are not imported by assumption. |
| Automatic matching, Event Setup Tool, automatic events and remote rules | 07/08 obtain feature settings/references through explicit owned access; unreadable public help is not evidence. |
| SPA auto-navigation, BFCache, prerender, unload, retry and loss | 09 proves explicit versus automatic triggers and measured transport behavior; no exactly-once assumption. |
| No-JavaScript collection with owner gate policy | 09 qualifies a separate site-owned policy-preserving fallback. Static/edge facilities and feasibility are unverified; the approved test omission is not changed. |
| eventID/eid custom/single-target placement and repeated-source behavior | 10 observes browser/server relationships; no browser-only deduplication inference. |
| Diagnostic detection, catalog rules, lawful match/outcome evidence | 11 separates extension/UI/receipt/quality/attribution and pins feature-specific acceptance with approved data and observation windows. |
| CWV/CPU/latency/memory budgets, generated-field/timing tolerances and drift triggers | 12 pins measured native/tag-free conditions, noise treatment and owner-approved criteria before evaluation; no invented numeric bands. |

Unknowns are entry blockers or explicit inconclusive scenario results, never
non-goals. Expand the coverage ledger on new discoveries. Only controlled
evidence of a specific invariant conflict triggers one bounded owner decision;
do not repeatedly ask whether full support or the test noscript choice is wanted.

## Resource/access matrix

| Journey | Minimum later owned access; not granted by source creation |
|---|---|
| 01-02 | Dedicated source, permitted test page, current runtime/configuration pins, browser profiles and Events Manager observations; separate finite actual-dispatch grant. |
| 03 | Second owned source and independent per-Pixel settings. |
| 04-06 | Owner consent/processing policy, synthetic identity vectors, authorized first-party state/ClickID provenance and reviewed capabilities. |
| 07-08 | Ability to inspect/change the dedicated source's automatic feature settings and Event Setup Tool rules; synthetic forms/metadata only. |
| 09 | Browser/lifecycle matrix and a separately authorized no-JavaScript reference/path; no assumption of an edge deployment. |
| 10 | Existing controlled CAPI counterpart/test workflow supplied through private handles; no full CAPI project or credential discovery. |
| 11 | Pinned read-only diagnostic tooling, owned catalog/feed/rules, available lawful matching/reporting and attribution observations. Campaign/billing changes need separate decisions, not a blanket initial prerequisite. |
| 12 | Coordinated owned-site lease, versioned configuration, untouched-tail baselines, measured performance budgets and explicit cutover/rollback grant. |

## Implementation/evaluation posture after future approval

Each journey proceeds with failing controls first, through actual adopter calls,
serialized chamber state and mediated browser operations to the official
endpoint and an operator-visible classified report. Local references can qualify
attempts but cannot stand in for actual browser responses/cookies or backend
outcomes. Native code is absent in replacement profiles. Main-thread-only or
direct-connector shortcuts cannot satisfy acceptance.

Reuse existing runner/lint/test conventions after parent source discovery.
Add no tooling merely to make a DRAFT appear executable. Preserve other vendors
and the Adobe site schedule; no shared-source edit or release is implicit.

## Formal review and reconciliation handoff

All slices require frame review derived from their real assumptions; architecture
review is requested for the planned contracts/boundary implications. Parent
owns formal reviews and authoring promotions. Implementation later requires
independent compliance/craft/architecture and reconciliation evidence, exact
validation receipts, mutation controls and an honest deviation/sweep record.
Blank `last_verified` and unchecked Definition of Done (DoD) entries are
intentional: nothing has been implemented or reconciled.

Review especially: complete F/SC ownership; non-vacuous native references;
no-JavaScript feasibility without reopening the owner's test choice; cookie/
DOM/transport ceilings and stable-core fit; feature access; measurement
versus receipt/matching/attribution; vertical slice size and measured performance
criteria. Parent integrates the folder commit and updates its owned records
after collision checks; no push or automatic landing occurs here.

## Authoring check receipt

On 2026-10-15, the existing read-only `frame-review-needed` helper returned
`true` for each of 060-01 through 060-12 from the real assumptions in that
slice. Those derived flags are recorded in frontmatter; no review occurred.
The existing `spec_lint.py --strict` and `git diff --check` are the permitted
structural checks, not functional validation or evidence-layer qualification.
No tests/builds, runtime implementation, source discovery, external requests
or formal reviews are part of this receipt.
