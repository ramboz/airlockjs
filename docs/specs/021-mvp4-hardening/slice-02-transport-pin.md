---
status: DRAFT
dependencies: []
last_verified: 2026-08-31
frame_review: true
---

<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about
     runnable surfaces by probe first (run it / read source) or a citation. -->

## Slice 021-02 — egress transport pin (http-downgrade), grounding-first

**Goal:** Close the 015-02 **protocol-blindness** residual — an `http://` downgrade to the honest host+tenant
must not forward identity/analytics over cleartext. **Grounding-first** (the load-bearing question): the 016
endpoint-ceiling checks `origin`, which *includes* the scheme (`http://h` ≠ `https://h`), so a downgrade to a
declared `https://` origin may **already** be rejected — pin `https` only where a *real* gap remains, not
speculatively.

**DoR:**
- ✅ 015-02 review named the residual: config-integrity keys on `.host` (not scheme); `pinnedDispatchUrl`
  (override) preserves the chamber's scheme. **Grounded** (refinement-todo 013-03 / 015-02).
- ✅ `core/endpoint-ceiling.js` `originPath` drops the query but `origin` includes the scheme. **Grounded.**

**Acceptance Criteria:**

1. **Ground the ACTUAL coverage first (the frame-critique GROUNDED this — re-ranked candidates below).** The
   016 ceiling ALREADY rejects an `http://` downgrade wherever wired: `checkEndpointCeiling` compares
   `origin + pathname` and `origin` includes the scheme, so `http://h/p ∉ ["https://h/p"]` → HOLD (GA4 seam +
   alloy seam both wire it). So enumerate the candidate gaps in this order: **(a) [LEADING] a config-integrity
   (or allow-list) egress path with NO ceiling co-wired** — config-integrity keys on `.host` (scheme-blind),
   so a downgrade there is NOT caught; enumerate the shipped rig/adapter wiring to see if a ceiling-less path
   exists. **(b) [already-closed when a ceiling is co-wired] the config-integrity `override` re-derive** — the
   ceiling runs FIRST + holds the http original before override runs, and `pinnedDispatchUrl` only re-derives
   the tenant on an already-ceiling-granted (scheme-included) origin, so it cannot escape to http; confirm.
   **(c) [confirmed-covered] the ceiling-wired GA4 + alloy paths.** Record the true gap set — likely just (a),
   possibly empty. If empty, the "pin" collapses to a **confirmation + regression test**, not new gating.
2. **Pin `https` exactly where a gap remains — fail-closed, surfaced.** For each grounded gap (most likely a
   **config-integrity path with no ceiling co-wired** — pin scheme in `checkConfigIntegrity` itself so it is
   not scheme-blind even standalone, defense-in-depth), require `https` (or the page's
   own scheme if the page is `http` — do not force `https` on a localhost/http *test* origin, mirroring the
   014-01 cookie-attribute origin-awareness): a downgraded destination is **held** + a redacted 009-02 alert.
   Observable: an `http://` downgrade to the honest host is held (not forwarded); the honest `https://` path
   is unchanged.
3. **No regression.** The ceiling / config-integrity / the honest https egress paths stay green; localhost/http
   rigs (which legitimately use `http`) are not broken by an over-eager pin.

**DoD:**
- [ ] AC1 grounding recorded (the true gap set — possibly empty). ACs 2–3 pass for each real gap. Tests:
      an `http://`-downgrade-held case at the grounded gap; the honest https path unchanged; a localhost/http
      rig not broken. Targeted sweep: `endpoint-ceiling*`, `wrapped-sdk-host`, `alloy-config-integrity`,
      any egress test.
- [ ] **Frame-critique** (the load-bearing premise: "there IS an uncovered http-downgrade gap" — the ceiling's
      origin check may already close it; do not add speculative gating) + compliance + craft + reconciliation.
- [ ] Deviation log + reconciliation sweep; refinement-todo **015-02 protocol-blindness residual** marked
      RESOLVED (or, if grounding shows the ceiling already covers it, marked RESOLVED-BY-CONFIRMATION with the
      regression test).
- [ ] **No live identifiers committed.**

**Anti-horizontal-phasing check:** a downgraded egress is held at the seal (or confirmed-already-held) — an
observable security change on the egress path; grounding-first keeps it honest (no speculative control).
