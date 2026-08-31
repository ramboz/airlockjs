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

**Question (reframed by the 020-01 frame-critique + the maintainer's consent correction — the two halves are
SEPARATE questions with different answers):**
- **(a) Payload** — is a seam-strip of `events[].xdm` even *needed*? Grounded: `toXdm`
  ([connector.js:195-206](../../connectors/alloy/connector.js)) is a hardcoded **2-field allowlist**
  (`eventType` + `web.webPageDetails.{URL,name}`, forwarding **no** arbitrary `params`), and
  `connector.js:67` sets **`context:[]`** (disabling alloy's ambient auto-collection) — so the body is
  **already read-minimized by construction** (a *third* read-minimization placement, at body-build time). Are
  there any residual vendor-added fields worth a thin defense-in-depth strip, and is such a strip
  **Edge-safe**?
- **(b) Consent** — alloy consent is the **`setConsent` command** (`configure → setConsent → sendEvent`),
  **NOT** an XDM body field (maintainer, 2026-08-31 — [Adobe setConsent
  docs](https://experienceleague.adobe.com/en/docs/experience-platform/collection/js/commands/setconsent)).
  Can airlock map the ADR-0007 vector → Adobe's consent shape → drive `setConsent` in the **chamber's
  alloy-boot flow** (the vector crosses in at init; the glue does `configure → setConsent → sendEvent`), as
  **delegate-and-send** (parallel to GA4's MP-consent point ①)? And how does `setConsent(collect:n)` affect
  what alloy sends (gate/queue vs send-with-consent)?

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

1. **Payload — confirm already-read-minimized; scope any residual strip as thin defense-in-depth.** Ground
   that `toXdm`'s 2-field allowlist (`connector.js:195-206`) + `context:[]` (`connector.js:67`) already
   minimize the egress `events[].xdm` — the live capture holds only `eventType` / `web.webPageDetails` + the
   vendor envelope (`implementationDetails`, `timestamp`, `meta.state` cookies), **none** of the PII / custom
   / form classes a strip would target. **Enumerate any residual vendor-added fields** and classify each
   strip-safe (droppable) vs required (identity/envelope). If a defense-in-depth seam-strip is warranted at
   all, confirm via the live rig that a field-**stripped** body is **Edge-accepted** (the strip mechanism is
   Edge-safe). Expect the finding to be *"little/no strip needed — the body is already minimal by
   construction."*
2. **Consent — characterize the `setConsent` COMMAND path (NOT body-injection — maintainer correction).**
   alloy consent is the client `setConsent` command, not an XDM field. Verify the argument shape (the Adobe
   2.0 consent standard — `{ consent: [{ standard: "Adobe", version: "2.0", value: { collect: { val: "y"|"n"
   } } }] }`) against the [docs](https://experienceleague.adobe.com/en/docs/experience-platform/collection/js/commands/setconsent)
   + the alloy SDK source. Determine: **(i)** how airlock maps its ADR-0007 purpose vector → that shape;
   **(ii)** WHERE it drives it — the chamber's alloy-boot glue does `configure → setConsent(mapped) →
   sendEvent`, the vector crossing in at `init` like other ctx; **(iii)** how `setConsent(collect:n)` affects
   what alloy sends (does it **gate/queue** the interact, or send with a consent signal?). Name the mechanism
   + any blocker. This is **delegate-and-send** — alloy honors its own consent, parallel to GA4 delegating
   data-use denial to Google (ADR-0007 point ①).
3. **Grounded verdict (per-half, not a binary).** Dispose EACH half separately:
   - **Payload →** already read-minimized by construction (a seam-strip is optional thin defense-in-depth,
     Edge-safe if added) — likely *not* the open work; OR a residual field genuinely warrants a strip.
   - **Consent →** feasible via `setConsent` in the chamber boot flow (name the 020-02 approach: thread the
     ADR-0007 vector into the chamber `init` + drive `configure → setConsent → sendEvent`) OR a blocker (→
     read-minimization / honest boundary, superseding ADR-0012's alloy-Split disposition).
   Note the **untrusted-chamber posture:** `setConsent` runs *inside* the chamber (delegate-to-alloy) — it is
   honored-by-the-vendor, not seam-enforced, the same delegate-and-send trust as GA4's point ①; the seam
   still enforces endpoint-ceiling + config-integrity around it.
4. **Live legs — the test datastream is wired (running).** The **strip Edge-safety** check runs live against
   real Edge with the maintainer's test datastream (`rig/alloy-live-xdm-governance.mjs`), redacting all
   identifiers (013 discipline). The **`setConsent` live-flow** (real alloy `configure → setConsent(collect:n)
   → sendEvent`, observing whether alloy gates or sends) is the deeper leg — run if tractable with the 013
   chamber-rig infra, else characterized from the SDK source + docs and named as the follow-on. Never asserted
   without evidence.

**Findings:** _(filled during IN_PROGRESS — evidence collected)_

- **Payload:** _TBD — confirm `toXdm` (2-field allowlist) + `context:[]` already minimize the body; enumerate
  residual vendor fields; is a field-strip Edge-safe (live rig)?_
- **Consent:** _TBD — the `setConsent` argument shape (Adobe 2.0 standard) + how `collect:n` affects the
  interact (gate/queue vs send-with-signal); the ADR-0007-vector → `setConsent` map + the chamber
  `configure → setConsent → sendEvent` placement._

**Outcome:** _(set at DONE — per-half, no longer a single binary)_
- **Payload:** `already read-minimized by construction (optional defense-in-depth strip, Edge-safe)` |
  `residual-field strip warranted`.
- **Consent:** `feasible via setConsent command → 020-02 (thread the ADR-0007 vector into chamber init + drive
  configure→setConsent→sendEvent)` | `blocker → read-minimization / honest boundary (supersede ADR-0012's
  alloy-Split)`.
- _Trending (pre-evidence): **both halves feasible via idiomatic paths** — payload already minimal; consent
  via the supported `setConsent` API._

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
