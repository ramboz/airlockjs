# Spec-oracle plan — 060-09

- **Source spec:** `docs/specs/060-meta-pixel-full-compatibility/slice-09-lifecycle-nojs.md`
- **Source hash:** `sha256:c54233632507c22f1fb82cd4e7447e1a53dece1b166e149bc6fd89e47366089e`
- **Planner version:** 0.1.0
- **Generated:** 2026-11-05T16:53:53Z

> Proposed blocker-only preparation. No full native completion executor or approval exists. Every numbered criterion has deterministic evidence obligations, including wire, state and negative controls. Missing approved case-bound references or executors stay unavailable; no placeholder command is supplied.

## Deterministic obligations

| AC | Source line | Obligation and current availability |
|---|---|---|
| AC-060-09-1 | 29 | Hard navigation, pushState/replaceState/popstate/hash changes and explicit PageView calls preserve native URL/referrer/metadata, call timing and counts. A no-explicit-call control determines any actual native automatic history behavior; the historical hash-route sample alone cannot establish it. **Executor and qualified reference: unavailable.** |
| AC-060-09-2 | 33 | Click, scroll/visibility, developer delays, foreground/background, BFCache restore and prerender transitions preserve actual callbacks, default site behavior and automatic-rule effects under C1-C9. **Executor and qualified reference: unavailable.** |
| AC-060-09-3 | 36 | Rapid exit, pagehide/navigation, cold/warm startup, slow worker/hash and offline/intermittent transport record surviving/cancelled attempts, retries, duplicates, time/order and loss. Repeated trials apply pinned measured criteria; a single receipt is not an exactly-once guarantee. **Executor and qualified reference: unavailable.** |
| AC-060-09-4 | 40 | Browser-required image/fetch/beacon or other discovered transports remain explicitly mediated with correct credentials, browser-controlled headers/ cookies, responses and redirect/fan-out effects. No arbitrary proxy or forged header is substituted to hide a mismatch. **Executor and qualified reference: unavailable.** |
| AC-060-09-5 | 44 | The host may fulfill a bounded pre-serialized lifecycle lease only with current consent/destination/identity validity; no main-thread mapping/ hashing, blocking unload or stale replay. Forbidden, delayed and cancelled dispatches are reported truthfully rather than success-shaped loss. **Executor and qualified reference: unavailable.** |
| AC-060-09-6 | 48 | In a distinct approved no-JavaScript journey, the site-owned governed fallback reproduces the pinned native image/other applicable behavior and actual browser/wire response while respecting required query/policy choices. This is not worker execution. Do not re-add the current omitted image, assume static markup can inspect queries, or accept absence as full parity. An infeasible required path remains blocked for an evidence-specific decision. **Executor and qualified reference: unavailable.** |
| AC-060-09-7 | 54 | Missing/extra navigation events, changed URL/hash/identity, late revoked release, retry duplication, a lost exit and policy-bypassing no-JavaScript emission are falsifiable controls. Attempt-only interception cannot close actual delivery/redirect/cookie criteria, and owner receipt cannot fill them. **Executor and qualified reference: unavailable.** |
| AC-060-09-8 | 58 | The operator can trace a lifecycle event across capture, preparation, attempted/actual transport and loss with safe public reasons, including explicit unavailable evidence. No browser cohort is silently dropped. **Executor and qualified reference: unavailable.** |

## Cross-cutting promises

C1-C9 apply to every numbered criterion. See `coverage.md` for the full source-backed obligations and layer boundaries.

## Report-fidelity review

No text judge is proposed for this journey. Evidence truth and policy decisions remain outside a text evaluator.

The existing operator synthetic controls cover selected attempt-level mutations only. Equal or failing synthetic data never qualifies a native reference or completes a product criterion.
