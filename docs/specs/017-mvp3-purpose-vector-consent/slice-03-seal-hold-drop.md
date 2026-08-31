---
status: DONE
dependencies: [017-01]
last_verified: 2026-08-30
frame_review: true
---

<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about
     runnable surfaces by probe first (run it / read source) or a citation. -->

## Slice 017-03 — seal hold-pending + strict-drop

**Goal:** Enforce ADR-0007 point ③ — the seal reads the consent **vector**: a **pending** purpose (no signal
yet) → **HOLD** the beacon at the seal + **flush-on-arrival** when the purpose grants (AD-9 held-until-
activation, now **per purpose**); a declared **strict / TCF no-processing regime** → **DROP** (no beacon at
all). This is the "consent-first" behaviour — a beacon whose purpose is un-granted does not silently egress.
Reuses 017-01's consent vector + resolver.

**DoR:**
- ✅ [017-01] DONE — the consent taxonomy + `resolveConsent(vector, purpose)` (a **pure** resolver, no
  mutable state) + the boot-time fold. **This slice must BUILD its own main-thread consent-update path**
  (below) — 017-01's seam is boot-time-only and explicitly deferred mid-session updates.
- ✅ The **async** egress dispatch seam exists (`core/airlock.js` `worker.onmessage` → `fetch(r.url)`);
  016-01 wired the endpoint ceiling **there** (`core/airlock.js`, **not** `core/egress.js` — corrected). The
  held beacons are the already-mapped `ready` requests the orchestrator dispatches — so a hold/flush is a
  **main-thread** concern (re-`fetch(r.url, r.body)`), no worker involved.
- ✅ AD-9 held-until-activation + flush-on-arrival is the existing binary model (architecture.md) — this
  slice makes it **per purpose**.

**Acceptance Criteria:**

1. **Pending → HOLD at the async seal (per governing purpose).** In `core/airlock.js`'s `worker.onmessage`
   dispatch, a `ready` beacon whose **governing purpose** resolves **pending** is **held** — not dispatched
   — and retained in a **per-purpose buffer** (the already-mapped `{ url, body }`). Observable: with
   `analytics_storage` pending, a GA4 beacon produces **zero** egress and sits in the buffer.
2. **017-03 BUILDS the main-thread consent-update path (the flush's grant signal — NOT 017-01's deferred
   worker re-send, 017-03 frame-critique).** The orchestrator owns a **mutable** main-thread consent vector
   (seeded from the boot vector) + exposes a **`setConsent(vector)`** handle method. On a **pending→granted**
   edge for a held purpose, the buffered beacons are **flushed** — a pure main-thread **re-`fetch(r.url,
   r.body)`** (they are already mapped; no worker, no re-map). This is a **distinct** mechanism from 017-01's
   deferred worker `ctx` re-send (which governs only the mapper *reshape* ① and stays deferred) — so a
   flushed beacon carries its **boot-time** reshaped payload (a **named residual**: mid-session *reshape*
   update is still deferred; 017-03 gates *dispatch*, not the payload). Observable: `setConsent` granting a
   held purpose → the buffered beacons egress; a still-pending purpose's stay held.
3. **Strict regime → DROP (no beacon).** Under a **declared strict / no-processing regime**, a denied/pending
   purpose → **DROP**: the beacon is discarded, not held, not sent. **Grounding-honest:** ADR-0007 leaves
   *where* the regime is declared an **open question** ("pin with the seam contract"); this slice **chooses**
   the simplest available option — a **boot property** on the consent input — and names it as choosing among
   the ADR's open options, not reading a pinned decision. Observable: strict + un-granted → zero egress
   **and** no buffer (dropped, distinct from held).
4. **The sync/unload fast path can only DROP a pending beacon (both-sites parity, honest).** The synchronous
   fast path (`core/egress.js`, reached by `pushCritical` + the `unloadFlush` ring-tail at teardown) has **no
   "later"** to flush to — a hold there could never be released. So a beacon whose governing purpose is
   **un-granted** on the sync/unload path is **DROPPED**, not held (and surfaced). This closes the gap the
   slice's own goal would otherwise leave (a pending beacon must not *silently* egress on the unload path).
   Observable: sync-path dispatch with the purpose un-granted → zero egress + a dropped diagnostic.
5. **The purpose→beacon binding is the manifest's declared egress `purposes`.** Which purpose governs a
   beacon is the connector's declared `purposes.egress` (grounded: GA4 → `["analytics_storage"]`) — not
   hardcoded. A beacon governed by **multiple** declared purposes is held/dropped if **any** is un-granted
   (fail-closed). Observable: the hold keys off the declared purpose(s), vendor-neutral.
6. **Surfaced (009-02).** A held / dropped / flushed beacon emits a redacted diagnostic
   (`{ level, kind: "consent", disposition: "held" | "dropped" | "flushed", purpose, … }`) — never a silent
   drop. Observable: one diagnostic per held/dropped beacon; a flush emits the flushed record.
7. **E2E.** Pending `analytics_storage` → async beacon **held** (zero egress) + buffered + a `consent`/held
   diagnostic; `setConsent({analytics_storage:"granted"})` → **flushed** (the buffered beacon re-dispatches);
   strict regime + un-granted → **dropped** (zero egress, no buffer) + dropped diagnostic; the **sync/unload**
   path with the purpose un-granted → **dropped**; granted (normal) → dispatched unchanged.

**DoD:**
- [x] ACs 1–7 pass — pending held (async) + flushed on `setConsent` grant (main-thread re-dispatch); strict
      dropped; sync/unload un-granted dropped; **denied `analytics_storage` SENDS** (not held); granted
      unchanged; each surfaced. _(Targeted: consent-seal, consent (+egressVerdict), eds-boot,
      endpoint-ceiling-seam, egress-fastpath, core-boundary — 88/88, no hang.)_
- [x] **No regression** — 016-01's endpoint ceiling (composed: consent gate runs *before* the ceiling) +
      017-01/02 + the honest dispatch path stay green; the no-consent/no-`egressPurposes` path is
      byte-unchanged (the gate is `if (egressPurposes.length)`).
- [x] Reviews: compliance + craft + **arch** (a main-thread mutable consent vector + `setConsent` + a
      per-purpose hold/flush buffer + the strict-drop + the sync-path-drop, composed with the 016-01 ceiling)
      + reconciliation, recorded pass (independent Opus review of the Sonnet diffs).
- [x] Deviation log + reconciliation sweep. **The seal-side flush IS built here** (main-thread `setConsent`
      → flush); what stays **deferred** (tracked) is the worker `ctx` re-send for the *mapper reshape ①*
      (flushed beacons carry boot-time reshape) + the per-purpose **stop** on *revoke* + prerender-per-purpose.
      No dedicated purposes-not-enforced sentinel existed to flip (the seal-enforcement is now shown by
      `test/consent-seal.test.js`); `docs/refinement-todo.md` + `docs/releases/mvp3.md` updated (**spec 017
      complete**).
- [x] **No live identifiers committed** — synthetic consent vectors only.

### Deviation log

- **`egressPurposes` gated on `consent` being wired (implementer catch — important).** `resolveConsent` maps
  an *absent* vector to `"pending"` identically to a wired-but-unresolved one, so wiring the purpose
  unconditionally would **hold every beacon forever** for any deployment that never passes `consent` (nothing
  would call `setConsent`) — a silent catastrophe. Fixed with `egressPurposes: consent ? ["analytics_storage"]
  : []`, the same no-consent→legacy idiom as 017-01/02; locked in with an `eds-boot` test. Correct + necessary.
- **The consent gate runs BEFORE the 016-01 ceiling** in `worker.onmessage` (a held/dropped beacon never
  reaches the ceiling/fetch); the honest granted path + the ceiling are byte-unchanged when the gate is off.
- **Sync/unload = DROP, not hold** (`criticalDispatchGated` wraps both `unloadFlush` + `pushCritical`) — no
  "later" to flush to at teardown; `core/egress.js` itself is untouched (the gate lives in `core/airlock.js`,
  one consent-logic home).
- **No purposes sentinel to flip** — grep confirmed none ever existed (the only declared-not-enforced sentinel
  was the *endpoint* one, alloy-only, already flipped by 016-02). GA4 purpose-enforcement is now demonstrated
  by the new seal test; alloy purposes remain declared-not-enforced (out of scope, tracked).

### Reconciliation sweep

- New `egressVerdict` in `core/consent.js` (vendor-neutral); the seal-hold/flush/drop + `setConsent` in
  `core/airlock.js`; the adapter wiring. No new `core/` boundary breach (boundary test green).
- Reviews recorded: frame-critique + compliance + craft + arch + reconciliation — all pass.
- `docs/refinement-todo.md`: the deferred worker-reshape-re-send + revoke-stop + prerender-per-purpose +
  strict-declaration-site + alloy-seal-enforcement tracked. `docs/releases/mvp3.md`: **spec 017 COMPLETE**
  (all three ADR-0007 points).
- No inbox items; the deferrals + the delegate-and-send / boot-time-reshape residuals are named.

**Anti-horizontal-phasing check:** after this slice, a beacon whose governing purpose is **pending** is held
at the async seal (and flushed by a main-thread `setConsent` grant), a **strict**-regime un-granted beacon
is dropped, and a pending beacon on the **sync/unload** path is dropped (no future to flush to) — the seal
now enforces the consent vector's *timing/regime* dimension at **both** dispatch sites. Completes ADR-0007's
three-point model. Spec 017 complete.
