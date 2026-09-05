---
status: IN_PROGRESS
dependencies: []
last_verified:
frame_review: true  # forks A (live before/after mechanism) + B (testability bridge — proven without a live site) are load-bearing.
claimed_by: claude/mvp6-e4550f
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
- **Fork A′ — the adopter PROFILES, discriminated on `window.__airlockConfig` PRESENCE (frame-critique r2 + r3).** The
  eager pre-`appear` entrypoint (`scripts.js:184`) gates on `if (window.__airlockConfig)` — presence, NOT placements —
  and `await import(reserve-personalization.js)` there fires BEFORE `body.appear` (:196) regardless of placements
  (empty placements skip only the DOM-box reservation, `reserve-personalization.js:54` — the import cost is already
  paid, pre-LCP). So "LCP Δ≈0 by construction" holds **iff there is no `__airlockConfig`**:
  - **GA4-only** (`bootEdsAnalytics()`, no `__airlockConfig`): all airlock work post-LCP ⇒ LCP Δ≈0 **by construction** ⇒
    the tight **TBT Δ≤50 ms / |CLS Δ|≤0.01** band is meaningful.
  - **ANY `__airlockConfig` (all alloy — analytics-only AND personalization; there is no non-`__airlockConfig` alloy
    path — `boot(config)` is gated at `:246`, imported at `:251`, invoked at `:252`, all requiring `__airlockConfig`):**
    the eager import fires pre-`appear` ⇒ LCP is a **MEASURED
    delta, NOT ≈0 by construction** (a real pre-paint import cost — a live-CDN round-trip — is exactly what 036 exists to
    MEASURE, not assert). Two sub-reads within this profile: **alloy-analytics-only** (no `placements`) reserves no box,
    so the LCP delta is just the lightweight-import cost and CLS should be ~unaffected; **personalization**
    (`__view__`/placements) additionally reserves boxes pre-paint, so CLS is the intended no-flicker intervention (a
    held/**improved** CLS is the PASS signal, not a band violation). Both validate 033-03's live bet — the lightweight
    eager module keeps LCP ~0 — as a MEASURED number. TBT Δ≤50 ms still applies to both.
- **Fork B — the testability bridge (profile-aware).** The `lh-eds` local substrate toggles only GA4-only
  `bootEdsAnalytics` (never sets `window.__airlockConfig`), so it is a **faithful analog for the GA4-only profile**. For
  the **`__airlockConfig` (alloy) profiles**, the local dry-run must be **extended to inject a `window.__airlockConfig`
  fixture** — the runtime code-path support is real (`scripts.js:184`/`246` + `reserve-personalization.js`), but NO
  `__airlockConfig` fixture exists in the testbed today (it is set nowhere — only branched on; `variant-b.html` is the
  aem-experimentation challenger, unrelated), so the fixture must be **authored**, not reused. Where local injection is
  impractical, the alloy profiles' live LCP/CLS is scoped to the operator's run and the local dry-run proves the
  GA4-only profile + the harness plumbing. Frame-critique/implementer picks; the spec requires each in-scope profile be
  exercised SOMEWHERE (local-extended or operator-live), never silently unproven.
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
2. **Acceptance band discriminated on `window.__airlockConfig` PRESENCE (NOT placements).**
   - **no `__airlockConfig`** (GA4 via `bootEdsAnalytics()`): all airlock work post-LCP ⇒ LCP Δ≈0 **by construction** ⇒
     apply the tight band **TBT Δ≤50 ms & |CLS Δ|≤0.01** (carried from `lh-eds`).
   - **any `__airlockConfig`** (all alloy — analytics-only OR personalization): the eager pre-`appear`
     `import(reserve-personalization.js)` fires (`:184`, before `body.appear` `:196`) ⇒ LCP is a **MEASURED** delta,
     reported WITHOUT the by-construction claim (the read is 033-03's live bet: does the *lightweight* eager import keep
     LCP ~0?). CLS: alloy-analytics-only (empty `placements` ⇒ no box reserved) should hold CLS; personalization
     (`placements` ⇒ boxes reserved pre-paint) should hold/**improve** CLS — an improvement is a PASS signal, not a band
     violation. TBT Δ≤50 ms applies to all profiles.
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
   no-op-OFF vs real-ON substrate is the faithful local stand-in for the **GA4-only** profile; the **alloy** profiles
   are exercised by extending the local dry-run to inject an **authored** `window.__airlockConfig` fixture (the
   code-path support exists — `scripts.js:184`/`246` + `reserve-personalization.js` — but no such fixture exists in the
   testbed today, so it must be written) so the eager-import LCP/CLS path runs locally too, OR are scoped to the
   operator's live run — but each in-scope profile is exercised SOMEWHERE, never silently unproven. The live remote run
   is the operator's creds-gated step.
6. **Documented run-procedure.** A doc (under `docs/`, NOT the scaffold-squatted `docs/adoption-readiness.md`) walks the
   operator through: the pre-flight `node build.mjs` rebuild (034-02:117); the PRIMARY recipe — add the client-side gate
   covering BOTH airlock entrypoints (`:184` + `:246`) to the throwaway validation branch so `?airlock=1` = ON and plain
   = bare page, deploy, run the harness against the one URL; a **cache-parity pre-check** (confirm both arms return
   equivalent edge cache-state / comparable TTFB before the measured run, so the query variant is not silently
   origin-rendered while plain is edge-cached — else the fixed-offset confound returns); which profile's band to read;
   and the FALLBACK (two deployments, band-withheld). The gate is throwaway validation scaffolding, never shipped runtime.
   The procedure names `window.__airlockOwnsRum` (`scripts.js:270` guard → the post-`appear` `bootHelixRum` import `:272`, invoked `:273`) as a
   **distinct toggle axis** from `__airlockConfig`: it is post-LCP (so it does not touch the LCP-by-construction
   discriminant; its cost rides the TBT band), so the operator gates the axis under test and does not conflate the
   RUM-replace toggle with the connector-config axis (RUM-replace boot-health is 036-02's territory).
7. **No-regression.** If the harness generalizes `lh-eds.mjs`, `npm run lh:eds` (the local OFF/ON path) stays
   byte-behaviour-identical when no live `URL` is given; `cwv:scoreboard`/`cwv:budget` unaffected. `npm test` +
   `node build.mjs` + `contracts/validate.mjs` + `npm run lint` stay green.

**DoD:** all ACs pass; the harness runs against the local testbed producing a valid card (mechanical dry-run); the
run-procedure doc is written + linked from where an adopter would look (`README.md` / the MVP6 release plan); reviewed
(compliance + craft + **frame-critique** [`frame_review: true`]); deviation log + reconciliation sweep; reconciliation
review; board synced. (No `arch_review`: rig + docs only — no `core/` or `contracts/` change; the harness exercises the
runtime, it does not alter it.)

## Close-out

### Deviation log

- **Craft fork taken (an allowed slice option, recorded per the reviews):** implemented as a **new `rig/lh-live.mjs`
  plus an extracted shared engine `rig/lh-core.mjs`** (rather than generalizing `lh-eds.mjs` in place). `lh-eds.mjs` was
  refactored to import the median/`armSummary`/delta/band/`runLighthouseOnce` engine from `lh-core.mjs` — genuine reuse,
  behaviour verified byte-identical (`lh:eds` + `cwv:budget` run live post-refactor; AC7). This is the stronger reading
  of AC1's "reuse, not re-implement."
- **Local Lighthouse dry-run EXECUTED (stronger than the slice anticipated).** The slice hedged that the sandbox might
  not launch headless chromium; it could. The harness ran live against the local testbed for **all three profiles**
  (`ga4` on `index.html`; `alloy-analytics` + `personalization` on the authored `index-alloy.html` fixture with a stub
  `bundleUrl`) **plus** the two-deployment fallback — each emitting a valid card. A throwaway Playwright probe confirmed
  the personalization ON arm's `airlock:reserve` mark fires BEFORE `body:appear` (the pre-LCP path) while OFF has no
  `__airlockConfig` — proving the local gate covers BOTH entrypoints (fork B faithful analog).
- **`bootHelixRum` line-ref corrected (compliance + craft nit):** the doc + slice cited `scripts.js:272` for
  `bootHelixRum`; `:270` is the `__airlockOwnsRum` guard, `:272` the dynamic import, `:273` the invocation. Fixed in
  `docs/real-site-validation.md` + this slice.

**Review-flagged follow-ons (compliance + craft both PASS; non-blocking, recorded — not closed here):**
- **(craft nit → inbox) shared local-server plumbing is duplicated** (`BOILERPLATE_CSP`/`MIME`/`NOOP_EDS` + the static
  http-serve skeleton) across `lh-eds.mjs` and `lh-live.mjs` (and the median/band math had a THIRD copy in
  `subtree-install.mjs`, already parked). As the rig family grows (036-02), factor a shared rig-server helper.
- **(craft nit → inbox) `lh-live.mjs`'s mode-selection / guard / URL-construction has no CI coverage** — only
  `lh-core`'s pure `bandDisposition` is unit-tested, and only the query-gate local path is exercised by the dry-run; the
  two-deployment + guard branches are operator-only. The URL logic is already correct (`new URL()` + `searchParams.set`,
  not naive concatenation), so this is regression-protection, not a bug — extract a pure `resolveRunPlan(env)` +
  unit-test it when the rig family grows.
- **(craft nit, intentional — logged) the alloy `band` field is `{tbtMs:50}`** and omits the CLS side that `within_band`
  nonetheless enforces via `!clsRegressed`; the asymmetric CLS treatment (improvement passes, only a regression >0.01
  fails) is carried by the separate `cls_held`/`cls_improved`/`cls_regressed` flags + the note. Intentional; the flags
  are the source of truth.
- **(compliance nit, harmless) `query_param` is echoed into the two-deployment card's config block** where it is
  irrelevant. Cosmetic; left as-is.

### Reconciliation sweep

| Artifact | Disposition | Rationale |
|----------|-------------|-----------|
| `rig/lh-core.mjs` | `created` | The pure Lighthouse-independent engine: median/`summ`/`armSummary`/`computeDeltaMedian`/`withinTightBand` (extracted from `lh-eds`) + DI'd `runLighthouseOnce` + the new `bandDisposition`/`renderNote`/`buildResult` (profile→band + card). No browser import; vitest-safe. |
| `rig/lh-live.mjs` | `created` | The harness (`npm run lh:live`): query-gate PRIMARY (one `LIVE_URL`, OFF plain vs ON `?airlock=1`), two-deployment band-withheld FALLBACK, local dry-run (both-entrypoint gate + authored alloy fixture). |
| `rig/lh-eds.mjs` | `updated` | Refactored to import the shared engine from `lh-core.mjs` (net −23 lines); output shape + values byte-identical (AC7, run live to confirm). |
| `probes/eds-testbed/index-alloy.html` | `created` | The authored `window.__airlockConfig` fixture (none existed — it was set nowhere) for the alloy-profile local dry-run; a dedicated non-LCP promo slot for the personalization reserve. |
| `test/lh-core.test.js` | `created` | 22 unit tests (TDD red→green): median/delta math, the profile→band decision (3 profiles × both modes, incl. improved-CLS-is-a-pass), note + card rendering — non-vacuous (a wrong band decision fails). |
| `docs/real-site-validation.md` | `created` | The operator run-procedure (pre-flight rebuild, both-entrypoint client-side gate, cache-parity pre-check, profile→band table, `__airlockOwnsRum` distinct axis, fallback, local dry-run, advisory discipline). |
| `package.json` | `updated` | `"lh:live": "node rig/lh-live.mjs"`. |
| `README.md`, `docs/releases/mvp6.md` | `updated` | Link the run-procedure doc from where an adopter looks (DoD). |
| `docs/inbox.md` | `updated` | Parked the `subtree-install.mjs` third-copy median/band observation (implementer); the two craft follow-ons above join it. |
| `docs/specs/README.md` (board) | `deferred` | Flips to DONE at the DONE transition (close-out). |

### Definition of Done — verification
- [x] All 7 ACs pass. **TDD red→green** (the pure engine's tests written failing first, then green). `npm test`: **83 files, 1225 tests** (1203 baseline + 22 new). `node build.mjs` OK; `node contracts/validate.mjs` all pass; `npm run lint` clean. `npm run lh:eds` + `cwv:budget` still run live (AC7 no-regression).
- [x] Query-gate PRIMARY (both airlock entrypoints gated, OFF = bare page) + two-deployment band-withheld FALLBACK; band discriminated on `__airlockConfig` presence (ga4 by-construction/tight, alloy measured); genuine `lh-core` engine reuse; local dry-run EXECUTED for all 3 profiles + fallback.
- [x] The run-procedure doc written + linked (`README.md`, `docs/releases/mvp6.md`). No `arch_review` (rig + docs).
- [x] Reviewed: **frame-critique** PASS (4 rounds); **compliance** PASS; **craft** PASS. Deviation log + reconciliation sweep produced; follow-ons recorded (not closed).
- [ ] Reconciliation review passed; board synced (pending — this close-out, then the reconciliation pass + DONE transition).
