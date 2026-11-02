# Starting a fresh Google/Meta orchestration wave

Start a new Sol coordinator from the committed planning branch. Give it one
bounded wave, use isolated children for work, and keep reviews on Sol.
Implementation stays on Terra. The tradeoff is the cost of strong independent
review in exchange for cheaper, tightly scoped implementation.

## Model routing

The owner selected this routing on 2026-11-02. These exact IDs are exposed by
the current Copilot runtime:

| Role | Model | Responsibility |
|---|---|---|
| Coordinator | `gpt-6.1-sol` | Scope, mission cards, integration, gates and handoff. |
| Architecture and ambiguous research | `gpt-6.1-sol` | Design alternatives and evidence-backed recommendations. |
| Bounded evidence extraction | `gpt-6.1-terra` | A specific source/evidence question with a fixed output. |
| Jig implementer | `gpt-6.1-terra` | One approved implementation packet and its bounded TDD work. |
| Every Jig reviewer | `gpt-6.1-sol` | Frame critique, compliance, craft, architecture and reconciliation; code-health judgment when required. |

Pin `model` explicitly on every `task` dispatch and every child session's
`kickoff`. Never rely on Auto or inheritance, including for nested reviewers.
This is the workstream's dispatch policy, not a change to global agent defaults.
If the runtime cannot honor an explicit model, stop that assignment and report
the unavailable choice rather than silently substituting another model.

The coordinator must not do the implementation itself to bypass Terra routing.
Implementers do not review their own work or launch lower-model review passes.

## Fresh start and base

- Use `create_session` with a new conversation and isolated worktree. Do not
  fork or copy the old conversation.
- Base the first coordinator on `google-and-meta-feasibility`, which contains
  the filed planning packet. Record the actual starting commit. Do not use the
  project default branch if it lacks those documents.
- Make the coordinator a new top-level session, independent of the old session.
  It will own its own child sessions.
- Start the coordinator in Plan mode on `gpt-6.1-sol`.
- Keep the old Google/Meta sessions paused. Their uncommitted verifier and test
  drafts are excluded from the new branch baseline and must not be copied in.

The coordinator starts by reading the
[work plan](google-meta-work-plan.md), [R-013](../research/R-013-google-meta-first-journey-evidence.md),
[R-014](../research/R-014-google-meta-request-authority.md) and Proposed
[ADR-0043](../decisions/adr-0043-google-meta-request-authority.md) /
[ADR-0044](../decisions/adr-0044-google-ads-consent-wait.md). Expand only the
specific existing slice needed for its current packet.

## First wave

The initial coordinator task is to propose mission cards and wait for owner
approval. It must not start research workers, implementation or validation
runs while preparing that plan.

The recommended first approved wave has two independent research outputs:

| Child | Model | One deliverable | Limit |
|---|---|---|---|
| Meta first-case evidence | `gpt-6.1-terra` | The Meta case card and gap/route recommendation in R-013, using the existing records and permitted public sources. Leave Google's case unresolved for its own packet. | 60 active minutes maximum; no browser, SDK, measurement traffic, account change or tool implementation. |
| Request-authority design | `gpt-6.1-sol` | The R-014 design recommendation and corresponding Proposed ADR-0043 update. No option is accepted by the worker. | 90 active minutes maximum; source/design only, no verifier or confinement implementation. |

Use separate child worktrees because both children write documents. The
coordinator alone updates the work plan, indexes and shared status board.
Use Copilot's native session messaging and completion notifications. No new
peer service, scheduler or recurring automation is needed.

After approval, the coordinator may run these two children in parallel because
their files and outputs are distinct. Each child stops after its artifact or a
specific blocker. The coordinator reconciles and integrates the handoffs;
required independent reviews use fresh Sol contexts. It then returns the wave
result for owner review and stops.

Google's R-013 case card is a later bounded packet, not an instruction to extend
the Meta child's assignment automatically.

## Implementation and review after the decisions

Only after the necessary decision acceptance and slice readiness:

1. The Sol coordinator writes one implementation mission card with a base
   commit, owning slice, acceptance criteria, allowed files, finite checkpoint
   and explicit targeted TDD commands.
2. Create an isolated Terra child, using the Jig implementer and Plan mode
   when its implementation plan needs approval. Explicitly stack it on the
   coordinator's approved branch when it depends on that branch's work.
3. The Terra implementer returns a commit/patch, changed-file manifest and
   local red/green evidence. It does not choose the next feature.
4. The coordinator verifies the integrated state with the smallest relevant
   checks. Do not repeat full suites for each worker or reviewer.
5. Dispatch fresh Sol reviewers through the normal Jig workflow. Pass only
   the owning spec, exact source state/diff and relevant evidence, not the
   implementation conversation.
6. Record the required verdicts before lifecycle transitions. A failed gate
   returns a bounded remediation packet to Terra, then invalidated reviews
   are repeated on Sol. Do not weaken the original criteria.

Use `gpt-6.1-sol` for every required reviewer, including reviewers launched by a
richer review skill. Honor that explicit owner choice over a skill's default
model mix. Keep owner ADR acceptance and any live-run authorization separate
from an agent's technical verdict.

## Completion and handoff

A session's task is its assigned packet, not the entire Google/Meta replacement
programme. It completes when the bounded output is verified, or ends with the
specific blocker and preserved work. Missing permission or evidence is not a
reason to invent another task to keep the session running.

At the end of each wave, record the integrated commit, artifact links,
evidence/limitations, child dispositions, actual model routing and the proposed
next packet in the work plan. The next coordinator can start fresh from those
files. No chat-history replay or automatic successor is required.

No browser, vendor traffic, deployment, account mutation, campaign/spend,
consent-policy change or old-case retry is authorized by starting orchestration.
Implementation remains blocked on the existing readiness and owner decisions.

## Initial coordinator prompt

```text
Coordinate one bounded Google/Meta wave from the committed repository.
Read docs/releases/google-meta-orchestration-start.md and its work-plan links.
Use gpt-6.1-sol for orchestration, architecture and every Jig review.
Use gpt-6.1-terra for implementation and bounded evidence extraction.
Pass model IDs explicitly at every worker and reviewer dispatch.
Do not fork the old conversation or resume its paused sessions.

First, record HEAD and propose the two research mission cards from the launch
guide. Stay in Plan mode and wait for owner approval before creating children.
Do not execute the research or implement a verifier as part of this first turn.
No browser, SDK, vendor traffic, deployment or new live authority.
After the approved wave's verified handoff, stop; do not start a successor.
```
