# Release Plan: Granular Chamber Policy

> Turn the existing enforcement pieces into an understandable per-connector policy: what data a
> chamber may receive, what capabilities it may use, where it may send, and how those grants change
> with consent. The tradeoff is a stricter integration contract and potentially incompatible SDK behavior.

## Status

`candidate`

Captured 2026-10-06 under [ADR-0031](../decisions/adr-0031-reframe-onto-adobe-first-compatibility.md);
version, appetite and build commitment unassigned. A dependency needed for safe Adobe compatibility
is pulled into that release rather than waiting for this broader package.

## Problem / Baseline

Endpoint/tenant gates, purpose-specific egress, selected field filtering, scoped Alloy cookie grants
and controlled DOM application exist. The manifest's per-read/per-cookie/per-endpoint annotations do
not yet uniformly drive one adopter-facing grant system. No-consent legacy boots can leave consent
enforcement inactive; holding a beacon does not mean the source data was never collected or retained.

## Appetite

Shape a minimal end-to-end policy against the Adobe adopter's demonstrated needs first. Do not
design a universal legal taxonomy or promise arbitrary hostile-script isolation.

## Solution Outline

- Resolve capabilities as **declared need intersected with site policy and current consent**,
  host-side and default-deny. Keep configuration and enforcement linked mechanically.
- Separate consent-to-collect, consent-to-store, consent-to-transmit and permitted downstream use.
  Define per-field/endpoint/cookie/DOM grants and compatible vendor behavior explicitly.
- Govern all inputs before crossing, including snapshots, event data and dedicated identity
  channels; sensitive-field name denylists alone are not complete data minimization.
- Specify revocation and re-grant for worker context, queues, cached identity, decisions, storage
  and in-flight work. Already-transmitted data cannot be recalled by the browser.
- Bound retention, event-log/held-queue growth, diagnostic data and idle-time processing.
- Make disabled/missing policy visible. Decide migration from legacy opt-in gates without silent
  breakage; scoped purpose annotations must not imply enforcement that is absent.
- Validate language-loader/CSP and bootstrap boundaries, SDK retained globals, forged messages and
  capability escalation. Choose a stronger isolation model if the hostile-code claim requires it.
- Show granted/denied/stripped decisions in the inspector and publish a plain-language policy
  contract with the runtime's precise guarantee and disclosed limits.

## Risks / Rabbit Holes

Purpose semantics differ by vendor; shared Adobe requests mix concerns; invalid policy can lose
events; browser restrictions and SDK callbacks can conflict with strict grants. Data capture,
transmission and legal consent are not interchangeable.

## No-Gos

No privacy/compliance certification claim; no universal hostile-code sandbox claim from a Worker
alone; no silently permissive fallback; no weakening endpoint/tenant controls; no unlimited retained
PII; no unreviewed break of the frozen core.

## JIG Handoff

UC-6, UC-7, UC-9. Reuse ADR-0003/0006/0007/0012/0013/0023, specs 015-020/035/045/047/048,
and the [refinement ledger](../refinement-todo.md). Start with an explicit policy contract and a
threat/consent lifecycle review, then vertical slices proving an adopter-selected field/capability
grant and revocation. No runtime behavior changes in this shaping pass.

## Release-Check Criteria

- A declarative per-connector policy resolves to enforced grants on every relevant input/output
  path, including identity and DOM channels.
- Granted, pending, denied, revoked and re-granted cases pass end-to-end adversarial tests.
- Retention/queue/memory limits and failure behavior are measured and documented.
- Inspector output explains the effective policy without exposing sensitive values.
- Migration and hostile-code guarantee are explicit and supported by the selected browser/security
  boundary; no silent permission widening or contract regression.
