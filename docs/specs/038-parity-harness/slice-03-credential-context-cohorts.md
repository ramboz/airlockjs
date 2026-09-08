---
status: RECONCILED
dependencies: [038-01, adr-0018, adr-0020]
last_verified: 2026-09-08
frame_review: true
arch_review: true
claimed_by: claude/mvp7-db84f1
---

## Slice 038-03 — credential/cookie transport-parity report (feeds E10)

**Goal:** Produce the **per-vendor, per-cohort transport-parity ledger** ADR-0018 **E10** consumes: for each vendor and
each cohort (third-party-cookies-**allowed** vs **blocked**), which attribution airlock **drops today** and **who owns
closing it** — split into the **two** gap classes airlock has: the **cross-site cookie** (`fr`/`IDE`, owner **E10**) and
the **first-party identity** airlock doesn't yet emit (`_fbp`/`fbc`, owner the **chamber cookie-capability** follow-up).
The harness derives/reports the gaps; the credentialed-transport decision is E10's (ADR-0020 commitment 3, "made
visible, never absorbed").

**Not a `diffParity` extension.** 038-01/02 diff beacon *field-sets*. The cross-site cookie is **not a beacon field** —
it rides the browser's credentialed request, is opaque to page JS, absent from the beacon URL. So this slice is a
**report generator** whose value is the **honest per-cohort gap ledger** — in particular it surfaces the **blocked-cohort
first-party-identity drop** that is *not* trivially readable off ADR-0020.

**DoR:**
- ✅ 038-01/02 done — the capture front-end + report + each vendor's `ParityDescriptor` (Meta, GA4) exist.
- ✅ Grounded: airlock egress carries **no cross-site cookies** (`core/airlock.js` `fetchInit` sets only
  `method`/`body`/`keepalive` — no `credentials`/`mode`), so any cross-site-cookie attribution is dropped by construction.
- ✅ Grounded per vendor (**airlock's first-party-emit status is READ from the descriptor `gapMap`, not documented**):
  airlock **does not** emit Meta `_fbp`/`fbc` today — owned in `rig/parity/descriptors/meta.js` `gapMap` ("chamber
  cookie-capability follow-up"; `connectors/pixel/vendors/meta.js:11-13`); airlock **does** emit GA4 `cid` (read from the
  first-party `_ga` cookie via `sourceGa4Ctx`, 038-02) — so GA4 has **no** first-party-identity drop.

**Acceptance Criteria:**

1. **Per-vendor `transport` declaration.** Each vendor descriptor gains a `transport` declaration naming its two
   attribution transports: the **cross-site-cookie** paths — a **third-party** cookie on the *vendor's* own domain (Meta
   `fr`; DoubleClick `IDE`), owner **E10**, documented because the cookie is opaque to page JS + absent from the beacon
   URL — and the **first-party** identity paths (Meta `_fbp`/`fbc`; Google `gclid`/`_gcl_*` — first-party cookies gtag
   sets on the *publisher's* origin, so owner **cookie-capability, not E10**; GA4 `cid` via `_ga`). The E10-vs-cookie-cap
   owner is fixed by *where the cookie lives* (vendor origin = cross-site = E10; publisher origin = first-party =
   cookie-cap), not by vendor. **Cookie NAMES / presence only — never values** (R5).
2. **Per-cohort gap classification (reasoned from the declaration + the grounded `gapMap`/egress facts).** For each
   vendor × cohort, the ledger reports each gap class and its owner:
   - **3p-cookies-allowed:** the vendor cross-site cookie rides the container's request, airlock's cookieless egress
     **drops it** → **cross-site-cookie gap (owner E10)**; AND any first-party identity airlock does not emit is **also
     dropped** → **first-party-identity gap (owner cookie-capability)** where the descriptor `gapMap` owns it.
   - **blocked:** the cross-site cookie is absent from the container too (browser drops it) → **no cross-site gap**; BUT
     the container falls back to first-party identity, and where airlock does not emit it (Meta `_fbp`/`fbc`), airlock
     **still drops it** → the **first-party-identity gap persists (owner cookie-capability)**. **Never "no gap" by
     default** — a vendor is gap-free on a cohort only when airlock emits every attribution transport the container uses
     there (e.g. GA4, whose `cid` airlock reads from `_ga`).
3. **Each gap flagged with its distinct owner.** The report distinguishes the **E10** transport question (re-attach a
   purpose-gated credentialed cross-site transport) from the **cookie-capability** follow-up (emit the vendor's
   first-party identity), never conflating them — so the E10 author sees exactly which gaps are E10's to decide vs
   already-owned elsewhere.
4. **Output is the E10 input ledger.** A per-vendor × per-cohort table (Markdown/JSON): each gap class, present/absent per
   cohort, with its owner and airlock's cookieless-egress consequence. No live identifiers. The contrast is the payload —
   Meta (drops `fr` on allowed + `_fbp`/`fbc` on both) vs GA4 (no cross-site cookie; `cid` maps → gap-free both cohorts).

**DoD:**
- [x] All ACs pass; full suite green.
- [x] Coverage: **Meta** → cross-site-cookie gap (E10) on allowed only, **first-party-identity gap (cookie-capability) on
      BOTH cohorts** (the frame-critique's correction — blocked is NOT "no gap"); **GA4** → gap-free on both cohorts
      (`cid` emitted from `_ga`, no cross-site cookie). A test asserts the blocked-cohort Meta cell is a gap, not green.
- [x] Each new test shown to fail when its feature is removed.
- [x] Reviewed by `reviewer` — compliance + craft + **arch** (`arch_review: true`: the `transport` descriptor field +
      the report generator extend the harness's public surface).
- [x] Deviation log + reconciliation sweep produced.

## Assumptions

- **Two distinct owners, not one** (the frame-critique's correction): the cross-site cookie is **E10's**; the first-party
  identity airlock doesn't yet emit is the **cookie-capability follow-up's**. Collapsing them (or reading the blocked
  cohort as "no gap") false-greens a real open gap and mis-scopes the E10 security-boundary decision — the false-shim
  ADR-0020 forbids. airlock's per-vendor first-party-emit status is **grounded** (read from the descriptor `gapMap`), not
  assumed. (Why `frame_review: true`.)
- **Cross-site-cookie dependence is DOCUMENTED, not live-observed.** It cannot be read from a Lighthouse
  `network-requests` log (no request `Cookie` headers) nor page JS (third-party cookies are opaque); it is declared per
  vendor from vendor docs (Meta `fr`, DoubleClick `IDE`). **Live observation** (did a *specific* request carry it) needs
  CDP `Network.requestWillBeSentExtraInfo` and is a **future, R5-gated enhancement**. The ledger's value is not the
  documented facts (largely in ADR-0020) but the **honest per-cohort gap arithmetic** over them — which surfaces the
  blocked-cohort first-party drop.

**Anti-horizontal-phasing check:** After this slice an E10 ADR author has a per-vendor × per-cohort ledger that
distinguishes the **E10 cross-site-cookie gap** from the **cookie-capability first-party gap**, and correctly shows the
blocked cohort still carrying a first-party-identity gap for vendors like Meta — the honest, non-false-green input the
credentialed-transport decision is made on.

### Deviation log (after reconciliation)

- **No AC-level deviation.** All four ACs shipped as written: each descriptor gained a `transport`
  declaration (AC1); `buildVendorRow` classifies per vendor × cohort off the declaration + the
  grounded `gapMap` (AC2/AC3); the JSON+Markdown ledger is the E10 input with no live identifiers
  (AC4). The keystone blocked-cohort Meta cell is asserted a gap, not green (DoD coverage).
- **`transport` implemented as an OPTIONAL typedef property** on `ParityDescriptor`
  (`rig/parity/oracle.js:39-43`), structurally invisible to `diffParity` (the cross-site cookie is
  not a beacon field) and read only by `rig/parity/transport-report.js` — exactly the frame-critique
  design, no `diffParity` body change.
- **One reconciliation-time strengthening beyond the slice's letter (arch-review):** a completeness
  guard asserting every `transport.firstPartyIdentity` field is also an `attributionField`
  (`transport-report.js`). It has **no behavioural effect on the two shipped descriptors** (Meta
  `_fbp`/`fbc`, GA4 `cid` already satisfy it) — it fails loud only if a *future* descriptor would
  introduce a first-party field invisible to both `diffParity` and the gap-map inference. Covered by a
  committed regression test (`test/parity-transport.test.js`, the `_orphan` case), **mutation-verified**:
  removing the guard reds exactly that one test and nothing else — the DoD's "shown to fail when the
  feature is removed."
- **One deliberate out-of-strict-scope doc fix:** `descriptors/ga4.js:27-30`'s comment claimed the
  `SYNTHETIC_META_PIXEL_ID` "convention" lives in `descriptors/meta.js`; it lives in the **connector**
  (`connectors/pixel/vendors/meta.js:30` is the sole definition — every other reference, including
  `rig/parity/redact.js`'s re-export, imports it from there; no descriptor defines it). Pre-existing
  038-02 drift, corrected here as a one-line in-passing fix; no code change.

### Reconciliation sweep

Review verdicts: **compliance / craft / arch all `pass`** (0 blockers). Nit disposition:

- **arch [nit] — completeness guard** (`transport-report.js:113` inference leans on an implicit
  `firstPartyIdentity ⊆ attributionFields` invariant): **FOLDED** — explicit fail-loud assertion added,
  backed by a committed throw test (`test/parity-transport.test.js`, the `_orphan` case).
  Mutation-verified: removing the guard reds exactly that one test (the sibling missing-`transport`
  throw test cannot catch this case).
- **craft [nit] — renderer recomputed `gaps.length === 0`** instead of the carried `cell.gapFree`:
  **FOLDED** — renderer now reads `cell.gapFree`; `gapFree` is computed once, in the producer.
- **craft [nit] — cohort names duplicated** (COHORTS const + `buildVendorRow` object-literal keys):
  **FOLDED** — the cohort cells are now built by iterating the single `COHORTS` list, so producer and
  renderer cannot drift to different key sets.
- **craft note — `ga4.js:28` stale doc reference:** **FOLDED** (see deviation log; grounded by
  enumeration).
- **craft [nit] — test's R5 "name-not-value" guard uses a magic `length < 10` threshold:** **LOGGED,
  deferred.** A loose proxy; the test's names-not-values intent is already carried by the substantive
  per-name assertions around it. Tightening to an exact names-only check is test-quality polish with no
  correctness impact — not folded this slice.
- **arch note — `transport` optional in the typedef yet required (throw) by the report:** **LOGGED as
  deliberate.** Fail-loud-on-missing is the intended anti-false-green design (AC1); the throw is tested.
- **craft note — `report.js` untouched:** **VERIFIED** — `git diff --stat HEAD -- rig/parity/report.js`
  is clean (the one connector "transport" hit is an unrelated `WebTransport` probe, not a scope breach).

**Footprint** (this slice's own `git diff HEAD` + untracked; the branch's cumulative `main...HEAD`
conflates the already-DONE 038-01/02, spec 039, and ADRs 0019/0020 — scoped here to 038-03 alone,
as the sibling sweeps did):

- `rig/parity/transport-report.js` — **new**, the ledger engine (`buildTransportLedger` +
  `renderTransportMarkdown` + the completeness guard).
- `rig/parity/run-transport.mjs` — **new**, the AC4 CLI (deliverable 3); always exits 0 (report, not
  a gate). *(Was omitted from the first sweep draft — added at reconciliation review.)*
- `test/parity-transport.test.js` — **new**, the 20-test suite (was 19; +1 completeness-guard throw
  test added at reconciliation review).
- `rig/parity/oracle.js` — **updated**, the optional `transport` typedef property only (JSDoc,
  `diffParity` body untouched).
- `rig/parity/descriptors/meta.js`, `rig/parity/descriptors/ga4.js` — **updated**, each gains a
  `transport` block; `ga4.js` also the one-line `SYNTHETIC_META_PIXEL_ID` doc-comment fix.
- `package.json` — **updated**, the `parity:transport` script. *(Was omitted from the first sweep
  draft — added at reconciliation review.)*
- `docs/specs/038-parity-harness/reviews/slice-03-*.md` (+`.candidates/`) — **updated**, this slice's
  review evidence.
- `docs/specs/038-parity-harness/slice-03-credential-context-cohorts.md` — **updated**, this slice file
  itself (status → REVIEWED, and this Deviation log + sweep embedded inline; 038-03 keeps reconciliation
  inline rather than the sibling slices' separate `slice-0N-reconciliation.md`).

Evidence: `test/parity-transport.test.js` **20/20** (was 19; +1 completeness-guard throw test,
mutation-verified — removing the guard reds exactly that one test); full suite **1323/1323** assertions
green (the lone red file is the pre-existing `prismjs` devDep ENOENT in `dom-chamber-host-prism.test.js`,
unrelated); ESLint clean on the changed source; ledger output structurally unchanged (Meta `fr`/E10 +
`_fbp`/`fbc` cookie-cap on allowed, `_fbp`/`fbc` persist on blocked; GA4 gap-free both cohorts).
