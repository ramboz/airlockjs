---
status: DONE
dependencies: []
last_verified: 2026-09-02
frame_review: true
---

<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about
     runnable surfaces by probe first (run it / read source) or a citation. -->

## Slice 025-02 — the mirror core: synthetic tag off-thread through airlock's own mirror, INP-safe

> **Reframed 2026-09-02 after the frame-critique (FAIL → reframe).** The first draft scoped the mirror as a
> *one-directional* worker→main mutation flush. But the 025-01 proof fixture is **event-driven**: the synthetic
> tag does its entire measured storm only inside a worker-side `document.addEventListener('click', …)` callback
> (`rig/worker-dom-nasty-tag-author.js:71`), fired by clicks on a **decoupled main-thread button** (`#target`,
> harness:20; `rig/worker-dom-nasty-tag.mjs:83-87`). `@ampproject/worker-dom` forwarded those clicks **main→worker
> for free** — which is *why* 025-01 got an 8ms number at all. So the mirror is **bidirectional**: a **main→worker
> event-forwarding** channel + a **worker→main mutation-flush** channel. Omitting the former made AC5 measurable
> as a **false green** (`workCompleted = 0`, flat INP — exactly 025-01's stall signature). This reframe scopes the
> event channel explicitly and requires AC5 to assert `workCompleted`. (Also: safety is now an **allowlist**, not
> a denylist — see AC6/AC7.)
>
> **Round-2 reframe (frame-critique #2).** The async round-trip AC3 makes explicit (click → trivial main-thread
> task T0 = serialize+post → ~200ms off-thread compute → mutations posted back → apply in a LATER task T1)
> structurally **decouples the apply from the click's own task**. So the 025-01-style within-storm-p75-of-clicks
> measures "the heavy **compute** moved off-thread" (real, worth proving) — **NOT** "the frame-budgeted **apply**
> is INP-safe under a heavy mutation burst" (ADR-0014:101's actual central bet). And this fixture's apply is
> *light* (~400 `style.transform` writes), so it never stresses the apply anyway. So **AC5 is split**: (5a) the
> click-p75 is honestly the **compute-off-thread plumbing** metric; (5b) a **heavy-apply** stream through the
> coordinator, measured **over the apply window** (long-task/chunk-boundary, not click-p75), is the falsifiable
> apply-INP proof — so AC4's frame-budgeting is falsifiable and the re-tank kill signal can actually fire. The
> genuinely-heavy REAL apply (Prism's 148KB `innerHTML`) is 025-03.

**Goal:** Build airlock's **own** minimal **bidirectional** worker-side DOM mirror — a **main→worker
event-forwarding** channel + a **worker→main mutation-serialize** channel + a **frame-budgeted** main-thread apply
coordinator (**reusing `core/scheduler.js`**, spec 023) + a **mutation-apply safety allowlist** — replacing the
025-01 probe's `@ampproject/worker-dom`. Prove it via ADR-0014's named **deferred INP integration probe**: the
025-01 synthetic DOM-mutation-heavy tag runs **off-thread through airlock's OWN mirror** with the full storm
actually firing (`workCompleted` asserted) — proving **two distinct things, measured distinctly**: (5a) the
round-trip moves the heavy compute off-thread (the click-p75 interaction floor stays low, airlock's own code);
and (5b) the **frame-budgeted apply is INP-safe under a *heavy* mutation-apply burst** (ADR-0014's central bet),
measured over the apply window — not conflated with the click-p75. Tier-0's mechanism, airlock-owned — the first
honest piece of the Lever-2 compat layer
([ADR-0014](../../decisions/adr-0014-worker-dom-compat-minimal-mirror.md)).

> **Scope is the mirror CORE, honestly bounded.** `innerHTML` + a Trusted-Types/sanitizer write path (a REAL tag
> like Prism needs it), ambient-global proxies (`screen`/`sendBeacon`/`cookie` — 025-01 AC3's scope input), and
> the Lever-3 budget/circuit-breaker are **OUT → 025-03+**. 025-02 proves the mechanism on the synthetic
> write-heavy tag (the purest Tier-0 target shape: unmodified, write/compute-heavy, no sync-read, no `innerHTML`).

**DoR (grounded 2026-09-02):**
- ✅ **ADR-0014 Option C** (Accepted): a worker-side mirror + mutation-serialize channel + a frame-budgeted
  coordinator; async / **no SAB** (AD-4-preserving); **Tier-0 only**. The build's first AC is ADR-0014's own
  "deferred INP integration probe" — the apply-INP-safety is the central bet, **UNMEASURED on airlock's own code**.
- ✅ **The fixture is event-driven (frame-critique-verified):** `rig/worker-dom-nasty-tag-author.js:71-77` — the
  per-click storm fires only inside `document.addEventListener('click', …)`; boot-time div creation (author:27)
  is OUTSIDE any interaction and produces no Event-Timing entries. The click originates on a main-thread
  `<button id="target">` decoupled from the mirror host (harness:16-20) and is fired by the rig on the main
  thread (rig:83-87). So the mirror **must** forward that click main→worker, or nothing measurable fires.
- ✅ **025-01 GO (grounded):** `@ampproject/worker-dom` apply **p75 = 8ms** (band [8,8], **6000/6000**) vs naive
  200ms. airlock's own mirror must reproduce this **with the storm actually firing**. The **minimal subset the
  synthetic tag needs** (read from `rig/worker-dom-nasty-tag-author.js`): `createElement`, `createTextNode` /
  `textContent`, `appendChild` / `append`, `setAttribute`, the `.id =` **property** setter (author:39, read back
  main-side via `getElementById`, harness:78), `style` writes, `classList`, and `addEventListener` (the event
  sink). A sync-layout-read (`offsetHeight`) is an **inert no-op off-thread** (the Tier-0 boundary, 025-01).
- ✅ **Reusable — do NOT reinvent:** `core/scheduler.js` `createScheduler().chunk(items, perItem, { budgetMs })`
  (023, verified `core/scheduler.js:132-144`: `chunk` is `async`; the first `do/while` batch runs synchronously
  in the caller's task up to the first `await yieldToMain()`, budgeted identically to later batches — the
  first-synchronous-chunk-within-budget property AC4 leans on) is the apply coordinator's engine;
  `adapters/eds/scheduled-dom.js` `runScheduled` is the frame-budgeted "apply a list" wrapper.
- ✅ **What 023 already proved (so 025-02 need not re-prove it):** frame-budgeted (`chunk` + `yield`) main-thread
  work is INP-safe under a heavy burst — 023-01's nasty-tag went naive-200ms → scheduled-16ms
  (`rig/nasty-tag.mjs`, 023-01 §Findings). 025-02's job for the apply-INP bet is therefore **narrow**: prove the
  apply is *wired through* that primitive (AC4) AND that a **heavy apply stream** measured **over the apply
  window** stays bounded (AC5b), so AC4 is falsifiable and the re-tank signal can fire — **not** to re-establish
  the scheduler. Crucially, the apply runs in a task **decoupled** from the click (AC3's round-trip), so it must
  be measured over the apply window (long-task / chunk-boundary), **never** via the click-p75 (which is why the
  first draft's AC5 was a confound).
- ✅ **The chamber pattern:** `core/chamber.worker.js` + `core/confine-ga4-chamber.js` (confined first-import, no
  ambient globals per ADR-0001) — the DOM-chamber worker mirrors it but **injects the mirror `document`**.
- ✅ **The INP rig to mirror:** `rig/worker-dom-nasty-tag.mjs` + `-harness.html` (025-01's raw Event-Timing
  within-storm p75 harness, verbatim from 023) — swap `@ampproject/worker-dom` for airlock's own mirror.
- ⚠️ **The "minimal" subset is ADR-0014's own OPEN QUESTION** ("currently unbounded"). 025-02 pins it to what the
  synthetic tag needs + documents the boundary; whether the subset **generalizes** to a real tag (`innerHTML`) is
  **025-03's (Prism) job**, NOT claimed here — 025-02 is honestly the easy-shape proof of the plumbing.

**Acceptance Criteria:**

1. **Worker-side DOM mirror** (e.g. `core/worker-dom/mirror.js`): minimal `Document`/`Element`/`Text`/`Node`
   implementing **only** the subset the synthetic tag exercises — `createElement`, `createTextNode`/`textContent`,
   `appendChild`/`append`, `setAttribute`, the `.id =` **property** setter, `style` writes, `classList`, and
   `addEventListener`. Each node carries a **stable id**; every mutating op **records a mutation** into a queue
   (write-record, not a full re-queryable tree). A sync-layout-read (`offsetHeight` / `getBoundingClientRect`)
   returns an **inert default** (0 / empty) — the Tier-0 boundary (matches 025-01), **not** a throw.
2. **The UNMODIFIED synthetic tag runs against the mirror.** The 025-01 nasty-tag author script executes
   **byte-unmodified** against the injected mirror `document` — including **registering its click listener via the
   mirror's `addEventListener`** — with no per-tag code changes.
3. **Bidirectional channel (both halves — the frame-critique fix).**
   **(a) main→worker event forwarding:** the main-thread side captures a click on the decoupled `#target` button,
   serializes it (`{ type: "event", targetId, eventType }`), and posts it to the DOM-chamber worker, which
   **dispatches it to the tag's mirror-registered listener** — firing the storm. **(b) worker→main mutation
   flush:** the recorded ops serialize to a compact, **structured-cloneable** array (`{ op, id, … }` — no
   functions / DOM refs → no `DataCloneError`, the 022-04 lesson) and post as `{ type: "mutations", ops }` in
   batches. A `structuredClone` round-trip test guards the boundary; an event-forward test proves a posted click
   reaches the worker-side listener.
4. **Main-thread apply coordinator** (e.g. `adapters/eds/dom-apply.js`): receives op batches, applies them to the
   **real DOM** via an id→node map, **frame-budgeted through `core/scheduler.js`'s `chunk`** (first synchronous
   chunk within budget; ≥1 op/chunk progress). **Reuses** 023's primitive — a test asserts the coordinator drives
   `scheduler.chunk`, not a hand-rolled loop.
5. **[ADR-0014's deferred INP integration probe — THE load-bearing AC, split so it measures what it certifies.]**
   **(5a) Compute-off-thread (plumbing metric).** A rig (`rig/airlock-mirror-nasty-tag.mjs` + `-harness.html`,
   mirroring `rig/worker-dom-nasty-tag-*` but driving **airlock's own mirror**, NOT `@ampproject/worker-dom`) runs
   the synthetic storm end-to-end and measures the within-storm click **p75** the 023 way (raw Event-Timing). This
   proves the bidirectional round-trip works and the heavy **compute** is off-thread (the interaction floor stays
   low). **MUST assert `workCompleted == ELEMENTS × CLICKS`** — a `workCompleted = 0` stall (025-01's signature)
   **must fail**, never pass as a flat-INP green. **Honestly labeled:** this p75 does **not** attribute the
   apply's own cost (the apply lands in a task decoupled from the click), so it is the *compute-off-thread*
   metric, not the apply-INP proof.
   **(5b) The frame-budgeted apply is INP-safe under a HEAVY apply burst — ADR-0014's actual central bet, made
   falsifiable.** Drive a **heavy** mutation-apply stream (≥ a few thousand ops — node/attribute churn that is
   genuinely heavy *on the main thread*, unlike 5a's ~400 light `style` writes) through the apply coordinator and
   measure **over the apply window** (a Long Tasks `PerformanceObserver`, or chunk-boundary instrumentation) —
   **NOT** the click-p75. Assert: the frame-budgeted apply produces **no main-thread task exceeding the budget**
   (chunked + yielding), whereas the **same stream applied naively (un-chunked) produces one long task ≈ the total
   apply cost** (the contrast). This makes AC4's frame-budgeting **falsifiable** and the **re-tank kill signal
   fireable** — a broken/unbudgeted apply moves *this* number, where it could never move 5a's. (The
   genuinely-heavy REAL apply — Prism's 148KB `innerHTML` — is 025-03; 5b proves the *mechanism* on airlock's own
   coordinator now, leaning on 023's already-proven `chunk`+`yield`.)
6. **Mutation-apply safety ALLOWLIST** (e.g. `core/worker-dom/apply-policy.js`): the applier applies **only**
   an explicit **allowlist of safe element tag names** (the layout/text elements the subset needs — `div`/`span`/
   `p`/`ul`/`li`/… — **never** `script`/`iframe`/`object`/`embed`/`style`/`link`/`base`/`meta`/SVG) and **safe
   attribute names + value-schemes** (`class`/`id`/`data-*`/`style`; URL attributes only `http(s)`/relative,
   **never** `on*` handlers, `javascript:`/`data:` URLs, `formaction`, `xlink:href`). This is an **allowlist over
   the write surface**, not a denylist of known-bad (a denylist of dangerous HTML is inherently incomplete —
   `style`/`link`/SVG/`formaction`/CSS `url()` all escape one). **`style` values are also value-guarded** (a
   name-level allowlist of `style` isn't enough — frame-critique #2b): reject a `style` value containing `url(`,
   `expression(`, or `/*` (a CSS-exfil/injection vector — `style="background:url(https://evil/track.gif)"` passes
   any name-level check); **full value-level style sanitization is deferred to 025-03's sanitizer path**, this is
   the minimal guard closing the immediate vector. The chamber isolates the **tag**, but the mutation channel is a
   **write surface to the real main-thread DOM** — a hostile op stream must not inject script/handlers/foreign
   content/CSS-exfil. Proven: a hostile op stream (`createElement("script")`, `setAttribute("onclick", …)`,
   `createElement("style")`, `style="…url(…)…"`) is **refused + diagnosed** (009-02 sink), while the benign
   synthetic-tag stream (`div`/`span`, `id`/`data-*`/`style.transform`) applies fully.
7. **Minimal subset + Tier-0 boundary documented** — the exact implemented DOM surface (the API allowlist) + the
   safety allowlist (AC6), and what is OUT: `innerHTML` (→ 025-03 + a sanitizer write path), sync-layout-reads
   (the Tier-0 gap — inert), ambient globals (→ 025-04). Restate ADR-0014 §5's honest coverage bound (**Tier 0
   alone contains a MINORITY of real costly tags** — the worst/most-common are sync-read). **Coverage caveat
   (frame-critique):** AC6's `style`-value guard is a **minimal token check** (`url(`/`expression(`/`/*`) and is
   **escape-bypassable** (e.g. CSS `\75rl(` decodes to `url(` at parse time) — it closes the immediate vector,
   not the class; **airtight value-level style sanitization is a named 025-03 deliverable** (its sanitizer path).
   The element/attribute-*name* layer IS a true allowlist; only the style-*value* completeness is deferred.
8. **`@ampproject/worker-dom` stays a devDependency (probe-only), NOT a runtime dependency.** airlock's own
   mirror is the runtime; **no** `core/` / `adapters/` / `connectors/` module imports it — enumerable: a grep of
   the runtime tree for `@ampproject/worker-dom` returns **empty** (imports are syntactically bounded here — the
   set is closed). The whole point of Option C over Option A.

**DoD:**
- [x] The bidirectional mirror (`core/worker-dom/mirror.js` + `protocol.js`) + apply coordinator
      (`adapters/eds/dom-apply.js`) + the DOM-chamber worker (`core/dom-chamber.worker.js` + `dom-chamber-host.js`
      + `confine-dom-chamber.js`) + the safety allowlist (`core/worker-dom/apply-policy.js`) + the rig, **TDD**.
- [x] AC5a **compute-off-thread green** — `npm run rig:airlock-mirror` (N=3, 025-01's params): **click-p75 = 8ms
      (band [8,8])**, **`workCompleted = 6000/6000/6000` == `clicksFired × ELEMENTS`** every run (the driver
      exits non-zero on mismatch — a stall fails). Independently re-run by the orchestrator. AC5b **apply-INP
      green** — `test/dom-apply-coordinator.test.js`: a 6000-op heavy stream is frame-budgeted (>1 yield, no batch
      over the ~5ms budget) vs a naive one-blast = 2000ms single run (the falsifiable contrast).
- [x] The mutation-apply **safety allowlist** proven (hostile `script`/`iframe`/`on*`/`style-url(`/invalid-token
      ops refused + diagnosed; benign stream applies) — plus review-hardened: a real-DOM throw is caught +
      diagnosed, never crashes the batch.
- [x] `npm run lint` clean; **targeted** vitest green (945 across 78 files, no regressions); no live identifiers
      (synthetic tag only; assertions on a dispatch spy / the built ops).
- [x] **Frame-critique RE-PASS recorded** (`frame_review: true`) — `reviews/slice-02-frame-critique.md` (PASS on
      the 3rd revision — the bidirectional channel + the AC5 5a/5b measurement split).
- [x] Compliance + craft reviews recorded (both NEEDS-CHANGES → PASS after the throw-safety remediation);
      close-out `### Deviation log` + `### Reconciliation sweep` below; ADR-0014 / refinement-todo updated (the
      central INP bet now measured on airlock's own mirror); the minimal subset + the two 025-01
      worker-backpressure threads promoted toward 025-03.

**Anti-horizontal-phasing check:** 025-02 delivers airlock's **own** working, safe, INP-proven **bidirectional**
mirror — the foundational Lever-2 mechanism ADR-0014 gated the whole spec on. It is a **mechanism-proof** slice in
the exact lineage of **023** (a synthetic-fixture INP scoreboard, shipped DONE) and **025-01** (the spike): the
synthetic write-heavy tag is the proxy for "unmodified write-heavy martech," and running it off-thread through
airlock's OWN code — main→worker event forward → worker mirror storm → worker→main mutation channel →
frame-budgeted main-thread apply → **measured INP with the storm asserted to have fired** — end-to-end, INP-safe
**and** safe against DOM injection, is the real, vertical deliverable. A REAL tag (Prism, `innerHTML`) is the very
next slice (025-03).

### Deviation log

- **Extra module `core/dom-chamber-host.js`** (beyond the spec's named file list) — the testable host core
  (`boot`/`dispatchEvent`) split out from the `self`-guarded thin `dom-chamber.worker.js` glue, mirroring the
  established `core/connector-host.js` / `core/chamber.worker.js` testability convention (chamber tests never
  import a `*.worker.js` directly). Sound.
- **AC1's implemented surface is broader than what `rig/worker-dom-nasty-tag-author.js` actually calls** — the
  fixture uses only `createElement`/`appendChild`/`.id=`/`setAttribute`/`style`/`offsetHeight`/`addEventListener`;
  `createTextNode`/`textContent`/`append`/`classList` are implemented too (AC1 named the broader set, each with a
  unit test). This is over-*coverage*, not over-implementation-vs-spec — but the honest "minimal subset the
  synthetic tag needs" is *narrower* than AC1's list; the extra primitives are the clearly-safe layout/text
  superset, not scope creep. (Confirmed by both review passes.)
- **AC5b realized as a deterministic fake-clock unit test** (`test/dom-apply-coordinator.test.js`, chunk-boundary
  `yieldToMain`-spy instrumentation), not a browser Long-Tasks rig — the AC explicitly permits "…or chunk-boundary
  instrumentation." It measures the apply's own budget-boundedness (the frame-critique's requirement) rather than
  a coincidental interaction timing; the only browser rig is AC5a's (the light ~400-write compute-off-thread path).
- **`void el.offsetHeight` is an inert no-op off-thread** (returns 0, records nothing) — the documented Tier-0
  sync-read boundary (025-01), commented inline in the ported fixture.
- **Review remediation (both passes' blocker — throw-safety).** The reviews found the apply path could throw
  synchronously under AC6's hostile-op threat model (`classList.add("a b")`→InvalidCharacterError;
  `setAttribute("data-x y",…)`; a cyclic `appendChild`→HierarchyRequestError) and reject the whole batch,
  contradicting the module's "never crashes the batch" contract. Fixed: (a) `adapters/eds/dom-apply.js` `applyOne`
  wraps the real-DOM apply in try/catch → `diagnose({kind:"dom-apply-threw"})` + refuse, batch continues; (b)
  `core/worker-dom/apply-policy.js` token-validation (`isValidNameToken`, an explicit `/[^A-Za-z0-9_-]/` allowlist
  — the prior regex carried `\x00-\x1f` control chars, `no-control-regex`) wired into `isAllowedAttributeName` +
  the class-op case so those ops are cleanly REFUSED pre-apply (defense-in-depth); (c) a coverage test with a
  throwing fake proves the batch survives. Also: the misleading "by default" AC4 test title reworded; the
  unreachable `default:` branch in `applyAllowed` kept as harmless defensive code (both passes flagged it a nit).

### Reconciliation sweep

- **Question answered + Outcome set:** airlock's **own** bidirectional worker-dom mirror works end-to-end
  (main→worker event forward → off-thread compute → worker→main mutation flush → frame-budgeted main-thread apply),
  and ADR-0014's **central apply-INP bet — previously UNMEASURED on airlock's own code — is now measured** (AC5a
  click-p75 = 8ms reproducing 025-01's `@ampproject/worker-dom` band on airlock's OWN mirror, orchestrator-re-run;
  AC5b the falsifiable heavy-apply budget-boundedness proof). The mutation-apply **safety allowlist** gates the
  real-DOM write surface (hostile ops refused + never crash the batch). `@ampproject/worker-dom` stays
  **devDep-only** (enumerably not imported by any runtime module — AC8).
- **Promoted, no orphans:** **ADR-0014** (its central bet, flagged UNMEASURED at authoring, is now measured on
  airlock's own mirror; the Tier-0 mirror is built — Option C realized) + **refinement-todo**. Toward **025-03**:
  the pinned minimal subset; a **full value-level style sanitizer that covers LAYOUT abuse (position:fixed
  full-screen overlay / clickjacking), not just URL schemes** (craft reconciliation note — 025-02's style guard is
  minimal/escape-bypassable, AC7's disclosed bound); the **DOM-clobbering via `id`** note (spec-required for the
  fixture's `getElementById` readback, accepted here, hardened there); `innerHTML` + its sanitizer write path; the
  two 025-01 **worker-backpressure** threads (20k-el stall, throughput ceiling). Ambient globals → **025-04**.
- **Downstream named:** 025-03 (Prism/`innerHTML` + the full sanitizer + the above hardening); 025-04 (ambient
  globals); the Lever-3 budget/circuit-breaker; and the DOM-chamber's **`build.mjs` bundle entry** (the same
  live-rollout gap the pixel worker has — folds into the shared `build.mjs` step). No dependency left dangling.
- **No live identifiers, no new runtime dependency** — synthetic tag only; the mirror is airlock's own code.
