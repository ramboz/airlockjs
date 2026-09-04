---
slice: 032-02 — the config contract (validated JSON Schema, pre-1.0) + breadth + the few-lines-instrument story
pass: compliance
verdict: pass
reviewer: general-purpose
reviewed_at: 2026-09-04T23:43:25Z
prompt_source: review.py implementation docs/specs/032-instrumentation-config/spec.md 032-02 <deliverables>
---

VERDICT: pass

## Assessment (independent compliance review, general-purpose reviewer)

All 4 ACs met + independently observable (re-run, not trusted):
- `cd contracts && npm run validate` — 6 instrumentation-config goldens pass, 4 negatives rejected.
- `npx vitest run test/instrumentation-config-contract.test.js` — 19/19 pass.
- `npm run build` — green with the no-ajv assertion active. Boot/build/config regression 100/100; per-connector
  boots 35/35. `npm run lint` clean.
- **AC1:** schema is a proper discriminated union (`oneOf` on `type`; nested `oneOf` on pixel `vendor`; helix-rum
  governance-free); pre-1.0 caveat + contracts/README row present.
- **AC2:** runtime validator hand-rolled, loud + `connectors[i]`-index-scoped, NO ajv in the bundle (build assertion
  + test).
- **AC3:** the `multi` golden (ga4 + pixel + helix-rum, no alloy) validates + boots; the alloy coverage-gap
  statement is in the schema description + `README.md` + `contracts/README.md`; the deferral is in
  `docs/refinement-todo.md` with a resolution trigger.
- **AC4:** the README "Configure airlock" config block validates against the schema (no drift) + a signature-match
  test.
- **Non-vacuity verified directly:** a relaxed schema flips all 4 negatives to valid (they bite on `type` const /
  vendor `oneOf` / required id / `consentStrict` boolean); the malformed-config runtime tests turn on the
  `connectors[i]` prefix + reject-vs-resolve discriminators (e.g. a missing pixelId would silently boot on the
  placeholder default without the check).

## Minor notes (no action)
- The AC3 boot test injects non-schema DI fields (`forceSelect`, web-vitals stubs, `ctx`) into entries before
  `boot()` — legitimate headless-harness seaming; the pristine golden is validated against the schema separately;
  the runtime validator is a deliberate lenient subset (no `additionalProperties:false`), so it accepts them by
  design.
- The runtime per-connector "wrong-typed field" check covers only helix-rum `weight` (narrower than the schema) —
  the explicitly documented AC2 "subset" framing; top-level wrong-type cases covered by tests.

## Cross-cutting
No design-principle violations (serves the anti-drift "contracts pinned as external artifacts" principle; validates
off the INP-critical path; helix-rum governance exemption preserved). No new TODO/FIXME. No new deviations — the log
already captures the material decisions.

Reviewer: general-purpose (independent). Pass: compliance (always-on).
