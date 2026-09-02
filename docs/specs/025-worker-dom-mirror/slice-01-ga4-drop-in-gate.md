---
status: DRAFT
dependencies: []
last_verified: 2026-09-02
frame_review: true
kind: spike
---

<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about
     runnable surfaces by probe first (run it / read source) or a citation. -->

## Slice 025-01 — GA4-drop-in de-risk gate (GO / KILL)

**Question:** Does **unmodified `gtag.js`** boot + run in a worker-dom mirror (`@ampproject/worker-dom`), is the
main-thread **mutation-apply INP-safe** under a real load, and does a **useful population** of drop-in-compatible
common tags exist — i.e. **GO or KILL** for building airlock's own minimal mirror (spec 025-02+)?

**Time-box:** 2 days. Probe `@ampproject/worker-dom` (the existing lib — do NOT build airlock's mirror yet).
If the integration balloons, stop at the **GA4 result + the GO/KILL call** — the gate's job is the decision,
not a polished harness.

**Goal:** Spend the *cheapest* effort that can KILL the Tier-0 mirror build before airlock invests in building
its own mirror — with **unmodified GA4 as the litmus** (maintainer, 2026-09-02: a common tag that won't run is
a kill switch).

**DoR:**
- ✅ [ADR-0014](../../decisions/adr-0014-worker-dom-compat-minimal-mirror.md) (Accepted) names the two unproven
  bets (apply-INP-safety; useful-population) this gate validates; [024](../024-worker-dom-compat-spike/spec.md)
  grounded worker-dom's mechanism + the sync-read boundary.
- ✅ `@ampproject/worker-dom@0.36` is installable (`upgradeElement(el, workerUrl)` bootstrap); [023](../023-dom-cost-containment-poc/spec.md)
  provides the Event-Timing within-storm-p75 INP instrument (`rig/nasty-tag.mjs` / `rig/harness.html`) to reuse.
- ✅ `gtag.js` is a public script (GA4 Measurement) — a real, common drop-in tag; no credentials needed to load
  it (a synthetic/`debug` measurement id keeps beacons harmless).

**Acceptance Criteria (a spike's ACs are the investigation, not shipped behavior):**

1. **GA4 boot + run (the litmus).** Install `@ampproject/worker-dom`; `upgradeElement` a fixture whose worker
   script is **unmodified `gtag.js`** + a `gtag('event', …)` call. Record precisely what **works vs breaks**:
   does it boot? Fire a `page_view` / custom event? Where does it hit the won't-work set — cookies (`_ga`,
   airlock mediates), the beacon (`fetch`/`sendBeacon`/`img` pixel — governed), its own sub-resource loads
   (`googletagmanager.com` — "loads own sub-resources expecting a real window", a known worker-dom limit)? The
   honest boot/run map is the deliverable.
2. **Mutation-apply INP probe (bet #1).** With a write-heavy drop-in load (gtag.js's own DOM work if
   sufficient, else a synthetic write-heavy unmodified tag) under the worker-dom mirror, measure the
   **main-thread mutation-apply** INP the 023 way (Event-Timing within-storm p75, N-runs + median + band). Does
   the apply stay INP-safe (the coordinator frame-budgets it), or does it **re-tank INP** (the long task moved,
   not removed)? A number.
3. **Useful-population read (bet #2).** GA4 is the litmus; try **2–3 more common tags** (e.g. a pixel, a simple
   widget) drop-in. Estimate honestly whether a *useful* population of unmodified write/compute-heavy-*without*-
   sync-read common tags exists — or whether the common tags are mostly connector-shaped (→ the pixel
   connector, spec 026) or sync-read (→ the Tier-0 gap).

**DoD (spike close-out):**
- [ ] **Findings** — the GA4 boot/run map; the apply-INP number; the population read.
- [ ] **Outcome** — **GO** (GA4 + a couple common tags run drop-in AND the apply is INP-safe → build airlock's
      minimal mirror, reserve 025-02) **or KILL** (GA4 won't run, or the apply re-tanks INP → do NOT build Tier 0
      standalone; route effort to Lever-1 adaptation / the pixel connector (026) / reconsider Tier 1). Set
      plainly; promote to ADR-0014's kill-criteria + refinement-todo.
- [ ] Probe code under `probes/` or `rig/`; no live identifiers (a synthetic/`debug` GA4 measurement id; no
      real ids/endpoints beyond public `gtag.js`).

**Findings:** _(filled during IN_PROGRESS)_

**Outcome:** _(GO → reserve 025-02 minimal-mirror build / KILL → reason + the re-routed effort)_

**Anti-horizontal-phasing check:** a spike is exempt — but this one ships a **GO/KILL decision** on a real
adoption criterion (GA4 drop-in), the cheapest thing that can stop a large mirror build before it starts.
