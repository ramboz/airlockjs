> Status: Draft (wizard-generated)
>
> **Changes to this file require explicit human approval.**
> Set `JIG_CONVENTIONS_APPROVED=1` in your shell session before editing, or the
> spec-gate hook will block the edit.

# Conventions: airlock

> Each rule below uses the format: **Rule** → **Why:** → **How to apply:**.
> Add rules as the project encounters real decisions worth recording.

## Documentation

**Rule:** Every wizard-generated doc carries a `Status: Draft (wizard-generated)` marker at the top.
**Why:** Distinguishes generated stubs from deliberate content, so reviewers and agents know what is authoritative.
**How to apply:** scaffold-init adds this marker. Flip it to `Status: Stable` after 3–5 reconciled specs have validated the doc structure (via a `scaffold-stable` ADR).

**Rule:** Deferred decisions are explicit, not silent.
**Why:** Silent gaps get forgotten. Explicit `Deferred` markers turn unknowns into trackable items.
**How to apply:** Use a `> **Deferred — <reason>.**` blockquote in the section. Add a corresponding entry to `docs/refinement-todo.md` with a resolution trigger.

## Decisions

**Rule:** Accepted decision records are append-only — never erased. Once a record
in `docs/decisions/` is `Accepted`, correct it by striking the stale wording
(`~~old~~`) with a date and reason, or by superseding it with a new record
(`Supersedes: ADR-NNNN`) — never by deleting or overwriting the original. A
`Proposed` / draft record is still a working draft: edit its body inline.
**Why:** `docs/decisions/` is the audit trail of *why* the project is shaped the
way it is. When superseded reasoning is silently swapped for its replacement, a
later reader cannot tell carefully established reasoning from a quiet edit, and
the record stops being trustworthy — especially when an option was rejected *on*
the reasoning that got erased. A draft record carries no such trail yet, so
locking it down only invites churn.
**How to apply:** While a record is `Proposed` / draft, edit freely. Once it is
`Accepted`, treat its body as immutable: strike-and-date, or open a superseding
record. Git history is the deep audit trail; the struck-through prose is the
one a reader sees without digging.

## Specs

**Rule:** Every non-trivial change starts with a spec, SPIDR-split into vertical slices.
**Why:** Specs as contracts at the right granularity let humans and agents work in parallel without constant re-alignment.
**How to apply:** Run `/jig:spec-workflow` (when implemented), or write `docs/specs/NNN-<slug>/spec.md` by hand using the SPIDR template. Each slice must touch the user-facing layer (no horizontal phasing).

## Research

**Rule:** Open investigations live as research notes at `docs/research/R-NNN-<slug>.md`
(adopting jig's ADR-0054 convention); executable probe code lives under `probes/`, and the
note — not the probe directory — carries the findings.
**Why:** Research that precedes any named decision has no other home: the inbox holds thin
one-liners, `refinement-todo.md` holds *named deferred decisions with triggers*, and spike
slices live inside already-shaped specs. A durable, citable home lets ADR Assumptions ground
on executed probes (`[Grounded by executed probe: … see R-NNN]`) instead of unverified claims.
**How to apply:** Copy [docs/research/TEMPLATE.md](research/TEMPLATE.md) to the next unused
`R-NNN` (numbering is local-and-cheap, no reservation) and add a row to the hand-maintained
[index](research/README.md). When the investigation crystallizes, promote it into the right
artifact (refinement-todo entry / ADR / spec), cite `R-NNN` in that artifact's Context, and
flip the note to `CONCLUDED` with a `Promoted to:` line (`ABANDONED` + `n/a` if it goes
nowhere). Probe directories keep a thin README pointing at their note and how to run.

## Code style

> **Deferred — no signal from initial pitch.** Will be filled in as the project
> encounters style decisions worth recording. Each addition follows the
> Rule/Why/How format above.

## Testing

**Rule:** Tests run on **vitest**. Servo-scored oracle components live under `test/`.
**Why:** Settled at vision level (product-vision § Stack, architecture § Tech stack); one
runner keeps unit suites and the servo oracle harness consistent. See
[refinement-todo.md](refinement-todo.md) § Testing (RESOLVED 2026-08-25).
**How to apply:** Use vitest for unit and integration suites. Exact vitest config and the
`oracle.sh` component wiring (`ga4_mp_conformance`, `cwv_budget`, `isolation_invariant`) land
with the first spike spec. Browser-level oracles (Lighthouse, flicker) need a separate
browser-automation harness, tracked in the
[MVP1 architecture review](reviews/2026-08-25-mvp1-architecture-review.md) (finding G4).

## Git

**Rule:** Commit **directly to `main`** (no feature-branch or PR flow). Every commit message
follows **Conventional Commits** (`type(scope): summary`).
**Why:** Solo greenfield repo; direct-to-main keeps the loop tight and is cheaply reversible.
Decided 2026-08-25; overrides the assistant's default "branch first" posture.
**How to apply:** Types: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`. See
[lightweight-decisions.md](decisions/lightweight-decisions.md) (2026-08-25). Changes to this
workflow require explicit human approval.
