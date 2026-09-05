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

**Design focus (the frame-critique ratifies forks A + B — NOT asserted here):**
- **Fork A — the live before/after mechanism.** The harness takes **two operator-supplied URLs** and stays
  URL-shape-agnostic (hardcodes no host). The recommended way to produce them is **EDS per-ref preview URLs**
  (`<ref>--<repo>--<owner>.aem.page`): a `main` baseline vs an `airlock`-adopted branch. Confound to pin in the
  procedure: two branch deployments can differ by more than airlock, and LCP is **not** ~0-by-construction across two
  deployments (unlike `lh-eds`'s single-page local toggle) — the operator must ensure the arms differ ONLY by
  adoption. Alternative to weigh: a **query-gated boot** on ONE deployment (same URL, `?airlock=1` ON). Frame-critique
  ratifies the primary + whether the alternative ships.
- **Fork B — the testability bridge.** The harness is proven by running against the **local testbed** as the two arms
  (the existing `lh-eds` local OFF/ON substrate serves as the dry-run I can execute) — the live remote run is the
  operator's. Frame-critique grounds whether a local dry-run sufficiently exercises the two-URL path, or whether the
  URL-driven logic needs its own local two-URL proof (e.g. two local servers).
- **New-file vs generalize `lh-eds.mjs`.** Either a new `rig/lh-live.mjs`, or generalize `lh-eds.mjs` to accept optional
  `BASELINE_URL`/`ADOPTED_URL` (falling back to today's local OFF/ON when unset — additive, back-compat). A craft call;
  the frame-critique need only ensure the reuse is real (not a parallel re-implementation of the median/band logic).

**Acceptance Criteria (ratified at the frame-critique):**

1. **Two-URL live before/after CWV harness.** A rig accepts two operator-supplied URLs (baseline + adopted; e.g. via
   `BASELINE_URL`/`ADOPTED_URL` env), runs `LH_N` **interleaved** Lighthouse iterations against each, and emits per-arm
   **median** LCP/TBT/CLS/perf + median deltas + the acceptance band (**TBT Δ≤50 ms & |CLS Δ|≤0.01**, carried from
   `lh-eds`), reusing `lh-eds`'s `runOne`/median/summary machinery (not a re-implementation). URL-shape-agnostic
   (hardcodes no host).
2. **Honest note re-derived for the live case.** The card states that across two live deployments LCP is NOT
   ~0-by-construction and the arms must differ ONLY by airlock (vs `lh-eds`'s single-page toggle), and carries the
   `cwv-scoreboard` tolerance-band + provenance + human-read/advisory discipline (ADR-0005 — never a gate).
3. **Proven against the local testbed (fork B).** The harness runs green against the local testbed as its two arms
   (a dry-run I can execute), producing a valid delta card; the live remote run is the operator's creds-gated step.
4. **Documented run-procedure.** A doc (under `docs/`, NOT the scaffold-squatted `docs/adoption-readiness.md`) walks the
   operator through: the pre-flight `node build.mjs` rebuild (034-02:117); producing the two arms (fork A — the EDS
   branch-preview recipe, with the "arms differ only by airlock" discipline + the branch-confound/CDN-warmth caveats);
   running the harness with the two URLs; reading the delta against the band; and the honest caveats.
5. **No-regression.** If the harness generalizes `lh-eds.mjs`, `npm run lh:eds` (the local OFF/ON path) stays
   byte-behaviour-identical when the live URLs are unset; `cwv:scoreboard`/`cwv:budget` unaffected. `npm test` +
   `node build.mjs` + `contracts/validate.mjs` + `npm run lint` stay green.

**DoD:** all ACs pass; the harness runs against the local testbed producing a valid card (mechanical dry-run); the
run-procedure doc is written + linked from where an adopter would look (`README.md` / the MVP6 release plan); reviewed
(compliance + craft + **frame-critique** [`frame_review: true`]); deviation log + reconciliation sweep; reconciliation
review; board synced. (No `arch_review`: rig + docs only — no `core/` or `contracts/` change; the harness exercises the
runtime, it does not alter it.)
