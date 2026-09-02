---
status: DONE
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
> (spec 004/008 + pixel connector 026). So this gate runs **two independent verdicts**. **RATIFIED by the
> maintainer (2026-09-02): "drop-in is the bonus"** — GA4 supported via the connector satisfies the intent; a
> GA4 drop-in miss is an adoption/feature signal, not a build KILL.

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
- [x] **Findings** — the apply-INP number (AC1); the target-shape tag result + population read (AC2); the GA4
      boot/run map + failure-axis classification (AC3).
- [x] **Outcome — two verdicts, stated separately:**
      **MECHANISM: GO** (AC1 INP-safe AND AC2 a useful population → build airlock's minimal mirror, reserve
      025-02) **or KILL** (AC1 re-tanks OR AC2 population-mirage → do NOT build Tier 0 standalone; re-route to
      Lever-1 adaptation / the pixel connector (026) / reconsider Tier 1) — keyed on ADR-0014's kill criteria,
      reconciled with them. **ADOPTION (GA4):** drops-in-clean / needs-sub-resource-proxy (a 025-02 feature) /
      fundamentally-can't (stays on the connector path — still supported). Promote both to ADR-0014 +
      refinement-todo.
- [x] Probe code under `probes/`/`rig/`; no live identifiers (synthetic/`debug` GA4 id; public `gtag.js` only).

**Findings (2026-09-02 — grounded: `@ampproject/worker-dom@0.36.0` + `prismjs@1.30.0` installed as
devDependencies and RUN, not just inspected; probe code under `rig/worker-dom-*`):**

- **AC1 — mechanism bet #1 (apply-INP-safety), THE PRIMARY deliverable: RUNS, and stays INP-safe.**
  `upgradeElement()` booted cleanly (no boot error). `Element.offsetHeight`/`offsetWidth`/etc. are grounded, by
  reading the compiled worker bundle, as literally never implemented ("Layout Properties (TBD)", no getter
  defined) — so the ported nasty-step's sync-read line is an inert no-op off-thread, not a live forced reflow;
  this is 024's documented sync-read boundary, now confirmed by reading source rather than by citation alone.
  At the 023-01-fixture-matching scale (400 elements, 500µs/element busy-wait, 15 clicks @ 120ms, N=3):
  **apply p75 = 8ms, p98 = 8ms, max = 8ms (band [8,8] across all 3 runs)**, ALL 6000 expected mutations applied
  (workCompleted=6000/6000, fairness confirmed). A same-session, same-machine fresh re-run of the ORIGINAL
  `rig/nasty-tag.mjs` naive mode reproduced its documented naive p75=200ms baseline (023-01 slice-01 §Findings)
  — so the contrast is naive 200ms → worker-dom-apply 8ms (25x), and worker-dom's number even beats Lever-1's
  OWN scheduled-capability number (32ms) on this fixture, because worker-dom moves the ENTIRE 200ms of busy-wait
  compute off-thread AND the ported sync-read is inert off-thread too (so the main-thread apply has no
  interleaved forced-reflow either) — an important nuance: the 8ms number is an honest measurement of "does a
  batched WRITE-heavy mutation stream stay INP-safe on apply" (exactly bet #1's question), not a strict
  same-total-main-thread-cost replay of naive's forced-reflow-heavy 200ms (see deviation log). A stress
  corroboration (5000 elements/click, WORK_US=0, unthrottled) held the SAME apply p75=8ms with 14/15 clicks'
  worth of work landing (one forwarded click event unexplained-dropped, no error — deviation log). An EXTREME
  stress (20000 elements/click) silently stalled (0/N work completed even after ~40s of settle-polling, zero
  console/page errors) — an undiagnosed scale ceiling, explicitly NOT characterized further within this
  spike's time-box; critically, it did **not** manifest as elevated INP (INP stayed flat at 8ms), so it reads
  as a worker-side backlog/stall, not a main-thread mutation-apply re-tank. **No re-tank observed at either
  measured scale.**
- **AC2 — mechanism bet #2 (the population): ONE real, current, unmodified target-shape tag confirmed to
  work.** Candidate: `prismjs@1.30.0`'s default bundle (`prism.js`, 58KB) — grounded via source grep across the
  whole bundle: **zero** occurrences of `getBoundingClientRect`/`offsetHeight`/`offsetWidth`/
  `getComputedStyle`/`scrollHeight`/`clientHeight` — a genuinely write/compute-heavy-*without*-sync-read tag
  (regex tokenization + `element.innerHTML = highlightedMarkup`; worker-dom's `Element.innerHTML` setter is a
  real internal HTML-string parser, confirmed from source). First run hit ONE concrete, nameable
  lib-completeness gap: `Element.prototype.matches` is unimplemented in worker-dom@0.36
  (`TypeError: pre.matches is not a function`, thrown from Prism's OWN bundled file-highlight plugin hook,
  which unconditionally calls `pre.matches(SELECTOR)` on every highlight — not a path this probe chose).
  `.matches()` needs zero live-layout info — **axis-classified lib-completeness, NOT model-inherent** — and a
  one-line always-`false` stub (correct for this fixture, which has no `data-src` attribute) unblocked it. With
  the stub, real unmodified Prism.js ran off-thread successfully: `codeEl.innerHTML` grew from 12,718 raw chars
  to 148,558 highlighted chars (11.7x growth from `<span class="token…">` wraps = genuine tokenization, not a
  silent no-op), applied to the real main-thread DOM. INP at a generous per-click gap (6 clicks @ 800ms, N=3):
  **apply p75 = 8ms (band [8,8])**, 5/6 clicks' worth of work landing, reproducible identically across all 3
  runs. At a tighter storm (12 clicks @ 150ms) only 3/12 landed — a WORKER-side compute/serialize throughput
  ceiling for this ~150KB-output highlight pass (roughly one full pass per 400-800ms wall-clock), **not** a
  main-thread INP problem (zero page errors either configuration; INP stayed flat at 8ms in both) — benign
  backpressure, not a re-tank. **Honest population read:** this slice grounds exactly ONE real, current
  library as write/compute-heavy-without-sync-read and INP-safe off-thread — not a corpus census (R-007 is
  connector-fit-classified, the wrong yardstick per ADR-0014's own Assumptions; a DOM-cost-shaped corpus survey
  is out of this slice's time-box). The shape (regex/string processing + DOM construction via `innerHTML`, no
  live-layout reads) is a recognizable pattern among syntax highlighters, markdown/template renderers, and
  data-driven widget-markup builders — plausibly a real, non-trivial slice of the long tail — but whether it is
  a MAJORITY or MINORITY of real costly-DOM martech remains genuinely **unvalidated** by this slice, consistent
  with ADR-0014's own coverage-bound framing ("Tier 0 alone may contain a MINORITY of real costly tags, not
  most" — `adr-0014:79-84`). **Not a population-mirage** (a real, qualifying, currently-maintained tag exists
  and works) — but not a validated-common population either.
- **AC3 — ADOPTION litmus (GA4/gtag.js), separate from the mechanism verdict.** Real, public, unmodified
  `gtag.js` (`googletagmanager.com/gtag/js?id=G-DEBUGTEST0`, synthetic/debug id) fetched live (200 OK).
  `upgradeElement()` resolved cleanly with **zero** console/page errors — contradicts a naive "GA4 fails
  outright" expectation. A same-origin ABSOLUTE-PATH `importScripts()` call fails inside a worker-dom Blob-URL
  worker (`SyntaxError:… The URL '…' is invalid` — a real, grounded browser quirk); a FULLY QUALIFIED
  (scheme+host) cross-origin `importScripts()` URL succeeds — so gtag.js's own script content loaded and ran
  off-thread with no errors, and `gtag('event', …)` calls did not throw (dataLayer length reached 3 after
  'js'+'config'+'event'). **But** the confirming signal — an actual outbound analytics beacon — never fired
  off-thread. A live CONTROL (same synthetic id, plain main-thread page, no worker-dom) DID fire a real
  `page_view` beacon to `google-analytics.com/g/collect` (204 accepted) automatically, proving the synthetic id
  itself is not the blocker. Root-caused via direct in-worker capability probes: `typeof screen === 'undefined'`
  (TRUE — the control's beacon URL embedded `sr=1280x720` from `screen.width/height`, unavailable off-thread)
  and `navigator.sendBeacon` is `undefined` (TRUE) — both are **Worker-global-scope platform absences**, not
  DOM-completeness gaps (no DOM mirror, however complete, adds `screen`/`sendBeacon` to a Worker; they were
  never part of the DOM API surface). `navigator.userAgentData` IS present; `fetch`/`XMLHttpRequest` ARE
  present (network capability exists in principle). `document.cookie` is unimplemented in worker-dom's mirror
  (reads back `undefined`) — this one IS plausibly lib-completeness: worker-dom already seeds ambient state at
  hydration time for `localStorage`/`sessionStorage` (`getStorageInit(...)`, grounded from source) and window
  dimensions (`[innerWidth, innerHeight]`), so a cookie bridge would extend an existing, proven pattern, not
  invent a new one. **Axis classification: PRIMARILY model-inherent** (`screen` + `sendBeacon` — Worker-global-
  scope absences no DOM mirror fixes) **with a secondary, plausibly-fixable lib-completeness contributor**
  (cookie) — a more specific, better-grounded finding than 024's original blanket "sub-resource loading won't
  work" prediction, which turned out to be only PARTLY right: the actual script fetch and cross-origin
  importScripts sub-resource load both work fine; the real blocker is ambient Window-only globals, a different
  kind of gap.

**Outcome (FINAL — orchestrator call, 2026-09-02; AC1 independently re-run: apply p75=8ms band [8,8]
reproduced):**

- **MECHANISM: GO.** Neither ADR-0014 kill criterion fires — the apply does **not** re-tank (8ms, no re-tank
  at two scales, independently reproduced), and a real qualifying tag runs off-thread (not a population-mirage).
  → **build airlock's minimal mirror (reserve 025-02)**, with these grounded caveats baked into it: (1) the
  population **SIZE** is unvalidated (one example; validate before over-investing — a DOM-cost-shaped-corpus
  read is a 025-02 early task); (2) the mirror needs **ambient-global proxying** (`screen`/`sendBeacon`/cookie
  — grounded from AC3), not just DOM APIs; (3) two benign worker-side open threads (the 20000-el stall; Prism's
  throughput ceiling) are worker-backpressure, **not** INP re-tank — a 025-02 investigation.
- **SEQUENCING (maintainer's strategic call — surfaced, not decided here):** the mechanism GOes, but Tier 0's
  *martech* value stays bounded/uncertain (the one qualifying tag is a dev tool; the common martech tested
  needs ambient-global proxy [GA4] or is connector-shaped [pixels → 026]). So **build 025-02 now vs prioritize
  026 (the proven common-tags leverage) first** is a maintainer decision, not a mechanism question.
- **(original proposed read, retained:)** MECHANISM: proposed GO, with an explicit caveat. AC1's central bet (apply INP-safety) is decisively
  confirmed at two scales (023-parity and a 12.5x-heavier unthrottled stress) with **no re-tank observed** —
  the one open thread (the 20000-element stall) manifested as work-not-landing, not elevated INP, so it does
  not implicate the kill criterion ("the async mutation-apply re-tanks INP", `adr-0014:108`). AC2 confirms a
  real, current, write/compute-heavy-without-sync-read library runs off-thread INP-safe once one lib-
  completeness gap is patched — satisfying "not a population-mirage" (a real qualifying tag exists and works),
  but the CAVEAT is real: this slice grounds ONE example, not a corpus census, so the GO is on "the mechanism
  works for the target shape," not on "the target shape is common" — that broader question stays open per
  ADR-0014's own honest coverage-bound language and is a fair candidate for a follow-up DOM-cost-shaped-corpus
  probe before 025-02 over-invests, not a reason to withhold this GO.
- **ADOPTION (GA4): needs-ambient-global-proxy** (a more precise read than "needs-sub-resource-proxy" — script
  loading and cross-origin sub-resource fetching both already work; the gap is `screen`+`sendBeacon`+cookie
  ambient state, not resource loading). Per this slice's own ratified reframing ("GA4 supported via the
  connector... drop-in is the bonus"), this does **not** block the mechanism GO — GA4 stays on the connector
  path (spec 004/008, pixel connector 026) either way. If GA4 drop-in is ever prioritized, 025-02's backlog
  would need: a `screen`-dimension hydration seed (extending the existing `[innerWidth,innerHeight]` pattern),
  a `sendBeacon` message-bridge to a real main-thread call, and cookie mediation — concrete, scoped, but
  explicitly not gating.

### Deviation log

- **AC1's ported sync-read is inert off-thread by construction — the apply number is not a strict same-cost
  replay of naive's 200ms.** The nasty-step's `void el.offsetHeight` forces a real synchronous reflow on the
  main thread (naive's actual bottleneck, per 023-01) but is a harmless no-op in worker-dom's mirror (grounded:
  never implemented). So the ported fixture's mutation-apply batch has no interleaved forced-reflow either,
  which is PART of why 8ms is so much lower than naive's 200ms. This does not invalidate the AC1 measurement —
  "does a batched write-heavy mutation stream stay INP-safe on apply" is exactly bet #1's question, and that is
  what was measured — but it means the naive-vs-worker-dom contrast is not apples-to-apples the way 023-01's
  own naive-vs-airlock contrast was (same code, same thread, different scheduling); here the SHAPE of the
  main-thread work changed too. Recorded so the number isn't over-read.
- **AC1: one dropped forwarded click at 5000-element/click stress (14/15, no error); a full stall at
  20000-elements/click (0/N, no error, ~40s settle-polling exhausted).** Neither was root-caused further —
  time-boxed out per this slice's own escape clause ("if the integration balloons... report what you got").
  Both are recorded as open, unexplained scale-behavior, explicitly NOT read as the mutation-apply re-tanking
  INP (INP itself stayed flat at 8ms in both cases — the failure mode is work-not-landing, not main-thread
  jank).
- **AC2: `importScripts()` rejects same-origin absolute-PATH URLs from inside a worker-dom Blob-URL worker**
  (`SyntaxError: Failed to execute 'importScripts'... The URL '/node_modules/...' is invalid`), but accepts
  fully-qualified (scheme+host) URLs. Pivoted the Prism integration from `importScripts()` to SERVER-SIDE
  CONCATENATION (prism.js + a `Prism.manual = true` prefix + `rig/worker-dom-prism-glue.js`, built per-request
  by `rig/worker-dom-prism.mjs`) — both to sidestep the quirk and because `upgradeElement(el, domURL)` only
  accepts one `authorURL` anyway, so concatenation is the faithful shape for "glue + a real library" under
  worker-dom's actual API, not a workaround unique to this probe. AC3's GA4 script itself DID load successfully
  via `importScripts()` with a fully-qualified cross-origin URL (see Findings) — the quirk is specific to
  same-origin relative/absolute-path forms.
- **AC2: `Element.prototype.matches` unimplemented in worker-dom@0.36** — hit via Prism's own bundled
  file-highlight plugin hook (`pre.matches(SELECTOR)`, called unconditionally on every highlight, not a code
  path this probe chose). Patched with a one-line stub that always returns `false` — correct for this fixture
  (no `data-src` attribute present) but explicitly NOT a general selector engine; recorded as
  lib-completeness, not model-inherent (grounded: `.matches()` needs zero live-layout info).
- **AC2: an initial "remove old `<pre>`, create a new one" per-click fixture design hit a repeatable
  `HierarchyRequestError: insertBefore... This node type does not support this method` after ~half the storm.**
  Switched to reusing the SAME `<pre>/<code>` nodes in place (reset `.textContent` + re-`highlightElement()`
  each click) — this fully eliminated the error and is also the more common real-world shape for a
  live-updating widget. Not further root-caused within the time-box; recorded as an observed worker-dom
  node-lifecycle quirk under repeated detach/reattach, not a mechanism-level finding.
- **AC3: two purpose-built control/diagnostic artifacts were added beyond the minimum ask** —
  `rig/worker-dom-ga4-control-harness.html` (a plain main-thread page, same synthetic id, to disambiguate
  "gtag.js no-ops for a fake id" from "worker-dom broke something") and in-worker capability probes
  (`typeof screen`, `navigator.sendBeacon`, `navigator.userAgentData`, `document.cookie`, `fetch`/
  `XMLHttpRequest` presence) in `rig/worker-dom-ga4-author.js`. Both were judged proportionate — AC3 explicitly
  asks for an axis classification, and the control run was the cheapest way to ground it rather than guess.
- **`docs/specs/025-worker-dom-mirror/spec.md`'s frontmatter `status` changed from `DRAFT` to `IN_PROGRESS`
  during this session without any Edit/Write call from this implementer** — observed via `git status`/`git
  diff`, not self-initiated (likely jig workflow automation tied to starting work on the slice). Flagged here
  for the reviewer's awareness since this implementer did not run `workflow.py transition` and was not asked
  to, per this slice's own instruction to not transition status.
- **Two devDependencies added, both probe-only, per this slice's explicit instructions:**
  `@ampproject/worker-dom@^0.36.0` and `prismjs@^1.30.0` (the AC2 real-tag candidate — not itself named in the
  slice, chosen and grounded during the investigation). Three `rig:wd-*` npm scripts added to `package.json`,
  matching the existing `rig:*` convention, for reproducibility.

### Reconciliation sweep

- **Question answered + Outcome set (the spike's contract):** both mechanism bets probed — bet #1 (apply
  INP-safe) **confirmed, independently re-run by the orchestrator** (apply p75=8ms band [8,8] reproduced, not
  just trusted); bet #2 (a real target-shape tag) **confirmed** (Prism runs off-thread INP-safe — not a
  mirage), with the population SIZE honestly open. Outcome: **MECHANISM GO** (kill criteria don't fire) + the
  GA4 adoption axis (needs-ambient-global-proxy) + the sequencing fork surfaced to the maintainer.
- **Promoted:** ADR-0014 (the two kill criteria evaluated + didn't fire → GO; the ambient-global-proxy finding
  sharpens 025-02's scope beyond "just DOM APIs"; the population-size-open caveat reaffirms the coverage bound)
  + refinement-todo (POC-B → mechanism-validated, 025-02 GO pending the sequencing call).
- **Downstream named:** 025-02 (the mirror build — GO'd on the mechanism; **the 025-02-vs-026 sequencing is the
  maintainer's strategic call**, not a mechanism question). Two worker-side open threads (20000-el stall;
  Prism throughput ceiling) folded into the deviation log as 025-02 investigation items — worker-backpressure,
  not INP.
- **Probe hygiene:** `@ampproject/worker-dom` + `prismjs` added as **devDependencies** (probe-only, not runtime
  deps — the mirror is airlock's own to build, per ADR-0014); rig code under `rig/worker-dom-*`; `npm run lint`
  clean; no live identifiers (synthetic `G-DEBUGTEST0` id; public `gtag.js`).

**Anti-horizontal-phasing check:** a spike is exempt — this ships a **mechanism GO/KILL** (on ADR-0014's real
bets) + a **separate GA4 adoption axis**, the cheapest thing that can stop the mirror build for the *right*
reason.
