---
status: DONE
kind: spike
dependencies: [032-01, 032-02]
last_verified: 2026-09-04
frame_review: true  # the spike rests on load-bearing feasibility unknowns — the frame gate confirms the Question is the right one.
---

<!-- jig self-defining vocabulary (soft, forward-only): expand each acronym on
     first use and link the term to docs/memory/glossary.md (or jig's lexicon). -->

<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about runnable
     surfaces by probe first (run it / read source) or a citation, else mark them
     as assumptions — never assert an unverified claim as fact. -->

## Slice 033-01 — spike: de-risk alloy adapter-boot + distribution + the composite-handle reconciliation (GO/KILL)

**Question:** Can Adobe/alloy — the wrapped-SDK connector (classic `importScripts` worker + a 766 KB stock bundle,
hosted by `createWrappedSdkHost`'s single-slot `driveEvent`) — be (a) **loaded + executed under the enforced EDS
boilerplate CSP** (the PRIMARY KILL risk — a *classic* `importScripts` worker is NOT the `{type:"module"}` worker
004-01 proved), (b) **distributed + served same-origin for a buildless EDS site**, (c) **adapter-booted**
(`bootAlloy`) wrapping the wrapped-SDK host + the stock-SDK load, and (d) **exposed as a composite-compatible
handle** so `boot({ connectors: [{ type: "alloy", … }] })` works — a clean **GO** (with a concrete design for
033-02), a **reshape**, or a partial **KILL** (e.g. "the site must supply the alloy bundle itself", or "classic
worker won't load under the CSP")?

**Time-box:** 1 day (bounded investigation — read + targeted feasibility probes; NO production build slice here).

**DoR:**
- ✅ 032 DONE — `boot(config)` + the composite handle + the config schema exist (the surface alloy must plug into).
- ✅ The alloy hosting path is understood: `createAlloyConnector` + `createWrappedSdkHost` + the classic IIFE
  `alloy-chamber.worker.js` (importScripts the stock bundle) + the alloy rigs (`rig/alloy-*.mjs`) — read this session.

**Findings (fill during IN_PROGRESS — evidence, not assertion; probe/read, cite file:line):**

Answer each load-bearing unknown with evidence, and for each give a GO / RESHAPE / KILL lean. **#1 is the PRIMARY
KILL risk — probe it first; a KILL there shapes everything below.**

1. **CSP admission — the classic `importScripts` worker under the real EDS CSP (PRIMARY KILL risk; frame-critique).**
   Does a **classic** Worker that `importScripts` a **same-origin 766 KB bundle** load AND execute under the
   *enforced* EDS boilerplate CSP (`script-src 'nonce-aem' 'strict-dynamic' …`, **no `worker-src`**,
   `require-trusted-types-for 'script'`)? **004-01 proved that CSP only for a `{type:"module"}` worker**, on
   module-specific reasoning (a nonce-trusted script's dynamic-import trust chain admits a module worker —
   `docs/specs/004-uc2-ga4-eds/slice-01-worker-under-csp.md`; `build.mjs`'s HARD CONSTRAINT ties same-origin-file to
   exactly that MODULE verdict). `importScripts` is **not** covered by that chain, and under `'strict-dynamic'`
   host-source allowlists are ignored — so this is unproven and a genuine KILL candidate. **Every alloy rig runs
   CSP-less** (localhost, `content-type` only — `rig/alloy-chamber.mjs`/`rig/alloy-core-host.mjs`). **Cheapest real
   probe:** re-run the 004-01 `rig:csp` harness pointed at the *built classic alloy worker* under the boilerplate
   CSP. If it can't load → KILL or reshape (site-supplies-alloy via its own `<script>`, or a module-worker rewrite
   of the chamber). Fold Trusted-Types (`require-trusted-types-for`) into the check.
2. **Distribution.** Can the classic IIFE alloy worker become a served `dist` artifact (a 5th entry, *classic*
   format — `build.mjs` today emits only ESM `type:module` workers + asserts same-origin file URLs, no
   `blob:`/`data:`)? And the **766 KB stock alloy bundle** it `importScripts` — for a *buildless* EDS site with no
   `node_modules`, does airlock **ship + serve** it same-origin (byte-pinned per AD-7 — and is its
   **licensing/redistribution** of the stock Adobe bundle acceptable?), or must the **site supply alloy itself** (a
   documented consumer prerequisite)? What does 031's distribution mechanism (dist-rooted ref, `git subtree`)
   accommodate vs need to change?
3. **Handle reconciliation.** How does `createWrappedSdkHost`'s **single-slot `driveEvent`** ("one page event per
   host") map to the composite's `push`/`pushCritical`/`setConsent`/`dispose`/`getState`? Is a per-`push`
   host-instance (or a re-entrant driveEvent) viable, or does alloy need a different handle contract inside the
   composite? **NOTE (grounded): `createWrappedSdkHost` exposes NO `dispose` and does NOT own/spawn the Worker** — so
   `bootAlloy` must build the Worker construction + teardown itself (relevant to `dispose` + the 021-01 no-leak
   invariant the composite enforces). How do `setConsent` (the seam `egressVerdict` + in-chamber delegate) and
   `getState` behave for a round-trip host?
4. **Adapter boot.** Can a `bootAlloy(opts)` wrap `createWrappedSdkHost` + spawn the (built, served) classic worker +
   trigger the stock-SDK load + wire the caps (`egress.dispatch`, `cookies.reconcile`, `decisions.deliver`,
   `configIntegrity`, `endpointCeiling`, `consent`/`egressPurposes`) + return the composite-compatible handle — WITHOUT
   forking the rig-only logic? What's the smallest real proof (a headless boot that `sendEvent`s once)?
5. **Decisions + consent.** How do decisions-as-data (Target propositions → `caps.decisions.deliver` → host
   `reserveSpace`, spec 012-03/018) and the seam-side consent gate (`egressVerdict(strict)`, spec 020) wire through
   the adapter + the composite's `setConsent` — per alloy's governance class (analytics_storage + personalization +
   ad_storage; NOT helix-rum's exempt class)? **NOTE (grounded): the chamber's `{type:"decisions"}` message is NOT
   consumed by `createWrappedSdkHost.handleMessage` today** (only a rig harness listens) — so the
   decisions→`reserveSpace` path is genuinely un-built and this unknown is load-bearing, not incremental.

**Recorded findings + leans (2026-09-04 — probes under `probes/alloy-csp-spike/`, 3 real Chromium/Playwright runs
under the enforced boilerplate CSP with the 004-01 non-nonce'd-inline negative control proving `csp_enforced`):**

1. **CSP admission → GO (with a ~4-line fix in airlock's OWN worker).** Classic `new Worker(url)` construction is
   **ADMITTED** under `'strict-dynamic'` (the classic/module distinction does not affect top-level worker-script
   admission; `worker-src` escalations changed nothing). `importScripts` is **BLOCKED — by Trusted Types, NOT by
   `strict-dynamic`**: it is a `TrustedScriptURL` sink and the page's `default` policy is per-realm (doesn't reach
   the worker) → `"…requires 'TrustedScriptURL' assignment."` — exactly what the shipped
   `alloy-chamber.worker.js:377` `self.importScripts` hits today (→ `fatal{phase:"load"}`). **This is why 004-01's
   MODULE worker "just worked" and a classic one doesn't: module loading is not a TrustedScriptURL sink;
   `importScripts` is.** FIX (proven green, both a worker-realm `default` policy and an explicit named policy):
   the worker installs its OWN TT policy + `importScripts(policy.createScriptURL(url))` — ~4 lines in airlock's own
   worker file, **NOT a site CSP change**. Residual: a restrictive `trusted-types <names>` directive omitting the
   name would block it — the captured boilerplate has none; re-confirm on the live host.
2. **Distribution → GO (reshape).** The classic worker becomes a 5th `dist` entry but needs a **second esbuild call
   (`format:"iife"`)** — `build.mjs` emits the 4 workers in one `esm` call — plus a basename out-name generalization
   (`build.mjs` + `publish-dist.mjs` assume `core/`-rooted workers; alloy lives under `connectors/alloy/`). The HARD-
   CONSTRAINT assertions transfer. The 766 KB stock bundle need NOT be same-origin (cross-origin `importScripts`
   admitted); **default to site-supplied via `bootAlloy({ bundleUrl })`** (a documented prerequisite) because
   **redistributing Adobe's stock SDK is a licensing question → the ship-vs-site-supplies choice is ADR-worthy.**
3. **Handle reconciliation → GO (small host extension).** `bootAlloy` returns the full composite handle; `push`
   drives events **sequentially through the retained chamber** (extend `createWrappedSdkHost`'s single-slot
   `driveEvent` with a small sequential queue — reuse, not fork); **`bootAlloy` owns Worker construction + teardown**
   (`dispose` → `worker.terminate()`) since the host provides neither → preserves the 021-01 no-leak invariant.
4. **Adapter boot → GO.** `bootAlloy(opts)` reuses the rig's proven main-thread wiring (`createWrappedSdkHost` +
   `caps` egress/cookies/decisions); `{type:"alloy"}` added to `KNOWN_CONNECTOR_TYPES` + a `bootConnector` case.
   Smallest proof (033-02): extend `rig/alloy-core-host.mjs` to drive through `boot({connectors:[{type:"alloy"}]})`.
5. **Decisions + consent → GO (one un-built main-thread consumer).** The chamber's `{type:"decisions"}` message is
   **not consumed** by `createWrappedSdkHost` today → `bootAlloy` adds a main-thread listener routing `Decision[]` →
   `reserveSpace` (`adapters/eds/dom.js`; `extractDecisions` already exists). Consent: the seam gate already
   REQUIRES `egressVerdict(strict)`; thread the config's consent with `ALLOY_EGRESS_PURPOSES =
   ["analytics_storage","personalization"]`; `setConsent` updates the gate ref (+ the in-chamber delegate).

**Outcome:** **`spec 033-02 unblocked (GO — design recorded)`.** The primary KILL risk (#1) is retired by real
probes; the design for 033-02 is captured above (CSP TT-policy fix in airlock's worker; the `bootAlloy` shape +
composite handle with adapter-owned Worker teardown; the classic-IIFE 5th dist entry + site-supplied bundle default;
the decisions→`reserveSpace` listener + strict consent gate). **Two items ride onward:** (a) the ship-vs-site-supplies
stock-bundle decision is **ADR-worthy** (licensing); (b) a **live-deploy Trusted-Types re-confirmation** (a
restrictive `trusted-types` directive is the only residual CSP risk) should ride 033-02's proof or the next
real-host run.

**DoD:**
- [x] Each of the 5 unknowns has a grounded Finding (probe run / source cited) with a GO/RESHAPE/KILL lean — #1
      (CSP admission) probed via a real Chromium/Playwright harness against a *built classic alloy worker* under the
      boilerplate CSP (with the un-nonced-inline negative control proving the CSP is enforced).
- [x] The Outcome is set (**GO** with a concrete design) — decisive, not "needs more investigation".
- [x] The throwaway probes live under `probes/alloy-csp-spike/` (not wired into the shipped runtime/tests); the timebox was respected.
- [x] Reviewed (compliance: Findings grounded + Outcome honestly supported — PASS; **frame-critique** recorded
      PRE-investigation, since `frame_review: true`). The investigation review re-ran all 3 probes.
- [x] Deviation log + Reconciliation sweep produced under this slice heading; reconciliation review passed.
- [x] `docs/refinement-todo.md` + the 033-02 slice updated with the Outcome (GO design).

### Deviation log (after reconciliation)

The original spec is preserved above. Investigation notes:

- **Method + evidence.** Ran 3 real Chromium/Playwright probes under the *enforced* EDS boilerplate CSP (each with
  the 004-01 un-nonced-inline negative control proving `csp_enforced`), under `probes/alloy-csp-spike/`
  (`probe.mjs`/`probe2.mjs`/`probe3.mjs` + harnesses/workers + a built `alloy-chamber.worker.js`). The per-unknown
  Findings + leans + the **GO** Outcome are recorded in the Findings/Outcome blocks above.
- **The decisive, non-obvious finding (#1).** The classic worker is NOT blocked by `strict-dynamic` (construction
  is admitted) — `importScripts` is blocked by **Trusted Types** (`require-trusted-types-for 'script'`), because
  `importScripts` is a `TrustedScriptURL` sink and the page's `default` policy is per-realm. This **also explains a
  latent defect in the shipped worker**: `connectors/alloy/alloy-chamber.worker.js`'s `self.importScripts` (~:377)
  would `fatal{phase:"load"}` under a real EDS CSP today. The fix is ~4 lines *in airlock's own worker* (a
  worker-realm TT policy + `importScripts(policy.createScriptURL(url))`) — proven green, same + cross origin — NOT a
  site CSP change.
- **Review.** Independent review PASS (`reviews/slice-01-{compliance,craft}.md`) — the reviewer **re-ran all three
  probes** and confirmed every finding + the negative control; no overclaim; scope-clean (probes/ only, no
  shipped-runtime/board/STATUS changes).
- **Onward (folded into the sweep):** (a) the **ship-vs-site-supplies** stock-bundle decision → **ADR-0016**
  (site-supplied default; licensing) authored next; (b) the **live-host Trusted-Types re-confirm** (a restrictive
  `trusted-types <names>` directive is the only residual CSP risk) rides 033-02's proof; (c) **033-02 unblocked
  (GO)** — the trigger is MET, so a trigger-MET/GO **marker** was added to slice-02 pointing at the recorded design;
  slice-02 stays `DEFERRED` (its reopen DEFERRED→DRAFT + AC-flesh is 033-02's own ceremony, the immediate follow-on,
  NOT done in this spike).
- **Timebox respected**; no production build here (that's 033-02).

### Reconciliation sweep

| Artifact | Disposition | Rationale |
|----------|-------------|-----------|
| `docs/specs/033-alloy-config-wiring/slice-02-alloy-config-build.md` | `updated` | A **trigger-MET / GO marker** was added pointing at the recorded design (satisfies the DoD's "033-02 updated with the Outcome"). It **remains `DEFERRED` with its sketch ACs** — the actual reopen (DEFERRED→DRAFT) + AC-flesh is 033-02's own ceremony, the immediate follow-on, not done here. |
| `docs/specs/033-alloy-config-wiring/spec.md` | `updated` | The frame-critique fix threaded the **primary CSP-admission KILL-risk unknown** into Assumptions (new (a), renumbering the rest to (b)-(e)) + rewrote the Decomposition/SPIDR rationale to lead with it; `status: DRAFT→IN_PROGRESS` as the spike entered implementation. (Mirrors 020-01's "spec.md reconciled" precedent for a frame-critique-driven edit.) |
| `docs/specs/README.md` | `deferred` | The 033-01 board row flips DRAFT→**DONE** at the DONE transition (the close-out step, immediately after this reconciliation); 033-02 stays DEFERRED until reopened. |
| `docs/refinement-todo.md` | `updated` | The "alloy config-wiring" DEFERRED entry annotated with the **033-01 GO** progress + the ADR-0016 pointer (the entry is *struck* only when 033-02 closes the gap). |
| `docs/decisions/**` | `deferred` | The spike surfaced a load-bearing choice with real alternatives — **ship-vs-site-supplies the 766 KB stock bundle** (licensing). Recorded as **ADR-0016** (site-supplied default), authored as the immediate follow-on before 033-02. |
| `probes/alloy-csp-spike/**` | `updated` | The 3 throwaway CSP/Playwright feasibility probes + harnesses/workers/`out/` added here — **not** wired into the shipped runtime or the test suite (spike-local evidence). |
| `docs/architecture.md` | `no-op` | The architecture-shaped change (a classic-worker + vendored-bundle distribution mode, and the worker-realm TT policy) lands + is documented with the **033-02 build**, not the spike. |
