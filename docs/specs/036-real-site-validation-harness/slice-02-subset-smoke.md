---
status: IN_PROGRESS
dependencies: [036-01]
last_verified:
frame_review: true  # Fork C (which named live residuals the harness EXERCISES vs the procedure DOCUMENTS) + the subset-smoke local-provability split are load-bearing.
claimed_by: claude/mvp6-e4550f
---

<!-- jig self-defining vocabulary (soft, forward-only); jig grounding (064-02/ADR-0020): probe/cite or mark assumptions. -->

## Slice 036-02 — supported-subset live smoke (GA4 + alloy) + residuals checklist + run-procedure

**Goal:** the second half of the MVP6 adoption proof — *"the supported connector subset boots + emits conformant
beacons on a real page"* — as a **repeatable smoke rig** + a **named-live-residuals checklist** + the consolidated
operator run-procedure. Confirms **GA4** + **Adobe/alloy** boot cleanly (no `__airlockBootFailed`) and emit conformant
beacons on a live EDS page; documents the creds-gated live residuals (RUM `ot.aem.live` wire-shape, alloy
endpoint-ceiling breadth, live-host Trusted-Types + real ~766 KB bundle boot) for the operator. Proven against the local
testbed for what is locally provable; the real-Edge / real-RUM-collector steps are the operator's creds-gated run.

**DoR:**
- ✅ 036-01 DONE (the CWV harness + `docs/real-site-validation.md` procedure it will extend). Grounded (read
  2026-09-05): `rig/e2e.mjs` — the Playwright `page.route("**/collect*")` beacon-capture + the `contracts/ga4-mp-request.schema.json`
  Ajv conformance oracle + the boot-health wait on `window.__flicker`'s `airlock:init` mark / `window.__airlockBootFailed`;
  the alloy stub bundle (`rig/alloy-csp-stub-bundle.js`) + the authored `probes/eds-testbed/index-alloy.html` fixture
  (036-01); the creds-gated live-Edge rigs `rig/alloy-live-*.mjs` (spec 013 — env `ALLOY_*`, redacted committed
  fixtures); the RUM live wire-shape gate (spec 030-04, `connectors/helix-rum/README.md`); the endpoint-ceiling breadth
  + TT/full-bundle residuals (`docs/refinement-todo.md` ~L563 / ~L575, ADR-0016).

**Design focus (the frame-critique ratifies Fork C + the local-provability split — NOT asserted here):**
- **Fork C — which named residuals the harness ACTIVELY EXERCISES vs the procedure DOCUMENTS.** The harness can actively
  assert what a headless page reveals: boot-health (`__airlockBootFailed` / `__airlockRumBootFailed`), beacon **presence
  + conformance** (GA4 `/collect` against the MP schema; the alloy interact fired; the RUM beacon shape when
  `__airlockOwnsRum`). The **creds-gated live gates** — does the real `ot.aem.live` collector ACCEPT airlock's `cwv`
  *superset* (030-04, a HARD gate); does the endpoint ceiling correctly hold the server-directed `demdex`/ID-sync URLs
  the live Edge returns (refinement-todo ~L563); does the real ~766 KB `@adobe/alloy` bundle boot under the live host's
  Trusted-Types policy (ADR-0016 kill-criterion ~L575) — are OBSERVED on the operator's live run. The frame-critique
  ratifies the exercise/document split (what the rig asserts vs the checklist prompts the operator to confirm) so a
  residual is never silently assumed-passed.
- **The local-provability split (fork B for this slice).** Locally provable (I can run): GA4 subset smoke (beacon
  capture + MP conformance + boot-health, reusing `rig/e2e.mjs`); alloy **chamber boot-health** via the stub bundle
  (the chamber boots, no `__airlockBootFailed`; the interact hits the stub, not real Edge). NOT locally provable
  (operator, creds-gated): the alloy interact SHAPE against the real Adobe Edge + the RUM shape against real
  `ot.aem.live`. Frame-critique grounds that the local dry-run proves the mechanism + GA4 conformance while the live
  wire-shapes are honestly deferred (never faked).

**Acceptance Criteria (ratified at the frame-critique):**

1. **Supported-subset live smoke rig — presence + client-side conformance ONLY (never presence-as-acceptance).** A rig
   loads an operator-supplied live URL, asserts **boot-health** (no `__airlockBootFailed` / `__airlockRumBootFailed`;
   the `airlock:init` mark fired), and captures the subset's beacons: **GA4** `/collect` — checked for **MP-schema
   conformance** against `contracts/ga4-mp-request.schema.json` (reusing `e2e.mjs`'s capture+Ajv pattern; a legitimate
   client-side acceptance oracle for GA4); **alloy** interact — asserted only **FIRED** to the pinned datastream host
   (a presence signal — a malformed XDM still POSTs and can get an error handle back, so the interact SHAPE + ECID
   write-back is NOT confirmed here; it rides the spec-013 `rig/alloy-live-*.mjs` redacted-fixture rigs); **RUM** —
   the SENT beacon shape captured when `__airlockOwnsRum` (what airlock sent, NOT what the collector kept — see AC2).
   Creds-gated for the live alloy/RUM arms (env `ALLOY_*`, spec 013 convention — run manually, NOT in a hermetic
   `npm test`).
2. **The named-live-residuals checklist (Fork C) — each item names an HONEST reveal (a wire-side signal is forbidden
   for a downstream-acceptance gate).**
   - **RUM `ot.aem.live` `cwv`-superset acceptance (030-04, a HARD gate).** This is a **DOWNSTREAM** property — the live
     collector must keep the superset's extra fields, "not rejected/**truncated in a way that breaks the pipeline**"
     (`connectors/helix-rum/README.md`). `ot.aem.live` is fire-and-forget (2xx, no synchronous validation), so a
     captured beacon / a 2xx / boot-health reveals only what airlock **sent**, NEVER what the collector **kept** —
     confirming acceptance from those is a structural FALSE-GREEN. The checklist REQUIRES **downstream AEM RUM-data
     inspection** (the RUM bundler/explorer — is the superset present in the collected data?), ideally a **differential
     against a stock `sampleRUM` run**. Stakes: the `__airlockOwnsRum` cutover neutralizes ALL inline `sampleRUM` egress
     — `cwv` included (`connectors/helix-rum/README.md`; testbed `scripts.js` `sampleRUM`-neutralize comment) — so a
     downstream superset rejection ships airlock as the RUM authority while the site silently loses CWV telemetry with
     no error anywhere. **A captured beacon is explicitly NOT a sufficient reveal for this item.**
   - **alloy endpoint-ceiling breadth** — the wrapped-SDK host HOLDS a server-directed `demdex`/ID-sync URL the live
     Edge returns, surfaced fail-closed via the `kind:"endpoint-ceiling"` held diagnostic (`core/wrapped-sdk-host.js`,
     captured through `onDiagnostic`), NOT silently dropped (refinement-todo ~L563). Reveal: the captured diagnostic.
   - **real ~766 KB bundle boot under live-host Trusted-Types** (ADR-0016 kill-criterion ~L575) — genuinely a boot-side
     property: reveal is boot-health (no `__airlockBootFailed`; `airlock:init` fired) with the REAL bundle, not the stub.
   Each item names what "pass" looks like + its HONEST reveal; a downstream-only gate (RUM) must not admit a wire-side reveal.
3. **Proven against the local testbed (local-provability split).** The rig runs green locally for what is locally
   provable — GA4 beacon capture + MP conformance + boot-health; alloy **chamber** boot-health via the stub bundle — a
   dry-run I can execute. The real-Edge alloy interact + real `ot.aem.live` RUM shapes are honestly scoped to the
   operator's creds-gated run (redacted-fixture discipline, spec 013), never faked locally.
4. **Consolidated operator run-procedure.** Extend `docs/real-site-validation.md` (or a linked sibling) with the subset
   smoke: env/creds handling (`ALLOY_*`, redacted fixtures — never commit raw identifiers); how to run the smoke against
   the live URL; the residuals checklist (AC2) with each residual's HONEST reveal — explicitly including that the RUM
   `cwv`-superset gate needs **downstream RUM-data inspection** (a captured beacon / 2xx is NOT sufficient) and that the
   alloy interact SHAPE rides the spec-013 rigs (the smoke only proves it FIRED).
5. **No-regression.** `rig/e2e.mjs` + the 036-01 harness are unaffected (shared capture/health helpers extracted, not
   forked, where reused); `npm test` + `node build.mjs` + `contracts/validate.mjs` + `npm run lint` stay green.

**DoD:** all ACs pass; the smoke rig runs green locally for the locally-provable subset (GA4 conformance + alloy chamber
boot-health); the residuals checklist + consolidated procedure written + linked (`README.md` / `docs/releases/mvp6.md`);
reviewed (compliance + craft + **frame-critique** [`frame_review: true`]); deviation log + reconciliation sweep;
reconciliation review; `docs/releases/mvp6.md` adoption-proof row updated to "harness + procedure shipped; live run is
the operator's"; board synced. (No `arch_review`: rig + docs only — exercises the runtime, does not alter it.)

## Close-out

### Deviation log

- **Shared `rig/smoke-core.mjs` extracted (AC5), not forked.** `rig/e2e.mjs`'s three genuinely-shared pieces — the Ajv
  `ga4-mp-request.schema.json` oracle compile, the `page.route("**/collect*")` beacon-capture route, and the
  boot-health `waitForFunction` wait on `window.__flicker`'s marks / `window.__airlockBootFailed` — were extracted
  verbatim (DI'd against `page`/`beacons`/`schemaJson`, not re-implemented) into a new `rig/smoke-core.mjs`, imported
  by both `rig/e2e.mjs` and the new `rig/subset-smoke.mjs`. `e2e.mjs`'s own UC-2-specific assertions (the
  worker-cycle / `pushCritical` timing proofs) were left untouched. **Verified**: `npm run rig:e2e` re-run
  post-refactor still emits `"pass": true` (its full worker-path + unload-critical-fast-path + identity assertions
  all hold byte-identical) — the extraction is behaviour-preserving, not just lint-clean.
- **Local dry-run EXECUTED (not merely mechanically-argued).** `npm run rig:subset-smoke` ran against the local
  testbed under real headless chromium: the GA4 arm (`index.html?rum=airlock`) captured a real `/collect` beacon and
  validated it MP-conformant; the alloy arm (`index-alloy.html` + the CSP-proof stub bundle) booted clean with no
  `__airlockBootFailed`. Full card: `pass: true`, every check's disposition read back honestly (see this slice's
  implementer report for the verbatim card).
- **Universal `window.airlock.push()` trigger, not a testbed-only selector (a judgment call, not asked for
  verbatim).** `rig/e2e.mjs`'s own trigger (a real click on `#cta-engage`) only exists on the testbed fixture; a real
  operator's live page has no such element. Both the local and live arms instead call the PUBLIC `push()` contract
  every airlock boot path installs on `window.airlock` (`adapters/eds/index.js`'s `installOnWindow`) —
  `window.airlock.push({event:"page_view", page_location})` — which GA4's `["*"]` catch-all and alloy's
  `["page_view"]` manifest both accept, so one site-agnostic call exercises both connectors on ANY airlock-booted
  page. RUM needs no trigger (`bootHelixRum` auto-pushes its own `top` checkpoint synchronously on boot).
- **Live-mode connector detection: config introspection, not an operator-declared `PROFILE=` flag.** Unlike
  `rig/lh-live.mjs` (036-01), which asks the operator to declare `PROFILE=` because it cannot see the remote page's
  config, `rig/subset-smoke.mjs` directly reads the live page's own `window.__airlockConfig` via `page.evaluate`
  (absent config → `bootEdsAnalytics()`'s GA4-only shape, mirroring `scripts.js`'s own dispatch) to decide which of
  GA4/alloy is actually configured. This is directly-observed ground truth rather than a manual declaration, and
  needs no extra env var from the operator — recorded as a deliberate divergence from the sibling rig's convention,
  not an oversight.
- **RUM's SENT-shape capture exercised in the local dry run too (an additive read of AC1, not asked verbatim by
  AC3).** AC3's local-provability list names "GA4 conformance + alloy chamber boot-health" only. Because RUM's SENT
  beacon capture needs no live collector (it is fed by the testbed's existing `?rum=airlock` opt-in, spec 030-03)
  it is mechanically local-provable too, so the local GA4 arm also exercises it — giving the residuals checklist's
  sent-vs-kept distinction (AC2) a running, honestly-labeled example (`"SENT (shape only — NOT collector
  acceptance...)"`) rather than prose alone. The local run stays green either way; nothing here is faked live
  acceptance.
- **Dropped `page_title` from the trigger's pushed event (a small in-flight correction).** An early draft of the
  universal trigger included `page_title: document.title`; the testbed's `index.html` has no `<meta charset>`, so
  its em-dash title round-tripped through the browser mangled (a pre-existing testbed encoding gap, unrelated to
  airlock's own code — cosmetic only, it never affected MP-schema conformance or pass/fail). Rather than editing
  testbed serving code (out of this slice's declared scope), `page_title` was simply dropped from the pushed
  descriptor — it was never needed for any check.

**Orchestrator craft-review fixes (after the craft pass returned needs-changes on two robustness blockers):**
- **boot-health now gates on the POSITIVE signal `window.airlock` installed** (via `installOnWindow`, the production
  signal — NOT the testbed-only `airlock:init` `__flicker` mark) in addition to `__airlockBootFailed`, so a silently
  HUNG boot (never threw) is caught rather than reported "clean" — the AC3 alloy-chamber-boot-health false-green the
  craft review flagged (`bootHealthDisposition(bootFailed, {installed})`; `runArm` reads `airlockInstalled`; the main
  check gates `installed: arms.every(a => a.airlockInstalled)`).
- **live RUM sampling no longer false-FAILs a healthy page:** `rumSentDisposition` takes `beaconGuaranteed`
  (`MODE !== "live"`); absent+guaranteed (local force-select) = fail, absent+sampled (live) = informational (a broken
  RUM *boot* is still caught by the separate `rum_boot_health` check).
- **RUM flakiness fixed:** the RUM check selects the `top` checkpoint (`rumBeacons.find(checkpoint==="top")`) instead
  of `rumBeacons[0]` (several checkpoints race; a non-top lacks fields → non-deterministic fail). Local dry-run stably
  green across repeated runs.
- **nits:** the trigger drops the explicit `page_location` (optional in the MP schema; a long live URL would trip the
  schema's generic `maxLength:100` — a smoke artifact); `locallyExercisable`→`networkExercisable` (the flag reads true
  in LIVE mode); doc notes added (RUM sampling/force-select, the consent-granted assumption, the page_location caveat).
- **craft re-run notes (applied):** stale JSDoc param name corrected (`smoke-core.mjs`); the pre-existing ~20 s
  live-wait latency (no `__flicker` mark on a real page → full timeout before the positive read) documented as an
  operator note. Verdict is correct throughout — the wait is latency, not a hang.

### Review dispositions (compliance PASS; craft PASS after the r2 re-run)

- **Compliance — PASS.** All 5 ACs met with real substance; the honest presence-≠-acceptance labeling holds in both
  the disposition strings and the doc; unit tests non-vacuous. (The compliance reviewer's non-blocking consent-note
  suggestion is now folded into the doc.)
- **Craft — needs-changes (r1) → PASS (r2).** r1 found the two robustness blockers above + nits (all fixed). r2
  verified the fixes sound against source (the positive signal is the production `window.airlock`/`installOnWindow`,
  confirmed in `adapters/eds/index.js`; the sampled/guaranteed split correct; the top-checkpoint selection
  deterministic), the new tests non-vacuous, and no new defect; the two r2 notes were applied.

### Reconciliation sweep

| Artifact | Disposition | Rationale |
|----------|-------------|-----------|
| `rig/smoke-core.mjs` | `created` | Shared browser-rig primitives (`compileGa4Validator`/`captureCollectBeacons`/`waitForBootHealth`, extracted from `e2e.mjs`) + the pure verdict/disposition logic (boot-health w/ the installed gate, GA4-conformance, alloy presence, RUM sent-shape w/ the sampled/guaranteed split, `buildSmokeVerdict`). Honest labels: never "accepted" for alloy/RUM. |
| `rig/subset-smoke.mjs` | `created` | The smoke rig (`npm run rig:subset-smoke` local; `LIVE_URL` for the operator's creds-gated live run). Site-agnostic public-`push` trigger; `__airlockConfig` connector detection; the `top`-checkpoint RUM selection; `airlockInstalled` positive-boot read. |
| `rig/e2e.mjs` | `updated` | Refactored to import the 3 shared primitives from `smoke-core.mjs` (genuine reuse, not fork); behaviour-preserving (re-ran, `pass:true`; its imports untouched by the disposition changes). |
| `test/smoke-core.test.js` | `created` | 31 unit tests (TDD red→green): the disposition logic never claims acceptance; the installed-gate, the RUM sampled-vs-guaranteed split, and bootFailed/non-conformant all fail correctly. |
| `docs/real-site-validation.md` | `updated` | Part 2 (subset smoke) + the named-live-residuals checklist (RUM cwv-superset = downstream inspection, NOT a beacon; alloy endpoint-ceiling via `onDiagnostic`; real-bundle TT boot; alloy shape via 013 rigs) + env/creds + the sampling/consent/latency/page_location operator notes. |
| `docs/releases/mvp6.md` | `updated` | The adoption-proof row → "harness + procedure shipped (036, both slices); the live run is the operator's creds-gated step." |
| `package.json` | `updated` | `"rig:subset-smoke"` (the local dry-run; the live run is manual per the spec-013 creds convention). |
| SDD process records | `excluded` | This slice doc, `spec.md`, and the `reviews/slice-02-*.md` verdicts — review scaffolding, changes narrated here + in the reviews, not deliverables. |
| `docs/specs/README.md` (board) | `deferred` | Flips to DONE at the DONE transition (close-out). |

### Definition of Done — verification
- [x] All 5 ACs pass. **TDD red→green** (the pure disposition logic). `npm test`: **84 files, 1256 tests** (1225 baseline + 31). `node build.mjs` OK; `node contracts/validate.mjs` all pass; `npm run lint` clean. `rig/e2e.mjs` still `pass:true` post-refactor; the local dry-run `pass:true`, stable across repeated runs.
- [x] Smoke asserts boot-health (incl. the positive `window.airlock`-installed signal) + GA4 MP-conformance + alloy FIRED (presence only) + RUM sent-shape — never presence-as-acceptance; the residuals checklist requires downstream RUM-data inspection (a captured beacon is NOT sufficient), and the alloy interact shape rides the spec-013 rigs.
- [x] Genuine `smoke-core` reuse (e2e imports it); the run-procedure + residuals checklist written + linked (`README.md` / `docs/releases/mvp6.md`); the mvp6 adoption-proof row updated. No `arch_review` (rig + docs).
- [x] Reviewed: **frame-critique** PASS (2 rounds); **compliance** PASS; **craft** PASS (r2 after the robustness fixes). Deviation log + review dispositions + reconciliation sweep produced.
- [ ] Reconciliation review passed; board synced (pending — this close-out, then the reconciliation pass + DONE).
