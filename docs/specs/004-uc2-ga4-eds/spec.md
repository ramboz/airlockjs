---
status: DONE
skill:
use_cases: [UC-2]
---

# Spec 004: UC-2 — GA4 analytics on a real EDS page

> Graduates the risk-retirement spike's runtime seed (spec 003:
> [core/](../../../core/), [connectors/ga4/](../../../connectors/ga4/)) from a
> synthetic INP rig to a **real EDS page** — the first of the three MVP1 demo
> items ([mvp1 release plan](../../releases/mvp1.md)), and the one with the
> strongest oracle (`ga4_mp_conformance` is externally validatable).

## Overview

**Goal:** On the [EDS testbed](../../../probes/eds-testbed/), the airlock GA4
runtime — **bundled** and loaded in the **lazy phase** (AD-8: analytics is lazy) —
captures a real page interaction and delivers an **MP-conformant GA4 beacon
end-to-end**, with `client_id` / `session_id` sourced from the `_ga` cookies via
the mediated cookie capability, at **~zero CWV cost** proven by a real before/after
Lighthouse run — all under the EDS boilerplate's real **CSP + Trusted Types**.

**What it builds** (consuming the pinned contracts + ADR-0001/0002/0003/0004):
the bundle step and the `adapters/eds/` wiring that boots the runtime in the lazy
phase; the `push()` surface reconciled to the pinned
[push-api.md](../../../contracts/push-api.md) shape (`push({ event, ...params })`);
the orchestrator-side `_ga` / `_ga_<stream>` cookie parse that builds the GA4 ctx
(mediated cookie capability, [capability.d.ts](../../../contracts/capability.d.ts));
the ADR-0004 `pushCritical` wiring for the outbound-link / closing-pageview last
beacon; and the before/after CWV scoreboard on the real page.

**Why it is not "just run the spike on the testbed":** three real gaps the spike
deliberately left open surface only on a real EDS page — (1) the boilerplate CSP
(`script-src 'nonce-aem' 'strict-dynamic' …`, **no `worker-src`**) plus
`require-trusted-types-for 'script'` may block `new Worker({ type: "module" })`
outright (R-005 open question #3, unretired); (2) the spike's `push({ type,
params })` shape is **not** the pinned `push({ event, ...params })` contract; (3)
the spike fed a static `ctx`, where a real page must parse `_ga` cookies
defensively and persist a `client_id` when absent.

**Out of scope:** UC-1 (above-the-fold PZN) and UC-3 (block-decoration) — the other
two demo items; MVP2 alloy / the wrapped-SDK archetype; OQ9 (multi-chamber
sync-access), OQ11/OQ3 (payload governance / schema); the servo oracle wiring + CI
(drive-order steps 8–9, a separate work item); the cross-API idempotency guard and
extreme-early-close backlog parked in ADR-0004.

**Oracle routing (jig-supervised).** `ga4_mp_conformance` is servo-able (hermetic
schema + golden fixture). The **CWV scoreboard is jig-supervised** — Lighthouse LCP
is statistical and rIC-protected, so a before/after delta is human-read, not a
servo-unattended gate (mvp1 release plan; product-vision § How new work enters).

## Assumptions

- **`new Worker({ type: "module" })` under the EDS boilerplate CSP + Trusted Types
  is the load-bearing unknown.** The testbed CSP has no `worker-src`/`child-src`, so
  worker-source falls back to `script-src 'nonce-aem' 'strict-dynamic' 'unsafe-inline'
  http: https:`; whether `'strict-dynamic'` admits a same-origin module worker, and
  whether the `Worker` constructor's URL is accepted under
  `require-trusted-types-for 'script'` (the boilerplate ships a `default` TT policy
  whose `createScriptURL` passes through — `scripts.js`), is **browser-dependent and
  unverified**. [To be retired in slice 004-01 by an executed Playwright probe on the
  real testbed CSP — Kill criteria. R-005 open question #3.]
- **Bundling + lazy-phase load makes the runtime's LCP impact ~0.** The spike
  measured TBT 0 / CLS 0 and attributed its ~172ms LCP gap to unbundled eager
  dev-serving (a 4-module chain). [To be confirmed by the real before/after
  Lighthouse in slice 004-04; if the delta is not ~0, characterize honestly — the
  spike's prediction is a hypothesis, not a result.]
- **`_ga` / `_ga_<stream>` cookie grammar is community-derived, not Google's
  schema, and must be parsed defensively** (ga4-mp.md § Provenance). client_id = the
  cookie's last two dotted segments; session_id from `_ga_<stream>`. [Grounded in
  contracts/ga4-mp.md; the parse must tolerate GS1/GS2 drift.]

## Decomposition

**SPIDR axis: Spike-first, then Path.** The dominant uncertainty (the CSP/Worker/TT
gate) is retired first as a spike slice — it is cheap to probe and its outcome
shapes every later slice (a blocked worker forces a CSP accommodation or a no-worker
fallback). The remaining slices walk the real GA4 flow along one path — load the
bundled runtime in the lazy phase, source identity from cookies, then close the
end-to-end loop with the CWV scoreboard — each delivering an observable increment on
the real page, never intermediate state.

### Slices

1. **[004-01 — Worker + Trusted Types under the EDS CSP](slice-01-worker-under-csp.md)**
   *(spike, risk-first)* — prove `new Worker({ type: "module" })` instantiates and
   runs one cycle under the testbed's real CSP + TT; if blocked, pin the minimal
   accommodation. Retires the graduation's load-bearing risk.
2. **[004-02 — bundle + lazy-phase boot + `push()` contract](slice-02-bundle-lazy-boot.md)**
   — bundle the runtime (esbuild) into one module, boot it in `scripts.js#loadLazy`
   (AD-8), and reconcile the `push()` surface to the pinned `push({ event,
   ...params })` contract. Delivers: a contract-shaped `push` on the real page flows
   an event to the worker, bundled, after `appear`.
3. **[004-03 — GA4 ctx from `_ga` cookies (mediated cookie capability)](slice-03-ga4-cookie-ctx.md)**
   — the orchestrator reads + defensively parses `_ga` / `_ga_<stream>` on the main
   thread, persists a `client_id` when absent, and supplies the minimal ctx
   snapshot; the connector maps a real MP payload from it (conformance-checked).
4. **[004-04 — end-to-end GA4 + before/after Lighthouse](slice-04-e2e-and-lighthouse.md)**
   — a real interaction (CTA click → event; outbound-link click → `pushCritical`
   per ADR-0004) delivers an MP-conformant beacon end-to-end, and a real before/after
   Lighthouse on the testbed page shows ~zero CWV cost — the UC-2 punchline.

## Findings

- **004-01 (risk retired):** the airlock worker **runs under the unmodified EDS
  boilerplate CSP** (`script-src 'nonce-aem' 'strict-dynamic' …`, no `worker-src`)
  with `require-trusted-types-for 'script'` active — `new Worker({ type: "module" })`
  constructs and cycles a mapped GA4 request, verified against a **negative control**
  that proves the CSP is enforced (`npm run rig:csp` → `runs_under_boilerplate:
  true`, `csp_enforced: true`, `egress: 2`). **No CSP accommodation needed.** The
  load-bearing unknown of the whole graduation is retired; R-005 open question #3 is
  answered (yes). The probe keeps a tested `worker-src 'self' [blob:]` escalation
  ready should a stricter real-deploy CSP ever require it._
- **004-02 (bundle + lazy boot + `push()` contract):** the runtime runs **bundled**
  (esbuild two-entry, same-origin file worker per the 004-01 CSP verdict), booted in
  the EDS **lazy phase** after `body:appear`, with `push()`/`pushCritical()` reconciled
  to the pinned `{ event, ...params }` contract. Proven on the real `index.html`.
- **004-03 (GA4 ctx from `_ga` cookies):** identity is sourced **host-side** — `_ga`
  client_id (generated + persisted GA1-format when absent), `_ga_<stream>` session_id
  (per-page fallback) — and only the **minimal `{ clientId, sessionId }` snapshot**
  (ADR-0003) crosses to the runtime; identity flows cookie→ctx→beacon on the real page.
- **004-04 (end-to-end + before/after Lighthouse) — the punchline:** a **real,
  non-navigating interaction** (`#cta-engage`) delivers an MP-conformant GA4 beacon via
  the **worker cycle while the page is still alive** (`rig/e2e.mjs`), and the
  unload-critical **outbound-link + closing `page_view`** take the ADR-0004
  `pushCritical` fast path (delivered in a teardown window, closing carries the current
  URL). **Before/after Lighthouse** on the real testbed (5 iterations/arm, runtime off
  vs on): **perf 77→77, TBT delta 0 ms, CLS delta 0** — within the ~0 band; the LCP
  spread is dev-serving noise (post-LCP lazy boot), not runtime cost. OQ12 items 1–3 +
  the `workFactor` prune resolved (`contracts/push-api.md` pins `pushCritical`).

## Outcome

**UC-2 is a believable demo on a real EDS page — the punchline lands.** The airlock
GA4 runtime, bundled and lazy-loaded under the unmodified EDS boilerplate CSP + Trusted
Types (004-01), captures a real interaction, cycles it off-thread, maps it to an
MP-conformant GA4 beacon with real cookie-sourced identity (004-03), rescues the
unload-critical last beacon via the ADR-0004 fast path (004-04), and does all of it at
**~zero page-load CWV cost** (before/after Lighthouse: perf 77→77, **TBT delta 0, CLS
delta 0**, LCP within dev-serving noise). The `ga4_mp_conformance` oracle is green on
the cookie-sourced path, and the runtime is INP-safe by construction (spec 003).

`Outcome: UC-2 graduated to the real EDS testbed — bundled + lazy-phase runtime, real
_ga-sourced identity, end-to-end MP-conformant beacon (worker cycle) + unload-critical
fast path, at ~zero CWV cost (TBT/CLS delta 0). ga4_mp_conformance green. OQ12 items
1–3 + workFactor resolved (push-api.md pins pushCritical). Reproducible: npm run
rig:e2e, LH_N=5 npm run lh:eds. Remaining MVP1: UC-1 (PZN), UC-3 (block-decoration),
servo oracle wiring + CI; open follow-ups OQ12 item 4 (dispose guard), OQ13 (identity
follow-ups), the live GA4 endpoint + aem-up Lighthouse.`
