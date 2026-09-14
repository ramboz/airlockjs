---
status: DRAFT
dependencies: [048-01, 048-02, 047-02, 045-03]
last_verified:
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
**proven-synthetic-only** (against a stand-in `createAirlock`) into a real end-to-end proof, and resolves the coarse-consent
**OQ13-1** accept-flow residual (`docs/refinement-todo.md`).

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

1. **`onetrust` is a `boot(config)` governance field.** `boot(config, opts)` accepts an `onetrust: { groupPurposeMap,
   activeGroups?, onetrust?, win? }` field; when present it derives the boot-time consent vector via
   `resolveOnetrustBootConsent` and threads THAT as the composite's shared `consent` (so every connector — ad + analytics —
   boots under the OneTrust-derived vector). Absent `onetrust` is byte-unchanged (governance stays `{consent, consentStrict,
   payloadDenylist}`).
2. **The consent-CHANGE subscription drives the COMPOSITE fan-out, not a single connector.** `boot(config)` calls
   `subscribeOnetrustConsentChanges({ onetrust, win, groupPurposeMap, onChange: (v) => composite.setConsent(v) })` — so a
   change fans out to ALL members via the existing `createComposite.setConsent`. It is wired **once** at the composite and
   is NOT also threaded to each sub-boot's `opts.onetrust` (no double-subscription); precedence when a connector *also*
   carries its own `onetrust` is documented + tested (see `## Assumptions` A-precedence).
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
- [ ] Reconciliation review passed; the OQ13-1 residual + the 047-02 primary follow-up struck through in
      `docs/refinement-todo.md`; the coalesce decision recorded (AC4).
- [ ] If `onetrust`-as-governance-field is ratified as load-bearing with rejected alternatives (per-connector vs composite),
      an ADR is written at reconciliation (arch-pass call).

## Assumptions

- **A-fanout (grounded) — `composite.setConsent` reaches every member.** Verified 2026-09-14 that
  `createComposite.setConsent` iterates members and calls each `c.handle.setConsent(v)`; wiring `onChange` to it needs no new
  fan-out code. (Stated here because AC2/AC3 lean on it.)
- **A-precedence — one OneTrust subscription, at the composite.** Assumed the composite-level `onetrust` subscribes ONCE
  (`onChange → composite.setConsent`) and is NOT also passed to each sub-boot's `opts.onetrust`; the driver's own
  idempotency guard (047-02 — no double-register on the same `onetrust`/`win`) is the backstop if a connector *also* carries
  one. The precedence rule (composite-level wins / per-connector ignored when both present) is decided + tested in this
  slice, not assumed silently.
- **A-coalesce — the both-fire double is benign at composite scale.** Assumed each member connector's `heldBeacons.length`
  guard makes the 2×N `setConsent` calls flush-once-per-connector (as the 047 both-fire pins show for one connector);
  validated end-to-end here before the coalesce decision (AC4) is recorded.
