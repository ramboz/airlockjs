---
status: DRAFT
kind: spike
dependencies: [032-01, 032-02]
last_verified:
frame_review: true  # the spike rests on load-bearing feasibility unknowns — the frame gate confirms the Question is the right one.
---

<!-- jig self-defining vocabulary (soft, forward-only): expand each acronym on
     first use and link the term to docs/memory/glossary.md (or jig's lexicon). -->

<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about runnable
     surfaces by probe first (run it / read source) or a citation, else mark them
     as assumptions — never assert an unverified claim as fact. -->

## Slice 033-01 — spike: de-risk alloy adapter-boot + distribution + the composite-handle reconciliation (GO/KILL)

**Question:** Can Adobe/alloy — the wrapped-SDK connector (classic `importScripts` worker + a 766 KB stock bundle,
hosted by `createWrappedSdkHost`'s single-slot `driveEvent`) — be (a) **distributed + served same-origin for a
buildless EDS site**, (b) **adapter-booted** (`bootAlloy`) wrapping the wrapped-SDK host + the stock-SDK load, and
(c) **exposed as a composite-compatible handle** so `boot({ connectors: [{ type: "alloy", … }] })` works — a clean
**GO** (with a concrete design for 033-02), a **reshape**, or a partial **KILL** (e.g. "the site must supply the
alloy bundle itself")?

**Time-box:** 1 day (bounded investigation — read + targeted feasibility probes; NO production build slice here).

**DoR:**
- ✅ 032 DONE — `boot(config)` + the composite handle + the config schema exist (the surface alloy must plug into).
- ✅ The alloy hosting path is understood: `createAlloyConnector` + `createWrappedSdkHost` + the classic IIFE
  `alloy-chamber.worker.js` (importScripts the stock bundle) + the alloy rigs (`rig/alloy-*.mjs`) — read this session.

**Findings (fill during IN_PROGRESS — evidence, not assertion; probe/read, cite file:line):**

Answer each load-bearing unknown with evidence, and for each give a GO / RESHAPE / KILL lean:

1. **Distribution (the biggest unknown).** Can the classic IIFE alloy worker become a served `dist` artifact
   (a 5th entry, *classic* format — `build.mjs` today emits only ESM `type:module` workers + asserts same-origin
   file URLs, no `blob:`/`data:`)? And the **766 KB stock alloy bundle** it `importScripts` — for a *buildless* EDS
   site with no `node_modules`, does airlock **ship + serve** it same-origin (a big vendored vendor bundle, byte-pinned
   per AD-7), or must the **site supply alloy itself** (a documented consumer prerequisite)? What does 031's
   distribution mechanism (dist-rooted ref, `git subtree`) accommodate vs need to change?
2. **Handle reconciliation.** How does `createWrappedSdkHost`'s **single-slot `driveEvent`** ("one page event per
   host") map to the composite's `push`/`pushCritical`/`setConsent`/`dispose`/`getState`? Is a per-`push`
   host-instance (or a re-entrant driveEvent) viable, or does alloy need a different handle contract inside the
   composite? How do `dispose` (tear down the chamber + its worker), `setConsent` (the seam `egressVerdict` +
   in-chamber `setConsent` delegate), and `getState` behave?
3. **Adapter boot.** Can a `bootAlloy(opts)` wrap `createWrappedSdkHost` + spawn the (built, served) classic worker +
   trigger the stock-SDK load + wire the caps (`egress.dispatch`, `cookies.reconcile`, `decisions.deliver`,
   `configIntegrity`, `endpointCeiling`, `consent`/`egressPurposes`) + return the composite-compatible handle — WITHOUT
   forking the rig-only logic? What's the smallest real proof (a headless boot that `sendEvent`s once)?
4. **Decisions + consent.** How do decisions-as-data (Target propositions → `caps.decisions.deliver` → host
   `reserveSpace`, spec 012-03/018) and the seam-side consent gate (`egressVerdict(strict)`, spec 020) wire through
   the adapter + the composite's `setConsent` — per alloy's governance class (analytics_storage + personalization +
   ad_storage; NOT helix-rum's exempt class)?

**Outcome (set at DONE):** one of `spec 033-02 unblocked (GO — design recorded)` / `spec 033-02 reshaped (…)` /
`abandoned (KILL — reason)`. If GO, the Findings MUST carry a concrete-enough design for 033-02 (the `bootAlloy`
shape, the composite-handle contract for alloy, the distribution decision for the worker + stock bundle, and the
decisions/consent wiring). If KILL/reshape, state precisely what is infeasible and what (if anything) a narrower
alloy story could still deliver.

**DoD:**
- [ ] Each of the 4 unknowns has a grounded Finding (probe run / source cited) with a GO/RESHAPE/KILL lean.
- [ ] The Outcome is set (GO with a design / reshape / KILL with a reason) — decisive, not "needs more investigation"
      without saying exactly what.
- [ ] Any throwaway probe lives under `probes/` (not wired into the shipped runtime/tests); the timebox was respected.
- [ ] Reviewed by `reviewer` subagent (compliance: are the Findings grounded + the Outcome honestly supported?;
      **frame-critique** PRE-investigation, since `frame_review: true`).
- [ ] Deviation log + Reconciliation sweep produced under this slice heading; reconciliation review passed.
- [ ] `docs/refinement-todo.md` / the 033-02 slice updated with the Outcome (GO design, or the reshape/KILL).

### Deviation log (after reconciliation)

The original spec is preserved above. Investigation notes:

_TODO (spike): the evidence gathered per unknown, the GO/KILL Outcome + rationale, any probe path, reviewer findings._

### Reconciliation sweep

| Artifact | Disposition | Rationale |
|----------|-------------|-----------|
| `docs/specs/033-alloy-config-wiring/slice-02-alloy-config-build.md` | `updated` | _TODO: the spike's Outcome (GO design / reshape / KILL) folds into the DEFERRED build slice + its resolution trigger._ |
| `docs/specs/README.md` | `deferred` | _TODO: status-board regen at close-out._ |
| `docs/refinement-todo.md` | `no-op` | _TODO: `updated` iff the spike surfaces a NEW deferral (e.g. a distribution reshape); else the alloy entry already tracks it._ |
| `docs/architecture.md` | `no-op` | _TODO: `updated` iff the spike's Outcome is architecture-shaped (a new distribution mode for classic workers / vendored bundles)._ |
| `probes/**` | `no-op` | _TODO: note any throwaway feasibility probe added (kept out of the shipped runtime)._ |
| `docs/decisions/**` | `no-op` | _TODO: a spike Outcome that settles a load-bearing choice with alternatives (e.g. ship-vs-site-supplies the stock bundle) may warrant an ADR — flag it._ |
