---
slice: 033-02 — build: config-boot alloy (the analytics vertical) — `{type:"alloy"}` in `boot(config)`
pass: frame-critique
verdict: pass
reviewer: general-purpose (independent frame-critique, 2 rounds)
reviewed_at: 2026-09-05T01:37:47Z
prompt_source: review.py frame-critique docs/specs/033-alloy-config-wiring/spec.md 033-02 <deliverables>
---

VERDICT: pass (after one needs-changes round) — frame-critique, slice 033-02

An independent frame-critique reviewer verified the DoR grounding against source (confirmed every cited surface:
`bootConnector`/`KNOWN_CONNECTOR_TYPES`/`createComposite`/`acceptsEvent`, `createWrappedSdkHost`'s no-dispose/no-Worker-spawn,
the strict `egressVerdict` gate, alloy `manifest.events`/`egress`, `alloy-chamber.worker.js:377`), confirmed the
consent-purposes claim (interact egress = analytics_storage + personalization; ad_storage attaches only to the
server-directed demdex cookie — out of scope), and confirmed the SPIDR analytics/personalization split is a legitimate
vertical (analytics-only alloy is coherent — the connector no-ops decisions when the cap is ungranted).

**First pass: needs-changes** — three load-bearing findings, all fixed:
1. **AC2 multi-event hang.** `createWrappedSdkHost.driveEvent` dispatches its queued event ONLY on the one-time
   `phase:"configured"` message (`:389`); a 2nd `driveEvent` sets `queuedEvent` but is never re-triggered → hangs
   (`:440-450`). The "sequential single-slot queue" framing presupposed multi-event support that does not exist.
   **Fixed:** AC2 renamed "bootAlloy adapter + a multi-event host" and names the host extension (dispatch
   post-`configured` events immediately → N sequential events) as `core/wrapped-sdk-host.js` work, flagged for arch
   review, no-regress-single-event-callers; separated from adapter serialization + Worker ownership. AC6 now drives a
   2nd page_view (soft-nav) and asserts it reaches the seam — the witnessing test.
2. **AC4 build assertions understated.** Not just a 2nd esbuild call + out-namer: the layout assertions must be
   reworked across BOTH build results (alloy specifier → `EXPECTED_WORKER_SPECIFIERS`, emitted output →
   `emittedBasenames` + the negative scans; else `build.mjs:124-137` fails once `eds.js` carries the new-Worker
   specifier), AND `publish-dist.mjs`'s `DIST_ARTIFACTS` (`WORKER_ENTRIES`-derived, `:36-39`) must be extended or the
   consumer 404s. **Fixed:** AC4 names both.
3. **DoD live-host TT residual.** AC1/AC6's proof is hermetic (stub bundle, captured CSP); the live-host TT re-confirm
   + real 766 KB bundle boot "rides 033-02's proof" but no AC carried it. **Fixed:** a "Residual (carried forward —
   NOT retired here)" paragraph makes it a deploy/creds-gated follow-up, not claimed retired.

**Re-verify: pass.** One cosmetic nit (the "GA4-retrofit callers" example was loose — GA4 uses the separate
fire-and-forget path) fixed post-verdict: the no-regress constraint now names the real callers (alloy rigs +
`test/wrapped-sdk-host.test.js`).

Reviewer: general-purpose (independent frame-critique, 2 rounds).
