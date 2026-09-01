---
status: DRAFT
dependencies: []
last_verified: 2026-08-31
frame_review: true
---

<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about
     runnable surfaces by probe first (run it / read source) or a citation. -->

## Slice 022-01 — governed page-view RUM beacon (+ A/B grounding)

**Goal:** Ship ONE real, **confined** RUM beacon end-to-end — a `top`/page-view checkpoint captured on the
main thread, shaped into the AEM RUM wire contract, and egressed under airlock's **RUM governance class**
(endpoint ceiling on `ot.aem.live` + payload-hygiene — **NOT** consent-gated; RUM is PII-compliant performance
telemetry not subject to consent, maintainer 2026-08-31) to the AEM RUM collector. Along the way, **ground the
load-bearing hosting fork** (A: wrap the enhancer in a chamber vs B: reproduce the beacon natively) and record
which mechanism 022-02 builds on. (The `top` beacon uses **no** CWV; the "fed by airlock's CWV capture" part
of mechanism B is 022-02's enhancer concern, not this slice's.) This is the vertical minimum: a confined RUM
ping exists.

**DoR:**
- ✅ The `sampleRUM` **core beacon contract** is grounded (`probes/eds-testbed/scripts/aem.js:14-135`, read
  2026-08-31): `navigator.sendBeacon(".rum/${weight}"@ot.aem.live, { weight, id, referer, checkpoint, t,
  …pingData })`; `id = crypto.randomUUID().slice(-9)`; `top` fires on page load.
- ✅ airlock already owns the confinement primitives this rides on: `navigator.sendBeacon` interception
  (`denySendBeacon`, `applyEgressConfinement` — `core/egress-confinement.js`, wired in the alloy chamber) +
  the **endpoint ceiling** (`core/endpoint-ceiling.js`, scheme+origin+path). **Grounded** (in-repo, this
  session). **RUM is NOT consent-gated** (maintainer, 2026-08-31) — the consent seam
  (`egressVerdict(..., {strict})`) deliberately does **not** apply to this connector; see spec § Governance
  class.
- ⚠️ **NOT yet grounded (this slice's first job):** the `helix-rum-enhancer` runtime — does it require
  main-thread `PerformanceObserver`/DOM (⇒ mechanism A is hard, favour B), and what version/SRI to pin.

**Acceptance Criteria:**

1. **Ground the hosting mechanism (A vs B) and RECORD it.** Probe `helix-rum-enhancer`'s actual runtime
   dependencies (read its source / a real load) — specifically whether its CWV/interaction collection needs
   main-thread `PerformanceObserver` + `document` a chamber cannot provide. Record the finding + the chosen
   mechanism for the **core** path (lean B: reproduce the small `top` beacon contract — which needs no CWV;
   the enhancer's runtime CWV feed is 022-02's concern) and note the **enhancer** decision explicitly for
   022-02. If the probe shows (A) is cleanly feasible, record that instead — the grounding decides, not the
   lean.
2. **One confined page-view beacon, end-to-end (NOT consent-gated).** A `top`/page-view checkpoint is
   captured on the main thread, shaped into the grounded RUM payload (`{ weight, id, referer,
   checkpoint:"top", t }`), and egressed under the RUM governance class: an **endpoint ceiling pinned to
   `ot.aem.live`** (scheme https, the `.rum/` path) + a **payload-hygiene guard**. Under mechanism B the
   payload is airlock-constructed, so hygiene is **by construction** — the guard is a test assertion that the
   beacon carries ONLY `{ weight, id, referer, checkpoint, t }` (the ephemeral per-page `id`; no cookie /
   cross-page / persistent identifier / other PII). The not-consent-gated class is **free** on the existing
   seam (frame-critique, 2026-08-31): the manifest declares `endpoints:[ot.aem.live]` + **no** egress
   purposes, so `core/airlock.js` applies the ceiling (`ceiling.length`) and skips the consent gate
   (`egressPurposes` empty) with no new machinery.
   Observable: with the endpoint allowed, one RUM beacon reaches the collector shape **regardless of consent**
   (RUM is not subject to it — a deliberate, tested contrast with the GA4/alloy consent seam); with the
   endpoint **re-pointed** to a non-`ot.aem.live` host, it is **held** (redacted diagnostic, no beacon). The
   beacon is byte-shaped so the AEM RUM pipeline accepts it (the `.rum/${weight}` URL + JSON body match the
   grounded contract).
3. **No page-side change yet + no double-emit from airlock.** This slice adds airlock's governed path only;
   the page's inline `sampleRUM` removal is 022-03. airlock emits **at most one** `top` beacon per selected
   page-load (no duplicate with its own future checkpoints). The honest boundary (airlock + page both emit
   until 022-03 cuts the page over) is **named**, not hidden.

**DoD:**
- [ ] AC1 grounding recorded (enhancer runtime + A/B decision, with the probe evidence). ACs 2–3 pass. Tests:
      the confined page-view beacon path (endpoint allowed → shaped beacon; endpoint **re-pointed** off
      `ot.aem.live` → held); the beacon fires **regardless of consent** (RUM is not gated on it — a tested
      contrast with the GA4/alloy seam); the payload matches the grounded wire contract + carries no PII beyond
      the ephemeral `id`. Targeted sweep (full suite hangs): the new connector's tests + `endpoint-ceiling*`,
      `egress-confinement` (and `consent-seal` to prove RUM does NOT trip it).
- [ ] **Frame-critique** (the load-bearing premise: "host `helix-rum-js`" = wrap the enhancer in a chamber —
      the grounding may show the core is a native beacon-reproduction, not a wrapped SDK; do not build a
      chamber-host on an ungrounded feasibility) + compliance + craft + reconciliation.
- [ ] Deviation log + reconciliation sweep; the `helix-rum` connector's manifest (endpoints `ot.aem.live`,
      **no egress purposes** — the not-consent-gated RUM class) declared per ADR-0006/0007; mvp4.md
      `helix-rum` row updated.
- [ ] **No live identifiers committed** (no real RUM `id`s, no customer RUM base URLs beyond the public
      `ot.aem.live` default — synthetic ids only).

**Anti-horizontal-phasing check:** a real RUM beacon is **confined** to `ot.aem.live` (endpoint ceiling +
payload-hygiene, **not** consent-gated) — an observable governance change on the egress path. Honest value
(frame-critique temper): until 022-03 removes the page's `sampleRUM`, airlock's `top` is *redundant* with the
page's own, so 022-01 delivers **"a governed/confined RUM path exists"**, not net-new telemetry (the
double-emit is named in AC3). The A/B grounding is folded into the
slice that ships the first beacon (no standalone spike), per SPIDR discipline.
