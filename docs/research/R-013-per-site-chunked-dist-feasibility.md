---
status: OPEN
topic: Can per-site composition be pure file selection over a pre-chunked dist without breaking the build's CSP envelope, and how much of eds.js is per-connector?
created: 2026-09-18
related:
  - ../decisions/adr-0036-per-site-composition.md
  - ../releases/config-builder.md
---

# R-013: Per-site chunked-dist feasibility

> This is an **open investigation**, not a decision and not committed work.
> A decision belongs in an ADR (`docs/decisions/`); committed work belongs in
> a spec (`docs/specs/`). This note holds the question, sources, and
> pros/cons *before* either of those is warranted — see jig's ADR-0054
> (linked from [README.md](README.md)).

## Question

[ADR-0036](../decisions/adr-0036-per-site-composition.md) leaves one sub-decision open: whether the per-site generator can be
**pure file selection** over a dist published as a core plus one chunk per connector, or whether it must run esbuild
(in a site-repo Action) to emit one bundle per site. Two things decide it:

1. How much of `eds.js` (159 KB) is per-connector main-thread glue versus shared core. If the per-connector share is small,
   chunking buys little and the workers, which are already separable, were the whole win.
2. Whether an esbuild `splitting: true` build can satisfy the build's existing invariants: no `blob:`/`data:` in any chunk,
   no bundled ajv, every worker referenced by a chunk present as a same-origin sibling (`build.mjs`), plus the request-count
   and TBT cost of the extra post-LCP chunk loads.

## Sources / findings

- `build.mjs:155`: `splitting` is disabled by design ("each entry is self-contained — no shared-chunk load chain").
- `build.mjs` sibling assertion: every `new Worker(new URL("./x.worker.js", import.meta.url))` in the emitted `eds.js` must
  name an emitted sibling; "dropping one seeds the AC3 missing-sibling regression".
- `adapters/eds/index.js:34-60`: static imports of every connector's main-thread glue; `bootConnector` at `:2110-2165`
  dispatches on `type` and spawns workers lazily.
- `dist/` on 2026-09-18: `eds.js` 159 KB; chamber workers 9 to 16 KB each; `alloy-chamber.worker.js` 34 KB;
  `reserve-personalization.js` 8.6 KB; `tag-suppressor.js` 13 KB.
- Prior art in-repo: the eager reserve module (033-03) and the suppressor (049-01) are already separate non-worker entries
  with their own negative scans, so "more than one main-thread entry" is an established pattern.

## Probe plan

Probe code goes under `probes/per-site-chunking/` with a README pointing back here.

1. **Size attribution.** Build with `metafile: true`; attribute `eds.js` bytes to `core/`, `adapters/eds/`, and each
   `connectors/<name>/` subtree. Report the per-connector share.
2. **Splitting build.** Run `buildAirlock` with `splitting: true` and one entry per connector's main-thread module plus a
   core entry; run the existing negative scans and sibling assertion over every emitted chunk; record what breaks.
3. **Cost.** On the eds-testbed, compare the monolithic `eds.js` against core plus two connector chunks with `lh:r010`
   (request count, TBT) and confirm the 038 parity harness stays green on the chunked tree.

## Options / pros & cons

- **Pre-chunked dist, generator = file selection.** Pros: no compute at generation time; identical output from CLI, browser
  and Action. Cons: shared-chunk load chain; more requests; new assertions to write.
- **Per-site esbuild in a site-repo Action.** Pros: one bundle per site; today's layout and assertions unchanged. Cons:
  generation is no longer pure; EDS repos gain a CI build they do not otherwise have.

## Open questions

- What per-connector share of `eds.js` counts as "worth chunking"? Proposed bar: chunking must remove at least a third of
  the main-thread bytes for a two-connector site, else bundle-in-Action wins.
- Does the classic (`importScripts`) alloy worker constrain the chunk layout differently from the module workers?

## Conclusion

Open.

Promoted to: pending; feeds the output-layout open question in ADR-0036 and the risk-first row of the
[config-builder](../releases/config-builder.md) release plan.
