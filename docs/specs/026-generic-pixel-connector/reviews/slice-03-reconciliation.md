---
slice: 026-03 — the config contract (`PixelVendorConfig`): pin + validate + conformance
pass: reconciliation
verdict: pass
reviewer: jig:reviewer (orchestrator)
reviewed_at: 2026-09-03T01:46:33Z
prompt_source: reconciliation sweep
---

Reconciliation (026-03) — PASS. The PixelVendorConfig type + validatePixelVendorConfig() pin 026's proven archetype
as a documented, validated, config-author-facing contract — descriptive of the shipped interpreter (both review
passes verified field-by-field), conformed by all 3 shipped configs (incl. LinkedIn's null-valued eventMap), with a
non-vacuous reject guard. ZERO interpreter/core change (connector.js + core/ + pinned contracts diffs empty). CLOSES
026's Rules axis. Gate history durable: frame-critique PASS (first pass — the identity/POST deferral verified a
settled/justified decision, the contract descriptive not fiction, the validator a real guard); compliance + craft
both PASS with two cheap nits applied (validator↔type alignment on static value; JSDoc number-usage correction).
Promoted/deferred: identity/advanced-matching + POST/ctx-body → 026-04 (real-driver-gated, security-critical PII);
the build.mjs bundle-entry (pixel + dom-chamber) → tracked for the live-shippability slice; the 3 vendor-config
fossils corrected to 026-04. No orphans; no live identifiers; no new dependency.
