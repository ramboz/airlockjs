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

**Review status:** proposed work order, awaiting owner review. Both vendor
sessions are stopped. No implementation, research execution, browser run,
capture, deployment or autonomous loop is authorized by this document.
The owner's planning request does not renew earlier case or budget grants.

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
| 2 | Request authority design, [R-014](../research/R-014-google-meta-request-authority.md), consuming the first journeys' integrity criteria | A threat model, alternatives and a recommendation in Proposed ADR-0043 on whether a runtime verifier is needed. Identify main-thread work and performance costs. | One read-only session, at most 90 active minutes. No verifier implementation or new confinement framework. |
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
| Request integrity, mapping and egress authority | 059-01 and 060-01 | [Proposed ADR-0043](../decisions/adr-0043-google-meta-request-authority.md) is filed. R-014 supplies its recommendation; no architecture option is selected. Do not accept the unfinished two-worker experiment by default. |
| Consent wait, retention and replay | [059-03](../specs/059-google-ads-full-compatibility/slice-03-consent-journeys.md) and [060-04](../specs/060-meta-pixel-full-compatibility/slice-04-consent-processing.md) | [Proposed ADR-0044](../decisions/adr-0044-google-ads-consent-wait.md) tracks the specific Google wait question. Preserve current behavior until evidence and owner policy review select a recommendation. Meta semantics remain separately owned by 060-04. |
| Cookies, credentials, DOM and lifecycle capabilities | Existing feature slices | The [pending-decision register](../refinement-todo.md#googlemeta-pending-decisions-2026-11-02) tracks each capability and its promotion trigger. Draft its ADR when a named journey supplies a concrete choice; do not prebuild a general API. |
| First replacement paths | 059-01 and 060-01 | Reuse their full acceptance criteria. Refine them after the research and review; no duplicate first-journey specs. |
| Local prototypes and completed qualification tools | DONE slice records | Preserve their historical results and limitations. No amendment or requalification is performed in this planning pass. |

The research and decisions are now filed, rather than left as future document
creation tasks. Existing product specs remain their implementation owners.
Neither new ADR selects an architecture or policy; both await evidence and
review. Their numbers are provisional local allocations, not trunk reservations.

### Filed artifact register

| Artifact | State | Next review or consumer |
|---|---|---|
| [R-013: first-journey evidence](../research/R-013-google-meta-first-journey-evidence.md) | OPEN, planning only | Owner-selected research sessions; then 059-01/060-01 case review. |
| [R-014: request authority](../research/R-014-google-meta-request-authority.md) | OPEN, planning only | Owner-selected research session; update ADR-0043. |
| [ADR-0043: request authority](../decisions/adr-0043-google-meta-request-authority.md) | Proposed, no option selected | R-014 recommendation, independent frame review and owner decision before the first full implementations. |
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
