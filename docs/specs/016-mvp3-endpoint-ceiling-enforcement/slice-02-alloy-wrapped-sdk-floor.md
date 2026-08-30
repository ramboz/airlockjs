---
status: DRAFT
dependencies: [016-01]
last_verified:
frame_review: true
---

<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about
     runnable surfaces by probe first (run it / read source) or a citation. -->

## Slice 016-02 — alloy wrapped-SDK endpoint ceiling (the FLOOR archetype)

**Goal:** Apply 016-01's generic `core/` endpoint-ceiling control at the **wrapped-SDK dispatch seam**
(`core/wrapped-sdk-host.js`), **composed** with 015's config-integrity so the one seam now enforces
**both** the destination ceiling (outbound origin+path ∈ the connector's declared endpoints) **and** the
tenant pin (`configId`). Flip the 012-04 **boundary sentinel** from absence-of-gating to presence-of-hold.
Scope alloy honestly as a **FLOOR**: the declared first-party origins are **enforced** (a redirect to any
undeclared destination is **held** + surfaced — real foreign-sink teeth), while the **server-directed
third-party ID-sync** destinations remain a **named residual** the static ceiling cannot enumerate.

**DoR:**
- ✅ [016-01] DONE — the generic `core/endpoint-ceiling.js` control (origin+pathname, injected declared
  set) + the async-seam wiring + the 009-02 alert exist.
- ✅ [015](../015-mvp3-config-integrity-enforcement/spec.md) DONE — config-integrity is already at the
  wrapped-SDK seam (`core/wrapped-sdk-host.js`'s `dispatchInterceptedFetch`); this slice composes a
  second check there.
- ✅ The alloy manifest declares `endpoints` (`connectors/alloy/connector.js` →
  `[ALLOY_INTERACT_ENDPOINT]`); 013-02 measured the real first-party egress = **2 origins**
  (`adobedc.demdex.net` + `edge.adobedc.net`), **zero third-party as a LOWER BOUND** (test-org artifact).
- ✅ The 012-04 sentinel (`test/alloy-manifest-declaration.test.js` AC2) asserts the **absence** of
  gating — designed to go red when enforcement lands.

**Acceptance Criteria:**

1. **Reuse the 016-01 control at the wrapped-SDK seam.** `core/wrapped-sdk-host.js`'s
   `dispatchInterceptedFetch` calls `checkEndpointCeiling(m.url, declaredEndpoints)` (the injected pin,
   the config-integrity-pin precedent) **before** `caps.egress.dispatch` — no new `core/` control, no
   `core/ → rig/` import. Observable: the same origin+pathname check runs at the wrapped-SDK seam.
2. **Composed with config-integrity (both must pass).** The seam enforces the **destination ceiling
   first** (is this a place the connector may post at all?), then **config-integrity's tenant pin**
   (015 — is it the right tenant on that place?). Either failing → **HELD** with its own diagnostic
   (`kind: "endpoint-ceiling"` vs `kind: "config-integrity"`). The endpoint ceiling is **hold-only**
   (no override — a foreign destination can never be "corrected"; only the *tenant* has a 015-02
   override). Observable: undeclared origin+path → held (endpoint-ceiling); declared origin + attacker
   tenant → held (config-integrity); declared origin + honest tenant → allowed.
3. **Declare the measured first-party origins + flip the sentinel.** Update the alloy manifest to declare
   the **2 first-party origins** 013-02 measured (`adobedc.demdex.net`, `edge.adobedc.net`) — the
   ceiling floor. Flip `test/alloy-manifest-declaration.test.js` AC2 from "egresses WHETHER OR NOT the
   host matches" (advisory) to "an interact to an **undeclared** origin+path is **HELD**" (authoritative).
   Observable: the sentinel now asserts the hold; the declared set matches the measured egress.
4. **FLOOR — server-directed third-party sync is a NAMED residual, and fail-closed is CORRECT.** The
   static ceiling **cannot** enumerate the demdex/AAM sync URLs the Edge response directs the SDK to fire
   (013-02 lower bound; ADR-0006 Kill #2). This slice states honestly: (a) fail-closed on an **undeclared**
   destination is the **right** behavior — an undeclared sync is **held + surfaced** (009-02) for the
   operator to **authorize (declare) or investigate (exfil)**, not a silent break; (b) so a production
   deployment with real AAM syncs **maintains** its declared set as those origins become known — a
   **drift/maintenance cost**, not a design flaw; (c) DOM-pixel syncs are already suppressed by the
   chamber's egress-confinement (013-02), so the chamber's *fetch* egress is narrower than the real-DOM
   reference; (d) a **dynamic host-mediated sync allow-list** (seeded from the Edge response but
   host-verified, never connector-trusted) is the deferred richer solution — tracked, not built.
   Observable: the spec/ADR/comments name this residual; **no** test claims sync-destination confinement.
5. **E2E at the composed seam.** A `test/` harness driving the real `core/wrapped-sdk-host.js` seam: an
   intercepted interact to an **undeclared** origin+path → **held** (endpoint-ceiling) + alerted; to a
   **declared** origin with the **honest** tenant → **allowed**; to a declared origin with an **attacker**
   tenant → **held** (config-integrity, unchanged from 015). All at the one seam, both controls composed.

**DoD:**
- [ ] ACs 1–5 pass — the composed seam holds an undeclared destination AND an attacker tenant; the
      honest alloy path is unchanged. Green against targeted tests (not the hang-prone full suite).
- [ ] **No regression** — 015 config-integrity (hold + override) stays green; the honest wrapped-SDK
      dispatch + coalescing stay green; 016-01's GA4 seam untouched.
- [ ] Reviews: compliance + craft + reconciliation recorded pass (spike-light — reuses 016-01's control
      + 015's already-arch-reviewed seam; no new `core/` boundary. The FLOOR scoping is the
      frame-critique's job).
- [ ] Deviation log + reconciliation sweep; the 012-04 sentinel flip recorded; the alloy manifest's
      declared set reconciled to 013-02's measurement; the server-directed-sync + dynamic-sync-allowlist
      + representative-AAM-re-run residuals tracked in `docs/refinement-todo.md`; `docs/releases/mvp3.md`
      updated (spec 016 complete).
- [ ] **No live identifiers committed** — synthetic datastreams; real Adobe **hostnames** are public
      infra (not secrets); the diagnostic names the destination origin+path, never a user identifier.

**Anti-horizontal-phasing check:** after this slice, a compromised **alloy** chamber **cannot** redirect
its interact to an undeclared destination — held at the wrapped-SDK seam (composed with the 015 tenant
pin) and surfaced. Observable value: the endpoint ceiling now bites at **both** egress archetypes, honest
about alloy's FLOOR (server-directed sync = a named, fail-closed-surfaced residual, not silent
confinement). Spec 016 complete.
