---
slice: 012-04 — manifest declaration-shape + alloy behaviour characterization
pass: compliance
verdict: pass
reviewer: general-purpose
reviewed_at: 2026-08-30T03:26:45Z
prompt_source: review.py implementation
---

**Verdict: pass** — all five ACs met with meaningful, non-vacuous tests (independent compliance reviewer, 8 files, 307/307 re-confirmed).
- **AC1** manifest declares reads/capabilities/endpoints + **`purposes`**; `ConnectorPurposes` + `ConsentPurpose` + `ConnectorManifest.purposes?` are **optional/additive** (pre-existing fields byte-identical); `contract-stability` pins existing signatures + the new `purposes?`/`endpoints?` byte-identical.
- **AC2** declared-NOT-enforced **sentinel** — the real connector egresses to a declared *and* an undeclared host (nothing consults `manifest.endpoints`); the companion applies a hypothetical MVP3 origin-ceiling and proves the undeclared host is then **held** (`rejects.toThrow(/held at the seal/i)`) — a real red-condition witness, so the absence-assertion is non-vacuous. Honest-limit note present.
- **AC3** two-axis characterization (§Findings): egress-breadth (stub vs live-Alloy/creds-gated) split from collection-breadth (chamber-observable `context:[]` vs NOT-chamber-observable-by-design → docs/real-DOM, not creds); each row tagged; both MVP3 misread-traps closed.
- **AC4** consolidation framing; three seam-design inputs named; `mvp3.md` + `refinement-todo.md` handoff updated.
- **AC5** GA4 + 012-01/02/03 green; pinned signatures byte-identical.

FINDINGS: (none)
