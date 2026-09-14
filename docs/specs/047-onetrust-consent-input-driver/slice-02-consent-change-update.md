---
status: RECONCILED
dependencies: [047-01, 045-01]
last_verified: 2026-09-13
frame_review: true
arch_review: false
claimed_by: claude/onetrust-consent-input-driver-ed1217
---

<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about runnable
     surfaces by probe first (run it / read source) or a citation, else mark them
     as assumptions in the spec's `## Assumptions` section — never assert an
     unverified claim as fact. -->

## Slice 047-02 — OneTrust consent-change → `handle.setConsent` (accept-flow flush)

> **Grounded 2026-09-13 (mechanism).** `handle.setConsent(v)` (017-03 AC2, `adapters/eds/index.js:456`) + the 045
> `holdOnDenied` hold/flush on the grant edge (044-02 / 046-03) — the update sink and flush behavior this slice drives — plus
> the OneTrust change-signal surface: `OneTrust.OnConsentChanged` and `OptanonWrapper` are both `function` on the reference
> site (`rig/onetrust-consent-probe.mjs`, spec §A2). RESIDUAL: that the signal *fires with the updated set on a real banner
> toggle* is unobserved (the probe did not click) — confirmed at implementation with one live toggle.

**Goal:** The OneTrust driver subscribes to OneTrust's consent-change signal (`OneTrust.OnConsentChanged`, and/or the
`OptanonWrapper()` global), re-maps the updated active groups through 047-01's contract, and calls the runtime handle's
`setConsent(vector)` — so a mid-session OneTrust change updates the seal and flushes 045-held ad beacons on the grant edge
(the "OneTrust-accept flow"). Delivers: the **live accept-flow** — the user accepts consent in the OneTrust banner and the
held Google Ads / Floodlight beacons egress.

**DoR:**
- ✅ 047-01 shipped the read + map contract + the driver module this extends.
- ✅ `handle.setConsent(v)` (017-03) + 045 `holdOnDenied` hold/flush (044-02 / 046-03) are built — the update sink + the
  flush behavior this slice drives.
- ✅ **Change-signal surface grounded (2026-09-13, `rig/onetrust-consent-probe.mjs`):** `OneTrust.OnConsentChanged` +
  `OptanonWrapper` are both present as functions (spec §A2) — the subscription seam exists.
- ◻️ (soft, non-blocking) observe one **real** consent toggle at implementation to confirm the signal delivers the updated
  group set (vs requiring a re-read) — the §A2 live-delivery residual.

**Acceptance Criteria:**

1. **Subscribes to OneTrust's consent-change signal.** The driver registers for OneTrust consent changes
   (`OneTrust.OnConsentChanged(cb)`, and/or wraps the `OptanonWrapper()` global) through an **injected subscription seam**
   (unit-testable by invoking the callback with a fixture active-group set). Idempotent + null-safe when OneTrust is absent
   (no throw, no double-subscribe). [rests on §A2]
2. **Re-maps and calls `setConsent` with the update.** On a change event the driver re-runs **047-01's** group→purpose
   mapping (no second mapping implementation) and calls `handle.setConsent(vector)` with the updated
   `Record<ConsentPurpose, …>`.
3. **The grant edge flushes held beacons (the accept-flow).** When a change grants a previously denied / pending ad purpose
   (`ad_storage` et al.), the `setConsent` call flushes the 045-held beacons (buffer → re-map → dispatch), matching
   044-02 / 046-03 — verified by a held-then-flushed assertion, not a new flush codepath.
4. **Revoke stops future egress, never un-sends.** A change that denies a purpose updates the vector so subsequent beacons
   hold / reshape per the seal; already-sent beacons are not recalled (ADR-0007: "already-sent cannot be unsent"). No throw
   on grant→deny→grant churn.
5. **No new seam, no egress in the driver.** The driver still only reads OneTrust and calls the existing `setConsent`; the
   flush / hold side effects remain the seal's (`core/airlock.js`), not the driver's.

**DoD:**
- All ACs met against a fixture change-event; full `npx vitest run` green; a held→granted→flushed integration assertion (the
  accept-flow) passes.
- Compliance + craft passes recorded (**no arch pass** — reuses 01's contract; `arch_review: false`).
- Frame-critique pass recorded (`frame_review: true` — §A2).
- Each new test shown to fail when its feature is removed (red→green); reconciliation walked. If this slice closes spec 047,
  run the close-out (compress the primer's active-spec entry; memory-sync the OneTrust-driver / consent-input pattern).

**Out of scope (explicit):**
- The initial boot read / map (**047-01**).
- New hold / flush machinery (spec 045 reused).
- `functional` / `personalization` purposes; non-EDS host adapters; `__tcfapi` / `gtag` sibling drivers.
- Re-sending or recalling already-egressed beacons.

### Deviation log (after reconciliation)

The five ACs held up; all met, full suite green (1733), TDD red→green mutation-verified (the implementer caught + fixed a weak double-registration test mid-cycle). Compliance + craft **pass** (no arch — `arch_review: false`, 047-01's boundary reused). Deviations + folded findings:

1. **Broader helper signature.** `subscribeOnetrustConsentChanges({ onetrust, win, groupPurposeMap, read, onChange })` — wider than the slice's `{ onetrust, onChange }` sketch: the re-read-on-fire design (never trust the callback's argument shape) needs a host-global handle + 047-01's map to re-run the mapping. A natural extension, idiomatic with 047-01's boot-read seam; craft validated.
2. **Both surfaces subscribed (belt-and-suspenders).** Registers `OneTrust.OnConsentChanged` AND wraps `OptanonWrapper` (both are functions on the reference site, §A2). A single real change therefore calls `setConsent` **twice** — **benign** (both reviewers verified: `core/airlock.js`'s `setConsent` no-ops the second call via its `heldBeacons.length` guard; same re-read vector, buffer already drained → no double-send). Kept as intentional resilience (if one surface doesn't fire, the other does). The both-fire path is **untested** → tracked follow-up (a both-fire idempotency test, or coalesce to one surface when both present).
3. **Accept-flow proven against a stand-in, not end-to-end.** The held→flushed proof is built against a direct `createAirlock({ holdOnDenied, remap })` + `FakeWorker` (mirroring `test/google-ads-seal.test.js`), with the new subscription as the trigger — because GA4's core boot wires `holdOnDenied` for no purpose and no ad connector is booted in 047's scope (ad-connector boot wiring is the deferred 044-01 §A2 concern). A **separate** boot-wiring test uses GA4's own `analytics_storage` pending→granted hold/flush through `bootEdsAnalytics`. So this slice proves the subscription **TRIGGER** against the existing 045 **MECHANISM**; the Goal's "held Google Ads / Floodlight beacons egress" is **synthetic-only** for this slice → tracked for MVP8 (wire `onChange` to the composite consent fan-out `createComposite.setConsent`, and make `onetrust` a `boot(config)` governance field, when ad-connector `holdOnDenied` boot wiring lands).
4. **Adapter wiring.** Extracted `globalWin` (behavior-preserving refactor of the existing boot-read expression); added a guarded subscription block after the handle is built in `bootGa4Core` (`onChange: (v) => handle.setConsent(v)`); new optional `onetrust.onetrust` / `onetrust.win` test seams (subscription only; the boot-time read is byte-identical). A no-`onetrust` boot subscribes to nothing.
5. **Non-blocking reviewer nits tracked in `docs/refinement-todo.md`** (§ Spec 047 follow-ups): (a) the both-fire idempotency test / coalesce (item 2); (b) the composite consent fan-out wiring for the ad-beacon accept-flow (item 3, MVP8); (c) rename the over-claiming `"calls ONLY onChange"` test; (d) strengthen the weak `resolves.toBeTruthy()` back-compat test.

### Reconciliation sweep

| Artifact | Disposition | Rationale |
|----------|-------------|-----------|
| `README.md` | `no-op` | Front door untouched. |
| `docs/specs/README.md` | `updated` at DONE (**pending** at RECONCILED) | Regenerated by `workflow.py status-board` during the **DONE close-out** — the lifecycle step immediately after this RECONCILED transition + commit (047-02 → DONE ⇒ spec 047 → DONE). As of RECONCILED it is **not yet** regenerated (board still shows 047-02 pre-DONE). |
| `docs/product-vision.md` | `no-op` | UC-2 already cited; no behavior/scope drift. |
| `docs/architecture.md` | `updated` | Extended the `drivers/consent/` entry to note the mid-session consent-change subscription → `handle.setConsent` (the accept-flow). No new boundary (`arch_review: false`). |
| Primer: `CLAUDE.md` / `AGENTS.md` / templates | `no-op` | 047 was never in the active-specs primer (only 001) → no compress-on-close entry to trim; the MVP8 sprint-focus prose is a release-owner call, left untouched. |
| `docs/inbox.md` | `no-op` | Nothing to park (implementer confirmed). |
| `docs/refinement-todo.md` | `updated` | Added the four 047-02 reviewer nits under § Spec 047 follow-ups. |
| `docs/memory/**` | `updated` | Spec-close memory-sync: added a `consent-input driver` glossary term (`docs/memory/glossary.md`). |
| `docs/decisions/README.md` / ADR index | `no-op` | No new ADR (reuses ADR-0007 / 0026 / 0023). |
| 047-01 + 047 drafting-phase artifacts | `no-op` (prior scope) | Landed earlier on this branch (047-01 DONE + the ADR/spec/rigs); outside 047-02's implementation scope. |
