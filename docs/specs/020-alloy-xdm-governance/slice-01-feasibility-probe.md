---
status: DRAFT
kind: spike
dependencies: []
last_verified: 2026-08-31
frame_review: true
---

<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about
     runnable surfaces by probe first (run it / read source) or a citation. -->

## Slice 020-01 — alloy XDM-governance feasibility probe

**Question:** Can airlock govern alloy's vendor-built XDM request body — (a) **strip** host-denylisted
sensitive fields from `events[].xdm`, and (b) **enforce/inject** the ADR-0007 consent vector into alloy's XDM
consent shape — at [`core/wrapped-sdk-host.js`](../../core/wrapped-sdk-host.js)'s `dispatchInterceptedFetch`
seam, **WITHOUT breaking** alloy's client-side structure (the response round-trip, ECID mint-recognition) or
Adobe Edge's acceptance of the request?

**Time-box:** 3 days (front-loaded within MVP4's fixed 2-week box — the outcome gates the rest of the box, so
it must resolve early: feasible → implement; fragile → read-minimization).

**DoR:**
- ✅ MVP4 committed ([mvp4.md](../../docs/releases/mvp4.md)); this resolves ADR-0012's alloy-Split +
  ADR-0007's alloy-consent residual.
- ✅ Seam grounded: `dispatchInterceptedFetch` exposes the XDM `body` on the main thread before
  `caps.egress.dispatch`, where the endpoint-ceiling + config-integrity already bind; `xdm-mint.js` already
  parses the body (spec Assumptions). **Grounded.**
- ✅ Hermetic substrate available: the alloy chamber + stubs, the 012-04 XDM characterization, and a
  representative XDM body shape. The live-Edge leg is creds-gated (013 precedent).

**Acceptance Criteria (a spike — the ACs are that the investigation yields a *grounded verdict*, not a
feature):**

1. **XDM strip-safety characterized.** Against the alloy stubs + a representative XDM body (+ Adobe XDM schema
   docs), determine whether stripping host-denylisted fields from `events[].xdm` keeps the body **XDM-valid +
   Edge-acceptable**: enumerate what is **safe to strip** (custom `_<tenant>` namespaces / PII / form fields)
   vs **unsafe** (required / identity fields). Show a concrete **parse→strip→re-serialize** on that body that
   does **not** break alloy's client-side round-trip — the response handling + the `xdm-mint` ECID
   mint-recognition still work on the governed body.
2. **XDM consent mechanism characterized.** Verify Adobe's XDM consent shape (`xdm.consents` / the Adobe
   Consent standard) against current docs; determine whether airlock can enforce the ADR-0007 vector by
   injecting/overriding it in the body at the seam, and whether **Edge honors a body-injected consent** (vs
   the SDK's own `setConsent` state) — and whether it **conflicts** with the SDK. Name the mechanism or the
   blocker.
3. **Grounded verdict + scoped fallback.** Conclude **feasible** (→ name the 020-02 implementation approach:
   bind the existing `governPayload` + the ADR-0007 vector to the XDM body at the seam) **OR fragile** (→
   **read-minimization** is the alloy defense; scope *exactly* what it covers — the `AirlockEvent` input —
   and the **ambient in-chamber collection gap** it does not, 012-04 Axis-2; and whether the disposition rises
   to an ADR superseding ADR-0012's alloy-Split).
4. **Creds-gated leg named, not faked.** The hermetic design feasibility is the spike's core. The live-Edge
   acceptance check (**real** Edge accepts a governed XDM body) is a **named creds-gated follow-on** (spec 013
   precedent) — run only if the maintainer provides the test datastream, redacting identifiers; never asserted
   without evidence.

**Findings:** _(filled during IN_PROGRESS — evidence collected)_

- _TBD: where sensitive fields + consent live in the XDM body; strip-safety per field class._
- _TBD: Adobe `xdm.consents` shape + whether a body-injected consent is Edge-honored / SDK-conflicting._
- _TBD: parse→govern→re-serialize preserves the alloy round-trip + `xdm-mint` recognition._
- _TBD: read-minimization fallback coverage (input-governed) vs the ambient-collection gap._

**Outcome:** _(set at DONE — one of)_ `strip-at-seal feasible → spec 020-02 unblocked (implement the alloy
payload strip + consent enforcement at the seam)` / `read-minimization fallback (recorded; ADR-00NN if it
rises to a decision)` / `abandoned (reason)`.

**DoD:**
- [ ] The four spike blocks filled (Question / Time-box / Findings / Outcome).
- [ ] A **grounded feasibility verdict** — feasible (020-02 approach named) or read-minimization (scoped +
      the ambient-collection gap named), each with its evidence.
- [ ] **Frame-critique** recorded (the load-bearing premise to attack: that the wrapped-SDK seam + XDM
      body-strip is the right mechanism — vs read-minimization being the only viable alloy path from the
      start) + a light reconciliation.
- [ ] **No live identifiers committed** — synthetic XDM bodies; any creds-gated live-Edge leg redacts
      identifier VALUES (shape preserved), per spec 013's redaction discipline.

**Anti-horizontal-phasing check (spike variant):** this slice is a **nested** feasibility spike (never a
standalone `docs/spikes/` artifact) whose downstream change is articulated up front — its Outcome directly
unblocks 020-02 (implement) or records the read-minimization defense. It does not "research then build a
slab": the implementation is a *separate*, outcome-gated slice.
