---
status: DONE
dependencies: [020-01]
last_verified: 2026-08-31
frame_review: false
---

<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about
     runnable surfaces by probe first (run it / read source) or a citation. -->

## Slice 020-02 — implement alloy consent enforcement (seam drop + setConsent) + the optional payload strip

**Goal:** Implement the alloy governance that [020-01](slice-01-feasibility-probe.md) found feasible — turning
"alloy isolated" into "alloy **governed**", the airlock-thesis-consistent way. The probe's verdict:
**consent is the real work, via TWO complementary levers, and payload is already-minimal + an optional
Edge-safe strip.** Unblocked by 020-01's Outcome.

**DoR:**
- ✅ [020-01] DONE — verdict: both halves feasible. Consent = the `setConsent` command (in→send /
  out→never-send / pending→queue) + a separate `privacy/set-consent` Edge call; payload already read-minimized
  by `toXdm` + `context:[]`; a seam field-strip is **Edge-safe** (live-confirmed).
- ✅ 017-03's `egressVerdict` (`core/consent.js`) exists — the vendor-neutral seal logic (send/hold/drop per
  the purpose vector) already used for GA4's async seal. **Grounded** (017-03).
- ✅ The seam is `core/wrapped-sdk-host.js` `dispatchInterceptedFetch`, where endpoint-ceiling + config-integrity
  already bind; the consent vector can thread into the chamber `init` like other ctx. **Grounded** (020-01).

**Acceptance Criteria (finalized — implemented + reviewed PASS ×3):**

1. **Seam-side egress drop (the TRUSTED enforcement — does NOT trust the chamber).** At
   `dispatchInterceptedFetch`, apply the ADR-0007 `egressVerdict` (`core/consent.js`) to alloy's intercepted
   interact: a **denied/pending** governing purpose → **hold/drop at the seal** (never dispatched), surfaced
   (009-02). **Semantics catch (020-01 craft review — load-bearing):** `egressVerdict`'s *non-strict default*
   returns **send** on a *data-use* denial (that path is premised on GA4 carrying `consent:denied` in the MP
   body — delegate-and-send). **alloy has NO body-consent field**, so a collect-**denied** interact would leak
   if sent — it must be **suppressed (dropped)**, not sent. So the alloy seam maps a denied/pending `collect`
   purpose → **DROP** (strict-like semantics, e.g. `egressVerdict(…, { strict:true })` or an explicit
   drop-on-denied for alloy), NOT the GA4 send-on-data-use-denial default. Observable: consent-denied → the
   alloy interact does NOT reach Edge (independent of alloy's own `setConsent` gate — so a compromised chamber
   is still held).
2. **Drive `setConsent` in the chamber alloy-boot glue (the idiomatic DELEGATE).** Map the ADR-0007 vector →
   Adobe 2.0 consent shape (`{ consent:[{ standard:"Adobe", version:"2.0", value:{ collect:{ val } } }] }`);
   the chamber glue does `configure → setConsent(mapped) → sendEvent` (the vector crosses in at `init`). So
   alloy self-gates + propagates the `kndctr_<orgId>_consent` cookie — correct vendor behavior, complementing
   the seam drop (defense-in-depth). Observable: with consent denied, alloy self-suppresses (a live
   `setConsent(collect:n)` flow shows no interact) AND the seam would drop it anyway.
3. **Optional thin defense-in-depth payload strip (Edge-safe, low-cost).** If a host denylist is wired, apply
   `governPayload` to `events[].xdm` at the seam (parse→strip→re-serialize — 020-01 confirmed Edge-safe +
   round-trip-preserving). Non-load-bearing (the body is already minimal), so gate it on a denylist being
   present, byte-unchanged otherwise.
4. **No regression** — the GA4 seal (017-03), endpoint-ceiling (016), config-integrity (015), and the alloy
   round-trip (012/014) stay green; the no-consent path is byte-unchanged.

**DoD:**
- [x] ACs pass — the alloy seam-drop (`egressVerdict` **strict**) + the chamber `setConsent` drive + the
      optional strip. **104/104 targeted** (`wrapped-sdk-host`, `alloy-consent`, `consent`, `consent-seal`,
      `coalescing-broker-core`, `core-boundary`, `alloy-config-integrity`); the load-bearing property (a
      compromised chamber is still held at the seam) machine-verified by a fake-chamber-no-`setConsent` test.
      The live `setConsent(collect:n)` chamber-rig confirmation is a named creds-gated follow-on (013 infra).
- [x] Reviews: compliance + craft + arch — **all PASS** (independent Opus over the Sonnet diffs) + this
      reconciliation. Nits folded (fail-loud misconfig warn; never-throw strip tests; corrected test name;
      fail-open-at-swallow comment).
- [x] **ADR-0013 supersedes ADR-0012's alloy-Split disposition + resolves ADR-0007's alloy residual** — alloy
      consent is *feasible* via the trusted seam-drop + `setConsent` delegate, not the feared fragile
      strip-at-seal.
- [x] **No live identifiers committed** — synthetic consent vectors; the live rig stays creds-gated + redacted.

### Deviation log

- **`strict:true` is hardcoded, not a caller opt (intentional).** alloy has no body-consent field to
  reshape-and-send (unlike GA4's configurable `consentStrict`), so a denied/pending purpose MUST drop —
  there is no valid non-strict value. Spec-compliant (AC1) + review-endorsed; not a deviation, recorded as a
  design choice.
- **`pending → drop` (not hold+buffer+flush) is the first-impl choice.** The alloy interact is a synchronous
  vendor-SDK round-trip (alloy's own `sendEvent` promise), not a queued `{url,body}` beacon like GA4's async
  seal (017-03) — a `pending → hold+flush` refinement needs a replay decouple that does not exist for the
  wrapped-SDK path. Fail-closed + safe; tracked as a follow-on (open question: is pending-window data loss
  acceptable for alloy, or prioritize hold+flush? — arch review).
- **Delegate fails OPEN on a `setConsent` error** (chamber swallows, `sendEvent` proceeds) — by design: the
  delegate runs in the untrusted chamber and is never the enforcement; the trusted seam-drop is the backstop.
  A comment at the swallow makes this legible; a delegate-ONLY wiring (consent without `egressPurposes`) now
  **fail-louds** a construction warn.
- **Diagnostic level `warn` for a consent hold** (vs `error` for ceiling/config-integrity) — a consent hold
  is a routine user choice, not an integrity violation; matches GA4's seal (`core/airlock.js`).
- **HTML/live rig callers not wired for the new opts** — `rig/alloy-core-host-harness.html` /
  `alloy-coalescing-core-harness.html` still construct the host with default opts (gates skipped, back-compat
  by construction). Wiring them for a live/browser consent exercise + the live `setConsent(collect:n)` flow is
  a named follow-on.

### Reconciliation sweep

- **Surface:** `core/wrapped-sdk-host.js` (the consent gate + optional strip + the fail-loud misconfig warn);
  NEW `connectors/alloy/consent.js` (`shapeAlloyConsent`, fail-closed); `connectors/alloy/alloy-chamber.worker.js`
  (the `configure → setConsent → sendEvent` drive); the tests. Reuses `core/consent.js` `egressVerdict` +
  `core/payload-governance.js` `governPayload` — no new primitive.
- **Boundaries:** `core/` imports only core siblings; `connectors/alloy/consent.js` imports `resolveConsent`
  from `core/` (connector→core, allowed) — `core-boundary` green. No core→connector coupling.
- **Reviews recorded:** compliance + craft + arch (all pass) + reconciliation, under `reviews/`.
- **Docs:** `docs/refinement-todo.md` gains the alloy-governance follow-ons (pending→hold+flush;
  purpose-list mirror drift; the live-rig/HTML-wiring); `docs/releases/mvp3.md`… (MVP3 shipped — the alloy
  governance is MVP4, recorded in mvp4.md's completion). **ADR-0013** authored + resolves ADR-0012 alloy-Split
  + ADR-0007 alloy-residual.
- **Named residuals (tracked):** the `pending → hold+flush` refinement; the live `setConsent(collect:n)` flow
  + HTML-rig wiring; the purpose-list mirror drift risk; the disclosed dynamic-`import()` residual
  (pre-existing, 016) bounds the "held at the seam" claim for ALL seam controls, not just consent.
- **No live identifiers committed.**

**Anti-horizontal-phasing check:** a consent-denied alloy event is held/dropped at the seal (trusted seam
enforcement) AND self-suppressed by alloy (idiomatic delegate) — an end-to-end, user-observable governance
change on the alloy archetype, completing "the core AEM stack, governed" (MVP4).
