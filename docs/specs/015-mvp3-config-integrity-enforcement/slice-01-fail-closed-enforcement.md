---
status: DONE
dependencies: []
last_verified: 2026-08-30
frame_review: true
---

<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about
     runnable surfaces by probe first (run it / read source) or a citation. -->

## Slice 015-01 — fail-closed enforcement (hold + alert)

**Goal:** Make the seal **bite**, fail-closed. Wire a generic config-integrity control into `core/`'s
wrapped-SDK dispatch seam (014-01's `caps.egress.dispatch`) so that before the orchestrator does the
real fetch it verifies the outbound egress against the **host-pinned host + tenant key**, and on **any**
deviation **HOLDS** — no fetch — while emitting a **redacted diagnostic** (009-02). A compromised
core-hosted chamber that re-points its alloy datastream to an attacker tenant on the *allowed* host — or
tries to egress to a *foreign* host — is **blocked**, not silently corrected-and-sent, and the attempt is
**observed**. This is MVP3's **first enforcement teeth**; keep it narrow (one control, one seam, one
connector) so the machinery is proven small.

**DoR:**
- ✅ [014-01](../014-mvp3-wrapped-sdk-core-integration/slice-01-roundtrip-egress-core.md) DONE — the
  `caps.egress.dispatch` seam exists in `core/wrapped-sdk-host.js` (`dispatchInterceptedFetch`), gate-able
  per [ADR-0010](../../decisions/adr-0010-roundtrip-egress-capability.md).
- ✅ [013-03](../013-mvp3-live-alloy-reprobe/slice-03-config-integrity.md) DONE — the control
  (`checkConfigIntegrity` fail-closed + pollution-aware) is proven, and the threat is confirmed live.
  This slice **wires + hardens** it (adds the **host** check + the **injected** tenant key).
- ✅ The host pin is available: the orchestrator sets `config.datastreamId` (+ the expected host),
  passed to the chamber via `host.init({ config })` (`rig/alloy-core-host-harness.html`), chamber-immutable.

**Acceptance Criteria:**

1. **Generic control in `core/` (host + INJECTED tenant key).** `rig/config-integrity.js` is relocated
   into `core/` and **generalized**: it verifies the outbound **host** (== the pinned host) **and** a
   **tenant key** whose param name is **injected** (`configId` for alloy) — not a hardcoded `"configId"`
   in `core/` (014-02 vendor-injection precedent). No `core/ → rig/` import (`test/core-boundary.test.js`).
2. **Wired into the dispatch seam.** In `core/wrapped-sdk-host.js`'s `dispatchInterceptedFetch`, **before**
   `caps.egress.dispatch` does the real fetch, the outbound URL is checked against the pin. Observable:
   the check runs on every wrapped-SDK dispatch, at the single chokepoint.
3. **HOLD (fail-closed) on ANY deviation.** A deviation — outbound **host** ≠ pinned host, **or** tenant
   key absent / duplicated (pollution) / ≠ pinned — **holds**: no real fetch is dispatched; the chamber's
   `sendEvent` settles **rejected** (014-01's reject surface). Observable: `evil.com?configId=<honest>`,
   `adobedc.demdex.net?configId=<attacker>`, absent, and `?configId=a&configId=b` **all** produce zero
   egress.
4. **The host pin is orchestrator-owned + threaded in.** The pinned host + tenant are the **host-set**
   `config` values, threaded into the host (a new `createWrappedSdkHost` opt, or captured from the
   `init` message) — **not** read from the chamber's outbound `m.url`. Observable: chamber code cannot
   influence the pin.
5. **ALERT — every deviation surfaced (paired with the hold).** Each held deviation emits a diagnostic
   through the 009-02 `onDiagnostic` sink — `{ kind: "config-integrity", disposition: "held", reason }`
   naming the deviation (host / tenant-mismatch / pollution / absent) **without** the raw identifier
   values (013-01 redaction). Observable: one config-integrity diagnostic per held dispatch; the honest
   path (allow) emits **none**.
6. **E2E: the re-route is neutralized (the seal bites).** In a `test/` +/or `rig/` harness driving the
   core seam: a chamber re-pointed to an attacker tenant on the allowed host → **held** + alerted; a
   chamber egressing to a foreign host → **held** + alerted; the honest host+tenant → **allowed** + silent.
7. **The config-integrity ADR authored + Accepted.** The disposition — **hold-fail-closed default
   (incl. the host); override a named availability option (015-02); GA4 a deliberate deferral (same
   `measurement_id` threat, not immune); the `orgId`/body co-vector an UNVERIFIED, currently-SILENT
   residual (the check surface is the URL only — an honest-`configId`-URL + attacker-`orgId`-body
   request passes unheld and unalerted; 013-03 left `orgId` routing-relevance open)** — is recorded
   ([ADR-0011](../../decisions/adr-0011-config-integrity-enforcement.md); ADR-0006's endpoint ceiling
   is tenant-blind). Authored as this slice's first step, frame-critiqued + accepted.

**DoD:**
- [x] ACs 1–7 pass — a re-pointed / foreign-host core-hosted chamber is **held** + alerted; the honest
      path unchanged + silent; green at the real seam. _(Targeted run: `test/alloy-config-integrity.test.js`
      11/11, `test/wrapped-sdk-host.test.js` 18/18, `test/core-boundary.test.js` 1/1 — 30/30, 498ms, no hang.)_
- [x] **No regression** — 014-01/02's dispatch + coalescing + connector-host + GA4 + contract-stability
      stay green (143/143 across the adjacent neighborhood, run explicitly to avoid the stale-worktree
      shell-out hangers). Full suite left un-run by design (the nested worktree's oracle/conformance tests hang).
- [x] Reviews: compliance + craft + **arch** (a core enforcement seam + a new ADR) recorded pass
      (independent Opus review of the Sonnet implementer's diffs — redaction verified, tests re-run).
- [x] Deviation log + reconciliation sweep; `docs/refinement-todo.md` config-integrity item resolved
      (core-wiring done, fail-closed) + the `orgId`/body probe elevated as the open residual; ADR-0011
      indexed; the GA4-async-reroute deferral tracked.
- [x] **No live identifiers committed** — synthetic datastreams/hosts only (013-03 style
      `11111111`/`99999999`); the diagnostic emits only `reason` (the param *name*, never the value); no ids.

**Anti-horizontal-phasing check:** after this slice, a compromised chamber **cannot** exfiltrate **via
the URL tenant key** (`configId`) to an attacker tenant on the allowed host **nor** to a foreign host
— its deviating egress is **blocked** at the core seam and surfaced. Observable value: the 013-03
URL-`configId` threat, neutralized fail-closed in `core/`. (A body-only `orgId` co-vector is *out of
the URL check surface* — a named, tracked residual per ADR-0011, deliberately not covered here.)

### Deviation log

- **ADR frame-critique reshaped the ADR's claims (no code change).** The adversarial frame-critique on
  ADR-0011 found a load-bearing **false-assurance over-claim**: the headline said HOLD "neutralizes the
  confirmed re-route fail-closed" and the `orgId`/body co-vector "is unaffected" — but the check surface
  is the **URL** and `orgId` rides in the **body** (013-03 left its routing-relevance open). Applied
  honest URL-surface re-scoping across ADR-0011 + spec.md + this slice (AC7 + anti-phasing) +
  refinement-todo; the control's **design/code is unchanged** (host + URL-tenant-key, fail-closed).
- **Implementer deviations (all non-behavioral).** Factored a local `makeSpyingHost` helper in the
  wrapped-sdk-host test (DRY); added the 4 new control-unit cases as a second `describe` block (keeps
  013-03's block untouched); derived `pinnedHost` as `new URL(EDGE).host` in the live rig (same value).
- **Known residual (accepted, deferred to 015-02's surface).** `pinnedDispatchUrl` preserves the URL
  scheme when re-deriving the host — negligible (the host check already confines the destination), and
  it is not wired into the seam until 015-02.

### Reconciliation sweep

- **ADR-0011** authored → frame-critiqued (needs-changes → applied → pass) → **Accepted** → indexed.
- **Reviews recorded (4):** frame-critique, compliance, craft, arch — all pass
  (`reviews/slice-01-*.md`).
- **`docs/refinement-todo.md`:** the config-integrity requirement's "wire the seam check into core/"
  follow-up struck as **resolved** by this slice; the `orgId`/body **routing-relevance probe** elevated
  as the explicit open residual (with the live-probe recipe); GA4 async-reroute deferral still tracked.
- **`rig/config-integrity.js` deleted** (relocated → `core/config-integrity.js`); its two importers
  (`test/alloy-config-integrity.test.js`, `rig/alloy-live-reroute.mjs`) repointed. The 013-03 DONE
  slice's evidence-link to the old path is now **historical** (a DONE record of where the control lived
  then) — deliberately not rewritten.
- **Release plan** (`docs/releases/mvp3.md`): the config-integrity Cutline "Include" row is now
  **in delivery** (015-01 landed the URL-surface enforcement; the body-`orgId` half is the tracked
  residual) — reflected in the sweep commit.
- **No inbox items;** both residuals (body-`orgId`, GA4 async re-route) are named in ADR-0011 +
  refinement-todo, not dropped.
