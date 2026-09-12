---
status: DONE
dependencies: [adr-0002]
last_verified: 2026-09-11
frame_review: true
arch_review: false
---

<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about runnable
     surfaces by probe first (run it / read source) or a citation, else mark them
     as assumptions in `## Assumptions` — never assert an unverified claim as fact. -->

## Slice 043-01 — extract `getCookieValue` + repoint the two exact-name copies

**Goal:** Extract the duplicated "read a cookie value by exact name" scan into one shared pure primitive
`getCookieValue(cookieString, name)` in `core/`, and repoint the two copies (`adapters/eds/index.js`'s
`readCookieValue`, added by 026-04, and `adapters/eds/cookies.js`'s mediated `get(name)` inner loop) to it —
**behavior-preserving**, killing the triplication the [extract-on-third-caller convention](../../conventions.md)
flags before a fourth copy accretes. The prefix-match / first-pair / filter / scoping **variants stay open-coded**
(spec 043 § Overview + A2) — this is not a generic cookie-iterator.

**The load-bearing claim (what the frame-critique checks).** Both target bodies were read (`adapters/eds/index.js:747-756`,
`adapters/eds/cookies.js:30-40`) and appear identical in scan logic (`split(";")` → `indexOf("=")` skip-on-`-1` →
`slice(0,eq).trim()===name` → `decodeURIComponent(slice(eq+1).trim())` with raw-on-throw), differing in input shape
(a `cookieString` param vs `doc.cookie`) **and in the absent-value sentinel** — `readCookieValue` returns `undefined`
(index.js:748,760), `get()` returns `null` (cookies.js:31,43, preserving its `Promise<string|null>` capability
contract). Both are reconciled at the `get()` call site (AC2). The collapse-safety of the loop equivalence plus the
sentinel reconciliation is what the frame-critique tested; AC1's edge-case tests + the full suite guard implementation.

**DoR:**
- ✅ Rule-of-three tripped: `readCookieValue` (026-04) is the third exact-name copy; the two adapter copies share the
  same scan/decode loop (differing only in the absent sentinel, reconciled in AC2). ADR-0002 is the governing decision.
- ✅ The **new leaf module** `core/cookie-parse.js` imports nothing, so `adapters/*` / `connectors/* → core/cookie-parse.js`
  creates no cycle (note: `core/` *composition roots* like `core/airlock.js` do import from connectors — the layering
  rests on the leaf being import-free, not on all of `core/` being dependency-free).
- ✅ The accessor is parse-only — no `document`, no consent gate. Callers keep their own 017-02 grant-gating; this moves
  *where the parse lives*, never *whether a read is allowed*.

**Acceptance Criteria:**

1. **`core/cookie-parse.js` exports `getCookieValue(cookieString, name)`** — the exact-name value lookup, behavior
   copied verbatim from the current implementations: returns `undefined` when `cookieString` is not a non-empty string
   or `name` is absent from the jar; otherwise the first pair whose key (`slice(0, indexOf("="))`, trimmed) equals
   `name`, value = `decodeURIComponent(value.trim())`, falling back to the **raw** trimmed value if decode throws (never
   throws). Unit tests cover each edge the originals handle: non-string/empty → `undefined`; absent name → `undefined`;
   present → decoded value; `=` inside the value (only the first `=` splits); surrounding whitespace on key and value;
   malformed `%`-escape → raw (no throw); **first-match-wins** on a duplicate name (preserving current behavior).
2. **Both exact-name copies repointed, sentinel preserved per call site.** `adapters/eds/index.js` drops
   `readCookieValue`'s open-coded loop and uses `getCookieValue` (import from `core/cookie-parse.js`) — its `undefined`
   sentinel unchanged. `adapters/eds/cookies.js`'s `get(name)` returns `getCookieValue((doc && doc.cookie) || "", name) ?? null`
   — the **`?? null` preserves its `Promise<string|null>` contract** (cookies.js:23), so `test/eds-cookies.test.js`'s
   `.toBeNull()` assertions on the empty-jar/absent-cookie paths (`:48-51`) still pass. No call-site behavior changes;
   the existing adapter/GA4 cookie tests pass unmodified.
3. **Variants explicitly untouched, with rationale.** `connectors/ga4/cookies.js` `findGaStreamCookie` (prefix match),
   `connectors/alloy/sync-cookie-cache.js` (first-pair/filter), `core/cookie-scope.js` + `core/wrapped-sdk-host.js`
   (scoping) are **not** repointed; a one-line note (in the spec's Overview, already present) records why each is a
   different accessor. No generic pair-iterator is introduced (leanness).
4. **Behavior-preserving + no governance change.** `npx vitest run` is green (full suite — the behavior-preservation
   proof). A grep/confirm that `core/cookie-parse.js` contains no consent/`document`/side-effecting code, and that no
   consent-gating call site lost its gate.

**DoD:**
- All ACs met; full `npx vitest run` green; new `test/cookie-parse.test.js` (or equivalent) witnesses AC1's edges.
- `core/cookie-parse.js` created; `readCookieValue` removed and its callers repointed; `adapters/eds/cookies.js` `get()`
  delegates. Grounding comments where useful.
- Compliance + craft review passes recorded; the pre-implementation **frame-critique pass ran** (`frame_review: true` —
  it caught the `undefined`/`null` sentinel divergence and folded the fix into A1 / AC2 / DoR before implementation;
  see `reviews/slice-01-frame-critique.md`). No arch or code-health pass (`arch_review: false`; no `code_health_review`).
  Reconciliation walked; `docs/refinement-todo.md` OQ13 item 5 struck as RESOLVED (spec 043).

**Out of scope (explicit):**
- The prefix-match / first-pair / filter / scoping variants (spec 043 § A2) — different accessors, left open-coded.
- Any consent/governance change (the accessor is parse-only).
- A generic "iterate cookie pairs" primitive (premature generality).

## Assumptions

**A1 (collapse-safety).** The two exact-name copies share the same scan/decode loop (same split, `=`-handling, trim,
`decodeURIComponent`-with-raw-fallback) but **differ at the absent-value sentinel** — `readCookieValue`→`undefined`,
`get()`→`null` (its `Promise<string|null>` contract). The frame-critique caught this; AC2 reconciles it (`get()` wraps
the accessor `?? null`). Remaining risk: a further missed divergence (e.g. duplicate-name handling) — guarded by AC1's
edge-case tests + the full suite. See spec 043 § A1 (corrected 2026-09-11).

**A2 (scope boundary).** The prefix-match / first-pair / filter / scoping variants are genuinely different accessors, not
lazy non-extractions — collapsing them would lose semantics or force an over-general primitive. See spec 043 § A2.

### Deviation log (after reconciliation)

Behavior-preserving extraction, implemented exactly as framed — **no deviations from the ACs**.

- **Verbatim extraction (AC1).** `core/cookie-parse.js` `getCookieValue(cookieString, name)` copies the scan/decode
  loop byte-for-byte from the two originals (`split(";")` → `indexOf("=")` skip-on-`-1` → `slice(0,eq).trim() !== name`
  → `decodeURIComponent(slice(eq+1).trim())` with raw-on-throw), including `readCookieValue`'s leading `typeof`/`length`
  guard. Absent-value sentinel is `undefined`. Pure, import-free leaf — mirrors `core/cookie-scope.js`'s shape.
- **Sentinel reconciled per call site (AC2).** `adapters/eds/index.js` keeps `undefined` (call site repointed 1:1;
  `readCookieValue` + its JSDoc deleted, not left as a wrapper). `adapters/eds/cookies.js` `get()` returns
  `getCookieValue((doc && doc.cookie) || "", name) ?? null`, preserving its `Promise<string|null>` contract — so
  `test/eds-cookies.test.js:48-51`'s `.toBeNull()` assertions pass unmodified.
- **Benign guard note (compliance + craft reviewers).** The original `get()` inner loop had no non-string guard but
  always received a string (`(doc && doc.cookie) || ""`), so `getCookieValue`'s leading guard is behaviorally equivalent
  for every real input on that path. The craft pass flagged the `length === 0` clause as redundant-with-the-loop but
  recommended keeping it (harmless, mirrors the original, clearer/faster for the empty case) — **kept**, no churn.
- **Leanness held (AC3).** Only the exact-name accessor was extracted; the prefix-match / first-pair / filter / scoping
  variants stay open-coded (spec 043 §A2). No generic pair-iterator, no options, a single export.
- **Behavior-preservation proof (AC4).** Full `npx vitest run` green — 101 files / 1548 tests — witnessed by the
  orchestrator (the read-only review passes could not run it). New `test/cookie-parse.test.js` (10 edge tests) witnesses
  AC1; `git grep readCookieValue` returns no code references.

### Reconciliation sweep

Drift-prone surfaces checked (`updated` / `no-op` / `deferred`):

- **`docs/refinement-todo.md` OQ13 item 5** — `updated`: struck as RESOLVED (spec 043-01) with a Resolved note; the
  OQ13 header, "Still open", and "Resolution trigger" lines reconciled (item 5 → DONE; item 3 remains the only open
  OQ13 item).
- **`docs/specs/README.md` (generated status board)** — `deferred`: still renders 043 as DRAFT; it is a derived
  artifact (regenerated, never hand-edited) and is refreshed at close via `workflow.py status-board` once the slice
  reaches DONE and spec 043 rolls up (trigger: the post-DONE close-out step, tracked by close-out item 2 below).
- **Primer surfaces (`CLAUDE.md` / `AGENTS.md`)** — `no-op`: grep found no `043` / `cookie-parse` / `readCookieValue`
  reference; 043 had no active-spec primer entry, so the spec-close compress is a no-op (close-out confirmed).
- **`docs/architecture.md`** — `no-op`: no module boundary or public contract changed. The `adapters/* → core/` edge
  and the pure import-free leaf pattern both pre-exist (`core/cookie-scope.js`, added by 035-01, is the exact precedent
  and is likewise not enumerated in architecture.md); `getCookieValue` is an internal helper, not part of the frozen
  1.0 surface (ADR-0017). No ADR — the decision is governed by the pre-existing ADR-0002.
- **`docs/inbox.md`** — `no-op`: the one cookie-related inbox item (2026-09-05, coarse-consent / OQ13-1) is unrelated
  to pair-scan duplication.
- **Closed-spec drift (ADR-0010)** — `no-op`: 026-04 (DONE) introduced `readCookieValue`; its record accurately
  describes that point-in-time addition and is not rewritten. No live prose (architecture / skill / README) names
  `readCookieValue`, so there is nothing to correct inline.
- **Use-case coverage (advisory)** — `no-op`: `workflow.py coverage` reports no coverage gaps; 043 appears under
  scope-creep (empty `use_cases:`) alongside the other infra/refactor specs — expected and legitimately untraced (no
  user-facing behavior), non-blocking (ADR-0025).
- **Lightweight decisions / conventions** — `no-op`: no UI/visual/copy decision and no new or changed convention.

### Close-out (post-DONE)

- [x] `docs/refinement-todo.md` OQ13 item 5 struck as RESOLVED (spec 043) — Resolved note added; OQ13 header / "Still open" / "Resolution trigger" reconciled.
- [x] Spec 043 rolls to DONE (single slice); regenerate the board — done (`workflow.py status-board`: 110 slices / 43 specs; board row 043-01 → **DONE**).
- [x] Primer hygiene: 043 has no active-spec primer entry — spec-close compress is a no-op; confirmed (grep: no `043` / `cookie-parse` / `readCookieValue` in `CLAUDE.md` / `AGENTS.md`).
