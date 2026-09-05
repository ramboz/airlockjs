---
status: DONE
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
  - **Fork A — the live before/after mechanism (RATIFIED at 036-01's frame-critique).** `lh-eds`'s OFF/ON is a local
    server swap; a live remote site cannot be toggled that way. **Ratified PRIMARY: a query-gated boot on ONE live
    deployment** — the same URL served OFF (plain) vs ON (`?airlock=1`), the boot skipped client-side unless the flag is
    present. This holds cache / edge PoP / content / origin CONSTANT and toggles only the (lazy, post-LCP) airlock boot —
    so LCP Δ≈0 **by construction** (exactly `lh-eds`'s invariant) and the carried **TBT Δ≤50 ms / |CLS Δ|≤0.01** band is
    meaningful. The gate is a **one-line client-side check on the operator's throwaway validation branch**
    (`probes/eds-testbed/scripts/scripts.js:246` shows where it slots in `loadLazy`) — NOT a flag shipped in the airlock
    runtime or an adopter's production `scripts.js`, so `lh-eds`'s "no test flag ships" principle is preserved for
    production. **DEMOTED to a caveated fallback: two separate deployments** (e.g. EDS per-ref preview URLs, `main`
    baseline vs an `airlock` branch). The frame-critique established this is UNSOUND against the ~50 ms band: two
    `.aem.page` deployments carry a **fixed** between-deployment bias (cold-vs-warm CDN cache, different edge PoP,
    per-hostname routing) that is plausibly 10–100× the band, and `lh-eds`'s interleaving cancels only *time-varying*
    drift against one server — it does NOT remove a fixed two-host offset. So the fallback ships only with its band
    **explicitly withheld/widened** and a loud caveat (it answers "grossly regressed?", not "preserved within 50 ms").
  - **Fork B — the testability bridge (rescued by Fork A's ratification).** Because the primary is a **single-deployment
    query toggle**, the existing `lh-eds` local substrate (one server, no-op OFF vs real ON) is now a **faithful analog**
    of the live path — same-origin, same-content, single post-LCP toggle — so the local dry-run genuinely exercises the
    harness's real semantics (not just its plumbing); the only live-specific variable is the network/CDN, which the
    operator's run supplies. (Under the demoted two-deployment fallback the local dry-run would prove only plumbing —
    another reason the query-gate is the primary.)
  - **Fork C — the supported-subset boundary + the live residuals.** GA4 + alloy in; helix-rum with its live wire-shape
    gate; pixels out. Which named creds-gated residuals (RUM `ot.aem.live` shape; alloy endpoint-ceiling breadth,
    `refinement-todo` ~L563; live-host Trusted-Types + real ~766 KB bundle boot, ADR-0016 kill-criterion ~L575) the
    harness must actively exercise vs. the procedure merely documents for the operator to check.

## Decomposition

**SPIDR — Path/Interface** split by the **two observable adoption-proof outcomes** (each vertical: a runnable rig + its
operator-procedure fragment, each provable against the local testbed):

- **036-01 — CWV preserved before/after on a real EDS page.** The live before/after CWV harness — PRIMARY: a
  **query-gated single-deployment** toggle (`URL` vs `URL?airlock=1`, cache/edge/content held constant → the band is
  meaningful); FALLBACK: two deployments with the band withheld (fork A) — reusing `lh-eds`'s engine + `cwv-scoreboard`'s
  card/hedging, + the operator procedure. Proven against the local testbed, now a faithful analog (fork B).
- **036-02 — the supported subset boots + emits conformant beacons live.** The live supported-subset smoke (GA4 + alloy
  boot-health via `__airlockBootFailed` + conformant-beacon capture, reusing `e2e`'s pattern against a remote URL), the
  named-live-residuals checklist (fork C), + the consolidated operator run-procedure doc (its home is NOT the
  jig-scaffold `docs/adoption-readiness.md` — a real doc under `docs/`).

(If the frame-critique finds 036-02's smoke + residuals + procedure-doc too large, the residuals checklist + procedure
doc split into 036-03; the default is two slices — the two halves of the MVP6 adoption proof.)

## Slices

- [036-01 — live CWV before/after harness (query-gated single-deployment primary; two-deployment fallback) + procedure](slice-01-live-cwv-harness.md)
- [036-02 — supported-subset live smoke (GA4 + alloy) + named-live-residuals checklist + consolidated run-procedure](slice-02-subset-smoke.md)
