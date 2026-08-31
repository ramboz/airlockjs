---
status: Accepted
dependencies: []
last_verified: 2026-08-31
frame_review: true
---

# ADR-0013: Alloy consent enforcement: trusted seam-drop + setConsent delegate

## Status

Accepted (2026-08-31)

## Context

Airlock enforces ADR-0007 purpose-vector consent for the GA4 / wire-protocol archetype (spec 017), but the
**alloy / wrapped-SDK** archetype was left ungoverned for consent + payload:
[ADR-0012](adr-0012-payload-governance.md) deliberately **split** alloy payload governance as *probe-first
fragile* (the vendor builds the XDM body inside the chamber, so a strip/inject at the seal was feared to break
it), and ADR-0007's alloy consent enforcement stayed an open residual. Spec 020 (the MVP4 alloy-completion)
settles both, and the finding was that the fear was misplaced — **grounded** by the 020-01 feasibility probe
(a live-Edge rig against the maintainer datastream + the alloy@2.35.0 source):

- **Alloy's egress payload is already read-minimized by construction.** `connectors/alloy/connector.js`'s
  `toXdm` is a hardcoded **2-field allowlist** (`eventType` + `web.webPageDetails`) forwarding no arbitrary
  params, and `context:[]` disables alloy's ambient auto-collection. The real captured interact body holds
  only that + the vendor envelope. So — unlike GA4's `mapToMp` verbatim-spread — there is little sensitive
  data in the airlock-built body to strip. A defense-in-depth field-strip at the seam is nonetheless **Edge-
  safe** (live-confirmed: baseline / +synthetic-PII / stripped all HTTP 200, identical response, round-trip
  preserved).
- **Alloy consent is the `setConsent` COMMAND, not an XDM body field.** `alloy("setConsent", { consent:[{
  standard:"Adobe", version:"2.0", value:{ collect:{ val:"y"|"n" } } }] })` drives a client consent state
  machine (in→send / out→**reject, never-send** / pending→queue) that gates every egress
  (`consent.awaitConsent().then(sendEdgeNetworkRequest)`), plus a separate `/ee/v1/privacy/set-consent` call →
  the `kndctr_<orgId>_consent` cookie. So the original "inject `xdm.consents`" premise was wrong; the opt-out
  signal is a *suppressed request*, not a body value.

The load-bearing design question this raises: **the `setConsent` gate runs inside the chamber, which airlock
treats as untrusted (AD-5)** — a compromised alloy could ignore its own gate. So consent cannot be enforced by
`setConsent` alone.

## Decision Options Considered

### Option A: Trusted seam-side drop + idiomatic `setConsent` delegate (RECOMMENDED)
Enforce consent at **two** layers: (b) a **trusted seam-side egress drop** at `core/wrapped-sdk-host.js`'s
`dispatchInterceptedFetch` (airlock's main-thread code, before the real dispatch), and (a) drive alloy's
`setConsent` in the chamber's alloy-boot glue as an idiomatic delegate.
- **Pros:** The **seam** is the real enforcement — it runs on the trusted main thread against the host-supplied
  vector, so a chamber that **ignores or forges its own `setConsent` gate is still held at the seam**
  (*delegate-independence* — machine-verified against a fake chamber with no `setConsent`) for any egress that
  **crosses** the intercepted-fetch seam. (This is not a claim that a *fully* compromised chamber is held —
  see the Kill criteria's dynamic-`import()` bound.) Reuses the existing `core/consent.js` `egressVerdict`
  (GA4-parity) — one vendor-neutral seal primitive. The `setConsent` delegate is genuinely complementary: correct vendor
  behaviour + the consent cookie propagates to Edge (so other/future requests are consent-correct). Defense-
  in-depth: seam-enforce (trusted) + delegate (idiomatic).
- **Cons:** Two layers to keep coherent (mitigated: a fail-loud warn on a consent-vector-without-`egressPurposes`
  misconfiguration). The delegate fails **open** on a `setConsent` error — acceptable because the seam is the
  backstop, but a delegate-only wiring would fail open.

### Option B: Inject consent into the XDM body at the seam (REJECTED)
The original ADR-0012 premise — strip/inject the vendor XDM body.
- **Cons:** Factually wrong for consent (020-01): alloy consent is not a body field; a body-injected
  `xdm.consents` is not the mechanism Edge honours (the SDK's `setConsent` state + the `privacy/set-consent`
  cookie are). Rejected as a non-mechanism.

### Option C: Read-minimization only (fallback, NOT NEEDED)
ADR-0012's honest fallback — rely on read-minimization + the confinement/config-integrity already shipped.
- **Cons:** Under-enforces: it leaves consent unenforced (only payload minimized). The probe showed consent IS
  enforceable (Option A), so read-minimization-only is strictly weaker. Payload read-minimization is
  nonetheless **already substantially in place by construction** (`toXdm` + `context:[]`), so Option A layers a
  thin optional strip on top rather than relying on it.

## Recommended Decision

**Option A.** Alloy consent is enforced by a **trusted seam-side `egressVerdict` drop** + an **idiomatic
`setConsent` delegate**, with an optional Edge-safe defense-in-depth payload strip (implemented in spec
020-02):

1. **Seam-side drop (the enforcement).** `dispatchInterceptedFetch` applies `egressVerdict(consent,
   egressPurposes, { strict: true })` after the endpoint-ceiling + config-integrity gates, before
   `caps.egress.dispatch`. **`strict: true` is required** (not GA4's configurable / send-on-data-use-denial
   default): alloy has no body-consent field to carry a "denied" signal, so a denied/pending governing purpose
   must **drop** (held at the seal, fail-closed, same shape as the ceiling/config-integrity holds), never send.
   Gated on `egressPurposes.length` (back-compat).
2. **`setConsent` delegate (complement).** `connectors/alloy/consent.js` `shapeAlloyConsent` maps the ADR-0007
   vector → the Adobe 2.0 `collect:y/n` shape (fail-closed: `y` iff every collect-governing purpose —
   `analytics_storage` + `personalization` — resolves granted); the chamber glue drives `configure →
   setConsent → sendEvent`.
3. **Optional payload strip.** `governPayload` over `events[].xdm` at the seam, gated on a host denylist
   (Edge-safe per 020-01); non-load-bearing, since the body is already minimized.

**This supersedes ADR-0012's alloy-payload Split disposition** (the strip-at-seal was not fragile; the body is
already minimized + an Edge-safe strip exists) **and resolves ADR-0007's alloy-consent residual** (alloy
consent is now enforced, GA4-parity at the seam + vendor-idiomatic delegation). ADR-0012 and ADR-0007 remain
Accepted historical records; this ADR updates only their *alloy* dispositions (a factual reframe from the
020-01 probe evidence, not a reversal of their GA4 decisions).

## Consequences

**Becomes easier:**
- For an **honest-but-untrusted** chamber (one whose egress crosses the mediated intercepted-fetch seam), the
  security thesis is complete for **both** archetypes: it cannot exfiltrate to a foreign sink (confinement +
  ceiling), re-route its tenant (config-integrity), **or egress under denied consent** (this ADR's seam-drop)
  — the trusted seam is the single chokepoint **for seam-crossing egress**. This is the disciplined bound its
  upstream sources already hold to (spec 016: "neither is claimed closed"; ADR-0012: "defense-in-depth, not a
  guarantee"). A **fully compromised** chamber retains the disclosed dynamic-`import()` escape hatch (016 /
  012-01 AC5) that bypasses **all** seam controls — bounded only by a host-deployed worker `connect-src` CSP
  airlock does not ship (see Kill criteria); so the claim is "held at the seam **given** egress confinement",
  **not unconditional**.
- One vendor-neutral seal primitive (`egressVerdict`) now governs GA4 *and* alloy egress; a future wrapped-SDK
  connector reuses the same seam-drop + a vendor `shapeXConsent` delegate.

**Becomes harder:**
- Two coherent layers per wrapped-SDK connector (seam `egressPurposes` + chamber consent vector) — a
  misconfiguration (consent without `egressPurposes`) silently disables the trusted layer, mitigated by a
  construction-time fail-loud warn.
- The collect-governing purpose list is mirrored (manifest / `COLLECT_PURPOSES` / injected `egressPurposes`),
  an unenforced drift risk (the same accepted idiom as GA4's `DATA_USE_PURPOSES`).

## Assumptions

<!-- Grounded 2026-08-31 by the 020-01 live-Edge probe (rig/alloy-live-xdm-governance.mjs) + alloy@2.35.0
     source characterization + reading core/wrapped-sdk-host.js, core/consent.js, connectors/alloy/*. -->

- **The seam is the trusted enforcement point.** `dispatchInterceptedFetch` runs on the main thread against a
  host-supplied `consent` vector; the chamber only posts `intercepted-fetch`. **Grounded** (read + a
  fake-chamber-no-`setConsent` test proves the drop is **delegate-independent** — it holds regardless of the
  in-chamber `setConsent`, for egress that crosses the seam; NOT a claim that a seam-bypassing chamber is held).
- **`egressVerdict(…, {strict:true})` drops on denied AND pending.** `core/consent.js`: strict → any
  un-granted → drop. **Grounded** (read + tests).
- **alloy consent = the `setConsent` command + `privacy/set-consent` cookie, not a body field.** **Grounded**
  (alloy@2.35.0 `dist/alloy.js` source + Adobe docs; 020-01 Findings).

## Kill criteria

- **If a compromised chamber can reach Edge bypassing `dispatchInterceptedFetch`,** the seam-drop is not the
  enforcement and this decision fails. The disclosed dynamic-`import()` residual (016, worker CSP) is exactly
  such a bypass for ALL seam controls — bounded by a worker `connect-src` CSP, not by this ADR. So the trust
  claim is "held at the seam **given** egress confinement (AC5)", not unconditional.

## Open questions

- **`pending → hold+flush` vs `pending → drop`.** 020-02 drops on pending (fail-closed); GA4's async seal
  (017-03) holds+flushes. The alloy interact is a synchronous vendor round-trip (no queued `{url,body}` to
  replay), so hold+flush needs a replay decouple that does not yet exist for the wrapped-SDK path. Is
  pending-window data loss acceptable for alloy, or should hold+flush be prioritized? (Tracked, refinement-todo.)
