---
status: DONE
dependencies: [039-01]
last_verified: 2026-09-08
frame_review: true
---

## Slice 039-02 — Consent Mode state carriage (gcs)

**Goal:** Carry the **Consent Mode STATE** on the `/g/collect` beacon — `gcs` (e.g. `G111` granted / `G100` denied),
**derived** from the host consent vector — closing the MP path's consent-state gap (MP's `consent` object cannot express
the storage purposes GA4's `gcs` carries). The **defaults** string `gcd` is a separate, harder problem (it co-varies
with consent and is not a pure function of the vector) — split into slice **039-05**; this slice ships `gcs` only.

**Grounding note (2026-09-08).** `gcs` = the Consent-Mode STATE string, `G1<ad_storage><analytics_storage>` (documented
Consent Mode v2), a **pure function of the resolved vector**. Both anchors are **live-observed** on the reference page:
`gcs=G111` (all granted) and `gcs=G100` (all denied). (`gcd`, by contrast, was observed to co-vary with consent —
`13r3r3r3r5l1` granted vs `13q3q3q3q5l1` denied — so it is *not* carry-verbatim and *not* a pure vector function; that
derivation is 039-05's scope, not this slice's. The earlier draft's `gcd`-as-carried-constant model is retired.)

**DoR:**
- ✅ 039-01 done — the core beacon exists.
- ✅ The vendor-neutral consent resolver exists — `core/consent.js` `resolveConsent` (reused by `connectors/ga4/consent.js`).

**Acceptance Criteria:**

1. **A `gcs` encoder** maps the resolved host consent vector (`ad_storage`, `analytics_storage`) to the Consent-Mode
   `gcs` STATE string (`G1<ad_storage><analytics_storage>`, documented Consent Mode v2). This is a pure function of the
   vector — no default-config input required.
2. **The beacon carries `gcs`** when consent is signaled. `pending` follows the existing discipline
   (`connectors/ga4/consent.js:48`): omit rather than fail-safe-deny — never send a misleading state for a purpose the
   host never decided. **Mixed-pending rule (gcs is a joint positional string `G1XY` — a single digit cannot be
   omitted):** if *either* governing signal (`ad_storage`/`analytics_storage`) is `pending`, the connector omits `gcs`
   **entirely** rather than emit a `G1XY` with a guessed digit — consistent with the seal's hold-on-pending (017-03).
   `gcs` is emitted only once both governing signals are decided.
3. **Both anchors match the live capture.** A granted vector encodes `gcs=G111` and an all-denied vector encodes
   `gcs=G100` — asserted against the **live-observed** values (redacted fixture / vector→string table), **not** an
   author-invented synthetic string. A single-signal deny (e.g. only `analytics_storage=denied`) encodes the documented
   per-position digit, confirmable on a single-signal capture before the encoder is frozen.

**DoD:**
- [x] All ACs pass; full suite green (89 files / 1356 tests, independently re-run).
- [x] Coverage: `gcs` for granted (`G111`), all-denied (`G100`), an **asymmetric** vector pinning the digit order
      (`{ad_storage:denied, analytics_storage:granted}` → `G101`, live-confirmed — fails on a purpose-order swap),
      all-pending (omitted), and a **mixed-pending** vector (one governing signal decided, the other pending → `gcs`
      omitted entirely, not a partial `G1XY`).
- [x] Each new test shown to fail when its feature is removed (encoder deletion → all gcs tests fail; order swap → the
      asymmetric pair fails).
- [x] Reviewed by `reviewer` (compliance + craft — both pass; evidence in `reviews/slice-02-*.md`).
- [x] Deviation log + reconciliation sweep produced.

## Assumptions

- **Three `gcs` anchors are live-observed, including the digit order; only the signal-set restriction stays documented.**
  Live-captured 2026-09-08: `G111` (all granted), `G100` (all denied), and — via a careful single steady update
  (avoiding the earlier mixed-vector race) — `G101` for `{ad_storage:denied, analytics_storage:granted}`. That
  asymmetric anchor **confirms the digit order** `G1<ad_storage><analytics_storage>` (a reversed order would have given
  `G110`), matching documented Consent Mode v2. **Still documented-only** (not isolated live): that `gcs` depends on
  **only** the two storage signals and ignores `ad_user_data`/`ad_personalization` — the data-use signals were granted
  in the captures, not independently varied; documented CMv2 excludes them and unit test #5 pins it. (Why
  `frame_review: true`.)
- **`gcd` is explicitly out of scope here** — it co-varies with consent (observed `13r…` granted / `13q…` denied), so it
  is neither carry-verbatim nor a pure vector function; deriving it from (declared defaults + resolved vector) is slice
  039-05.

**Anti-horizontal-phasing check:** After this slice the rewired GA4 beacon carries the Consent-Mode **state** (`gcs`), so
a consent-governed page reaches GA4 with the same `gcs` the container sent — consent-**state** parity, end-to-end and
verifiable by the parity harness. (The defaults string `gcd` — the modeling-signal half — is deferred to 039-05; this
slice does not claim full Consent-Mode parity on its own.)

### Deviation log (after reconciliation)

- **`ctx.consent` shape overload (deliberate frame choice + tracked hazard).** `encodeGcs` reads the **raw** ADR-0007
  consent vector (`{ad_storage, analytics_storage, …}`, lowercase states) from `config.ctx.consent`, threaded through the
  same single `ctx` path 039-01 established (no new sourcing seam invented). The sibling MP path `connectors/ga4/map.js`
  reads a **shaped** MP object from the same `ctx.consent` field name. No live collision today (the gtag connector is not
  host-wired; each factory gets its own `ctx`), but it is a latent host-wiring hazard: a shaped object reaching
  `encodeGcs` resolves every storage purpose to `pending` → `gcs` **silently omitted**. Logged in
  `docs/refinement-todo.md` — the future host-wiring slice (likely 039-03) MUST pass the raw vector and must NOT reuse
  the MP `shapeMpConsent` path.
- **Digit order upgraded from documented-only to live-confirmed, and an order-guard test added post-craft-review.** The
  craft pass ([blocker]) found the symmetric anchors `G111`/`G100` could not catch a `GCS_PURPOSES` order swap. A careful
  single steady-state consent update (avoiding the earlier mixed-vector race, see `captures/observed-rules.md`)
  live-confirmed `{ad_storage:denied, analytics_storage:granted}` → `G101`, pinning `G1<ad_storage><analytics_storage>`.
  Added the asymmetric `G101` (+ complementary `G110`) tests; they fail on an order swap. Blocker cleared.
- **Scope held to `gcs`.** `gcd` (defaults, 039-05) and the session-state fields (039-03) remain **owned
  `expected-dropped` gaps** in the parity descriptor's gap map; only the `gcs` gap row was removed (now classifies
  `maps`).
- **Nit → later docstring sweep (non-blocking):** `mapToGtagCollect`'s `@param event` types it `{type, params?}` but the
  body also reads `event.payload` (documented on the outer `createGa4GtagConnector` JSDoc; the inner one drifts).

### Reconciliation sweep

- **`connectors/ga4/gtag.js`**: **updated** — added `encodeGcs` (pure reuse of `core/consent.js` `resolveConsent`) + the
  `gcs` beacon param; no change to 039-01's field mapping or return shape.
- **`rig/parity/descriptors/ga4-gtag.js`**: **updated** — `gcs` gap row removed (now a mapped/verified field); the oracle
  asserts `gcs` classifies `maps`. `gcd`/session-state gap rows retained (039-05/039-03 owners).
- **`test/ga4-gtag.test.js`**: **updated** — added the gcs unit suite (granted `G111` / all-denied `G100` / asymmetric
  order-guards `G101`+`G110` / all-pending / mixed-pending / data-use-independence) plus the descriptor "gcs classifies
  `maps`" oracle test.
- **Frozen MP surface** (`connectors/ga4/map.js`, `contracts/ga4-mp*`) **and** `connectors/ga4/consent.js`: **no-op** —
  untouched; the AC4-style golden-hash guard still passes; the MP consent shaper was NOT modified.
- **`docs/refinement-todo.md`**: **updated** — added the `ctx.consent` shape-overload host-wiring hazard entry.
- **`docs/architecture.md`**: **deferred** to spec close-out (039 mid-flight; primer-hygiene rule).
- **Assumptions residual**: the signal-set restriction (gcs ignores `ad_user_data`/`ad_personalization`) stays
  documented-CMv2 + unit-test-pinned; a steady-state single-signal *isolation* capture is the only outstanding pre-freeze
  confirmation (low risk — digit order + both anchors are now live-confirmed).
- **Glossary / CLAUDE.md primer**: **no-op** — spec not yet closed.
