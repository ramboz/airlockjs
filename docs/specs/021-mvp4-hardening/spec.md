---
status: IN_PROGRESS
skill:
use_cases: []
---

<!-- jig self-defining vocabulary (soft, forward-only): expand each acronym on first use and link the term to docs/memory/glossary.md. -->

# Spec 021: MVP4 low-hanging-fruit hardening — dispose guard, transport pin, eslint scope

## Overview

MVP4's **low-hanging fruit** ([mvp4.md](../../docs/releases/mvp4.md) Include row) — the tracked
production-readiness closures the release bundled alongside the alloy governance (spec 020, DONE) and the
`helix-rum` connector (separate — NOT this spec). Three small, independent hardening items, each a real
residual from MVP1–3:

- **021-01 — dispose / idempotent-boot guard (OQ12 item 4).** `core/airlock.js` registers global
  `visibilitychange` / `pagehide` unload listeners (airlock.js:271-275) with **no teardown**, spins a Worker
  with no `terminate`, and `bootEdsAnalytics` overwrites `window.airlock` on a re-boot. Once-per-page on EDS
  so accepted for MVP1–3, but a **library distribution** (OQ8, MVP6) needs a `dispose()` + an idempotent-boot
  guard so a re-boot does not leak a Worker + listeners.
- **021-02 — egress transport pin (http-downgrade; ADR-0004 egress allow-list).** The 015-02 review named a
  **protocol-blindness** residual: config-integrity keys on `.host` (not scheme), so an `http://` downgrade to
  the honest host+tenant passes it, forwarding identity/analytics over cleartext. **Grounding-first:** the
  016 endpoint-ceiling checks `origin` (which INCLUDES the scheme — `http://h` ≠ `https://h`), so it may
  already reject a downgrade to a declared `https://` origin; this slice first grounds the actual coverage
  (ceiling + the config-integrity `override` re-derive path, which preserves the chamber's scheme), then pins
  `https` exactly where a real gap remains (per ADR-0004's transport concern), not speculatively.
- **021-03 — alloy-chamber eslint-disable scope (014-01 craft residual).** The blanket `eslint-disable` in
  `connectors/alloy/alloy-chamber.worker.js` (untouched since 014-01, read-only there) is over-broad — narrow
  it to the specific rules the vendor-shim code needs, restoring linting for the rest.

## Assumptions

<!-- Grounded 2026-08-31 by reading core/airlock.js (unload listeners + no dispose), adapters/eds/index.js
     (window.airlock overwrite + the __airlock*Wired idempotency guards), core/endpoint-ceiling.js (originPath
     drops scheme but origin includes it), refinement-todo OQ12/015-02/014-01; risk-gated. -->

- **The dispose gap is real + bounded.** `core/airlock.js` adds `addEventListener` for `visibilitychange` +
  `pagehide` with no `removeEventListener`, and creates a Worker with no `terminate`; the returned handle has
  no `dispose`. `bootEdsAnalytics` sets `window.airlock` unconditionally. The adapter's `__airlockWired` /
  `__airlockExposureWired` / `__airlockBlocksWired` guards cover the *listener* double-wire but not the Worker
  or `window.airlock`. **Grounded** (read).
- **The transport residual's actual coverage is UNKNOWN and must be grounded before pinning.** `origin`
  includes the scheme, so the ceiling may already reject an `http://` downgrade to a declared `https://`
  origin — but the config-integrity `override` (015-02) re-derives via `pinnedDispatchUrl` which preserves the
  chamber's scheme, a candidate real gap. **Assumption, grounded in 021-02.**
- **The eslint-disable is over-broad + `alloy-chamber.worker.js` is now writable** (it was read-only for
  014-01). **Grounded** (read).

## Decomposition

SPIDR = **Rules (R)** — three independent hardening rules, each end-to-end (a re-boot doesn't leak; a
downgraded egress is held; the linter runs on the un-disabled code). Split by item (they touch different
surfaces + carry independent risk); none is horizontal (each changes an observable runtime/CI behaviour).

## Slices

1. [021-01 — dispose() + idempotent-boot guard](slice-01-dispose-idempotent-boot.md)
2. [021-02 — egress transport pin (http-downgrade), grounding-first](slice-02-transport-pin.md)
3. [021-03 — narrow the alloy-chamber eslint-disable](slice-03-eslint-scope.md)
