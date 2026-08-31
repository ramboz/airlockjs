---
status: DONE
dependencies: []
last_verified: 2026-08-31
frame_review: true
---

<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about
     runnable surfaces by probe first (run it / read source) or a citation. -->

## Slice 021-02 — egress transport pin (http-downgrade), grounding-first

**Goal:** Close the 015-02 **protocol-blindness** residual — an `http://` downgrade to the honest host+tenant
must not forward identity/analytics over cleartext. **Grounding-first** (the load-bearing question): the 016
endpoint-ceiling checks `origin`, which *includes* the scheme (`http://h` ≠ `https://h`), so a downgrade to a
declared `https://` origin may **already** be rejected — pin `https` only where a *real* gap remains, not
speculatively.

**DoR:**
- ✅ 015-02 review named the residual: config-integrity keys on `.host` (not scheme); `pinnedDispatchUrl`
  (override) preserves the chamber's scheme. **Grounded** (refinement-todo 013-03 / 015-02).
- ✅ `core/endpoint-ceiling.js` `originPath` drops the query but `origin` includes the scheme. **Grounded.**

**Acceptance Criteria:**

1. **Ground the ACTUAL coverage first (the frame-critique GROUNDED this — re-ranked candidates below).** The
   016 ceiling ALREADY rejects an `http://` downgrade wherever wired: `checkEndpointCeiling` compares
   `origin + pathname` and `origin` includes the scheme, so `http://h/p ∉ ["https://h/p"]` → HOLD (GA4 seam +
   alloy seam both wire it). So enumerate the candidate gaps in this order: **(a) [LEADING] a config-integrity
   (or allow-list) egress path with NO ceiling co-wired** — config-integrity keys on `.host` (scheme-blind),
   so a downgrade there is NOT caught; enumerate the shipped rig/adapter wiring to see if a ceiling-less path
   exists. **(b) [already-closed when a ceiling is co-wired] the config-integrity `override` re-derive** — the
   ceiling runs FIRST + holds the http original before override runs, and `pinnedDispatchUrl` only re-derives
   the tenant on an already-ceiling-granted (scheme-included) origin, so it cannot escape to http; confirm.
   **(c) [confirmed-covered] the ceiling-wired GA4 + alloy paths.** Record the true gap set — likely just (a),
   possibly empty. If empty, the "pin" collapses to a **confirmation + regression test**, not new gating.
2. **Pin `https` exactly where a gap remains — fail-closed, surfaced.** For each grounded gap (most likely a
   **config-integrity path with no ceiling co-wired** — pin scheme in `checkConfigIntegrity` itself so it is
   not scheme-blind even standalone, defense-in-depth), require `https` (or the page's
   own scheme if the page is `http` — do not force `https` on a localhost/http *test* origin, mirroring the
   014-01 cookie-attribute origin-awareness): a downgraded destination is **held** + a redacted 009-02 alert.
   Observable: an `http://` downgrade to the honest host is held (not forwarded); the honest `https://` path
   is unchanged.
3. **No regression.** The ceiling / config-integrity / the honest https egress paths stay green; localhost/http
   rigs (which legitimately use `http`) are not broken by an over-eager pin.

**DoD:**
- [x] AC1 grounding recorded (the true gap set — possibly empty). ACs 2–3 pass for each real gap. Tests:
      an `http://`-downgrade-held case at the grounded gap; the honest https path unchanged; a localhost/http
      rig not broken. Targeted sweep: `endpoint-ceiling*`, `wrapped-sdk-host`, `alloy-config-integrity`,
      any egress test.
- [ ] **Frame-critique** (the load-bearing premise: "there IS an uncovered http-downgrade gap" — the ceiling's
      origin check may already close it; do not add speculative gating) + compliance + craft + reconciliation.
- [x] Deviation log + reconciliation sweep; refinement-todo **015-02 protocol-blindness residual** marked
      RESOLVED (or, if grounding shows the ceiling already covers it, marked RESOLVED-BY-CONFIRMATION with the
      regression test).
- [x] **No live identifiers committed.**

**Anti-horizontal-phasing check:** a downgraded egress is held at the seal (or confirmed-already-held) — an
observable security change on the egress path; grounding-first keeps it honest (no speculative control).

### Deviation log

- **AC1 grounding — the true gap is real, and is exactly the ceiling-less path, not a speculative one.**
  Enumerated every shipped `createWrappedSdkHost` call site: the two browser rigs
  (`rig/alloy-core-host-harness.html`, `rig/alloy-coalescing-core-harness.html`) wire NEITHER
  `configIntegrity` NOR `endpointCeiling` at all today; `adapters/eds/index.js` (the only production
  adapter) wires `core/airlock.js`/GA4 only — alloy/`createWrappedSdkHost` has no production adapter
  wiring yet (unrelated to this slice; alloy is still rig/test-staged across the whole MVP3–4 arc, not a
  new finding). The test suite, however, DOES ship (and locks in as back-compat) a config-integrity path
  with no ceiling co-wired: `test/wrapped-sdk-host.test.js`'s 015-01 "config-integrity enforcement" and
  015-02 "override option" describe blocks, plus the 016-02 composition suite's own case (f) — its comment
  reads "015 standalone, unweakened" — all call `makeSpyingHost({ configIntegrity: PIN })` with no
  `endpointCeiling` key. `wrapped-sdk-host.js`'s own gate (`runConfigIntegrity = configIntegrity &&
  (!endpointCeiling || hostOf(m.url) === configIntegrity.pinnedHost)`) reduces to plain `configIntegrity`
  whenever `endpointCeiling` is falsy — confirming the code path runs standalone by design, not by
  omission. So: candidate (a) [LEADING] is the real, shipped gap; candidates (b)/(c) are confirmed CLOSED
  by an executable test added in this slice (the ceiling holds the downgrade first, config-integrity never
  runs). The fix in `core/config-integrity.js` closes (a) directly and is inert/no-op wherever a ceiling
  is already co-wired (defense-in-depth, per the task brief).
- **Scheme-match rule, and the default, was a design choice beyond the letter of the ACs — recorded for
  review.** The ACs asked for "https or the page's own scheme" without prescribing a mechanism. Chosen:
  an optional `pin.pinnedScheme` (normalized to `URL#protocol`'s own form), defaulting to `https:` when
  absent. Rationale: every pin shipped so far (`test/alloy-config-integrity.test.js`,
  `test/wrapped-sdk-host.test.js`) targets a real Adobe/GA host and never sets `pinnedScheme`, so
  defaulting to `https:` closes the gap for every existing caller with ZERO wiring changes (verified —
  all 64 pre-existing tests in the two files stayed green unmodified); a caller legitimately pointed at a
  localhost/http test origin opts out by declaring `pinnedScheme: "http:"` explicitly. This is a
  fail-closed-by-default posture (mirrors the module's existing "incomplete pin holds" discipline) rather
  than an opt-in scheme check — reviewers should confirm this default is the intended posture, not just
  the letter-matching one.
- **Two documentation-only touches beyond `core/config-integrity.js` itself, in scope as the same optional
  field's type documentation:** `core/wrapped-sdk-host.js`'s `configIntegrity` JSDoc param type gained
  `pinnedScheme?: string` (2 lines), and its module-docstring's config-integrity paragraph gained one
  clause naming the new deviation kind. No behavior in that file changed (confirmed: the override path's
  `pinnedDispatchUrl` call was already unconditional, so the scheme re-derive falls out of
  `config-integrity.js` alone).
- **The original 015-02 review's suggested fix location (ADR-0004's egress allow-list) is superseded by
  021-02's own grounding**, which points at `core/config-integrity.js` instead (spelled out in the slice's
  re-ranked AC1/AC2 and in the orchestrator's task brief) — not a deviation I introduced; `docs/
  refinement-todo.md`'s resolution note records the supersession explicitly so the history isn't lost.
- **No `docs/inbox.md` addition.** Nothing surfaced that isn't already a known, tracked, larger-scope fact
  (alloy's production-adapter wiring is a pre-existing, out-of-scope gap, not a new discovery) or already
  covered by this slice's own fix.

### Reconciliation sweep

- `core/config-integrity.js`: `checkConfigIntegrity` gains a scheme check (right after the host check,
  before the tenant checks) and `pinnedDispatchUrl` re-derives the scheme; new exported `schemeOf` helper
  mirrors `hostOf`; new internal `normalizeScheme` + `DEFAULT_PINNED_SCHEME`. No other file needed a
  behavioral change — `core/wrapped-sdk-host.js`'s seam wiring is untouched (doc-only edits, see above).
- Tests: `test/alloy-config-integrity.test.js` (+6 unit cases: standalone downgrade-held, honest-path
  regression, override-re-derives-https, localhost-http-pin-allowed, scheme-match-not-https-literal,
  override-re-derives-to-the-pin's-own-scheme) and `test/wrapped-sdk-host.test.js` (+5 seam-level cases:
  ceiling-less downgrade-held confirming AC1, ceiling-co-wired downgrade-already-held confirming AC1(c),
  override-re-derives-and-sends, honest-path-regression, localhost/http-pin-not-broken).
- `docs/refinement-todo.md`'s 013-03 entry: the "Second open residual — protocol-blindness (015-02
  review)" line now has a "Resolved — protocol-blindness / transport pin (spec 021-02, 2026-08-31)"
  follow-up appended directly after it (house convention — the original line is kept for history, not
  edited in place).
- Targeted regression sweep run (full suite hangs on a stale nested worktree per prior team memory, so
  targeted files only): `test/alloy-config-integrity.test.js`, `test/wrapped-sdk-host.test.js`,
  `test/endpoint-ceiling-seam.test.js`, `test/endpoint-ceiling.test.js`, `test/egress-confinement.test.js`
  — **88/88 pass**.
- No eslint config exists yet in this repo (021-03, the sibling slice that adds one, hasn't landed) —
  lint was not runnable; not a gap introduced by this slice.
- No live identifiers: synthetic UUIDs (`11111111…`/`99999999…`, already established as synthetic by the
  pre-existing test file's own header comment) and `localhost:5173` for the new origin-aware cases; the
  real Adobe hostname (`adobedc.demdex.net`) is public infra already used throughout the pre-existing,
  already-committed test suite, not a secret.
