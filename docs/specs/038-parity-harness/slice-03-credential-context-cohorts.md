---
status: DRAFT
dependencies: [038-01, adr-0018, adr-0020]
last_verified:
frame_review: true
arch_review: true
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
- [ ] All ACs pass; full suite green.
- [ ] Coverage: **Meta** → cross-site-cookie gap (E10) on allowed only, **first-party-identity gap (cookie-capability) on
      BOTH cohorts** (the frame-critique's correction — blocked is NOT "no gap"); **GA4** → gap-free on both cohorts
      (`cid` emitted from `_ga`, no cross-site cookie). A test asserts the blocked-cohort Meta cell is a gap, not green.
- [ ] Each new test shown to fail when its feature is removed.
- [ ] Reviewed by `reviewer` — compliance + craft + **arch** (`arch_review: true`: the `transport` descriptor field +
      the report generator extend the harness's public surface).
- [ ] Deviation log + reconciliation sweep produced.

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

_TBD at implementation._

### Reconciliation sweep

_TBD at implementation._
