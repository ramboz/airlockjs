---
adr: 0032
pass: frame-critique
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-09-18T16:52:43Z
prompt_source: review.py frame-critique docs/decisions/adr-0032-eager-paint-policy-and-flag.md
---

Frame-critique pass on **ADR-0032** — six rounds, reviewer `jig:reviewer`, prompt built via
`review.py frame-critique docs/decisions/adr-0032-eager-paint-policy-and-flag.md`.

**Round 1 (cold read) — needs-changes.** (a) A site-wide "wait whenever a placement is declared" `skeleton` default would
charge min(RTT, budget) of LCP to every pageview matching the hero selector, including pages with no live activity; no
runtime/vendor-signal option was considered. (b) The hero boundary was `body.appear`; in the boilerplate `appear` precedes the
first section's reveal at `loaded` after `waitForFirstImage`, and LCP is not equal between modes when the variant carries a
new image (serialisation behind the default image).
**Resolution:** default flipped to `off` = no wait; Option A′ (runtime signal) added and bounded; boundary re-grounded to the
section reveal; variant-image preload rule added; title changed.

**Round 2 — needs-changes.** An `off` default whose only upgrade is a per-browser memory exposes returning visitors only
(invalid experiment); ADR-0034 rule 1 ("off → no fetch") contradicted "mode is a paint policy, not a fetch policy"; "paints
default immediately" was false because the shipped reserve prehides by default; stale "skeleton default" references; the
testbed's `decorateSections` does not materialize section metadata.
**Resolution:** per-browser memory ruled out as an exposure mechanism; Option A″ (site-level activity manifest from the
Target/AJO admin APIs) added as the planned automation of the declaration; ADR-0034 rule 1 aligned (fetch in every mode);
`off` = no reserve/no prehide; references fixed; page context reframed as authored content (page metadata / bulk-metadata sheet).

**Round 3 — needs-changes.** Under `off` the head fetch/cache could still land a hero decision pre-reveal, so "shown to
nobody" was false (speed-correlated skew); the section-metadata justification was wrong and the resolver's position vs
`decorateMain` unpinned. **Resolution:** a hero proposition is never applied under `off` even when in hand
(`SuppressDisplay(reason: "Undeclared")`), cached decisions do not unlock it, `async` + zero budget is the explicit
opportunistic declaration; `airlockEager` pinned after `decorateMain` (upstream hero is an auto-block) with `section.dataset.*`
primary and the raw block as fallback.

**Round 4 — needs-changes.** The `Undeclared` rule was scoped to a positional "hero" while ADR-0031's geometry check put any
initial-viewport placement on an apply-if-in-hand path. **Resolution:** scoped to initial-viewport placements.

**Round 5 — needs-changes.** A per-view geometry classification is a device-class confound (withheld on tall viewports,
applied on short ones) and itself a per-browser signal deciding exposure, contradicting rule 4; "what does `blocking` hold"
was ambiguous. **Resolution:** `initialViewport` made a device-independent per-placement registry attribute (default `true`;
extends ADR-0033's illustrative registry), geometry check kept as freeze mechanism only, undeclared-page applies of
`initialViewport:false` counted; timeout freeze deferred to the ADR-0031 boundary; `Consent` suppression reason added.

**Round 6 (final) — pass.** Frame survives: device-independent, author-declared gating yields deterministic zero `off`
exposure without a device or latency confound; reasons `Timeout`/`Undeclared`/`Consent` are disjoint. Two nits applied
post-verdict: `blocking` is now applied inside the first section's **load callback** (so block JS/CSS and the default image
overlap the decision RTT instead of serialising behind it; holding `appear` is the fallback), with rule 9/10 reworded
accordingly; the `initialViewport` extension of ADR-0033's (accepted, immutable) registry is tracked in refinement-todo with
the pinned contract schema as its home.

VERDICT: **pass**.
