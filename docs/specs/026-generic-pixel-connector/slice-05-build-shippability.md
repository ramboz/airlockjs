---
status: DONE
dependencies: []
last_verified: 2026-09-02
frame_review: false
---

<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about
     runnable surfaces by probe first (run it / read source) or a citation.
     frame_review: false — this slice rests on grounded facts (below), not
     risk-gated assumptions, so no adversarial frame-critique gate fires. -->

## Slice 026-05 — live-shippability: the `pixel-chamber.worker.js` bundle entry + N-worker build assertion

**Goal:** Make the pixel connector **genuinely live-shippable** — add `core/pixel-chamber.worker.js` as a
`build.mjs` bundle entry (a same-origin sibling file the emitted `eds.js` resolves), and **generalize** build.mjs's
single-worker sibling-layout assertion to **N workers**. Closes the parked inbox gap: `createAirlock({connector:
"pixel"})` (adapter-wired) emits `new Worker(new URL("./pixel-chamber.worker.js"))` in `eds.js`, but `build.mjs`
only emits `eds.js` + `chamber.worker.js` — so a real EDS page **404s the pixel worker**. This is the difference
between "proven at Node/vitest" and "deployable."

**DoR (grounded 2026-09-02 — facts, not risk-gated bets; hence `frame_review: false`):**
- ✅ **`build.mjs` today (grounded, read):** two entries (`adapters/eds/index.js`→`eds.js`,
  `core/chamber.worker.js`→`chamber.worker.js`, `build.mjs:40-43`) + a strict build-time assertion — both siblings
  emitted; the emitted `eds.js` references the worker by **exactly** `./chamber.worker.js`; no `blob:`/`data:` in
  either output (`build.mjs:54-98`). The reference check greps only the **FIRST** `new Worker(new URL(...))` match
  (`build.mjs:68` `.exec`).
- ✅ **The pixel worker IS eds-reachable (grounded):** `airlock.js:181-183` selects
  `./pixel-chamber.worker.js` for `connector:"pixel"`, and `adapters/eds/index.js`'s `bootMetaPixel` /
  `bootLinkedInInsight` / `bootBingUet` all call `createAirlock({connector:"pixel"})`. So the emitted `eds.js`
  already contains BOTH `new Worker(new URL("./chamber.worker.js"))` (GA4, first in source) AND `new Worker(new
  URL("./pixel-chamber.worker.js"))` (pixel) — the pixel worker is **referenced but not emitted**. That is the bug.
- ✅ **The dom-chamber worker is NOT eds-reachable (grounded):** the ONLY production `new Worker(new URL(...))`
  calls are `airlock.js:182-183` (a **binary** GA4/pixel ternary); `core/dom-chamber.worker.js` is never
  `new Worker`'d in production — only exercised via `core/dom-chamber-host.js` + FakeWorker in tests. Bundling it
  now is **speculative** (nothing loads it on a real page) → correctly OUT of this slice; deferred to when a real
  worker-dom tag adapter wires it (a 025-03+ concern).
- ✅ **004-01 CSP envelope (grounded, `build.mjs:18-26`):** workers MUST stay same-origin file URLs (no
  `blob:`/`data:`) under the boilerplate CSP; the new entry inherits + is covered by the (generalized) assertion.

**Acceptance Criteria:**

1. **`core/pixel-chamber.worker.js` is a build entry.** `build.mjs`'s `entryPoints` gains `{ in:
   "core/pixel-chamber.worker.js", out: "pixel-chamber.worker" }`; `npm run build` emits
   `pixel-chamber.worker.js` as a sibling in OUTDIR (alongside `eds.js` + `chamber.worker.js`).
2. **The sibling-layout assertion is generalized to N workers.** build.mjs collects **every** `new Worker(new
   URL(...))` specifier in the emitted `eds.js` (not just the first — `matchAll`), and verifies: each references a
   **known expected** worker (`./chamber.worker.js`, `./pixel-chamber.worker.js`) AND that worker was **emitted**
   as a sibling; and **no `blob:`/`data:`** in ANY emitted output (all worker chunks scanned). A dropped / hashed /
   missing entry for ANY referenced worker fails the **BUILD** (not just a smoke rig).
3. **The build passes with both workers.** `npm run build` succeeds — both worker siblings emitted + referenced by
   exact sibling specifiers, no `blob:`/`data:`. (build.mjs's assertion, which throws on failure, IS the gate.)
4. **The generalized guard is non-vacuous.** Demonstrate the assertion FAILS the build if a referenced worker is
   emitted-away / not-emitted (e.g., temporarily drop the pixel entry → build throws naming the missing sibling,
   then restore) — proving it actually catches the gap it closes (the same class the 026-01 self-caught ternary
   bug hit).
5. **The dom-chamber worker is NOT bundled (grounded exclusion, documented).** build.mjs does not add a
   dom-chamber entry; the slice documents WHY (not eds-reachable — grounded above) + names the follow-up (a real
   worker-dom tag adapter, 025-03+). No speculative entry.
6. **004-01 CSP envelope preserved.** No `blob:`/`data:` in any emitted worker; all same-origin file siblings.
7. **No live identifiers** (build config only).

**DoD:**
- [x] The `pixel-chamber.worker.js` entry + the N-worker generalized assertion (`matchAll` over every
      `new Worker(new URL(...))` ref; each must be a known, emitted sibling; no `blob:`/`data:` URL in any chunk)
      in `build.mjs`.
- [x] `npm run build` green — emits `eds.js` + `chamber.worker.js` + `pixel-chamber.worker.js`, both refs resolve
      (AC1/AC3); AC4 demonstrated — dropping the pixel entry makes the build THROW ("worker specifier
      ./pixel-chamber.worker.js is not a known sibling worker"), restored + re-verified.
- [x] `npm run lint` clean; `npm run rig:bundle` PASS (GA4 default path boots + governs under the CSP — no
      regression); airlock regression green; **no live identifiers** (build config only).
- [x] `frame_review: false` — no frame-critique gate (grounded build-config); compliance + craft reviews recorded
      (both PASS); close-out `### Deviation log` + `### Reconciliation sweep` below; `docs/inbox.md`'s `build.mjs`
      item resolved (pixel done; dom-chamber deferred).

**Anti-horizontal-phasing check:** 026-05 delivers the pixel connector's **live-shippability** — its user is the
site owner deploying a pixel vendor, who today would hit a 404 on the pixel worker. Vertical (a real deployment
outcome, not internal refactor), grounded, and minimal (one entry + a proportionate assertion generalization). It
turns 026 from "proven in tests" into "deployable," honoring the maintainer's "real path, not theoretical" thesis.

### Deviation log

- **Implemented by the orchestrator directly.** The first implementer subagent got stuck (68 min, repeated
  restarts on a ~10-min task — likely a hung command); it was stopped (`TaskStop`) having made **no edits**
  (clean slate), and the orchestrator did the bounded build-config change + verified it (build, AC4 demo, lint,
  `rig:bundle`). Reviewed independently by fresh compliance + craft passes (both PASS) — the orchestrator is not
  exempt from review.
- **Cross-file staleness fixed (both reviews' reconciliation note).** `core/airlock.js:171-179`'s comment (a) said
  `pixel-chamber.worker.js` "is not yet wired into build.mjs" — **falsified by this slice** — and (b) contained a
  verbatim `` `new Worker(new URL("…"` `` "grep-trap" literal that was the source of a dormant regex-fragility nit
  (if esbuild ever kept that comment in the bundle, the assertion's `matchAll` could false-capture it). Rewrote the
  comment: corrected the now-true "wired as a build.mjs entry (026-05)", updated the assertion description to the
  order-independent N-worker `matchAll`, and removed the trap literal — fixing both at the source. (A comment-only
  edit; airlock regression green.)
- **`blob:`/`data:` scan hardened (both reviews).** `build.mjs`'s CSP-envelope check was a bare-substring
  `/\bblob:|\bdata:/`, which would false-fail on a future ordinary `{ data: … }` object key in any bundled module.
  Anchored to a URL-literal context (`/(["'`])(?:blob|data):/` — a quote-prefixed scheme). Inert today (zero
  `blob:`/`data:` in the output); a robustness fix on the security-relevant assertion.
- **Left as-is (harmless, both reviews):** the "referenced-but-not-emitted" assertion branch is belt-and-suspenders
  with the positive emit check (both throw); the `allWorkersAreSameOriginFileUrls` derived signal is a
  success-path flourish (logged after the throw). Kept as defensive/documentary, not simplified away.

### Reconciliation sweep

- **Question answered + Outcome:** the pixel connector is now **genuinely live-shippable** — `build.mjs` emits
  `core/pixel-chamber.worker.js` as a same-origin sibling (verified: `npm run build` emits all three siblings,
  both `new Worker` refs resolve, `all_workers_are_same_origin_file_urls: true`), and its single-worker
  sibling-layout assertion is generalized to **N workers** with the guard proven non-vacuous (a dropped entry
  throws). 026 is no longer "proven in tests only." **No regression** (`rig:bundle` PASS; airlock tests green).
- **Promoted / resolved, no orphans:** the `docs/inbox.md` `build.mjs` item is **resolved** for the pixel worker;
  the stale `core/airlock.js` residual comment is **corrected**. The **dom-chamber** worker's bundle entry stays
  **deferred** (grounded: never `new Worker`'d in production — nothing in `eds.js` references it), named for a
  real worker-dom tag adapter (025-03+).
- **Downstream named:** 026-04 (identity/advanced-matching + POST/body, real-driver-gated); the dom-chamber
  bundle entry (025-03+); a pixel-path runtime bundle-smoke (a follow-up beyond this slice — `rig:bundle` only
  exercises the GA4 default path today). No dependency left dangling.
- **No live identifiers** (build config); the emitted bundle outputs are gitignored (not committed).
