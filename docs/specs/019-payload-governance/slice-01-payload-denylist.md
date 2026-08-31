---
status: DONE
dependencies: []
last_verified: 2026-08-31
frame_review: true
---

<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about
     runnable surfaces by probe first (run it / read source) or a citation. -->

## Slice 019-01 — input-side payload denylist governance (all crossings, GA4 E2E)

**Goal:** Implement ADR-0012 — a **host-owned, input-side sensitive-field denylist** that strips dangerous
`params` fields **before** they cross into the chamber, at **both** governance points (the async
`sendBatch` chokepoint covering `drain()`+`flushNow()`, and the sync dispatcher covering
`pushCritical`+`unloadFlush`), non-mutating, so a denied field never reaches the connector or the vendor.
Demonstrated E2E for GA4. Resolves OQ11.

**DoR:**
- ✅ [ADR-0012] Accepted — the input-side denylist model, the three-crossings/two-chokepoints census, the
  non-mutating obligation, and the GA4 input≈egress equivalence are all decided + grounded there.
- ✅ The three crossings + two chokepoints are grounded in `core/airlock.js` (drain 190-194, flushNow 310,
  the `criticalDispatchGated`→`createCriticalDispatcher`→`mapToMp` sync path 90-105/212/260 + core/egress.js).
  `flushNow` and `drain` share the identical `worker.postMessage({type:"events", batch})`. **Grounded.**
- ✅ `governPayload` is a NEW vendor-neutral primitive (like `core/consent.js` / `core/endpoint-ceiling.js` /
  `core/sanitize-html.js`): import-free, pure, node-unit-testable (no DOM/globals). **Grounded** (pattern).
- ✅ The adapter (`adapters/eds/index.js`) threads `createAirlock` options (endpoints/consent/egressPurposes/
  consentStrict); a `payloadDenylist` option wires here in parallel. **Grounded** (read).

**Acceptance Criteria:**

1. **`governPayload(params, denylist)` — non-mutating strip, identity when unconfigured, stays PURE (returns
   the stripped names for the caller to surface).** A new vendor-neutral `core/payload-governance.js` exports
   `governPayload(params, denylist)` returning **`{ governed, stripped }`** — `governed` is a copy of `params`
   with every denied field removed; `stripped` is the array of removed field names (so the impure caller can
   emit AC7's diagnostic without `governPayload` itself touching a `diagnose` global — the DoR "pure" property
   is preserved). **Never mutates** the input. An empty/absent `denylist` returns **`{ governed: params,
   stripped: [] }`** — the SAME `params` reference (identity — no clone on the hot drain path, AC6).
   **Non-mutation for NESTED / dotted paths is copy-on-write along the path** (clone only the objects on a
   denied dotted path — `governed.user = {...params.user}; delete governed.user.email` — leaving off-path
   subtrees structurally shared; NOT a full deep clone, NOT a shallow copy that would mutate the shared
   sub-object the local event log holds). Matching by field name + dotted path; case + exact-match semantics
   fixed + documented here. Never throws (malformed input fails safe to a best-effort copy). A conservative
   built-in **default** denylist (e.g. `password`, `cvv`, `ssn`, card-number-ish) is provided + host-extended,
   never solely relied on (defense-in-depth, CLAUDE.md security-MUST). Observable:
   `governPayload({a:1, password:"x"}, ["password"])` → `{ governed:{a:1}, stripped:["password"] }`; the input
   is unmutated (incl. a nested `{user:{email}}` case); `governPayload(p, [])` → `{ governed:p (same ref),
   stripped:[] }`; and when the denylist matches **nothing present**, `governPayload` also returns `p` (the
   SAME reference — the internal copy is discarded), so a clean payload is byte- *and* reference-identical.
   **Every case-variant** of a denied name at a matched level is stripped (both `password` and `Password`),
   not just the first (a value-leak fix, craft review).
2. **Point (A) — the async `sendBatch` chokepoint (drain + flushNow), with an empty-denylist short-circuit.**
   Extract the shared `worker.postMessage({type:"events", batch})` in `core/airlock.js` into a single
   `sendBatch(batch)` helper that **both** `drain()` and `flushNow()` route through. When a denylist is wired,
   it maps each batched descriptor to a governed copy (`{...d, params: governPayload(d.params, denylist).governed}`,
   **non-mutating** — the ring's descriptor is untouched) before posting. **When no denylist is wired (AC6),
   `sendBatch` short-circuits — it posts the original `batch` as-is**, allocating no governed copy / new
   descriptor wrappers (byte-unchanged on the hot INP-sensitive drain path). Observable: a denied field in a
   `push()`ed event is ABSENT from the batch the worker receives on the normal `drain()` cycle AND on a
   `flushNow()`; with no denylist, the posted batch is the original `ring.splice` array.
3. **Point (B) — the sync/unload dispatcher.** Govern the descriptor's `params` (via `governPayload`) BEFORE
   `mapToMp` in the synchronous critical path (`criticalDispatchGated` / `createCriticalDispatcher`), covering
   **both** `pushCritical` and the `unloadFlush` ring-tail — one placement, both call sites. Observable: a
   denied field in a `pushCritical()`ed event is ABSENT from the synchronously-mapped GA4 beacon body.
4. **Non-mutating: the local log / projection retain the raw field.** Governance strips only what CROSSES to
   a connector; the main-thread event log, the folded projection, and `getState()` are **unaffected** (they
   are local, never egressed). Observable: after a `push({event, password:"x"})`, `getState()` still reflects
   the raw event, but no crossing (worker batch or sync map) carries `password`.
5. **E2E for GA4 — a denied field is absent from the MP body at every crossing.** With a `payloadDenylist`
   wired through `adapters/eds/index.js`, a `push({event:"cta_engage", email:"a@b.c"})` (email denied) → the
   GA4 MP body's `events[0].params` has **no** `email` on the worker path; a `flushNow()` of a denied-field
   event likewise; a `pushCritical({event:"page_view", email:"a@b.c"})` → the sync beacon body has no
   `email`. A benign field (`link_text`) passes through unchanged. Observable end-to-end (the mapped body,
   not just `governPayload`).
6. **Back-compat: a CLEAN payload is byte-unchanged (the built-in default is ALWAYS-ON — maintainer
   decision).** `DEFAULT_DENYLIST` strips even when the host wires no `payloadDenylist`, so back-compat is a
   **content** property, not "no governance runs": an event carrying **none** of the denied fields (every
   current rig/testbed event — none push a `password`/`ssn`/etc. field) is byte-identical *and*
   reference-identical after governance (`governPayload` returns the original `params` reference when nothing
   is stripped), and the diagnostic fires only when a denied field is actually present. Observable: existing
   airlock/egress-fastpath/eds-boot tests stay green (their events are clean); a NEW test confirms an
   unconfigured boot DOES strip a `password` field (the always-on behaviour — the whole point).
7. **Surfaced (009-02), redacted — emitted by the impure caller, not the pure primitive.** The
   governance callers (`sendBatch` / the sync dispatcher) emit a redacted diagnostic from `governPayload`'s
   returned `stripped` names — `{ level, kind:"payload-governance", disposition:"stripped", field:<name>, … }`
   — **never the value** (the whole point is the value is sensitive), via the existing `diagnose` seam in
   `core/airlock.js`. `governPayload` itself touches no `diagnose` global (DoR "pure" preserved). Observable:
   one diagnostic per stripped field, carrying the field NAME only, never its value.

**DoD:**
- [x] ACs 1–7 pass. `test/payload-governance.test.js` (strip semantics incl. every-case-variant + nested COW,
      non-mutation, default list, identity-when-empty + identity-when-nothing-matches, never-throws);
      `test/payload-governance-seam.test.js` (ALL THREE crossings — drain, flushNow, sync — denied field
      absent from each `postMessage` batch / real mapped body, raw field kept in `getState()`, redacted
      diagnostic, always-on strips even unconfigured); `eds-boot` (adapter threads `payloadDenylist`).
- [x] **No regression** — 266 tests across 26 files green (targeted sweep, named files only).
- [x] Reviews: **frame-critique** (pass) + compliance (pass) + craft (needs-changes → the case-variant
      value-leak BLOCKER fixed → verified) + arch (pass) + reconciliation, recorded (independent Opus review
      of the Sonnet diffs). The off-by-default posture arch flagged for sign-off was **escalated to the
      maintainer → ALWAYS-ON** (below).
- [x] Deviation log + reconciliation sweep (below). OQ11 already RESOLVED by ADR-0012 (2026-08-30) — 019-01
      **implements** it; `docs/refinement-todo.md` gains the Implemented note; `docs/releases/mvp3.md`
      payload-governance row → **delivered for GA4** (NOT alloy); residuals named; ADR-0012 §3
      "governed for free" annotated with the scope correction.
- [x] **No live identifiers committed** — synthetic denied fields only.

### Deviation log

- **ALWAYS-ON built-in default (maintainer decision 2026-08-31 — the one design fork surfaced for sign-off).**
  Arch flagged that off-by-default gives zero PII protection to the footgun population (the *unconfigured*
  deployment), unlike 015/016/017's *structural* gates. Escalated; the maintainer chose **always-on** for the
  tiny high-confidence built-in set. Implemented: `effectiveDenylist = [...DEFAULT_DENYLIST, ...payloadDenylist]`
  (no longer gated on the host opting in). AC6 back-compat reframed from "no governance runs" to a **content**
  property: a payload with none of the denied fields is byte- + reference-identical (`governPayload` returns
  the original reference when nothing is stripped — added so the always-on default keeps no needless clone on
  the hot path). Tests updated (the two "short-circuit / default-inactive" tests flipped to "clean payload
  unchanged" + "unconfigured strips a password").
- **BLOCKER fixed (craft review) — strip EVERY case-variant, not just the first.** `findKeyCaseInsensitive`
  returned only the first match, so `params` with both `password` AND `Password` leaked the second's value.
  Fixed with `matchingKeysCaseInsensitive` (deletes all case-variants at the matched top-level + nested-leaf);
  new tests cover both and would fail the old code.
- **Fail-open is surfaced, not silent (arch+craft).** `governPayload`'s catch now returns `error: true`; the
  caller (`governParams`) emits an error-level diagnostic — a security control skipping governance must not do
  so invisibly.
- **Match semantics pinned** (bare = top-level only, dotted = nested leaf, case-insensitive, exact-not-substring)
  — ADR-0012 explicitly delegated this to spec 019; documented in the module docstring. (`passwordConfirm` not
  stripped by `password` — hosts extend the list; documented, intended.)
- **Default merge lives in the caller** (`core/airlock.js`), not `governPayload` (which strips exactly what
  it's handed — keeps the primitive vendor-neutral + opinion-free).
- **Dead assertion fixed** (`expect(() => result).not.toThrow;` → an invoked `.not.toThrow()` around the real
  call — compliance nit).
- **Not done (out of scope / deferred):** alloy-INPUT governance (separate `core/wrapped-sdk-host.js` seam —
  `wrapped-sdk-host.js` left untouched, a named residual); a precomputed lowercased-key set micro-opt (arch
  nit, negligible on the idle/teardown paths); a `__proto__`/`constructor` path-segment guard (pathological,
  host-trusted config, out of threat model — noted by craft).

### Reconciliation sweep

- **Surface:** NEW `core/payload-governance.js` (vendor-neutral, import-free, no-global — the core-boundary
  guard extended via `it.each` to cover it); `governParams` + `sendBatch` extraction + sync-path governance in
  `core/airlock.js`; `payloadDenylist` threaded through `adapters/eds/index.js`; the two new test files. All
  additive / a new host-policy control — the granted egress paths for a clean payload are byte-unchanged.
- **Boundaries:** no `core/→rig/` breach; `core/payload-governance.js` is import-free (machine-guarded);
  `core/wrapped-sdk-host.js` (alloy input) deliberately untouched.
- **Reviews recorded:** frame-critique + compliance + craft (needs-changes→fixed) + arch + reconciliation — all
  pass, under `reviews/`.
- **Docs:** `docs/refinement-todo.md` OQ11 Implemented-note added (residuals a–f); `docs/releases/mvp3.md`
  payload-governance row → delivered for GA4; ADR-0012 §3 annotated with the alloy-scope correction. No inbox
  items.
- **Named residuals (tracked):** alloy-input governance (deferred 2nd placement), alloy ambient-collection
  (read-minimization), egress-side XDM strip (ADR-0012 Option B), OQ3 allowlist tightening, value-level PII
  (ADR-0003), and the stale `contracts/connector.d.ts:39-44` OQ11 pass-through comment.

**Anti-horizontal-phasing check:** after this slice, a sensitive field a site `push()`es is stripped before
it can reach the untrusted connector or egress to the GA4 vendor — an end-to-end, observable change to what
bytes leave the page (the MP body has no `email`), at BOTH dispatch archetypes (worker cycle + sync unload),
while the local projection is untouched. Not internal plumbing: it is the host's payload-governance control,
enforced.
