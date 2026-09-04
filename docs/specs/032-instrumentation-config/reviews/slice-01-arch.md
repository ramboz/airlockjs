---
slice: 032-01 — the config-driven `boot(config)`: connector dispatch + collapse the pixel-boot duplication
pass: arch
verdict: pass
reviewer: general-purpose (richer: arch-review)
reviewed_at: 2026-09-04T22:28:10Z
prompt_source: review.py arch-review docs/specs/032-instrumentation-config/spec.md 032-01 <deliverables> --richer-skill arch-review
substrate: non-interactive
---

VERDICT: pass

## Assessment (independent arch review, general-purpose reviewer, richer skill: arch-review)

A sound, coherent public authoring surface. The frame-critique correction — hoisting `window.airlock` ownership
into exactly two owners (`bootEdsAnalytics` + the `boot` composite) via `installOnWindow`, never the shared
`bootGa4Core` or a per-connector boot — is implemented exactly right, preserving 021-01's no-leak invariant
config-wide with no double-ownership. `bootGa4Core` extraction + `PIXEL_VENDORS` registry are genuine dedup
(byte-equivalent), not speculative generality; governance-per-class matches spec 022. **No blockers.**

## Strengths
- `window.airlock` factoring: `installOnWindow` is the single definition, called in exactly two places; `window.airlock =`
  appears nowhere else in `adapters/`/`core/`. Preserves 021-01 dispose-prior-on-reboot config-wide.
- `bootGa4Core` reused verbatim by the ga4 config entry → GA4's rich wiring can't drift from the per-function boot;
  helix-rum booted from its own fields only (top-level governance never threaded) = correct spec-022 boundary.
- Fan-out safety grounded in a real mapper property: a pixel maps an unmapped event to `[]` (no throw, no beacon),
  so `composite.push()` fanning a GA4-shaped event to a pixel is a silent no-op, not a mis-beacon.

## Non-blocking nits → reconciliation-log items
1. **[nit][spec] fan-out asymmetry (document it).** GA4 is a declared WILDCARD (`events:["*"]`, maps any
   `event.type` — refinement-todo:61 / ga4/map.js:56-75) while pixels are default-deny (pixel/connector.js:127). So
   in `[ga4, pixel:meta]`, `composite.push({event:"lead"})` intended as Meta-only ALSO emits a spurious GA4 `lead`.
   "Each tag reacts" holds cleanly only for a shared vocabulary; for a connector-specific event GA4 double-emits.
   The fan-out test uses only a shared `page_view` (untested). Real fix = per-event routing = the DEFERRED
   declarative-capture follow-up → **document the asymmetry in `createComposite`'s doc now** (contract honesty),
   not a redesign.
2. **[nit][impl] partial-boot-throw leak (fix or note).** `boot()` awaits each `bootConnector` in a loop with NO
   try/catch (adapters/eds/index.js ~867-877). If connector N throws (the deliberate fail-loud on unknown
   type/vendor), connectors 1..N-1 already created Workers that are never disposed + never installed on
   `window.airlock` → a partial-boot leak. A hole in the no-leak invariant the slice makes load-bearing (holds for
   dispose/re-boot, not a mid-boot throw). 032-02's up-front validation front-runs malformed configs but a runtime
   boot failure still leaks. → **dispose the accumulated handles on throw**, or explicitly note the gap.
3. **[nit][impl] getState/stats read from handles[0]** — couples read semantics to config declaration order
   (`boot([pixel, ga4])` returns the pixel's projection). Documented as a deliberate terminal choice; defensible
   pre-1.0 but worth a one-line caveat that "first" carries semantic weight.

## Open questions
1. Is GA4's catch-all (wildcard) the intended fan-out, or should a multi-connector ga4 entry gain an `eventMap`-style
   opt-in gate so "each tag reacts" is symmetric with pixels? (Ties to the deferred declarative-capture follow-up.)
2. Should `boot()` dispose already-booted connectors when a later connector's boot throws?

Reviewer: general-purpose (independent), richer skill arch-review. arch_review: true (new public authoring surface).
