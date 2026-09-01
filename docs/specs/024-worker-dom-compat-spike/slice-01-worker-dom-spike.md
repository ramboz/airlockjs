---
status: DRAFT
dependencies: []
last_verified: 2026-09-01
frame_review: false
kind: spike
---

<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about
     runnable surfaces by probe first (run it / read source) or a citation. -->

## Slice 024-01 — worker-dom feasibility spike (POC-B)

**Question:** Is worker-dom a viable **AD-4-compatible** compatibility layer for airlock — can an *unmodified*
costly-DOM tag run in a chamber against its virtual DOM (computation off-thread, mutations serialized + frame-
budgeted onto the main thread), **containing INP** where Lever 1 can't, and what is the documented
**"works / won't work"** set (the sync-read boundary)?

**Time-box:** 1 day — grounding worker-dom's mechanism/limits + mapping the works/won't-work set against real
tags + a minimal INP probe. If the probe balloons (a full mirror integration), stop at the grounded
works/won't-work map + a build/no-build recommendation; the *build* is a downstream spec, not this spike.

**Goal:** Reduce the uncertainty on Lever 2 enough to decide (an ADR): adopt worker-dom as airlock's short-term
compat layer, or not — with the limits documented so a "won't work" tag is a known, not a surprise.

**DoR:**
- ✅ [R-008](../../research/R-008-costly-dom-martech-containment.md) frames Lever 2; POC-A (023-01) landed its
  scoreboard (this spike's trigger). [R-003](../../research/R-003-partytown-mechanism-check.md) + AD-4 already
  rule out Partytown's SAB fast path — the reason worker-dom (async, no SAB) is the candidate.
- ✅ worker-dom is installable (`@ampproject/worker-dom@0.36.0`); [R-007](../../research/R-007-real-prod-stack-breadth.md)
  is the real-tag corpus to test the works/won't-work set against.

**Acceptance Criteria (a spike's ACs are the investigation, not shipped behavior):**

1. **Ground worker-dom's mechanism + AD-4-compatibility.** From its source/docs: confirm mutations flush
   **async** (no SharedArrayBuffer / no `crossOriginIsolated` dependency — the AD-4 fit), the coordinator's
   frame-budgeting, and how a worker script is booted + fed the initial DOM. Record it (cite).
2. **Map the "works / won't work" set** — the load-bearing output. Enumerate what a worker-dom mirror can and
   cannot support (esp. the **sync-read** boundary: `getBoundingClientRect`/`offsetHeight`/read-after-write,
   sync storage, focus, own sub-resource loads), tested against a few [R-007] real-stack tag *shapes* + the
   023-01 nasty tag. The honest set — including the "just won't work" tags — is the deliverable.
3. **Minimal INP probe (if it fits the box).** Run a costly *unmodified* tag off-thread in worker-dom and
   measure INP the 023-01 way (Event-Timing within-storm p75) — does off-thread execution contain INP, **and**
   does the main-thread mutation-apply not simply re-tank it (the coordinator's budgeting is the thing to
   verify)? A number, or an honest "couldn't get a clean number in the box + why."

**DoD (spike close-out):**
- [ ] **Findings** filled (mechanism grounded; the works/won't-work map; the probe number or why-not).
- [ ] **Outcome** set (`ADR-NNNN created` for the build/no-build decision, or `abandoned (reason)` if
      worker-dom is infeasible for airlock). Promote to R-008 + refinement-todo.
- [ ] Probe code under `probes/` (per R-008); no live identifiers (synthetic / public tags only).

**Findings:** _(filled during IN_PROGRESS)_

**Outcome:** _(set at DONE — `ADR-NNNN created` / downstream spec unblocked / `abandoned (reason)`)_

**Anti-horizontal-phasing check:** a spike is exempt (it ships *knowledge*, not a user-facing layer) — but the
knowledge is decision-shaped: the works/won't-work map + a build/no-build call, not open-ended research.
