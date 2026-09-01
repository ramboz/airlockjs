---
status: DONE
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
- [x] **Findings** filled (mechanism grounded + AD-4-compat confirmed; the works/won't-work map; the INP probe
      deferred to the build-spec per the time-box, with why).
- [x] **Outcome** set (ADR *recommended*, awaiting the maintainer's build/no-build call — not auto-created;
      worker-dom is viable for a real subset, not infeasible). Promoted to R-008 + refinement-todo.
- [x] No live identifiers (grounding only — public docs/sources; **no probe code this spike** — the INP
      integration probe is the downstream build-spec's first step, deferred per the 1-day time-box).

**Findings (2026-09-01 — grounded: worker-dom README + its arch/issue sources + the R-003/AD-4 corpus):**

- **Mechanism — async, postMessage, NO SharedArrayBuffer → AD-4-COMPATIBLE (the load-bearing confirmation).**
  worker-dom runs author JS in a Web Worker against a **mirror DOM**; a worker-side `MutationObserver`
  serializes mutations and **`postMessage`s** them to a main-thread coordinator that applies them (batched, and
  able to prioritise by frame budget — "retain main thread availability... by async updating elsewhere").
  Plain `postMessage`; **no SharedArrayBuffer / no COOP-COEP** (the README never mentions them; async-dom is the
  variant that uses SAB — worker-dom does not). So unlike Partytown (whose sync-proxy *fast* path needs exactly
  the cross-origin isolation [AD-4](../../architecture.md) refuses, per [R-003](../../research/R-003-partytown-mechanism-check.md)),
  **worker-dom needs none of it** — it is the AD-4-fit mechanism, and its async-mutation shape matches airlock's
  "capture on main, do the work behind the airlock" model.
- **Bootstrap API:** `upgradeElement(el, workerScriptUrl)` upgrades a `<div src="tag.js" id="…">`-marked
  element to run its script in the worker. Three builds ship (standard / amp-with-safety-hooks / debug).
- **THE load-bearing limit — the SYNC-READ boundary (confirmed).** An async mirror cannot answer a
  *synchronous* live-layout read. `getBoundingClientRect()` / `offsetWidth` / `offsetHeight` /
  `getComputedStyle()` called synchronously, and read-after-write, do not return live values. AMP's `amp-script`
  (the productionised worker-dom) **replaces** them with async Promise variants (`getBoundingClientRectAsync()`)
  — i.e. the tag must be **rewritten**, so it is no longer "unmodified." The only way to keep them synchronous
  is SharedArrayBuffer (async-dom's route) — **which AD-4 refuses.** `querySelector` has only partial support.
- **The works / won't-work map (the deliverable):**
  - **WORKS unmodified (INP contained):** write/compute-heavy tags — DOM injection/building, off-thread
    analytics computation, element manipulation — that do **not** synchronously read live layout. Computation
    runs off-thread; mutations flush async + frame-budgeted. A real, useful slice of the long tail.
  - **WON'T WORK unmodified:** sync-layout-read / measurement-driven tags (`getBoundingClientRect`/`offsetHeight`
    /`getComputedStyle` sync, read-after-write, focus/selection, sync storage, tags loading own sub-resources
    expecting a real `window`). They need rewriting (amp-script's async variants) or are incompatible.
  - **The irony (important + a bit sharp):** the WORST INP offenders — **layout-thrash** (write-then-sync-read,
    exactly the 023-01 nasty tag's `el.style=…; void el.offsetHeight`) — fall in worker-dom's **won't-work**
    set. So worker-dom and Lever 1 are **complementary, not overlapping**: Lever 1 (main-thread, *scheduled*)
    contains *adapted* layout-thrash; worker-dom moves *unmodified write/compute-heavy* tags off-thread. Neither
    is universal — together they cover more of the space than either alone.
- **worker-dom's own state (a risk to weigh):** `@ampproject/worker-dom@0.36.0` — pre-1.0, created 2018, last
  modified 2025; semi-maintained, and AMP itself is declining. Partytown (v0.10, actively maintained 2026) is
  the better-kept analog but is SAB-dependent (AD-4-refused). So the real choice is **wrap the semi-maintained
  @ampproject/worker-dom** vs **build a minimal airlock-owned mirror** of just the mutation-serialize +
  frame-budget-coordinator core (a small DOM subset, aligned with airlock's vanilla/minimal ethos + full
  control), *informed by* worker-dom's proven design.

**Outcome:** **ADR recommended (build/no-build) — not yet created; awaits the maintainer's call.** The spike is
CONCLUDED: worker-dom's async-mutation model is **viable + AD-4-compatible** as airlock's Lever-2 compat layer
for the **write/compute-heavy unmodified-tag subset**, with a real, documented **sync-read "won't work"**
boundary (and the sharp finding that layout-thrash is *in* that boundary — Lever 1's job, not Lever 2's). The
open decision for the ADR: **wrap `@ampproject/worker-dom` vs build a minimal airlock mirror** (leaning
minimal-mirror, given the pre-1.0/semi-maintained state + airlock's ethos). The confirming **INP probe** (an
unmodified write-heavy tag off-thread → contained INP with the mutation-apply staying frame-budgeted) is the
**downstream build-spec's first step**, deferred here per the 1-day time-box (a full worker-dom integration
would balloon the spike). Promote to R-008 + refinement-todo.

**Anti-horizontal-phasing check:** a spike is exempt (it ships *knowledge*, not a user-facing layer) — but the
knowledge is decision-shaped: the works/won't-work map + a build/no-build call, not open-ended research.

### Deviation log

- **AC3 (the INP probe) deferred, per the time-box — not dropped.** The 1-day box's own escape clause ("if the
  probe balloons... stop at the grounded map + a build/no-build recommendation") fired: a real
  `@ampproject/worker-dom` integration (build variant + `upgradeElement` bootstrap + a worker-dom-compatible
  write-heavy fixture + the Event-Timing harness) is a multi-hour build, disproportionate to a spike whose
  DECISION does not hinge on the number (the works/won't-work map + AD-4-compat already decide viability). The
  probe is named as the downstream **build-spec's first AC**, where a measured containment number belongs.
- **Grounding by citation, not executed probe (a spike-appropriate choice).** The runnable claims (mechanism,
  no-SAB, the sync-read boundary) are grounded from worker-dom's README + its arch/issue sources + amp-script's
  documented async-read replacements, not a local run. The one thing this leaves open — does `@ampproject/worker-dom@0.36`
  actually run cleanly in a modern chromium — is immaterial to the decision (if 0.36 is too stale, airlock
  builds the minimal mirror; the *model* is what the spike validated), and is the build-spec's probe to close.

### Reconciliation sweep

- **Question answered + Outcome set** (the spike's contract): viable + AD-4-compatible for the write/compute
  subset; sync-read is the won't-work boundary; ADR recommended (awaiting the maintainer — correctly not
  auto-created for a load-bearing architecture decision needing human acceptance).
- **Promoted, no orphans:** [R-008](../../research/R-008-costly-dom-martech-containment.md)'s Lever-2 hand-off
  updated to DONE-with-findings; [refinement-todo](../../refinement-todo.md)'s POC-B entry struck
  `DEFERRED` → `SPIKE CONCLUDED` with the now-pending ADR decision; the spec status board reflects 024-01.
- **Downstream named:** the ADR (build/no-build, wrap-vs-minimal-mirror) + the build-spec (whose first AC is
  the confirming INP integration probe). No dependency left dangling.
- **No live identifiers, no probe code, no new dependency** committed (worker-dom was inspected via npm
  metadata + public docs, not added to `package.json` — adoption is the ADR's call).
