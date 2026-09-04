---
slice: 032-01 — the config-driven `boot(config)`: connector dispatch + collapse the pixel-boot duplication
pass: compliance
verdict: pass
reviewer: general-purpose
reviewed_at: 2026-09-04T22:32:14Z
prompt_source: review.py implementation docs/specs/032-instrumentation-config/spec.md 032-01 <deliverables>
---

VERDICT: pass

## Assessment (independent compliance review, general-purpose reviewer)

All 5 ACs met + observable; re-run verification (not trust):
- `npm run lint` clean; the two target files 17/17 (`eds-boot-config.test.js` 10, `eds-boot-config-equivalence.test.js` 7);
  full suite **1007 pass** — sole failure the pre-existing, out-of-scope `dom-chamber-host-prism` ENOENT (prismjs
  absent in this partial-node_modules worktree).
- **All 4 seeded regressions independently re-verified red→green via mutation testing on a THROWAWAY copy** (the
  uncommitted deliverable never modified): AC4 GA4-only-dispose reds exactly the two composite-dispose/re-boot-leak
  tests; helix governance-leak reds the carve-out test; dropped-governance/forced-vendor reds exactly the AC2
  linkedin+bing dispatch + AC3 GA4+pixel consent-parity (meta + absent-vector correctly stay green — targeted, not
  blanket).
- AC2 collapse (`PIXEL_VENDORS`/`bootPixelConnector`, 3 boots as thin delegating wrappers), AC3 per-class governance
  (GA4/pixels threaded; helix-rum booted from `rest` only → `egressPurposes:[]`), AC4 hoisted
  `installOnWindow`+`createComposite` lifecycle — all as the spec's stated approach, no deviation.
- Design principles upheld (capture stays built-in; mapping/egress behind the airlock; host-owned endpoint ceiling;
  per-class governance; config deliberately pre-1.0, schema-pinning sequenced to 032-02). No new TODO/FIXME.

## Non-blocking finding (agrees with the arch pass)
- **`adapters/eds/index.js:867-876` (boot) — partial-boot orphan-worker leak on the error path.** `boot()` builds
  the composite + calls `installOnWindow` only AFTER the connector loop, so if a LATER entry throws (unknown
  `type`/`vendor`), earlier-booted connectors' Workers are never referenced or disposed. Malformed-config path only;
  full JSON-Schema validation is explicitly 032-02. Out of this AC's scope ("fail loud on unknown type," which it
  does) — worth folding into the deviation log / 032-02.

## Reconciliation notes
- Deviation log + sweep are still `_TODO`, DoD unchecked (orchestrator's reconciliation step). Fill: the
  shared-helper shape (`bootGa4Core` + `installOnWindow` hoist; 3 pixel boots delegate to `bootPixelConnector`), the
  GA4-from-config byte-equivalence finding (proven), the composite `getState`/`stats` read-from-`handles[0]` terminal
  choice, and the partial-boot-throw item.

Reviewer: general-purpose (independent). Pass: compliance (always-on).
