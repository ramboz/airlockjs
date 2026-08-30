---
status: DRAFT
skill:
use_cases: [UC-1]
---

<!-- jig self-defining vocabulary (soft, forward-only): expand each acronym on first use and link the term to docs/memory/glossary.md. -->

# Spec 015: config-integrity enforcement — the seal's first teeth

## Overview

This is **MVP3's first enforcement spec** — the seal starts to bite. Spec 014 landed the wrapped-SDK
**dispatch seam** in `core/` (`core/wrapped-sdk-host.js`'s `caps.egress.dispatch`, the single chokepoint
every intercepted interact crosses, [ADR-0010](../../decisions/adr-0010-roundtrip-egress-capability.md)),
declared **gate-able but not yet gated**. Spec 013-03 grounded the **control** and confirmed the
**threat live**: a compromised alloy chamber can re-point its **datastream** (alloy's `configId`) to an
**attacker's Adobe tenant on the same allowed host** (`adobedc.demdex.net`) — real Edge accepts it
(013-03 AC1: honest/attacker HTTP 200, garbage 400), so the user's identity/analytics flows to the
attacker while every **host** allow-list check passes (the tenant rides *outside* the host/path the seal
keys on). This spec wires enforcement of that at the seam.

**The disposition — HOLD (fail-closed) is the default (015-01 frame-critique).** On **any** deviation the
dispatch is **held** — no real fetch leaves. A deviation is: the outbound **host** ≠ the host-pinned host
(so the seam is **not host-blind** — a chamber egressing to `evil.com?configId=<honest>` is held, not
"corrected-and-sent" to evil.com), **or** the outbound **tenant key** (`configId`) is absent, duplicated
(pollution), or ≠ the host-pinned value. Failing closed on the clearest attack (a valid attacker tenant
on the allowed host) is the point — silently correcting-and-sending it would forward the *attacker-shaped
body* into the honest tenant (a data-integrity injection; the `orgId`/body co-vector 013-03 left open).
**Scope of the check surface (015-01 ADR frame-critique).** The control keys on the outbound **URL**
(host + query tenant key). alloy's `orgId` rides in the **body**, not the URL, and 013-03 left open
whether `orgId` is an *independent* routing/identity vector — so an honest-`configId`-URL request
carrying an attacker `orgId` in the body would pass **unheld and unalerted**. That body-only co-vector
is an **unverified, currently-silent residual** ([ADR-0011](../../decisions/adr-0011-config-integrity-enforcement.md)
Kill criteria + residual; tracked in [refinement-todo](../../refinement-todo.md)), **not** covered
by this URL-surface control — named honestly rather than claimed neutralized.

**OVERRIDE is a named availability OPTION, not the default (015-02).** For deployments that prefer
*keep-working* over *block*, an opt-in **override** re-derives the dispatch to the host-pinned host +
tenant (`pinnedDispatchUrl`, evasion-proof against pollution/encoding since it never trusts the chamber's
value) and sends — but **always paired with the alert**, never silent, and only where the operator
accepted the body-integrity trade.

**ALERT ships WITH the enforcement (in 015-01, not deferred).** Every deviation — held or overridden —
is surfaced through the existing **009-02 diagnostics seam** (`onDiagnostic`), redacted of raw
identifiers (013-01 discipline), so a re-route attempt is **observed**, never silent.

**Generic mechanism, injected tenant-key (014-02 precedent).** `core/` holds the *generic* control —
pin the **host** + a **tenant key** — but which query param IS the tenant key (`configId` for alloy;
`measurement_id` for GA4) is a **connector/wire detail INJECTED** by the connector, not a hardcoded
`"configId"` in `core/` (which would be Adobe-specific and couldn't serve GA4).

**Scope — the wrapped-SDK async dispatch; GA4 is a deliberate DEFERRAL, not immune (013-03/015-01
frame-critique).** GA4 has the **same-class** threat: its `handle` maps *in the chamber*, so a compromised
GA4 chamber can emit `?measurement_id=<attacker>` on `google-analytics.com` — the identical same-host
tenant re-route. It is scoped out **on purpose** (the first bite is one connector, one seam), **not**
because GA4 "can't be re-pointed." Only GA4's **synchronous unload fast path** (`core/egress.js`,
orchestrator-mapped from host `endpoints`) is genuinely chamber-immutable — so binding config-integrity
to the **async** `caps.egress.dispatch` seam does side-step the 014 sync-gating sub-problem (there is no
*wrapped-SDK* egress on the sync path), but the deferral of GA4's async re-route is a tracked follow-up,
stated honestly.

**Not in scope:** the endpoint-**ceiling** (host-owned endpoint allow-list, its own spec) and
**purpose-vector consent** (ADR-0007). This spec is *only* config-integrity — but because the seal is
otherwise unbuilt at this seam, config-integrity here **must itself verify the host** (above), so its
override can never forward to an unconfined destination.

## Assumptions

<!-- Grounded 2026-08-30 by reading rig/config-integrity.js (013-03), core/wrapped-sdk-host.js +
     rig/alloy-core-host-harness.html (014-01), connectors/alloy/connector.js, ADR-0006/0010; risk-gated. -->

- **The dispatch seam exists + is gate-able (014-01, ADR-0010).** `core/wrapped-sdk-host.js`'s
  `dispatchInterceptedFetch` calls `caps.egress.dispatch(req)` — the single chokepoint. Grounded.
- **The control is demonstrated + the threat confirmed live (013-03).** `checkConfigIntegrity` +
  `pinnedDispatchUrl` (fail-closed, pollution-aware) are proven (7 creds-free tests); AC1 confirmed real
  Edge routes by `configId` on the shared host. This spec **wires + hardens** it (adds the host check +
  the injected key), it does not re-litigate it. Grounded (`rig/config-integrity.js`; 013-03 DONE).
- **The host pin is real + chamber-immutable, but must be THREADED in (015-01 frame-critique [2]).** The
  pin is the orchestrator-set `config.datastreamId` (+ the expected host), passed main-thread → chamber
  via `host.init({ config })` (`rig/alloy-core-host-harness.html` L29-34/L123), never mutated by the
  worker. But `createWrappedSdkHost` today takes only `{ chamber, caps, timeoutMs }` — the pin must be
  threaded through (a new opt, or captured from the init message) at the seam, separate from the
  chamber's outbound `m.url`. Grounded (`core/wrapped-sdk-host.js`).
- **`configId` is the tenant key for alloy, `measurement_id` for GA4 — INJECTED, not hardcoded in core**
  (015-01 frame-critique [4]). The tenant key + expected host are connector/manifest-declared and injected
  into the generic core control. Grounded (`connectors/ga4/map.js` uses `measurement_id`).
- **An ADR formalizes the disposition** — the config-integrity requirement 013-03 filed is not yet in
  ADR-0006 (its endpoint ceiling is tenant-blind). This spec authors the config-integrity ADR
  (**hold-fail-closed default incl. the host; override a named option; GA4 deferred; the `orgId`/body
  residual**) as 015-01's first step, so the other MVP3 enforcement specs bind to a recorded disposition.

## Decomposition

SPIDR = **Rules (R)** — a gating rule (config-integrity) enforced at an existing seam; the mechanism
(014 dispatch) + the control (013-03) both exist. Split by **disposition strength** (the R-axis): the
**fail-closed default** (hold + alert — the security value, complete on its own) first, then the
**availability variant** (override — a softer, opt-in disposition). Each binds the rule at the real
`core/` seam end-to-end (a re-pointed chamber's egress → the seam), so neither is horizontal.

- **015-01 `[R]` fail-closed enforcement (HOLD + ALERT)** — wire the generic control (host + injected
  tenant-key) into `core/wrapped-sdk-host.js`'s dispatch: on **any** deviation (host mismatch, tenant
  absent / duplicate / mismatch) **HOLD** — no fetch — and emit a redacted **diagnostic** through the
  009-02 seam. E2E: a re-pointed core-hosted chamber (attacker tenant on the allowed host, or a foreign
  host) is **blocked** + surfaced; the honest path is unchanged + silent. + the config-integrity ADR.
- **015-02 `[R]` override availability option** — an **opt-in** disposition that, instead of holding,
  **re-derives** the dispatch to the host-pinned host + tenant and sends (`pinnedDispatchUrl`) — still
  **alerting** — for deployments that prefer availability, having accepted the attacker-shaped-body
  trade. E2E: with override on, a re-pointed chamber egresses to the **host** tenant/host (corrected),
  with a diagnostic; default (override off) still holds.

## Slices

1. [015-01 — fail-closed enforcement (hold + alert)](slice-01-fail-closed-enforcement.md)
2. [015-02 — override availability option](slice-02-override-option.md)
