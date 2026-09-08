---
status: DRAFT
dependencies: [038-01, adr-0018, adr-0020]
last_verified:
frame_review: true
arch_review: true
---

## Slice 038-03 — credential/cookie transport-parity report (feeds E10)

**Goal:** Produce the **per-vendor, per-cohort transport-parity table** ADR-0018 **E10** (the purpose-gated
credentialed-transport decision) consumes: which attribution rides a **cross-site cookie** (that airlock's cookieless
egress drops) vs **first-party params** (that airlock emits), split by the third-party-cookies-**allowed** vs **blocked**
cohort. The harness **observes/derives and reports** the transport gap; whether airlock re-attaches a credentialed
transport is the **E10 decision** this slice feeds, per ADR-0020 commitment 3 ("made visible, never absorbed").

**Not a `diffParity` extension.** 038-01/02 diff beacon *field-sets*. The cross-site cookie is **not a beacon field** —
it rides the browser's credentialed request (the `Cookie` header), is opaque to page JS, and is **not in the beacon
URL**. So this slice is a **report generator**, not a new oracle bucket.

**DoR:**
- ✅ 038-01/02 done — the capture front-end + report exist; each vendor already has a `ParityDescriptor` (Meta, GA4).
- ✅ Grounded: airlock egress carries **no cross-site cookies** (`core/airlock.js` `fetchInit` sets only
  `method`/`body`/`keepalive` — no `credentials`/`mode`), so any cross-site-cookie-borne attribution is dropped by
  construction — the transport gap this slice makes visible.
- ✅ First-party attribution params ARE in the beacon (query/body) and are already captured by 038-01/02 (Meta `_fbp`/
  `fbc`; GA4 has none — MP is cookieless).

**Acceptance Criteria:**

1. **Per-vendor transport declaration (documented, not live-captured).** Each vendor descriptor gains a `transport`
   declaration: its **cross-site-cookie-dependent** attribution (Meta `fr`; Google/DoubleClick `IDE`/`_gcl_*` — a
   **documented** vendor fact, grounded in vendor docs, since the cookie is opaque to page JS and absent from the beacon
   URL) and its **first-party-param** attribution (already in the beacon: Meta `_fbp`/`fbc`; GA4 none). **Cookie NAMES /
   presence only — never values** (R5 / ADR-0020).
2. **Per-cohort classification (reasoned from the declaration + the grounded airlock fact).** For each vendor × cohort:
   **3p-cookies-allowed** → the vendor cookie rides the container's request but airlock's cookieless egress drops it →
   **transport gap**; **blocked** → the vendor cookie is absent from the container too (the browser drops it), so both the
   container and airlock fall back to first-party params → **no airlock-specific gap** on that cohort. The airlock
   consequence is grounded (no cross-site cookies), so the table is reasoned, not asserted.
3. **The transport gap is flagged, tied to its owner.** Where a cross-site-cookie path exists on the allowed cohort, the
   report flags airlock's cookieless egress drops it and names the owner: **E10** (whether to re-attach a purpose-gated
   credentialed transport) + the durable first-party/CAPI path (ADR-0020 commitment 3). Made visible, never absorbed.
4. **Output is the E10 input table.** A per-vendor × per-cohort transport-parity table (Markdown/JSON) an E10 ADR author
   reads: the cookie-dependent paths, the first-party paths, and airlock's cookieless-egress consequence per cohort. No
   live identifiers.

**DoD:**
- [ ] All ACs pass; full suite green.
- [ ] Coverage: a vendor with a cross-site-cookie path (Meta `fr`) → flagged as an allowed-cohort gap, no gap on blocked;
      a vendor with only first-party/cookieless attribution (GA4) → no transport gap on either cohort.
- [ ] Each new test shown to fail when its feature is removed.
- [ ] Reviewed by `reviewer` — compliance + craft + **arch** (`arch_review: true`: the `transport` descriptor field +
      the report generator extend the harness's public surface).
- [ ] Deviation log + reconciliation sweep produced.

## Assumptions

- **The cross-site-cookie dependence is DOCUMENTED, not live-observed.** It cannot be read from a Lighthouse
  `network-requests` log (which does not expose request `Cookie` headers) nor from page JS (third-party cookies are
  opaque). It is declared per vendor from vendor documentation (Meta `fr`, DoubleClick `IDE`). **Live observation** —
  whether a *specific* request actually carried the cookie — would need CDP `Network.requestWillBeSentExtraInfo` (the
  request headers) and is a **future enhancement**, R5-gated (a real credentialed capture is local-only). Getting the
  per-vendor dependence wrong mis-scopes E10; the frame-critique targets it. (Why `frame_review: true`.)
- **The cohort model is reasoned, not captured** (AC2): it follows from the documented cookie-dependence + the grounded
  airlock-no-credentials fact. A live two-cohort capture (3p-allowed vs blocked) would *confirm* it but is not required
  to produce E10's input — and the blocked-cohort capture needs a 3p-cookies-disabled session (a future capture).

**Anti-horizontal-phasing check:** After this slice an E10 ADR author has a concrete per-vendor × per-cohort
transport-parity table — which attribution rides the cross-site cookie airlock drops, and where first-party params
already suffice — the visible input the credentialed-transport decision is made on.

### Deviation log (after reconciliation)

_TBD at implementation._

### Reconciliation sweep

_TBD at implementation._
