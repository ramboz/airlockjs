---
status: DRAFT
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
- [ ] ACs 1–4 pass. Tests: `eds-dom-reserve` gains an overflow-clip assertion (an over-tall fill's box does
      not exceed the clip / surrounding rect unchanged — via the element shim or the browser rig);
      `alloy-decisions` + `decisions-exposure` stay green through the shared-accessor refactor;
      `contract-stability` gains the `DomHandle` + `decisions` pins + a `decisions.fetch` loud-not-built
      assertion.
- [ ] **No regression** — targeted sweep: `eds-dom-reserve`, `alloy-decisions`, `alloy-decisions-stub`,
      `decisions-exposure`, `contract-stability`, `sanitize-html`. _(Named files only — full suite hangs.)_
- [ ] Reviews: compliance + craft + arch (small — an overflow default + a rule-of-three extraction + a
      contract-loudness pin) + reconciliation, recorded pass (independent Opus review of the Sonnet diffs).
- [ ] Deviation log + reconciliation sweep; refinement-todo items **f, g, i** marked RESOLVED (and **h**/**j**
      re-affirmed deferred with their triggers, **not** silently dropped); mvp3.md `reserveSpace` Include row
      updated to reflect the hardening delivered.
- [ ] **No live identifiers committed.**

**Anti-horizontal-phasing check:** after this slice, an over-tall personalization fill no longer reflows the
page (a user-visible CWV change), a connector author sees a loud `decisions.fetch` + pinned contract shapes
(a real API-surface change), and the proposition accessor has one home. All three touch the user-/author-
facing edges of the DOM-injection capability, not internal plumbing alone.
