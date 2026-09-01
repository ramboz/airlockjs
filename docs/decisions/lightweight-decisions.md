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

### 2026-08-31 — RUM is a distinct governance class: confined, not consent-gated

**Decision:** The `helix-rum` connector's egress is governed as **performance telemetry**, not marketing analytics: airlock confines it (endpoint ceiling pinned to `ot.aem.live` + a payload-hygiene guard) but does **NOT** put it behind the consent seam (`egressVerdict(..., {strict})`) that gates GA4/alloy. RUM beacons fire regardless of consent.

**Context:** Maintainer direction (2026-08-31): "RUM is not consent gated. It's fully PII compliant and not subject to consent." Grounded against `sampleRUM` (eds-testbed `aem.js`): sampled, an **ephemeral per-page** `id` (`crypto.randomUUID().slice(-9)`, not a cross-site/persistent identifier), no PII — and it fires regardless of consent today. Consent-gating it would make airlock collect *less* RUM than the unmodified page, defeating the parity goal of hosting it. Establishes that airlock's seal is **class-appropriate** per connector, not one-size-fits-all — a reusable precedent for future performance/observability connectors (mPulse, etc.). If a future RUM variant carried a persistent identifier or PII, this decision is revisited.

**Scope:** the `helix-rum` connector (spec 022) and the RUM/observability connector class; not GA4/alloy (which stay consent-gated).

### 2026-09-01 — CWV metrics collected via Google's `web-vitals` library

**Decision:** airlock's runtime CWV capture (the `cwv` RUM checkpoint, spec 022-04) sources LCP/CLS/INP from **Google's `web-vitals` library — the `web-vitals/attribution` build** (`onLCP`/`onCLS`/`onINP`), added as a dependency — NOT a hand-rolled `PerformanceObserver`. The **attribution** build is chosen deliberately for the richer data (LCP element + sub-part timings, CLS shift sources, INP interaction target + timings). `web-vitals` runs in the **main-thread capture layer** (see the nuance below); its metric values feed the connector's `cwv` checkpoint, whose mapping + egress happen behind the airlock (in the chamber).

**Context:** Maintainer direction (2026-09-01): "collect CWV via web-vitals.js from Google, so we have a reliable source for CWV metrics — this is also what Adobe RUM uses behind the scenes"; and "use the attribution build to have more data … properly isolated in a chamber and should not impact perf too much." `web-vitals` correctly handles the subtleties a hand-rolled observer gets wrong (LCP finalization on interaction/visibility, CLS session windows, INP interaction attribution), so airlock's numbers match the AEM RUM pipeline's. It's a small, focused library (not a framework) — compatible with airlock's "vanilla ES modules, no framework in the core" posture — treated as the CWV measurement source, while `aem-cwv-helper`'s scheduling primitives stay the drain scheduler.

**Perf/architecture nuance (grounded correction, so the build is honest):** `web-vitals` (attribution or not) MUST run in the main-thread capture layer, **not** inside the chamber — LCP/CLS/INP come from `PerformanceObserver` entry types scoped to the page's document, which a Worker cannot observe. What the chamber isolates is the **mapping + egress** of the captured metric, not the measurement. The perf conclusion still holds: the attribution build's extra cost lands at **metric finalization** (visibility-change / page-hide), off the interaction hot path — so INP is unaffected (airlock's INP-safe-by-construction thesis). If the attribution payload is large, the chamber keeps the beacon-shaping off-main-thread.

**Scope:** the `helix-rum` connector's `cwv` checkpoint (spec 022-04); the CWV/observability capture class. Pin the `web-vitals` major when added (mirrors the esbuild pin discipline). Note a potential **parity divergence** to confirm at implementation: if the stock enhancer's `cwv` payload is lighter than the attribution build's, airlock's `cwv` is a deliberate **superset** — verify the AEM RUM collector accepts the extra attribution fields.

### 2026-09-01 — RUM connector scope: governance exemplar, not full native reproduction

**Decision:** The `helix-rum` connector (spec 022) ships as an **egress-governance exemplar** — the core checkpoints (`top`/`error`/`cwv`) reproduced natively and governed (confined to `ot.aem.live`, not consent-gated, no-exfil). airlock will **NOT** pursue full parity by natively reproducing the enhancer's entire (evolving, plugin-extended) checkpoint set. Full parity + the page-side cutover (slices 022-03/05) are **DEFERRED** to the future worker-dom compatibility layer (host the real enhancer off-thread and govern its egress/mutations) **or** a community-contributed connector — plus the creds-gated live-collector wire-shape check.

**Context:** brainstorm 2026-09-01. Native reproduction (X) proved the *core governance* story cleanly on a well-coded enhancer, but "full parity" revealed the enhancer is a large, plugin-extended, **evolving** surface — reimplementing and perpetually chasing Adobe's RUM is the wrong bet for a *governance* runtime. And hosting the enhancer as-is on the main thread (Y) proves nothing about airlock's **performance** thesis (a well-coded tag stays well-coded; a badly-coded one still tanks INP). The real thesis — *containing costly-DOM martech* — needs a different proof (the nasty-tag POC) and a different mechanism: a **worker-dom compatibility layer** short-term (documented limits; some tags won't work), and **govern+schedule connectors, community-driven**, as the end-state. See [R-008](../research/R-008-costly-dom-martech-containment.md).

**Scope:** spec 022 (RUM); the connector-onboarding strategy. Supersedes the earlier "remove `sampleRUM` / reproduce natively for full parity" direction (022-03/05 recast as deferred).
