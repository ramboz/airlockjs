---
slice: 059-14 - Browser admission and original-byte capture controls
pass: compliance
verdict: needs-changes
reviewer: jig:reviewer (Browser compliance corrected)
reviewed_at: 2026-10-19T16:07:54Z
prompt_source: review.py implementation docs/specs/059-google-ads-full-compatibility/spec.md 059-14; task Browser compliance corrected
---

VERDICT: needs-changes

REASONING:
Earlier fixture-evidence, redirect-parent, cleanup-retention, durable-output and provenance findings are addressed, and real tests observe actual CLI child exits. Local-only scope and live limitations are clear. AC5's intended-reason requirement is still unmet by a confounded wrong-transport control. This read-only reviewer executed no commands.

SPECIFIC ISSUES:
- [High] rig/first-journey-browser.mjs:671 — wrong-transport selects a FetchPOST policy while generating ScriptGET. Method mismatch alone still rejects it if transport/resource checks are removed. Use a GET-scoped Fetch positive and ScriptGET negative with identical URL/method, and assert those relationships rather than accepting a generic scope_mismatch alone.

RECONCILIATION NOTES:
Initial broader finding remains in c667631. Preserve nonempty307 mechanism-specific gap, post-dispatch finalheader limit, synthetic origin-only LNA permission, producer-result versus externally observed exit, and open live-policy/setup/native/C2C3 gates. All four live slots remain unspent.
