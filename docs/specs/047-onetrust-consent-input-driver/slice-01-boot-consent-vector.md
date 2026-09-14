---
status: DONE
dependencies: [adr-0007, adr-0026, 017-03]
last_verified: 2026-09-13
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

The five ACs as framed held up; all met, full suite green (1713), TDD red→green mutation-verified. Compliance + craft **pass**; arch **pass** after its sole [blocker] was fixed. Deviations + folded findings:

1. **Module home = a NEW top-level `drivers/consent/onetrust.js`** (the slice's proposed home), validated by the arch pass as vocabulary-consistent with ADR-0007's "seam drivers" — correctly not `core/` (OneTrust-format-coupled reads) nor `connectors/` (no chamber/egress). **Recorded in `docs/architecture.md`** Repository-structure registry (the arch pass's sole [blocker], resolved this change-set). Not a new ADR: the home follows ADR-0007's seam-driver model + ADR-0026; the boundary doc is the durable record.
2. **Zero-import "pure leaf"** (stricter than AC5's "no GA4/MP specifics"): the driver re-declares `CONSENT_MODE_V2_PURPOSES` + the `granted`/`denied` vocabulary rather than importing `core/consent.js`'s `CONSENT_PURPOSES` (which AC5 would permit). Drift is test-pinned (AC5 subset-guard + AC2 `resolveConsent` round-trip). Craft + arch judged it defensible (a zero-core-dependency leaf has portability value) — **kept**; the import-instead alternative is a tracked low-priority follow-up.
3. **`eslint.config.js`:** added `drivers/**/*.js` to the browser-globals block (config-only, a direct consequence of the new area; **not** a `conventions.md` change — the `§ Code home` rule already governs it).
4. **Boot wiring scoped to `bootGa4Core`/`bootEdsAnalytics`** — the minimal driver→boot path AC3 requires. The `boot(config)` composite + pixel/ga4-gtag/alloy boots + ad-connector boot wiring are follow-ups (ad-connector boot wiring was already deferred by 044/046).
5. **"Resolved" heuristic** = `OnetrustActiveGroups` is a string containing a comma (≥1 group id). OneTrust always comma-wraps its resolved set; an un-wrapped single-group value reads as unresolved→hold (safe false-negative). Acknowledged in the driver source (`drivers/consent/onetrust.js`'s `parseActiveGroups`) + ADR-0026's general resolved-surface assumption; flagged for EEA/other-site parity.
6. **Redacted §A5 captures = inline test constants** (`",1,BG394,4,"` granted / `",1,"` opted-out) in both test files, not a separate committed fixture file — faithful to both states; a minor deviation from the DoD's literal "committed fixture" wording.
7. **AC3 "denied ad purpose holds" inherited from spec 045** (reused, not re-demonstrated via the 047-01 boot path — GA4's `analytics_storage` denied→send by ADR-0007 default; `holdOnDenied` is the ad-connector opt-in proven in 044-02/046-03). Boot integration covers granted→send + pending→hold.
8. **Non-blocking reviewer follow-ups tracked in `docs/refinement-todo.md`** (§ Spec 047 follow-ups): (a) an observability signal when a resolved surface maps to an empty vector (dead-map vs legitimate pending); (b) integration-test the live-`window` adapter glue line (`adapters/eds/index.js`); (c) revisit `ERP_INTUIT_GROUP_PURPOSE_MAP` co-location if the reference-config set grows; (d) narrow the source-text regex test guards; (e) remove the unused DI `read` override seam.

### Reconciliation sweep

| Artifact | Disposition | Rationale |
|----------|-------------|-----------|
| `README.md` | `no-op` | Front door untouched — an internal driver + boot wiring, no user-facing entry-point change. |
| `docs/specs/README.md` | `updated` | Regenerated by `workflow.py status-board` at close-out (047-01 → DONE). |
| `docs/product-vision.md` | `no-op` | UC-2 already cited; no behavior/scope drift. |
| `docs/architecture.md` | `updated` | Added the `drivers/consent/` Repository-structure entry (the arch pass's [blocker]) — records the new module home, the OneTrust surface read, and why it's not `core/`/`connectors/`. |
| Primer: `CLAUDE.md` / `AGENTS.md` / templates | `no-op` | Spec 047 not closed (047-02 remains) — no compress-on-close yet; no per-slice invariant to migrate. |
| `docs/inbox.md` | `no-op` | Nothing to park; the EEA/opt-in map residual already lives in spec `## Assumptions` + ADR-0026 open questions. |
| `docs/refinement-todo.md` | `updated` | Added § Spec 047 follow-ups (the five non-blocking reviewer nits, deviation-log item 8). |
| `docs/memory/**` | `deferred` | The `drivers/`/consent-input-driver pattern + the OneTrust map finding are worth a glossary/memory note at **spec close** (after 047-02), per compress-on-close. |
| `docs/decisions/README.md` / ADR index | `no-op` (slice) | ADR-0026's index entry landed in the 047 **drafting phase** (earlier on this branch); **no further** index change for slice-01. No new ADR — the `drivers/` home follows ADR-0007 + ADR-0026, documented in `architecture.md`. |
| 047 drafting-phase artifacts: `adr-0026-*.md` + its frame-critique review, `spec.md`, the 047-02 draft, `rig/onetrust-*-probe.mjs` | `no-op` (out of slice scope) | Landed in the 047 authoring/grounding phase (earlier commits on this branch) — outside slice-01's *implementation* reconciliation scope; listed so the `main…HEAD` changed-set is accounted for, not silently absent. |
| Additional live prose / templates | `no-op` | None touched beyond the above. |
