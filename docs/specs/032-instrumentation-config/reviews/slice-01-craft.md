---
slice: 032-01 — the config-driven `boot(config)`: connector dispatch + collapse the pixel-boot duplication
pass: craft
verdict: pass
reviewer: general-purpose (richer: pr-review)
reviewed_at: 2026-09-04T22:52:56Z
prompt_source: review.py pr-review docs/specs/032-instrumentation-config/spec.md 032-01 <deliverables> --richer-skill pr-review
substrate: non-interactive
---

VERDICT: pass (after one needs-changes → fix → re-review cycle)

## Assessment (independent craft review, general-purpose reviewer, richer skill: pr-review)

The refactor is clean and the load-bearing lifecycle claims hold. The one blocker is fixed at the right layer.

## The [blocker] (first pass) and how it was fixed — genuinely resolved
**Blocker:** the composite `push()`/`pushCritical()` fanned to EVERY connector, but helix-rum has no event allowlist
(`mapToRum` maps any `event.type` → a `checkpoint` beacon to `ot.aem.live`). So a `[ga4, helix-rum]` config leaked
arbitrary site event NAMES to the RUM collector as checkpoints — contradicting the "each mapper decides" model.

**Fixed + re-verified (pass):** `createComposite` gates delivery via `acceptsEvent(events, name) = events.includes("*")
|| events.includes(name)` at the composite delivery point (covers `push` AND `pushCritical`), so a non-vocab event
never reaches helix-rum's handle/ring/chamber. `bootConnector` returns `{handle, events}` with sound vocabularies:
GA4 `["*"]`, helix-rum `["top","error","cwv"]` (mirrors its manifest), pixels re-derived from the same vendor
factory the worker manifest uses (no drift). helix-rum's own `top`/`error`/`cwv` capture is untouched (flows through
its sub-handle inside `bootHelixRum`, not the composite). GA4 still catch-all; pixels still their `eventMap`. Doc
updated honestly. New "fan-out gate" tests are non-vacuous (`crossedTypes` reads what actually postMessaged to the
worker; both assertions flip if the gate is removed).

## The two nits — both resolved
- **Partial-boot leak:** `boot()` wraps the loop in try/catch and disposes every booted handle before rethrowing
  (`window.airlock` untouched on the error path). New test witnesses ga4 Worker `terminated===1` after a mid-loop
  throw — genuine red→green. Restores 021-01 on the error path.
- **getState/stats ordering:** documented caveat added (reads track connector[0]); no behavior change — right
  resolution for a doc nit.

## Strengths
- Gating at the composite delivery point is the correct layer (event never reaches helix-rum's ring → nothing
  spurious can egress); covers `pushCritical` too.
- The gate tests are well-isolated (`crossedTypes` reads the worker's posted batches; negative proves the leak
  closed, positive `top` proves it doesn't over-block, counting separates composite-delivered from boot-time).
- Partial-boot cleanup restores 021-01 on the error path, witnessed via `terminated===1` + `window.airlock` undefined.

## Residual non-blocking nits → reconciliation-log items
1. **`GA4_MANIFEST_EVENTS`/`HELIX_RUM_MANIFEST_EVENTS` are LOCAL MIRRORS** of the connectors' own `manifest.events`,
   kept correct by a "keep in sync" comment (the pixel path avoids this by deriving from the vendor factory). A
   single source of truth (importing the vocabularies from the connector modules) would remove the drift risk —
   but the manifests are instance-constructed inside factories, so this is a reasonable pre-1.0 pragmatic choice
   (flag the drift-coupling; a candidate follow-up, esp. re 022's checkpoint widening).
2. The pixel path calls `PIXEL_VENDORS[vendor].createConfig(ids)` a second time to derive the vocabulary (harmless,
   pure/id-independent; having `bootPixelConnector` return the eventMap would avoid the double call). Trivial.

Reviewer: general-purpose (independent), richer skill pr-review. Recovery: needs-changes → fix → re-run → pass.
