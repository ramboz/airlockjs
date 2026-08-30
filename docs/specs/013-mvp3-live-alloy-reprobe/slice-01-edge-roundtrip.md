---
status: DONE
kind: spike
dependencies: []
last_verified: 2026-08-30
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
- [x] **Un-waivable floor (the spike's Question MUST be answered, not hedged away):**
      (i) AC1 — a real round-trip completes and the real request + response are **captured**;
      (ii) AC2 — the captured real request + response are **run through the
      recognizer/extractor** and the boolean + any shape-drift **recorded** (a FAILED
      recognition is a valid outcome; *not checking* is not); (iii) AC4 — a **CONFIRMED /
      FAILED verdict** is recorded. These three cannot be waived by "characterize honestly."
- [x] AC3's *live concurrent-coalescing determinism* is **best-effort** — and note the
      **method gap**: 012-02's determinism came from a **gate-able** stub (hold the first
      response until the second mint arrives at the broker); against **un-gateable** real Edge
      that lever is gone, so a *deterministic* live window may be unconstructable. Lean on
      012-02's **hermetic** coalescing-correctness proof for correctness; use the live run to
      confirm the mechanism **doesn't break** against real Edge, not to re-prove determinism.
- [x] Spike-light review: compliance + craft recorded pass.
- [x] Deviation log + reconciliation sweep produced under this slice heading.
- [x] `docs/refinement-todo.md` OQ9 updated with the kill-criterion verdict; if FAILED, the
      host-seeded-identity fallback is filed (ADR or refinement item).
- [x] **No live identifiers / credentials committed** — ECIDs, datastreamId, org id stay
      out of the repo — verified via **deny-by-default** redaction (only curated shape tokens
      kept) + an open-set leak scan: datastream, org id (+ its `@`→`_` cookie-key form), ECID,
      requestIds, and all server-assigned values (Target `eventToken` / `correlationID` included)
      are absent from every committed file; the raw capture is gitignored.

**Findings:** _Live re-probe run 2026-08-30 (`rig/alloy-live-reprobe.mjs` + `rig/alloy-live-harness.html`,
one real `interact` to `adobedc.demdex.net` with the maintainer's test datastream; raw capture
gitignored under `rig/out/`, redacted fixture committed)._

- **Kill-criterion CONFIRMED.** Edge returned **HTTP 200**. The genuine unmodified-alloy request
  (`web.webpagedetails.pageViews`, `query.identity.fetch: [ECID, CORE]`, no ECID asserted) is
  recognized by `recognizeInteract` as an `ecid-first-mint` — request-side recognition
  **re-confirmed live** (AC2). The **real** Edge response's `identity:result` handle carries an
  ECID under `namespace.code === "ECID"`, extracted by the same `extractEcidFromInteractResponse`
  path — response-side recognition **established live** (the new probe). The server-assigned ECID
  round-tripped into the `AMCV_*`/`kndctr_*` jar (AC1).
- **Real response shape (handles):** `identity:result`, `personalization:decisions`,
  `locationHint:result`, `state:store`. Notably the response ALSO carried a **real Target
  `personalization:decisions`** for `__view__` (decisionProvider `TGT`) and a
  **`locationHint:result`** (cluster hints `Target` / `AAM` / `EdgeNetwork`) — live inputs
  013-02 (fan-out) and 013-03 build on.
- **AC2 durable creds-free regression landed.** `test/fixtures/alloy-live-interact.redacted.json`
  is **deny-by-default redacted** (every captured value scrubbed except a curated set of shape
  tokens — `type` / `code` / `eventType` / `schema` / `scope` / …; identity ids tagged
  `REDACTED_<namespace>` so the extractor test proves it selects the **ECID** entry, not just a
  truthy id) + `test/alloy-live-mint-recognizability.test.js` (5 tests, green **without** creds).
  Full suite green (454 tests). No live identifier survives — the enumerated secrets **and** all
  harvested server-assigned values (incl. the Target `eventToken` / `correlationID` a first-cut
  key-allowlist had leaked — 013-01 compliance+craft review) are absent; the fixture write is
  gated on a CONFIRMED capture.
- **AC3 (concurrent live coalescing) — best-effort, method gap confirmed.** Not run as a
  deterministic two-chamber live probe: real Edge is **un-gateable** (it will not park a first
  response until a second mint arrives — the lever 012-02's gate-able stub provided), so a
  *deterministic* in-flight window is **unconstructable** live, exactly the gap the DoD names.
  Coalescing **correctness** stands on 012-02's hermetic proof; this live round-trip confirms the
  **mechanism** (chamber interception → main-thread dispatch → real Edge → ECID → jar) does not
  break against real Alloy.

**Outcome:** `ADR-0008 mint-recognizability kill-criterion CONFIRMED against live Alloy;
wrapped-SDK contract-freeze mint-axis cleared (necessary, not sufficient — 013-02/03 remain);
durable creds-free fixture + regression test landed; refinement-todo OQ9 updated`.

### Deviation log

_2026-08-30._
- **Rig base.** The DoR/Time-box named `rig/alloy-coalescing.*` (two-chamber) as the base; the
  single round-trip (AC1/AC2/AC4) reused the **single-chamber** `rig/alloy-chamber.*` pattern
  instead (new `rig/alloy-live-reprobe.mjs` + `rig/alloy-live-harness.html`) — the coalescing rig
  is the AC3 base, and AC3 is best-effort/unconstructable live. Faithful: same stock bundle, same
  chamber worker, same recognizer/extractor.
- **AC3 not run live.** Deterministic concurrent coalescing is unconstructable against un-gateable
  real Edge (the corrected DoD's named method gap); correctness stands on 012-02's hermetic proof.
  No superseding decision needed — the DoD sanctioned this as best-effort.
- **Redaction hardened post-review.** The compliance + craft reviews caught a key-allowlist leak
  (Target `eventToken` / `correlationID`); redaction was inverted to **deny-by-default** + an
  open-set leak scan, the extract test sharpened to prove ECID-path selection, and the fixture
  write gated on CONFIRMED. All applied; both reviews recorded pass.
- **Environment.** `probes/alloy-worker/node_modules` was `npm ci`-installed (stock alloy 2.35.0,
  sha256 pin `3cea73e1…` verified) — setup, not a code change. `.env` (gitignored) holds the test
  creds; no creds committed.

### Reconciliation sweep

Parallel-and-minimal holds — `core/` + `connectors/` + `contracts/` untouched; only new rig / test
/ fixture files + docs. Full suite green (454). No `architecture.md` / ADR / glossary drift (this
slice is a measurement, not a contract change). ADR-0008's kill-criterion (mint axis) resolved →
recorded in `docs/refinement-todo.md` OQ9; the wrapped-SDK contract-freeze remains gated on
013-02/03. No new deferred decisions surfaced. Artifacts touched: `rig/alloy-live-reprobe.mjs`,
`rig/alloy-live-harness.html`, `test/alloy-live-mint-recognizability.test.js`,
`test/fixtures/alloy-live-interact.redacted.json`, this slice + `spec.md` + `refinement-todo.md`.

**Anti-horizontal-phasing check:** after this slice we **know** whether the coalescing
mechanism holds against real Alloy — the contract-freeze gate has a *measured* answer, not
a stub's. Observable value: the ADR-0008 kill-criterion, resolved live.
