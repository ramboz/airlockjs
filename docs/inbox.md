# Inbox

> Status: Draft (wizard-generated)
>
> Thin capture layer for unresolved ideas, observations, and items that surfaced during
> sessions but aren't ready for a spec. Triage during reconciliation or session end:
> (a) promote to a spec, (b) promote to an ADR, (c) drop.
>
> This is NOT a task list. Items here are parked thoughts, not committed work.

<!-- Add items below. Format: - [date] description -->

- [2026-08-31] **Real customer prod martech stack captured as the breadth-validation benchmark** → [R-007](research/R-007-real-prod-stack-breadth.md). ~21 tools classified by airlock-fit: the majority fit the two proven archetypes (wire-protocol/pixel + wrapped-SDK); forms (Marketo Forms2 — the formjacking story) + a OneTrust consent driver are new patterns; session-replay/heatmap/chat/identity (FullStory, MS Clarity, LivePerson, LiveRamp) are excluded **by mechanism**; and **RUM/observability (`helix-rum-js`, mPulse) is a strategic host-or-SUBSUME opportunity** — airlock is CWV-first and already measures the signals, and on EDS `sampleRUM` is already on the page. Feeds the MVP5 breadth Split + the post-MVP5 connector roadmap. Parked decisions: a generic **pixel** connector archetype (the big leverage win, ~10 vendors), **airlock-as-RUM-layer** (host vs subsume, EDS coexistence), **Segment** host-vs-replace, **governed form capture**, a **OneTrust** consent driver.
- [2026-09-02] **`build.mjs` needs a third bundle entry point before a real EDS page can ship the pixel connector-selection seam** (spec 026-01). `core/airlock.js`'s `createAirlock({ connector: "pixel", … })` resolves `new URL("./pixel-chamber.worker.js", import.meta.url)` at runtime, but `build.mjs` only bundles `core/chamber.worker.js` + `adapters/eds/index.js` today — a real page selecting the pixel chamber would 404 fetching the worker file. The 026-01 vertical proof is complete at the Node/vitest (FakeWorker-driven) level; this is the remaining step before a live rollout. Small, mechanical — probably folds into 026-02 rather than its own spec.
- [2026-09-02] ~~**`core/pixel-chamber.worker.js` has no egress-confinement first-import guard**~~ — **RESOLVED 2026-09-02 (spec 026-01 craft-review).** Built `core/confine-pixel-chamber.js` (`applyEgressConfinement(self, { withholdFetch: true })`) as the pixel chamber's first import, mirroring `core/confine-ga4-chamber.js`; source-order + withholdFetch regression-pinned in `test/egress-confinement.test.js`. (Follow-up for 026-02: consider folding both `confine-*-chamber.js` modules into one shared `confine-chamber.js`.)
