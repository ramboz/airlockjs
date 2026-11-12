# Spec-oracle plan — 060-05

- **Source spec:** `docs/specs/060-meta-pixel-full-compatibility/slice-05-browser-continuity.md`
- **Source hash:** `sha256:645926faf8885aa2ba0609c2a53366eed354903b58b19dc0839cab2c4eadfce7`
- **Planner version:** 0.1.0
- **Generated:** 2026-11-05T16:53:45Z

> Proposed blocker-only preparation. No full native completion executor or approval exists. Every numbered criterion has deterministic evidence obligations, including wire, state and negative controls. Missing approved case-bound references or executors stay unavailable; no placeholder command is supplied.

## Deterministic obligations

| AC | Source line | Obligation and current availability |
|---|---|---|
| AC-060-05-1 | 26 | Run independent wholly-replacement clean first-visit, second-page and return journeys with native runtime absent. Observe creation/reuse/absence of authorized `_fbp`/`_fbc` state and corresponding `fbp`/`fbc` wire values. A native-seeded cookie-only comparison does not prove first-visit support. **Executor and qualified reference: unavailable.** |
| AC-060-05-2 | 30 | Match observed native domain/path/expiry/refresh/security attributes and handling of existing, expired, malformed, deleted and changed cookies. The server-cookie 90-day recommendation is not substituted for measured native behavior or actual browser restrictions. **Executor and qualified reference: unavailable.** |
| AC-060-05-3 | 34 | No-click, same-click and changed case-sensitive `fbclid` cases preserve input-to-cookie-to-request relationships across navigation and allowed subdomains. Do not synthesize a ClickID when none exists, mutate its case or assume cross-site propagation. **Executor and qualified reference: unavailable.** |
| AC-060-05-4 | 38 | Named cohorts include first/third-party allowed, third-party blocked with first-party allowed, all writes denied, private/partitioned and applicable anti-tracking states in Chromium, Firefox and WebKit/mobile variants. Unsupported/unavailable combinations block their rows, not the browser's privacy controls; no circumvention or false cookie-success fallback. **Executor and qualified reference: unavailable.** |
| AC-060-05-5 | 43 | Actual browser transport evidence distinguishes first-party local state from outgoing third-party Cookie/Set-Cookie and browser-controlled headers. Compare credentials, methods, redirects/fan-out and responses where observed; do not forge browser headers or declare worker fetch/image/proxy equivalent. **Executor and qualified reference: unavailable.** |
| AC-060-05-6 | 47 | Only exact owner-declared cookie names/scopes/attributes may be read/written/ deleted. Worker prepares values; host enforces bounds and the seal. Arbitrary names/domains, stale policy and unauthorized operations fail visibly without a general cookie jar or identity-resolution service. **Executor and qualified reference: unavailable.** |
| AC-060-05-7 | 51 | Wrong wire key, new ID on every page, changed ClickID/hash, excessive cookie scope and skipped denial controls fail under C1-C9. Generated IDs compare by pinned native relationships, not unrelated random byte equality or sentinels. **Executor and qualified reference: unavailable.** |

## Cross-cutting promises

C1-C9 apply to every numbered criterion. See `coverage.md` for the full source-backed obligations and layer boundaries.

## Report-fidelity review

No text judge is proposed for this journey. Evidence truth and policy decisions remain outside a text evaluator.

The existing operator synthetic controls cover selected attempt-level mutations only. Equal or failing synthetic data never qualifies a native reference or completes a product criterion.
