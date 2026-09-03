---
status: DONE
dependencies: []
last_verified: 2026-09-02
frame_review: true
---

<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about
     runnable surfaces by probe first (run it / read source) or a citation. -->

## Slice 025-03 — a real tag (Prism) through the mirror: `innerHTML` + a sanitized apply, INP-measured

**Goal:** Run the **UNMODIFIED Prism** tag (the real target-shape tag 025-01 found — write/compute-heavy,
`innerHTML`-driven) **off-thread through airlock's OWN mirror** (025-02), adding the **`innerHTML`** capability:
the worker-side mirror records it, and the main-thread apply routes it through the **existing
`core/sanitize-html.js`** sanitizer BEFORE the real `el.innerHTML =` write (the security write-path 025-02
deferred). Then **honestly measure the load-bearing INP question — which is DIFFERENT from 025-02's** (and, per the
frame-critique, possibly ADVERSE): does the governed off-thread path actually **beat naive on-page Prism**, given
that airlock's sanitize round-trip ADDS main-thread work? — and wire the dom-chamber's `build.mjs` entry now that
it is production-wired. This moves the worker-dom thread from "mechanism proven on a synthetic tag" to "a REAL tag
run off-thread + governed, with its INP value measured against naive, not assumed."

> **THE load-bearing bet (reframed after the frame-critique — measure vs NAIVE, not vs an absolute budget).**
> 025-02 proved a **chunkable write-stream** stays INP-safe via frame-budgeting. But Prism emits its result as ONE
> `codeEl.innerHTML = <~148KB string>` (025-01: 12,718 → 148,558 chars) — a monolithic, **unchunkable** apply. And
> airlock's *governed* path is **heavier on the main thread than naive Prism**, not lighter: naive on-page Prism
> does exactly ONE main-thread parse (`el.innerHTML = itsOutput`); airlock's sanitized apply does
> **parse(148KB) → whole-tree walk over every `<span class="token">` (thousands, two attribute passes,
> `sanitize-html.js:159-174`) → reserialize(148KB, `:214`) → the real `innerHTML =` parse**. Off-thread
> tokenization removes the 12KB **input** cost but ADDS a round-trip over the 11.7×-larger 148KB **output**. So the
> real question is **not** "is airlock's apply under an absolute budget" but "**does governed off-thread Prism beat
> NAIVE on-page Prism**?" — three outcomes: **(a) win** (governed < naive), **(b) net regression** (governed ≥
> naive but under budget — the *currently-invisible* false-green), **(c) re-tank** (over budget). Only (a) is a
> Tier-0 win for `innerHTML`-heavy tags. **(b) or (c) is the honest Tier-0-viability boundary** — a real, valuable
> de-risk finding (the mirror may help only the chunkable-write minority, not the `innerHTML`-heavy majority),
> surfaced, not hidden.

**DoR (grounded 2026-09-02):**
- ✅ **025-02 DONE:** airlock's own bidirectional mirror + the frame-budgeted apply coordinator
  (`adapters/eds/dom-apply.js`) + the mutation-apply safety **allowlist** (`core/worker-dom/apply-policy.js`, for
  STRUCTURED ops — createElement/setAttribute/style/class) + the DOM-chamber worker. `innerHTML` is explicitly OUT
  of 025-02 (a raw-HTML string needs a sanitizer, not the structured allowlist).
- ✅ **The sanitizer already exists (grounded, `core/sanitize-html.js`, spec 018-01):** `sanitizeHtml(html, opts)`
  — INERT `DOMParser` parse, strips `on*` attrs + `javascript:`/`vbscript:`/`data:text/html` URLs + STRIPPED_TAGS
  (`script`/`iframe`/`object`/`embed`/`base`/`meta`/`link`), never throws (fails to `""`), vendor-neutral/import-free.
  Its own honest boundary: a hand-rolled denylist (mutation-XSS / parser-differential are out — a deployment with
  genuinely-untrusted content slots a stricter sanitizer via the `opts.sanitize`/`setContent` seam). 025-03 REUSES
  it — the sanitizer is NOT re-built.
- ✅ **Prism is a local devDep (grounded, `prismjs@^1.30.0`, `rig/worker-dom-prism-*`):** 025-01 ran it off-thread
  via `@ampproject/worker-dom` (real tokenization, one lib-completeness gap `Element.prototype.matches` stubbed).
  025-03 runs it against airlock's OWN mirror — the exact DOM surface unmodified Prism needs (beyond 025-02's
  subset: `innerHTML`, and whatever `Prism.highlightElement` reads — `className`/`textContent`/possibly `matches`)
  is grounded by RUNNING it; any gap is a finding (axis-classified: a lib-completeness stub vs a model limit).
- ✅ **The dom-chamber's `build.mjs` entry (026-05 generalized the assertion to N workers):** once 025-03 wires a
  real worker-dom tag adapter that constructs the dom-chamber via `createAirlock`'s selection seam, the dom-chamber
  is production-reachable → add `core/dom-chamber.worker.js` as a build entry (a one-line add; the N-worker
  assertion already covers it). This un-defers 026-05's grounded exclusion.
- ⚠️ **The governed-vs-naive INP bet is UNMEASURED, and NO naive-Prism main-thread baseline exists yet** — 025-01
  measured Prism's off-thread COMPUTE (its "8ms" used `@ampproject`'s OWN `innerHTML` setter, **no sanitizer** in
  the path — it under-counts 025-03's apply); 025-02's apply was a *light* chunkable stream. 025-03 must BUILD a
  naive-Prism main-thread baseline (on-page tokenize + a single `el.innerHTML =`, same page/CPU) and measure
  **governed vs naive** (AC4) — an absolute-budget check ALONE would ship a net-regression as a false green.
- ⚠️ **Expected mirror-completeness gap (frame-critique hint):** `core/worker-dom/mirror.js`'s MirrorElement has
  `classList`/`getAttribute` but no `className` **property**; `Prism.highlightElement` reads `element.className`
  for language detection — expect it as the next gap (a serviceable **synchronous read**, NOT a model limit; AC1's
  ground-by-running + stub discipline routes it). 025-01 found only the `matches` gap (lib-completeness) + zero
  layout-reads.

**Acceptance Criteria:**

1. **The mirror records `innerHTML`.** The worker-side `Element` gains an `innerHTML` setter that records
   `{ op: "setInnerHTML", id, html }` (structured-cloneable) — plus whatever else UNMODIFIED
   `Prism.highlightElement` needs beyond 025-02's subset, grounded by running Prism (a lib-completeness gap is a
   finding, axis-classified, one-line-stubbed if it's not a model limit).
2. **The UNMODIFIED Prism tag runs against the mirror.** Real `prismjs` (byte-unmodified) tokenizes + sets
   `innerHTML` against the injected mirror `document`, producing the mutation stream incl. the big `setInnerHTML`
   (real tokenization, ~148KB output per 025-01's fixture). No Prism code changes.
3. **[Security write-path] The `innerHTML` apply is SANITIZED — reusing `core/sanitize-html.js`.** The main-thread
   applier applies `setInnerHTML` via `el.innerHTML = sanitizeHtml(html)` — the sanitizer runs BEFORE the real
   write. Prism's benign `<span class="token …">` markup survives (spans/classes are not stripped); a hostile
   payload smuggled into the tokenized output (`<script>`, `onerror=`, a `javascript:` URL) is **provably stripped**
   (a test injects one → absent from the applied DOM). This completes 025-02's safety story for the `innerHTML`
   surface (structured ops → the allowlist; raw HTML → the sanitizer). Honest boundary: the sanitizer's own
   denylist bound (per its header) carries forward; the `opts.sanitize` seam is the stricter-sanitizer escape.
4. **[THE load-bearing INP bet] Governed off-thread Prism vs NAIVE on-page Prism — measured, three outcomes.**
   Measure the **main-thread apply cost over the apply window** (the 025-02 5b way — long-task / instrumentation,
   NOT the click-p75) for Prism's real ~148KB output, **against a grounded naive-Prism baseline** (same page/CPU:
   naive = on-page tokenize + a single `el.innerHTML = output`, ONE parse, no sanitizer). The cost model is
   **parse(148KB) + whole-tree walk(N spans, 2 passes) + reserialize(148KB) + parse(148KB)** for governed, vs ONE
   parse for naive — off-thread removes the 12KB-input tokenization but adds the 148KB-output round-trip. **Win
   condition: governed < naive.** Report the outcome explicitly: **(a) win** (governed < naive → a Tier-0 win for
   `innerHTML`-heavy tags), **(b) net regression** (governed ≥ naive yet under budget → the mirror is a main-thread
   LOSS for this tag despite off-thread tokenization — the sanitize round-trip ate the win), or **(c) re-tank**
   (over budget). **(b) and (c) are valid, documented Outcomes**, not hidden failures — the honest Tier-0-viability
   boundary for `innerHTML`-heavy tags (routed: chunked DOM-building / a lighter sanitize / accept-the-cost /
   not-a-Tier-0-fit), promoted to ADR-0014 + refinement-todo. **Sharpening (frame-critique):** raw main-thread ms
   is a *conservative* INP proxy (a `governed < naive` ms-win provably implies an INP win; the only error mode is a
   false-RED when the decoupled apply collides with no interaction). For a clean (b) verdict, ALSO report a direct
   governed-INP-vs-naive-INP under a **matched click cadence**, so "more main-thread ms" is distinguished from
   "worse actual INP" (they converge under the ~150ms-spacing piling 025-01 observed).
5. **The tokenization runs off-thread + the sanitized `innerHTML` LANDS (plumbing — NOT the INP verdict).** Prism's
   tokenization executes in the chamber (a compute-*location* fact — the worker does it, on airlock's own mirror),
   and the sanitized markup is **actually applied** to the real DOM (a `workCompleted`-style lands-assertion — the
   storm fired end-to-end, not a stalled no-op). The click-p75 interaction floor may be reported as a plumbing
   datum, but — per 025-02's round-2 reframe — the apply is **decoupled** from the click (it lands in a later
   task), so a low click-p75 is a **false-green for the apply** and is **NOT** the INP verdict. **No "off-thread
   win" is claimed here** — establishing whether governed off-thread actually beats naive is AC4's job.
6. **The dom-chamber is production-wired + shippable.** A real worker-dom tag adapter (a `bootWorkerDomTag`-style
   boot, or the Prism rig's production path) constructs the dom-chamber via `createAirlock`'s selection seam; add
   `core/dom-chamber.worker.js` as a `build.mjs` entry (026-05's N-worker assertion covers it — `npm run build`
   emits it + the reference resolves). Un-defers 026-05's grounded exclusion. **Independent of AC4's verdict**
   (frame-critique): the chamber's shippability is build-mechanics + hosts write-heavy tags generally; it does not
   hinge on AC4's Prism-specific win/regression outcome (a net-regression for Prism doesn't un-ship the chamber).
7. **The two 025-01 worker-backpressure threads addressed or grounded-deferred.** The 20000-element apply stall +
   the Prism throughput ceiling (025-01 §Findings) — investigate under airlock's own mirror; fix if they block
   Prism, else document as grounded worker-backpressure follow-ups (NOT INP).
8. **`@ampproject/worker-dom` stays devDep-only** (still — airlock's own mirror is the runtime; the enumeration
   from 025-02 AC8 holds). **No live identifiers** — Prism is a local devDep; a synthetic code sample.

**DoD:**
- [x] The mirror `innerHTML` + `className` + the sanitized apply (reusing `sanitize-html.js`) + the Prism rig +
      the 3-way (dom) selection seam + the dom-chamber build entry, **TDD**.
- [x] AC4's **governed-vs-naive** INP measurement — `npm run rig:airlock-mirror-prism` (N=3, orchestrator-re-run):
      naive apply-window **p75=11.5ms**, governed **p75=24.1ms** (median 11 vs 23) → **NET-REGRESSION** (governed
      ~2× naive; the sanitize round-trip ate the off-thread win; both under the 160ms reference). Reported as a
      documented Outcome (the rig's exit does NOT gate on the verdict). AC5 tokenization-off-thread + lands = PASS
      (`highlightedLen 148,918 > rawLen 12,718`; `mutationsApplied` > 0 every run); click-p75 = 0ms (the decoupled
      false-green empirically confirmed — NOT the INP verdict).
- [x] The sanitizer proof (AC3): Prism's benign `<span class="token">` applies; injected `<script>`/`onerror=`/
      `javascript:` stripped, `xssFired=false` every run.
- [x] `npm run build` green (dom-chamber = 4th sibling, N-worker assertion passes); `npm run lint` clean; full
      non-oracle suite 1045 pass / 84 files (after the canary reconciliation); no live identifiers.
- [x] **Frame-critique PASS recorded** — `reviews/slice-03-frame-critique.md` (PASS after the reframe from
      absolute-budget to governed-vs-naive, three outcomes — the net-regression false-green named).
- [x] Compliance + craft reviews recorded (both PASS; craft confirmed the rig is FAIR — residual asymmetries are
      sub-ms + partially offsetting, cannot flip the verdict); close-out `### Deviation log` + `### Reconciliation
      sweep` below; the AC4 Outcome promoted to `refinement-todo` (ADR-0014's central bet, measured — adverse for
      `innerHTML`-heavy tags; the immutable ADR is not amended, the finding is recorded); ambient globals + Lever-3
      + Tier 1 remain named for 025-04+.

**Anti-horizontal-phasing check:** 025-03 is **vertical** — a REAL, unmodified martech-shaped tag (Prism) runs
off-thread through airlock's own mirror, its output **sanitized + applied** to the real DOM, and shippable on a
real page (the dom-chamber build entry). It delivers the worker-dom thread's first REAL-tag end-to-end proof (025-02
was synthetic) + completes the `innerHTML` security write-path — not internal refactor. The load-bearing INP bet is
measured on real work, honestly (a re-tank is a documented boundary). Builds directly on 025-02's proven mechanism.

### Deviation log

- **`className` is backed by `classList`'s own Set, DECOUPLED from the `class` attribute store**
  (`core/worker-dom/mirror.js`) — required by Prism's `setLanguage()` read/regex-strip/`classList.add` pattern; an
  attribute-backed `className` would silently lose the language class after the first highlight pass. A real
  DOM-semantics divergence scoped to Prism's grounded need; pinned by a run-Prism-twice test.
- **`worker` exposed on the `createAirlock` handle ONLY for `connector:"dom"`** (`core/airlock.js`) — a dom-tag
  adapter/rig needs the chamber's event-forward/mutation-flush protocol (architecturally distinct from GA4/pixel
  egress); GA4/pixel handles are byte-unchanged (regression-pinned); egress stays confined by
  `confine-dom-chamber.js`. **Doc gap (craft nit):** the seam doc notes the `onmessage` takeover but not that
  `onerror`-diagnostic ownership passes to the adapter once it reassigns `worker.onerror`.
- **The bare `Element` global stub lives in the rig glue PREFIX, not `mirror.js`** — Prism's plugin's IE-compat
  `if (!Element.prototype.matches)` guard needs a bare `Element`; kept out of the mirror so it stays free of new
  ambient globals (ADR-0001). **`getElementsByTagName()` is inert-`[]`** (Prism's `currentScript` IE11 fallback,
  only reachable in a real Worker). Both axis-classified lib-completeness, not model limits.
- **AC6 took the "rig's production path" branch** (not a `bootWorkerDomTag` adapter) — the spec offered it as the
  alternative; a bootWorkerDomTag API would be a speculative, untested-need surface.
- **Canary reconciliation** — 025-03's legitimate `core/` change (the 3-way selection seam + the mirror) broke
  026-02/03's `git diff -- core/` canaries, which are **green-by-construction post-commit** and spuriously fail on
  any later `core/` work (the fragility BOTH 026-02's and 026-03's own reviews flagged). Removed the 2 brittle
  git-diff canaries (+ the now-unused `execSync` imports) from `test/pixel-config-contract.test.js` +
  `test/pixel-vendors.test.js`; **kept** the durable no-vendor-string grep (content-inspecting). No real coverage
  lost — the git-diff checks asserted an authoring-time scope fact, not a runtime invariant. Full suite 1045 pass.
- **Rig fairness (both reviews confirmed FAIR) — two disclosed residuals, neither can flip the verdict:**
  (a) the governed apply-window includes a sub-ms `SET_TEXT` reset + 3 status `setAttribute` ops that naive's
  window excludes — biasing governed slightly WORSE (<1ms vs the 12.6ms gap); (b) `SAMPLE_LINES` is hand-duplicated
  across the naive harness + governed author with no sync-assertion (current copies verified identical; a
  byte-identity assertion is a follow-up when the rig is next touched). Also: the verdict keys off median while the
  headline cites p75 — they agree (governed ~2× at both), so net-regression is robust across both statistics; a
  `GAP≈150ms` piling run to watch click-p75 convergence is a follow-up.

### Reconciliation sweep

- **Question answered + Outcome (the load-bearing de-risk finding):** the governed off-thread mirror is a **NET INP
  REGRESSION for the real `innerHTML`-heavy tag** — governed apply-window **p75 = 24.1ms vs naive 11.5ms (~2×)**,
  orchestrator-re-run, both reviews confirming the rig is FAIR. The sanitize round-trip (parse + whole-tree walk +
  reserialize over the **148KB output**) exceeds the off-thread tokenization savings (the **12KB input**). **This
  is the honest Tier-0-viability boundary:** airlock's mirror contains INP for the **chunkable-write** subset
  (025-02's synthetic tag) but is a main-thread **LOSS** for `innerHTML`-heavy tags — which are **most** real
  DOM-heavy tags. The de-risk the maintainer green-lit is answered, and the answer is **adverse** — surfaced, not
  hidden (per ADR-0014's honest-coverage-bound discipline, which already warned Tier 0 may cover a MINORITY).
- **AC7 backpressure — grounded-deferral:** neither 025-01 thread reproduces under airlock's own mirror,
  **structurally**: Prism emits ONE unchunkable `setInnerHTML` (not a 20000-structured-op storm), and airlock's
  per-cycle drain is not `@ampproject`'s throughput channel. Verified by RUNNING (20k-el → 100000/100000, no stall;
  Prism 15/15 @ 20ms, no drops). Not a threat under airlock's mirror; recorded as grounded, not a fix owed.
- **Promoted, no orphans:** the AC4 net-regression Outcome → **`refinement-todo`** (ADR-0014's central apply-INP
  bet, now measured on a REAL `innerHTML`-heavy tag with an **adverse** result; the immutable ADR is
  recorded-against, not amended). The dom-chamber `build.mjs` entry un-defers 026-05's grounded exclusion. The
  026-02/03 canary fragility is resolved. Ambient globals + Lever-3 + Tier 1 → **025-04+**.
- **Downstream named:** 025-04+ (ambient-global proxies; Lever-3 budget; Tier 1 SAB — the last of which could serve
  sync-read tags but re-incurs the AD-4 embed breakage); the **strategic implication** (the mirror's realized value
  is narrow — chunkable-write only; `innerHTML`-heavy tags are better left on the main thread or need a lighter
  sanitize / chunked DOM-building) surfaced to the maintainer for the thread's direction. No dependency dangling.
- **No live identifiers; `@ampproject/worker-dom` stays devDep-only; no new runtime dependency.**
