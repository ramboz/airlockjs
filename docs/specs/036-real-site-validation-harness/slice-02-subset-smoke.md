---
status: DRAFT
dependencies: [036-01]
last_verified:
frame_review: true  # Fork C (which named live residuals the harness EXERCISES vs the procedure DOCUMENTS) + the subset-smoke local-provability split are load-bearing.
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
     against a stock `sampleRUM` run**. Stakes: RUM-replace neutralizes inline `sampleRUM` (`README.md` — "Replacing
     will silently stop collecting them"), so a false-green ships airlock as the RUM authority while the site silently
     loses CWV telemetry with no error anywhere. **A captured beacon is explicitly NOT a sufficient reveal for this item.**
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
