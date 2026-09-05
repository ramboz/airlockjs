---
status: DRAFT
dependencies: []
last_verified:
frame_review: true  # forks A (live before/after mechanism) + B (testability bridge — proven without a live site) are load-bearing.
---

<!-- jig self-defining vocabulary (soft, forward-only); jig grounding (064-02/ADR-0020): probe/cite or mark assumptions. -->

## Slice 036-01 — live CWV before/after harness (two-URL) + procedure

**Goal:** a **repeatable harness** a creds-having operator points at a real EDS site to answer *"does adopting airlock
preserve Core Web Vitals?"* — reusing `rig/lh-eds.mjs`'s proven Lighthouse-interleave/median/delta/band engine, but
driven by **two operator-supplied live URLs** (baseline vs airlock-adopted) instead of the local server + server-side
OFF/ON toggle that cannot exist for a remote site. Shipped with a **documented run-procedure** and **mechanically
proven against the local testbed** (the live run is the operator's creds-gated step — I never handle creds or a real
site).

**DoR:**
- ✅ Grounded (read 2026-09-05): `rig/lh-eds.mjs` (the reusable `runOne`/median/`armSummary`/delta/band + honest-note
  machinery; the local server + `arm` server-side OFF/ON toggle is the part that must be replaced for a live URL — and
  it only ever toggles the **GA4-only** lazy `bootEdsAnalytics`, never `window.__airlockConfig`); the **TWO airlock boot
  entrypoints** in `probes/eds-testbed/scripts/scripts.js` — an **eager** personalization reserve at **:184**, gated on
  `window.__airlockConfig`, run BEFORE `document.body.classList.add('appear')` at **:196** (i.e. **pre-LCP** — the
  033-03 no-flicker fix, importing only the lightweight `reserve-personalization.js`, deliberately not the full runtime
  to dodge an LCP trap), and the **lazy** boot at **:246** (`boot(config)` for alloy/config, else `bootEdsAnalytics()`,
  post-LCP); `rig/cwv-scoreboard.mjs` + `docs/scoreboard.md` (card/hedging/provenance, ADR-0005 advisory); the EDS
  per-ref preview URL model + the `README.md` adopter integration; the 034-02:117 pre-flight-rebuild flag.

**Design focus (RATIFIED at the frame-critique — load-bearing):**
- **Fork A — the live before/after mechanism (query-gate PRIMARY; two-deployment DEMOTED).** Frame-critique r1: a
  two-deployment before/after (two `.aem.page` previews) is **unsound against the ~50 ms / 0.01 band** — a **fixed**
  between-deployment bias (cold-vs-warm CDN, edge PoP, hostname routing) that interleaving (which cancels only
  *time-varying* drift against one server) cannot remove. **Ratified PRIMARY: a query-gated toggle on ONE deployment** —
  same URL, OFF (plain) vs ON (`?airlock=1`) — holding cache / edge / content / origin constant. The gate must cover
  **BOTH airlock entrypoints** (the eager reserve at `scripts.js:184` AND the lazy boot at `:246`), so OFF is a **bare
  no-airlock page** — a small localized check on the operator's THROWAWAY validation branch (NOT shipped runtime,
  preserving `lh-eds`'s "no test flag in production" principle). Two-deployment ships only as a **band-withheld FALLBACK**.
- **Fork A′ — the two adopter PROFILES (frame-critique r2; the "by construction" claim is profile-scoped).** "LCP Δ≈0
  by construction" is TRUE only when all airlock work is **post-LCP**:
  - **analytics-only** (GA4, or alloy-analytics with no personalization → no eager reserve): post-LCP boot only ⇒ LCP
    Δ≈0 **by construction** ⇒ the tight **TBT Δ≤50 ms / |CLS Δ|≤0.01** band is meaningful.
  - **personalization** (alloy with `__view__`/placements → the eager pre-`appear` reserve at `:184` fires): airlock
    does **intended pre-LCP layout work** ⇒ LCP/CLS are a **MEASURED delta, NOT ≈0 by construction**. The harness's job
    here is to VALIDATE 033-03's central bet **live** — that the *lightweight* eager reserve keeps LCP ~0 while the
    reserve fixes CLS (a held/**improved** CLS is the goal, not a violation). The card reports the measured LCP/CLS,
    human-read, without the by-construction claim.
- **Fork B — the testability bridge (profile-aware).** The `lh-eds` local substrate toggles only GA4-only
  `bootEdsAnalytics` (never `__airlockConfig`), so it is a **faithful analog for the analytics-only profile**. For the
  **personalization profile**, the local dry-run must be **extended to set `window.__airlockConfig`** (the testbed
  already supports it — `variant-b.html` + the `:184` reserve path) so the eager-reserve LCP/CLS path is exercised
  locally too; where that is impractical, the personalization profile's live LCP/CLS is scoped to the operator's run and
  the local dry-run proves the analytics-only profile + the harness plumbing. Frame-critique/implementer picks; the spec
  requires the personalization path be exercised SOMEWHERE (local-extended or operator-live), not silently unproven.
- **New-file vs generalize `lh-eds.mjs`.** Either a new `rig/lh-live.mjs`, or generalize `lh-eds.mjs` to accept an
  optional live `URL` (running the two query-variant arms against it; falling back to today's local OFF/ON server-swap
  when unset — additive, back-compat). A craft call; ensure the reuse of the `runOne`/median/`armSummary`/delta/band
  logic is real, not a parallel re-implementation.

**Acceptance Criteria (ratified at the frame-critique):**

1. **Query-gated single-deployment before/after CWV harness (PRIMARY).** A rig accepts ONE operator-supplied live `URL`
   and measures two arms differing ONLY by a client-side flag — OFF (`URL`, a **bare no-airlock page**) vs ON
   (`URL?airlock=1`) — running `LH_N` **interleaved** Lighthouse iterations against each, emitting per-arm **median**
   LCP/TBT/CLS/perf + median deltas, reusing `lh-eds`'s `runOne`/median/`armSummary`/delta machinery (not a
   re-implementation). The gate must cover **BOTH airlock entrypoints** (the eager reserve `:184` AND the lazy boot
   `:246`) so OFF is genuinely airlock-free. URL-agnostic (no hardcoded host); the query-param name configurable.
2. **Profile-scoped acceptance band (the "by construction" claim is profile-aware).**
   - **analytics-only** (no eager reserve — GA4, or alloy-analytics without personalization): all airlock work is
     post-LCP ⇒ LCP Δ≈0 **by construction** ⇒ apply the tight band **TBT Δ≤50 ms & |CLS Δ|≤0.01** (carried from `lh-eds`).
   - **personalization** (alloy `__view__`/placements ⇒ the eager pre-`appear` reserve fires, `:184`): airlock does
     intended pre-LCP layout work ⇒ LCP/CLS are a **MEASURED** delta, reported WITHOUT the by-construction claim; the
     read is "does the *lightweight* eager reserve keep LCP ~0 (033-03's LCP-trap-avoidance, now measured live) while
     the reserve holds/**improves** CLS (its purpose)?" — a CLS improvement is a PASS signal, not a band violation. TBT
     Δ≤50 ms still applies.
3. **Two-deployment FALLBACK, band withheld.** The rig also accepts two distinct URLs (baseline + adopted) for an
   operator who cannot query-gate — emitting the deltas with the acceptance band **explicitly withheld** + a loud caveat
   that a fixed between-deployment bias (CDN warmth, edge PoP, hostname routing) is not cancelled by interleaving
   (answers "grossly regressed?", not "preserved within 50 ms").
4. **Honest note per mode + profile; advisory discipline.** The card's note names the mode (query-gate vs two-deployment)
   and profile (analytics-only ⇒ LCP Δ≈0 by construction + tight band; personalization ⇒ measured LCP/CLS, no
   by-construction claim; two-deployment ⇒ band withheld + why), carrying `cwv-scoreboard`'s tolerance/provenance/
   human-read discipline (ADR-0005 — advisory, never a gate).
5. **Proven against the local testbed (fork B — profile-aware faithful analog).** The harness runs green against the
   local testbed producing a valid delta card (a dry-run I can execute): the existing `lh-eds` single-server
   no-op-OFF vs real-ON substrate is the faithful local stand-in for the **analytics-only** profile; the
   **personalization** profile is exercised by extending the local dry-run to set `window.__airlockConfig` (the testbed
   supports it — the `:184` reserve path + `variant-b.html`) so the eager-reserve LCP/CLS path runs locally too, OR is
   scoped to the operator's live run — but is exercised SOMEWHERE, never silently unproven. The live remote run is the
   operator's creds-gated step.
6. **Documented run-procedure.** A doc (under `docs/`, NOT the scaffold-squatted `docs/adoption-readiness.md`) walks the
   operator through: the pre-flight `node build.mjs` rebuild (034-02:117); the PRIMARY recipe — add the client-side gate
   covering BOTH airlock entrypoints (`:184` + `:246`) to the throwaway validation branch so `?airlock=1` = ON and plain
   = bare page, deploy, run the harness against the one URL; a **cache-parity pre-check** (confirm both arms return
   equivalent edge cache-state / comparable TTFB before the measured run, so the query variant is not silently
   origin-rendered while plain is edge-cached — else the fixed-offset confound returns); which profile's band to read;
   and the FALLBACK (two deployments, band-withheld). The gate is throwaway validation scaffolding, never shipped runtime.
7. **No-regression.** If the harness generalizes `lh-eds.mjs`, `npm run lh:eds` (the local OFF/ON path) stays
   byte-behaviour-identical when no live `URL` is given; `cwv:scoreboard`/`cwv:budget` unaffected. `npm test` +
   `node build.mjs` + `contracts/validate.mjs` + `npm run lint` stay green.

**DoD:** all ACs pass; the harness runs against the local testbed producing a valid card (mechanical dry-run); the
run-procedure doc is written + linked from where an adopter would look (`README.md` / the MVP6 release plan); reviewed
(compliance + craft + **frame-critique** [`frame_review: true`]); deviation log + reconciliation sweep; reconciliation
review; board synced. (No `arch_review`: rig + docs only — no `core/` or `contracts/` change; the harness exercises the
runtime, it does not alter it.)
