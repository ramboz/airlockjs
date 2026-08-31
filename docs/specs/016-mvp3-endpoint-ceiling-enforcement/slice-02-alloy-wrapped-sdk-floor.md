---
status: DRAFT
dependencies: [016-01]
last_verified:
frame_review: true
---

<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about
     runnable surfaces by probe first (run it / read source) or a citation. -->

## Slice 016-02 — alloy: wrapped-SDK endpoint ceiling reconciled with config-integrity (the FLOOR archetype)

**Goal:** Apply 016-01's generic `core/endpoint-ceiling.js` at the **already-confined** wrapped-SDK dispatch
seam (`core/wrapped-sdk-host.js`), **reconciled** with 015's config-integrity so the two controls own
**non-overlapping axes**: the **endpoint ceiling owns HOST+PATH** (runs on **every** intercepted egress, the
set-based destination authority — and it adds **path** confinement 015's host-only check lacks); **config-
integrity owns the TENANT** (its check scoped to the tenant-bearing interact endpoint). Flip the 012-04
**boundary sentinel** to authoritative. **Enforce a single grounded floor** — the declared interact origin —
and be honest that the alloy egress **breadth** and its **tenant-keying** are un-chamber-grounded (a
creds-gated probe, per ADR-0006 Kill #2), so anything beyond the interact origin is **held + surfaced**, not
silently admitted.

**DoR:**
- ⏳ **[016-01] must land first** (this spec's sibling; currently DRAFT) — it builds
  `core/endpoint-ceiling.js` (origin+pathname, injected declared set), the control this slice reuses. This
  is a **sequencing dependency**, not a satisfied precondition.
- ✅ [015](../015-mvp3-config-integrity-enforcement/spec.md) DONE — config-integrity (host+tenant, with
  015-02 override) is at the wrapped-SDK seam (`core/wrapped-sdk-host.js` `dispatchInterceptedFetch`).
- ✅ alloy is **already confined** (`applyEgressConfinement`) — the wrapped-SDK seam is its practical sole
  egress (modulo the disclosed dynamic-`import()` residual), so the ceiling there has teeth without folding
  in new confinement (unlike GA4/016-01).
- ✅ The alloy manifest declares the interact `endpoint` (`[ALLOY_INTERACT_ENDPOINT]`); the 012-04 sentinel
  asserts the **absence** of gating (designed to go red on enforcement).

**Acceptance Criteria:**

1. **Reuse the 016-01 control at the wrapped-SDK seam.** `dispatchInterceptedFetch` calls
   `checkEndpointCeiling(m.url, declaredEndpoints)` (injected pin) on **every** intercepted fetch, **before**
   `caps.egress.dispatch`; an undeclared origin+path is **HELD** + a `endpoint-ceiling` 009-02 diagnostic.
   No new `core/` control; no `core/ → rig/` import.
2. **Axis reconciliation with config-integrity (the composition-seam behavior).** When **both** controls are
   wired: the **ceiling runs first on every egress** (owns host+path — subsumes config-integrity's single-host
   check); **config-integrity's tenant check runs only on requests to its `pinnedHost`** (the interact — the
   ceiling already confirmed a declared host). 015's control **code is unchanged**; the scoping is a **seam**
   behavior gated on the ceiling's presence, so 015's **standalone** tests (no ceiling → config-integrity runs
   on all egress) stay green. The 015-02 override still re-derives the **tenant** on the interact
   (`pinnedDispatchUrl`'s host re-derive becomes a harmless no-op once scoped to `pinnedHost`). Observable: a
   foreign host (`evil.com`) is **held by the ceiling** (undeclared) even though config-integrity is scoped
   out for it.
3. **Declare the single grounded interact origin + flip the sentinel.** The enforced floor is the **one
   grounded** interact origin+path (`adobedc.demdex.net/ee/v1/interact` — the manifest's declared endpoint,
   which the 012-04 sentinel already pins, = config-integrity's `pinnedHost`). Because the **only** declared
   origin **is** `pinnedHost`, the composition has **no tenant-blind declared origin** (the gap in AC4 does
   not arise in the shipped config). Flip `test/alloy-manifest-declaration.test.js` AC2 from "egresses
   WHETHER OR NOT the host matches" to "an interact to an **undeclared** origin+path is **HELD**."
4. **The TENANT-COVERAGE GAP is named + guarded (016-02 re-critique), not opened.** The reconciliation scopes
   config-integrity to `pinnedHost`, so a **declared** origin *other than* `pinnedHost` would get ceiling
   host+path checking but **no tenant check** — and if that origin is `configId`-keyed (e.g.
   `edge.adobedc.net`, plausibly same `/ee/` Edge family — **un-grounded**), declaring it in the ceiling
   **alone** would be **tenant-blind**, reopening the 013-03 same-host tenant re-route on a first-party Edge
   domain. So this slice: (i) enforces a **single** origin floor (above), where the gap cannot arise; (ii)
   **does NOT instruct operators to blindly declare a second origin** — admitting a second **tenant-keyed**
   origin requires the **multi-tenant-pin** model (config-integrity extended to a *set* of `host → pinned
   tenant`), a **named deferred follow-up**; (iii) names the gap in `refinement-todo` + a code comment.
5. **FLOOR — the breadth beyond the interact origin is a NAMED residual; fail-closed is CORRECT.** The static
   ceiling **cannot** enumerate (a) demdex/AAM **server-directed** sync URLs the Edge response directs the SDK
   to fire (ADR-0006 Kill #2), nor (b) the **second first-party origin** (`edge.adobedc.net`) 013-02 saw in a
   **real-DOM** run — un-chamber-grounded. Honest scoping: (i) held + surfaced (009-02) is the **right**
   fail-closed behavior, not a silent break; (ii) the enforced floor is deliberately **one** origin — the
   same "un-chamber-grounded" caution that excludes `edge.adobedc.net` also means a production chamber that
   legitimately uses it will see it **held** until grounded+declared (a drift cost, honestly named — not
   hidden); (iii) a **chamber-grounded egress probe** (real-Edge, the confined chamber, measuring origins +
   paths + which are `configId`-keyed — the creds-gated follow-up, ADR-0006's own precondition) should
   **precede** expanding the declared set beyond the interact origin; (iv) DOM-pixel syncs are already
   suppressed by egress-confinement (013-02). No test claims sync / second-origin confinement.
6. **E2E at the composed seam.** A `test/` harness driving the real `core/wrapped-sdk-host.js` seam: (a) an
   interact to an **undeclared** origin+path (incl. a **wrong path** on the allowed host — the path
   confinement 015 lacks) → **held** (endpoint-ceiling) + alerted; (b) the declared interact + **honest**
   tenant → **allowed**; (c) declared interact + **attacker** tenant → **held** (config-integrity, unchanged
   from 015); (d) **the benign reconciliation case** — a synthetic **two-origin** declared set + config-
   integrity pinned to the interact, a request to the second origin carrying **no tenant key** → **allowed**
   (ceiling passes, config-integrity scoped out); (e) **the GAP case** — the same two-origin set, a request
   to the second origin carrying an **attacker `configId`** → **allowed by this slice's controls**, proving
   the tenant-coverage gap is **real** and asserting it is **surfaced/flagged** (a `config-integrity:
   unpinned-declared-origin` disclosure diagnostic, or an explicit documented limitation the test pins), so
   the gap is demonstrated + named, never silent.

**DoD:**
- [ ] ACs 1–6 pass — the composed seam holds an undeclared destination (incl. wrong path) AND an attacker
      tenant on the interact, allows a no-tenant second origin, and demonstrates+surfaces the tenant-keyed
      second-origin gap. Green against targeted tests.
- [ ] **No regression** — 015 config-integrity (hold + override) **standalone** tests stay green (no ceiling
      passed); the honest wrapped-SDK dispatch + coalescing stay green; 016-01's GA4 seam untouched.
- [ ] Reviews: compliance + craft + reconciliation recorded pass (spike-light — reuses 016-01's control +
      015's already-arch-reviewed seam; the composition reconciliation + tenant-gap + FLOOR scoping are the
      craft/frame concerns).
- [ ] Deviation log + reconciliation sweep; the 012-04 sentinel flip recorded; the
      chamber-grounded-egress-probe + multi-tenant-pin (second-origin tenant coverage) + dynamic-sync-allowlist
      + representative-AAM-re-run residuals tracked in `docs/refinement-todo.md`; `docs/releases/mvp3.md`
      updated (spec 016 complete).
- [ ] **No live identifiers committed** — synthetic datastreams; real Adobe **hostnames** are public infra
      (not secrets); the diagnostic names the destination origin+path, never a user identifier.

**Anti-horizontal-phasing check:** after this slice, a compromised **alloy** chamber cannot redirect its
egress to an undeclared destination (incl. a wrong path on the allowed host) — held at the (confined)
wrapped-SDK seam, with the endpoint ceiling (host+path) and config-integrity (tenant) as **clean,
non-overlapping** axes. Observable value: the endpoint ceiling now bites at **both** archetypes, honest about
alloy's FLOOR (single grounded origin; server-directed sync, second-origin breadth, and second-origin
tenant-coverage are **named, fail-closed-surfaced** residuals gated on a chamber-egress probe). Spec 016 complete.
