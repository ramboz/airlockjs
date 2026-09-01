---
status: DRAFT
dependencies: [022-01]
last_verified: 2026-09-01
frame_review: false
---

## Slice 022-02 — error checkpoints + sampling-rate fidelity

> Reshaped 2026-09-01 (maintainer "do the split"): the CWV/interaction checkpoints moved to **022-04** (they
> need a new runtime capture — 022-01's grounding showed the enhancer can't host in a chamber). This slice is
> the **no-new-capture** remainder: the `error` checkpoints + full sampling-rate fidelity.

**Goal:** Extend the DONE 022-01 `helix-rum` connector to cover every **non-CWV** `sampleRUM` checkpoint — the
`error` checkpoints and the full sampling-rate config — so the only thing standing between airlock and a
complete `sampleRUM` stand-in is CWV (022-04). Each rides the **same** 022-01 confined, not-consent-gated
governed path; no new capture machinery.

**DoR:**
- ✅ 022-01 DONE: the `helix-rum` connector (`connectors/helix-rum/{connector,map}.js`), its governed path
  (endpoint-ceiling + no-egress-purposes → confined, not consent-gated), the `top` checkpoint, and
  sampling state (`id`/`isSelected`/`weight`) fixed once at construction. **Grounded** (in-repo).
- ✅ The `error` checkpoint surface is grounded — `probes/eds-testbed/scripts/aem.js:68-92`: three window
  listeners (`error`, `unhandledrejection`, `securitypolicyviolation`) each call `sampleRUM('error', errData)`
  where `errData = { source, target }` (`source` = the first `https?://` stack frame, `target` = the error
  string). **Grounded** (read 2026-08-31).
- ✅ The sampling-rate table is grounded — `aem.js:23-34`: `on`=1 / `high`=10 / `medium`=100 (default) /
  `low`=1000 / `off`=0, resolved from a rate source (URL param / `SAMPLE_PAGEVIEWS_AT_RATE` / script dataset).

**Acceptance Criteria:**

1. **The `error` checkpoints ride the governed path.** The connector's `events` widens `["top"]` →
   `["top","error"]`; a captured `error` checkpoint maps to the grounded RUM body `{ weight, id, referer,
   checkpoint:"error", t, ...errData }` where `errData = { source, target }` matches `sampleRUM`'s own
   `dataFromErrorObj` shape (`aem.js:49-66`). It egresses via the **same** confined, not-consent-gated
   022-01 path (endpoint ceiling; no consent gate). The three main-thread capture points (window `error` /
   `unhandledrejection` / `securitypolicyviolation`) are the host's `push({event:"error", ...})` calls (the
   capture wiring itself is the deferred production-adapter question 022-01 flagged — this slice proves the
   connector maps + governs them, at the connector+seam fidelity 022-01 established).
   **Payload-hygiene note (named, not hidden):** `errData.target` is `error.toString()` — a faithful
   reproduction of what `sampleRUM` already sends; if an app throws an error whose message embeds user input,
   that rides today via the page's own `sampleRUM` identically. airlock reproduces the grounded shape (no
   *additional* fields); tightening `error.toString()` itself is a `sampleRUM`-inherent question, out of scope
   here — recorded as a known boundary.
2. **Sampling-rate fidelity.** The connector accepts a host-supplied rate (the `on/high/medium/low/off` names
   → `1/10/100/1000/0`, default `medium`=100) — mirroring `aem.js`'s table — and `isSelected` honors it.
   Observable: a given rate → the correct `weight` in the beacon URL + body; an **unselected** page-load emits
   **nothing** for **every** checkpoint (`top` and `error` alike — `isSelected` is decided once, per 022-01),
   not just the first.
3. **No regression + uniform governance.** 022-01's `top` path is byte-unchanged; the `error` checkpoints use
   the identical endpoint-ceiling + no-consent-gate governance (a re-pointed `error` beacon is held exactly
   like a re-pointed `top`); `id`/`weight` are shared across a page's `top` + `error` (one per-page identity).

**DoD:**
- [ ] ACs pass. Tests (targeted — suite hangs): `error` checkpoint maps to the grounded shape + rides the
      governed path; rate-name → weight resolution; unselected → silent for `top` AND `error`; a re-pointed
      `error` beacon held; no-regression to `top`. Sweep: `helix-rum-*`, `endpoint-ceiling-seam`.
- [ ] Reviews: compliance + craft + reconciliation (frame_review:false — a grounded extension of 022-01's
      pattern, no new load-bearing unknown).
- [ ] Deviation log + reconciliation sweep; `mvp4.md` row updated (`error` + sampling done; CWV = 022-04).
- [ ] **No live identifiers committed** (synthetic error/stack data + ids only).

**Anti-horizontal-phasing check:** airlock now governs the full **non-CWV** RUM surface (errors included) at
the same confined, not-consent-gated class — an observable widening of what crosses the seal, riding the
022-01 vertical. CWV (the remaining surface) is 022-04; the cutover (022-03) waits for both.
