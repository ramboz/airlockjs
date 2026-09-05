---
status: DRAFT
dependencies: []
last_verified:
arch_review: true  # the identity/cookie capability boundary — a security surface (ADR-0006 grant law).
frame_review: true  # the name-scope surfaces + the name-validation grammar are load-bearing + must be right.
---

<!-- jig self-defining vocabulary (soft, forward-only); jig grounding (064-02/ADR-0020): probe/cite or mark assumptions. -->

## Slice 035-01 — the name-scoped, name-validated cookie-grant wrapper

**Goal:** make a connector's cookie grant **least-privilege + injection-safe** (OQ13-4). A `scopeCookieCapability`
wrapper enforces **default-deny name-scope** (a connector reaches ONLY the cookie names it declared in
`CapabilityRequest.cookies` — exact + prefix; ADR-0006 `granted = declared ∩ allowed`), and every cookie **write
validates the name** (RFC 6265 cookie-name token) so a crafted name cannot inject cookie attributes. Applied at the
connector cookie-grant surface(s) the frame-critique grounds.

**DoR:**
- ✅ Grounded (read 2026-09-05): `createCookieCapability` whole-jar + name-verbatim-set (`adapters/eds/cookies.js`);
  host GA4-ctx use at `index.js:392`; the alloy chamber's seeded-cache caps + `reconcile` write-back
  (`alloy-chamber.worker.js:121-145`, `wrapped-sdk-host.js:466`); declarations exact+prefix; `CapabilityRequest.cookies`
  (`capability.d.ts:33`); ADR-0006 grant law (`core/consent.js`).

**Design focus for the frame-critique (grounds the load-bearing specifics — NOT asserted here):**
- **WHICH surfaces the wrapper scopes.** Candidates: (a) `createCookieCapability` (the host accessor); (b) the
  **seedCookie** the host hands the alloy chamber (scope it to the connector's declared names so the chamber's cache
  never holds the whole jar); (c) the **reconcile write-back** (`caps.cookies.reconcile` — a connector writes only its
  declared names, the written name validated). The frame-critique grounds which are real connector-grant surfaces vs
  host-only, and where the wrapper installs.
- **Exact-vs-prefix name matching.** Manifests declare both (`demdex`/`s_ecid` exact; `kndctr_`/`AMCV_`/`_ga_` prefix).
  Ratify the match rule (a trailing `_`/`.` = prefix? an explicit convention?) — `CapabilityRequest.cookies` is typed
  `readonly string[]` with no prefix marker, so the semantics must be pinned + grounded against the real declarations.
- **The name-validation grammar.** The RFC 6265 cookie-name token (no controls / separators `; = , SP HT ( ) < > @ …`).
  Ratify the exact reject set + whether an invalid name **throws** or **no-ops+diagnoses** (fail-closed either way — no write).
- **The `SecurityError`→graceful-null-identity rider** (OQ13-4): a cookie-blocked/sandboxed context currently degrades
  to a visible `__airlockBootFailed`. In-scope (degrade to null-identity) or a documented follow-on? Frame-critique decides.

**Acceptance Criteria (ratified at the frame-critique):**

1. **`scopeCookieCapability(cap, grantedNames)` — default-deny name-scope.** Wraps a cookie capability so `get`/`set`
   reach ONLY names matching `grantedNames` (exact + prefix, per the ratified rule). A non-granted name: `get` → `null`
   (as if absent), `set` → no-op + diagnose (never touches the jar). Test: granted `["_ga","_ga_"]` → `_ga`/`_ga_x`
   get/set OK, `kndctr_`/`session` DENIED (read + write).
2. **Name-validation on set (attribute-injection defense).** Every write validates the cookie name against the RFC 6265
   token; an invalid name is rejected fail-closed (no write) + diagnosed. Test the injection vectors: `"x; domain=evil.com"`,
   `"x=y"`, `"a\nSet-Cookie: b"`, a leading/trailing space, control chars — each REJECTED; a valid name written.
3. **Applied at the real connector-grant surface(s)** (per the frame-critique's grounding). At minimum: a connector's
   granted cookie cap is name-scoped to its `CapabilityRequest.cookies` (a connector granted `_ga` cannot read/write
   `kndctr_`), and the alloy write-back path validates + scopes the written name. Host-only GA4-ctx sourcing
   (`index.js:392`) keeps working (its `_ga`/`_ga_<stream>` names pass the scope + validation — no regression).
4. **Exact-vs-prefix semantics** grounded + tested against the real manifest declarations (alloy's `kndctr_` prefix +
   `demdex` exact; GA4's `_ga` exact + `_ga_` prefix).
5. **`SecurityError` handling** per the frame-critique's ruling — either graceful null-identity (a cookie-blocked
   context boots with a fresh ephemeral id instead of `__airlockBootFailed`) with a test, OR a documented follow-on
   with the current fail-visible behavior retained.
6. **Proof + no-regression.** A connector-scoped cap denies a non-granted name (read + write) and rejects an
   injection name; the granted-name flow works; GA4-ctx sourcing (004-03) + alloy's cookie write-back (012/033) stay
   green.

**DoD:** all ACs pass; **TDD red→green**; reviewed (compliance + craft + **arch** [`arch_review: true` — the
identity/cookie security boundary] + **frame-critique** [`frame_review: true`]); deviation log + reconciliation sweep;
reconciliation review; `docs/refinement-todo.md` **OQ13-4 closed** (name-scope + name-validation landed); board synced.
The eventual `core/` home of the cookie backing (OQ13-j, adapter→core migration) is a NAMED follow-on, not this slice.
