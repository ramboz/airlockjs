---
status: DRAFT
dependencies: []
last_verified:
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
- [ ] ACs 1–7 pass — a re-pointed / foreign-host core-hosted chamber is **held** + alerted; the honest
      path unchanged + silent; green against the stub. _(Do NOT run the full suite unguarded — the stale
      nested worktree's oracle test hangs it; run targeted files or exclude that path.)_
- [ ] **No regression** — 014-01/02's dispatch + coalescing stay green; GA4 untouched; full suite green.
- [ ] Reviews: compliance + craft + **arch** (a core enforcement seam + a new ADR) + reconciliation,
      recorded pass.
- [ ] Deviation log + reconciliation sweep; `docs/refinement-todo.md` config-integrity item resolved
      (enforced, fail-closed); the config-integrity ADR indexed; the GA4-async-reroute deferral tracked.
- [ ] **No live identifiers committed** — synthetic datastreams/hosts only (013-03); the diagnostic
      redacts identifier values; the stub path commits no ids.

**Anti-horizontal-phasing check:** after this slice, a compromised chamber **cannot** exfiltrate **via
the URL tenant key** (`configId`) to an attacker tenant on the allowed host **nor** to a foreign host
— its deviating egress is **blocked** at the core seam and surfaced. Observable value: the 013-03
URL-`configId` threat, neutralized fail-closed in `core/`. (A body-only `orgId` co-vector is *out of
the URL check surface* — a named, tracked residual per ADR-0011, deliberately not covered here.)
