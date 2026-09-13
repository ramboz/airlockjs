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

> **Grounded 2026-09-13** — the seam (`adapters/eds/index.js` `consent` boot param + `egressPurposes` gating,
> `:331-334`/`:442-448`), the vendor-neutral vector (`core/consent.js` `CONSENT_PURPOSES`/`resolveConsent`), the egress
> hold/flush it feeds (spec 045), AND the reference site's live OneTrust surface (`rig/onetrust-consent-probe.mjs`, spec
> §A1/§A3/§A4: custom group taxonomy, the concrete group→purpose seed values, and the resolved-CM-signal alternative). The
> `arch_review` pass picks the source surface (§A3 (a) vs (b)). Residual (spec `## Assumptions`): a clean non-headless
> re-capture of the full resolved group set (the probe run was 403-degraded) — an implementation confirm, not a design
> blocker.

**Goal:** A OneTrust consent-input driver module (proposed `drivers/consent/onetrust.js` — module home is an arch-pass call)
reads OneTrust's resolved consent at boot **from the arch-chosen source** (§A3: (a) `GetDomainData().Groups[].Status` + a
host group→purpose map, or (b) the resolved Consent Mode v2 signals), maps it to the `core/consent.js` vector over the
Consent Mode v2 four, and supplies it as the `adapters/eds/index.js` `consent` boot param — so the seal starts the page from
OneTrust's actual consent, **no new seam**. Delivers: boot-time OneTrust→seal consent parity (granted ad purposes send;
denied / pending hold).

**DoR:**
- ✅ ADR-0007 seam + `core/consent.js` vector + the `adapters/eds/index.js` `consent` boot param (017-01/02/03) are all
  shipped and read (spec § What already exists).
- ✅ Spec 045 `holdOnDenied` hold/flush is shipped (044-02 / 046-03) — the downstream egress behavior a denied boot verdict
  drives.
- ✅ **OneTrust surface grounded (2026-09-13, `rig/onetrust-consent-probe.mjs`):** the runtime surface, the custom group
  taxonomy, the concrete group→purpose seed values, and the resolved-CM-signal alternative are captured (spec §A1/§A3) —
  *this was the previously-blocking DoR item; now met.*
- ◻️ **First implementation step (not a pre-req):** the arch pass picks the source surface (§A3 (a)/(b)) — the slice carries
  `arch_review: true` for exactly this.
- ◻️ (soft, non-blocking) a clean non-headless re-capture to confirm the *full* resolved group set — the probe run was
  403-degraded (`OnetrustActiveGroups` came back partial).

**Acceptance Criteria:**

1. **Reads OneTrust's resolved consent at boot (chosen source), via an injected read.** No ambient DOM in the mapping logic
   — fixture-testable. For source (a): `OneTrust.GetDomainData().Groups[].Status` (grounded as more complete than the
   `OnetrustActiveGroups` string — §A3 caveat). For source (b): the resolved Consent Mode v2 signals
   (`google_tag_data.ics` / the last `gtag('consent','update',…)`). OneTrust absent / unresolved ⇒ an empty result, **no
   throw**.
2. **Maps to the purpose vector.** Produces a `Record<ConsentPurpose, "granted" | "denied">` over the Consent Mode v2 four.
   Source (a): via a host `{ <groupId>: ConsentPurpose[] }` map — grounded seed for the reference site
   `{ "3": ["analytics_storage"], "4": ["ad_storage"], "41": ["ad_user_data"], "42": ["ad_personalization"] }`; a mapped
   group **resolved-active** ⇒ its purposes `granted`, **resolved-inactive** ⇒ `denied`, **unresolved** ⇒ **omitted**.
   Source (b): the signals are already the vocabulary (near-identity map). Purpose names + values match `core/consent.js`
   exactly (case-normalized).
3. **Feeds the seam's `consent` boot param unchanged.** The produced vector is passed as the EDS boot's `consent` option
   (the existing `bootGa4Core` pre-construction fold + `egressPurposes` gating) with **no change to any seal codepath**: the
   same beacons egress as an all-granted page does today; a denied ad purpose holds at the seal (045 `holdOnDenied`,
   connector-opted); a pending purpose holds. Verified via the driver→boot path.
4. **Fail-to-pending, never fail-to-send.** A malformed / absent OneTrust surface, an unknown group id, or an unmapped
   purpose resolves to omitted / pending (the seal holds) — **never** to a silent `granted`, mirroring `resolveConsent`. A
   denied / unresolved boot (incl. the §A4 "present but not fully resolved" state) leaks no ad beacon.
5. **Driver is host-neutral + egress-free.** The driver opens no worker, performs no egress, and imports no GA4 / MP or
   connector specifics — it produces only the vendor-neutral `core/consent.js` vector; the OneTrust-specific reads are
   injected so the mapping is unit-testable without a live OneTrust. (Module home — `drivers/consent/onetrust.js` vs an
   `adapters/eds`-scoped file — is decided in the arch pass, alongside the source-surface call.)

**DoD:**
- All ACs met against a committed **redacted OneTrust fixture** built from the §A1/§A3 capture; full `npx vitest run` green.
- Compliance + craft + **arch** passes recorded (`arch_review: true` — new module boundary + the ADR-0007 seam-facet pin:
  the (a)/(b) source decision + module home; the arch pass decides whether a new ADR / an ADR-0007 amendment is warranted).
- Frame-critique pass recorded (`frame_review: true` — the §A2/§A1 residuals).
- Each new test shown to fail when its feature is removed (red→green); reconciliation walked.

**Out of scope (explicit):**
- Mid-session consent change / `setConsent` / accept-flow flush — **047-02**.
- `functional` / `personalization` purposes; non-EDS host adapters — later (MVP8 = the Consent Mode v2 four).
- The egress hold / flush machinery itself (spec 045 / ADR-0023) — **reused, not rebuilt**.
- IAB `__tcfapi` / Consent Mode `gtag` drivers as *separate* specs — sibling drivers onto the same seam (ADR-0007); note
  source (b) *is* the gtag-CM surface, so if the arch pass picks (b) this spec partly realizes that sibling.
- Minting / writing any OneTrust or identity cookie — the driver only **reads** consent.

### Deviation log (after reconciliation)

_Filled at reconciliation (REVIEWED → RECONCILED). No implementation has started (DRAFT)._

### Reconciliation sweep

_Filled at reconciliation (REVIEWED → RECONCILED). No implementation has started (DRAFT)._
