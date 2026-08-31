---
status: DRAFT
dependencies: [017-01]
last_verified:
frame_review: true
---

<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about
     runnable surfaces by probe first (run it / read source) or a citation. -->

## Slice 017-02 — storage consent deny (cookie capability + ephemeral id)

**Goal:** Enforce ADR-0007 point ② — a denied **storage** purpose (`analytics_storage` / `ad_storage`) is a
genuine **deny of the persistent write**: don't write `_ga` / identity. But because MP **requires**
`client_id` (`contracts/ga4-mp-request.schema.json`), a storage denial touches **two** places — the cookie
write (**deny**) **and** identity sourcing (mint an **ephemeral, non-persisted** `client_id` so the beacon
still conforms). Resolves **OQ13 item 1** (consent-gating the `_ga` write). Reuses 017-01's consent vector +
resolver.

**DoR:**
- ⏳ **[017-01] must land first** — the consent vector state + `resolveConsent(purpose)` + the host-callback
  seam (this slice reads `resolveConsent("analytics_storage")`). Sequencing dependency.
- ✅ Host-side GA4 identity sourcing exists (spec 004-03): `_ga` parse + GA1-format generate+persist +
  per-page session fallback, on the main thread (`adapters/eds/` + `connectors/ga4/cookies.js`) — the write
  this slice gates.

**Acceptance Criteria:**

1. **The persistent identity write is gated on `analytics_storage`.** When `resolveConsent("analytics_storage")
   !== "granted"`, the host does **not** persist `_ga` / the identity cookie (the write is denied at the
   cookie capability — where the write lives, `adapters/eds/`, not the chamber). Observable: denied
   `analytics_storage` → `document.cookie` gains no persistent `_ga`.
2. **Ephemeral, non-persisted `client_id` (so the beacon still conforms).** Under a storage denial, identity
   sourcing mints an **ephemeral** `client_id` (in-memory / per-page, never written to `document.cookie`) so
   the MP beacon still carries a required `client_id` — a *storage* denial restricts *persistence*, not the
   measurement transmission (ADR-0007). Observable: the beacon carries a `client_id` that is **not** persisted
   to the jar; across two page loads the ephemeral id does not survive (no `_ga` continuity).
3. **Both the write-deny and the ephemeral-source key off the same resolved purpose** — the single
   `analytics_storage` grant drives both (ADR-0007's "one signal → two enforcement points" qualification).
   Observable: one denied purpose produces both the no-write and the ephemeral-id behaviors.
4. **Granted / pending unchanged from 004-03.** `granted` → the normal persistent `_ga` generate+persist
   flow (byte-identical to 004-03). (`pending` egress-hold is 017-03's seal concern; here `pending` also does
   not persist — a pending storage purpose is not a grant.) Observable: granted → the persistent write path
   unchanged.
5. **E2E.** Host sets `{ analytics_storage: "denied" }` → boot → no persistent `_ga` write, the beacon
   carries an ephemeral (non-persisted) `client_id`; host sets `"granted"` → the persistent `_ga` flow
   (004-03) is unchanged. Assert the jar state (no `_ga` on deny; `_ga` on grant) + the beacon `client_id`.

**DoD:**
- [ ] ACs 1–5 pass — denied `analytics_storage` → no persistent `_ga` + ephemeral `client_id` (beacon still
      conforms); granted → 004-03 unchanged. Green against targeted tests.
- [ ] **No regression** — 004-03 identity sourcing (granted path) + `ga4_mp_conformance` (client_id present)
      + 017-01 stay green.
- [ ] Reviews: compliance + craft + reconciliation recorded pass (reuses 017-01's resolver; a
      cookie-capability gate + an ephemeral-id source — the arch seam is 017-01's).
- [ ] Deviation log + reconciliation sweep; OQ13 item 1 marked resolved (identity write gates on
      `analytics_storage`); `docs/refinement-todo.md` + `docs/releases/mvp3.md` updated.
- [ ] **No live identifiers committed** — synthetic client_ids/consent vectors only.

**Anti-horizontal-phasing check:** after this slice, a host denying `analytics_storage` gets **no persistent
identity cookie** while the beacon still conforms (ephemeral id) — the storage half of the consent vector
enforced at the cookie capability, resolving OQ13 item 1.
