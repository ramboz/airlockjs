---
slice: 012-04 — manifest declaration-shape + alloy behaviour characterization
pass: frame-critique
verdict: pass
reviewer: general-purpose
reviewed_at: 2026-08-30T03:03:52Z
prompt_source: review.py frame-critique
---

**Verdict: pass** — one adversarial frame-critique round (needs-changes → the sole blocking finding corrected + confirm-ask resolved; the reviewer pre-affirmed "correcting AC3's grounding split … clears it").

Premises 1, 3, 4, 5 were sound (with notes, all applied); premise 2 blocked and is fixed.

- **[2 — PRIMARY, blocking → fixed] AC3's grounding taxonomy conflated two different gaps.** The original AC3 folded *default-context auto-collection* into the same "stub vs live-Alloy (creds-gated)" bucket as egress-breadth — but default-context collection is **not chamber-observable at all** (the context modules read `window`/`screen`/`navigator`/`Intl` the chamber shims away; `context:[]` is used *because* the chamber is headless), so live-Alloy-in-a-chamber still won't exhibit it — it's a **real-DOM / documentation gap, not a creds gap**. Conflating them would mislead MVP3 (plan a live-in-chamber run expecting default-context collection, or misread "chamber collected nothing" as alloy being minimal). **Fixed:** AC3 now splits **egress-breadth** (stub vs live-Alloy/creds-gated) from **collection-breadth** (chamber-observable via `context:[]` vs NOT-chamber-observable-by-design → documentation / real-DOM, NOT creds-gated), tagging each finding with its correct axis.
- **[1 — sound, tightened] "declared, not enforced" is a boundary SENTINEL,** not vacuous — it fails when MVP3 enforcement is *added* (asserting an *absence* of gating, so not "fail on feature-removal"), and honestly notes it can't distinguish "deliberately non-enforcing" from "seal simply unbuilt" (both hold in MVP2). AC2 re-labelled accordingly.
- **[3 — confirm-ask resolved] `purposes` needs an additive contract shape.** Verified: `ConnectorManifest` (connector.d.ts:80) has **no `purposes` field**; ADR-0007 says the manifest is *to* carry it. So 012-04 **adds** a `purposes` annotation shape — additive (existing fields byte-identical; contract-stability stays green). AC1 now names this explicitly.
- **[4 — sound, framed] Consolidation-for-handoff, not new investigation** — the characterization consolidates existing R-004 + ADR-0006/0007 findings + the chamber's stub observations (deep breadth is MVP3-deferred). AC4 re-framed.
- **[5 — sound] No enforcement teeth smuggled** — AC2 non-enforcing, `endpoints` advisory, `purposes` static annotations only; none of ADR-0007's grant resolver / three-point enforcement.

Recorded by: author, after one frame-critique round (needs-changes → corrected), the reviewer having pre-affirmed the AC3-split fix clears the block.
