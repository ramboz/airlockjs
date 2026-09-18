---
adr: 0033
pass: frame-critique
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-09-18T16:34:24Z
prompt_source: review.py frame-critique docs/decisions/adr-0033-proposition-contract-placement-registry.md
---

Frame-critique pass on **ADR-0033** — three rounds, reviewer `jig:reviewer`, prompt built via
`review.py frame-critique docs/decisions/adr-0033-proposition-contract-placement-registry.md`.

**Round 1 (cold read) — needs-changes.** (a) aem-experimentation's output is pre-decoration EDS source markup swapped before
`decorateMain`, and the plugin has no decide-without-apply hook, so "route its variants through the shared applier" implied
forking it — the option the ADR rejected. (b) "zero translation / semantics are alloy's" overstated what airlock owns: airlock
never calls `applyPropositions`; it renders main-thread and must feed `renderAttempted` back for alloy's manual-render
notification flow, an unlisted load-bearing assumption.
**Resolution:** the contract gained `applyPhase: "source"|"dom"` (two apply regimes, one schema); Sub-decision 1 hosts the
plugin unforked and normalizes its *outcome* after the fact; a "What airlock does own" paragraph + a new Assumption + kill
criterion make the notification path an explicit rig target (ids-in == ids-notified).

**Round 2 — needs-changes.** The revised payoff claimed eager *capture* closes spec 005's fast-bounce / differential-bias hole;
that hole is egress-timing (no egress path exists before `createAirlock` runs in `loadLazy`; the eager chunk is build-asserted
not to reach it), so earlier capture leaves the loss window unchanged. Secondary: the eager module loads after the plugin
dispatches `aem:experimentation`, so the dataset read must be the primary mechanism.
**Resolution:** claim downgraded to "section-level exposure + earlier capture; the fast-bounce hole stays open"; the eager
unload-egress question recorded as a DEFERRED decision in refinement-todo (principle-tensioned, decided elsewhere); dataset read
primary, event listener secondary (fragment pass only); a kill criterion added.

**Round 3 — pass.** Both findings resolved and grounded against the vendored plugin (awaited page/section passes write
dataset/classes and dispatch synchronously; only `sampleRUM` is prerender-deferred; fragment pass is MutationObserver-driven;
testbed imports the eager module after `runExperimentation` returns). Two cosmetic corrections applied post-verdict: the
plugin writes no `data-campaign` (campaigns reuse `data-audience`; the `campaign-*` class disambiguates) — ADR Sub-decision 1 +
Assumption reworded; R-012 §2 corrected ("all wrapped prerender-aware" → only `sampleRUM` is). Remaining load-bearing
assumption (worker alloy notifies externally rendered propositions with original `scopeDetails`) is flagged unprobed with a
kill criterion and a rig target.

VERDICT: **pass**.
