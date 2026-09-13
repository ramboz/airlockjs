---
status: DRAFT
dependencies: [adr-0007, 017-03]
last_verified:
frame_review: true
arch_review: true
---

<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about runnable
     surfaces by probe first (run it / read source) or a citation, else mark them
     as assumptions in the spec's `## Assumptions` section — never assert an
     unverified claim as fact. -->

## Slice 047-01 — OneTrust boot consent vector → the seam's `consent` param

> **Partly grounded 2026-09-13.** GROUNDED: the seam (`adapters/eds/index.js` `consent` boot param + `egressPurposes`
> gating, `:331-334`/`:442-448`), the vendor-neutral vector (`core/consent.js` `CONSENT_PURPOSES`/`resolveConsent`), and the
> egress hold/flush it feeds (spec 045). UNVERIFIED (spec §A1/§A3/§A4): the OneTrust runtime surface + the reference site's
> concrete category→purpose values — **no live OneTrust probe was run**, so grounding those is the blocking DoR item below.

**Goal:** A OneTrust consent-input driver module (proposed `drivers/consent/onetrust.js` — module home is an arch-pass call)
reads OneTrust's resolved active groups at boot, maps them through a **host-provided category→purpose map** to the
`core/consent.js` vector over the Consent Mode v2 four, and supplies it as the `adapters/eds/index.js` `consent` boot param —
so the seal starts the page from OneTrust's actual consent, **no new seam**. Delivers: boot-time OneTrust→seal consent
parity (granted ad purposes send; denied / pending hold).

**DoR:**
- ✅ ADR-0007 seam + `core/consent.js` vector + the `adapters/eds/index.js` `consent` boot param (017-01/02/03) are all
  shipped and read (spec § What already exists).
- ✅ Spec 045 `holdOnDenied` hold/flush is shipped (044-02 / 046-03) — the downstream egress behavior a denied boot verdict
  drives.
- ⛔ **NOT YET MET — blocks `READY_FOR_IMPLEMENTATION` (spec §A1/§A3):** a live redacted `erp.intuit.com` OneTrust capture
  showing (a) the active-group surface (`OnetrustActiveGroups` / `OptanonConsent`) is populated at boot, and (b) the site's
  concrete group→purpose mapping values — captured local-only per R5. Until then the slice stays DRAFT; the frame-critique
  pass (`frame_review: true`) holds it on the open assumptions.

**Acceptance Criteria:**

1. **Reads OneTrust's resolved active groups at boot.** The driver reads the OneTrust active-group set from its runtime
   surface (`window.OnetrustActiveGroups`, falling back to the `OptanonConsent` cookie `groups=` list) through an **injected
   read** (no ambient DOM in the mapping logic — unit-testable with a fixture). OneTrust absent / unresolved ⇒ an empty
   result, **no throw**. [rests on §A1]
2. **Maps groups → the purpose vector via a host-provided map.** Given a host `{ <groupId>: ConsentPurpose[] }` map (e.g.
   `{ C0002: ["analytics_storage"], C0004: ["ad_storage", "ad_user_data", "ad_personalization"] }`), the driver produces a
   `Record<ConsentPurpose, "granted" | "denied">` over the Consent Mode v2 four: a mapped group **present** in the active
   set ⇒ its purposes `granted`; a mapped group **absent while OneTrust is resolved** ⇒ its purposes `denied`; a purpose no
   mapped-and-resolved group covers ⇒ **omitted**. Purpose names + values match `core/consent.js` exactly
   (case-normalized). [rests on §A3/§A4]
3. **Feeds the seam's `consent` boot param unchanged.** The produced vector is passed as the EDS boot's `consent` option
   (the existing `bootGa4Core` pre-construction fold + `egressPurposes` gating) with **no change to any seal codepath**: the
   same beacons egress as an all-granted page does today; a denied ad purpose holds at the seal (045 `holdOnDenied`,
   connector-opted); a pending purpose holds. Verified via the driver→boot path.
4. **Fail-to-pending, never fail-to-send.** A malformed / absent OneTrust surface, an unknown group id, or an unmapped
   purpose resolves to omitted / pending (the seal holds) — **never** to a silent `granted`, mirroring `resolveConsent`. A
   denied / unresolved boot leaks no ad beacon.
5. **Driver is host-neutral + egress-free.** The driver opens no worker, performs no egress, and imports no GA4 / MP or
   connector specifics — it produces only the vendor-neutral `core/consent.js` vector; the OneTrust-specific reads are
   injected so the mapping is unit-testable without a live OneTrust. (Module home — `drivers/consent/onetrust.js` vs an
   `adapters/eds`-scoped file — is decided in the arch pass.)

**DoD:**
- All ACs met against a committed **redacted OneTrust fixture** (the §A1/§A3 grounding); full `npx vitest run` green.
- Compliance + craft + **arch** passes recorded (`arch_review: true` — new module boundary + the ADR-0007 seam-facet pin;
  the arch pass decides the module home and whether a new ADR / an ADR-0007 amendment is warranted).
- Frame-critique pass recorded (`frame_review: true` — §A1/§A3/§A4).
- Each new test shown to fail when its feature is removed (red→green); reconciliation walked.

**Out of scope (explicit):**
- Mid-session consent change / `setConsent` / accept-flow flush — **047-02**.
- `functional` / `personalization` purposes; non-EDS host adapters — later (MVP8 = the Consent Mode v2 four).
- The egress hold / flush machinery itself (spec 045 / ADR-0023) — **reused, not rebuilt**.
- IAB `__tcfapi` / Consent Mode `gtag` drivers — sibling drivers onto the same seam, not this spec (ADR-0007).
- Minting / writing any OneTrust or identity cookie — the driver only **reads** consent.

### Deviation log (after reconciliation)

_Filled at reconciliation (REVIEWED → RECONCILED). No implementation has started (DRAFT)._

### Reconciliation sweep

_Filled at reconciliation (REVIEWED → RECONCILED). No implementation has started (DRAFT)._
