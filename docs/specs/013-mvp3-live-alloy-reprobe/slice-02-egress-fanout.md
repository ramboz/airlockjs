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
**real** Edge response directs alloy to fire (the fan-out R-004's offline probe suppressed),
**via a real-DOM main-thread reference run** — because the classic partner-sync surface is a
DOM-injected `<img>` pixel, which the chamber's **no-DOM shim swallows invisibly** (neither
`fetch`-routed nor thrown-as-blocked), so a headless-chamber-only measurement structurally
**under-counts**. Then answer, separately, whether the ADR-0006 endpoint-ceiling /
host-allow-list can **enumerate and govern** that egress (at **origin** granularity), and what
the chamber's confinement does with each captured sync. This is the enforcement design's
required input (012-04 §Findings Axis-1 marked it live-only).

**Question:** What is real Alloy's true egress breadth — which third-party origins does the
real Edge *response* chain direct it to fire (including **multi-hop** syncs: interact →
demdex `/id` → partner-URL list → partner fires) — and for each, does it flow through the
chamber's mediated `fetch` (012-01 AC5 confinement), **escape** it, or get **swallowed by the
no-DOM shim** (an `<img>`-pixel sync that never egresses in the chamber)? Is the fan-out's
**origin-set bounded and its roster stable** (→ an origin-granularity ceiling could be
authoritative) or server-directed/rotating (→ ADR-0006's "FLOOR not map" holds)?

**Time-box:** ~1–2 days once credentials land. Split: a **one-time creds-gated capture** of
the **complete response chain** (a real-DOM main-thread reference run, dispatcher repointed at
**real** Edge — the 012-01 chamber short-circuits `interact` to a *stub*, so reuse alone won't
follow the live chain), redacted into a multi-response fixture; then **creds-free replay** for
enumeration + classification.

**DoR:**
- ✅ [012-01](../012-mvp2-alloy-chamber/slice-01-host-and-boot.md) DONE — the chamber, the
  mediated-`fetch` confinement (AC5), and the egress instrumentation exist. **Note:** the
  012-01 chamber is *no-DOM* + short-circuits `interact` to a stub — the true fan-out needs a
  **real-DOM main-thread reference run** against real Edge, not chamber-reuse alone.
- ✅ [012-04 §Findings](../012-mvp2-alloy-chamber/slice-04-manifest-characterize.md) — Axis-1
  (egress-breadth) explicitly deferred this live fan-out to MVP3; ADR-0006 (endpoints
  advisory) + ADR-0008 (server-directed egress) frame the question. **Axis-2's real-DOM
  reference-run grounding is the pattern to reuse** (shim-invisible behavior only shows with a
  real DOM).
- ⛔ **BLOCKER — credentials (capture only):** a test/dev datastream + org (same as 013-01) to
  **capture** the chain **once**; classification/enumeration then replays creds-free. **⚠
  Measurement-validity risk:** fan-out breadth is a function of the org's **Audience Manager
  third-party-destination** config — a fresh test/dev org typically has **~zero** partner
  destinations, so the demdex fan-out may not fire. Either provision **representative**
  destinations, or scope the result as a **mechanism / lower-bound** (AC4 validity floor).

**Acceptance Criteria:**

1. **Capture the true fan-out (real-DOM main-thread reference run, full chain).** Against the
   real Edge — dispatcher repointed at real Edge, **real DOM present** so `<img>`-pixel syncs
   actually fire — record **every** origin alloy hits for one page + event: the `interact`
   **plus the multi-hop** server-directed demdex / ID-sync / Audience-Manager chain the
   *responses* direct. Observable: the complete egress set at **origin** granularity (origin +
   purpose + hop), redacted of identifiers, saved as a fixture. A chamber-only run does
   **not** satisfy this — it cannot see the DOM-pixel surface.
2. **Confinement classification — three outcomes, not two.** Replay each captured sync into
   the chamber and tag it: **confined** (through the mediated `fetch` → orchestrator
   dispatch), **escaped** (a path the allow-list posture misses — redirect / `sendBeacon`), or
   **shim-swallowed** (a DOM-`<img>` pixel the no-DOM chamber silently drops — *not* egressed,
   but *not* confined either). Observable: each sync tagged confined / escaped / swallowed. A
   **swallowed** sync is a *false-negative risk* (it would fire in a real DOM); an **escaped**
   sync is a confinement gap the enforcement must close. Mislabelling shim-suppression as
   "confined" is the failure this AC exists to prevent.
3. **Ceiling verdict — origin cardinality + roster stability (the discriminating fact).**
   Don't stop at "static-URL-enumerable vs dynamic" (that binary is ADR-0006's settled "FLOOR
   not map" prior). Measure what actually decides an *authoritative* ceiling: is the fan-out's
   **origin set bounded** (a fixed roster of Adobe-owned origins → an origin-granularity
   ceiling could be authoritative, the middle granularity ADR-0006's open questions float) or
   **rotating** (partner domains chosen per-response → ceiling stays a FLOOR / advisory)?
   Observable: the origin set + a roster-stability assessment, feeding the enforcement verdict.
4. **Validity floor — a null result is not "narrow."** If the test org fired **zero** partner
   syncs, that **does not** satisfy the ACs as evidence of narrow egress — it is recorded as a
   **test-org-config artifact** (the R-004 single-host result ADR-0006 + 012-04 already flag as
   "a probe artifact, not evidence of narrowness"), and the fan-out is scoped as a **lower
   bound / mechanism**, explicitly barring the enforcement design from reading the count as
   ceiling cardinality. The breadth + confinement/ceiling verdict land in the Findings, update
   012-04 Axis-1, + `docs/refinement-todo.md`.

**DoD:**
- [ ] **The true fan-out is captured via a real-DOM main-thread reference run over the full
      live chain** (multi-hop) — *not* a chamber-only or single-response run — and fixtured
      redacted; classification/enumeration then run creds-free on the fixture.
- [ ] **Validity floor (un-waivable):** a **zero-sync** test-org result is recorded as a config
      artifact + lower-bound, **never** as evidence of narrow egress; test-org-vs-production
      divergence is named as a measurement-validity risk; the enforcement design is barred from
      reading the test-org count as ceiling cardinality.
- [ ] Each captured sync is tagged **confined / escaped / shim-swallowed**, and any
      escape/swallow is called out as a confinement-gap / false-negative risk.
- [ ] Spike-light review: compliance + craft recorded pass.
- [ ] Deviation log + reconciliation sweep under this slice heading.
- [ ] Characterization (012-04 Axis-1 live) + `docs/refinement-todo.md` updated with the
      fan-out (origin cardinality + roster stability) + the ceiling verdict.
- [ ] **No live identifiers committed** (redact captured URLs of ECIDs / demdex ids).

**Findings:** _Filled during IN_PROGRESS (once credentials land)._

**Outcome:** _Set at DONE — e.g. `real fan-out (real-DOM reference run) = interact + N
multi-hop demdex/AAM origins; M confined / P escaped / Q shim-swallowed; origin-set
[bounded|rotating] → endpoint-ceiling is [authoritative-at-origin|a FLOOR]; test-org
destination coverage [representative|null → lower-bound]; input to MVP3 endpoint enforcement
recorded`._

**Anti-horizontal-phasing check:** after this slice, MVP3's endpoint-ceiling enforcement has
the **real** egress breadth (origin cardinality + roster stability) to design against — not
the stub's single host — and knows whether any sync **escapes** confinement or is
**shim-swallowed** (a false-negative that would fire in a real DOM). Observable value: the
measured multi-hop fan-out + its confined/escaped/swallowed + ceiling verdict.
