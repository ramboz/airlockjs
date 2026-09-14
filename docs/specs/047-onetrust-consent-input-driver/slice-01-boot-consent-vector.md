---
status: DRAFT
dependencies: [adr-0007, adr-0026, 017-03]
last_verified:
frame_review: true
arch_review: true
---

<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about runnable
     surfaces by probe first (run it / read source) or a citation, else mark them
     as assumptions in the spec's `## Assumptions` section — never assert an
     unverified claim as fact. -->

## Slice 047-01 — OneTrust boot consent vector → the seam's `consent` param

> **Grounded 2026-09-13 (shape) + one gate open.** GROUNDED: the seam (`adapters/eds/index.js` `consent` boot param +
> `egressPurposes` gating, `:331-334`/`:442-448`), the vendor-neutral vector (`core/consent.js`), the egress hold/flush
> (spec 045), and the reference site's OneTrust surfaces + custom group taxonomy + seed map
> (`rig/onetrust-consent-probe.mjs`, spec §A1/§A3). **Source surface decided —
> [ADR-0026](../../decisions/adr-0026-onetrust-consent-input-source.md): option (a)** — read OneTrust's **own resolved-consent**
> surface (not the gtag signals). **NOT yet grounded (hard gate below):** *which* OneTrust surface carries resolved
> per-user consent — the probe was pre-interaction on an opt-out/default-granted page and could not tell resolved consent
> from configured default (`GetDomainData().Status` is **rejected** as the grant signal — suspected config-default; leading
> candidate is the `OptanonConsent` cookie flags). A discriminating click-through re-capture pins it.

**Goal:** A OneTrust consent-input driver module (proposed `drivers/consent/onetrust.js` — module home is an arch-pass call)
reads OneTrust's **own resolved-consent surface** at boot (the ADR-0026-gated surface — leading candidate the
`OptanonConsent` cookie `groups` flags; **not** `GetDomainData().Status`) and maps it through a **host-provided
group→purpose map** to the `core/consent.js` vector over the Consent Mode v2 four, then supplies it as the
`adapters/eds/index.js` `consent` boot param — so the seal starts the page from OneTrust's actual consent, **no new seam**.
Delivers: boot-time OneTrust→seal consent parity (granted ad purposes send; denied / pending hold).

**DoR:**
- ✅ ADR-0007 seam + `core/consent.js` vector + the `adapters/eds/index.js` `consent` boot param (017-01/02/03) shipped and
  read (spec § What already exists).
- ✅ Spec 045 `holdOnDenied` hold/flush shipped (044-02 / 046-03) — the downstream egress behavior a denied boot verdict
  drives.
- ✅ **Architectural source decided (ADR-0026):** read OneTrust's own resolved surface + a host group→purpose map — **not**
  the gtag Consent-Mode signals (that is ADR-0007's separate driver).
- ✅ OneTrust surface *shape* + custom taxonomy + seed map grounded (2026-09-13, `rig/onetrust-consent-probe.mjs`).
- ⛔ **NOT YET MET — blocks `READY_FOR_IMPLEMENTATION` (ADR-0026 gate, safety-critical):** a **discriminating click-through
  re-capture** — opt out of one ad group in the OneTrust banner and confirm **which** surface's flag flips to denied — to
  pin the exact resolved-consent read (`OptanonConsent` cookie flags vs `OnetrustActiveGroups`) and **rule out**
  `GetDomainData().Status` (suspected configured-default). Reading a config-default surface would mark an opted-out user
  `granted` and release held ad beacons — the failure the seal exists to prevent.

**Acceptance Criteria:**

1. **Reads OneTrust's resolved-consent surface at boot, via an injected read.** The driver reads the **ADR-0026-gated
   resolved surface** — the one the DoR experiment pins (leading candidate: the `OptanonConsent` cookie `groups=<id>:1|0`
   flags) — through an injected read (no ambient DOM in the mapping logic — fixture-testable). It **does not** trust
   `GetDomainData().Groups[].Status` as the grant signal (ADR-0026: suspected config-default); `GetDomainData()` supplies the
   group taxonomy/names only. OneTrust absent / the surface unavailable ⇒ an empty result, **no throw**.
2. **Maps granted groups → the purpose vector via a host-provided map.** Given a host `{ <groupId>: ConsentPurpose[] }` map —
   grounded seed for the reference site
   `{ "3": ["analytics_storage"], "4": ["ad_storage"], "41": ["ad_user_data"], "42": ["ad_personalization"] }` — the driver
   produces a `Record<ConsentPurpose, "granted" | "denied">` over the Consent Mode v2 four: a mapped group flagged **granted**
   in the resolved surface ⇒ its purposes `granted`; flagged **denied** (present + resolved) ⇒ `denied`; a purpose no
   mapped-and-resolved group covers ⇒ **omitted**. Purpose names + values match `core/consent.js` exactly (case-normalized).
3. **Feeds the seam's `consent` boot param unchanged.** The produced vector is passed as the EDS boot's `consent` option
   (the existing `bootGa4Core` pre-construction fold + `egressPurposes` gating) with **no change to any seal codepath**: the
   same beacons egress as an all-granted page does today; a denied ad purpose holds at the seal (045 `holdOnDenied`,
   connector-opted); a pending purpose holds. Verified via the driver→boot path.
4. **Fail-to-pending, never fail-to-send.** A malformed / absent OneTrust surface, an unknown group id, or an unmapped
   purpose resolves to omitted / pending (the seal holds) — **never** to a silent `granted`, mirroring `resolveConsent`. A
   denied / unresolved boot (incl. the §A4 "present but not fully resolved" state) leaks no ad beacon.
5. **Driver is host-neutral + egress-free.** The driver opens no worker, performs no egress, and imports no GA4 / MP or
   connector specifics — it produces only the vendor-neutral `core/consent.js` vector; the OneTrust-specific reads are
   injected so the mapping is unit-testable without a live OneTrust. (Architectural source settled by ADR-0026; the arch pass
   decides the module home — `drivers/consent/onetrust.js` vs an `adapters/eds`-scoped file — and the host-map contract; the
   *resolved-surface read* is fixed by the DoR experiment.)

**DoD:**
- All ACs met against a committed **redacted OneTrust fixture** built from the §A1/§A3 + the DoR click-through capture; full
  `npx vitest run` green.
- Compliance + craft + **arch** passes recorded (`arch_review: true` — new module boundary + the host-map public contract +
  the module home; the architectural source decision is already settled in ADR-0026).
- Frame-critique pass recorded (`frame_review: true` — the resolved-surface + §A2 residuals).
- Each new test shown to fail when its feature is removed (red→green); reconciliation walked.

**Out of scope (explicit):**
- Mid-session consent change / `setConsent` / accept-flow flush — **047-02**.
- `functional` / `personalization` purposes; non-EDS host adapters — later (MVP8 = the Consent Mode v2 four).
- The egress hold / flush machinery itself (spec 045 / ADR-0023) — **reused, not rebuilt**.
- Consuming the resolved Consent Mode v2 signals (`gtag` / `google_tag_data.ics`) — that is ADR-0007's *separate* gtag
  driver, ruled out of scope for the OneTrust driver by ADR-0026 (a future sibling + fallback); likewise IAB `__tcfapi`.
- Minting / writing any OneTrust or identity cookie — the driver only **reads** consent.

### Deviation log (after reconciliation)

_Filled at reconciliation (REVIEWED → RECONCILED). No implementation has started (DRAFT)._

### Reconciliation sweep

_Filled at reconciliation (REVIEWED → RECONCILED). No implementation has started (DRAFT)._
