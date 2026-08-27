---
status: RECONCILED
dependencies: [004-02, adr-0003]
last_verified: 2026-08-26
arch_review: true
frame_review: true
claimed_by: claude/airlock-build-continue-f9ad85
---

## Slice 004-03 — GA4 ctx from `_ga` cookies (mediated cookie capability)

**Goal:** the orchestrator sources the GA4 identity context on the **main thread** —
`client_id` from the `_ga` cookie (defensive parse; generate + persist a first-party
one when absent), `session_id` from `_ga_<stream>` — and hands the connector the
**minimal ctx snapshot** (ADR-0003), so a real MP payload carries a real, GA-continuous
`client_id` / `session_id`.

## Assumptions

- **The `_ga` / `_ga_<stream>` cookie grammar is community-derived and NOT part of
  the pinned contract** ([ga4-mp.md](../../../contracts/ga4-mp.md) § Provenance:
  "deliberately excluded"; it "has already changed (GS1→GS2)"). The shapes the parser
  targets are therefore *assumptions encoded as test fixtures*, not Google-guaranteed
  facts: `_ga=GA1.<domain-depth>.<random>.<unix-seconds>` → `client_id` is the **last
  two dotted segments** (robust to prefix variation); `_ga_<STREAM>` v1
  `GS1.1.<session_id>.<session_number>…` (dot-separated) and v2
  `GS2.1.s<session_id>$o<n>$…` (`$`-separated, `s`-prefixed session field). Any shape
  violation parses to `null` and takes the documented fallback — never a throw.
- **Host-side sourcing is the MVP1 identity flow.** The adapter/orchestrator builds
  the ctx on the main thread and passes the **minimal snapshot** (ADR-0003) into the
  runtime; the connector does **not** itself call `GrantedCapabilities.cookies` in
  MVP1. Grounded: [connectors/ga4/map.js](../../../connectors/ga4/map.js) JSDoc pins
  "ctx sourced by the host … via the mediated cookie capability", and
  [capability.d.ts](../../../contracts/capability.d.ts) frames the async get/set as
  "backed by the orchestrator on the main thread" serving MVP1's single first-party
  connector. This slice implements the **host side** of that capability (a mediated
  get/set the adapter uses), keeping the chamber cookie-free; a connector-requested
  grant flow stays pinned-but-unexercised until a connector needs it.
- **Session fallback — and on a gtag-free site it is the steady state, not the
  edge.** When `_ga_<stream>` is absent/unparseable, fall back to a **per-page
  generated session id** (unix-seconds at boot) rather than dropping events —
  session_id is required for standard-report attribution (ga4-mp.md), and a fresh
  session beats silent loss. On the product's own headline deployment (pure airlock,
  no gtag) nothing ever writes `_ga_<stream>` (this slice persists only client_id),
  so **every page navigation of an MPA mints a fresh session** until a
  session-persistence decision is taken — events still attribute to *a* session;
  cross-page session continuity holds only where gtag coexists or previously ran.
  [Declared limitation, frame-critique 004-03; session-cookie persistence is a
  deliberate later decision, not silently in scope here.]
- **Generated client_id is written AS `_ga` in GA1 format**
  (`GA1.1.<random>.<unix-seconds>`), not an airlock-owned cookie name — so on-page
  GA / later gtag coexistence reads the same identity in both directions (the
  continuity ga4-mp.md's "reuse the `_ga` cookie" clause exists for). [Deliberate
  compatibility choice, pinned at frame-critique; the write is defensive — never
  overwrite an existing `_ga`.]
- **Consent: the identity-cookie write is NOT gated by the seal.** The seal gates
  **egress** (AD-9 / capability.d.ts); nothing in MVP1 gates the first-party
  identity write on consent. Acceptable on the consent-free testbed; a
  privacy-positioned deployment will want the write behind the consent state too —
  declared here rather than implied, registered as
  [OQ13](../../refinement-todo.md) item 1 (the arch review caught the original
  "OQ7/consent scope" pointer dangling — OQ7 is inspector scope).
- **Cookie persistence:** `document.cookie` write with `max-age` ≈ 2 years,
  `path=/`, `SameSite=Lax`. Browsers cap the effective lifetime — **the honest
  continuity bound is Safari ITP's ~7 days for script-written cookies** (Chrome
  ~400 days) — acceptable: caps shorten continuity, never break correctness.
  [Browser-side behavior; not probed.]

**DoR:**
- ✅ 004-02 done (runtime boots + captures on the real page).

**Acceptance Criteria:**

1. **Defensive `_ga` / `_ga_<stream>` parse.** A pure parser extracts `client_id`
   from `_ga` (the cookie's last two dotted segments `<random>.<unix-seconds>`,
   tolerant of prefix/domain-depth variation) and `session_id` from `_ga_<stream>`
   (tolerating the GS1→GS2 grammar drift), degrading to `null` on malformed/absent
   input — never a throw (ga4-mp.md § `client_id` & `session_id`). Unit-tested
   against real-shaped (GA1, GS1, GS2) and malformed inputs.
2. **Persist when absent.** When no `_ga` client_id is present, the orchestrator
   generates one and persists it via the mediated cookie capability
   (`GrantedCapabilities.cookies.set`, async, main-thread — [capability.d.ts](../../../contracts/capability.d.ts)),
   written **as `_ga` in GA1 format** (see Assumptions) and never overwriting an
   existing `_ga`.
3. **`session_id` from `_ga_<stream>`.** Extracted and passed as `ctx.sessionId`;
   absent/malformed degrades to a documented fallback, not a throw.
4. **Minimal ctx only (ADR-0003).** Only `client_id` / `session_id` (+ existing
   `engagement_time_msec` / optional consent) cross to the connector — no raw cookie
   string, no ambient identity. The connector requests no `document.cookie` access.
5. **Real payload conforms.** The MP payload built from the cookie-sourced ctx passes
   `ga4_mp_conformance` (schema + a golden fixture for the UC-2 event).

**DoD:**
- [x] ACs 1–5 pass; unit tests cover the `_ga`/`_ga_<stream>` parser (valid, GS2,
      malformed, absent) and the generate-and-persist path (mocked cookie
      capability). 58/58 vitest (57 at review + the reconciliation-round
      empty-`_ga=` pin); `npm run build` + `npm run rig:bundle` (real page:
      `ga_cookie_persisted` + `identity_flowed` gate the verdict) + `npm run rig:csp`
      all green.
- [x] Each new test shown capable of failing (red-first at implementation, plus
      mutation checks: parser→raw-value, overwrite-guard, samesite, ctx-key-leak,
      and the reconciliation-round decode-fallback pins — all shown red then
      restored green).
- [x] Reviewed by `reviewer` subagent; implementation review passed.
      (Frame-critique PASS pre-implementation; compliance PASS; craft PASS; arch
      PASS — all first-round. Evidence in `reviews/slice-03-*.md`.)
- [x] Deviation log + reconciliation sweep (below); refinement-todo gained OQ13
      (identity-cookie follow-ups) and the slice's consent pointer was re-homed
      from the dangling "OQ7" to OQ13.

**Anti-horizontal-phasing check:** after this slice, a real interaction on the page
produces an MP payload with a real, GA-continuous `client_id` / `session_id` —
analytics that would actually attribute to a session, sourced without gtag.

### Deviation log

1. **`sourceGa4Ctx` takes one option beyond the sketched `{ cookies, now, random }`:
   `cookieString`** (the raw `document.cookie`), used only for `_ga_<stream>`
   discovery — the pinned capability shape has no enumeration and the stream suffix
   is unknowable a priori. The raw string never enters the returned ctx (asserted by
   exact-keys tests at the sourcing function AND on the actual worker init message).
   Whether the capability grows `list()` or discovery stays a host duty → OQ13.
2. **Malformed-but-present `_ga` (case the ACs didn't spell out):** literal reading
   of never-overwrite — generate a per-page clientId but do NOT persist over the
   malformed value (it may be a newer grammar another tag understands). Explicitly
   tested. Same interpretation for an existing-but-empty `_ga=`: counts as existing,
   never overwritten (yields a fresh per-page client_id until the cookie is
   cleared) — pinned by a direct test at the reconciliation round (the
   reconciliation reviewer asked for the mutation-proof case).
3. **Multi-stream `_ga_*` pick is first-in-jar-order** — an implementation-level
   policy the slice text was silent on; documented in code, registered in OQ13.
4. **Two boot tests could not be red-first** (the old STATIC_CTX coincidentally had
   exactly the minimal keys); their capable-of-failing proof is the ctx-key-leak
   mutation instead (3 red).
5. **`maxAge` "≈2y" pinned as exactly 63072000 s** (GA's own default), asserted in
   tests and exported as `GA_COOKIE_MAX_AGE_S`.
6. **Review nits folded during reconciliation:** decode-fallback branch pinned by
   tests in BOTH cookie modules (mutation-verified: fallback→rethrow = 2 red);
   `set()` now guards a missing document symmetrically with `get()` (no-op, never
   throw — the pre-fix code threw, so the new test was genuinely red);
   grant-readiness caveat added to `createCookieCapability`'s JSDoc (raw whole-jar
   backing; name-scope + name-validate before any connector grant; eventual home
   `core/`). Unfolded (accepted, registered in OQ13): SecurityError on
   cookie-blocked contexts degrades to a visible boot failure rather than a
   null-identity boot (OQ13 item 4 clause — the reconciliation reviewer caught the
   first draft of this line claiming a registration that didn't yet exist);
   pair-scan loop duplication (rule-of-three trigger, OQ13 item 5).
7. **Deferred decisions registered:** consent-gating the identity write and
   session-cookie persistence had no register home (the arch review caught the
   "OQ7/consent scope" pointer dangling) — OQ13 created with triggers; the slice
   Assumption re-pointed, and the same dangling "parked with OQ7" pointer in the
   shipped `connectors/ga4/cookies.js` JSDoc was fixed at the reconciliation round
   (reviewer catch). The arch review's ADR-0003-declaration open question is also
   registered (OQ13 item 4 clause).
8. **Unlogged-then-logged (reviewer catch): `bootEdsAnalytics` changed sync →
   async** — a signature change to 004-02's landed public surface (it now awaits
   `sourceGa4Ctx` before `createAirlock`), with the 004-02 testbed hook in
   `scripts.js` updated to `await` it (boot failure/rejection still lands in
   `__airlockBootFailed`; `rec('airlock:init')` still fires only after a
   successful boot). Lazy-phase only — no interaction-path or eager-window cost.

### Reconciliation sweep

| Artifact | Disposition | Rationale |
|----------|-------------|-----------|
| `docs/specs/README.md` | `deferred` | Regen is the DONE-transition landing step (`workflow.py status-board`). |
| `docs/product-vision.md` | `no-op` | No scope drift — implements the pinned identity flow (ga4-mp.md § client_id). |
| `docs/architecture.md` | `no-op` | Boundaries honored: vendor grammar pure in `connectors/ga4/`, DOM access in the adapter, `core/`/`contracts/` untouched; chamber stays cookie-free (ADR-0003). The accessor's eventual `core/` home is an OQ13 question, not current drift. |
| `contracts/capability.d.ts` | `no-op` | Implemented (host half), not amended; the `list()` question is OQ13. |
| `docs/refinement-todo.md` | `updated` | OQ13 added (5 items + triggers); dangling OQ7 pointer fixed. |
| `docs/decisions/lightweight-decisions.md` | `no-op` | No new settled non-spec decision (the GA1-write choice is pinned in the slice Assumptions + frame-critique record, which is its home). |
| `docs/inbox.md` | `no-op` | Nothing parked there resolved by this slice. |
| Primer surfaces (`CLAUDE.md`) | `no-op` | Spec 004 still in flight (004-04 DRAFT); no close-out compression due. |
| `docs/memory/**` | `no-op` | The GS1/GS2 grammar knowledge lives in the parser JSDoc + tests (fixtures-as-assumptions), its right home. |
| ADR index | `no-op` | No load-bearing decision with rejected alternatives beyond what the slice Assumptions + frame-critique record carry. |
