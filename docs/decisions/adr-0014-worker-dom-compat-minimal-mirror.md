---
status: Proposed
dependencies: []
last_verified:
frame_review: true
---

# ADR-0014: Lever-2 compat layer: a minimal airlock-owned worker-dom mirror (Tier 0)

## Status

Proposed (2026-09-01)

## Context

airlock's performance thesis ([R-008](../research/R-008-costly-dom-martech-containment.md)) is to contain
costly-DOM martech (the INP/CWV killer). **Lever 1** (a scheduled DOM capability, [spec 023](../specs/023-dom-cost-containment-poc/spec.md))
is proven — naive INP p75 200 ms → airlock 16 ms — but only for tags **adapted** to airlock's capability
(chunkable work, run + scheduled on the main thread). The bulk of the martech long tail is **unmodified**
third-party tags whose vendors will not rewrite — that is **Lever 2**'s problem, and the reason a
*compatibility layer* is needed to run unmodified tags off the main thread.

The **worker-dom feasibility spike** ([spec 024](../specs/024-worker-dom-compat-spike/spec.md)) established the
ground truth: worker-dom's **async mutation-flush** model (a worker-side mirror DOM → `postMessage` → a
main-thread coordinator, frame-budgeted) needs **no SharedArrayBuffer**, so it is **[AD-4](../architecture.md)-compatible**
— unlike Partytown, whose sync-proxy *fast* path needs the cross-origin isolation AD-4 refuses ([R-003](../research/R-003-partytown-mechanism-check.md))
and whose default sync-XHR path is slow + main-thread-heavy. worker-dom **works** unmodified for
write/compute-heavy tags (computation off-thread; mutations async + budgeted) but **cannot** serve
**synchronous live-layout reads** (`getBoundingClientRect`/`offsetHeight`/`getComputedStyle` sync,
read-after-write) — and sharply, *layout-thrash*, a top INP offender, is in that won't-work-off-thread set.
`@ampproject/worker-dom@0.36` is pre-1.0, semi-maintained (AMP itself declining). This ADR decides **how** to
build the Lever-2 layer.

## Decision Options Considered

### Option A: Wrap `@ampproject/worker-dom`
- **Pros:** proven, full DOM-API surface, no build-from-scratch; the async/AD-4-compatible mechanism out of the box.
- **Cons:** pre-1.0 + semi-maintained (AMP declining) = a real dependency/supply-chain risk for a runtime whose value is governance; large surface (only *partial* `querySelector`); little control over the coverage; a heavy dependency against airlock's "vanilla ES modules, no framework in the core" ethos.

### Option B: Partytown (synchronous DOM proxy)
- **Pros:** actively maintained (2026); transparent *synchronous* DOM so unmodified tags "just work" including sync reads.
- **Cons:** its fast path needs SharedArrayBuffer + COOP/COEP — **AD-4 refuses** it (breaks cross-origin embeds, R-003); the default sync-XHR + service-worker path is slow and puts the servicing work back on the main thread. **Rejected** — conflicts with both AD-4 and the performance thesis.

### Option C (CHOSEN): a minimal airlock-owned worker-dom-style mirror
- **Pros:** airlock-owned → full control, minimal DOM subset, vanilla/minimal ethos, no semi-maintained dependency; async (`postMessage`, no SAB) → AD-4-preserving; **composes with Lever 1** (together they cover more than either alone — but see the honest coverage bound in the decision).
- **Cons:** real build effort — and the "minimal" DOM subset is **currently unbounded** (an open question below), so a minimal reimplementation can grow toward worker-dom's own size; a limited subset means some tags won't work (documented); the async model **cannot serve unmodified sync-read tags off-thread at all** (the Tier-0 gap). **Option A (wrap `@ampproject/worker-dom`) is not dismissed lightly** — it trades the maintenance risk for a proven, complete surface, and is the right call if the build-spec finds the minimal subset must grow large to be useful.

## Recommended Decision

Build a **minimal airlock-owned worker-dom mirror** as the Lever-2 compat layer, **Tier 0 only**:

1. **Async mutation-flush, no SAB (AD-4-preserving).** A small worker-side DOM mirror + a worker→main
   mutation-serialize channel + a main-thread **coordinator** that applies mutations **frame-budgeted** (the
   *intended*-INP-safe apply — **UNMEASURED**; the spike deferred that probe, see Assumptions). Plain
   `postMessage`; **no SharedArrayBuffer, no cross-origin isolation** — embeds intact.
2. **The levers compose over the space — with one acknowledged Tier-0 gap.** **Lever 1** (scheduled capability)
   contains any chunkable work on the main thread — including sync-reads/layout-thrash — **for tags *adapted* to
   airlock's capability** (connector-shaped). **Lever 2** (the mirror) contains **unmodified** *write/compute-
   heavy* tags off-thread. The genuinely-hard corner is **unmodified *sync-read* tags**: the async mirror
   cannot serve them, and Lever 1 needs adaptation — so under Tier 0 they are covered by **neither** lever
   automatically. Such a tag must be **adapted** (→ becomes a Lever-1 tag, no longer unmodified), or **awaits
   Tier 1** (SAB, off-thread), or runs unmodified + uncontained. This corner is stated as a **known Tier-0 gap
   Tier 1 closes**, not hidden.
3. **Scope, stated honestly.** WORKS off-thread (unmodified) = write/compute-heavy tags (INP contained via the
   mirror). Handled on the **main thread** = tags **adapted** to Lever 1 (any shape, incl. sync-read). **Tier-0
   GAP** = **unmodified** sync-read tags (adapt them, await Tier 1, or accept uncontained). WON'T-WORK-AT-ALL
   (documented) = tags needing their own `window`/sub-resource loads, or DOM APIs outside the minimal subset.
4. **Tier 1 (SAB) is DEFERRED — not built now.** A SharedArrayBuffer + `Atomics.wait` synchronous-read channel
   (Partytown's Atomics technique, scoped to *only* the sync-read APIs) would let the mirror serve sync-read
   tags **off-thread too** — but it is gated on the page being `crossOriginIsolated` (COOP+COEP), which is a
   page-wide, embed-constraining, **opt-in** state. It re-touches AD-4 (isolation becomes an opt-in tier, not
   the refused *requirement*), only helps the embed-light/first-party minority, and carries per-call
   round-trip cost — and for the pages that opt in, it **re-incurs exactly the cross-origin embed breakage
   AD-4 set out to avoid** (that is the price of the tier). Deferred to its own decision when a real isolatable
   customer needs sync-read tags off-thread ([refinement-todo](../refinement-todo.md) tracks it).
5. **Coverage — the honest bound (frame-critique, do not gloss).** Tier 0's off-thread win is the **unmodified
   write/compute-heavy** slice only. Because the *worst and most common* costly-DOM tags are
   **sync-read/measurement-driven** — layout-thrash (the top INP offender), viewability/position measurement,
   `querySelectorAll`-heavy traversal — and those are the **Tier-0 gap**, **Tier 0 alone may contain a
   MINORITY of real costly tags, not "most."** The full costly-DOM story needs *all three*: Lever 1 for
   *adapted* tags (incl. the **unbuilt** batched-read capability, 023-02), Tier 0 for unmodified write/compute,
   and Tier 1 (SAB, deferred) for unmodified sync-read. **Building Tier 0 now is one honest piece, not the
   whole win** — its standalone value is bounded and should be validated (a DOM-cost-shaped corpus, not just
   R-007) before over-investing.

## Consequences

**Becomes easier:**
- An **AD-4-preserving** Lever-2 compat layer for unmodified write/compute-heavy tags — a real, missing piece of the long-tail story (bounded, not "most" — see the coverage bound above), composing with Lever 1.
- airlock **owns** the mirror: minimal surface, full control of the DOM subset, no dependency on a pre-1.0/declining library; consistent with the vanilla/minimal ethos.
- A clear **tiered path** — Tier 0 ships now; SAB (Tier 1) is a named, opt-in future enhancement rather than a silent AD-4 breach.

**Becomes harder:**
- Building a DOM mirror + a mutation-serialize protocol + a frame-budgeting coordinator is real work (a downstream build-spec, whose first AC is the spike's deferred INP integration probe).
- The **minimal DOM subset** means some tags won't work — an ongoing coverage-vs-surface tension airlock now owns.
- **Unmodified sync-read tags** get **no containment** under Tier 0 (the async mirror can't serve them; Lever 1 needs adaptation — the acknowledged gap) until they are adapted to Lever 1 or Tier 1 (SAB) lands.

## Assumptions

- worker-dom's async model is AD-4-compatible (no SAB) — **grounded** (spec 024 spike, from worker-dom's README + arch/issue sources).
- The main-thread **mutation-apply is INP-safe under a heavy mutation burst** (the coordinator's frame-budgeting keeps the apply off the interaction path, so off-thread computation isn't just the long task *moved* to the apply) — **UNVALIDATED**. The spike deferred the only probe that would measure it (024-01 AC3); it is the build-spec's first probe. This is the decision's central unproven bet.
- The "adapt a sync-read tag to Lever 1" escape is **only partially grounded**: 023-01 proved main-thread scheduling contains INP for **one** fixture shape (chunkable per-element layout-thrash) and explicitly says nothing about the `querySelectorAll`-heavy / monolithic-sync flavors much sync-read martech takes (023-01 slice-01 §Findings); and the **batched-read capability** an arbitrary sync-read tag needs is **unbuilt** (023-02, deferred). So the escape hatch is itself gated on unbuilt work + chunkability, not a ready fallback.
- The **minimal** DOM mirror subset covers a **useful** slice of real write/compute-heavy tags — **assumption, not yet validated, and R-007 is the wrong yardstick for it**: R-007 is classified by *connector-fit*, not DOM-cost shape, and its clearly-costly-DOM members (FullStory/Clarity/LivePerson session-replay/heatmap/chat) are sync-read or excluded-by-mechanism. The build-spec needs a corpus classified by **DOM-cost shape** to show a real population of unmodified write/compute-heavy-*without*-sync-read tags exists — it may not, or may cut against this assumption.

## Kill criteria

- A DOM-cost-shaped-corpus probe shows either **(a)** too few real costly tags are unmodified-write/compute-*without*-sync-read (the "useful population" is a mirage — most costly tags are in the sync-read gap), or **(b)** those that qualify need DOM APIs the *minimal* mirror lacks (coverage too thin) → reconsider (wrap worker-dom, or don't build Tier 0 standalone before Lever-1's read capability / Tier 1).
- The async mutation-apply **re-tanks INP** under real mutation loads (the coordinator's frame-budgeting fails to keep the apply off the interaction path) → the off-thread win evaporates → reconsider the whole mirror.
- Lever-1-fallback proves insufficient — too many important tags need sync reads *and* can't be Lever-1-scheduled → **Tier 1 (SAB) is promoted from deferred to urgent**.

## Open questions

- The exact minimal DOM-API subset (elements/properties/methods) — the build-spec defines it, grounded against a **DOM-cost-shaped** tag corpus (R-007 is connector-fit-classified, not DOM-cost — the wrong yardstick here).
- The coordinator's frame-budgeting policy (batching/prioritisation under heavy mutation load).
- **Routing:** how a tag is assigned to Lever 2 (mirror, off-thread) vs Lever 1 (main-thread scheduled) — auto-detected (does it sync-read?) or declared per connector?
- The Tier-1 (SAB) trigger — what customer/page profile justifies building the opt-in isolated sync-read channel.
