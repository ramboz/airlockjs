---
status: DRAFT
kind: spike
dependencies: []
last_verified:
frame_review: true
---

<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about
     runnable surfaces by probe first (run it / read source) or a citation. -->

## Slice 013-01 — real Edge round-trip + mint-recognizability

**Goal:** Boot stock `@adobe/alloy@2.35.0` in the chamber against a **real** Adobe Edge
datastream, capture the real `interact` **response**, and verify that (a) the real
server-assigned ECID round-trips into the broker's cookie jar, and (b) the broker's XDM
**mint-recognition + coalescing** (012-02) hold against **real** Alloy — resolving
[ADR-0008](../../decisions/adr-0008-oq9-coherency-sync-access.md)'s **mint-recognizability**
kill-criterion against real Alloy (the last of its three freeze-hold conditions: interception
+ mint-recognition + coalescing; the second kill-criterion — unmodified-bundle-preserving
interception — is live-invariant, already cleared in 012-01, not re-probed). A green 013-01
clears the freeze's **mint axis** — **necessary, not sufficient**: the broader wrapped-SDK
contract-freeze still awaits 013-02 (egress fan-out) + 013-03 (config-integrity).

**Question:** Does the broker's XDM mint-recognition + coalescing — validated against MVP2's
faithful *stub* — hold against a **real** Adobe Edge round-trip (real server-assigned ECID,
real response shape), i.e. is ADR-0008's kill-criterion satisfied against live Alloy, or does
the real response force the **host-seeded-identity** fallback ADR-0008 named?

**Time-box:** ~1–2 days **once credentials are provisioned** (the probe is small; the
unknown is the real response, not the harness — reuse `rig/alloy-coalescing.*`, swap the
gate-able stub for the real Edge).

**DoR:**
- ✅ [012-01](../012-mvp2-alloy-chamber/slice-01-host-and-boot.md) + [012-02](../012-mvp2-alloy-chamber/slice-02-mint-coalescing.md)
  DONE — the chamber, the fetch-interception → main-thread dispatch, and the broker's
  mint-recognition + coalescing all exist and are green against the stub.
- ✅ ADR-0008 kill-criterion: mint-recognizability against real Alloy must be validated
  before the freeze; and its fallback (host-seeded identity) is named.
- ⛔ **BLOCKER — credentials (scoped):** a **test/dev** Adobe datastream (`datastreamId`) +
  IMS `orgId` with Edge + Analytics + Target provisioned. Creds are needed to capture the
  real request/response **once** (AC1) + to run the live-traffic ACs (AC1 round-trip, AC3
  live timing). But AC2's **response-shape recognition** — the kill-criterion evidence — is a
  **one-time-capture → creds-free hermetic replay** (the captured, redacted fixture replays
  against the existing extractor on every run), so the highest-value learning does *not* need
  standing creds. (Drafting is fully unblocked; this is a scoped access gate, not a code gate.)

**Acceptance Criteria:**

1. **Real round-trip.** alloy `configure`s against the real `datastreamId`/`orgId` and sends
   one `interact` — routed via the orchestrator's main-thread dispatch (ADR-0004) to the
   **real** `adobedc.demdex.net/ee/v1/interact` — and a **real server-assigned ECID**
   returns and round-trips into the `AMCV_*`/`kndctr_*` jar. Observable: a real ECID (not a
   stub value) in the jar; the real `interact` request + response captured (not committed —
   Assumptions).
2. **Mint-recognizability holds live — captured _once_, then replayed creds-free.** The
   kill-criterion evidence is **decoupled from standing credentials**: capture **one** real
   `interact` request + response (AC1, needs creds once), **redact the identifier _values_**
   (the *shape* is not a secret), and **replay them hermetically** against the
   already-existing pure recognizer/extractor (`rig/alloy-xdm-mint.js` — `recognizeInteract`
   + `extractEcidFromInteractResponse`, relocated import-clean in 012-02 for exactly this)
   as a **durable fixture test** (`test/`). Observable: the real request is recognized as a
   coalescable mint (the `query.identity.fetch` ECID shape holds live — *re-confirmed*,
   since a real datastream's consent / provisioning can add request fields the stub never
   exercised); the real response's identity handle extracts by the same path. **Any shape
   drift is a valid FAILED outcome, recorded — not smoothed over.** The redacted fixture
   stays in the repo as a **creds-free regression**, so this evidence survives without
   standing credentials.
3. **Concurrent coalescing against real Edge.** Two chambers both first-minting against the
   **real** Edge are coalesced by the broker to **one** ECID — or, if the real Edge's timing
   / response defeats the stub-constructed window, the deviation is characterized honestly
   (the spike's job is to learn, not to force a pass).
4. **Kill-criterion verdict recorded.** ADR-0008's mint-recognizability kill-criterion is
   marked **CONFIRMED** (mechanism holds live → the contract-freeze gate is cleared on this
   axis) or **FAILED** (→ open the host-seeded-identity superseding ADR ADR-0008 named).
   The verdict + evidence land in the Outcome + `docs/refinement-todo.md` (OQ9).

**DoD:**
- [ ] **Un-waivable floor (the spike's Question MUST be answered, not hedged away):**
      (i) AC1 — a real round-trip completes and the real request + response are **captured**;
      (ii) AC2 — the captured real request + response are **run through the
      recognizer/extractor** and the boolean + any shape-drift **recorded** (a FAILED
      recognition is a valid outcome; *not checking* is not); (iii) AC4 — a **CONFIRMED /
      FAILED verdict** is recorded. These three cannot be waived by "characterize honestly."
- [ ] AC3's *live concurrent-coalescing determinism* is **best-effort** — and note the
      **method gap**: 012-02's determinism came from a **gate-able** stub (hold the first
      response until the second mint arrives at the broker); against **un-gateable** real Edge
      that lever is gone, so a *deterministic* live window may be unconstructable. Lean on
      012-02's **hermetic** coalescing-correctness proof for correctness; use the live run to
      confirm the mechanism **doesn't break** against real Edge, not to re-prove determinism.
- [ ] Spike-light review: compliance + craft recorded pass.
- [ ] Deviation log + reconciliation sweep produced under this slice heading.
- [ ] `docs/refinement-todo.md` OQ9 updated with the kill-criterion verdict; if FAILED, the
      host-seeded-identity fallback is filed (ADR or refinement item).
- [ ] **No live identifiers / credentials committed** — ECIDs, datastreamId, org id stay
      out of the repo (redact captured payloads).

**Findings:** _Filled during IN_PROGRESS (once credentials land)._

**Outcome:** _Set at DONE — e.g. `ADR-0008 kill-criterion confirmed against live Alloy;
wrapped-SDK contract-freeze unblocked on the mint axis` OR `kill-criterion failed → ADR-00NN
host-seeded identity`._

**Anti-horizontal-phasing check:** after this slice we **know** whether the coalescing
mechanism holds against real Alloy — the contract-freeze gate has a *measured* answer, not
a stub's. Observable value: the ADR-0008 kill-criterion, resolved live.
