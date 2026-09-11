---
status: DRAFT
dependencies: [adr-0002]
last_verified:
frame_review: true
arch_review: false
---

<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about runnable
     surfaces by probe first (run it / read source) or a citation, else mark them
     as assumptions in `## Assumptions` — never assert an unverified claim as fact. -->

## Slice 043-01 — extract `getCookieValue` + repoint the two exact-name copies

**Goal:** Extract the byte-identical "read a cookie value by exact name" scan into one shared pure primitive
`getCookieValue(cookieString, name)` in `core/`, and repoint the two copies (`adapters/eds/index.js`'s
`readCookieValue`, added by 026-04, and `adapters/eds/cookies.js`'s mediated `get(name)` inner loop) to it —
**behavior-preserving**, killing the triplication [ADR-0002](../../decisions/adr-0002-extract-helper-on-third-caller.md)
flags before a fourth copy accretes. The prefix-match / first-pair / filter / scoping **variants stay open-coded**
(spec 043 § Overview + A2) — this is not a generic cookie-iterator.

**The load-bearing claim (what the frame-critique checks).** Both target bodies were read (`adapters/eds/index.js:747-756`,
`adapters/eds/cookies.js:30-40`) and appear identical in scan logic (`split(";")` → `indexOf("=")` skip-on-`-1` →
`slice(0,eq).trim()===name` → `decodeURIComponent(slice(eq+1).trim())` with raw-on-throw), differing only in input shape
(a `cookieString` param vs `doc.cookie`). The collapse-safety of that equivalence — and that no caller of either body
relies on a behavior the accessor drops — is the assumption the frame-critique adversarially tests; AC1's edge-case
tests + the full suite are the implementation-time guard.

**DoR:**
- ✅ Rule-of-three tripped: `readCookieValue` (026-04) is the third exact-name copy; the two adapter copies are
  byte-identical (grounded above). ADR-0002 is the governing decision.
- ✅ `core/` is dependency-free and importable by both `adapters/` and `connectors/` (architecture § Module boundaries),
  so a `core/` home lets the one accessor serve every current + future caller.
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
2. **Both exact-name copies repointed, behavior byte-identical.** `adapters/eds/index.js` drops `readCookieValue`'s
   open-coded loop and uses `getCookieValue` (import from `core/cookie-parse.js`); `adapters/eds/cookies.js`'s `get(name)`
   returns `getCookieValue((doc && doc.cookie) || "", name)`. No call-site behavior changes — the existing adapter/GA4
   cookie tests pass unmodified.
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
- Compliance + craft review passes recorded (no arch/frame pass — `arch_review`/`frame_review` false); reconciliation
  walked; `docs/refinement-todo.md` OQ13 item 5 struck as RESOLVED (spec 043).

**Out of scope (explicit):**
- The prefix-match / first-pair / filter / scoping variants (spec 043 § A2) — different accessors, left open-coded.
- Any consent/governance change (the accessor is parse-only).
- A generic "iterate cookie pairs" primitive (premature generality).

## Assumptions

**A1 (collapse-safety).** The two exact-name copies are behaviorally identical and safe to collapse to one accessor.
Grounded by reading both bodies (`adapters/eds/index.js:747-756`, `adapters/eds/cookies.js:30-40`) — same split,
`=`-handling, trim, and `decodeURIComponent`-with-raw-fallback — but a subtle divergence (duplicate-name handling, or
behavior in `get()` *after* the matched-value return) would make the collapse a regression. Guarded by AC1's edge-case
tests + the full suite. See spec 043 § A1.

**A2 (scope boundary).** The prefix-match / first-pair / filter / scoping variants are genuinely different accessors, not
lazy non-extractions — collapsing them would lose semantics or force an over-general primitive. See spec 043 § A2.

### Deviation log (after reconciliation)

_(pending implementation)_

### Reconciliation sweep

_(pending implementation)_

### Close-out (post-DONE)

- [ ] `docs/refinement-todo.md` OQ13 item 5 struck as RESOLVED (spec 043).
- [ ] Spec 043 rolls to DONE (single slice); regenerate the board.
- [ ] Primer hygiene: 043 has no active-spec primer entry — spec-close compress is a no-op; confirm at close.
