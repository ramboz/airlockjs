# Research notes

> Research notes are the home for the **open investigation phase** — the
> stretch *before* a decision is even named, when you are gathering sources,
> weighing pros/cons, and holding open questions on an idea that isn't yet
> attached to any committed build. This project adopts jig's
> [ADR-0054](https://github.com/ramboz/jig/blob/main/docs/decisions/adr-0054-research-notes-artifact-convention.md)
> convention. A research note is **not** a decision (that's an ADR,
> `docs/decisions/`) and **not** committed work (that's a spec, `docs/specs/`).
> It is **sequential with, not a competitor to**,
> [`docs/refinement-todo.md`](../refinement-todo.md) — refinement-todo holds a
> *named deferred decision + resolution trigger*; a research note is the open
> phase that *feeds* one. A note *promotes into* a refinement-todo entry, an
> ADR, or a spec once it crystallizes (see Hand-offs below).

## Living notes

Living notes are `docs/research/R-NNN-<slug>.md`, numbered from `R-001`.
Create one by copying [`TEMPLATE.md`](TEMPLATE.md).

Numbering is **local-and-cheap**: an `R-NNN` number is **not** reserved on
`origin/main` the way spec and ADR numbers are. A concurrent-session collision
is a harmless nuisance, reconciled by hand at promotion time. There is no
`research.py` helper, no index-regen, and no reservation apparatus (deferred
per ADR-0054 pending a real trigger).

**Probe code.** When an investigation runs an executable probe (a harness, a
testbed), the code lives under the repo-root `probes/` directory and the note
carries the findings — the note is the single source of truth; the probe dir
keeps only a short README pointing back at its note and how to run it.
(`probes/`, not `spikes/`: in jig vocabulary a *spike* is a SPIDR slice inside
a spec, never a standalone artifact; *probe* is the grounding-by-probe term
for executed evidence.)

This index is **hand-maintained** — there is no regen helper. Add a row when
you create a note; update its status/promotion when it resolves.

| ID | Topic | Status | Related / Promoted to |
|----|-------|--------|------------------------|
| [R-001](R-001-worker-egress-unload.md) | fetch keepalive + worker lifetime at page unload | CONCLUDED | [ADR-0002](../decisions/adr-0002-event-descriptor-cycle-semantics.md); arch-review R2 |
| [R-002](R-002-ga4-debug-endpoint-oracle.md) | GA4 `/debug/mp/collect` as a conformance oracle | CONCLUDED | arch-review G4; oracle design (drive-order step 8) |
| [R-003](R-003-partytown-mechanism-check.md) | Partytown mechanism accuracy (AD-4 justification) | CONCLUDED | n/a (validated AD-4 as-is) |
| [R-004](R-004-alloy-in-worker.md) | Alloy (AEP Web SDK) in a no-DOM Worker chamber | CONCLUDED | [ADR-0001](../decisions/adr-0001-chamber-isolation-strength.md); capability contract (step 5); probe: [probes/alloy-worker](../../probes/alloy-worker/) |
| [R-005](R-005-eds-no-flicker-eager-swap.md) | EDS no-flicker eager swap mechanism + timing | CONCLUDED | UC-1 spec (arch-review G1); OQ6 flicker oracle; probe: [probes/eds-testbed](../../probes/eds-testbed/) |
| [R-006](R-006-cross-chamber-cookie-coherency-mechanisms.md) | AD-4-compatible sync host-access + cross-chamber cookie coherency mechanisms | CONCLUDED | [OQ9](../refinement-todo.md); [spec 011](../specs/011-mvp2-coherency-probe/spec.md) (scope + option set); [ADR-0001](../decisions/adr-0001-chamber-isolation-strength.md) |
| [R-007](R-007-real-prod-stack-breadth.md) | Real prod martech stack (21 tools) classified by airlock-fit — breadth-validation benchmark | OPEN | [mvp4](../releases/mvp4.md); [mvp5](../releases/mvp5.md); [R-008](R-008-costly-dom-martech-containment.md) |
| [R-008](R-008-costly-dom-martech-containment.md) | Containing costly-DOM martech (the INP/CWV thesis) — 3 levers; worker-dom-compat / govern+schedule strategy | OPEN | [spec 022](../specs/022-helix-rum-connector/spec.md); nasty-tag POC (next); [R-007](R-007-real-prod-stack-breadth.md) |

## Hand-offs

Two documented hand-off directions, both convention-enforced (no linter, no
enforcement machinery):

**Inbox → note.** When an investigation captured as a
[`docs/inbox.md`](../inbox.md) entry grows thick, don't swallow the whole
thing inline — inbox entries should stay thin, one-liners. Instead, move the
depth into a research note and leave a one-line pointer in the inbox, e.g.
`[date] exploring X → R-004`.

**Note → decision / work.** When a note crystallizes, it promotes into the
right existing artifact:

- a [`docs/refinement-todo.md`](../refinement-todo.md) entry, if it lands on
  a *named deferred decision + trigger*;
- an ADR (`docs/decisions/`), if it lands on a decision to make now;
- a spec (`docs/specs/`), if it lands on committed work.

The downstream artifact cites `R-NNN` in its Context section. The note itself
flips its frontmatter `status` to `CONCLUDED` and gains a `Promoted to: …`
line pointing at the downstream artifact. If the investigation goes nowhere,
the note flips to `ABANDONED` instead, with `Promoted to: n/a`.
