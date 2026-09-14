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

> **Grounded 2026-09-13** — the seam (`adapters/eds/index.js` `consent` boot param + `egressPurposes` gating,
> `:331-334`/`:442-448`), the vendor-neutral vector (`core/consent.js`), the egress hold/flush (spec 045), AND — via the
> opt-out experiment (`rig/onetrust-optout-probe.mjs`, spec §A5) — **which OneTrust surface carries resolved consent**:
> `OnetrustActiveGroups` / the `OptanonConsent` cookie `groups` flags (both flip on opt-out); `GetDomainData().Status` is
> **confirmed configured-default** (does NOT flip) and is used for taxonomy/names only. **Source surface decided —
> [ADR-0026](../../decisions/adr-0026-onetrust-consent-input-source.md): option (a).** Map grounded for the US config (§A5):
> group `4` = the single lever → `{ "4" → the four CM v2 purposes }`, CM-vector-validated; EEA granularity is the residual.

**Goal:** A OneTrust consent-input driver module (proposed `drivers/consent/onetrust.js` — module home is an arch-pass call)
reads OneTrust's **resolved-consent surface** at boot (`OnetrustActiveGroups`, equivalently the `OptanonConsent` cookie
`groups` flags — **not** `GetDomainData().Status`, which is configured-default) and maps the granted groups through a
**host-provided group→purpose map** ([ADR-0026](../../decisions/adr-0026-onetrust-consent-input-source.md)) to the
`core/consent.js` vector over the Consent Mode v2 four, then supplies it as the `adapters/eds/index.js` `consent` boot
param — so the seal starts the page from OneTrust's actual consent, **no new seam**. Delivers: boot-time OneTrust→seal
consent parity (granted ad purposes send; denied / pending hold).

**DoR:**
- ✅ ADR-0007 seam + `core/consent.js` vector + the `adapters/eds/index.js` `consent` boot param (017-01/02/03) shipped and
  read (spec § What already exists).
- ✅ Spec 045 `holdOnDenied` hold/flush shipped (044-02 / 046-03) — the downstream egress behavior a denied boot verdict
  drives.
- ✅ **Architectural source decided (ADR-0026):** read OneTrust's own resolved surface + a host map — **not** the gtag
  Consent-Mode signals (ADR-0007's separate driver).
- ✅ **Resolved surface grounded (opt-out experiment, §A5):** `OnetrustActiveGroups` / `OptanonConsent` cookie flags flip on
  opt-out; `GetDomainData().Status` is configured-default (rejected as the grant signal). The prior safety-critical blocker
  is retired.
- ✅ **Map grounded for the US config (§A5, `rig/onetrust-map-probe.mjs`):** group `4` is the single lever → host-map
  `{ "4" → the four CM v2 purposes }`, CM-vector-validated; expressible per-group (ADR-0026 kill-criterion not triggered).
- ◻️ (residual, MVP7–9) EEA/opt-in granularity untested (no EEA IP in-sandbox) — re-verify at EEA parity; each site supplies
  its own host-map.

**Acceptance Criteria:**

1. **Reads OneTrust's resolved-consent surface at boot, via an injected read.** The driver reads the **granted-group set**
   from `OnetrustActiveGroups` (equivalently the `OptanonConsent` cookie `groups=<id>:1` flags) through an injected read (no
   ambient DOM in the mapping logic — fixture-testable). It **does not** read `GetDomainData().Groups[].Status` for grant
   state (ADR-0026 / §A5: configured-default); `GetDomainData()` may supply group taxonomy/names only. OneTrust absent / the
   surface unavailable ⇒ an empty result, **no throw**.
2. **Maps granted groups → the purpose vector via a host-provided map.** Given a host `{ <groupId>: ConsentPurpose[] }` map —
   its shape **grounded + CM-vector-validated per site** (§A5: the reference-site US map is the single coarse entry
   `{ "4": ["ad_storage", "analytics_storage", "ad_user_data", "ad_personalization"] }` — group `4` is the sole lever) —
   the driver produces a `Record<ConsentPurpose, "granted" | "denied">` over the Consent Mode v2 four: a mapped group **in**
   the granted set ⇒ its purposes `granted`; a mapped group **absent** while OneTrust is resolved ⇒ its purposes `denied`; a
   purpose no mapped-and-resolved group covers ⇒ **omitted**. Purpose names + values match `core/consent.js` exactly
   (case-normalized).
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
   decides the module home — `drivers/consent/onetrust.js` vs an `adapters/eds`-scoped file — and the host-map contract.)

**DoD:**
- All ACs met against a committed **redacted OneTrust fixture** built from the §A5 opt-out captures (granted + opted-out
  states); full `npx vitest run` green.
- Compliance + craft + **arch** passes recorded (`arch_review: true` — new module boundary + the host-map public contract +
  the module home; the architectural source decision is already settled in ADR-0026).
- Frame-critique pass recorded (`frame_review: true` — the §A2 change-delivery + coarse-map-decomposition residuals).
- Each new test shown to fail when its feature is removed (red→green); reconciliation walked.

**Out of scope (explicit):**
- Mid-session consent change / `setConsent` / accept-flow flush — **047-02**.
- `functional` / `personalization` purposes; non-EDS host adapters — later (MVP8 = the Consent Mode v2 four).
- The egress hold / flush machinery itself (spec 045 / ADR-0023) — **reused, not rebuilt**.
- Consuming the resolved Consent Mode v2 signals (`gtag` / `google_tag_data.ics`) — that is ADR-0007's *separate* gtag
  driver, ruled out for the OneTrust driver by ADR-0026 (the CM-bridged fallback / a future sibling); likewise IAB `__tcfapi`.
- Minting / writing any OneTrust or identity cookie — the driver only **reads** consent.

### Deviation log (after reconciliation)

_Filled at reconciliation (REVIEWED → RECONCILED). No implementation has started (DRAFT)._

### Reconciliation sweep

_Filled at reconciliation (REVIEWED → RECONCILED). No implementation has started (DRAFT)._
