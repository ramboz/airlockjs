---
status: Accepted
dependencies: [adr-0031, adr-0013, adr-0023]
last_verified: 2026-09-18
frame_review: true
---

# ADR-0032: Eager paint policy: no wait by default, `async`/`blocking` declared by page context, always bounded

## Status

Accepted (2026-09-18)

## Context

Most customers personalize or experiment on page heroes, so the hero decision must land in the eager window, and the
maintainer asked for two supported behaviours while waiting for a remote decision: a non-blocking "skeleton loader" and a
fully blocking hold, defaulting to non-blocking and switching to blocking on demand from page context (an EDS metadata
flag). Under [ADR-0031](./adr-0031-flicker-by-construction-invariant.md) the third option — paint default content and swap
later — is not available as a default, which leaves exactly these two paint policies and one question: what the default
is, how the switch is declared, and what bounds it.

There are really **two** decisions hiding in "the mode": *whether to wait at all* on this pageview, and *how the hero
looks while waiting*. The first is the expensive one, and it is paid **per pageview**: a placement declared once in
`boot(config)` matches the hero selector on every page that has one (`adapters/eds/reserve-personalization.js:43-53`), so a
"wait whenever a placement is declared" default would charge min(decision RTT, budget) of LCP to every pageview of every
such page — including the large majority where the vendor returns no hero proposition, since activities go live on the
marketer's schedule. The maintainer's stated default already encodes the answer: *"non-blocking, assuming there is no
hero personalization"* — i.e. **do not wait unless the page context says so**. On EDS "page context" is **authored
content, not code**: page metadata lives in the document, and a site's bulk-metadata sheet (`metadata.xlsx`) applies
metadata to URL patterns without touching pages — so the persona who launches the Target/AJO activity can also declare
the wait, by publishing a row, with no developer or redeploy in the loop. That does not make it automatic: a declared wait
is still a human step, and this ADR must be honest about what happens to exposure on a page nobody declared.

Three facts from [R-012](../research/R-012-personalization-experimentation-runtime.md) and the boilerplate shape the
second decision. (1) A skeleton is not an LCP candidate, so **both waiting policies pay LCP for the decision**; skeleton
buys perceived responsiveness and, where the first viewport has other content (header/nav), FCP — on a hero-only first
section FCP moves too. (2) In the current boilerplate the hero's reveal is **not** `body.appear`: sections are
`display:none` from `decorateSections` (`probes/eds-testbed/scripts/aem.js:485`), `appear` is added *before* the first
section loads (`scripts.js:196-198`), and the hero section is revealed by `loadSection(first, waitForFirstImage)` once
its blocks and the **default** hero image have loaded (`aem.js:648-650`). So the hero boundary is the first section's
`loaded` transition, and image serialization matters: under a skeleton the variant image is fetched only after the fill,
while under a blocking hold `waitForFirstImage` awaits the variant image itself — blocking can *win* LCP when the variant
carries a new image unless the variant image is preloaded as soon as the decision lands. (3) The industry default —
Adobe's prehiding snippet, aem-martech's non-optimized path — hides `body` for up to 3000 ms and reveals, coupling the paint
decision to the fetch and hiding the LCP cost in a snippet constant. Airlock's primitives: `reserveSpace` sizes and
prehides a single placement before paint (`adapters/eds/dom.js:224-228`), the eager chunk is Worker-free by build
assertion, and the seal already degrades personalization under pending consent (ADR-0013, `core/wrapped-sdk-host.js:337-360`).

## Decision Options Considered

### Option A: Wait by default on any declared placement (blocking, or skeleton, site-wide)
- **Pros:** never shows anything but the chosen experience where an activity is live; zero page authoring.
- **Cons:** every pageview of every page matching a declared placement pays min(RTT, budget) of LCP, **including the
  majority with no live hero activity**; the cost is invisible to the developer and paid on the marketer's schedule. This
  con applies to a site-wide `skeleton` default exactly as it applies to `blocking`.

### Option A′: Derive the wait decision from a per-browser runtime signal instead of page context
- **Pros:** no human step.
- **Cons:** there is **no pre-response vendor signal** ("is a hero activity live for this URL") on the Web SDK — the only
  per-browser signals come *after* a response: a proposition targeting the hero, or a decision already cached for this
  URL. A per-browser memory therefore upgrades **returning visitors only**; every *new* visitor's first view stays
  suppressed, which is a **systematic returning-visitor exposure skew** — for an experiment that is an invalid test, not a
  delayed one. Kept only as a UX complement (cache hit → no wait needed), **never as the mechanism that decides exposure**.

### Option A″: A site-level "activity manifest" as the primary wait signal
- The site publishes a per-URL(-pattern) manifest of live hero activities — sourced from the Target Activities / AJO
  campaigns admin APIs at build time, or aggregated from airlock's own exposure sink, or authored (which collapses into the
  bulk-metadata sheet of Option C) — and the eager module reads it (inline, or the tier-0 edge injection path).
- **Pros:** decides the first visit for **every** visitor with no per-page human step; no exposure skew.
- **Cons:** needs a build/edge job or a backend the adopter owns; API credentials; freshness lag. **Not required for this
  ADR**: the manifest is *a source for the same declaration* page context carries, so Option C's resolver accepts it as
  an input without changing the decision. Recorded as the planned automation of the declaration, not an alternative to it.

### Option B: Default-first (paint control, swap later)
- **Pros:** protects LCP (a same-size swap does not move it); zero hold.
- **Cons:** the swap is the flicker customers refuse — **rejected by ADR-0031 as a default**.

### Option C (chosen): no wait unless the page context declares it; `async` (skeleton) and `blocking` as declared waits, both bounded; a site-level manifest as an optional declaration source; fetch decoupled from paint
- **Pros:** pages without a declared hero activity pay **nothing** (the decision still fetches, and still applies to
  placements marked `initialViewport: false` — never to `initialViewport: true` ones, rule 2 — per ADR-0031); the LCP cost of a wait is a *declared* budget per page/placement rather than a snippet
  constant; the developer/marketer chooses `async` vs `blocking` only where the hero warrants it; a cache hit removes the
  wait and the per-URL memory can upgrade later visits automatically; the request fires identically in every mode, so
  changing a page's policy never changes *when* the decision lands, only what the user sees meanwhile.
- **Cons:** a page whose hero activity went live **without a declaration** shows default content to everyone until the
  declaration is published — deterministically, even for visitors whose decision arrived early (a loud diagnostic and an
  `Undeclared` suppression make this visible); authors must mark below-fold placements `initialViewport: false` or they
  are withheld under `off` too (conservative default); three modes to test; skeleton CSS is the project's to draw; the hero boundary must follow the
  boilerplate's section reveal, not `appear`; under `off` the eager module must **not** reserve/prehide the placement.

## Recommended Decision

**Option C**, with these rules:

1. **Mode is a paint policy, not a fetch policy.** The decision request (ADR-0034) fires whenever a placement is
   declared for the page, **in every mode including `off`** — it replaces the lazy interact, so it adds no server calls —
   and a declared placement is a *registry entry* (where content may land), never by itself a reason to wait. ADR-0034
   rule 1 is bound by this.
2. **Default is `off` = no wait, no reserve, no prehide, and no hero apply.** With no page-context declaration the eager
   module does **not** call `reserveSpace` for that placement (the shipped `reservePersonalization` prehides with a 3000 ms
   backstop by default — under `off` that path is skipped), so the hero paints its default at its normal section reveal.
   **An `initialViewport` placement is never applied under `off`, even when its decision is already in hand before its
   boundary** (head fetch won the race, or a cached/prefetched decision). `initialViewport` is a **per-placement registry
   attribute** that **extends** ADR-0033's placement registry (its field list is illustrative; the extension is recorded
   here rather than by amending the accepted ADR — author-declared, **default `true`** so an undeclared placement is
   treated conservatively, authors mark below-fold placements `false`) — deliberately *not* a per-view geometry result: a
   fold-straddling placement classified by viewport height would be suppressed on tall desktop viewports and applied on
   short mobile ones, a device-class confound that is itself a per-browser signal deciding exposure (rule 4). ADR-0031's
   synchronous geometry check remains the **freeze/boundary mechanism only**; it never decides policy. Applying an
   `initialViewport` placement only when its decision happens to be early would expose warm, fast and returning visitors
   and suppress the rest — the same speed-correlated skew that disqualifies Option A′ — so instead it is frozen at its
   boundary and reported with `propositionSuppressDisplay(reason: "Undeclared")` (distinct from `Timeout`), and a **loud
   diagnostic** ("proposition received for an `initialViewport` placement on a page without a wait declaration", 028
   inspector + console) tells the site to declare the page — on every device, since the classification is
   device-independent. Under `off`, `initialViewport` exposure is **deterministically zero**, for everyone, and *the
   declaration is what turns it on*. Placements marked `initialViewport: false` still apply opportunistically at their
   boundary (ADR-0031 rule 1) with the measured `Timeout`/missing skew, and an undeclared-page apply of such a placement
   is counted (`pzn_applied_undeclared`) so the site can see it. An adopter who wants opportunistic `initialViewport`
   application declares `async` with `personalization-timeout | 0` — "apply if in hand at the boundary, else default, no
   hold" — accepting the skew explicitly.
3. **Declared waits.** In precedence order: a config hook `mode: (doc) => 'off'|'async'|'blocking'`, whose default
   implementation reads the placement's section metadata (`personalization | async|blocking`,
   `personalization-timeout | <ms>`) — `airlockEager(doc)` is pinned **after `decorateMain` and before `body.appear` /
   the first `loadSection`**, where the shipped reserve already runs (`probes/eds-testbed/scripts/scripts.js:177→186`),
   because the upstream boilerplate's hero is an **auto-block built inside `decorateMain`** (`buildHeroBlock` in
   `buildAutoBlocks`), so a hero selector matches nothing earlier and `reserveSpace` would reject. At that position the
   upstream `decorateSections` has materialized section metadata as `section.dataset.*` (and removed the raw block), so
   `data-personalization` / `data-personalization-timeout` is the **primary** read; the raw `.section-metadata` block is
   the fallback for trimmed boilerplates that do not process it (the testbed's `aem.js:469-487`) — then page metadata
   (`<meta name="personalization" content="off|async|blocking">`, authorable per page or by URL pattern via the site's
   bulk-metadata sheet), then an optional **site-level activity manifest** (Option A″) when the adopter provides one.
   `async` = **skeleton**: the placement is prehidden/sized by `reserveSpace`, exposes `data-airlock-pending`, the
   project's CSS draws the skeleton, and the rest of the page paints. `blocking` = hold the **hero section's reveal** for
   that pageview. Mechanically the hold is applied **inside the first section's load callback** — the boilerplate's
   `loadSection(first, loadCallback)` awaits the callback *after* the section's blocks have loaded and *before* it clears
   `display` (`aem.js:648-650`) — so the hero block's JS/CSS and default image load **overlap** the decision round trip
   instead of serialising behind it (holding `body.appear` would coincide in what the user sees but would push all of
   that work behind the RTT, hiding a cost `lcp_hold_ms` cannot measure). Holding `appear` is the fallback only for
   boilerplates without a section load callback. A
   placement's `prehideSelector` may narrow the hidden region to the smallest node that can change, so an unchanged hero
   image can still be the LCP candidate.
4. **Per-browser signals never decide exposure.** A decision already cached for this URL (ADR-0035) makes a *declared*
   wait unnecessary (zero-latency apply) but does **not** unlock a hero apply under `off` (rule 2). A per-browser "this
   page served a hero proposition before" memory is **not** used to upgrade `off` → `async`, because it would expose
   returning visitors only (Option A′). The declaration — page metadata, bulk-metadata row, or manifest — is the only
   thing that turns waiting, and therefore hero exposure, on.
5. **Always bounded.** Both waits carry a per-placement budget (default TBD by the head-fetch probe; aem-martech uses
   1000 ms, Adobe's snippet 3000 ms). At timeout the placement's default is revealed (prehide lifted); the **freeze**
   happens at the ADR-0031 boundary — the later of the section reveal and that content reveal — after which ADR-0031's
   suppress-or-count rule applies.
6. **Variant image preload.** When a decision lands under either wait, airlock preloads the image(s) in the winning
   content before/with the fill so the variant image does not serialize behind the default image; under `blocking` the
   section's `waitForFirstImage` then awaits the variant image naturally.
7. **Waits yield to consent.** If the `personalization` purpose is pending or denied for this pageview, any declared wait
   degrades to `off` (alloy's own consent-flicker behaviour). A hero never waits on the CMP. Suppressions on such a
   degraded pageview carry reason `Consent` (ADR-0031 rule 3), not `Undeclared` — the page *is* declared.
8. **Prerendering forces `blocking`** (`document.prerendering === true`) on pages with a declared placement: the hold is
   free while nobody is watching; on activation before the decision lands, fall back to the declared mode with the
   remaining budget (mechanics in ADR-0035).
9. **One integration call** in the customer's eager phase, placed after `decorateMain` (rule 3): `airlockEager(doc)`
   resolves the mode and reserves/prehides declared placements, returning immediately in every mode; under `blocking` it
   also returns a **hold** the site passes into the first section's load callback (e.g.
   `loadSection(first, (s) => Promise.all([waitForFirstImage(s), hold]))`), which resolves on decision or budget expiry.
   The head fetch itself is a separate inline `<head>` snippet (ADR-0034) so it is not delayed by decoration. The eager
   chunk stays build-asserted free of `createAirlock` and `Worker`.
10. **Measure the trade:** emit `lcp_hold_ms` (time the hero reveal was held *beyond* what its own blocks/image needed —
    the load-callback placement makes this the marginal cost), the suppression rate and the missing-decision rate per
    placement through the normal exposure sink, so a page moves to `async`/`blocking` on evidence.

## Consequences

**Becomes easier:**
- Pages with no live hero activity cost nothing; a developer can see, per page, what a wait costs in LCP and choose
  `async` or `blocking` where the hero justifies it.
- The runtime can add faster decision tiers (ADR-0034/0035) without changing any page's declared policy.
- Consent and prerender interplay are rules of the mode resolver, not scattered special cases.

**Becomes harder:**
- Metadata names (`personalization`, `personalization-timeout`) become adopter-facing surface — renaming later is a
  breaking change under ADR-0017 once the surface leaves the experimental carve-out.
- Projects must author skeleton CSS (airlock ships only state attributes and sizing).
- A hero activity launched on an **undeclared** page is shown to nobody until the declaration is published (authored
  content on EDS, so the launching persona can do it, but it is a step) — including visitors whose decision was in hand
  early; those are suppressed with reason `Undeclared`, so the vendor sees a clean zero, not a skewed cohort — and the
  rule covers every `initialViewport` placement by a device-independent registry attribute, not a positional hero and
  not a per-view geometry result. Placements marked `initialViewport: false` on an undeclared page carry the measured
  `Timeout`/missing skew and are counted. The diagnostic and the optional manifest (A″) are the remedies.
- The hero boundary is boilerplate-version-dependent (section reveal vs `appear`); the eager module must detect which.

## Assumptions

- **A skeleton/prehidden hero is not an LCP candidate; FCP fires from other first-viewport content when there is any** —
  same grounding and caveat as ADR-0031 (documented LCP rules, not yet probed on the testbed).
- **The hero's reveal in the current boilerplate is the first section's `loaded` transition after `waitForFirstImage`,
  and `appear` precedes it** — grounded in `probes/eds-testbed/scripts/aem.js:485,648-650` and `scripts.js:196-198`; the
  blocking primitive is therefore "delay that reveal", with `appear` as the fallback boundary for older boilerplates.
- **Preloading the variant image at decision time removes its serialization behind the default image** — plausible from
  resource-loading semantics; **unmeasured**; the head-fetch probe should include an image-bearing variant.
- **Chrome reports LCP for prerendered pages relative to `activationStart`** (web.dev "Prerender pages in Chrome";
  `web-vitals` subtracts it) — documented, not probed; ADR-0035's probe covers it.

## Kill criteria

- Field data shows `async` pages losing LCP to the point customers prefer a swap — the owner re-decides the
  default-first ban (ADR-0031) explicitly; this ADR does not.
- The `off` default leaves newly live hero activities unseen for too long in practice (declarations lag launches) — make
  the site-level activity manifest (A″) the shipped default source rather than optional, or supersede toward
  wait-by-default scoped to per-page-declared placements. Never promote a per-browser memory to decide exposure.
- A vendor ships a pre-response "activity live for URL" signal — it becomes the manifest's source; no supersession needed.

## Open questions

- Default budget value per wait mode — set by the head-fetch race probe (ADR-0034), not by copying a vendor constant.
- The activity manifest (A″): format, freshness, and whether MVP10 ships a reference build-time job against the Target
  Activities / AJO admin APIs or leaves it to adopters.
- Whether section-metadata-discovered placements should infer `initialViewport` from section position (first section →
  `true`) or always require the attribute.
- The exact diagnostic surface for "hero proposition on a no-wait page" (028 inspector record + console).
- Is skeleton-then-content perceived as "flicker" by marketers? (Feeds ADR-0031's first kill criterion.)
