---
slice: 032-02 — the config contract (validated JSON Schema, pre-1.0) + breadth + the few-lines-instrument story
pass: craft
verdict: pass
reviewer: general-purpose (richer: pr-review)
reviewed_at: 2026-09-04T23:44:11Z
prompt_source: review.py pr-review docs/specs/032-instrumentation-config/spec.md 032-02 <deliverables> --richer-skill pr-review
substrate: non-interactive
---

VERDICT: pass

## Assessment (independent craft review, general-purpose reviewer, richer skill: pr-review)
(Note: the first craft dispatch misfired with tooling commentary + 0 tool-uses; this is the clean re-run.)

Correct, well-tested craft. Findings are nits only — no blockers.

## Strengths
- **Schema discriminated union is sound** — the pixel `oneOf` redeclares `type`+`vendor` inside each branch so
  `additionalProperties:false` actually bites; empirically `{vendor:"meta",pixelId,partnerId}` is REJECTED (a common
  discriminated-union footgun avoided). All valid shapes accept; no false-rejects/accepts (adversarial probes run).
- **Runtime validator a genuine SUBSET** — `validateConfig`/`validateConnectorEntry` relax only (tolerate absent
  `connectors` for back-compat; skip `additionalProperties`), so no schema-valid config is false-rejected; errors
  are index-scoped + actionable (`connectors[1] …`).
- **Inline-per-connector validation preserves 032-01's partial-boot cleanup** — a malformed later connector disposes
  the already-booted GA4 (`terminated===1`), no `window.airlock` installed.
- **No-ajv guard** greps eds.js + every emitted worker chunk (splitting:false ⇒ all chunks) + a re-asserting test.
- **README↔schema drift test** genuinely extracts the ```json block, parses, validates against the compiled schema.
  AC2 rejection tests non-vacuous (deleting `validateConfig` makes the not-an-array case silently no-op → test fails).

## Nits → reconciliation-log / optional follow-ups (all non-blocking)
1. **[nit] helix-rum `weight` runtime type-check untested** (adapters/eds/index.js:934-936) — the hand-rolled branch
   mirroring the schema's weight check has no red→green test/fixture (schema catches it; the top-level
   `consentStrict` test covers "wrong-typed field"). An extra untested branch, not an AC gap. Optional: add a
   runtime negative test + a contracts negative fixture.
2. **[nit] no-ajv check is a `/ajv/i` substring heuristic** (build.mjs:153) — `metafile.inputs` matching
   `node_modules/ajv` would be more precise/minify-independent. Defensible + double-covered; optional hardening.
3. **[nit] alloy-absence test asserts fixture content, not code behavior** — fine as a drift guard, weaker than the
   surrounding behavioral tests.
4. **[nit] `oneOf` on `type` yields noisy ajv errors** (10-18/negative) — the harness only checks binary
   accept/reject so it never matters operationally; `if/then` keyed on `type`/`vendor` would give better
   author-facing diagnostics if errors are ever surfaced. Pre-1.0 acceptable.

Reviewer: general-purpose (independent), richer skill pr-review. Re-run after a misfired first dispatch.
