---
status: DONE
dependencies: [048-01, 048-02, 047-02, 045-03]
last_verified: 2026-09-14
frame_review: true
arch_review: true
---

<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about runnable
     surfaces by probe first (run it / read source) or a citation, else mark them
     as assumptions in the spec's `## Assumptions` — never assert an unverified claim as fact. -->

## Slice 048-03 — `onetrust` as a `boot(config)` governance field → composite consent fan-out (end-to-end accept-flow)

**Goal:** Promote `onetrust` to a top-level `boot(config)` governance field wired to the **composite** consent fan-out, so a
single `boot({ connectors:[…google-ads, floodlight…], onetrust:{ groupPurposeMap } })` both (a) derives the boot-time
consent vector from OneTrust's resolved surface and (b) subscribes OneTrust's consent-CHANGE signal to
`composite.setConsent` — so a mid-session OneTrust **accept flushes held Google Ads AND Floodlight beacons end-to-end
through the real composite**. This is MVP8's capstone: it turns 047-02's "held ad beacons egress on accept" from
**proven-synthetic-only** (against a stand-in `createAirlock`) into a real end-to-end proof, resolving the primary
**047-02 follow-up** — the held-ad-beacon accept-flow (`docs/refinement-todo.md` § Spec 047). (NOT OQ13-1 — that is the
unrelated alloy `demdex`/`ad_storage` cookie-write residual, which stays open; an earlier draft mis-cited it, corrected
2026-09-14.)

**Why `arch_review: true`.** This adds `onetrust` to the `boot(config)` **governance surface** — today the governance
bundle is exactly `{consent, consentStrict, payloadDenylist}` (`adapters/eds/index.js`, read 2026-09-14). Promoting a CMP
driver to a first-class config field (vs the per-connector `bootGa4Core` `opts.onetrust` seam 047-02 shipped) is a public
config-contract change with a precedence question (composite-level vs a connector's own `onetrust`) the arch pass ratifies.

**DoR:**
- ✅ Both ad connectors are boot- + composite-reachable (048-01, 048-02) — the composite has real ad members to fan consent to.
- ✅ The OneTrust driver is DONE: `resolveOnetrustBootConsent` (boot-time vector) + `subscribeOnetrustConsentChanges`
  (change signal, idempotent + null-safe) — spec 047; the per-connector wiring in `bootGa4Core` (047-02) is the seam to
  lift to the composite.
- ✅ The composite `setConsent` **already fans out to every member handle** (`createComposite.setConsent`,
  `adapters/eds/index.js` — verified 2026-09-14: it calls each `c.handle.setConsent(v)`), so wiring `onChange →
  composite.setConsent` reaches all connectors with no new fan-out code.
- ✅ The N-beacon fan-out re-map (`remapKey`, 045-03) is DONE — the flush re-maps each held ad beacon correctly.

**Acceptance Criteria:**

1. **`onetrust` is a top-level `config` field (a declarative governance input).** `boot(config)` accepts
   `config.onetrust = { groupPurposeMap, activeGroups?, onetrust?, win? }` (alongside `connectors`/`consent`/`consentStrict`/
   `payloadDenylist` — NOT on the `opts` second arg); when present it derives the boot-time consent vector via
   `resolveOnetrustBootConsent` (with `win` defaulting to `globalWin` exactly as `bootGa4Core` does) and threads THAT derived
   vector as the composite's shared `governance.consent` (so every connector — ad + analytics — boots under the
   OneTrust-derived vector). Absent `config.onetrust` is byte-unchanged (governance stays `{consent, consentStrict,
   payloadDenylist}`).
2. **The consent-CHANGE subscription is wired ONCE at the composite — precedence TRUE BY CONSTRUCTION, not via the driver
   guard.** After `createComposite(booted)`, `boot(config)` calls `subscribeOnetrustConsentChanges({ onetrust, win,
   groupPurposeMap, onChange: (v) => composite.setConsent(v) })`, fanning a change to ALL members via
   `createComposite.setConsent`. **The composite must be the SOLE OneTrust subscriber, guaranteed structurally:** `boot(config)`
   does NOT thread `config.onetrust` to any sub-boot (sub-boots receive only the derived `governance.consent` vector), AND it
   **strips any per-connector `onetrust`** from a connector entry before dispatching to the sub-boot — so no sub-boot ever
   calls `subscribeOnetrustConsentChanges`. **[Frame-critique 2026-09-14: the DRAFT's A-precedence — "composite wins via the
   driver's idempotency guard" — was WRONG. The guard is first-writer-wins keyed on object identity, and `boot(config)`
   constructs sub-boots BEFORE the composite exists, so a per-connector `onetrust` (reachable today via `...rest` into e.g.
   `bootGa4Core`) would register FIRST and the composite subscription would silently no-op — stranding the Google Ads +
   Floodlight held beacons, the exact failure this capstone prevents. The guard CANNOT express precedence; fixed by
   construction (don't-thread + strip) instead.]** Tested (AC-precedence): a config with BOTH a `config.onetrust` AND a
   per-connector `onetrust` on a ga4 entry → ONLY the composite subscribes → a mid-session accept flushes the ad beacons
   (NOT stranded); a mutation removing the strip/don't-thread re-strands them (red).
3. **END-TO-END accept-flow across BOTH ad connectors (the capstone).** `boot({ connectors:[{type:"google-ads",…},
   {type:"floodlight",…}], onetrust:{ groupPurposeMap } })` with OneTrust **denied at boot** HOLDS a beacon from **each** ad
   connector (zero `fetch`); a fixture OneTrust **accept** (the resolved surface flips to granted + a fired change signal) →
   `composite.setConsent(granted)` → **both** the Google Ads and Floodlight held beacons re-map + flush (their `fetch`
   fires, once each). Proven through the REAL composite with both connectors booted — the exact gap 047-02's review flagged
   as "proven synthetic-only." A later revoke holds NEW beacons but never un-sends the flushed ones (ADR-0007, mirrors
   047-02 AC4).
4. **Both-fire idempotency, end-to-end + a recorded coalesce decision.** Because the driver registers BOTH grounded
   surfaces (`OnConsentChanged` + `OptanonWrapper`, §A2), one real change drives `composite.setConsent` twice → 2×N member
   `setConsent` calls. Assert this stays benign end-to-end: **each** connector's held beacon flushes **exactly once** (the
   `core/airlock.js` `heldBeacons.length` guard drains on the first call, per the 047 both-fire pins). Record the decision
   in `docs/decisions/lightweight-decisions.md` — today's double-fire is **pinned-benign, not coalesced** — or, if the
   composite fan-out makes the 2×N call count worth collapsing, coalesce at the subscription and note why.
5. **Back-compat + inspector-observable.** A `boot(config)` with no `onetrust` field subscribes to nothing (no throw); the
   per-connector `bootGa4Core` `opts.onetrust` path (047-02) is unchanged for direct callers; `opts.onDiagnostic` still
   fans to every connector's seam (spec 028) so the held→flushed chain across both ad connectors is inspector-queryable.

**DoD:**
- [ ] All ACs pass; full test suite green (no regressions).
- [ ] Implementer test coverage exercises each AC; the two-connector held→accept→both-flush path and the both-fire
      flush-once-per-connector edge are explicit.
- [ ] Each new test shown to fail when its feature is removed (mutate → red → restore) — especially the "both connectors
      flush" and "flush exactly once under both-fire" assertions (a per-connector mutation must turn them red).
- [ ] Reviewed by `reviewer` subagent (compliance) + craft pass + arch pass (`arch_review: true`) + frame-critique
      (`frame_review: true`).
- [ ] Deviation log + reconciliation sweep produced under this slice heading.
- [x] Reconciliation review passed; the 047-02 primary follow-up struck through in `docs/refinement-todo.md` (OQ13-1 is
      UNRELATED — alloy cookie-write — and stays open); the coalesce decision recorded (AC4).
- [ ] If `onetrust`-as-governance-field is ratified as load-bearing with rejected alternatives (per-connector vs composite),
      an ADR is written at reconciliation (arch-pass call).

## Assumptions

- **A-fanout (grounded) — `composite.setConsent` reaches every member.** Verified 2026-09-14 that
  `createComposite.setConsent` iterates members and calls each `c.handle.setConsent(v)`; wiring `onChange` to it needs no new
  fan-out code. (Stated here because AC2/AC3 lean on it.)
- **A-precedence — REVISED by the frame-critique (2026-09-14): composite-is-sole-subscriber TRUE BY CONSTRUCTION, not via
  the driver guard.** The DRAFT assumed the driver's idempotency guard (047-02) would make "composite wins / per-connector
  ignored." That is FALSE: the guard is first-writer-wins keyed on object identity, and `boot(config)` constructs sub-boots
  BEFORE `createComposite`, so a per-connector `onetrust` (reachable via `...rest` into a sub-boot like `bootGa4Core`) would
  register FIRST and the later composite subscription would no-op — stranding the ad beacons. The guard cannot express
  precedence. **Resolved (AC2):** `boot(config)` (a) does NOT thread `config.onetrust` to any sub-boot — only the derived
  `governance.consent` vector — and (b) STRIPS any per-connector `onetrust` from a connector entry before dispatch, so the
  composite is structurally the sole subscriber. Tested with a mixed config (composite + per-connector onetrust) + a
  strip-removal mutation.
- **A-coalesce — the both-fire double is benign at composite scale.** Assumed each member connector's `heldBeacons.length`
  guard makes the 2×N `setConsent` calls flush-once-per-connector (as the 047 both-fire pins show for one connector);
  validated end-to-end here before the coalesce decision (AC4) is recorded.

### Deviation log (after reconciliation)

Original ACs preserved above; deviations append here (2026-09-14). The capstone shipped green after a frame-critique
re-scope + one review fix round.

- **Frame-critique re-scope of A-precedence (biggest).** The DRAFT rested precedence on the driver's idempotency guard
  ("composite wins when both present"). WRONG: the guard is first-writer-wins keyed on object identity, and `boot(config)`
  builds sub-boots BEFORE `createComposite` — so a per-connector `onetrust` (reachable via `...rest` into e.g. `bootGa4Core`)
  registers FIRST and the composite subscription silently no-ops, STRANDING the ad beacons. Re-scoped (pre-implementation) to
  **sole-subscriber-by-construction**: strip per-connector `onetrust` at `bootConnector`'s destructure + never thread
  `config.onetrust` to a sub-boot + one subscription after `createComposite`. Re-run frame-critique passed. **Recorded as
  [ADR-0027](../../decisions/adr-0027-onetrust-composite-governance-field.md)** (arch-pass recommendation — a new public
  config-contract surface with a rejected alternative).
- **OQ13-1 grounding correction (my spec error, caught by the implementer).** The DRAFT (spec Overview + this Goal) claimed
  048-03 "resolves the coarse-consent OQ13-1 accept-flow residual." FALSE against refinement-todo's own OQ13-1 definition:
  OQ13-1 is the UNRELATED alloy `demdex`/`ad_storage` cookie-WRITE residual (spec 034-01) — 048-03 touches no alloy code.
  Corrected across `spec.md` + this slice; **OQ13-1 stays OPEN**. The genuinely-resolved **047-02 primary follow-up**
  (held-ad-beacon accept-flow, proven synthetic-only) IS struck CLOSED in `refinement-todo.md`.
- **Schema [blocker] (arch) → fixed (fix round).** The pinned `instrumentation-config.schema.json` (`additionalProperties:
  false`) didn't enumerate top-level `onetrust`, so it rejected a `config.onetrust` the runtime accepts — the 048-01
  schema-lags-runtime blocker class. Fixed: `$defs/onetrustConfig` + top-level `onetrust` property + a top-level
  governance-field drift cross-check + a `validateConfig` `onetrust` shape-check.
- **Review nits fixed (fix round):** AC3 URL assertions now discriminate on distinct `tid=AW-…`/`tid=DC-…` (the two
  `ccm/collect` endpoint constants are the same string); `validateConfig` shape-checks `onetrust`; the consent+onetrust
  both-present precedence is now tested (onetrust wins) + doc-commented; AC1-test1's google-ads half is commented as
  corroborative (the ga4 `ctx.consent` assertion + AC2/AC3 are load-bearing).
- **Coalesce decision (AC4):** recorded in `docs/decisions/lightweight-decisions.md` — the both-fire double stays
  **pinned-benign, not coalesced** (2×N `setConsent`, each connector's `heldBeacons.length` guard drains on the first),
  re-validated at composite scale (both connectors held, both surfaces fire).

### Reconciliation sweep

- `docs/architecture.md` — **updated**: the `drivers/consent/onetrust.js` description now notes the 048-03/ADR-0027
  promotion to a `boot(config)` composite governance field (sole-subscriber-by-construction).
- `docs/decisions/adr-0027-onetrust-composite-governance-field.md` — **NEW** (Accepted); `docs/decisions/README.md` index regenerated (clean).
- `contracts/instrumentation-config.schema.json` — **updated**: `onetrust` `$def` + top-level property (fix round).
- `docs/decisions/lightweight-decisions.md` — **updated**: the both-fire coalesce decision (pinned-benign).
- `docs/refinement-todo.md` — **updated**: 047-02 primary follow-up struck CLOSED; OQ13-1 grounding-correction note (stays open); re-boot-unsubscribe + one-sided-cross-check residuals logged.
- `docs/specs/048-.../spec.md` + `slice-03` — **updated**: OQ13-1 mis-citation corrected.
- `docs/specs/README.md` (status board) — **updated**: regenerated on transition (+ at DONE).
- `CLAUDE.md` primer close-out — **deferred**: 048-03 CLOSES spec 048 (all three slices DONE), so the spec-025 compress-on-close-out applies — but the hot cache's "Current Sprint Focus: MVP7" is broadly stale (MVP8's connectors + this end-to-end are done) and a primer/hot-cache refresh needs human approval + a `/jig:memory-sync` pass (flagged in the session's orient); deferred to that, not edited unilaterally here.
- `docs/inbox.md` — **no-op**.
- Memory-sync — the load-bearing learning (precedence-by-construction; the driver guard can't express precedence) is captured in ADR-0027 + `architecture.md` + this log.

### Named residuals (carried forward)

- **Re-boot unsubscribe** — ~~the OneTrust driver has no unsubscribe primitive, so a re-`boot()` leaves the prior composite's
  subscription installed~~ **RESOLVED 2026-09-14 ([ADR-0028](../../decisions/adr-0028-onetrust-unsubscribe-reboot-safety.md)):**
  `subscribeOnetrustConsentChanges` now returns an idempotent, re-boot-safe (compare-and-clear) `unsubscribe()`, folded into
  `dispose()` — a re-`boot()` no longer strands the live composite's held beacons.
- **One-sided governance-field cross-check** — ~~the new drift guard compares the schema against a hand-maintained
  `BOOT_CONFIG_TOP_LEVEL_FIELDS` list (not the runtime's own enumeration)~~ **RESOLVED 2026-09-14:** the runtime now owns
  `BOOT_CONFIG_TOP_LEVEL_FIELDS` and `validateConfig` rejects unknown top-level keys, surfacing the set in its error; the
  cross-check reads that back off the error text and asserts set-equality with the schema — genuinely two-sided.
- **`$defs/onetrustConfig` excludes the `win`/`onetrust` DI seams** — by design (non-serializable, test-only injection seams
  absent from any real JSON config), keeping the pinned schema an accurate model of the production declarative contract.
