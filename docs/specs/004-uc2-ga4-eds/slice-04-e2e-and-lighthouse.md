---
status: RECONCILED
dependencies: [004-03, adr-0004]
last_verified: 2026-08-27
arch_review: true
frame_review: true
claimed_by: claude/airlock-build-continue-f9ad85
---

## Slice 004-04 — end-to-end GA4 + before/after Lighthouse

**Goal:** close the UC-2 loop on the real page — a real interaction delivers an
MP-conformant GA4 beacon end-to-end (capture → cycle → map → egress), the
unload-critical outbound-link / closing-pageview beacon takes the ADR-0004
`pushCritical` fast path, and a **real before/after Lighthouse** on the testbed page
shows ~zero CWV cost. This is the UC-2 punchline (the before/after scoreboard,
product-vision § Use cases). It also closes the **OQ12 deadline**: pin `pushCritical`
+ the push-XOR-pushCritical rule into `contracts/push-api.md`, since this slice is
where the real `pushCritical` callers land.

## Assumptions

- **AC1 (worker cycle) and AC2 (unload fast path) need SEPARATE testbed elements —
  the single existing element cannot demonstrate both** (frame-critique 004-04, the
  load-bearing fix). The testbed's only interactive element is the navigating
  `<a href="/signup">` CTA; a navigating click cannot complete the worker round-trip
  before teardown (ADR-0004's founding premise), so its beacon is delivered by the
  synchronous ring-tail flush, **not** the worker cycle. If AC1 drove that click its
  oracle ("a beacon reaches collect") would false-green on ring-tail delivery. So
  this slice **adds a non-navigating interactive element** to the testbed (e.g. a
  `<button>` in the shared second section) for AC1's worker-cycle demo, keeps
  `/signup` for AC2's fast path, gives the two **distinct `event` names** (so the
  push-XOR-`pushCritical` rule is not tripped — ADR-0004), and AC1's oracle asserts
  **worker-path delivery: the beacon arrives while the page is still alive** (before
  any navigation/unload), which the ring-tail flush cannot satisfy.
- **LCP delta is ~0 by CONSTRUCTION, so TBT is the runtime-attributable number.** The
  runtime boots in the lazy phase after `body:appear` (post-LCP, verified 004-02), so
  it cannot move LCP; the only load-CWV signal it can affect is TBT (and CLS, which
  the spike measured 0). [The spike's ~0 prediction is a hypothesis under test; AC4
  requires characterizing any non-~0 delta, not hiding it.]
- **Lighthouse noise does NOT cancel in a single before/after pair** — independent
  run-to-run variances add, they don't subtract (frame-critique 004-04). So AC3 runs
  **repeated iterations per arm and reports medians + spread**, not a single run; a
  static serve 404s the pipeline nav/footer (present in both arms) so **absolute**
  scores are an `aem up` claim, not a static-serve one — the load-bearing output is
  the **median delta with its spread**, human-read (jig-supervised).
- **The runtime-off/on toggle lives in the RIG, not production code.** No test-only
  flag ships in `scripts.js`/the adapter; the rig serves a **no-op module** for the
  boot entry on the "off" arm (server-controlled), so the control is a real
  no-airlock page whose load graph differs only by the (lazy, post-LCP) boot.
- **The closing `page_view` must map against the LIVE projection snapshot, not the
  stale boot ctx** (ADR-0004 designates this slice for threading the live snapshot
  into the fast path). The unload-critical beacon carries current page state
  (`page_location`), not just the boot-time identity. [Consent-free on the testbed;
  the consent-gated variant stays OQ13.]
- **The `push-api.md` amendment (AC5) is additive, not breaking.** ADR-0004 already
  pins the `pushCritical` mechanism; this records its caller-facing shape + the XOR
  rule + the `getState()` live-reference note in the contract doc. [Additive per the
  004-02 arch review; the arch-review pass blesses the amendment this slice.]

**DoR:**
- ✅ 004-03 done (real cookie-sourced ctx → conformant payload).

**Acceptance Criteria:**

1. **End-to-end WORKER-CYCLE delivery (non-navigating).** A real click on the
   testbed's non-navigating interactive element (added by this slice) pushes a
   steady-state GA4 event that flows capture → ring → idle-drain → worker → map →
   orchestrator dispatch, and the MP-conformant beacon **reaches collect while the
   page is still alive** (asserted before any navigation/unload — this is what proves
   the worker cycle, not a ring-tail flush). Distinct `event` name from AC2.
2. **Unload-critical fast path wired (ADR-0004).** The outbound-link click
   (`/signup`) and the closing `page_view` are dispatched via `pushCritical` — the
   `adapters/eds/` outbound-link delegation + `pagehide` hook the ADR calls for —
   delivered within a teardown window (reuse `rig/teardown.mjs`'s method on the real
   page). The closing beacon carries the **current `page_location`** (caller-read at
   unload time, not the boot-time value). The adapter owns both AC1's push and this
   `pushCritical` so the push-XOR-`pushCritical` rule holds (distinct events, single
   sender each). **Scope honesty (frame-critique 004-04):** the fuller "live
   projection snapshot" threading (`consent_state` and folded state, ADR-0004) is
   **not observably testable on the consent-free testbed** — a stale-ctx impl would
   emit a byte-identical beacon here — so AC2 verifies only current `page_location`;
   the live-snapshot property is **carried-forward-unverified** per ADR-0004/OQ13, and
   a green AC2 must not be read as verifying it.
3. **Before/after Lighthouse (repeated, median+spread).** A real Lighthouse rig on
   the testbed page runs **≥5 iterations per arm** (`LH_N`, default 5), runtime
   **off** vs **on** (bundled + lazy), and reports the **median** performance score +
   CWV (LCP/TBT/CLS) per arm with spread (min/max), plus the median deltas. TBT is the
   runtime-attributable number (LCP ~0 by construction — post-LCP boot). Acceptance
   band: median **TBT delta ≤ 50 ms and CLS delta ≤ 0.01** counts as "~0" (within
   run-to-run noise); a larger delta is characterized under AC4, not hidden.
4. **Honest scoreboard.** The medians, spread, deltas, and run conditions (static
   serve, formFactor, iteration count) are recorded; any non-~0 delta is
   characterized (not hidden) — jig-supervised, human-read.
5. **OQ12 contract pinning (deadline).** `contracts/push-api.md` gains a
   `pushCritical` row (its `{ event, ...params }` shape, synchronous, fire-and-forget,
   bypasses log/projection), the **push-XOR-`pushCritical`** caller rule (ADR-0004
   silent-double-count), and a one-line `getState()` live-projection-reference note.
   OQ12 items 1–3 resolved; the remaining OQ12 items (dispose guard, `workFactor`
   prune) stay parked per their triggers.

**DoD:**
- [x] ACs 1–5 pass; the end-to-end flow (`npm run rig:e2e`) and the Lighthouse run
      (`LH_N=5 npm run lh:eds`) are reproducible. 72/72 vitest; build + rig:bundle +
      rig:csp green.
- [x] `ga4_mp_conformance` green for the UC-2 event (hermetic — `test/uc2-conformance.test.js`:
      `cta_engage` + cookie-sourced closing `page_view` schema-valid; page_view golden match).
- [x] Reviewed by `reviewer` subagent; implementation review passed.
      (Frame-critique FAIL→revise→PASS pre-implementation; compliance PASS; craft PASS;
      arch PASS. Evidence in `reviews/slice-04-*.md`.)
- [x] Deviation log + reconciliation sweep (below); spec 004 Findings + Outcome filled;
      mvp1 release plan's UC-2 row updated to reflect the demo landing.

**Anti-horizontal-phasing check:** after this slice, UC-2 is a believable demo on a
real EDS page — a captured interaction becomes an MP-conformant GA4 beacon at ~zero
CWV cost, with the last beacon rescued — exactly the "demo a skeptical EDS
practitioner believes" the release appetite asks for.

### Deviation log

1. **Frame-critique FAIL → revise → PASS (the load-bearing fix).** Round 1 FAILED: the
   testbed had ONE interactive element (the navigating `/signup` CTA), so AC1's worker
   cycle and AC2's fast path were the same click — a navigating click's beacon is
   delivered by the ring-tail flush, not the worker cycle AC1 claimed, so AC1 would
   false-green. Fixed the frame BEFORE implementing: added a **non-navigating** element
   (`#cta-engage`) for AC1, kept `/signup` for AC2, distinct event names
   (`cta_engage`/`outbound_click`/`page_view`), and AC1's oracle now asserts
   **while-alive** delivery (sound because `unloadFlush` fires ONLY on
   visibilitychange/pagehide). Also fixed two method flaws (LH noise doesn't cancel in a
   single pair → N iterations + median/spread; LCP ~0 by construction → TBT is the
   signal) and owned ADR-0004's live-projection obligation (with a scope-honesty caveat).
2. **`cta_engage` proven via the NATURAL idle-drain** (no `flushNow` intervention) — a
   stronger, intervention-free worker-path proof than bundle-smoke's forced flush.
3. **New `rig/e2e.mjs`** (not an extension of bundle-smoke) — the task permitted either;
   keeps bundle-smoke's boot/cycle smoke focused. **New `rig/lh-eds.mjs`** for the
   before/after Lighthouse (rig/lh.mjs targets the synthetic harness).
4. **AC2 live-projection-snapshot is carried-forward-unverified** (frame-critique note):
   `page_location` is caller-current, and `consent_state`/folded state are absent on the
   consent-free testbed, so a stale-ctx impl would emit a byte-identical beacon — AC2
   verifies only current `page_location`; the fuller live-snapshot property stays OQ13.
5. **Review nits folded at reconciliation:**
   - **`navigatesAway`/`opensElsewhere` hardened** (craft): non-http(s) schemes
     (mailto:/tel:/javascript:), modified clicks (cmd/ctrl/shift/alt), `target=_blank`,
     `download`, and `defaultPrevented` clicks no longer emit a spurious `outbound_click`
     or pay a synchronous main-thread map on a real site. New unit test, mutation-verified.
   - **Necessitated a faithful `rig/e2e.mjs` fix:** the rig had suppressed the `/signup`
     navigation via an anchor listener that ran BEFORE the adapter (setting
     `defaultPrevented`), which the new guard correctly skips. Moved the suppression to a
     `document` listener registered AFTER boot, so the adapter sees an **un-prevented**
     click — modelling a real outbound navigation, a strengthening of the rig, not a
     workaround.
   - **Vestigial `unloadCritical: ["click","page_view"]` default dropped** (craft+arch):
     `cta_engage` is the only ring event and the pushCritical events bypass the ring, so
     the ring-tail sort had nothing to order.
   - **`workFactor` knob pruned** from the adapter (arch / OQ12): a synthetic test knob;
     the rigs that need it call `createAirlock` directly. `workFactor: 0` passed explicitly.
   - **Stale endpoint comment fixed**; **keepalive-budget note added** to push-api.md.
6. **Tooling slip, recovered (honest record):** a `git checkout -- adapters/eds/index.js`
   used as a mutation-test cleanup reverted the adapter to its 004-03 committed baseline
   (its 004-04 work was uncommitted). Recovered by reconstructing the full 004-04 adapter
   from the review-read content + the folded edits; re-verified 72/72 + all rigs green +
   `git status` shows no unintended reverts. No lost work.
7. **`lh:eds` ON arm may issue a closing `pushCritical` `page_view` to the placeholder
   collect endpoint at teardown** (post-trace) — noted in the rig output; does not affect
   the measured medians. No live GA4 endpoint wired (DEFAULT_ENDPOINTS placeholder kept).

### Reconciliation sweep

| Artifact | Disposition | Rationale |
|----------|-------------|-----------|
| `docs/specs/004-uc2-ga4-eds/spec.md` | `updated` | Findings + Outcome filled (spec 004 closes with this slice). |
| `docs/releases/mvp1.md` | `updated` | UC-2 row updated to "demo landed" with the before/after numbers. |
| `contracts/push-api.md` | `updated` | AC5 / OQ12: additive `pushCritical` subsection + XOR rule + getState-by-reference + keepalive-budget notes; no schema change (validate.mjs green). |
| `docs/refinement-todo.md` | `updated` | OQ12 items 1–3 + `workFactor` marked RESOLVED (004-04); item 4 (dispose guard) kept open with trigger. |
| `package.json` | `updated` | Added `rig:e2e` + `lh:eds` scripts (deviation item 3). |
| `probes/eds-testbed/index.html` | `updated` | Added the non-navigating `#cta-engage` button for AC1's worker-cycle demo (deviation item 1). |
| `docs/architecture.md` | `no-op` | Module boundaries honored (pushCritical wiring in adapters/eds per ADR-0004; core/ untouched); push-api.md implemented+amended, not re-architected. |
| `docs/product-vision.md` | `no-op` | The UC-2 punchline (before/after scoreboard) is realized as the vision describes; no scope drift. |
| Primer surfaces (`CLAUDE.md`) | `no-op` | Spec 004 is not in the CLAUDE.md Active-specs list; nothing to compress there. Status board reflects closure. |
| `docs/decisions/lightweight-decisions.md` | `no-op` | No new settled non-spec decision beyond what the slice + push-api.md carry. |
| `docs/inbox.md` | `no-op` | Nothing parked resolved by this slice. |
| `docs/memory/**` | `no-op` | No new domain term; the GA4/CSP/egress knowledge lives in the specs + ADRs. |
| ADR index | `no-op` | No new ADR — the amendment records ADR-0004's already-decided mechanism; no new load-bearing choice. |
