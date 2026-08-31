# Lightweight Decisions

> Status: Draft (wizard-generated)

Small shipped decisions that fall outside spec slices but carry durable rationale:
brand/icon swaps, cosmetic CSS polish, UI string or translation choices, scoped
visual decisions, and "future sessions should/should not override this" notes.

## Routing rubric — where does this decision land?

Triage each settled decision to exactly **one** home:

| Route | Criterion |
|---|---|
| **ADR** | A load-bearing design choice with rejected alternatives — one a future agent would need to know about to avoid undoing it — warrants an ADR even when it changes no module boundary or public contract. Also: any change to a module boundary, public contract, or cross-cutting policy. |
| **Lightweight record (here)** | Settled, local, bounded (one screen / component / string / asset), with no real rejected alternatives — and a future agent would need to know it to avoid undoing it. |
| **`refinement-todo.md`** | Still *open* — has a resolution trigger; not shipped yet. |
| **Drop (write nothing)** | Ephemeral / trivial / already obvious from the code or a commit message. |

The **ADR** row's trigger sentence is single-sourced — the *same* wording appears
in both reconcile checklists and the memory-sync session-end prompt, so the "when
is an ADR required?" policy can't drift across surfaces.

Record a lightweight entry with the helper (idempotent append):

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/skills/memory-sync/decisions.py" add-lightweight \
  --title "<short title>" --decision "<what>" --context "<why>" --scope "<where>"
```

## Template

```markdown
### [Date] — [Short title]

**Decision:** _what was decided_

**Context:** _why — constraint, user feedback, design call_

**Scope:** _which screen / component / string / asset — not product-wide_

**Commit:** _optional — git SHA or PR; may be added retroactively_
```

This matches what `decisions.py add-lightweight` emits (one blank line between
fields), so the documented shape and the helper output agree.

---

## Entries

### 2026-08-25 — Commit directly to main; Conventional Commits

**Decision:** All work commits directly to the main branch (no feature-branch or PR flow), and every commit message follows the Conventional Commits format: type(scope): summary (types e.g. feat, fix, docs, chore, refactor, test).

**Context:** User direction 2026-08-25 at scaffold time. Solo greenfield repo — direct-to-main keeps the loop tight and is cheaply reversible; the rejected alternative is a branch-and-PR flow. Overrides the assistant's default 'branch first on the default branch' posture for this project.

**Scope:** Repo-wide VCS workflow (all commits in this repo)

### 2026-08-26 — esbuild pinned exact (0.21.5), no caret

**Decision:** devDependency "esbuild": "0.21.5" is an exact pin, unlike the sibling caret ranges.

**Context:** Slice 004-02's bundle assumptions were probe-grounded against exactly 0.21.5 (no auto worker bundling; literal new URL worker reference preserved), and build.mjs's layout assertions are calibrated to that behavior. A silent minor bump could change worker-reference rewriting and invalidate the 004-01 CSP envelope enforcement.

**Scope:** package.json devDependencies; revisit deliberately (re-run npm run build + rig:bundle) when bumping esbuild

### 2026-08-31 — Adopt ESLint (flat config) on the recommended baseline

**Decision:** JavaScript is linted with ESLint 10 (flat config, `eslint.config.js`) on the `@eslint/js` **recommended** ruleset — a real-bug baseline, not a stylistic one. `npm run lint` runs it; CI gates on it. Per-environment globals are set by glob (browser / worker / node / vitest); vendored `probes/` and build output `rig/out/` are ignored. Whole-file `/* eslint-disable */` is disallowed — the one that lived in `connectors/alloy/alloy-chamber.worker.js` (from the read-only 014-01 era) was removed; disables must be scoped to a rule + line with a justification.

**Context:** User direction "add the linter now" (2026-08-31) resolved the long-`Deferred` Code-style convention. Spec 021-03 had assumed a linter already existed (from the AEM/Airbnb-flavored disable comments); grounding at implementation showed none was ever wired. Chose `recommended` over the heavier AEM/Airbnb ruleset deliberately: it catches genuine defects (undefined globals, dead code, unreachable branches) without a repo-wide stylistic cleanup. The stricter ruleset remains a deferred option. This is a convention change, made with explicit human approval per CLAUDE.md.

**Scope:** repo-wide JS linting (`eslint.config.js`, `npm run lint`, CI); see [conventions.md](../conventions.md) → Code style. Delivered under spec 021-03.
