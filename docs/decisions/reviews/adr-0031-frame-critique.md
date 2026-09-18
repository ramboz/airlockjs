---
adr: 0031
pass: frame-critique
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-09-18T16:51:49Z
prompt_source: review.py frame-critique docs/decisions/adr-0031-flicker-by-construction-invariant.md
---

Frame-critique pass on **ADR-0031** — seven rounds, reviewer `jig:reviewer`, prompt built via
`review.py frame-critique docs/decisions/adr-0031-flicker-by-construction-invariant.md`.

**Round 1 (cold read) — needs-changes.** (a) "Visible" was operationalized as "no longer `display:none`", which freezes an
off-screen `loaded` lazy block and makes the decision race block-load time instead of the user's scroll. (b) A decision that
never arrives has no proposition ids to suppress, so Option C collapsed to Option B's silent loss there.
**Resolution:** "visible" = the placement's content painted in the user's viewport; boundary = first viewport intersection
(IntersectionObserver + `rootMargin` lookahead) for lazy blocks; never-arrived decisions counted airlock-side
(`pzn_decision_missing`); the differential-bias claim narrowed, not eliminated.

**Round 2 — needs-changes.** (1) The hero boundary was `body.appear`; the boilerplate adds `appear` *before* the first section
loads (`scripts.js:196-198`) and reveals the hero section at `loaded` after `waitForFirstImage` (`aem.js:648-650`); as written
the hero would freeze at section reveal and kill ADR-0032's skeleton mode. (2) IO delivery is post-paint, so a section that
becomes `loaded` while already near the viewport had a one-frame post-paint mutable window. (3) A raw `MutationRecord` rig gate
would be red for non-airlock reasons. (4) Consequences understated who sees default.
**Resolution:** a prehidden/skeleton placement is not visible regardless of section state; hero boundary = later of section
reveal and the placement's own content reveal; a synchronous geometry check at the section's `loaded` callback makes the
boundary "now" when already within viewport+lookahead; the rig gate is attributed to airlock's write path (refusal
diagnostic + inert decorate-free placement + non-vacuity control).

**Rounds 3–6 — needs-changes (converging).** The `off`-mode hero question surfaced (three ADRs stated three outcomes) and
was decided: under ADR-0032 `off` an `initialViewport` placement is never written even with the decision in hand, reported
`SuppressDisplay(reason: "Undeclared")` regardless of arrival time; `async` + zero budget is the explicit opportunistic
declaration. The rationale was restated as a product default ("airlock never defaults an `initialViewport` placement into a
network race the adopter did not opt into"), not an absolute, so it no longer contradicts rule 1's measured skew for other
placements. A per-view geometry classification was rejected (device-class confound: withheld on tall viewports, applied on
short ones) in favour of a device-independent per-placement registry attribute `initialViewport` (default `true`), with
the geometry check kept as the freeze mechanism only. The later-of boundary was extended to any prehidden/skeleton
placement; the geometry check pinned to the section's `loaded` (block-`loaded` sections are still `display:none`).

**Round 7 (final) — pass.** The invariant is enforceable by construction (MO microtask before the rendering opportunity;
`aem.js:649-650` restores `display` in the same task as the attribute flip; IO lookahead for off-screen). Four
consistency nits applied post-verdict: `initialViewport` stated as an *extension* of ADR-0033's illustrative registry (0031
+ 0032); the `Consent` reason scoped to the cached-decision / pending→granted path and noted as held at the seal until
granted (ADR-0023); `Timeout` defined as "missed its boundary"; hidden-tab (`visibilityState === "hidden"`) recorded as an
open question. Reviewer's non-blocking note for field data: opportunistic apply would restrict exposure symmetrically across
arms, so the deterministic-zero default is the trade most likely to be revisited — covered by ADR-0032's kill criterion.

VERDICT: **pass**.
