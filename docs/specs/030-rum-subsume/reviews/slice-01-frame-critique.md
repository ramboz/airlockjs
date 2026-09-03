---
slice: 030-01 — the connector-generic unload dispatcher
pass: frame-critique
verdict: pass
reviewer: general-purpose
reviewed_at: 2026-09-03T23:40:12Z
prompt_source: review.py frame-critique 030 'RUM authority' + deliverables (re-scoped to 'unload dispatcher')
---

**Verdict: PASS** (adversarial pass returned **NEEDS-CHANGES** with a MAJOR catch; resolved by the maintainer's
"build it" decision + a re-scope; the corrected frame is sound).

**The catch (load-bearing, missed in the original framing):** the spec claimed "no new core capability — the
subsume is page-side wiring; emission is DONE (022)." That is FALSE for INP. INP (and often late CLS/LCP)
finalize only at page-hide; `cwv-capture.js` routes every metric through the async `push()` worker path, which
cannot complete at teardown; airlock's ONLY synchronous unload egress
(`unloadFlush`→`criticalDispatchGated`→`critical.dispatch`, `airlock.js:335-364`) is hardwired to GA4's `mapToMp`
(`egress.js:30,65`). Pixel is already gated OUT of the unload path (`connector!=="pixel"`, `airlock.js:429-436`)
because its map lives in the worker — its teardown events are dropped. RUM's `mapToRum` lives in the chamber too.
So a faithful RUM authority CANNOT egress INP — the flagship CWV — without new core work. Invisible to the
planned tests (the fake-emitter AC asserts "reaches the push surface"; goes green while INP never egresses).

**Resolution — the maintainer chose (a) "build it — complete RUM authority" (2026-09-03):**
1. **Retired "no new core capability".** The spec now scopes the core work in as **030-01 — the connector-generic
   unload dispatcher**: generalize `createCriticalDispatcher` to take a connector's main-thread mapper (DI,
   default `mapToMp` — GA4 byte-unchanged), so RUM's `mapToRum` (and the freed pixel GET) egress synchronously at
   page-hide. Re-decomposed 3→4 slices (dispatcher first, then the RUM authority, then replace, then boundary).
2. **The hazard is WITNESSED** — 030-01 AC4 requires a `cwv` finalizing at `visibilitychange`→hidden to egress a
   RUM beacon (red under the old GA4-hardcoded path).
3. **Chamber round-trip + endpoint-ceiling coupling grounded** — 030-02 AC2 requires the main-thread ceiling to
   match the worker connector's resolved `weight` (022 never routed a RUM event through a chamber).
4. **Secondary nits fixed** — `web-vitals` reworded as a runtime dependency (not devDep); the Overview headline
   aligned with the creds-gated-cutover bound.

The core premise (a scoped, opt-in "replace" of the core checkpoints) survived; with the unload-window CWV now
BUILT, it is a complete-CWV authority, not a partial one. The build/selection "byte-unchanged" claim is low-risk
(build.mjs is N-worker-generalized; the seam is a pure added branch). Frame sound → PASS to implement.
