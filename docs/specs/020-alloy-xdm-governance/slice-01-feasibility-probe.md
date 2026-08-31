---
status: DONE
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

**Findings:**

- **Payload — already minimal + strip Edge-safe (live-confirmed).** `toXdm` (2-field allowlist) + `context:[]`
  mean the egress body holds only `eventType` / `web.webPageDetails` + the vendor envelope
  (`implementationDetails` / `timestamp` / `meta.state` cookies) — none of the PII / custom / form classes.
  **Live** (`rig/alloy-live-xdm-governance.mjs`, real Edge `/ee/v1/interact`, maintainer datastream, verified
  by the orchestrator): baseline / `+_airlocktest={email,ssn}` (synthetic) / field-**stripped** all → **HTTP
  200, identical handle shape** (`identity:result` / `locationHint:result` / `state:store`) — a
  `parse→delete→re-serialize` at the seam is **Edge-SAFE** and preserves the identity round-trip. Edge also
  *tolerates* an un-stripped field (validation is downstream), so a seam-strip has real defense-in-depth value
  on an `AirlockEvent`→XDM body — though the airlock-built body is already minimal.
- **Consent — the `setConsent` command (source-characterized, alloy@2.35.0 + docs).**
  `setConsent({ consent:[{ standard:"Adobe", version:"2.0", value:{ collect:{ val:"y"|"n" } } }] })` drives a
  client consent **state machine** (in / out / pending); every egress is gated by
  `consent.awaitConsent().then(sendEdgeNetworkRequest)` — **in→** fires (body carries no consent field),
  **out→** the promise **rejects** → the interact is **never sent** (client-side drop), **pending→**
  queued/discarded. `setConsent` ALSO issues a separate `/ee/v1/privacy/set-consent` call → the
  `kndctr_<orgId>_consent` cookie (`general=in|out`), read back to flip the gate. So consent is **not** a body
  field; the opt-out signal is a **suppressed request**, not a body diff. `defaultConsent` (default `in`)
  governs the pre-`setConsent` window.
- **The airlock consent lever (the load-bearing threat-model finding).** Two options: **(a) drive alloy's
  `setConsent`** — idiomatic, but the gate runs **inside the untrusted chamber** (a compromised alloy could
  ignore its own gate and send anyway); **(b) an independent seam-side egress drop** at
  `dispatchInterceptedFetch` — airlock holds/drops the interact per its OWN ADR-0007 vector (reusing 017-03's
  `egressVerdict`), **not trusting the chamber**. **(b) is the airlock-thesis-consistent TRUE enforcement**
  (the seam is trusted main-thread code, already enforcing endpoint-ceiling + config-integrity); (a)
  complements it so alloy self-gates + the consent cookie propagates. Defense-in-depth: **seam-enforce +
  delegate**.

**Outcome:** `spec 020-02 unblocked — BOTH halves feasible via idiomatic paths.`
- **Payload:** already read-minimized by construction; an optional thin defense-in-depth field-strip at the
  seam is **Edge-SAFE** (live-confirmed) — 020-02 may add it (low cost), not load-bearing.
- **Consent:** feasible — 020-02 implements the **seam-side egress drop** (reuse 017-03 `egressVerdict` at
  `dispatchInterceptedFetch`, holding/dropping the alloy interact per the ADR-0007 vector — trusted
  enforcement) **+ drives `setConsent`** in the chamber alloy-boot glue (map the vector → Adobe 2.0 shape;
  delegate so alloy self-gates + propagates the consent cookie). This **supersedes ADR-0012's "probe-first
  fragile" alloy disposition** with "feasible via idiomatic + seam-enforced paths" (record as an ADR update at
  020's close). A live `setConsent`-flow confirmation (real alloy `configure → setConsent(collect:n) →
  sendEvent`, assert the interact is suppressed) is a named follow-on on the 013 chamber rig.

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
unblocks 020-02 (implement). It does not "research then build a slab": the implementation is a *separate*,
outcome-gated slice.

### Deviation log

- **The probe was reshaped mid-flight (not the original framing).** The initial spike co-weighted a
  payload-strip against consent and assumed consent was an XDM body injection. Both premises were corrected —
  the frame-critique (needs-changes) surfaced that `toXdm`+`context:[]` already read-minimize the body, and
  the maintainer corrected that alloy consent is the `setConsent` command, not a body field. The reshape split
  the halves + re-anchored consent; the live evidence + the re-confirm vindicated it. A correction of a wrong
  premise before the time-box was spent — exactly the frame-critique's purpose.
- **The live `setConsent`-flow leg was NOT run** (deferred). The consent mechanism is characterized from the
  alloy@2.35.0 source + Adobe docs (unambiguous); the live `configure → setConsent(collect:n) → sendEvent`
  suppression run is a named follow-on on the 013 chamber rig. AC2/AC4 explicitly permit source-characterization
  for this pass.
- **Rig note (craft review):** `governedStripped()` ≡ `base()` by construction (add-then-delete), so the
  baseline-vs-stripped comparison is structurally identical (modulo per-call `timestamp`). The check confirms
  the parse→delete→re-serialize round-trip is Edge-valid (meaningful) but cannot fail except on gross
  corruption; a sharper `sensitive`-vs-`stripped` diff was not computed. Tracked for a 020-02 rig refinement
  if the defense-in-depth strip is built.

### Reconciliation sweep

- **Deliverables:** the live-Edge strip-safety rig (`rig/alloy-live-xdm-governance.mjs` + `rig:alloy-xdm-gov`)
  + the source-grounded consent characterization → the Findings + Outcome. **No `core/` / production change**
  (a spike); the implementation is 020-02.
- **Reviews recorded:** frame-critique (needs-changes → reshaped → **re-confirm pass**) + craft (**pass**),
  independent Opus reviewers. The reshape corrected the two load-bearing premises (co-weighted strip;
  body-injection consent) per the frame-critique + the maintainer's `setConsent` correction; the re-confirm +
  the live evidence vindicated it.
- **spec.md reconciled:** the Overview, Slices, **Assumptions**, and **Decomposition** all now carry the
  corrected two-halves frame (the body-injection premise removed — craft-review reconciliation note).
- **Folded into 020-02 (craft note):** `egressVerdict`'s non-strict default *sends* on a data-use denial
  (GA4 body-consent premise); alloy has no body-consent → a collect-denied interact must **drop** — 020-02
  AC1 now specifies strict-like/drop semantics.
- **Deviation (in-doc, sound):** the live `setConsent`-flow leg (`configure → setConsent(collect:n) →
  sendEvent`, observe suppression) was **not run** — characterized from alloy@2.35.0 source + docs, named as
  a follow-on on the 013 chamber rig (AC2/AC4 permit). The live 200/handle-shape rests on
  orchestrator-verification with no committed artifact (per the redaction/no-fixture discipline; 013 precedent).
- **ADR update deferred to 020's close:** the Outcome **supersedes ADR-0012's "probe-first fragile" alloy
  disposition** (+ ADR-0007's alloy residual) — recorded as a 020-02 DoD item, not asserted done here.
- **No live identifiers committed** — rig verified redaction-clean by the orchestrator (env-only datastream;
  only generic schema tokens read; synthetic PII; no fixture written).
