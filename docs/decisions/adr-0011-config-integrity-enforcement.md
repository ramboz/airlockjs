---
status: Accepted
dependencies: [ADR-0004, ADR-0006, ADR-0010]
last_verified: 2026-08-30
frame_review: true
---

# ADR-0011: Config-integrity enforcement — host + tenant pin, fail-closed hold

## Status

Accepted (2026-08-30)

## Context

The airlock seal keys egress on endpoint **host/path** — ADR-0004's host allow-list and
ADR-0006's endpoint ceiling both gate on *where* (which host, which path) a request goes. But a
wrapped-SDK connector's **tenant-routing key** rides *outside* that key: for alloy it is the
**datastream**, carried as the `configId` query parameter on an otherwise-allowed interact URL
(`adobedc.demdex.net`). A single shared host serves every Adobe tenant; which tenant an interact
lands in is decided by `configId`, which the host/path allow-list never inspects.

Spec 013-03 confirmed this threat **live against real Adobe Edge**: a compromised alloy chamber
that re-points its datastream to an **attacker's Adobe tenant on the same allowed host** sends the
user's identity/analytics to the attacker while **every host-allow-list check passes** — real Edge
accepts the re-pointed datastream (013-03 AC1: honest and attacker datastreams both return HTTP
200; a garbage datastream returns 400 — so routing is genuinely tenant-keyed on `configId`, end to
end, on the shared host). Host-owned config *at boot* is necessary but **not sufficient**: the
whole vendor runtime lives inside the chamber (ADR-0009/spec 012), so compromised code can
re-`configure` alloy, or bypass alloy entirely and craft its own `?configId=<attacker>` fetch. The
only enforceable chokepoint is the **egress seam** — the orchestrator's main-thread dispatch every
intercepted interact crosses.

Spec 014 landed exactly that seam in `core/`: `core/wrapped-sdk-host.js`'s
`dispatchInterceptedFetch` calls the declared-and-gated `caps.egress.dispatch(req)` capability
(ADR-0010), declared **gate-able but not yet gated**. ADR-0006's endpoint ceiling is **tenant-blind**
by construction (it ranges over hosts/paths, not tenant keys), and neither ADR-0004 nor ADR-0006
carries a tenant-scoped control. This ADR decides **how** config-integrity is enforced at that seam.

## Decision Options Considered

### Option A: Host/endpoint allow-list only (status quo — ADR-0004 + ADR-0006)
- **Pros:** already built; covers foreign-sink exfiltration (a different host).
- **Cons:** **tenant-blind** — the confirmed 013-03 threat (attacker tenant on the *allowed* host)
  passes every check. Rejected: it is precisely the gap this ADR exists to close.

### Option B: Parse the chamber's outbound tenant key and compare against a pin; hold on mismatch
- **Pros:** catches the naive re-point.
- **Cons:** a single-value parse **trusts a URL the hostile chamber fully controls** — parameter
  pollution (`?configId=<honest>&configId=<attacker>`), encoding, or a path-embedded id slips past
  a `.get()` that reads the first value. Insufficient **as stated**; it must be pollution-aware
  (`getAll`) and fail-closed. Folded into Option C rather than adopted alone.

### Option C: Fail-closed HOLD on any deviation (host **and** tenant), generic mechanism + injected tenant key, alert paired — with override as a named opt-in ✅
- **Pros:** fails closed on the clearest attack; not host-blind; evasion-proof (never trusts the
  chamber's self-report); vendor-neutral; every deviation observed. **Chosen.**
- **Cons:** the pin must be threaded to every wrapped-SDK host; each connector must declare its
  tenant key; the override option carries a documented body-integrity residual (below).

**Also considered and rejected inside Option C's design:**
- **Override as the *default* disposition** (silently re-derive the honest tenant and send). Rejected
  in the 015-01 frame-critique: silently correcting-and-sending the clearest attack **inverts the
  threat response**, and it **forwards the attacker-shaped request body** into the *honest* tenant (a
  data-integrity injection — the `orgId`/body co-vector 013-03 left open). Override survives only as
  an **opt-in** availability choice, never the default.
- **Tenant-only check (no host pin).** Rejected in the same critique: without a host check, an egress
  to `evil.com?configId=<honest>` would pass the tenant check, and an override would **re-derive the
  tenant while preserving the chamber's host** — "correcting" the request and still sending it to
  evil.com. The control **must** verify the host too.

## Recommended Decision

Adopt **Option C**. Config-integrity is enforced at the ADR-0010 dispatch seam with this disposition:

1. **At the seam, not at boot.** The control runs in `core/wrapped-sdk-host.js`'s
   `dispatchInterceptedFetch`, *before* `caps.egress.dispatch` performs the real fetch — the
   chokepoint every intercepted interact crosses. Boot-time host-ownership of config does not
   substitute for it (the chamber owns the vendor runtime and can bypass its own honest config).

2. **Verify BOTH host and tenant.** A dispatch **deviates** when the outbound **host** ≠ the
   host-pinned host, **or** the outbound **tenant key** is absent, duplicated (parameter pollution —
   detected with `getAll`, not `get`), or ≠ the host-pinned tenant value. The host check is
   load-bearing, not incidental: it is what keeps the override (below) from ever forwarding to an
   unconfined destination. **The check surface is the outbound URL** (host + query tenant key); a
   tenant/identity vector carried in the request **body** is *out of this surface* — see the Kill
   criteria and the `orgId`/body residual. This is the exact vector 013-03 measured live (`configId`
   in the URL); it deliberately does not claim more than the URL surface.

3. **Default disposition: HOLD (fail-closed).** On any deviation, **no real fetch is dispatched**;
   the chamber's pending `sendEvent` settles *rejected* (ADR-0010's reject surface). Failing closed
   on a valid attacker tenant on the allowed host is the point — the safe default is to not send.

4. **The pin is orchestrator-owned and chamber-immutable.** The pinned host + tenant are the
   host-set `config` values, **injected into the host** (a `createWrappedSdkHost` option, or captured
   from the orchestrator's `init` message) — **never** read from the chamber's outbound `m.url`.
   Chamber code cannot influence the reference it is checked against.

5. **Generic mechanism, injected tenant key.** The control lives in `core/` and is **vendor-neutral**:
   it pins a host + a tenant key, but *which* query parameter is the tenant key is a
   connector/manifest detail **injected** by the connector (`configId` for alloy, `measurement_id`
   for GA4) — not a hardcoded `"configId"` in `core/` (the 014-02 vendor-injection precedent; a
   hardcoded key would be Adobe-specific and could not serve GA4).

6. **Alert, paired with the disposition.** Every deviation — held *or* overridden — is surfaced
   through the existing 009-02 diagnostics seam (`onDiagnostic`, record shape
   `{ level, kind, ... }`), redacted of raw identifier values (013-01 discipline):
   `{ level: "error", kind: "config-integrity", disposition: "held" | "overridden", reason }`. A
   re-route attempt is **observed**, never silent; the honest path emits nothing.

7. **Override is a named opt-in option, not the default.** For deployments that prefer
   *keep-working* over *block*, an explicit per-host option re-derives the dispatch to the
   host-pinned **host + tenant** (evasion-proof — it discards whatever the chamber supplied) and
   sends, still alerting. It is availability-over-integrity, chosen deliberately, and it accepts the
   body residual named below.

## Consequences

**Becomes easier:**
- The confirmed 013-03 same-host tenant re-route **via the URL tenant key** (`configId`) — the exact
  vector 013-03 measured live — is **neutralized fail-closed** at the core seam: the seal's first
  enforcement teeth. (The check surface is the outbound **URL**; a body-only co-vector is *out of
  surface* and named as a residual below, deliberately **not** claimed covered.)
- Re-route attempts are **observable** (009-02), so a compromised chamber is detectable, not silent.
- The mechanism is reusable: any wrapped-SDK connector that declares its tenant key inherits the
  control unchanged.

**Becomes harder:**
- Every wrapped-SDK host must be constructed with a complete pin (host + tenant key + tenant value);
  an incomplete pin **fails closed** (a misconfiguration holds, it does not silently pass).
- Each connector must declare its tenant key — a new (small) manifest obligation.
- The **override** option forwards the attacker-shaped **body** into the honest tenant: a
  data-integrity residual that `hold` (the default) does not have. The trade is documented at the
  config surface, not hidden.

## Assumptions

<!-- Spec 064-02 / ADR-0020 §1–§2 — grounding-by-probe (risk-gated). -->

- **The threat is confirmed live, not hypothesized.** 013-03 AC1 ran real Edge: honest and attacker
  datastreams both HTTP 200, garbage 400 — tenant routing is `configId`-keyed on the shared host.
  Grounded (spec 013-03 DONE; `rig/alloy-live-reroute.mjs`).
- **The seam exists and is gate-able.** `core/wrapped-sdk-host.js`'s `dispatchInterceptedFetch`
  calls `caps.egress.dispatch(req)` (ADR-0010) — the single chokepoint, verified by reading the
  module. Grounded.
- **The pin threads via the host boundary, not a fabricated path.** `createWrappedSdkHost` today
  takes `{ chamber, caps, timeoutMs }`; the pin is added as a construction option (or captured from
  the orchestrator `init` message), separate from the chamber's outbound URL. Grounded
  (`core/wrapped-sdk-host.js`, `rig/alloy-core-host-harness.html`).
- **The tenant key is per-connector.** alloy uses `configId`; GA4 uses `measurement_id`
  (`connectors/ga4/map.js`). Grounded.

## Kill criteria

- **Tenant routing not expressible as a single URL query parameter.** This control keys on a
  query-param tenant key. If a connector routes tenants via the **request body** or a **header**
  (rather than the URL), the URL-param check is insufficient for that connector and a body/header-
  aware control is required instead — a **named residual**, explicitly *not* covered here. (GA4's
  `measurement_id` is a URL param, so GA4 is coverable in principle; its deferral below is about
  scope/sequencing, not this kill criterion.) **This is not hypothetical for alloy:** its `orgId`
  rides in the **body** (`configure({ datastreamId, orgId })` → the XDM body), not the URL. If
  `orgId` proves to be an *independent* tenant/identity routing vector (013-03 left this open — see
  the residual below), this kill criterion **fires for alloy today**, and the URL-`configId` pin
  alone is insufficient.
- **Legitimate per-request tenant variation.** If an honest connector ever varies its tenant key
  per request against a *set* of valid tenants, a single pinned value would false-positive; the
  control would need a pinned *allow-set*, not a scalar. No connector does this today.

## Open questions / residuals

- **The `orgId`/body co-vector — an UNVERIFIED, currently-SILENT residual (NOT "unaffected").**
  alloy's XDM body carries an `orgId` (identity-namespacing) and the event payload, and 013-03
  **explicitly left open** whether `orgId` is an *independent* tenant/identity routing vector ("a
  residual to close … **if it proves routing-relevant**"); AC1 varied only `configId`, on a single
  org, so the live evidence says nothing about `orgId`. This control's check surface is the **URL**,
  so a request with the **honest `configId` in the URL** but an **attacker `orgId` in the body**
  would **pass** the check — **allowed, not held, and (because the honest path emits nothing) not
  alerted.** Two honest consequences, stated plainly rather than waved off: **(i)** `hold` protects
  the body *only when it fires*, and a body-only swap never fires it — so this vector is
  **uncovered**, not "unaffected"; **(ii)** the **override** option additionally forwards the
  chamber-built (attacker-shaped) body into the honest tenant. **Tracked follow-up**
  (`docs/refinement-todo.md`): probe whether `orgId` is independently routing/identity-relevant (a
  live re-probe pinning `configId` while varying `orgId`); if it is, that is the **URL-param kill
  criterion above firing for alloy** → extend to a **body/header-aware** check (or pin `orgId` too)
  **with its own alert**. Until then, the honest headline is scoped to the **URL tenant-key** vector,
  and body governance (ADR-0006 payload governance, split for alloy/wrapped-SDK) is the broader home
  for the body half.
- **GA4's async re-route is a deliberate deferral, not an immunity.** GA4 maps *in the chamber*, so a
  compromised GA4 chamber can emit `?measurement_id=<attacker>` on `google-analytics.com` — the same
  same-host tenant re-route. It is scoped out on purpose (first bite = one connector, one seam), and
  binding config-integrity to the **async** `caps.egress.dispatch` seam side-steps the 014 arch-4
  synchronous-gating sub-problem (there is no *wrapped-SDK* egress on GA4's synchronous unload fast
  path — only that sync path is genuinely chamber-immutable). The deferral is tracked
  (`docs/refinement-todo.md`).
- **Browser-followed redirects + DOM pixels (ADR-0010 residual, inherited).** This control binds to
  the intercepted-fetch hop the chamber makes. Server-directed 3xx redirects the *browser* follows,
  and any DOM-injected pixel/iframe egress, are outside the intercepted-fetch seam — ADR-0010 already
  names them as a residual; config-integrity here does not extend past that boundary.
