# Spec-oracle plan — 060-04

- **Source spec:** `docs/specs/060-meta-pixel-full-compatibility/slice-04-consent-processing.md`
- **Source hash:** `sha256:9ba7f08575b6132399909a1355ab5f9fb7723006c4c9a3aaaf8cb27478f1767e`
- **Planner version:** 0.1.0
- **Generated:** 2026-11-05T16:53:43Z

> Proposed blocker-only preparation. No full native completion executor or approval exists. Every numbered criterion has deterministic evidence obligations, including wire, state and negative controls. Missing approved case-bound references or executors stay unavailable; no placeholder command is supplied.

## Deterministic obligations

| AC | Source line | Obligation and current availability |
|---|---|---|
| AC-060-04-1 | 25 | Revoke before init, events while revoked, grant, event, revoke again, more events and re-grant follow the pinned native state transitions through actual chamber and host. Repeat on navigation with revoke reapplied as required. Record retention, flush/drop, ordering and duplicate counts explicitly. **Executor and qualified reference: unavailable.** |
| AC-060-04-2 | 29 | The applicable seal policy is rechecked at each dispatch/redirect and timing-critical path. A stale grant/version, queued identity or previously prepared request cannot release data after revocation contrary to policy. **Executor and qualified reference: unavailable.** |
| AC-060-04-3 | 32 | Observe and compare script/config fetching, cookies, automatic/manual collection and egress separately. Do not equate pausing fires with stopping all collection or clearing every cookie, and do not invent native replay. **Executor and qualified reference: unavailable.** |
| AC-060-04-4 | 35 | `dataProcessingOptions` empty, LDU automatic-location and documented explicit location cases, plus observed mid-page changes, produce native-equivalent fields and scope for every relevant request family. Preserve omitted versus empty values; LDU is not consent or a no-send guarantee. **Executor and qualified reference: unavailable.** |
| AC-060-04-5 | 39 | Multi-Pixel and browser-cohort cases show the actual setting scope and no unintended release. `meta-pixel=off` remains a separate initialization choice, not a substitute for revoke/grant or data-use options. **Executor and qualified reference: unavailable.** |
| AC-060-04-6 | 42 | Positive permitted sends, paired denied cases, delayed consent updates, repeated grants and altered privacy-field controls are falsifiable under C1-C9. No recording with both positive/negative paths empty can pass. **Executor and qualified reference: unavailable.** |
| AC-060-04-7 | 45 | Operators see why each event was captured/held/replayed/dropped/denied and which policy version applied, without private values in public reports. A demonstrated native-versus-policy contradiction blocks that case for one parent-routed owner decision; no silent collection loss or blanket waiver. **Executor and qualified reference: unavailable.** |

## Cross-cutting promises

C1-C9 apply to every numbered criterion. See `coverage.md` for the full source-backed obligations and layer boundaries.

## Report-fidelity review

No text judge is proposed for this journey. Evidence truth and policy decisions remain outside a text evaluator.

The existing operator synthetic controls cover selected attempt-level mutations only. Equal or failing synthetic data never qualifies a native reference or completes a product criterion.
