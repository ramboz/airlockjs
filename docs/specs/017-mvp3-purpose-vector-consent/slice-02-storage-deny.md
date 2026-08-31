---
status: DONE
dependencies: [017-01]
last_verified: 2026-08-30
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

1. **Gate identity sourcing INSIDE `sourceGa4Ctx` (where the read + write live), threaded from the adapter
   (017-02 frame-critique).** The resolved `analytics_storage` state is threaded from the adapter (which holds
   the 017-01 consent vector) **into** `sourceGa4Ctx` (`connectors/ga4/cookies.js`) — where the `_ga` **read**,
   parse-and-use, **and** write all live. A gate placed *at the adapter* sits **downstream of the read** and
   cannot suppress the persisted-id use, so it must be threaded in. Observable: `sourceGa4Ctx` receives the
   `analytics_storage` state and branches on it.
2. **Denied → mint a FRESH EPHEMERAL id, IGNORING any existing `_ga` (gate the READ-and-use, not just the
   write).** When `resolveConsent("analytics_storage") !== "granted"`, `sourceGa4Ctx` mints an **ephemeral**
   `client_id` **unconditionally** — it does **NOT read/use an existing persisted `_ga`** (reading a persisted
   id is itself using denied storage; ADR-0007 "**drop** the persistent `client_id`") **and** does **NOT**
   write one. Observable: denied → no `cookies.set("_ga")` **AND** the returned `client_id` is a fresh
   ephemeral value, **not** any `_ga` already in the jar.
3. **Pre-existing `_ga` under denial does NOT leak (the case a write-only gate greens falsely).** With a
   **valid persisted `_ga` already in the jar** and `analytics_storage` denied, the beacon's `client_id` is
   the **ephemeral** value, **not** the persisted one — no cross-page continuity (two loads with the same jar
   → two different ephemeral ids). Observable: jar `_ga=GA1.1.12345.678` + denied → beacon
   `client_id !== "12345.678"`.
4. **`session_id` is ALSO ephemeral under denial (same-altitude fix — 017-02 frame-critique).**
   `sourceGa4Ctx` also sources `session_id` from the persisted `_ga_<stream>` cookie (`findGaStreamCookie`);
   under an `analytics_storage` denial it must **not** read it — force the **per-page fallback**
   (`String(bootSeconds)`), the same posture as the client_id. Observable: denied → `session_id` is the
   per-page value, not the persisted `_ga_<stream>` session.
5. **Granted / pending unchanged from 004-03.** `granted` → the normal flow (read existing `_ga` / generate +
   persist + read `_ga_<stream>`), byte-identical to 004-03. `pending` uses the **same non-granted branch as
   denied** (a pending storage purpose is not a grant → no read, no write, ephemeral). Observable: granted →
   004-03 unchanged.
6. **E2E incl. the pre-existing-`_ga` case.** Host `{ analytics_storage: "denied" }` → (a) empty jar → no
   `_ga` write + ephemeral client_id; (b) **jar already holds `_ga=GA1.1.<id>`** → beacon carries the
   **ephemeral** id, **not** `<id>` (no continuity) + no write; (c) `_ga_<stream>` present → `session_id` is
   the per-page fallback, not the persisted session. Host `"granted"` → the 004-03 flow (read/persist) is
   unchanged. Assert jar state + beacon `client_id`/`session_id`.

**DoD:**
- [x] ACs 1–6 pass — denied `analytics_storage` → no `_ga` write **and no read/use of an existing `_ga`**
      (verified: `cookies.get` is never invoked; fresh ephemeral `client_id` + per-page `session_id`), incl.
      the **pre-existing-`_ga`** case (returned id ≠ the persisted `12345.678`, no continuity); granted →
      004-03 byte-unchanged. _(Targeted: ga4-cookies 30/30 (+7 new), eds-cookies, consent, ga4-consent,
      core-boundary — 98/98, no hang.)_
- [x] **No regression** — 004-03 granted path (pinned-value tests: exact `client_id`/cookie-write strings) +
      `uc2-conformance` (client_id present) + eds-boot + 017-01 stay green.
- [x] Reviews: compliance + craft + reconciliation recorded pass (reuses 017-01's resolver; the
      consent-gated read+write inside `sourceGa4Ctx` + the ephemeral fallback — the arch seam is 017-01's).
      Independent Opus review of the Sonnet diffs.
- [x] Deviation log + reconciliation sweep; OQ13 item 1 marked **resolved** (identity **read+write** gates on
      `analytics_storage`, not just the write); `docs/refinement-todo.md` updated; `docs/releases/mvp3.md`
      deferred to spec-017-complete (017-03).
- [x] **No live identifiers committed** — synthetic client_ids/consent vectors only.

### Deviation log

- **The gate is the READ-and-use, not just the write (frame-critique).** `sourceGa4Ctx`'s `!storageGranted`
  early-return does **no `cookies.get`** and **no write** — a fresh ephemeral `client_id` +
  `String(bootSeconds)` session. A test spies on the jar's `get` and asserts it is **never called** under
  denial (the read doesn't happen, not just "the result is ignored") — closing the persistent-id leak a
  write-only gate would have shipped.
- **Back-compat default `storageGranted = true`.** No consent wired → 004-03 persist (the granted branch is
  byte-identical); a *provided* vector enforces per-purpose (`analytics_storage` unset = pending = not
  granted = ephemeral) — the same "no-consent → legacy" split as 017-01.
- **Adapter-integration wiring trusted by inspection** (no new `bootEdsAnalytics` test) — the 017-01
  precedent; the real work (`sourceGa4Ctx`'s branch + `resolveConsent`) is unit-tested.

### Reconciliation sweep

- Gated `sourceGa4Ctx` (read+write) on `analytics_storage`, threaded from the adapter; reuses 017-01's
  `core/consent.js` resolver (connector→core only). No new `core/` seam.
- Reviews recorded: frame-critique + compliance + craft + reconciliation — all pass.
- `docs/refinement-todo.md`: **OQ13 item 1 marked RESOLVED (017-02)** — the identity read+write now gates on
  `analytics_storage`. `docs/releases/mvp3.md` updated at spec-017-complete (017-03).
- No inbox items; the ephemeral-scope bound (per-page, not cross-page) is honestly stated.

**Anti-horizontal-phasing check:** after this slice, a host denying `analytics_storage` gets **no persistent
identity read OR write** — any pre-existing persisted `_ga` / `_ga_<stream>` is **not** used (a fresh
ephemeral `client_id` + per-page `session_id` instead), while the beacon still conforms. The storage half of
the consent vector enforced at the cookie capability, resolving OQ13 item 1 — closing the persistent-id leak
a write-only gate would have missed.
