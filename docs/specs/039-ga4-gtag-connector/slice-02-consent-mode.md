---
status: DRAFT
dependencies: [039-01]
last_verified:
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
- [ ] All ACs pass; full suite green.
- [ ] Coverage: `gcs` for granted (`G111`), all-denied (`G100`), all-pending (omitted), and a **mixed-pending** vector
      (one governing signal decided, the other pending → `gcs` omitted entirely, not a partial `G1XY`).
- [ ] Each new test shown to fail when its feature is removed.
- [ ] Reviewed by `reviewer` (compliance + craft).
- [ ] Deviation log + reconciliation sweep produced.

## Assumptions

- **Both `gcs` anchors are live-observed; the digit order AND the signal-set restriction rest on documented CMv2.**
  `gcs=G111` (all granted) and `gcs=G100` (all denied) were both captured on the reference GA4 beacon 2026-09-08. Because
  both anchors flipped all four signals together, they do NOT by themselves establish (a) the
  `ad_storage`-vs-`analytics_storage` digit **order**, nor (b) that `gcs` depends on **only** those two storage signals
  and ignores `ad_user_data`/`ad_personalization`. Documented Consent Mode v2 fixes both (`G1<ad_storage><analytics_storage>`,
  data-use signals excluded). A live attempt to disambiguate via mixed-vector `gtag('consent','update')` captures
  **raced** (rapid updates vs. event dispatch → internally-inconsistent beacons, see `captures/observed-rules.md`), so
  these stay documented-CMv2 residuals; the pre-freeze confirmation should include a single-`ad_storage`-deny, a
  single-`analytics_storage`-deny, AND a data-use-only-deny (via a steady consent state, not a racing update). (Why
  `frame_review: true`.)
- **`gcd` is explicitly out of scope here** — it co-varies with consent (observed `13r…` granted / `13q…` denied), so it
  is neither carry-verbatim nor a pure vector function; deriving it from (declared defaults + resolved vector) is slice
  039-05.

**Anti-horizontal-phasing check:** After this slice the rewired GA4 beacon carries the Consent-Mode **state** (`gcs`), so
a consent-governed page reaches GA4 with the same `gcs` the container sent — consent-**state** parity, end-to-end and
verifiable by the parity harness. (The defaults string `gcd` — the modeling-signal half — is deferred to 039-05; this
slice does not claim full Consent-Mode parity on its own.)

### Deviation log (after reconciliation)

_TBD at implementation._

### Reconciliation sweep

_TBD at implementation._
