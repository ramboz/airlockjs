---
status: DRAFT
dependencies: [017-01]
last_verified:
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
- ⏳ **[017-01] must land first** — the consent vector + `resolveConsent(purpose)` + the seam. Sequencing.
- ✅ The egress dispatch seam exists (`core/airlock.js` `worker.onmessage` → `fetch(r.url)`, + the sync fast
  path `core/egress.js`); 016-01 wired the endpoint ceiling there — the same chokepoint this hold binds to.
- ✅ AD-9 held-until-activation + flush-on-arrival is the existing binary model (architecture.md) — this
  slice makes it **per purpose**.

**Acceptance Criteria:**

1. **Pending → HOLD at the seal (per purpose).** A beacon whose governing purpose resolves **pending** is
   **held** — not dispatched — and retained (a per-purpose pending buffer). Observable: with `analytics_storage`
   / the analytics purpose pending, a GA4 beacon produces **zero** egress and is buffered.
2. **Flush-on-arrival (per purpose).** When a held purpose transitions **pending → granted** (via the
   017-01 seam), the buffered beacons for that purpose are **flushed** (dispatched). Observable: grant →
   the previously-held beacon egresses; a still-pending purpose's beacons stay held.
3. **Strict regime → DROP (no beacon).** Under a **declared** strict / no-processing regime (a host-policy /
   driver property — declared alongside the consent-input driver), a denied/pending purpose → **DROP**: the
   beacon is discarded, not held, not sent. Observable: strict + un-granted → zero egress **and** no buffer
   (dropped, distinct from held).
4. **The purpose→beacon binding is the manifest's declared `purposes`.** Which purpose governs a beacon is
   the connector's declared endpoint/capability purpose annotation (012-04) — not hardcoded. Observable: the
   hold keys off the declared purpose, vendor-neutral.
5. **Surfaced (009-02).** A held or dropped beacon emits a redacted diagnostic (`{ kind: "consent", disposition:
   "held" | "dropped", purpose, … }`) — never a silent drop. Observable: one diagnostic per held/dropped beacon.
6. **E2E.** Pending analytics → beacon **held** (zero egress) + buffered + a `consent`/held diagnostic; then
   grant → **flushed** (egress); strict regime + un-granted → **dropped** (zero egress, no buffer) + a
   dropped diagnostic; granted (normal) → dispatched unchanged.

**DoD:**
- [ ] ACs 1–6 pass — pending held + flushed-on-grant; strict dropped; granted unchanged; each surfaced.
      Green against targeted tests.
- [ ] **No regression** — 016-01's endpoint ceiling at the same seam + 017-01/02 + the honest dispatch path
      stay green.
- [ ] Reviews: compliance + craft + **arch** (a per-purpose hold/flush buffer + the strict-drop regime at
      the egress seam — a new seam behaviour) + reconciliation, recorded pass.
- [ ] Deviation log + reconciliation sweep; the mid-session-update replay/stop semantics (ADR-0007 open
      question) + the prerender-aware-per-purpose interaction tracked; the 012-04 purposes sentinel flipped;
      `docs/refinement-todo.md` + `docs/releases/mvp3.md` updated (spec 017 complete).
- [ ] **No live identifiers committed** — synthetic consent vectors only.

**Anti-horizontal-phasing check:** after this slice, a beacon whose purpose is **pending** is held (and
flushed on grant) and a **strict**-regime un-granted beacon is dropped — the seal now enforces the consent
vector's *timing/regime* dimension, completing ADR-0007's three-point model. Spec 017 complete.
