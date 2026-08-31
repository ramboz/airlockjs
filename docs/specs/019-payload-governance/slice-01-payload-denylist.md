---
status: DRAFT
dependencies: []
last_verified: 2026-08-30
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
   stripped:[] }`.
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
6. **Back-compat: no denylist → byte-unchanged.** A caller that wires no `payloadDenylist` (every current
   rig/testbed boot) gets the identity — `sendBatch` and the sync path behave byte-identically to before this
   slice (the governed copy equals the input when the denylist is empty; ideally the same object reference, to
   avoid a needless clone on the hot drain path). Observable: the no-denylist path allocates no governed copy
   / changes no bytes; existing airlock/egress-fastpath/eds-boot tests stay green.
7. **Surfaced (009-02), redacted — emitted by the impure caller, not the pure primitive.** The
   governance callers (`sendBatch` / the sync dispatcher) emit a redacted diagnostic from `governPayload`'s
   returned `stripped` names — `{ level, kind:"payload-governance", disposition:"stripped", field:<name>, … }`
   — **never the value** (the whole point is the value is sensitive), via the existing `diagnose` seam in
   `core/airlock.js`. `governPayload` itself touches no `diagnose` global (DoR "pure" preserved). Observable:
   one diagnostic per stripped field, carrying the field NAME only, never its value.

**DoD:**
- [ ] ACs 1–7 pass. Tests (targeted, node — this is pure/hermetic, NO DOM): `test/payload-governance.test.js`
      (governPayload strip semantics: name + dotted-path, non-mutation, default list, identity-when-empty,
      never-throws); an `airlock`-level test driving ALL THREE crossings (drain, flushNow, and the sync
      critical/unload path) asserting the denied field is absent from each `postMessage` batch / mapped body
      + present in `getState()` (non-mutation) + a redacted diagnostic; `eds-boot` (the adapter threads
      `payloadDenylist` + the no-denylist back-compat identity).
- [ ] **No regression** — targeted sweep: `payload-governance`, the airlock/egress core tests
      (`egress-fastpath` + any `core/airlock` test), `eds-boot`, `core-boundary` (new import-free `core/`
      module), and the GA4 map/oracle tests. _(Named files only — full vitest suite hangs on the stale
      worktree.)_
- [ ] Reviews: **frame-critique** (the load-bearing claim — governance at the two chokepoints covers all
      three crossings without a fourth-path hole, and the non-mutating copy preserves the local log — is the
      exact premise to attack) + compliance + craft + arch (a new `core/` governance primitive + the
      `sendBatch` extraction on the hot drain path + the sync-path placement) + reconciliation, recorded pass
      (independent Opus review of the Sonnet diffs).
- [ ] Deviation log + reconciliation sweep. Resolve **OQ11** (`adr.py resolve-todo`) + mark it in
      `docs/refinement-todo.md`; update `docs/releases/mvp3.md` (the payload-governance Include row →
      delivered **for GA4** — must NOT claim alloy input governed). Name the residuals: **alloy-INPUT
      governance** (bind the same `governPayload` at the separate `core/wrapped-sdk-host.js:265` crossing — a
      deferred second placement, 019-01 frame-critique; not free); alloy ambient-collection
      (read-minimization); the egress-side XDM strip (ADR-0012 Option B, deferred); an OQ3 allowlist
      tightening; value-level PII (ADR-0003).
- [ ] **No live identifiers committed** — synthetic denied fields only.

**Anti-horizontal-phasing check:** after this slice, a sensitive field a site `push()`es is stripped before
it can reach the untrusted connector or egress to the GA4 vendor — an end-to-end, observable change to what
bytes leave the page (the MP body has no `email`), at BOTH dispatch archetypes (worker cycle + sync unload),
while the local projection is untouched. Not internal plumbing: it is the host's payload-governance control,
enforced.
