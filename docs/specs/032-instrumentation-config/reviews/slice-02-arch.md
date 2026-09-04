---
slice: 032-02 — the config contract (validated JSON Schema, pre-1.0) + breadth + the few-lines-instrument story
pass: arch
verdict: pass
reviewer: general-purpose (richer: arch-review)
reviewed_at: 2026-09-04T23:42:18Z
prompt_source: review.py arch-review docs/specs/032-instrumentation-config/spec.md 032-02 <deliverables> --richer-skill arch-review
substrate: non-interactive
---

VERDICT: pass

## Assessment (independent arch review, general-purpose reviewer, richer skill: arch-review)

Adds a public authoring-config contract (`contracts/instrumentation-config.schema.json`) modeled correctly as the
discriminated union it is, faithfully mirroring the runtime `bootConnector` dispatch. The four load-bearing
architectural calls are all sound + well-guarded. **No blockers.**

## The four calls (all sound)
1. **Union-shaped schema** — `oneOf` on `type` const (ga4/pixel/helix-rum); nested `oneOf` on pixel `vendor` (each
   requiring its id); helix-rum's governance-free `additionalProperties:false`. Matches the runtime exactly
   (`KNOWN_CONNECTOR_TYPES`, `PIXEL_REQUIRED_ID`, the carve-out).
2. **Kept a SEPARATE pre-1.0 surface, not a 6th frozen one** — marked PRE-1.0/not-frozen in 4 places (schema
   title+description, contracts/README § "Pre-1.0 contracts", README callout), cleanly separated from the five
   frozen surfaces' break-attribution semantics.
3. **No-ajv hand-rolled runtime subset** — enforced twice (build.mjs assertion + a test), protecting the
   CWV-critical bundle from ~100KB of dev dep. Drift bounded in the SAFE direction (runtime accept-set ⊆ schema;
   a schema-valid config always boots; the one lenience — `connectors` absent → no-op — documented back-compat).
4. **Honest alloy deferral** — grounded (no adapters/eds boot; different handle shape; spike-sized), stated in 4
   artifacts + refinement-todo trigger; the `{type:"alloy"}` negative fixture doubles as executable proof the
   contract rejects alloy.

## Nits → reconciliation-log items
1. **[nit][spec] architecture.md discoverability (WILL FIX in reconcile).** `docs/architecture.md` § "Contract
   surfaces" says "Five surfaces" with no cross-reference to the new pre-1.0 config surface — the `/jig:contracts`
   discovery anchor. The decision NOT to freeze it is correct; add a **one-line pointer** to contracts/README's
   pre-1.0 section (explicitly "not among the frozen five") so the architecture-level index surfaces the authoring
   boundary. (Implementer flagged this for the arch pass.)
2. **[nit][impl] subset-invariant test (optional, very low value).** The runtime-accept-set ⊆ schema-accept-set
   invariant is reasoned but not asserted; a test feeding each golden through both ajv + `validateConfig` would lock
   it against future drift. Optional.

## Open question
- README "Configure airlock" uses a bare `{type:"ga4"}` (schema-valid; endpoint optional → placeholder collect URL,
  consistent with the pre-existing `bootEdsAnalytics()` convention). Is the placeholder-endpoint default clear enough
  that an adopter knows GA4 still needs a real collect endpoint/measurement id? (Not a regression.)

Reviewer: general-purpose (independent), richer skill arch-review. arch_review: true (public contract artifact).
