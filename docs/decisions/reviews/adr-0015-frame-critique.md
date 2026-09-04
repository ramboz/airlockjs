---
adr: 0015
pass: frame-critique
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-09-04T15:58:11Z
prompt_source: review.py frame-critique docs/decisions/adr-0015-distribution-git-subtree.md
---

VERDICT: pass

## Reviewer assessment

The single most-exposed load-bearing assumption is the one the ADR itself flags: **"the EDS audience is
buildless and uses the git-subtree convention (aem-martech/aem-experimentation)."** Pressed hard, it
reconciles: the buildless-drop-in premise is grounded in the accepted vision (`product-vision.md:15`) and
architecture OQ8 (`architecture.md:92`); the subtree-convention half matches real ecosystem reality
(`scripts.js` cites the aem-experimentation wiring); and — decisively — the same-origin **Worker**
requirement genuinely forces worker files into the site's own origin, which for a git-served EDS site means
vendoring them (subtree), so the frame's core intuition holds. The decision is honestly reversible
("npm deferred, not rejected") with kill criteria that fire precisely if the flagged assumption proves
wrong. **The frame survives.**

## Residuals raised (non-blocking) — both folded into the ADR before accept

1. **PRIMARY:** The ADR presented the 004-01 same-origin-file-worker/CSP constraint as an *independent*
   discriminator between subtree and npm, but that discriminator is parasitic on the (soft, unprobed)
   buildless-audience premise: a build-running EDS site could ship the identical pre-built esbuild dist via
   npm and preserve the invariant by referencing it same-origin without re-bundling. The CSP burden only
   "shifts onto the consumer's bundler" in the *idiomatic bundler-consumption* mode.
   → **Folded in:** Option B cons now scope the CSP burden to the idiomatic bundler form and name the
   non-idiomatic prebuilt-dist-over-npm mode; a new Assumptions bullet states plainly that the same-origin
   constraint is not by itself an npm-blocker and that the true discriminator is the buildless-audience +
   convention premise.

2. **SECONDARY:** aem-martech/aem-experimentation subtree hand-authored *source*; airlock would subtree
   *generated esbuild bundles* — materially more merge-hostile (`git subtree pull` on opaque generated
   output; a buildless consumer cannot resolve a bundle-diff conflict), so the no-semver/drift con and
   kill-criterion 2 bite harder than a convention-transfer implies. Relatedly, no probe yet shows a subtree
   of built artifacts installs/serves/boots on real EDS — the testbed reaches airlock by direct build-emit
   into `probes/eds-testbed/`, not a subtree pull, so the distribution *mechanism* is asserted, not evidenced.
   → **Folded in:** a "Becomes harder" bullet on subtreeing generated bundles (treat the tree as a generated
   release overwritten wholesale, a tagged snapshot, not a mergeable source tree); an Assumptions bullet
   that the mechanism is asserted-not-probed; and an Open-questions note making "subtree add/pull onto a
   clean EDS checkout → boot with CWV preserved" the MVP6 setup spec's first proof.

Reviewer: jig:reviewer (independent, no access to authoring conversation).
