---
status: DRAFT
dependencies: []
last_verified:
arch_review: true  # the identity/cookie capability boundary — a security surface (ADR-0006 grant law).
frame_review: true  # RETARGETED at the frame-critique (needs-changes r1); the enforcement seams + name grammar are load-bearing + must be right.
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

**Design focus for the frame-critique (grounds the load-bearing specifics — NOT asserted here):**
- **Threading the granted-name set to the two host seams.** `bootAlloy` (`:1077`) has the alloy config entry (its
  declared `cookies` are reachable there); the `cookie-writeback` handler lives inside `createWrappedSdkHost` and today
  gets its config via `host.init`. Ground whether the granted set reaches the write-back handler already, or needs a new
  thread through `host.init({…, grantedCookieNames})`. **This wiring is the primary implementer grounding task.**
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
3. **The granted-name set is threaded from `CapabilityRequest.cookies` ∩ allowlist (ADR-0006)** to BOTH seams (per the
   frame-critique's grounding) — a single source of truth for the scope, derived from the alloy connector's declared
   cookies, not a hard-coded list.
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
