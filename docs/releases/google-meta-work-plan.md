---
status: DRAFT
created: 2026-11-02
---

# Google and Meta: reset and work plan

We want a customer to replace the native Google Ads or Meta Pixel tag with
Airlock without losing collection or changing attribution. We have useful
prototypes, but we have not demonstrated that replacement. The next step is
to prove one complete journey per vendor before expanding feature coverage.
That trades some parallelism for a result we can evaluate.

**Review status:** the first research and Meta source/contract waves are complete.
The owner approved ADR-0043's trusted-mapper architecture, now Accepted through
Jig after a refreshed Sol frame pass, and commissioned the Meta case/limits
document packet. Its closing handoff is in section 11. Under the subsequent
instruction to continue local work, fixture Bug 002 is DONE and shared-host
Bug 003 has a source fix under review. The old vendor sessions remain paused.
Full replacement-journey implementation, browser runs, captures, deployment and
vendor traffic remain gated; no earlier case or spending grant is renewed.

## 1. The goal has not changed

[ADR-0033](../decisions/adr-0033-reframe-onto-full-google-meta-compatibility.md)
owns the complete-replacement target:

- Reimplement the browser tags in chambers, with the necessary governed
  DOM, storage and lifecycle operations on the host. Do not run the native
  SDK elsewhere and call it a replacement.
- Preserve the complete applicable request/response sequence and its data
  relationships under equivalent inputs, configuration and browser state.
  Include consent, identity, redirects, auxiliary requests and later events.
- Keep vendor receipt, matching, reporting and attribution as separate
  obligations. Matching a few decoded fields or receiving HTTP 200 is not
  enough.
- Keep mapping and hashing off the main thread. Preserve consent enforcement,
  isolation and measured Core Web Vitals. Bring a demonstrated conflict back
  as one explicit decision.

The scope is Google Ads browser tagging and Meta Pixel, including required
coexistence. It is not all of GTM, GA4, vendor backends or a replacement for
server-side APIs. Adobe-first v1.0 remains a separate workstream.

## 2. Where we are

| Area | Retained result | What is still missing |
|---|---|---|
| Owned setup | Dedicated test resources and historical native observations exist. Google has a primary conversion observation; the owner confirmed a Meta Test Events PageView. | Current setup confirmation, complete paired references and outcome evidence. Historical setup is not current permission. |
| Evaluation tools | [058](../specs/058-native-tag-evaluation-qualification/spec.md) is DONE for its named local, attempted-request and comparator layers. | Complete native responses, browser state and independently qualified same-input comparisons for the replacement. |
| Working prototypes | [059-19](../specs/059-google-ads-full-compatibility/slice-19-offline-conversion-prototype.md) and [060-13](../specs/060-meta-pixel-full-compatibility/slice-13-offline-pageview-prototype.md) exercise real Node workers and loopback receivers. | These are synthetic local encodings, not complete native implementations. |
| Browser construction | [059-20](../specs/059-google-ads-full-compatibility/slice-20-local-browser-conversion.md) and [060-14](../specs/060-meta-pixel-full-compatibility/slice-14-local-browser-pageview.md) passed their historical local-browser journeys. | Native wire, browser identity, production integration and performance acceptance. Later opt-ins have not inherited that browser qualification. |
| Added feature experiments | Default-off Google and Meta experiments cover additional commands and event data. | Native semantics and wire behavior for most of those experiments remain hypotheses. |
| Integrity and architecture | Synthetic controls expose mediated-request correlation gaps. Some Google checks duplicate mapping on the host. | A reviewed request-authority design that meets the chamber boundary. A second verifier worker is only an unfinished experiment. |
| Full replacement | **0 of the 24 currently planned full-compatibility slices is DONE.** | The first full journeys, [059-01](../specs/059-google-ads-full-compatibility/slice-01-owned-conversion.md) and [060-01](../specs/060-meta-pixel-full-compatibility/slice-01-pageview-entry.md), remain READY_FOR_REVIEW, not implementation-ready. The other 22 remain DRAFT. |

This is a proof-of-concept stage, not a nearly finished product. The slice count
is a view of the current plan, not a percentage of tag parity. There is no
defensible completion date or remaining-credit estimate yet.

## 3. What went wrong

We spent too much time on capture-runner ownership, cleanup and guard work.
After that stalled, we accumulated many narrow synthetic field experiments.
Those produced code and tests, but did not close the first complete native
journey. The long session then became the place where priorities and authority
were reconstructed.

[ADR-0042](../decisions/adr-0042-google-meta-product-delivery-gates.md) already
requires product-first milestones, bounded prerequisites and one active slice
per vendor. We did not keep the work aligned with that rule. A new ADR saying
the same thing would not fix this.

## 4. Proposed next sessions

These are session packets inside existing owners, not new feature specs.
Each ends with a reviewable handoff. None starts its successor automatically.
Time limits below are proposed checkpoints, not new execution or spending grants.

| Order | Packet and owner | Deliverable | Stop condition |
|---|---|---|---|
| 1 | Native evidence planning, [R-013](../research/R-013-google-meta-first-journey-evidence.md), consuming 060-01 and 059-01 | A separate first-journey case card for each vendor, an evidence gap list and one recommended acquisition route. Start with retained records and public source. | One read-only session per vendor, at most 60 active minutes. No launcher repair, capture or new tool implementation. Missing access or a safety prerequisite becomes a named blocker. |
| 2 | Request authority design, [R-014](../research/R-014-google-meta-request-authority.md), consuming the first journeys' integrity criteria | Owner selected C's trusted first-party mapping authority with D's browser admission and independent evaluation through Accepted ADR-0043. Production boundary fit and native/browser/numerical evidence remain open. | Commissioned document packets delivered. No verifier implementation, new confinement framework or automatic successor. |
| 3 | Decision and case review | Owner reviews the two research handoffs, the necessary architecture ADR and the first case's evaluation and performance criteria. Existing slices remain the implementation owners. | No code starts without a reviewed boundary and a sufficiently grounded case. Live actions need their own finite approval. |
| 4 | First complete Meta PageView, 060-01 | Reuse the prototype and evaluator. Obtain the permitted reference, implement only the demonstrated gaps, then compare actual browser/chamber requests, responses and host effects. | Each session has one named gap or one admitted run. Missing native behavior blocks the claim, not another automatic infrastructure task. All 060-01/C1-C9 criteria remain binding. |
| 5 | First complete Google conversion, 059-01 | Apply the same process to the owned direct conversion, including its response and auxiliary branches. | Same checkpoint rule. Do not treat the Meta result as Google qualification. |
| 6 | Remaining feature families | Refine and implement the existing vendor slices, one bounded journey at a time. Two vendor sessions can run independently once their inputs and shared boundaries are stable. | Each slice needs a qualified evaluation, independent reviews and an explicit owner pickup. No open-ended "find another field" task. |

The recommended order is Meta first, then Google, because it reduces concurrent
unknowns. This is a sequencing recommendation for review, not a reduction of
the full Google target.

Within either first journey, use separate short sessions for the case/evaluation
contract, one bounded implementation change, permitted validation and independent
review. Those sessions contribute to one vertical product slice. They do not
each manufacture a new DONE milestone.

## 5. ADR and spec routing

| Subject | Existing owner | Proposed treatment |
|---|---|---|
| Full target and product-first delivery | ADR-0033 and ADR-0042 | Reaffirm. No supersession or duplicate reframe ADR. |
| Native acquisition and supervision | [ADR-0038](../decisions/adr-0038-supervised-native-meta-resource-lifecycle.md), 059-15/18 | Keep parked. R-013 must determine whether this route is needed, can be bounded, or should be replaced. No run grant or new general runner follows from the research. |
| Request integrity, mapping and egress authority | 059-01 and 060-01 | [Accepted ADR-0043](../decisions/adr-0043-google-meta-request-authority.md) selects C with D. Owner trust choice is resolved; production boundary fit and evidence/readiness remain required. No unfinished two-worker experiment is adopted. |
| Consent wait, retention and replay | [059-03](../specs/059-google-ads-full-compatibility/slice-03-consent-journeys.md) and [060-04](../specs/060-meta-pixel-full-compatibility/slice-04-consent-processing.md) | [Proposed ADR-0044](../decisions/adr-0044-google-ads-consent-wait.md) tracks the specific Google wait question. Preserve current behavior until evidence and owner policy review select a recommendation. Meta semantics remain separately owned by 060-04. |
| Cookies, credentials, DOM and lifecycle capabilities | Existing feature slices | The [pending-decision register](../refinement-todo.md#googlemeta-pending-decisions-2026-11-02) tracks each capability and its promotion trigger. Draft its ADR when a named journey supplies a concrete choice; do not prebuild a general API. |
| First replacement paths | 059-01 and 060-01 | Reuse their full acceptance criteria. Refine them after the research and review; no duplicate first-journey specs. |
| Local prototypes and completed qualification tools | DONE slice records | Preserve their historical results and limitations. No amendment or requalification is performed in this planning pass. |

The research and decisions are now filed, rather than left as future document
creation tasks. Existing product specs remain their implementation owners.
ADR-0043 is Accepted for the owner's architecture choice. ADR-0044 remains
Proposed and selects no consent policy. Their numbers remain local allocations,
not trunk reservations; implementation and live gates are unchanged.

### Filed artifact register

| Artifact | State | Next review or consumer |
|---|---|---|
| [R-013: first-journey evidence](../research/R-013-google-meta-first-journey-evidence.md) | OPEN; Meta card and case/limits manifest delivered, Google unresolved | Explicit current META_CASE_INPUT_BUNDLE is required. Existing records establish no qualified complete acquisition path. No new research, repair or live action follows automatically. |
| [R-014: request authority](../research/R-014-google-meta-request-authority.md) | OPEN; architecture accepted, Meta source/contract check delivered | Conditional standalone private-interface fit and source-derived final-call consent/cleanup gaps. Production boot/unload and native/browser/performance inputs remain open. |
| [ADR-0043: request authority](../decisions/adr-0043-google-meta-request-authority.md) | Accepted; owner selected C with D | Refreshed independent Sol frame pass; production boundary fit and evidence/readiness still required before implementation. |
| [ADR-0044: Google consent wait](../decisions/adr-0044-google-ads-consent-wait.md) | Proposed, no policy selected | Native timeline evidence and owner privacy/policy decision before 059-03. |
| [ADR-0038: native supervision](../decisions/adr-0038-supervised-native-meta-resource-lifecycle.md) | Existing Proposed record, parked | R-013 determines whether this route is needed; no implementation or run follows. |
| [Spec 058](../specs/058-native-tag-evaluation-qualification/spec.md) | DONE for named supporting layers | Reuse its actual scope; it does not qualify replacement behavior. |
| [Spec 059](../specs/059-google-ads-full-compatibility/spec.md) | Existing partial work, execution paused | 059-01 first; later 02-12 remain DRAFT. |
| [Spec 060](../specs/060-meta-pixel-full-compatibility/spec.md) | Existing partial work, execution paused | 060-01 first; later 02-12 remain DRAFT. |

The [spec board](../specs/README.md) lists each individual slice. No duplicate
feature specs, runtime changes or acceptance decisions are introduced by filing.

The remaining portfolio stays with its current owners:

| Work | Google | Meta |
|---|---|---|
| Commands, initialization and routing | 059-02 | 060-01/03 |
| Events, commerce and audiences | 059-05/06 | 060-02 |
| Consent and processing policy | 059-03 | 060-04 |
| Cookie, click and identity continuity | 059-04/07 | 060-05/06 |
| Automatic matching and collection | 059-08/10 | 060-07/08 |
| Website-call behavior | 059-09 | Not a Meta feature owner |
| Navigation, unload and no-JavaScript behavior | 059-10 | 060-09 |
| Deduplication and product outcomes | 059-06/12 | 060-10/11 |
| Migration, performance, rollback and drift | 059-11/12 | 060-12 |

## 6. How smaller sessions will work

Use the [fresh-session launch guide](google-meta-orchestration-start.md) for
the concrete runtime setup. The owner selected `gpt-6.1-sol` for orchestration
and every Jig review, and `gpt-6.1-terra` for implementation. Pass model IDs
explicitly at dispatch; do not rely on inherited defaults. Architecture work
stays on Sol, while bounded evidence extraction can use Terra.

For this workstream, every future assignment names:

1. One goal and its canonical slice or research owner.
2. The exact starting commit, required inputs and allowed files.
3. The authority envelope, including whether execution is forbidden.
4. A concrete output and the evidence that will accept or reject it.
5. A finite checkpoint and a stop rule. An unresolved prerequisite returns to
   the owner; it does not create an unreviewed successor project.

The closing handoff contains the result, evidence locations, remaining blocker,
HEAD/dirty state and proposed next packet. It must stand alone without this
conversation. The owner selects the next session. No recurring automation,
background successor, multi-agent loop or code integration is started by the
handoff. Servo can be considered later for one bounded slice after its evaluator
and limits are reviewed; it cannot supply missing native evidence.

Progress reports count completed qualified journeys and open acceptance
criteria. Commits, token usage, field counts and passing local tests are
supporting information.

A coordinator owns one bounded wave, not an indefinite session for the complete
replacement programme. It returns an integrated handoff or a named blocker and
stops. The owner can then launch the next phase in a fresh Sol session.

## 7. Preserved work at the pause

| Workspace | Last committed state | Preserved unfinished work |
|---|---|---|
| Coordinator | `7ee4de4` | Untracked `test/fixtures/vendor-node-confinement-probe.mjs` and `test/vendor-node-confinement-limit.test.js`. Neither was run before the pause. |
| Google replacement | `d54156d` | Untracked `test/google-ads-integrity-verifier-experimental.test.js`. Initial test only; unrun, no verifier implementation. |
| Meta replacement | `151ddd02` | Modified `adapters/meta-pixel-prototype.js` and untracked `test/meta-request-verifier-experimental.test.js`. Partial verifier experiment, unreviewed and not fully verified. |

Both vendor handoffs were received for this reset. No unfinished code was
integrated, discarded or committed. Their Node bridges are trusted first-party
test plumbing, not malicious-code sandboxes. A mediated-message verifier would
not by itself fix that boundary or establish native correctness.

The existing Meta original case remains spent/inconclusive; the additional case
was last recorded as unspent. Neither is current executable permission. Old
browser pins, setup confirmations and cleanup UNKNOWNs remain historical.

## 8. Review and coverage

This is a bounded planning stocktake of ADR-0033/0038/0042, the 058 overview,
059/060 overviews/plans/tasks and slice statuses, the first-journey and completed
local-browser records, the vendor delivery queue, prototype gap records and
the two paused-session handoffs. It is not a new audit of all source, private
captures, historical safety records or account state. No private inputs were
discovered or used.

The next owner review is the goal, the evidence-based status and this proposed
work order. Research, ADR acceptance, implementation and live authorization
remain separate later decisions. No original acceptance criterion has been
weakened to make the reset look complete.

## 9. First research-wave handoff

The owner commissioned two new document-writing children from
`7fe4aac0306dbc1407e22612e3b9f62e4c612c77`. The coordinator is
`google-meta-orchestration`, explicitly on `gpt-6.1-sol`. Both children used
isolated native Copilot worktrees, creator coordination and completion
notifications. The old vendor sessions and their unfinished drafts were not
resumed or imported. No peer service, scheduler or successor was created.

### Results and evidence

| Mission | Output and remaining limit | Child commit | Integrated commit |
|---|---|---|---|
| Meta evidence, `gpt-6.1-terra` | [R-013 Meta card](../research/R-013-google-meta-first-journey-evidence.md#meta-first-case-evidence-card) maps 060-01/C1-C9, inputs, gaps, controls and route alternatives. Recommends an owner-operated capture feasibility/safety packet for review. No currently qualified acquisition route; Google remains unresolved. | `eb74fa2c4832093db1c2938d97b94320f5ec5104` | `93a66b6` |
| Request authority, `gpt-6.1-sol` | [R-014](../research/R-014-google-meta-request-authority.md) and [Proposed ADR-0043](../decisions/adr-0043-google-meta-request-authority.md) recommend one trusted first-party mapping authority (C) with actual-browser admission and independent evaluation (D). A second verifier is conditional on a stronger owner-selected threat model. | `6f34ec998b15fd83333a937d55c25d157bec5803` | `85719712c73f80473b54010002eee5d55ba97365` |

These are source/document results, not native observations or implementation
passes. Mapper semantics are explicitly trusted in C. Wrong-but-well-formed
mapper output is an independent test/evaluation obligation; a malicious mapper
is outside that guarantee. Browser loader/policy closure, exact final-dispatch
wiring, frozen-contract fit and numerical performance limits are unverified.
Native responses, equivalent browser state and separate vendor outcome evidence
remain missing. Both first journeys stay READY_FOR_REVIEW and blocked before
implementation; ADR-0043/0044 remain Proposed.

R-013 stays OPEN because Google's case and a qualified acquisition route remain
unresolved. R-014 stays OPEN because the trust choice and identified
source/contract-fit questions remain unresolved. Completion of these bounded
document missions does not commission the remaining investigation.

### Review and scope record

The canonical ADR frame verdict is
[ADR-0043 frame critique](../decisions/reviews/adr-0043-frame-critique.md).
It passed at research HEAD `85719712c73f80473b54010002eee5d55ba97365` on
host-reported `gpt-6.1-sol`. The nonblocking residual is explicit mapper trust:
a malicious mapper can make a wrong but protocol-valid mediated request.
The pass preserves that owner decision and does not establish containment,
native correctness or performance.
The [document-closeout verdict](#document-closeout-review) and reviewed checkpoint
are recorded below. These reviews do not stand in for the
product slices' required compliance, craft, architecture or reconciliation
passes, or any required code-health judgment. All reviewer dispatches are
explicitly pinned to `gpt-6.1-sol`.

The first frame-review turn stopped before reading artifacts because the
reviewer could not see its own model identity. Native `read_agent` metadata
reported `model: gpt-6.1-sol` for that exact agent, and the same reviewer was
resumed with that host-provided routing evidence. This was an operational stop,
not an ADR finding or a substitute model.

The Meta child reports exposed Terra model metadata; the authority child reports
exposed Sol model metadata. These agree with their explicit kickoff pins.
No independent provider-side execution attestation or native active-time/credit
meter is exposed. Reported wall intervals were about 2 minutes and 10 minutes,
respectively, below their commissioned 60/90-active-minute checkpoints. Those
intervals are not measured active time or a claim of tool-enforced caps.

One process deviation is preserved: the authority child's local commit used
a command-only `core.hooksPath=/dev/null` override to avoid executing global
hooks it considered outside its read/run scope. No persistent Git setting was
changed and no review verdict or acceptance gate was bypassed. The coordinator
does not reuse that override; closing commits use the normal configured hooks.
The Meta child reported its normal commit secret-scan hook ran.
The coordinator's reconciled checkpoint commit used normal hooks; its configured
secret scan completed with no leaks.

The authority research also flags broad existing browser-confinement prose and
`connect-src`-only loader comments for a later scoped correction. They were not
edited here. Reading the wrapped host and frozen declarations needs the
separately selected source/contract-fit packet, not an implicit extension of
this wave.

### Document closeout review

**Disposition: pass for the document-only wave.** The independently reviewed
integrated checkpoint is `9a88406d465cfb70b80a95089f7abb6844574d91`, against
base `7fe4aac0306dbc1407e22612e3b9f62e4c612c77`. The final closing commit
adds only this verdict, review-status and verified disposition metadata.
Research recommendations, original criteria and authority are unchanged.

The first fresh Sol closeout reviewer found both cards complete against their
commission, evidence limitations honest, Proposed status preserved and no
substantive document defect. It returned `needs-changes` solely because its
read-only tools could not obtain the Git patch. A same-agent follow-up was
attempted, but the native tool refuses messages to sync-mode task agents.
A narrowly scoped Sol evidence supplement therefore examined the generated
base-to-checkpoint diff and original child manifests. Its first response
requested the separate Terra/coordinator hunks; those exact Git patches were
supplied without changing the reviewed checkpoint.

Final supplemental verdict:

> **VERDICT: pass.** Terra's patch is solely a 187-line Meta-section insertion,
> leaving Google/global framing untouched. Its resulting blob matches the
> coordinator patch's starting blob. The global introduction/conclusion edits
> are separately attributed to the coordinator. Together with the aggregate
> diff and child manifests, this establishes compliant ownership, unchanged
> excluded surfaces, no slice promotion and no accepted ADR. No specific
> issues remain. This clears the initial missing-evidence blocker.

Both closeout tasks and the frame reviewer were explicitly pinned to
`gpt-6.1-sol`; native agent metadata reported that model. Initial and final
verdicts and the generated patch evidence are preserved in the coordinator's
session artifacts. This record makes the result available without replaying
either child's conversation. It is not a native/browser/performance pass or
an implementation review.

### Verified child dispositions

| Native child | Final source state | Disposition |
|---|---|---|
| Meta `90fcd853-c22e-4d62-a309-d1e26044293e` | Clean at `eb74fa2c4832093db1c2938d97b94320f5ec5104`; integrated and reviewed | Archived after verified completion; no attached automation |
| Authority `040dd76c-0fe3-4758-9253-501ade25b631` | Clean at `6f34ec998b15fd83333a937d55c25d157bec5803`; integrated and reviewed | Archived after verified completion; no attached automation |

No unfinished child work was discarded. Old vendor sessions were untouched.
The coordinator's checkpoint tree was clean. Closing metadata uses the normal
commit path; final HEAD and dirty-state verification accompany the owner handoff.

### Owner decision and stop

The next decision is whether to accept the proposed first-party mapper trust
boundary after the required boundary-fit review, or require resistance to
malicious mapping code. That choice determines whether the extra verifier
alternative needs further investigation. A separate Meta route decision may
commission a bounded owner-operated feasibility/safety packet, with explicitly
supplied resources and controls.

Neither packet is dispatched by this handoff. No browser, SDK/runtime-byte
acquisition, measurement traffic, private-input discovery, account/campaign
change, deployment, old-case retry, consent-policy change or implementation was
performed by this wave. Further grants remain separate.

## 10. Meta-first source/contract wave handoff

The owner's "ok, sounds good. do it" commissioned one Sol source/design
packet, its fresh Sol review, integration and handoff from clean base
`bbc42581dff94ae32125cb7f25746bbb859f5586`. It did not commission the later
conditional Terra implementation, owner ADR acceptance or live activity.
This is a new bounded wave, not an automatic successor to wave 1.

### Source/design result

[R-014's Meta-first check](../research/R-014-google-meta-request-authority.md#meta-first-source-and-contract-fit)
enumerates the 18-file standalone static source closure and maps its message
flow and missing guarantees against the frozen interfaces. One trusted mapper
with a private protocol can fit that inspected route without changing the
frozen Connector or round-trip capability types. Production boot/unload
integration is not established: an asynchronous fresh command cannot silently
replace the frozen critical-send-before-return behavior.

Two concrete source findings narrow the implementation question:

- The wrapped host reads consent before a Promise continuation. The adapter's
  actual Fetch call lacks a final recheck. A denial between them is a
  source-derived ordering counterexample, not an executed race.
- Adapter stop can settle its outer wait while the wrapped host retains an
  unresolved drive and owned timer/callback state. A narrowly private close
  helper is proposed, not implemented.

The conditional change list is the existing Meta adapter, worker, mapper and
README plus private wrapped-host cleanup. No second verifier or general
framework is selected. Malicious-mapper resistance is outside the proposed
trust guarantee. Full native behavior, served-loader confinement, production
integration and evidence-backed numerical limits remain open. Both research
notes stay OPEN, ADR-0043/0044 stay Proposed and all slice states are unchanged.

### Provenance, scope and review

| Item | Recorded state |
|---|---|
| Coordinator / child / reviewer models | Explicit `gpt-6.1-sol`; no lower-model design or review |
| Native child | `e6d6c087-75fa-4123-9770-178758d1b26b`, new isolated coordinated worktree, completion notifications |
| Child source commit | `a46789b22892dea6ec6bca0ef93408c641a078eb`, direct parent is the exact commissioned base |
| Child write scope | Only R-014's new Meta-first section: one insertion hunk, 231 lines, no deletions |
| Integrated source commit | `0cb43258f5236e6ef6ddef20f5f6be43a7f64ee7` |
| Checkpoint | One document result; reported wall interval about 10 minutes, below the newly commissioned 90-active-minute checkpoint. No native active-time/credit meter or hard timer is claimed. |
| Authority | Source/design only; normal commit hooks, no disabled hooks, push or PR |

The child reported exposed runtime metadata matching the explicit Sol pin,
clean initial/final state and a normal commit secret scan with no leaks.
Regression test filenames were inventoried and past browser records were read;
test contents and present adequacy were not reassessed, run or requalified.
The coordinator supplied generated aggregate and child-specific Git patches
to the independent reviewer so its read-only tools could assess ownership.
The bounded ADR architecture/contract-fit verdict is recorded at
[ADR-0043 architecture review](../decisions/reviews/adr-0043-arch.md).
This is not a full production, runtime or native qualification, or a product
slice implementation review. The previous frame critique remains its
historical proposed-premise verdict; ADR acceptance is still separate.

**Verdict: pass**, reviewed checkpoint
`440e0fe4bb9d6b3d9e0b565505a9a22c87728e18` against the commissioned base.
Fresh reviewer `0a594216-ae5b-4f76-8c6e-1615d23ec637` was explicitly pinned
to Sol, and native agent metadata reported `gpt-6.1-sol`. The reviewer found
the standalone closure and flow source-grounded, the private protocol and
close helper plausibly compatible, and no scope deviation or specific issue.
It explicitly preserved the production/native/performance and owner gates.
The existing frame premise is unchanged; the historical frame verdict is not
silently extended by this source/contract review.

The child was independently verified clean at its delivered commit and had no
attached automation. After integration and review it was archived. No unfinished
work was discarded and no old session was resumed. The closing commit adds
only the actual verdict and review/disposition metadata, with normal hooks;
the reviewed design recommendations remain unchanged.

### Remaining decision and stop

After review, the owner can accept or reject the trusted-mapper premise.
Production boundary fit, complete first-case native/browser inputs and
numerical acceptance still block dependent implementation. A required frozen
break needs its specific superseding decision and version treatment, not an
experimental-config exception.

The child proposes a separate Meta case-and-limit document packet under
R-013/060-01, returning acquisition/observation feasibility, required private
inputs, graph and performance-limit manifest, or one precise unavailable
input/control. That packet is not dispatched. No browser, SDK/vendor request,
capture, deployment, account change, consent-policy change, old-case retry,
implementation or automatic successor follows from this wave.

## 11. Owner decision and Meta case/limits wave

The owner approved the trusted-first-party mapper decision on 2026-11-02 with
ADR-0043 open and commissioned continuation into the bounded Meta case-and-limits
document packet. This selects C with D's required browser admission and
independent evaluation, without malicious-mapper resistance or a second verifier
by default. It does not establish production fit, native/browser qualification,
numerical acceptance, implementation readiness or any live permission.

Starting base: clean `6e61709f1f8c1211a00c2d12ad84ae347fcf8c7d` on
`google-meta-orchestration`. The coordinator, ADR frame reviewer, case/limits
writer and independent document reviewer are explicitly pinned to
`gpt-6.1-sol`. No implementation lane is commissioned.

The coordinator prepared the owner-approved ADR text, refreshed its Sol frame
verdict and accepted it through Jig's mechanical gate. The reviewed draft blob
was `531f64bfaaed92ce3a62a744cee92a40dbbff705`; the canonical
[frame verdict](../decisions/reviews/adr-0043-frame-critique.md) preserves the
residual trusted-mapper risk and all remaining readiness gates.
The case writer is a new
isolated native child, `80becd6a-c6fd-410c-81a0-8c72082fcd30`, based on that
committed starting point, with creator coordination and completion notifications.
It writes only the Meta case/limits subsection of R-013. No old session is
restored or re-tasked.

The newly commissioned document checkpoint is one manifest or precise blocker,
or 60 active minutes maximum. No old case/spending grant, numeric credit ceiling
or hard native timer is inferred. No private inputs were supplied with the
approval. Missing current ownership, source/response originals, observation
controls or numerical evidence must become a concrete symbolic owner request,
not private-file discovery, guessed values or another infrastructure project.

Acceptance and document-review dispositions, integrated commits and verified
child disposition are recorded below. All uncommissioned capture,
deployment, account, consent-policy and implementation actions remain blocked.

### Results and concrete blocker

| Item | Result |
|---|---|
| Architecture | ADR-0043 Accepted by Jig with refreshed Sol frame evidence; persisted at `319120f8a72f7092f78764db8e284fdd2a37250c`. Accepted text is immutable after that transition. ADR-0044 remains Proposed. |
| Case/limits document | [R-013 manifest](../research/R-013-google-meta-first-journey-evidence.md#meta-case-and-limits-manifest) classifies inputs, graph/response/host effects, originals/derivations, controls, route/stop/cleanup duties and numerical fields. All unmeasured acceptance values remain unset. |
| Original child commit | `a4e399354ba55a865826023c0136521291f8951f`, direct parent is the commissioned base; only a 219-line Meta subsection insertion, no deletions or Google/global edits |
| Integrated case commit | `ec6dee01d97034e4db1d4db343ff5210a622bf0f` |
| Model / accounting | Explicit Sol kickoff; child reports matching exposed runtime metadata and about 7 minutes wall time, not measured active time or credits. Normal hooks reported no leaks. |
| Product/readiness state | No source, frozen interface, consent, live permission, first-journey criteria or slice state changed. Production boot/unload fit and numerical/native/browser readiness remain open. |

**First blocker:** no explicit current `<META_CASE_INPUT_BUNDLE>` was supplied.
The minimum bundle privately binds:

- The owned page/Pixel and current resource owners, exact command/page/config/
  consent/browser/profile state.
- Available original source/capture handles with provenance and completeness
  limits; historical document references are not discovery permission.
- Whether only retained originals exist or an owner-operated capture is
  proposed. For the latter, a concrete procedure, operator, independent stop/
  cleanup owners and existing observation/enforcement proof or its exact absence.
- Proposed paired measurement conditions and method, leaving numerical results
  and acceptance unset until evidence supports them.

All complete-case acquisition alternatives remain blocked in the retained
records. The manifest distinguishes historical acquisition ceilings from
replacement performance budgets and present grants. Unknown branches are not
zero, an unspent historical slot is not executable permission, and owner
operation waives no safety gate.

The useful retained-record extraction is complete. Further progress requires
an explicitly supplied, authorized local bundle or its exact unavailable
input/control. Do not start another research/runner project to avoid that
blocker. No further packet or live action is commissioned by this handoff.

### Independent review and stop

**Document verdict: pass.** Fresh Sol reviewer
`74249d58-a91c-4cf1-b6af-5f122369ae96` reviewed checkpoint
`95b21aff126584df83d4e3e0ddf64950c558d240` against the commissioned base,
with complete aggregate and original child patches supplied. Native agent
metadata reported `gpt-6.1-sol`, matching the explicit launch pin.

The review found no specific issue or scope deviation: the eight changed
documents distinguish the symbolic case, complete observation requirements,
evidence layers and missing numerical inputs, while limiting architecture
acceptance to the owner-selected trust choice. The original child changed
only its 219-line Meta manifest subsection. This is a document-fidelity pass,
not source, browser, native, performance, production or implementation
qualification. The actual verdict is also preserved as a coordinator session
artifact.

The original child worktree was independently verified clean at
`a4e399354ba55a865826023c0136521291f8951f`, with no attached automation.
After integration and review, the finished child was archived. No unfinished
work was discarded and no prior vendor session was resumed.

Closing changes record only the verdict and verified disposition. The accepted
ADR is unchanged after `319120f8a72f7092f78764db8e284fdd2a37250c`; no slice,
source, consent or live grant changed. The retained-record document work stops
at the explicit current input-bundle blocker above. No automatic successor is
scheduled or started.

### Standing owner confirmation after the document handoff

On 2026-11-02 the owner confirmed that the existing Meta test Pixel remains
available, unchanged and reserved exclusively for this POC. The owner will not
modify it unless requested. This confirmation is now the standing setup record;
do not ask the owner to repeat it unless there is an actual change,
contradictory observation or proposed setup change. Do not expire it merely
because a session or date changed.

Pixel availability/current-setting attestation is no longer a missing owner
input. Remaining private case bindings, original evidence and technical
qualification are separate. The confirmation does not authorize modifying the
Pixel, running the SDK/browser or sending vendor traffic. The scratch case
record carries the same confirmation, without private identifiers.

## 12. Autonomous offline checks and fixture defect

The owner asked to continue through the remaining list, stop only for required
input, and report at least hourly. The same-conversation hourly reporter was
configured and verified as reporting-only, with no worker or run authority.
It was paused at the initial owner-decision blocker and restored after explicit
approval. It reports during active work and pauses when a real owner decision
is pending. No app-wide job or peer scheduler was created.

### Actual offline results

| Check | Result and limit |
|---|---|
| Five Meta/host Node files | Exit 0: 189 pass, zero failures, runner duration 1.79s. Synthetic values, fake transports and first-party Node worker protocol; not actual browser/native/performance evidence. |
| Two local fixture/control files | Exit 1: 50 pass, one failure, runner duration 8.44s. Controlled browser events plus literal-loopback Node HTTP; Chrome was not launched. |
| Failure | The independent source-import traversal expected 200 for `/connectors/meta-pixel/pageview-data.js` but received 404. The adapter imports that tracked module; the fixed fixture source catalogue omits it. |
| Fresh default branch | Fetched `origin/main` is `a4008d5ddb8f10b459500921bf974a064de2beca`; neither the fixture nor its test exists there. Missing unmerged code is not a resolved bug or a trunk reproduction. |
| Existing browser procedure | Source pin is Chrome 156.0.8078.48; installed application plist reports 156.0.8078.76. Metadata only, no browser acquired and no pin changed. The historical procedure also requires owner-supervised loss/cleanup acknowledgement, not unattended qualification. |

[Bug 002](../bugs/002-local-fixture-import-closure.md) is ROOT_CAUSED, not fixed.
The Terra writer reproduced the first 404 using the smaller existing regression
selector and recorded hypotheses, history/reuse and affected call sites.
Its commit `82f9f1b9b74ccf5b54c11480e314e94b4ae084eb` contains only the
diagnostic record and is integrated as `dfc9338`.
At that diagnostic checkpoint no fixture, test, source policy, limit, browser
pin or accepted ADR changed.

### Specific owner decision required

Jig's `ROOT_CAUSED -> FIXING` gate requires a reproducing fresh-main check.
The helper's arbitrary reference string does not turn an integration-only
result into a main reproduction. The worker attempted the transition, received
the missing-main-evidence refusal and stopped without bypassing it or recording
a false result. The preserved repro is on the intentionally selected integration
baseline `201413a036be3e2e5d7565d30efcc4abf2cbec34`.

The coordinator requested one narrow exception: for Bug 002 only, replace
the inapplicable fresh-main reproduction with that pinned integration-baseline
check, using `JIG_BUG_MAIN_CHECK_GATE=0` for that transition only. Diagnosis,
closure inventory, witnessed red/green tests and independent Sol bug, craft and
security reviews remain mandatory. The initial owner-input tool returned
unavailable, not consent. The owner subsequently replied "yes, approved" to
that exact request on 2026-11-02. The one-bug, one-transition exception is now
authorized; no other gate, browser limit or execution permission is changed.

The preserved child `79d223bc-7914-4cc7-bbf6-41fe42244cdf` was resumed on the
same Terra assignment with the explicit owner decision. It must record the
exception, retain truthful trunk absence, witness red/green through Jig and
return a bounded patch for fresh Sol bug/craft/security reviews. It is not
archived or claimed finished. Hourly reporting-only updates are restored during
active work. No automatic browser or Meta run is scheduled. Pixel availability,
unchanged settings, POC reservation and its private binding are already supplied.

### Source correction and pending review

The Terra writer recorded the approved exception and used it once, with
command-local scope. Jig witnessed the original regression red; no main result
was invented and no other gate was bypassed. The first exploratory catalogue
correction exposed a controlled-workload limit conflict: 68 Meta and 74 Google
requests exceeded the existing 64-request cap. That provisional patch was
removed and preserved only as diagnostic evidence, not a green fix.

The Sol coordinator selected a smaller transport-only preflight using one fixed
inert `/preflight` document. The resulting source correction is integrated at
`1ebc2afa9c0b604058559b29c1184385e95396c0` from the child's
`a9fcce09efe96ab4815487a817cfa5b5f90845d4`:

- Serve all 29 fixed first-party module paths and hash the inert control page
  alongside the two product pages.
- Preflight admits its control document and existing canonical control request
  only; product documents, modules and workers are denied there. It loads no
  product controller just to test receiving.
- Product and failure phases keep complete per-realm module observations,
  existing positive/negative/error/correlation/cleanup controls and the
  independent actual-import traversals. Every actual request is still counted.
- The controlled model now records 56 Meta and 60 Google requests, seven
  measurement/control attempts each, with unchanged 64/8, byte, time and socket
  bounds. These are controlled-event counts, not measured Chrome behavior.

Both fixture test files pass all 58 tests on the correction. The original
graph selector also passed through `tdd.py`. The normal REVIEWED transition
will independently witness green after all required reviews. Targeted lint
passed using isolated, lock-matching dependencies with install scripts disabled
and a byte-identical repository config. No manifest, lockfile or shared install
was changed; exact tool-path receipts stay private.

Fresh Sol bug, craft and security passes all returned pass at source checkpoint
`41f2abe40e297068215c718bad9bb7b0604f8e70`; actual verdicts are recorded in
`docs/bugs/reviews/`. The security pass was heuristic read-only inspection with
no scanner run and no reportable findings, not assurance of vulnerability
absence. Normal Jig green and VERIFIED transitions then passed without any
further bypass. The original reported repro returned 12 passed, zero failures.
Its gnarly/security classification was retained, and the normal DONE gate
subsequently passed with the recorded learning. The bug board is regenerated
from the final record; no source or review gate was bypassed after the one
explicitly approved entry exception.
No runtime mapping, consent, frozen API, Chrome pin, native policy or historical
DONE record changed. The real-browser `.48` versus installed `.76` admission
problem and owner-supervised loss/cleanup requirement remain separate.

## 13. Shared-host live-consent correction

The next local safety item was the already identified deferred-consent gap.
A fresh Terra child, `1d4cccb7-9d17-48d5-9fff-2b6e7a3a62f5`, started from
clean `ebec3fc9cf25ef09af018edbe422e55b4a7e52cc`.
Its source commit `498b13196d9fc089e7447450e33457871ac3f9ba` is integrated
as `de29009761bc42939a3eade697d2e8f0c747023c`. Only the shared host, its
existing unit test file and [Bug 003](../bugs/003-shared-host-live-consent.md)
changed.

### Actual reproduction and bounded fix

The deterministic fake-chamber/fake-capability probe revoked consent after the
early host gate but before its Promise continuation. The old host still invoked
the capability once and returned status 200. It genuinely reproduced on freshly
fetched `origin/main@a4008d5ddb8f10b459500921bf974a064de2beca` in a clean
temporary checkout. Normal diagnosis, main-check and witnessed-red FIXING
gates ran without any bypass. Bug 002's one-time exception was not reused.

The host now reapplies its existing purpose decision inside the deferred
callback, preserves its existing personalization split and checks again after
the injected strip diagnostic. It counts `mainDispatch` at capability
invocation. The fixed fake probe records zero calls, held status 0 and zero
dispatch count; later grant does not replay the held request. Already-issued
work remains distinct.

This is the host-controlled capability boundary, not a guarantee of final wire
authorization inside an independently asynchronous capability. It does not
cancel already-issued requests or change strict/cookieless policy, grants,
endpoints, consent retention, vendor semantics or frozen signatures. No real
resource identifier or external transport is used by the reproduction.

### Integrated validation and review state

The source writer's affected-caller selection passed 237 tests across eight
files and targeted lint. The coordinator expanded the integrated selection to
the two corrected fixture files and frozen contract guards: all 331 tests across
11 files passed, and both changed JavaScript files passed targeted lint using
the isolated locked tool installation and unchanged config. These are local
Node/fake-transport/loopback results, not browser/native/performance evidence.

Fresh Sol craft and security reviews passed the source at `601b1af`. The first
bug-review pass requested an accurate broker-coverage attribution, not a source
change. The coordinator corrected the record, ran the actual two broker test
files (16 passed), and the same independent reviewer passed the doc-only
correction at `e3b2c6e`. The extra tests validate the unchanged broker itself;
they are not composed host/broker consent proof. Security was heuristic static
inspection, no scanner and no reportable findings.

Normal green REVIEWED and original-repro VERIFIED transitions then passed.
Actual verdicts and the learning were recorded, then the normal DONE gate passed.
The bug has a real fresh-main reproduction and no workflow exception.
The source/real-browser pin mismatch, supervised-only loss mode and full Meta
case qualifications remain separate; no browser, SDK or vendor job is admitted.
