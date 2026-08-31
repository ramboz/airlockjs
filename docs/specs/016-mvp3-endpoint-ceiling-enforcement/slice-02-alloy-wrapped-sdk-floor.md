---
status: DRAFT
dependencies: [016-01]
last_verified:
frame_review: true
---

<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about
     runnable surfaces by probe first (run it / read source) or a citation. -->

## Slice 016-02 — alloy: wrapped-SDK endpoint ceiling reconciled with config-integrity (the FLOOR archetype)

**Goal:** Apply 016-01's generic `core/endpoint-ceiling.js` at the **already-confined** wrapped-SDK
dispatch seam (`core/wrapped-sdk-host.js`), **reconciled** with 015's config-integrity so the two controls
own **non-overlapping axes**: the **endpoint ceiling owns HOST+PATH** (runs on **every** intercepted
egress, the set-based destination authority); **config-integrity owns the TENANT** (its check scoped to
the tenant-bearing interact endpoint, the ceiling having confirmed the host). Flip the 012-04 **boundary
sentinel** from absence-of-gating to presence-of-hold. Declare the **grounded interact origin** as the
enforced floor; anything beyond it is **held + surfaced** (the FLOOR — honest about alloy's
server-directed sync + the un-chamber-grounded egress breadth).

**DoR:**
- ✅ [016-01] DONE — `core/endpoint-ceiling.js` (origin+pathname, injected declared set) exists.
- ✅ [015](../015-mvp3-config-integrity-enforcement/spec.md) DONE — config-integrity (host+tenant, with
  015-02 override) is at the wrapped-SDK seam (`core/wrapped-sdk-host.js` `dispatchInterceptedFetch`).
- ✅ alloy is **already confined** (`applyEgressConfinement`) — the wrapped-SDK seam is its sole egress,
  so the ceiling there has teeth without folding in new confinement (unlike GA4/016-01).
- ✅ The alloy manifest declares `endpoints` (`[ALLOY_INTERACT_ENDPOINT]`); 013-02 measured a first-party
  egress LOWER BOUND in a **real-DOM reference** run (not the chamber). The 012-04 sentinel asserts the
  **absence** of gating (designed to go red on enforcement).

**Acceptance Criteria:**

1. **Reuse the 016-01 control at the wrapped-SDK seam.** `dispatchInterceptedFetch` calls
   `checkEndpointCeiling(m.url, declaredEndpoints)` (injected pin, the config-integrity-pin precedent) on
   **every** intercepted fetch, **before** `caps.egress.dispatch`; an undeclared origin+path is **HELD** +
   a `endpoint-ceiling` 009-02 diagnostic. No new `core/` control; no `core/ → rig/` import.
2. **Axis reconciliation with config-integrity (the composition-seam behavior).** When **both** the
   endpoint ceiling and config-integrity are wired: the **ceiling runs first on every egress** (owns
   host+path — it subsumes config-integrity's single-host check); **config-integrity's tenant check runs
   only on requests to its `pinnedHost`** (the interact — the ceiling already confirmed a declared host).
   015's control **code is unchanged**; the scoping is a **seam** behavior gated on the ceiling's presence,
   so 015's **standalone** tests (which pass no ceiling → config-integrity runs on all egress, unchanged)
   stay green. Observable: a request to a **declared non-interact origin carrying no tenant key** is
   **allowed** (ceiling passes; config-integrity **not** applied — the fix for the naive "both hold
   everything" incoherence); the 015-02 override still re-derives the **tenant** on the interact.
3. **Declare the grounded interact origin + flip the sentinel.** The enforced floor is the **grounded**
   interact origin+path (`adobedc.demdex.net/ee/v1/interact`, the manifest's declared endpoint, 013-01/02
   confirmed). Flip `test/alloy-manifest-declaration.test.js` AC2 from "egresses WHETHER OR NOT the host
   matches" (advisory) to "an interact to an **undeclared** origin+path is **HELD**" (authoritative).
   Observable: the sentinel now asserts the hold.
4. **FLOOR — the breadth beyond the interact origin is a NAMED residual; fail-closed is CORRECT.** The
   static ceiling **cannot** enumerate (a) the demdex/AAM **server-directed** sync URLs the Edge response
   directs the SDK to fire (013-02 lower bound; ADR-0006 Kill #2), nor (b) the **second first-party
   origin** (`edge.adobedc.net`) 013-02 saw in a **real-DOM** run but which is **un-chamber-grounded**.
   The slice states honestly: (i) fail-closed on an **undeclared** destination is the **right** behavior —
   held + surfaced (009-02) for the operator to **authorize (declare) or investigate (exfil)**, not a
   silent break; (ii) so a production deployment **maintains** its declared set as legit origins become
   known (a drift cost); (iii) DOM-pixel syncs are already suppressed by the chamber's egress-confinement
   (013-02), narrowing the chamber's *fetch* egress vs the real-DOM reference; (iv) a **chamber-grounded
   egress probe** (to pre-declare the real chamber origin+path set) and a **dynamic host-mediated sync
   allow-list** (host-verified, never connector-trusted) are the deferred richer solutions — tracked.
   Observable: the spec/comments name these residuals; **no** test claims sync/second-origin confinement.
5. **E2E at the composed seam.** A `test/` harness driving the real `core/wrapped-sdk-host.js` seam: (a)
   an interact to an **undeclared** origin+path → **held** (endpoint-ceiling) + alerted; (b) to the
   **declared** interact origin with the **honest** tenant → **allowed**; (c) to the declared interact
   with an **attacker** tenant → **held** (config-integrity, unchanged from 015); (d) **the reconciliation
   case** — a host built with a **two-origin** declared set + config-integrity pinned to the interact, a
   request to the **second declared origin carrying no tenant key** → **allowed** (ceiling passes,
   config-integrity scoped-out — proving it does not wrongly hold a declared non-interact origin).

**DoD:**
- [ ] ACs 1–5 pass — the composed seam holds an undeclared destination AND an attacker tenant, allows a
      declared non-interact origin, and the honest interact is unchanged. Green against targeted tests.
- [ ] **No regression** — 015 config-integrity (hold + override) **standalone** tests stay green (they
      pass no ceiling); the honest wrapped-SDK dispatch + coalescing stay green; 016-01's GA4 seam
      untouched.
- [ ] Reviews: compliance + craft + reconciliation recorded pass (spike-light — reuses 016-01's control
      + 015's already-arch-reviewed seam; the composition-seam reconciliation + FLOOR scoping are the
      craft/frame concerns, no new `core/` boundary).
- [ ] Deviation log + reconciliation sweep; the 012-04 sentinel flip recorded; the
      chamber-grounded-egress-probe + dynamic-sync-allowlist + representative-AAM-re-run +
      second-origin-grounding residuals tracked in `docs/refinement-todo.md`; `docs/releases/mvp3.md`
      updated (spec 016 complete).
- [ ] **No live identifiers committed** — synthetic datastreams; real Adobe **hostnames** are public infra
      (not secrets); the diagnostic names the destination origin+path, never a user identifier.

**Anti-horizontal-phasing check:** after this slice, a compromised **alloy** chamber cannot redirect its
egress to an undeclared destination — held at the (confined) wrapped-SDK seam, with the endpoint ceiling
(host+path) and config-integrity (tenant) as **clean, non-overlapping** axes. Observable value: the
endpoint ceiling now bites at **both** archetypes, honest about alloy's FLOOR (server-directed sync +
un-chamber-grounded breadth = named, fail-closed-surfaced residuals). Spec 016 complete.
