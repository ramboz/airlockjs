---
status: REVIEWED
dependencies: []
last_verified:
arch_review: true  # the identity/cookie capability boundary — a security surface (ADR-0006 grant law).
frame_review: true  # RETARGETED at the frame-critique (needs-changes r1); the enforcement seams + name grammar are load-bearing + must be right.
claimed_by: claude/mvp6-e4550f
---

<!-- jig self-defining vocabulary (soft, forward-only); jig grounding (064-02/ADR-0020): probe/cite or mark assumptions. -->

## Slice 035-01 — name-scope + name-validate the live alloy cookie grant

**Goal:** make the ONE live connector cookie grant (alloy's) **least-privilege + injection-safe** (OQ13-4), enforced on
the **trusted host seam** on **both halves** of the boundary:
- **READ scope** — filter the boot **seed** to the connector's declared cookie names BEFORE it crosses into the worker,
  so the chamber's cache never holds (and alloy can never read) a cookie the connector didn't declare (closes the live
  whole-jar READ leak).
- **WRITE scope + name-validation** — as a `cookie-writeback` comes back from the untrusted chamber, **validate** the
  cookie name (RFC 6265 token; reject attribute-injection) and **scope** it to the declared names, so the chamber can
  only persist its own declared cookies to the real jar (closes the live unvalidated/unscoped WRITE surface).

Both enforce ADR-0006 `granted = declared ∩ allowed` for cookies, on the trusted side of the airlock (never trusting the
chamber to scope itself — 034-01).

**DoR:**
- ✅ Grounded (read + frame-critique-verified 2026-09-05): the READ path (`index.js:1077` seeds the whole
  `document.cookie` → `createSyncCookieCache` → `readSync` returns whole jar, `sync-cookie-cache.js:35-37`); the WRITE
  path (`writeSync` → `cookie-writeback` → `reconcileForBrokerJar`, `wrapped-sdk-host.js:466,565-574` → `reconcile` →
  `document.cookie` verbatim, `index.js:1017-1019`); alloy's declared names exact+prefix; `createCookieCapability` is
  host-side-only (NOT this slice's target); `CapabilityRequest.cookies: readonly string[]` (`capability.d.ts:33`);
  ADR-0006 grant law (`core/consent.js`).

**Design focus (seam mechanics — verified at the frame-critique re-run, 2026-09-05; the two threads below are the
primary implementer wiring):**
- **The declared cookie set is NOT reachable on main today** — `adapters/eds/index.js:38` imports only
  `ALLOY_INTERACT_ENDPOINT` from `connectors/alloy/connector.js`; `createAlloyConnector` + its
  `capabilities.cookies` manifest (`connector.js:67,113`) is instantiated **only in the worker**
  (`alloy-chamber.worker.js`). ⇒ AC3's single-source-of-truth needs a **new static export from `connector.js`**
  (mirroring `ALLOY_INTERACT_ENDPOINT` — e.g. `export const ALLOY_COOKIE_NAMES = [...]`) that BOTH the worker manifest
  and main-thread `bootAlloy` import, so the read-filter and the write-scope share one definition (not a hard-coded copy).
- **Write-seam threading — via `createWrappedSdkHost({…})` options, NOT `host.init`.** `host.init` (`wrapped-sdk-host.js:499-501`)
  only `postMessage`s `{type:"init", …}` INTO the (untrusted) worker — threading the scope set there would hand it to
  the chamber, inverting the trusted-seam principle. The `cookie-writeback` handler (`wrapped-sdk-host.js:464-471`)
  enforces off the `caps`/config **closure captured at `createWrappedSdkHost(...)` construction**, so `grantedCookieNames`
  must be passed as a `createWrappedSdkHost({…})` option alongside `configIntegrity`/`endpointCeiling`/`consent`
  (`index.js:1046-1063`), captured host-side by the handler's closure.
- **Exact-vs-prefix match rule** over a `readonly string[]` with no prefix marker (alloy declares both — `kndctr_`/`AMCV_`
  prefix, `demdex`/`s_ecid`/`com.adobe.alloy.getTld` exact). Ratify the convention (trailing `_` ⇒ prefix? explicit?)
  and pin it against the real declarations.
- **The name-validation grammar** — the RFC 6265 cookie-name token (no controls / separators `; = , SP HT ( ) < > @ …`);
  ratify the exact reject set + throw-vs-drop (fail-closed either way — no write on an invalid name).
- **Does a scoped seed still round-trip alloy?** Alloy reads only its own declared names + the `com.adobe.alloy.getTld`
  probe cookie it writes itself mid-session; a declared-name-scoped seed SHOULD preserve function — but this is the
  **no-regression hypothesis the slice PROVES** (the R-004 getTld round-trip + identity read/write under a scoped seed),
  not an assumption.
- **The `SecurityError`→graceful-null-identity rider** (OQ13-4): in-scope, or a documented follow-on? Frame-critique decides.

**Acceptance Criteria (ratified at the frame-critique):**

1. **READ scope — `scopeSeedCookies(jar, grantedNames)` filters the boot seed.** `bootAlloy` filters
   `document.cookie` to only the connector's granted names (exact + prefix, per the ratified rule) BEFORE
   `host.init({cookie: …})`, so `createSyncCookieCache` is seeded with ONLY granted cookies and `readSync()` can never
   surface a non-granted one. Test: a jar `"_ga=1; kndctr_org=2; sid=secret; demdex=3"` scoped to alloy's declared names
   seeds the cache with `kndctr_org`/`demdex` only — `_ga` and `sid` are **absent** (a chamber read returns null).
2. **WRITE scope + name-validation on the write-back seam.** As `cookie-writeback` is handled (host-side, trusted), the
   reconciled write is (a) **name-validated** against the RFC 6265 token — an invalid name (`"x; domain=evil.com"`,
   `"a\nSet-Cookie: b"`, `"x=y"`, leading/trailing space, control chars) is rejected fail-closed (never reaches
   `document.cookie`) + diagnosed; and (b) **name-scoped** — a write whose name is not in the granted set (e.g. the
   chamber posts `_ga=…` or `session=…`) is dropped + diagnosed, never written. A granted, valid name (`kndctr_org=…`,
   `s_ecid=…`) is written as before.
3. **The granted-name set is threaded from the connector's declared cookies (∩ allowlist, ADR-0006) to BOTH seams from
   ONE source of truth.** Since the manifest is worker-only today (see design focus), add a static `ALLOY_COOKIE_NAMES`
   export to `connectors/alloy/connector.js` (mirroring `ALLOY_INTERACT_ENDPOINT`), used by the worker manifest AND by
   main-thread `bootAlloy` — so the read-filter seed (AC1) and the write-back scope (AC2) derive from the same declared
   list, not a hard-coded copy. Test: the manifest's `capabilities.cookies` and the main-thread scope resolve to the
   identical set.
4. **Exact-vs-prefix semantics** grounded + tested against alloy's real manifest: `kndctr_`/`AMCV_` match by prefix
   (`kndctr_org`, `AMCV_1234`); `demdex`/`s_ecid`/`com.adobe.alloy.getTld` match exact (a stray `demdex_evil` is NOT
   granted by the `demdex` exact entry).
5. **No-regression proof — alloy still round-trips under the scoped grant.** With the seed scoped (AC1) + the write-back
   scoped/validated (AC2), alloy boots and the R-004 flow round-trips: the `com.adobe.alloy.getTld` probe
   (write-then-read within the cache) + the identity read/write of `kndctr_`/`AMCV_`/`s_ecid` all work (all are alloy's
   own declared names, so they survive both the seed filter and the write-back scope). GA4-ctx host sourcing
   (`index.js:391-395`, 004-03) is untouched (host-side, not a connector grant).
6. **Named follow-ons (documented, NOT this slice):** (a) a `{get,set}` name-scoping wrapper for
   `createCookieCapability` for whenever a connector is actually granted that host accessor (no connector uses it today);
   (b) the `SecurityError`→graceful-null-identity rider — per the frame-critique's ruling, either folded in with a test
   OR left a documented follow-on with the current fail-visible behavior retained; (c) the eventual `core/` home of the
   cookie backing (OQ13-j, adapter→core migration).

**DoD:** all ACs pass; **TDD red→green**; reviewed (compliance + craft + **arch** [`arch_review: true` — the
identity/cookie security boundary] + **frame-critique** [`frame_review: true`, re-run after this retarget]); deviation
log + reconciliation sweep; reconciliation review; `docs/refinement-todo.md` **OQ13-4 closed** (read-scope +
write-scope + name-validation landed for the live grant; the `createCookieCapability` wrapper carried as a named
follow-on); board synced.

### Deviation log

- **Grammar-vs-real-data conflict found during implementation (AMCV_'s `@`), resolved by fixing an unrealistic
  pre-existing test fixture, NOT by loosening the validator.** Wiring `grantedCookieNames` end-to-end broke the
  existing AC6 end-to-end round-trip test (`test/eds-boot-alloy.test.js`'s `RoundTripAlloyWorker`), which hard-codes a
  simulated ECID write-back named literally `AMCV_TEST@AdobeOrg`. The ratified RFC 6265/7230 token grammar (this
  slice's `isValidCookieName`) correctly rejects `@` — it is an RFC 7230 separator, explicitly one of AC2's named
  reject characters — so this pre-existing fixture value is not a valid cookie-name token. Investigated whether the
  grammar was wrong for this real vendor cookie: the codebase's own `rig/alloy-live-reprobe.mjs` grounds that the
  REAL `kndctr_` cookie name already transforms the org id's `@` to `_` (`kndctr_<orgNum>_AdobeOrg_*`) rather than
  carrying a literal `@` — i.e., real alloy avoids emitting an RFC-invalid cookie-name character, it does not rely on
  browsers' leniency. By the same convention, Adobe's real `AMCV_` cookie percent-encodes the org id's `@` as `%40`
  (`AMCV_<org>%40AdobeOrg`), not a literal `@`. The test fixture's literal `@` was a pre-035-01 simplification that
  predates any cookie-name-grammar scrutiny, not a considered claim about the real wire format. **Fix:** the fixture
  was corrected to `AMCV_TEST%40AdobeOrg` (matching alloy's real percent-encoded shape; `%`/`4`/`0` are all valid
  token characters) rather than carving an `@` exception into `isValidCookieName` — the full ratified reject set
  (including `@`) ships unweakened. No production code changed for this; only the one hard-coded test literal.
- Strengthened (not weakened) AC3's SSOT test: `manifest.capabilities.cookies` is asserted both `toEqual` AND
  `toBe` (same array reference) `ALLOY_COOKIE_NAMES` — a same-reference build (`cookies: ALLOY_COOKIE_NAMES`, not a
  parallel literal) is what the manifest now does, so the stronger assertion holds and rules out silent divergence by
  construction, not just by accident.

### Review dispositions (REVIEWED — compliance + craft PASS; arch needs-changes → fixed)

- **Compliance — PASS.** All 6 ACs met; tests non-vacuous (each AC assertion fails if the feature is removed; the
  WRITE-side no-regression is proven end-to-end through the real `boot`→`bootAlloy` seam with the gate active). One
  cosmetic nit (a control-char test's description claimed NUL) — turned out the test DID exercise NUL, but via a
  **raw NUL byte** in the source literal (invisible; it broke grep/Read/Edit tooling). Fixed to the portable `\0`
  escape (same NUL char, greppable source) — `test/cookie-scope.test.js:60`.
- **Craft — PASS.** Security primitives confirmed correct (RFC 7230 `tchar` whitelist rejecting a trailing `\n` via
  JS `$`-without-`m`; the exact-vs-prefix rule; the value-redacting fail-closed drop). One nit **declined with reason**:
  the "redundant `.trim()`" at `core/cookie-scope.js:110` is NOT redundant — the pair-level trim (`:108`) does not
  remove whitespace *between* the name and `=` (e.g. `"foo = bar"` → name slice `"foo "`), so the inner trim is
  load-bearing for that defensive case; left as-is. (Craft also logged the deliberate read=scope / write=scope+validate
  asymmetry as safe-by-design — the seed is never written back unvalidated; every write-back is independently
  token-validated. Noted, no action.)
- **Arch — needs-changes → all findings dispositioned:**
  - **(blocker) contract doc.** The exact-vs-prefix semantic is now load-bearing over the `CapabilityRequest.cookies`
    contract surface but was documented only at the enforcement sites. **Fixed:** documented the match semantic (+ the
    trailing-`_` convention's sharp edge) at the declaration site, `contracts/capability.d.ts:33` (doc-only; the type
    is unchanged, `contract-stability` + `contracts/validate.mjs` still green).
  - **(nit) import-free machine-guard.** `core/cookie-scope.js` justifies its `core/` home on import-freeness (like
    `sanitize-html.js`/`payload-governance.js`) but wasn't in the 018-01/019-01 guard. **Fixed:** added
    `"cookie-scope.js"` to `test/core-boundary.test.js`'s `it.each` (the invariant now fails fast on a future import).
  - **(follow-ons, recorded in refinement-todo OQ13-4, not closed here):** (iii) fail-open-by-omission — a future
    connector wiring `caps.cookies.reconcile` without `grantedCookieNames` reverts to unscoped writes → a **037 1.0-pin**
    input (couple the sink to a required scope set, or pin the coupling); (iv) the NAME-only scope leaves the cookie
    VALUE + `path`/`expires`/`max-age` unvalidated on the reconcile path (incl. the Overview-item-2 newline-in-value
    case) → a candidate hardening follow-on.
- **Arch re-run — PASS.** After the two fixes, a fresh arch pass confirmed both findings genuinely resolved, the
  trusted-side/default-deny/SSOT architecture intact, and no new defect introduced (the fixes were doc-only + test-only).

### Reconciliation sweep

| Artifact | Disposition | Rationale |
|----------|-------------|-----------|
| `core/cookie-scope.js` | `created` | The shared pure primitive: `isValidCookieName` (RFC 6265/7230 token), `matchesGrantedName` (exact-vs-prefix), `scopeSeedCookies` (READ filter). Import-free (machine-guarded), imported by both the core WRITE seam and the adapter READ seam. |
| `connectors/alloy/connector.js` | `updated` | Hoisted `export const ALLOY_COOKIE_NAMES` (the SSOT); the manifest's `capabilities.cookies` now references it by the same array reference (AC3). |
| `adapters/eds/index.js` | `updated` | READ seam: `bootAlloy` filters the boot seed through `scopeSeedCookies(…, ALLOY_COOKIE_NAMES)` before `host.init` (AC1); threads the same `ALLOY_COOKIE_NAMES` as `grantedCookieNames` into `createWrappedSdkHost` (AC2/AC3). |
| `core/wrapped-sdk-host.js` | `updated` | WRITE seam: opt-in `grantedCookieNames`; the `cookie-writeback` handler validates + scopes the name before `caps.cookies.reconcile`, dropping+diagnosing (`kind:"cookie-scope"`, name-only) on failure; `cookieScopeHeld` counter. `null` ⇒ byte-identical to pre-035-01. |
| `contracts/capability.d.ts` | `updated` | Doc-only (arch blocker fix): documented the exact-vs-prefix match semantic + RFC-token write-validation + the trailing-`_` sharp edge at the `CapabilityRequest.cookies` declaration site. Type unchanged (`contract-stability` green). |
| `test/cookie-scope.test.js` | `created` | 43 unit tests: the match rule (incl. AC4 `demdex_evil` negative), the validator (every AC2 separator + controls + NUL), `scopeSeedCookies` (AC1). |
| `test/wrapped-sdk-host.test.js` | `updated` | +11 tests: WRITE-seam scope/validation drops + granted-writes + injection vectors + `grantedCookieNames:null` back-compat. |
| `test/eds-boot-alloy.test.js` | `updated` | +4 tests: AC1/AC5 READ-seam scoping + the no-regression round-trip with the gate active. One pre-existing fixture literal corrected (`@`→`%40`, deviation log). |
| `test/alloy-connector.test.js` | `updated` | +2 tests: AC3 SSOT (`toEqual` + `toBe` same-reference). |
| `test/core-boundary.test.js` | `updated` | Arch nit fix: added `cookie-scope.js` to the import-free machine-guard `it.each`. |
| `docs/refinement-todo.md` | `updated` | OQ13-4 marked RESOLVED for the live grant (035-01); the four carried follow-ons recorded (incl. the two arch follow-ons → 037 1.0-pin + value-side residual). |
| `adapters/eds/cookies.js` | `no-op` | AC6 named follow-on — the host-only `createCookieCapability` `{get,set}` accessor is granted to no connector; deliberately untouched. |
| `docs/specs/README.md` (board) | `deferred` | Flips to DONE at the DONE transition (close-out). |

### Definition of Done — verification
- [x] All 6 ACs pass; **TDD red→green** (implementer wrote failing tests first per section, then implemented to green). `npm test`: **82 files, 1203 tests** (1142 baseline + 61: 60 impl + 1 import-free-guard case). `node build.mjs` OK; `node contracts/validate.mjs` all pass; `npm run lint` clean.
- [x] READ scope (seed filter) + WRITE scope+validation (write-back seam) both enforced host-side on the trusted seam; one SSOT (`ALLOY_COOKIE_NAMES`); opt-in null ⇒ byte-identical back-compat; alloy round-trips under the scoped grant (AC5).
- [x] Reviewed: **frame-critique** PASS (3 rounds: retarget → seam-grounding → pass); **compliance** PASS; **craft** PASS; **arch** PASS (re-run after the 1 blocker + 1 nit were fixed). Deviation log + review dispositions + reconciliation sweep produced.
- [x] `docs/refinement-todo.md` OQ13-4 RESOLVED for the live grant; carried follow-ons recorded (the `createCookieCapability` wrapper, the `SecurityError` rider, the fail-open coupling → 037, the value-side residual).
- [ ] Reconciliation review passed; board synced (pending — this close-out, then the reconciliation pass + DONE transition).
