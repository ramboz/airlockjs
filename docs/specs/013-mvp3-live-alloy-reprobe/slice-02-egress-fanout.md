---
status: DRAFT
kind: spike
dependencies: []
last_verified:
frame_review: true
---

<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about
     runnable surfaces by probe first (run it / read source) or a citation. -->

## Slice 013-02 — egress-breadth fan-out

**Goal:** Capture the **server-directed** demdex / ID-sync / Audience-Manager URLs the
**real** Edge response directs alloy to fire (the fan-out R-004's offline probe suppressed)
— answering whether the ADR-0006 endpoint-ceiling / host-allow-list can **enumerate and
govern** real Alloy's egress, or whether it escapes the chamber's confinement. This is the
enforcement design's required input (012-04 §Findings Axis-1 marked it live-only).

**Question:** What is real Alloy's true egress breadth — which third-party URLs does the
real Edge *response* direct it to fire — and do they flow through the chamber's mediated
`fetch` (012-01 AC5 confinement), or by a path the confinement misses? Can a static
endpoint-ceiling enumerate them, or are they inherently server-directed/dynamic?

**Time-box:** ~1 day once credentials land (capture-and-classify; reuse the 012-01 chamber
+ its egress instrumentation against the real Edge).

**DoR:**
- ✅ [012-01](../012-mvp2-alloy-chamber/slice-01-host-and-boot.md) DONE — the chamber, the
  mediated-`fetch` confinement (AC5), and the egress instrumentation exist.
- ✅ [012-04 §Findings](../012-mvp2-alloy-chamber/slice-04-manifest-characterize.md) — Axis-1
  (egress-breadth) explicitly deferred this live fan-out to MVP3; ADR-0006 (endpoints
  advisory) + ADR-0008 (server-directed egress) frame the question.
- ⛔ **BLOCKER — credentials:** a test/dev datastream + org (same as 013-01). The fan-out is
  only visible with a real Edge response.

**Acceptance Criteria:**

1. **Capture the real fan-out.** With the real Edge, record **every** URL alloy fires for
   one page + event — the `interact` plus any server-directed demdex / ID-sync /
   Audience-Manager URLs the *response* directs. Observable: the complete egress set,
   enumerated (hosts + purpose), redacted of identifiers.
2. **Confinement check.** Each fan-out URL either goes through the chamber's **mediated
   `fetch`** (012-01 confinement) → orchestrator dispatch, **or escapes** by a path the
   allow-list posture does not cover (e.g. an image-pixel / redirect / `sendBeacon` the
   vendor uses for sync). Observable: each URL tagged confined vs. escaped — an escape is a
   **confinement gap** the enforcement must close.
3. **Enumerability verdict.** Classify the fan-out: **static-enumerable** (declarable in the
   manifest `endpoints`, so the ceiling can be authoritative) vs. **server-directed/dynamic**
   (chosen by the Edge response at runtime, un-enumerable at manifest-authoring — the
   endpoint-ceiling cannot be a complete allow-list; ADR-0006's "FLOOR not map" holds). This
   is the load-bearing input to MVP3's endpoint-ceiling enforcement design.
4. **Recorded.** The real egress breadth + the confinement/enumerability verdict land in the
   Findings and update 012-04's characterization (the live Axis-1 half) +
   `docs/refinement-todo.md` (the ADR-0006 endpoint-ceiling enforcement input).

**DoD:**
- [ ] ACs 1–4 pass against the real datastream (or the fan-out is honestly bounded if a
      given sync doesn't fire in the test org).
- [ ] Spike-light review: compliance + craft recorded pass.
- [ ] Deviation log + reconciliation sweep under this slice heading.
- [ ] Characterization (012-04 Axis-1 live) + `docs/refinement-todo.md` updated with the
      fan-out + enumerability verdict.
- [ ] **No live identifiers committed** (redact captured URLs of ECIDs / demdex ids).

**Findings:** _Filled during IN_PROGRESS (once credentials land)._

**Outcome:** _Set at DONE — e.g. `real fan-out = interact + N server-directed demdex syncs,
all confined via mediated fetch; endpoint-ceiling is a FLOOR (server-directed → advisory);
input to MVP3 endpoint enforcement recorded`._

**Anti-horizontal-phasing check:** after this slice, MVP3's endpoint-ceiling enforcement has
the **real** egress breadth to design against — not the stub's single host — and knows
whether any sync escapes confinement. Observable value: the measured fan-out + its
confinement/enumerability verdict.
