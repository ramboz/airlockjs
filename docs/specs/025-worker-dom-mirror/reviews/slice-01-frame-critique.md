---
slice: 025-01 — Tier-0 mechanism de-risk gate (GO / KILL) + GA4 adoption litmus
pass: frame-critique
verdict: pass
reviewer: jig:reviewer (independent, re-verified)
reviewed_at: 2026-09-02T17:38:19Z
prompt_source: review.py frame-critique + re-verify
---

Frame-critique — 025-01 (Tier-0 mechanism de-risk gate + GA4 adoption litmus). VERDICT: pass (after must-fix resolution; independently re-verified). Initial FAIL: the gate wired the maintainer's GA4 ADOPTION kill switch to the Tier-0 MECHANISM build decision — orthogonal. GA4 (gtag.js) is network/sub-resource-shaped, not write/compute-heavy; its likely failure (loading googletagmanager.com) is a 024-documented won't-work case orthogonal to ADR-0014's two bets, plausibly fixable in airlock's OWN mirror (a mediated sub-resource proxy the lib lacks), and GA4 is ALREADY supported via the connector (004/008 + pixel 026) — so a GA4-lib-KILL would sink the build for a reason neither bet nor ADR-0014's kill criteria support. RESOLVED + re-verified pass: the build GO/KILL is now keyed ONLY on the two MECHANISM verdicts (AC1 apply-INP under a DOM-mutation-heavy SYNTHETIC — not gtag.js; AC2 a real write/compute-heavy-without-sync-read target-shape tag), matching ADR-0014's kill criteria. GA4 is a SEPARATE axis-classified adoption verdict feeding 025-02's feature set, not the build's existence. Escape clause inverted (preserve the mechanism ACs). lib→own-mirror transfer caveated to model-inherent failures only. Should-consider tightenings folded (AC1 stale-0.36 measurement escape; AC2 population-mirage = corpus-absence vs lib-gap; the stale label + Overview softened). RECONCILIATION: the reframe reinterprets a maintainer-stated gate (GA4-supported-via-connector satisfies the intent vs GA4-must-drop-in) — flagged in the slice as AWAITING MAINTAINER RATIFICATION; not proceeding until confirmed.
