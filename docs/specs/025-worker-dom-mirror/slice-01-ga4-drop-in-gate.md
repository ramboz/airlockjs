---
status: DRAFT
dependencies: []
last_verified: 2026-09-02
frame_review: true
kind: spike
---

<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about
     runnable surfaces by probe first (run it / read source) or a citation. -->

## Slice 025-01 — Tier-0 mechanism de-risk gate (GO / KILL) + GA4 adoption litmus

> Reframed 2026-09-02 after the frame-critique: the earlier draft wired the maintainer's **GA4 adoption** kill
> switch to the **Tier-0 mechanism** build decision — but they are **orthogonal**. GA4 (gtag.js) is
> network/sub-resource-shaped, not write/compute-heavy; its likely failure (loading `googletagmanager.com` —
> a 024-documented won't-work case) says nothing about ADR-0014's two mechanism bets, is plausibly fixable in
> airlock's own mirror (a mediated sub-resource proxy), and **GA4 is already supported via the connector**
> (spec 004/008 + pixel connector 026). So this gate runs **two independent verdicts**. **Awaiting maintainer
> ratification** that "GA4 supported via the connector" satisfies the "GA4 = kill switch" intent (vs "GA4 must
> drop in") — this reframe reinterprets a maintainer-stated gate, so it is not proceeding until confirmed.

**Question:** **(Mechanism)** Do ADR-0014's two unproven bets hold — the main-thread mutation-apply INP-safe
under a *DOM-mutation-heavy* unmodified tag, AND a useful population of unmodified write/compute-heavy-*without*-
sync-read tags exists — **GO/KILL** for building airlock's own minimal mirror (025-02)? **(Adoption, separate)**
Does the unmodified drop-in path handle **GA4**, and if not, on which **axis** (model-inherent vs fixable
sub-resource/proxy gap)?

**Time-box:** 2 days. Probe `@ampproject/worker-dom` (the lib, not airlock's mirror yet). **Under a balloon,
preserve the MECHANISM ACs (AC1 on a synthetic DOM-heavy load — which does NOT need gtag.js to boot — + AC2)
and let the GA4 datum (AC3) degrade** — the opposite of the old clause; the mechanism bets are the decision.

**Goal:** The cheapest probe that can KILL (or greenlight) the Tier-0 mirror build **on ADR-0014's actual
kill criteria** (apply re-tanks / population mirage — `adr-0014:105-109`), while separately reading GA4's
drop-in axis so 025-02 knows whether it needs a sub-resource proxy.

**DoR:**
- ✅ [ADR-0014](../../decisions/adr-0014-worker-dom-compat-minimal-mirror.md) (Accepted) — the two mechanism
  bets + the kill criteria this gate keys GO/KILL on; [024](../024-worker-dom-compat-spike/spec.md) grounded
  the async model + the won't-work set (incl. **sub-resource loading**, 024 slice-01 §Findings).
- ✅ The 023 INP instrument to reuse is **`rig/nasty-tag-harness.html` + `rig/nasty-tag.mjs`** (Event-Timing
  within-storm p75, N-runs + median + band) — it already ships a synthetic DOM-mutation-heavy tag.
- ⚠️ `@ampproject/worker-dom@0.36` is **not yet installed** (024 inspected npm metadata only) — AC1/AC3 install
  it + confirm a clean `upgradeElement` boot; the DoR-level "installable" is unproven-by-run.

**Acceptance Criteria (a spike's ACs are the investigation; the MECHANISM ones decide GO/KILL):**

1. **[MECHANISM bet #1 — the central bet] The mutation-apply is INP-safe under a DOM-heavy load.** Run a
   **verifiably DOM-mutation-heavy unmodified tag** (reuse/port 023's synthetic write-heavy fixture — NOT
   gtag.js, which is not DOM-heavy) inside `@ampproject/worker-dom`, and measure the **main-thread
   mutation-apply** INP the 023 way (Event-Timing within-storm p75, N-runs + median + band, work-completed
   observable). Does the frame-budgeted apply stay INP-safe, or does it **re-tank** (the long task moved, not
   removed)? A number — **or**, if worker-dom@0.36 is too stale to boot even the synthetic, an **axis-classified
   "couldn't-measure-in-0.36 (lib-staleness, NOT a model KILL)"** (mirror 024 AC3's honest escape), measured on
   airlock's own minimal mirror instead: a lib-boot failure must **never** be read as the mechanism re-tanking.
   **This is the primary GO/KILL input** (ADR-0014's central unproven bet).
2. **[MECHANISM bet #2 — the population] At least one REAL target-shape tag runs off-thread.** Find + run at
   least one **real, unmodified, write/compute-heavy-*without*-sync-read** tag (the actual Tier-0 target shape —
   NOT gtag.js/pixels, which are the wrong shape) in the mirror; does it run off-thread with INP contained?
   Plus an honest read: is such a population **common enough** to justify the build, or are most common tags
   connector-shaped (→ 026) / sync-read (→ the Tier-0 gap)? **"Population-mirage" (the KILL trigger) means the
   corpus lacks real target-shape tags — a *corpus* judgment**, explicitly distinct from "found one but stale
   0.36 couldn't boot it" (a lib-completeness gap, NOT a mechanism KILL → measure on airlock's own mirror).
3. **[ADOPTION litmus — SEPARATE verdict, not a mechanism KILL] GA4 drop-in + its failure axis.** Try
   unmodified `gtag.js` (+ a `gtag('event', …)`, a synthetic/`debug` measurement id so beacons are harmless).
   Boot/run? Where does it break — and **classify the axis**: **(a) model-inherent** (sync-read / needs a real
   `window` even a proxy can't fake → does NOT transfer to airlock's own mirror as fixable) vs **(b)
   lib-completeness / sub-resource-proxy gap** (e.g. the `googletagmanager.com` config fetch — a mediated
   sub-resource proxy airlock's own mirror could add). **Confirm** whether gtag.js's sub-resource config fetch
   (keyed to the id) even boots in the worker — "loads harmlessly" ≠ "sub-resource boots off-thread." GA4's
   result feeds **025-02's feature set** (does the mirror need a sub-resource proxy?) + the adoption story
   (drop-in bonus vs stays-on-the-connector), **not** the build's existence.

**DoD (spike close-out):**
- [ ] **Findings** — the apply-INP number (AC1); the target-shape tag result + population read (AC2); the GA4
      boot/run map + failure-axis classification (AC3).
- [ ] **Outcome — two verdicts, stated separately:**
      **MECHANISM: GO** (AC1 INP-safe AND AC2 a useful population → build airlock's minimal mirror, reserve
      025-02) **or KILL** (AC1 re-tanks OR AC2 population-mirage → do NOT build Tier 0 standalone; re-route to
      Lever-1 adaptation / the pixel connector (026) / reconsider Tier 1) — keyed on ADR-0014's kill criteria,
      reconciled with them. **ADOPTION (GA4):** drops-in-clean / needs-sub-resource-proxy (a 025-02 feature) /
      fundamentally-can't (stays on the connector path — still supported). Promote both to ADR-0014 +
      refinement-todo.
- [ ] Probe code under `probes/`/`rig/`; no live identifiers (synthetic/`debug` GA4 id; public `gtag.js` only).

**Findings:** _(filled during IN_PROGRESS)_

**Outcome:** _(MECHANISM GO/KILL + the ADOPTION-GA4 axis verdict)_

**Anti-horizontal-phasing check:** a spike is exempt — this ships a **mechanism GO/KILL** (on ADR-0014's real
bets) + a **separate GA4 adoption axis**, the cheapest thing that can stop the mirror build for the *right*
reason.
