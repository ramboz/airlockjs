---
status: DONE
dependencies: [018-01]
last_verified: 2026-08-30
frame_review: false
---

<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about
     runnable surfaces by probe first (run it / read source) or a citation. -->

## Slice 018-02 — reserveSpace hardening (overflow-clip + shared accessor + contract loudness)

**Goal:** Land the three tracked `reserveSpace`/decisions hardening nits from the 012-03 review so the
DOM-injection capability ships production-clean: **(g)** an **overflow-clip** so an over-tall fill clips
instead of reflowing (making "layout-stable" true *by construction*, not conditional on host sizing
discipline); **(i)** a single **shared proposition/`content` accessor** replacing the two re-narrowing sites;
**(f)** `decisions.fetch` made **loud-not-built** + `DomHandle`/`decisions` **pinned** in
`contract-stability.test.js`. None is load-bearing security (that is 018-01); these are craft/robustness on
the same surface.

**DoR:**
- ✅ [018-01] DONE — the sanitizer is in place; this slice does not touch `setContent`/sanitization.
- ✅ (g) `reserveSpace` reserves `minHeight` but adds no overflow control (dom.js:117-124); the honest
  boundary "over-tall fill reflows" is documented at dom.js:117-122. **Grounded** (read).
- ✅ (i) Two sites re-narrow a proposition/`Decision.content`: `connectors/alloy/decisions.js`
  (`htmlOfDecision` dom.js-adjacent unwrap + `extractDecisions`) and `adapters/eds/decisions-exposure.js`
  (`propositionOf`). Rule-of-three reached. **Grounded** (read both).
- ✅ (f) `decisions.fetch` is declared in `contracts/capability.d.ts` (decisions.fetch, line ~119) and, in
  the granted shape, is disambiguated only by docstring — unlike `insertAfterInteraction`, which rejects
  loudly (dom.js:163-166). `contract-stability.test.js` exists (pins other contract shapes). **Grounded**
  (read contract + dom.js; confirm the granted `decisions` object's actual home at implementation).

**Acceptance Criteria:**

1. **(g) Overflow-clip: an over-tall fill clips, not reflows.** The reserved box carries an overflow control
   (e.g. `overflow: clip`/`hidden` alongside the `minHeight` reserve, or a `max-height` = the reserve) so a
   decision taller than `minHeight` **cannot grow the box** and shift surrounding content. The choice is a
   **CWV-safety default** (no layout shift by construction), applied at reserve-time; it is **opt-out**able
   if a spec needs a growable box (an explicit flag), so a legitimate taller-content case is not silently
   truncated without the host asking for growth. Observable: a fill of content taller than `minHeight` leaves
   the surrounding geometry unchanged (the box clips); the honest-boundary comment at dom.js:117-122 is
   updated to reflect that clip, not host-discipline, now enforces it.
2. **(i) One shared proposition/`content` accessor.** A single exported accessor (home settled at
   implementation — e.g. `connectors/alloy/decisions.js` `propositionOf`, or a small shared module) unwraps a
   `Decision`/bare proposition to its proposition object, and **both** `connectors/alloy/decisions.js` and
   `adapters/eds/decisions-exposure.js` use it — no third private copy. Behaviour is **byte-identical** to
   today (a pure refactor; the existing `alloy-decisions`/`decisions-exposure` tests stay green unchanged).
   Observable: `git grep` shows one accessor definition; both consumers import it; all decisions tests green.
3. **(f) `decisions.fetch` is loud-not-built + pinned.** The declared-not-built `decisions.fetch` pull peer
   is made **loud** — a call rejects/throws with a "declared-not-built" message (mirroring
   `insertAfterInteraction`, dom.js:163-166), not merely a docstring caveat — wherever the granted
   `decisions` capability is actually constructed. `contract-stability.test.js` gains pins for the
   `DomHandle` shape (incl. the optional `fill`) and the `decisions` shape (`fetch` present-but-not-built,
   `deliver` built), so a silent contract drift is caught. Observable: calling `decisions.fetch([...])` fails
   loudly; the contract-stability test asserts both shapes.
4. **No behavioural regression.** 018-01's sanitizer, the reserve/prehide/fill/release lifecycle, the
   exposure mapping, and the html extraction are unchanged (i is a pure refactor; g adds an overflow style; f
   makes an already-unbuilt method loud). The targeted decisions/dom/contract tests stay green.

**DoD:**
- [x] ACs 1–4 pass. Tests: `eds-dom-reserve` gains an overflow-clip assertion (an over-tall fill's box does
      not exceed the clip / surrounding rect unchanged — via the element shim or the browser rig);
      `alloy-decisions` + `decisions-exposure` stay green through the shared-accessor refactor;
      `contract-stability` gains the `DomHandle` + `decisions` pins + a `decisions.fetch` loud-not-built
      assertion.
- [x] **No regression** — targeted sweep: `eds-dom-reserve`, `alloy-decisions`, `alloy-decisions-stub`,
      `decisions-exposure`, `contract-stability`, `sanitize-html`. _(Named files only — full suite hangs.)_
- [x] Reviews: compliance + craft (+ reconciliation) recorded pass (independent Opus review of the Sonnet
      diffs). **arch not gate-required** here (`arch_review: false` — a craft slice; its small arch surface,
      the adapter→connector `contentOf` import direction, was folded into the craft brief and confirmed
      sound). **Both compliance + craft returned needs-changes on the SAME blocker** (the `release()`
      asymmetry, below) — fixed + independently re-verified before pass.
- [x] Deviation log + reconciliation sweep (below); refinement-todo items **f, g, i** marked RESOLVED (and
      **h**/**j** re-affirmed deferred with their triggers); mvp3.md `reserveSpace` Include row updated.
- [x] **No live identifiers committed.**

**Anti-horizontal-phasing check:** after this slice, an over-tall personalization fill no longer reflows the
page (a user-visible CWV change), a connector author sees a loud `decisions.fetch` + pinned contract shapes
(a real API-surface change), and the proposition accessor has one home. All three touch the user-/author-
facing edges of the DOM-injection capability, not internal plumbing alone.

### Deviation log

- **(g) BLOCKER fixed — `release()` now clears the clip cap, not just `minHeight` (both review passes
  flagged).** The clip default added `style.maxHeight` + `style.overflow = "clip"` at reserve-time, but
  `release()` cleared only `minHeight` — so an *un-reserved* box was left permanently height-capped +
  clipping later natural content taller than the old reserve (an asymmetry this slice introduced, violating
  `release()`'s "Undo the reservation" doc + AC4's "release lifecycle unchanged"; `release()` was previously
  untested). Fixed: `release()` blanks all three (`minHeight`/`maxHeight`/`overflow`) unconditionally
  (blanking a property grow-mode never set is a harmless no-op), and a new `release()` test
  (`test/eds-dom-reserve.test.js`) asserts the un-reserved box carries none of them.
- **(g) overflow-clip: `max-height` is the load-bearing cap, `overflow: clip` the visual cleanup.**
  `min-height` alone is a FLOOR, not a ceiling — an `auto`-height box grows past it regardless of `overflow`
  — so the CWV guarantee is the `max-height` pinned to the reserve; `overflow: clip` hides the overflow.
  `spec.grow === true` (additive `ReserveSpaceSpec.grow?`, pinned in `contract-stability.test.js`) opts a
  reserve OUT for a host that wants a growable box.
- **(i) rule-of-three EXCEPTION — the shared base, not full unification (rationale CORRECTED per review).**
  `connectors/alloy/decisions.js` exports `contentOf(x)` (byte-identical to `htmlOfDecision`'s former inline
  unwrap); `adapters/eds/decisions-exposure.js`'s `propositionOf` imports it but keeps its own `scope`/`id`
  gate. **Correction (both reviewers):** the two predicates AGREE on every contract shape — a Decision whose
  `content` lacks scope/id yields `null` both ways (the originally-cited `{content:{items:[…]}}` example does
  NOT diverge). They differ ONLY on a non-contract chimera `{scope, id, content:{…no scope/id}}` (neither a
  Decision nor a proposition), which nothing in the airlock produces. Preserving the gate is the strict
  byte-identity call; the divergence is prose-only + untested. Comments in both files + the refinement-todo
  note were corrected to say this accurately.
- **(f) `decisions.fetch` loud-not-built.** `connectors/alloy/alloy-chamber.worker.js`'s granted
  `decisions.fetch` now throws "declared-not-built" (was `async () => []`); `deliver` untouched; grep
  confirmed no caller relied on `[]`. `contract-stability.test.js` gains a new `DomHandle` shape pin + a
  behavioral source-text pin that `fetch` throws.
- **Accepted-minor nits (both reviewers flagged; non-blocking, recorded not churned):** (1)
  `contract-stability.test.js`'s 018-02 block re-affirms the pre-existing 012-04 `.d.ts` `fetch`/`deliver`
  type pins alongside the two NEW pins — light narrative duplication for a self-contained cluster, kept
  intentionally. (2) `reservedBoxStyle()` (a **production-unused** pure helper — `reserveSpace` inlines its
  styles, grep-confirmed no caller) is left returning only `{ minHeight }`; its docstring does not mention
  the clip styles the real path adds. Deferred (dead-code-adjacent), not extended, to avoid touching an
  unrelated exact-match assertion. (3) the module-level docstring's "content <= reserve causes no reflow"
  framing is now narrower-than-reality (clip makes over-tall fills non-reflowing too); the AC-scoped inline
  comment is the corrected source of truth. (4) the clip proof uses the element shim (per the DoD's "shim or
  rig" phrasing); the real `getBoundingClientRect` geometry proof stays the rig's job (unchanged).

### Reconciliation sweep

- **Surface:** `adapters/eds/dom.js` (clip default + `release()` symmetric cleanup), the shared
  `contentOf` in `connectors/alloy/decisions.js` consumed by `adapters/eds/decisions-exposure.js`, the loud
  `decisions.fetch` in `connectors/alloy/alloy-chamber.worker.js`, `contracts/capability.d.ts`
  (`ReserveSpaceSpec.grow?`, additive), and the test additions. All pure refactor / additive / a made-loud
  already-unbuilt method — **no behavioural regression** to 018-01's sanitizer or the reserve/prehide/fill
  lifecycle (targeted sweep 105/105).
- **Boundaries:** adapter→connector import (`decisions-exposure.js` → `connectors/alloy/decisions.js`)
  mirrors the established `adapters/eds/index.js` → `connectors/ga4/` direction (`decisions.js` is a pure
  DOM-free module); no `core/` touched, no boundary test regressed.
- **Reviews recorded:** compliance + craft (both needs-changes → blocker fixed → re-verified pass) +
  reconciliation, under `reviews/`.
- **Docs:** `docs/refinement-todo.md` items **f/g/i** RESOLVED, **h/j** re-affirmed deferred with triggers;
  `docs/releases/mvp3.md` `reserveSpace` Include row updated (018-01 + 018-02 delivered; h/j/eslint-scope
  still open). No inbox items.
- **Named residuals (tracked):** (h) production eager-phase `reserveSpace` wiring; (j) the DOM-writer-
  invariant `core/` migration (OQ13); the `reservedBoxStyle()` dead-helper drift; the `opts.sanitize`
  first-write-wins constraint (018-01).
