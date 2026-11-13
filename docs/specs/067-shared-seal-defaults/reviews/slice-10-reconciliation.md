---
slice: 067-10: Input governance at the wrapped-SDK seam
pass: reconciliation
verdict: pass
reconciled_at: 2026-11-13
---

Spec 067 D3 and ADR-0062 exception (b): match; the override and `payloadDenylist` apply at the seam through the shared `resolveDenylist`. ADR-0012's second placement is satisfied for the Edge request body; the chamber input stays ungoverned by design (recorded). No ADR change needed.
