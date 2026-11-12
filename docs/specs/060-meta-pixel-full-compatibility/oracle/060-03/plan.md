# Spec-oracle plan — 060-03

- **Source spec:** `docs/specs/060-meta-pixel-full-compatibility/slice-03-pixel-routing.md`
- **Source hash:** `sha256:fbf8125098eba24b8728231cb7095369d569e54d5a076de76afdb7b70b22676a`
- **Planner version:** 0.1.0
- **Generated:** 2026-11-05T16:53:39Z

> Proposed blocker-only preparation. No full native completion executor or approval exists. Every numbered criterion has deterministic evidence obligations, including wire, state and negative controls. Missing approved case-bound references or executors stay unavailable; no placeholder command is supplied.

## Deterministic obligations

| AC | Source line | Obligation and current availability |
|---|---|---|
| AC-060-03-1 | 24 | In the actual replacement, `track`/`trackCustom` broadcast and `trackSingle`/`trackSingleCustom` targeting match the pinned native two-Pixel inputs, including request order/count and absence at the other Pixel. **Executor and qualified reference: unavailable.** |
| AC-060-03-2 | 27 | Each Pixel retains its own init data, configuration and identity state. Distinct safe synthetic values reveal cross-Pixel contamination; identical redaction sentinels or repeated placeholder IDs cannot prove isolation. **Executor and qualified reference: unavailable.** |
| AC-060-03-3 | 30 | Calls before/after either init, repeated IDs, late initialization, duplicate snippets and invalid/uninitialized targets have observed native behavior and visible errors. Unknown `set` subcommands/options block their support row rather than silently doing nothing. **Executor and qualified reference: unavailable.** |
| AC-060-03-4 | 34 | Evidence-backed per-Pixel settings, including `autoConfig` placement/type, are applied to the correct Pixel and produce the same whole-sequence and browser effects. Do not infer privacy-option global/per-Pixel scope; 060-04 qualifies that state machine. **Executor and qualified reference: unavailable.** |
| AC-060-03-5 | 38 | Configuration updates use declared, bounded, per-Pixel source/operation references and integrity/version provenance. Native dependency/configuration behavior is accounted for under C3; no arbitrary remote code runs on the privileged main thread or brings the native runtime into the replacement. **Executor and qualified reference: unavailable.** |
| AC-060-03-6 | 42 | Wrong-target, extra broadcast, missing fan-out branch, stale configuration and cross-Pixel identity mutations all fail the appropriate comparisons. Unauthorized target/configuration access is denied with visible reason. **Executor and qualified reference: unavailable.** |
| AC-060-03-7 | 45 | The adopter/operator can inspect target selection and configuration provenance per call without public IDs or secrets. C1-C9 and unchanged stable-core/other-vendor behavior remain required. **Executor and qualified reference: unavailable.** |

## Cross-cutting promises

C1-C9 apply to every numbered criterion. See `coverage.md` for the full source-backed obligations and layer boundaries.

## Report-fidelity review

No text judge is proposed for this journey. Evidence truth and policy decisions remain outside a text evaluator.

The existing operator synthetic controls cover selected attempt-level mutations only. Equal or failing synthetic data never qualifies a native reference or completes a product criterion.
