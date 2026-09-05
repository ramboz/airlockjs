---
status: DRAFT
skill:
use_cases: [UC-2]
---

<!-- jig self-defining vocabulary (soft, forward-only): expand each acronym on first use and link the term to docs/memory/glossary.md (or jig's lexicon). See docs/workflow.md "Self-defining vocabulary". -->

# Spec 036: Real-site validation harness (MVP6 adoption proof)

> The MVP6 [release plan](../../releases/mvp6.md) adoption proof is: **"airlock hosts the supported subset on a real
> page + CWV preserved."** Today airlock has run only on the **synthetic local testbed** (`probes/eds-testbed/`) + the
> rigs — never on a real production Adobe EDS (Edge Delivery Services) site. This spec builds the **repeatable harness +
> documented run-procedure** that lets a creds-having operator validate airlock on a real EDS site: **(1)** Core Web
> Vitals (CWV) preserved before/after adoption, and **(2)** the supported connector subset (GA4 + Adobe/alloy) boots +
> emits conformant beacons live.

## The build/run split (why this spec ships a harness, not a result)

Per the owner's direction (2026-09-05): **I build the harness + the documented procedure; the operator runs it with
their creds.** A real EDS site + Adobe datastream/org creds are required to *execute* the live validation, and
credentials are the operator's to hold (I never handle them — the same boundary the spec 013 live-Alloy rigs already
observe: creds-gated rigs read `ALLOY_*` from the env and are NOT wired to `npm run` scripts). So the **deliverable is
the runnable harness + procedure**, mechanically proven against the **local testbed as a stand-in**, with the live run
documented for the operator. The live run's PASS is recorded by the operator (redacted-fixture discipline, spec 013),
not by this spec.

## What already exists (reuse — grounded 2026-09-05)

- **Before/after CWV engine — `rig/lh-eds.mjs`.** Builds the bundle, serves `probes/eds-testbed/` under the boilerplate
  CSP, runs `LH_N` **interleaved** Lighthouse iterations OFF (server-swapped no-op module) vs ON (real bundle), and
  emits per-arm **median** LCP/TBT/CLS + deltas against the band **TBT Δ≤50 ms & |CLS Δ|≤0.01**. Its OFF/ON toggle is a
  **local server-side module swap** — the one thing that cannot exist for a live remote site (§ frame-critique fork A).
- **Scoreboard card + honest-hedging — `rig/cwv-scoreboard.mjs` + `docs/scoreboard.md`** (spec 029): the median/spread
  card renderer, the "below the 16 ms floor" / tolerance-band / provenance conventions (ADR-0005: advisory, never a
  gate). 036's live card carries the same discipline.
- **Live beacon capture — `rig/e2e.mjs`** (UC-2 interaction→GA4 beacon on the real testbed page, via Playwright network
  inspection) + the testbed **health hooks** (`window.__airlockBootFailed` / `__airlockRumBootFailed`,
  `window.__flicker` marks in `probes/eds-testbed/scripts/scripts.js`).
- **Creds-gated live-Edge pattern — `rig/alloy-live-*.mjs`** (spec 013): env creds, redacted committed fixtures
  (`test/fixtures/alloy-live-interact.redacted.json`), run-manually convention.
- **Install→boot→CWV-preserved — `rig/subtree-install.mjs`** (spec 031): the install mechanism proof that explicitly
  **hands off** to this spec for the real-production-site proof.
- **Adopter integration surface — `README.md` + `probes/eds-testbed/scripts/scripts.js`**: `git subtree add` a
  `dist-vX.Y.Z` tag; wire `loadEager` (optional reserve) + `loadLazy` (`import('/scripts/airlock/eds.js')` →
  `boot(window.__airlockConfig)` / `bootEdsAnalytics()`), + `window.__airlockOwnsRum` for RUM-replace.

## The supported subset (MVP6)

Grounded against `docs/releases/mvp6.md` + `connectors/*`: the validated in-scope set is **GA4** (`bootEdsAnalytics`) +
**Adobe/alloy analytics** (`bootAlloy`, adopter-supplied `bundleUrl` per ADR-0016). **helix-rum** is validatable but
carries a **named live gate** (does the live `ot.aem.live` collector accept airlock's `cwv` *superset* shape? — spec
030-04, `connectors/helix-rum/README.md`). **Pixels** (Meta/LinkedIn/Bing) are MVP7 — **out of scope** here.

## Assumptions

<!-- Spec 064-02 / ADR-0020 §1–§2 — grounding-by-probe (risk-gated). -->

- Grounded (read 2026-09-05): `rig/lh-eds.mjs`'s engine + toggle (as described above); the reusable card/hedging in
  `rig/cwv-scoreboard.mjs`; the beacon-capture + health hooks in `rig/e2e.mjs` / `probes/eds-testbed/scripts/scripts.js`;
  the creds-gated `rig/alloy-live-*.mjs` convention; the `README.md` adopter integration; the MVP6 supported subset.
  **Pre-flight (034-02:117):** a fresh `node build.mjs` (+ rig rebuilds) must precede any validation so stale pre-034
  bytes are never exercised — stale built copies live under `probes/eds-testbed/scripts/airlock/` + `rig/out/`.
- **The frame-critique must ground the load-bearing forks (NOT asserted here):**
  - **Fork A — the live before/after mechanism.** `lh-eds`'s OFF/ON is a local server swap; a live remote site cannot
    be toggled that way. Candidate: **EDS per-ref preview URLs** (`<ref>--<repo>--<owner>.aem.page`) — a `main`
    baseline vs an `airlock`-adopted branch give two real URLs that differ (ideally) only by the adoption, so the
    harness takes **two operator-supplied URLs** and stays URL-shape-agnostic (hardcodes no host). The confound to name:
    two branch deployments can differ by more than airlock (content, CDN warmth), and LCP is no longer ~0-by-construction
    across two deployments — so the operator-procedure must pin "the two arms differ ONLY by airlock adoption," and the
    honest note must be re-derived for the live case. Alternative: a query-gated boot on ONE deployment. Frame-critique ratifies.
  - **Fork B — the testability bridge (how this is proven without a live site or creds).** The harness must be provable
    by me against the **local testbed served as a live-shaped URL** (the existing local OFF/ON substrate), with the live
    remote run being the operator's creds-gated step — mirroring how `rig/alloy-live-*.mjs` are validated. Is a
    local-testbed dry-run a sufficient mechanical proof, or does the two-URL live path introduce logic the local mode
    can't exercise? Frame-critique grounds what "done for the harness" means absent a live run.
  - **Fork C — the supported-subset boundary + the live residuals.** GA4 + alloy in; helix-rum with its live wire-shape
    gate; pixels out. Which named creds-gated residuals (RUM `ot.aem.live` shape; alloy endpoint-ceiling breadth,
    `refinement-todo` ~L563; live-host Trusted-Types + real ~766 KB bundle boot, ADR-0016 kill-criterion ~L575) the
    harness must actively exercise vs. the procedure merely documents for the operator to check.

## Decomposition

**SPIDR — Path/Interface** split by the **two observable adoption-proof outcomes** (each vertical: a runnable rig + its
operator-procedure fragment, each provable against the local testbed):

- **036-01 — CWV preserved before/after on a real EDS page.** The live two-URL before/after CWV harness (reusing
  `lh-eds`'s engine + `cwv-scoreboard`'s card/hedging), + the operator procedure to produce the two arms (fork A) and
  read the delta against the band. Proven against the local testbed (fork B).
- **036-02 — the supported subset boots + emits conformant beacons live.** The live supported-subset smoke (GA4 + alloy
  boot-health via `__airlockBootFailed` + conformant-beacon capture, reusing `e2e`'s pattern against a remote URL), the
  named-live-residuals checklist (fork C), + the consolidated operator run-procedure doc (its home is NOT the
  jig-scaffold `docs/adoption-readiness.md` — a real doc under `docs/`).

(If the frame-critique finds 036-02's smoke + residuals + procedure-doc too large, the residuals checklist + procedure
doc split into 036-03; the default is two slices — the two halves of the MVP6 adoption proof.)

## Slices

- [036-01 — live CWV before/after harness (two-URL) + procedure](slice-01-live-cwv-harness.md)
- 036-02 — supported-subset live smoke (GA4 + alloy) + residuals checklist + run-procedure doc (drafted after 036-01's frame-critique ratifies the shared forks)
