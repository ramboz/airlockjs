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
  machinery; the local server + `arm` server-side OFF/ON toggle is the part that must be replaced for a live URL);
  `rig/cwv-scoreboard.mjs` + `docs/scoreboard.md` (card/hedging/provenance, ADR-0005 advisory); the EDS per-ref preview
  URL model + the `README.md` adopter integration; the 034-02:117 pre-flight-rebuild flag.

**Design focus (RATIFIED at the frame-critique — the primary/fallback ranking below is load-bearing):**
- **Fork A — the live before/after mechanism (query-gate PRIMARY; two-deployment DEMOTED).** The frame-critique
  established that a two-deployment before/after (two `.aem.page` branch previews) is **unsound against the carried
  ~50 ms TBT / 0.01 CLS band**: two deployments carry a **fixed** between-deployment bias (cold-vs-warm CDN cache,
  different edge PoP, per-hostname routing) plausibly 10–100× the band, and `lh-eds`'s interleaving cancels only
  *time-varying* drift against one server — NOT a fixed two-host offset. **Ratified PRIMARY: a query-gated boot on ONE
  deployment** — the same live URL served OFF (plain) vs ON (`?airlock=1`), the boot skipped client-side unless the flag
  is present (a one-line gate in `loadLazy`, `probes/eds-testbed/scripts/scripts.js:246`, on the operator's THROWAWAY
  validation branch — NOT shipped runtime, preserving `lh-eds`'s "no test flag ships in production" principle). This
  holds cache / edge / content / origin constant, restores **LCP Δ≈0 by construction**, and makes the band meaningful.
  The harness's two arms are then two URL *variants* of one deployment (`URL` vs `URL?airlock=1`). The **two-deployment
  path ships only as a caveated FALLBACK** with its band explicitly **withheld/widened** (answers "grossly regressed?",
  not "preserved within 50 ms").
- **Fork B — the testability bridge (rescued by the query-gate primary).** Because the primary is a single-deployment
  toggle, the existing `lh-eds` local substrate (one server, no-op OFF vs real ON) is a **faithful analog** of the live
  path (same-origin, same-content, single post-LCP toggle) — so the local dry-run genuinely exercises the harness's real
  semantics, not just its plumbing. The only live-specific variable is the network/CDN, supplied by the operator's run.
- **New-file vs generalize `lh-eds.mjs`.** Either a new `rig/lh-live.mjs`, or generalize `lh-eds.mjs` to accept an
  optional live `URL` (running the two query-variant arms against it; falling back to today's local OFF/ON server-swap
  when unset — additive, back-compat). A craft call; ensure the reuse of the `runOne`/median/`armSummary`/delta/band
  logic is real, not a parallel re-implementation.

**Acceptance Criteria (ratified at the frame-critique):**

1. **Query-gated single-deployment before/after CWV harness (PRIMARY).** A rig accepts ONE operator-supplied live `URL`
   and measures two arms that differ ONLY by a client-side boot flag — OFF (`URL`) vs ON (`URL?airlock=1`) — running
   `LH_N` **interleaved** Lighthouse iterations against each, emitting per-arm **median** LCP/TBT/CLS/perf + median
   deltas + the acceptance band (**TBT Δ≤50 ms & |CLS Δ|≤0.01**, carried from `lh-eds` and MEANINGFUL because the toggle
   holds cache/edge/content constant → LCP Δ≈0 by construction). Reuses `lh-eds`'s `runOne`/median/`armSummary`/delta
   machinery (not a re-implementation). URL-agnostic (hardcodes no host); the query-param name is configurable.
2. **Two-deployment FALLBACK, band withheld.** The rig also accepts two distinct URLs (baseline + adopted) for the case
   an operator cannot query-gate — but this path emits the deltas with the **acceptance band explicitly withheld** and a
   loud caveat that a fixed between-deployment bias (CDN warmth, edge PoP, hostname routing) is not cancelled by
   interleaving, so it answers only "grossly regressed?" not "preserved within 50 ms."
3. **Honest note per mode + advisory discipline.** The card's note is mode-aware: the query-gate mode states LCP
   Δ≈0-by-construction holds (single-deployment post-LCP toggle); the two-deployment mode states the band is withheld
   and why. Both carry the `cwv-scoreboard` tolerance/provenance/human-read discipline (ADR-0005 — advisory, never a gate).
4. **Proven against the local testbed (fork B — now a faithful analog).** The harness runs green against the local
   testbed (the existing `lh-eds` single-server no-op-OFF vs real-ON substrate is the faithful local stand-in for the
   query-gate mode), producing a valid delta card — a dry-run I can execute. The live remote run is the operator's
   creds-gated step.
5. **Documented run-procedure.** A doc (under `docs/`, NOT the scaffold-squatted `docs/adoption-readiness.md`) walks the
   operator through: the pre-flight `node build.mjs` rebuild (034-02:117); the PRIMARY recipe — add the one-line
   client-side query-gate to the throwaway validation branch's `loadLazy` (skip the boot unless `?airlock=1`), deploy,
   run the harness against that one URL; reading the delta against the band; and the FALLBACK (two deployments,
   band-withheld) with its caveats. The gate is throwaway validation scaffolding, never shipped runtime.
6. **No-regression.** If the harness generalizes `lh-eds.mjs`, `npm run lh:eds` (the local OFF/ON path) stays
   byte-behaviour-identical when no live `URL` is given; `cwv:scoreboard`/`cwv:budget` unaffected. `npm test` +
   `node build.mjs` + `contracts/validate.mjs` + `npm run lint` stay green.

**DoD:** all ACs pass; the harness runs against the local testbed producing a valid card (mechanical dry-run); the
run-procedure doc is written + linked from where an adopter would look (`README.md` / the MVP6 release plan); reviewed
(compliance + craft + **frame-critique** [`frame_review: true`]); deviation log + reconciliation sweep; reconciliation
review; board synced. (No `arch_review`: rig + docs only — no `core/` or `contracts/` change; the harness exercises the
runtime, it does not alter it.)
