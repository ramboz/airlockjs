---
status: Accepted
dependencies: [adr-0005, adr-0014, adr-0017]
last_verified: 2026-09-18
frame_review: true
---

# ADR-0031: Flicker-by-construction: a placement is never mutated once visible

## Status

Accepted (2026-09-18)

## Context

Visible content flicker is the number-one complaint EDS customers raise about personalization, and airlock's shipped
personalization path can still produce it. Today the only apply verb is `handle.fill(html)` into a pre-sized, prehidden
box (`adapters/eds/dom.js:174-256`): the reserve happens before `body.appear` (CLS-safe by construction, 033-03/034 rig
gates), but the **fill happens in the lazy phase, after paint**, behind a 3000 ms prehide backstop that **reveals and still
fills later** — the same reveal-then-apply-late behaviour as Adobe's `alloy-prehiding` snippet. aem-martech takes the
opposite stance (a 1 s bail-out that **silently abandons** the variant), and aem-experimentation avoids the problem only
because its decision is local and applied inside the hidden eager window (R-005).

The brainstorm captured in [R-012](../research/R-012-personalization-experimentation-runtime.md) settled the physics that
frames this decision: a prehidden or skeleton hero is **not an LCP candidate**, so for a remote (Target/AJO) decision
"no flicker" always costs LCP until the decision lands; the only non-blocking option that protects LCP is
**default-first** (paint control, swap a same-size variant later), and the maintainer ruled that out: *"a visible content
swap is a strong no-go."* What remains to decide is the invariant the apply engine is built around, and what happens at a
timeout. Airlock already has one structural invariant of this kind — reserve-before-`appear` makes layout stability a
property of the code path, not a discipline (AD-5). This ADR adds its flicker twin.

## Decision Options Considered

### Option A: Reveal on timeout, apply late (alloy snippet / current `fill` behaviour)
- **Pros:** every bucketed user eventually sees their variant; simplest to implement; parity with the vendor snippet.
- **Cons:** the late apply *is* the flicker customers complain about; after a long hold it is the worst of both worlds
  (blank, then default, then swap); the display notification reports a render the user experienced as a glitch.

### Option B: Reveal on timeout, abandon silently (aem-martech `personalizationTimedOut`)
- **Pros:** no flicker; trivial.
- **Cons:** the experiment loses those users **silently** — they were bucketed into a variant they never saw and nothing
  tells the vendor; lift and denominators drift with network conditions (the same differential-bias shape spec 005 found
  for lazy exposure).

### Option C (chosen): Never mutate a user-visible placement; atomic apply before first viewport intersection; suppress or count on timeout
- "Visible" means **the placement's content — default or variant — has been painted inside the user's viewport**. It is
  *not* "no longer `display:none`", and a **prehidden or skeleton placement is not visible regardless of its section's
  state** (what painted was a sized empty box, not content). A placement is therefore mutable while it is prehidden /
  skeleton, while its EDS section is still `display:none`, **and while it is rendered but has not yet intersected the
  viewport** — an off-screen lazy block that is `loaded` is not visible to anyone, and freezing it there would make the
  decision race block-load time instead of the user's scroll (a race the lazy worker tier loses on fast devices).
- The boundary is the **first in-viewport paint of content**: for a lazy block, first viewport intersection (an
  `IntersectionObserver` with a `rootMargin` lookahead, plus a synchronous geometry check at the `loaded` callback — see
  Recommended Decision); for any **prehidden/skeleton placement** — the hero under a declared wait, or any other
  placement declared `async`/`blocking` — the **later** of its section's reveal (for the hero in the current boilerplate
  the first section's `loaded` transition after `waitForFirstImage`, `probes/eds-testbed/scripts/aem.js:648-650`;
  `body.appear` in older boilerplates) and the placement's **own content reveal** — the moment its prehide/skeleton is
  lifted because the decision applied or the ADR-0032 budget expired.
- At the boundary: decision in hand → apply **atomically in one task** before the placement is painted in-viewport (never
  chunked across a paint); decision not in hand → reveal the default and **freeze** the placement. If the decision arrives
  late, emit `decisioning.propositionSuppressDisplay` with `propositionAction.reason: "Timeout"` carrying the proposition's
  exact `{id, scope, scopeDetails}`; if it **never arrives** (network failure, budget expired with no response) there is no
  proposition to name, so airlock emits its own per-placement `pzn_decision_missing` record to the exposure sink instead.
- **Pros:** flicker becomes impossible by construction and **rig-testable** (zero mutations on a placement after its first
  in-viewport paint, mirroring the reserve<`appear` gate); below-fold placements keep the whole scroll window to land
  their decision; the vendor keeps an honest denominator for the *late-arrival* case (suppressed ≠ displayed) and airlock
  counts the *never-arrived* case itself; both rates become the evidence customers use to tune budgets or opt into
  blocking (ADR-0032).
- **Cons:** a slow decision means a bucketed user sees default content for that view (accepted — it is the no-flicker
  trade the maintainer chose); a fast scroll that outruns the lookahead freezes a block before its decision applies; the
  existing 5 ms chunked apply (`adapters/eds/dom-apply.js`) must be bypassed for boundary applies; `SuppressDisplay` is
  used for a reason alloy does not emit today; the never-arrived loss is only visible airlock-side, so the
  differential-bias shape Option B suffers is **narrowed, not eliminated** — the remedy is decision latency (ADR-0034/0035).

## Recommended Decision

**Option C.** The invariant is stated as: *airlock never mutates a placement after the user could have seen it* —
operationally, after its first in-viewport paint. Concretely:

1. Both appliers write only to placements whose content is not yet user-visible: prehidden/skeleton, `display:none`, or
   rendered but not yet intersecting the viewport. For lazy blocks the **preferred** write point is the
   `MutationObserver` callback for the **section's** `data-section-status="loaded"` transition (a microtask before that
   frame paints — earliest and cheapest; not the block's `data-block-status`, which flips while the section is still
   `display:none` and every rect reads zero). In that same callback the applier performs **one synchronous geometry
   check** (the section's `display` was restored in the same task as the attribute flip, `aem.js:649-650`, so the
   geometry is live): if the placement already lies
   within the viewport plus the lookahead margin, **the boundary is now** (apply if in hand, else freeze) — because
   `IntersectionObserver` delivery is post-paint, a section that becomes `loaded` while already on or near the screen
   (the second section on a tall viewport) would otherwise paint default and then be mutable for one frame. Only a
   placement that is *off-screen beyond the lookahead* at `loaded` stays mutable until the observer reports it
   approaching. The geometry check applies to **unprehidden** placements only: for any **prehidden/skeleton** placement
   (the hero or another placement under a declared `async`/`blocking` wait) the boundary is the later of its section's
   reveal and its own content reveal (decision applied, or ADR-0032 budget expired) — a `visibility:hidden` box that has
   painted is not visible content by this ADR's definition, so it is never frozen at `loaded`.
2. At the boundary the apply is **atomic**: no `scheduler.chunk` across frames. Chunking remains for content that is not
   yet near the viewport and for bulk, non-placement work.
3. Boundary-without-decision is one rule for every mode: reveal default, freeze. A decision that then arrives is
   **suppressed** (`SuppressDisplay(reason: Timeout)` with its ids); a decision that never arrives is **counted** by
   airlock (`pzn_decision_missing`). There is no `apply-late` for anything the user could have seen. "Late" only exists
   for a placement still outside the viewport, which no user has seen.
   **Airlock never defaults an `initialViewport` placement into a network race the adopter did not opt into.** Every
   bounded apply carries *some* speed-correlated skew — whoever's decision misses the boundary sees default — and
   airlock's answer everywhere is to make that skew **measured and id-carrying** (`Timeout` suppressions,
   missing-decision counts) so the adopter can tune budgets or declare `blocking`. Placements the author marks
   **`initialViewport: true`** in the registry (ADR-0032 rule 2; default `true`, so below-fold placements are marked
   `false` explicitly — this attribute **extends** ADR-0033's placement registry, whose field list is illustrative; the
   extension is recorded here and in ADR-0032 rather than by amending the accepted ADR) are the one place this is *not*
   the default: they are the highest-stakes placements, their
   boundary on a cold view is decided by block/image load (which the head fetch is designed to lose cold and win warm),
   so an un-declared race there would skew hardest exactly where experiments matter most, before anyone has looked at a
   number. Under ADR-0032's `off` (no wait declared) the eager applier therefore does **not** write an `initialViewport`
   placement even when its decision is in hand before its boundary: `off` yields **deterministic zero `initialViewport`
   exposure**; every proposition for such a placement on an `off` page — whether in hand early or arriving after the
   boundary — is reported with `SuppressDisplay(reason: "Undeclared")` (never `Timeout`, which would tell the adopter to
   tune a budget that does not exist) plus the diagnostic. The designation is a **device-independent registry
   attribute, deliberately not a result of rule 1's geometry check**: a fold-straddling placement classified per view
   would be withheld on tall viewports and applied on short ones — a device-class exposure confound, systematic rather
   than latency-shaped. Rule 1's geometry check decides *when the boundary is*, never *whether policy applies*.
   **The declaration, not latency, is the gate:** a zero-latency source — a warm cache hit (ADR-0035) or edge-injected
   inline JSON (ADR-0034 Option D) — is *also* withheld from an `initialViewport` placement under `off`, even though no
   speed skew exists for it; that is a deliberate pure exposure loss so that "did this page expose its hero activity" has
   one answer across sources and devices. Two bookkeeping corollaries: an `initialViewport` placement on an `off` page
   whose decision *never* arrives emits **no** `pzn_decision_missing` (there is no budget to tune; only propositions that
   exist are reported, as `Undeclared`); and a pageview whose declared wait **degraded for pending/denied consent**
   (ADR-0032 rule 7) reports its suppressions with a third reason, `Consent`, so neither `Timeout` nor `Undeclared` is
   polluted by consent state. `Consent` is observable only on the narrow path where a proposition exists at all on such a
   pageview — a cached decision (ADR-0035) or a pending→granted transition that lets the lazy interact return one — and,
   being itself a decisioning notification, it is **held at the seal until the purpose is granted and never sent under
   denied** (ADR-0023's hold semantics), so the rig must exercise that path explicitly or the reason is vacuous.
   For clarity across all three reasons: **`Timeout` means "missed its boundary"** — the declared budget for a waited
   placement, or the scroll/lookahead window for an `initialViewport: false` one — not "a budget was configured".
   **Placements marked `initialViewport: false` do still apply under `off`** by rule 1 at their boundary — typically with
   the scroll window rather than the load window to land — and their residual skew is the measured `Timeout`/missing
   kind the adopter can read (an undeclared-page apply is counted, `pzn_applied_undeclared`). An adopter who *wants* the
   `initialViewport` race declares it: `async` with a zero budget ("apply if in hand at the boundary, else default, no
   hold") — a race becomes an explicitly accepted, measured cost of a declaration, not a default.
4. **Default-first is never a default.** A "stale-ok" cache policy (ADR-0035) renders a *cached* decision instantly and lets
   a revalidated one land on the **next** view — it never swaps the visible one.
5. The rig gains a **flicker-by-construction gate** attributed to airlock's write path, not to the DOM at large (EDS
   block JS, `data-block-status`, lazy `loading` attributes and `sampleRUM.enhance` all mutate blocks after reveal): the
   applier **refuses** any op targeting a placement it has frozen (drop + `pzn_frozen_write_refused` diagnostic), and the
   rig proves it by delivering a decision *after* the placement's content reveal and asserting (a) the refusal diagnostic
   fired, (b) the placement's content node (`data-airlock-filled` subtree) is byte-identical before/after — the rig's
   placement content is a **decorate-free, inert block** (no EDS block JS, no `decorateIcons` targets, no lazy `loading`
   flips) so that only airlock could have mutated it, and (b) is additionally scoped to the applier's own write markers —
   and (c) a control decision delivered *before* the reveal did apply (non-vacuity, the reserve gate's pattern). "Reveal"
   here is the placement's **content reveal** as defined above, never the bare section reveal.

## Consequences

**Becomes easier:**
- Selling "no flicker" as a structural property, not a snippet + timeout tuning exercise.
- Reasoning about every apply path: hidden → write → reveal, or reveal → never write.
- Honest experiment reporting: the suppression signal is queryable per placement and per reason.

**Becomes harder:**
- On an **undeclared** page (`off`) no `initialViewport` placement is personalized — deterministically, for everyone,
  on every device, regardless of whether the head fetch (ADR-0034) would have won the race — and ADR-0032's loud
  diagnostic makes that visible so the page gets declared; placements marked `initialViewport: false` do apply, with
  their (measured) `Timeout`/missing skew. On a
  **declared** page the users who see the default hero are those whose decision misses the budget; there the
  differential-bias shape is narrowed (late arrivals suppressed with ids, never-arrivals counted), and the mitigation is
  landing the decision earlier (ADR-0034/0035), never relaxing the invariant. Under an explicit `async` with a zero
  budget the adopter has accepted the hero race knowingly.
- The interpreter for Target `dom-action`s (spec work) must respect two apply regimes (atomic vs chunked).
- Any future SPA/view-change support must make a placement hidden again before re-personalizing it.

## Assumptions

- **Elements with `visibility: hidden`, `opacity: 0`, or a CSS-gradient/plain-background skeleton are not LCP candidates**
  (web.dev LCP definition; Chrome ignores `opacity: 0` and non-`url()` backgrounds) — grounded from the documented LCP
  candidate rules in R-012 §5, not from a probe on the testbed; the flicker-gate rig (spec work) should include an LCP
  read as a sanity check.
- **A `MutationObserver` callback runs as a microtask before the next rendering opportunity**, so a write triggered by the
  `data-section-status="loaded"` attribute change lands before that frame paints (HTML spec event-loop processing model;
  aem-martech relies on the same ordering).
- **`IntersectionObserver` callbacks are delivered in a task *after* the frame that computed the intersection is
  painted**, so a zero-`rootMargin` observer cannot gate a pre-paint write; the lookahead (`rootMargin`) is what buys the
  pre-visibility apply window, and a scroll faster than the lookahead freezes the block (counted, not swapped). From the
  Intersection Observer spec's "queue an intersection observer task"; the rig should measure the lookahead needed on the
  testbed.
- **`decisioning.propositionSuppressDisplay` is accepted by the Edge for AJO and Target propositions with a custom
  `reason`.** alloy emits it today only for a second in-app message (`reason: "Conflict"`). Whether Target A4T *reports*
  suppressions or merely omits the impression is **unverified** — tracked in refinement-todo; until confirmed the promise
  is "honest denominator + queryable in the data (CJA/any sink)", not "visible in Target reports".

## Kill criteria

- Marketers experience skeleton-then-content as "flicker" at a rate that makes ADR-0032's `async` (skeleton) wait
  unacceptable — then the *paint policy* moves (e.g. `blocking` becomes the recommended declaration), not this invariant.
- A vendor requires a post-visibility apply to count an impression (no suppress path) — revisit the suppress mechanism,
  keep the no-mutation rule.
- Suppression + missing-decision rates on real sites are so high that experiments cannot reach significance — the fix is
  decision latency (ADR-0034/0035), but if those cannot deliver, the owner re-decides the trade explicitly.
- Below-fold placements still lose the race against the viewport at a material rate even with the lookahead — revisit the
  boundary definition (e.g. a larger lookahead, or a per-placement "scroll-gated hold") before touching the invariant.

## Open questions

- Exact `propositionAction` shape for a timeout suppression (label/tokens) — confirm with the Target/AJO teams.
- Whether the rig's post-reveal control should be a `data-*` write or a text-node write (both are `MutationRecord`s).
- Default `rootMargin` lookahead for the lazy boundary, and whether it scales with scroll velocity.
- Cost of the synchronous geometry check at `loaded` (one forced layout per personalized section) — measure on the
  testbed; the section is being revealed in that frame anyway.
- Pages loaded in a hidden/background tab (`document.visibilityState === "hidden"`, not prerendering) get no rendering
  opportunities, so the geometry check would freeze an in-viewport placement nobody has seen; whether to defer the
  boundary to the first `visibilitychange` → visible (as ADR-0032 rule 8 does for prerender) is open.
