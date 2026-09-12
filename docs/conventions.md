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

## Code

**Rule:** Extract a shared helper on the *third* caller (rule of three); inline-mirror the first two.
**Why:** Two occurrences are cheaper left inline than coupled through a premature abstraction; a third proves the shape is real and worth one governed source. Extracting too early invents indirection with no proven need; extracting too late lets copies drift. (This is a jig-ecosystem principle — the jig *plugin* records it as **its** ADR-0002; airlock adopts it as a **local convention**, deliberately NOT airlock's own [ADR-0002](decisions/adr-0002-event-descriptor-cycle-semantics.md) "Event descriptor shape and cycle semantics". Earlier specs (039/043/044) mis-cited a nonexistent `adr-0002-extract-helper-on-third-caller.md`; those citations now point here.)
**How to apply:** On a third byte-identical (or behavior-identical) copy, extract one shared primitive to the leanest correct home — a **vendor-neutral** leaf in `core/` only when it carries no vendor specifics (e.g. `core/cookie-parse.js`, `core/query-params.js`); **connector-side** when it encodes a vendor wire-shape (e.g. the Google Consent-Mode `gcs`/`gcd` encoders live in `connectors/consent-mode.js`, NOT `core/`, because `core/` carries no vendor coupling — see `docs/architecture.md`). Stop at the proven callers — do not generalize further (leanness). A genuine reuse (not duplication) MAY extract on the 2nd caller when a 3rd is imminent; record the call.

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

**Rule:** JavaScript is linted with **ESLint** (flat config, `eslint.config.js`) on the `@eslint/js`
**recommended** baseline — a real-bug ruleset (`no-undef`, `no-unused-vars`, `no-empty`,
`no-useless-assignment`, …), not a stylistic one. Run `npm run lint`; CI gates on it. Adopted 2026-08-31
(human-approved — see [lightweight-decisions.md](decisions/lightweight-decisions.md)).
**Why:** the source was written against the AEM/Airbnb habit (the scoped `no-empty` disables on busy-wait loops
predate the config) but was never actually enforced. A linter catches real defects — undefined globals, dead
code, unreachable branches — without forcing a repo-wide style cleanup. A stricter AEM/Airbnb ruleset stays a
**deferred** option (it would surface hundreds of purely stylistic findings — out of scope for "turn linting on").
**How to apply:** per-environment globals are set by glob in `eslint.config.js` (browser / worker / node /
vitest) — a chamber `*.worker.js` must **not** inherit browser globals, or `no-undef` would silently pass code
referencing a global the worker doesn't have. Prefer fixing a finding over disabling it; when a disable is
genuinely warranted (e.g. the intentional control-char regex in `core/sanitize-html.js`) scope it to the exact
rule + line with a one-line justification — **never** a whole-file `/* eslint-disable */`. Vendored trees
(`probes/`) and build output (`rig/out/`) are ignored, not linted.

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
