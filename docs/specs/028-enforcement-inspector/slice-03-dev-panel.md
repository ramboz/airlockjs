---
status: DONE
dependencies: [028-01, 028-02]
last_verified: 2026-09-03
# design_review: low-stakes dev tooling — design values checked by eye at review,
#                not a servo design-eval gate (ADR-0049 graduated tier).
---

<!-- jig grounding (ADR-0020): the panel is a view over 028-01's pull-based
     query() (returns copies, off the hot path) + 028-02's beaconId chains.
     Tested with the fakeEl/fakeDoc shim the repo already uses (no jsdom —
     test/dom-apply-coordinator.test.js, test/eds-dom-reserve.test.js). -->

## Slice 028-03 — the drop-in dev panel

**Goal:** A lightweight, local, **drop-in-JS** panel over the inspector's query API that makes the
enforcement-decision stream (and 028-02's per-beacon chains) **visible** to a developer — the vision's
first-class inspector, the differentiator vs Zaraz's opacity. Split for testability in a no-jsdom repo: a **pure
view-model** function (groups records into per-beacon chains + loose records + counts; filterable) and a **thin
DOM mount** that renders the model into a provided element via `createElement`/`textContent` (XSS-safe by
construction — never `innerHTML`). No remote/hosted trace backend, no account (both MVP5 no-gos). Reads the
collector off the hot path — zero interaction-path cost.

## Assumptions

- **No unproven load-bearing premise.** The panel is a pure view over an existing **pull** API: 028-01's
  `collector.query()` returns copies off the projection-fold hot path (grounded, 028-01), and 028-02's
  `beaconId` groups a beacon's records. The panel calls `query()` on demand (a `render()` call), never on the
  capture/`push()` path — so "zero interaction-path cost" holds by construction, not by assumption. Testability
  is grounded: the repo renders DOM under a hand-rolled `fakeEl`/`fakeDoc` shim (no jsdom), which this slice
  reuses. This section is intentionally "None of substance" — risk-gated, so the frame-critique is a formality
  unless a reviewer surfaces a hidden premise.

**DoR:**
- ✅ 028-01 DONE (the collector + `query()` exist) and 028-02 DONE (`beaconId` groups a beacon's records).
- ✅ Grounded testability: the repo renders DOM under a `fakeEl`/`fakeDoc` shim (no jsdom) — reused here.
- ☐ Frame-critique disposition (spec `frame_review: true`): the slice declares **no load-bearing assumption**
  (a pure view over an existing pull API) — a frame-critique is a formality here; run/record it if the gate
  requires, else note the risk-gated no-op.

## Acceptance Criteria

1. **A pure view-model groups records into per-beacon chains + loose records + counts.** `inspectorModel(records)`
   (or `inspectorModel(collector, filter?)`) returns `{ beacons: [{ beaconId, destination, chain: [{ kind,
   disposition, reason }] }], loose: [{ kind, disposition, reason, ... }], counts: { total, byDisposition } }`
   — records with a `beaconId` grouped into that beacon's chain in emission order (028-02's held→flushed), records
   without one listed in `loose`. Filterable by `kind`/`disposition`/`purpose`/`beaconId` (delegates to `query`).
2. **A DOM mount renders the model into a provided element, XSS-safe.** `renderInspectorPanel(el, collector,
   filter?)` builds the panel into `el` via `createElement` + `textContent` (values are text, never
   `innerHTML`) — a counts header, a section per beacon chain, and a loose-records list. A test drives it with
   the `fakeEl`/`fakeDoc` shim and asserts the rendered structure/text (incl. a record whose `reason` contains
   `<script>` renders as inert text, never markup).
3. **Zero interaction-path cost.** The panel only reads via `query()` on a `render()` call — never on
   capture/`push()`/the projection fold. A test asserts rendering does not touch the capture path and that no
   render work is triggered by an enforcement emit (rendering is pull, on demand).
4. **Drop-in / local — no network, no backend, no account.** The panel is a function called with `(el,
   collector)`; a test (or a grep-style assertion) confirms the module makes no `fetch`/network call and needs
   no remote endpoint.
5. **Graceful empty / absent state.** An empty collector renders an empty-state view (no error); a missing
   element or collector is a no-op (never throws — a dev tool must not crash the page).

## DoD

- [x] All ACs pass; full real-repo suite green (**932**, worktree excluded; 12 panel tests). Additive
      `core/inspector/panel.js` — no host file touched.
- [x] Coverage exercises each AC (view-model grouping/filter/backfill/valid-count; a shim-rendered panel incl.
      the inert-`<script>` XSS case; empty/absent/missing-collector state; pull-only + no-network).
- [x] Each new test shown to fail when its feature is removed — a grouping-disable mutation redded 3 tests; restored.
- [x] Reviewed by independent reviewer; **compliance PASS + craft PASS** (recorded under `reviews/`).
- [x] Implementation review passed.
- [x] Deviation log + Reconciliation sweep produced below; reconciliation review recorded.
- [x] Primer hygiene on spec close: **OQ7 resolved** in `docs/refinement-todo.md` + `docs/architecture.md` +
      `docs/product-vision.md`; 028 is not in CLAUDE.md's Active specs (nothing to compress); board Notes updated
      on regen. No decisions deferred (craft nits fixed inline).

**Anti-horizontal-phasing check:** after this slice a developer **opens a panel and sees** why beacons fired /
held / were gated / stripped, with per-beacon chains — the vision's first-class inspector, delivered end-to-end
(collector → query → correlation → visible panel). Closes spec 028 / resolves OQ7.

### Deviation log (after reconciliation)

1. **Split for no-jsdom testability.** `core/inspector/panel.js` = a **pure** `inspectorModel` (groups records
   into per-beacon chains + loose + counts) + a **thin** `renderInspectorPanel` DOM mount, tested with the
   repo's `fakeEl`/`fakeDoc` shim (no jsdom) — mirrors `dom-apply`/`reserveSpace`.
2. **XSS-safe by construction (the load-bearing security property).** The mount builds via `createElement` +
   `textContent` ONLY — record values are text nodes, never `innerHTML`. The reviewer confirmed this is sound in
   a REAL browser DOM (textContent never parses markup), not merely a shim artifact; grep confirms no
   innerHTML/insertAdjacentHTML/outerHTML/document.write/eval/Function sink.
3. **Two craft nits fixed inline (compliance/craft review).** `counts.total` counts only VALID grouped records
   (was `records.length`, which over-counted a direct-array caller's null entries); the destination backfill
   guard is `== null` (was `=== undefined`, missing a first record with `destination:null`). Both newly tested.
   The AC4 network grep strengthened to bare identifiers (an aliased global can't evade it).
4. **No frame-critique subagent for this slice.** 028-03 declared **no load-bearing assumption** (a pure view
   over an existing pull API); the READY gate allowed it without one (risk-gated `frame_review`). The adversarial
   pass was provided by the implementation review, which scrutinized the XSS claim hardest and confirmed it sound.
5. **Additive.** New leaf module `core/inspector/panel.js`; no host file touched (unlike 028-02).

### Reconciliation sweep

| Artifact | Disposition | Rationale |
|----------|-------------|-----------|
| `README.md` | `no-op` | No user-facing entrypoint change — a local dev inspector. |
| `docs/specs/README.md` | `updated` | Regenerated by `workflow.py status-board` (028-03 → DONE; **spec 028 complete**). |
| `docs/product-vision.md` | `updated` | § Open questions — the "how far the inspector goes" question marked resolved (spec 028 / MVP5). |
| `docs/architecture.md` | `updated` | **OQ7 resolved** (the inspector-scope open question) — struck + pointed at spec 028. |
| `docs/refinement-todo.md` | `updated` | **OQ7 struck + Resolved-by spec 028**, with the shipped scope + the deliberately-deferred (remote backend, event-type correlation, strip-chain). |
| Primer surfaces: `CLAUDE.md` / `AGENTS.md` / scaffold templates | `checked` | 028 was never in CLAUDE.md's Active specs (only 001 is) — nothing to compress; a DONE spec needs no primer entry (derivable from the board). No new skill introduced. |
| `docs/inbox.md` | `no-op` | No new parked item. |
| `docs/memory/**` | `no-op` | Nothing cross-session beyond the spec/reviews. |
| `docs/decisions/README.md` / ADR index | `no-op` | No ADR touched. |

**Reconciliation review — PASS (self-recorded, jig:reviewer prompt-source).** 028-03 delivers the visible panel
end-to-end (collector → query → correlation → panel), closing spec 028 and resolving OQ7. The load-bearing
XSS-safety is confirmed real-DOM-sound; both gating passes PASS; the craft nits are fixed + tested; the
spec-close primer hygiene (OQ7 across all three trackers) is done. Additive, no host regression (932 green). No
orphans. Ready RECONCILED → DONE.
