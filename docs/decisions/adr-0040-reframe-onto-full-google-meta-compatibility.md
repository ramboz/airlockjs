---
status: Accepted
dependencies: [adr-0017, adr-0038, adr-0039]
last_verified: 2026-10-15
frame_review: true
---

# ADR-0040: Full Google Ads and Meta Pixel replacement is the compatibility target

## Status

Partially superseded by [ADR-0061](./adr-0061-definition-of-done-vendor-compatibility.md) (2026-11-12): live-proof-per-slice and open-ended-parity clauses only.

Accepted (2026-10-15)

## Context

Google Ads and Meta Pixel must become complete replacements, not a larger collection of partial beacons.

The owner set the reference on 2026-10-15: a customer must be able to replace
the native tag with an Airlock chamber without losing collection or changing
attribution-bearing behavior. "The hard contract needs to be what is sent over
the wire to the official backend for all use cases." Additional mediated APIs
may be necessary, but security, isolation and Core Web Vitals remain drivers;
actual contradictions are brought back individually.

This is a parallel compatibility workstream, not a replacement for the
[Adobe-first release gate](adr-0038-reframe-onto-adobe-first-compatibility.md).
The current [vendor-assurance plan](../releases/vendor-parity-assurance.md)
already warns that scoped reports are not full equivalence. The change is to
commit preparation toward complete Google/Meta replacement rather than choose
one customer journey and leave the rest as an acceptable product boundary.

The older [parity contract](adr-0020-parity-contract-anti-drift.md) remains
valuable for scoped regression reporting. Its curated comparison and owned-gap
model cannot alone establish this stronger replacement claim. Its drift and
value-semantics warnings are preserved, not treated as solved.

The vision's no-cookie-writer premise must not silently exclude required vendor
identity continuity. Permission to investigate a governed vendor-cookie writer
is not permission to build a general identity-resolution service, expose an
ambient cookie jar, weaken the seal, or silently break the frozen API.

Initial owned setup now exists, but evidence is deliberately limited:

- Google has a dedicated Secondary test action and one synthetic conversion
  whose primary HTTP request carries the expected value/currency/transaction
  relationship. Auxiliary transport evidence is incomplete.
- The owner confirms Meta Test Events received a normal-browser PageView.
  The automated native run loaded runtime/configuration but observed no beacon;
  both stock and installed bootstrap variants reproduced that outcome offline.
- These observations do not establish chamber execution, complete collection,
  matching quality or attribution. Private selectors and original browser
  evidence remain outside Git.

## Decision Options Considered

### Option A: Extend the current curated-field connectors and call their scoped reports replacement parity

- **Pros:** Reuses the smallest existing implementation and evaluator.
- **Cons:** Can omit native commands, cookies, requests, DOM behavior or value
  relationships while reporting success. Rejected by the owner's requirement.

### Option B: Preserve the native tags on the main thread

- **Pros:** Keeps the vendors' implementation and update mechanism.
- **Cons:** Does not deliver the requested chamber reimplementation or remove
  ambient vendor authority and main-thread cost. Useful as a reference, not the
  replacement deliverable.

### Option C: Reimplement the complete native behavior behind governed chamber/host capabilities

- **Pros:** Targets the actual adoption contract while retaining Airlock's core
  principles and making incomplete behavior visible.
- **Cons:** Requires independent references, precise browser-side capabilities,
  feature-specific access, meaningful evaluations and continued drift work.
  Feasibility of every required behavior remains to be demonstrated.

## Recommended Decision

Propose Option C, recording the owner's target without claiming it is achieved.

1. **Complete target, staged construction.** Maintain a feature/command/options/
   browser-state inventory against official documentation and pinned native
   runtime plus remote configuration. Documentation-only enumeration is not
   proof of native completeness. Unknown or missing behavior remains unfinished;
   a DONE slice or owned gap never becomes full support by implication.
2. **The complete wire sequence is the hard contract.** Compare actual
   destinations, methods, query/body fields and multiplicity, browser-attached
   headers/cookies, credentials, redirects/fan-out, ordering, timing, retries and
   duplicates under equivalent inputs and browser state. Trace relationships
   across requests, responses, stored identity and later events. A mapper output,
   queued command, field-presence check or HTTP 200 is insufficient.
3. **Preserve value meaning.** Use explicit path-specific comparison rules for
   nondeterministic values, preserving identity continuity, timestamps, event/
   transaction references and normalized/hash input relationships. Equal
   redaction sentinels are not equal identities. Unexpected native fields or
   requests require classification, never silent exclusion.
4. **Matching and attribution are obligations, not wire synonyms.** Equivalent
   input data is necessary but does not prove equivalent vendor processing.
   Keep direct dispatch, receipt, matching, reporting and attribution evidence
   distinct. Lack of access, traffic or a product observation blocks that claim;
   the Adobe-specific reporting follow-up decision is not a Google/Meta waiver.
5. **Keep the chamber boundary.** Main-thread code captures approved inputs and
   fulfills narrowly declared browser operations; chambers interpret commands,
   maintain connector state, normalize/hash data and construct requests.
   Privileged dispatch and DOM/storage actions stay mediated. Timing-critical
   host behavior needs explicit contracts and measured budgets, not a transparent
   unrestricted DOM proxy.
6. **Investigate required capabilities rather than excluding features.** Include
   consent variants and changes, governed vendor-cookie creation/continuity,
   linker/form/navigation behavior, automatic collection, multi-destination
   routing, unload delivery and any native auxiliary transport. Google advanced
   consent is not equivalent to one observed hold-on-denied deployment. This
   decision does not implement or broadly grant any capability. A concrete
   security/performance/frozen-contract conflict gets its own bounded decision.
7. **Keep scopes distinct.** Browser Google Ads and Meta Pixel replacement does
   not mean reimplementing all of GTM, GA4, Floodlight or vendor backends. Their
   dependencies/coexistence and existing server-channel deduplication must still
   behave correctly. A server API is not a silent substitute for browser parity.
8. **Fail closed on evidence, not by hiding collection loss.** An evaluator needs
   a positive native reference and falsifiable negative controls. Empty traffic,
   missing provenance, aborted bodies and failed capture are inconclusive/
   blocked, never an empty-reference PASS. Upstream change makes assurance stale;
   it does not authorize automatically disabling a customer's live collection.
9. **Bound the current grant.** The owner approved preparation only: 25,000 AI
   credits shared across coordinator and two vendor sessions, with a four-active-
   hour checkpoint. It covers specs and recorder/evaluation qualification, not
   full replacement implementation, further live vendor events, campaigns,
   billing, production sends, releases or automatic landing. Cost observability
   and effective stop controls must be explicit; a written budget is not itself
   a hard metering mechanism.

Historical records remain unchanged. Frame review and the owner's recorded
decision gate acceptance; dependent work cannot treat a link as proof that
its remaining lifecycle or evidence prerequisites are satisfied.

## Re-baselining manifest

There is no future-work draft to retire wholesale. Adobe's 051-057 portfolio
remains owned by the Adobe workstream; no transition or scope change is made.

| Existing artifact | Disposition | Routed action after acceptance |
|---|---|---|
| ADR-0017 and ADR-0038/0032 | `reaffirm` | Preserve the stable core and Adobe release/acceptance scope; do not apply Adobe's reporting exception to these vendors. |
| ADR-0020, ADR-0022/0023/0024/0025, historical 026/038/044-050 records and reviews | `reaffirm` | Retain their historical bounded guarantees and findings. New specs carry the stronger target; no closed-record amendment is authorized here. |
| `docs/releases/vendor-parity-assurance.md` | `rewrite` | Add the full Google/Meta workstream and its unresolved completeness/evidence gates; preserve other vendors and customer assurance. |
| Vision, architecture, root README and CLAUDE primer | `rewrite` | Distinguish current subsets, the full replacement target and possible narrowly mediated API work; preserve Adobe focus and shipped behavior. |
| `docs/memory/glossary.md` | `rewrite` | Record spec-driven/evaluation-driven development and distinguish scoped comparisons from complete replacement assurance. |
| Refinement ledger and adoption guide | `rewrite` | Link cookie, transport, identity and report-honesty residuals to their new owners without marking them resolved. |
| Google Ads connector/chamber/boot surfaces | `retrofit` | [059](../specs/059-google-ads-full-compatibility/spec.md) owns the draft; runtime implementation remains outside this preparation grant. |
| Meta connector/chamber/boot surfaces | `retrofit` | [060](../specs/060-meta-pixel-full-compatibility/spec.md) owns the draft; preserve other generic-pixel vendors. |
| Shared parity/capture surfaces | `retrofit` | [058](../specs/058-native-tag-evaluation-qualification/spec.md) owns qualification; only reviewed local no-send work is in this phase. |
| Workflow, conventions, other vendors and closed release/research histories | `reaffirm` | No convention, historical evidence or unrelated runtime changes. |

The allocations are local/provisional until checked against trunk at integration.
They do not authorize runtime implementation under the preparation budget.

## Coverage floor

**Level 1 - authority classes:** enumerated all 32 ADRs plus their index, the 57
spec overviews and status board, top-level live docs, release plans, adoption
guide, research index, memory docs, root README and CLAUDE. Class-level search
covered Google/Meta, parity and cookie/identity scope terms. No project-owned
SKILL.md was found in root `skills/`, `.github/skills/` or `.claude/skills/`;
installed plugin skills are tooling and are excused from product re-baselining.
AGENTS.md is absent; CLAUDE is the primer.

**Level 2 - touched artifacts:** full reads of ADR-0017/0020/0031/0032 and the
current architecture/vision/vendor-assurance scope inform the authority cut.
Literal searches identify ADR-0018/0022/0023/0027-0030 and specs
026/038/044-050 plus related completed slices/reviews; these are retained as
bounded historical records, not asserted reverified. README, primer, glossary,
refinement and adoption matches identify the prospective live-prose updates.
Earlier research and all other specs remain unchanged. This is a targeted
authority read, not a full audit of every historical sentence or runnable code.

The method reduces and exposes enumeration risk; indirect or dynamically
referenced premises can be missed. A later conflicting current instruction
requires explicit reconciliation, not an edit to an Accepted record.

## Emergent work

- Shared local recorder/receiving-sink and no-send qualification with known-
  request, empty-reference, mutation and capture-failure controls.
- Separate Google and Meta full-compatibility specs with vertical slices,
  per-family evidence gates, browser matrix, rollout/rollback and drift policy.
- Bounded case-specific capability decisions where native behavior conflicts
  with a core invariant; no speculative general-purpose authority expansion.

## Consequences

**Becomes easier:**
- Agents optimize toward the customer's real replacement requirement.
- Full claims cannot be manufactured from a curated green subset.
- Two vendor owners can work independently on stable evaluation contracts.

**Becomes harder:**
- Some native behavior is undocumented or remotely configured.
- Matching/attribution and browser-specific behavior need separate evidence.
- Broad compatibility requires sustained capture refresh and maintenance.

## Assumptions

- The complete required native inventory can be discovered and discriminated by
  the planned evidence. This is not established by current documentation or
  initial smokes; unresolved discovery remains a blocking completeness risk.
- Required native browser behavior can be mediated while preserving security,
  isolation, performance and compatibility. Specific feasibility is unproven;
  owned/native reference success is not chamber proof.

## Kill criteria

- A required behavior cannot be evaluated or safely reproduced: stop that
  behavior for a case-specific owner decision; do not label it supported.
- The evaluation accepts an empty/partial reference or hides a material
  difference: invalidate the pass and repair qualification before optimization.
- Budget, time, access or mutation limits cannot be verified: stop the affected
  unattended work at a conservative checkpoint and report the limitation.

## Open questions

- Precise browser/version/cohort matrix and upstream drift-trigger policy.
- Meta's automated no-beacon observation and complete Google fan-out capture.
- Feature-specific account permissions and safely governed cookie/DOM/transport
  designs; the owner is asked only for actual demonstrated contradictions.
