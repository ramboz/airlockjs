# Spec-oracle plan — 060-01

- **Source spec:** `docs/specs/060-meta-pixel-full-compatibility/slice-01-pageview-entry.md`
- **Source hash:** `sha256:7cf49c787a0a980be13ec672c9daed1dc8bc7ed6d3c213290245bcbf1f777e64`
- **Planner version:** 0.1.0
- **Generated:** 2026-11-05T16:53:36Z

> Proposed blocker-only preparation. No full native completion executor or approval exists. Every numbered criterion has deterministic evidence obligations, including wire, state and negative controls. Missing approved case-bound references or executors stay unavailable; no placeholder command is supplied.

## Deterministic obligations

| AC | Source line | Obligation and current availability |
|---|---|---|
| AC-060-01-1 | 33 | An adopter uses the documented replacement boot path and existing fbq calls with native `fbevents.js` absent. Pre-ready and post-ready init/PageView calls traverse capture, ordered serialized chamber processing and mediated dispatch; the report distinguishes worker execution from attempted and actual wire. **Executor and qualified reference: unavailable.** |
| AC-060-01-2 | 37 | The pinned native bootstrap's applicable callable/queue/alias, duplicate installation and readiness behavior is reproduced under identical inputs. Argument snapshot/mutation, ordering, repeated init and return/error behavior are observed, not inferred from an empty queue or a published bootstrap alone. **Executor and qualified reference: unavailable.** |
| AC-060-01-3 | 41 | The PageView comparison applies spec C1-C9: complete requests/responses and browser/DOM effects, including dependency/configuration traffic. New/private fields are classified and owned, not omitted. Initialization alone is not assumed to generate the explicitly requested PageView. **Executor and qualified reference: unavailable.** |
| AC-060-01-4 | 45 | Default-on and exact `meta-pixel=off` policy are preserved on the owned setup. An exact duplicate off suppresses Meta initialization even beside another value. Pair these negatives with a qualified enabled positive; two silent profiles cannot pass. No persistent opt-out or consent API is invented. **Executor and qualified reference: unavailable.** |
| AC-060-01-5 | 49 | Removing a PageView, adding an extra send, altering the Pixel/URL/value, blocking runtime/configuration, disabling the observer and substituting the known empty reference each fails or becomes inconclusive as appropriate. HTTP 200, callable fbq, one Pixel record and owner Test Events receipt cannot replace the complete independently qualified scenario reference. **Executor and qualified reference: unavailable.** |
| AC-060-01-6 | 54 | The operator receives per-call/request correlation and a visible held, dropped, denied, unavailable or incomplete explanation without identifiers in public output. No main-thread mapping/hash work, direct-connector shortcut, unrestricted fallback or stable-core signature change is introduced. **Executor and qualified reference: unavailable.** |
| AC-060-01-7 | 58 | With separately approved live evidence, actual official-endpoint dispatch/response and any newly correlated receipt are recorded as separate layers. The historical owner-confirmed receipt stays unpaired and not agent-witnessed; attempts are not upgraded to delivery. **Executor and qualified reference: unavailable.** |

## Cross-cutting promises

C1-C9 apply to every numbered criterion. See `coverage.md` for the full source-backed obligations and layer boundaries.

## Report-fidelity review

A separately proposed text rubric may assess honest reporting of supplied evidence for 060-01-7 only. It cannot verify wire/state truth, receipt or product outcomes. All other text-judgment candidates remain human-residual.

The existing operator synthetic controls cover selected attempt-level mutations only. Equal or failing synthetic data never qualifies a native reference or completes a product criterion.
