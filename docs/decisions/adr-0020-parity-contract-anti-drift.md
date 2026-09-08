---
status: Accepted
dependencies: [ADR-0018]
last_verified: 2026-09-08
frame_review: true
---

# ADR-0020: Parity is beacon-field parity — harness-gated, drift-guarded, hard gaps owner-re-decided

## Status

Accepted (2026-09-08)

## Context

ADR-0018 made confirmed parity the 1.0 bar and defined it as "the same events, carrying the same attribution-bearing
fields, reach the vendor as from the container," but it did not settle what that means *operationally* for airlock's
connectors — which are **hand-built reimplementations of the vendors' wire beacons, not the vendor SDK**. airlock's Meta
connector projects `id`/`ev` + non-PII standard params and **deliberately omits** `_fbp`/`fbc` and `ud[...]`
(`connectors/pixel/vendors/meta.js:10-14`); airlock's egress omits credentials and the cross-site cookie
(`core/airlock.js:48-50`); airlock's GA4 MP path omits session state and Consent-Mode modeling (R-009). So airlock ships
a **simplified tag today**, and two risks follow: **(a)** a connector could ship at non-parity while *claiming* parity
(the false-shim risk), and **(b)** a hand-built reimplementation **drifts** as the vendor's protocol evolves. The 038
parity-harness frame-critique (2026-09-08) surfaced both concretely on Meta, and the owner named them directly ("a
trivial shim… how do we avoid serious drift?"). This ADR fixes the operational parity contract and the anti-drift
mechanism. It **refines ADR-0018** (depends on it; does not supersede it).

## Decision Options Considered

### Option A: Best-effort shims; parity as a design aspiration checked by eyeball / console spot-checks
- **Pros:** cheapest; no harness build; no capture discipline.
- **Cons:** exactly the false-shim + silent-drift failure named above. "Parity" becomes **unfalsifiable**; a dropped
  attribution field is invisible until MVP9's live rewire — the most expensive possible discovery point.

### Option B: Beacon-field parity, defined per-field and gated by the harness; per-field gap ownership; harness-as-regression-guard; hard gaps → owner re-decision
- **Pros:** parity is a **measured, falsifiable, gated** claim, not an assertion; drift is **detected**, not silent; the
  scope boundary is explicit; the unbridgeable gap is **surfaced and decided**, never papered over.
- **Cons:** requires the harness build (038) **and an ongoing capture-refresh discipline**; forces the project to accept
  that some vendor attribution may be unreachable off-thread (an explicit, owner-owned outcome).

### Option C: Load the real vendor SDKs in the chamber (the SDK is the vendor's, so no reimplementation drift)
- **Pros:** no beacon-protocol drift — the runtime *is* the vendor's.
- **Cons:** defeats the airlock thesis (those SDK runtimes are the TBT airlock removes — R-010: ~70% of blocking time);
  most are DOM-native and cannot run headless in a chamber (R-007 §6 exclusions). The alloy wrapped-SDK case is the
  bounded exception, not the general connector model.

## Recommended Decision

**Option B.** Parity is **beacon-field parity at the vendor boundary — defined per attribution-bearing field and gated
by the [038 harness](../specs/038-parity-harness/spec.md)'s classified-diff oracle** (a `pass` = no `dropped` and no
divergent attribution-bearing field). A connector's parity claim **is** the harness result, not a design assertion.
Three structural commitments:

1. **Per-field gap ownership.** Every `dropped` attribution-bearing field is owned by a named artifact that closes it:
   Meta `_fbp`/`fbc` → the chamber **cookie-capability** follow-up; Meta `ud[...]` → **026-04**; GA4 session-state +
   Consent Mode → **spec 039**; the cross-site cookie transport → **E10**. A connector ships with its gap map, and 1.0
   is gated on the owned set reaching `maps` (or an explicit owner re-decision below) — never on a silent omission.

2. **Anti-drift = the harness as a regression guard, only as live as its captures.** The oracle diffs airlock against a
   **stored** capture, so it autonomously catches **airlock-side** regressions (a `maps → dropped` change that ships in
   airlock's own code); genuine **vendor-side** drift is caught only when the capture is **re-taken from a live
   container** running the vendor's updated tag — so a **stale capture can false-green a drifted connector** (the
   false-shim failure, time-shifted). The load-bearing dependency is therefore the **capture-refresh cadence** (owned as
   an open question below), not the harness alone. The drift *surface* is bounded because airlock targets **beacon
   protocols, not SDKs**: GA4 MP is a versioned, machine-validatable contract (`contracts/ga4-mp.md`) and the Meta `/tr` +
   gtag `/g/collect` shapes are documented/stable, while the Google Ads AW and Floodlight DC pings are reverse-engineered
   (a wider drift risk, mitigated by **recapture, not documentation**); **SDK-/DOM-native vendors are architecturally
   excluded by mechanism** (R-007 §6), not reimplemented, so they cannot drift airlock.

3. **Hard gaps → owner re-decision, never a silent redefinition.** The cross-site cookie (`fr`/`IDE`) is **unreadable by
   any page JS** (it is the vendor's third-party cookie, not the site's), so it can only be carried by a **credentialed
   egress** (`fetch(credentials:'include', mode:'no-cors')` from the chamber, per-endpoint allowlisted, `ad_storage`-gated)
   that lets the browser attach it — which it does on **Chrome's default (third-party cookies still allowed as of 2026)
   but not on Safari/Firefox (blocked by default, stable for years)**. So credentialed cross-site transport is
   **parity-critical for the Chrome-majority cohort**, with **first-party identifiers** (`_fbp`/`fbc`/`gclid` —
   architecturally reachable once the chamber cookie-capability lands, commitment 1's owner) as the cookieless path for
   the Safari/Firefox cohort, and **server-side conversion APIs (CAPI)** as the vendor/adopter's complementary path (a
   server-side integration, **not** an airlock client-side deliverable). Whether to build that
   credentialed egress — a security-boundary decision, since it re-attaches the ambient cross-site authority the seal
   strips — is **E10's call, and it is deferred**: MVP7 *measures* the gap (038-03), it does not close it; the transport
   implementation is parked as a **need-triggered refinement-todo**. The long-term third-party-cookie trend is
   **contested, not settled** (Chrome reversed its deprecation plan in 2024–2025), so **E10 owns the cohort-size
   question** rather than this ADR asserting it. Where a vendor's core attribution proves unbridgeable off-thread, the
   **owner re-decides the 1.0 bar** (ADR-0018 kill criterion); "parity" is never narrowed to fit the shim.

## Consequences

**Becomes easier:**
- Parity is measured, falsifiable, and gated; "is this connector at parity?" has a per-field answer, not an opinion.
- Drift is detected at the beacon boundary, cheaply and early, instead of at the MVP9 live rewire.
- The honest scope boundary (what airlock does *not* reproduce) is explicit and owned, and the hard-gap decision is
  forced into the open (E10) rather than absorbed.

**Becomes harder:**
- The 038 harness **and a capture-refresh cadence** are now load-bearing project costs, not optional tooling — the
  regression guard only guards against the last capture it was fed.
- The project must accept that some vendor attribution may be unreachable off-thread — an owned, owner-decided outcome,
  not a silent gap.
- Every connector must carry and maintain its per-field gap map.

## Assumptions

- **Grounded (read 2026-09-08):** airlock's Meta connector omits `_fbp`/`fbc`/`ud[...]` (`connectors/pixel/vendors/meta.js:10-14`);
  airlock egress sets no credentials / cross-site cookies (`core/airlock.js:48-50`); GA4 MP is a versioned contract
  (`contracts/ga4-mp.md`); R-007 §6 excludes session-replay / heatmap / live-chat / identity-resolution vendors **by
  mechanism**.
- **Web-platform facts (cited, not repo-probeable):** a vendor's third-party cookie (`fr`/`IDE`) set on the vendor
  origin is **not** in the site's `document.cookie` and is unreadable by page JS on any thread; `fetch(credentials:
  'include')` attaches it automatically from a Worker **where the browser allows third-party cookies — Chrome's default
  as of 2026; Safari (ITP) and Firefox block them by default (stable for years)**. The **long-term trend is contested,
  not settled** — Google reversed Chrome's third-party-cookie deprecation plan in 2024–2025 — so this ADR does **not**
  assert the cohort is shrinking; **E10 owns the cohort-size question** on redacted per-vendor captures before the
  transport connector is built.

## Kill criteria

- **Field presence is too coarse.** If a field can be `maps` (present, equal) yet its *value semantics* diverge in a way
  the classified diff misses (e.g. a session id that is present but minted per-page — GA4 OQ13-2), the parity contract
  needs a **value-semantics layer**, not just field presence/equality. The GA4 case already shows this (038-02 models
  `partial`); if it generalizes, "beacon-field parity" is necessary but not sufficient and this ADR is amended.
- **The capture-refresh discipline is not maintained.** If captures go stale, the anti-drift guarantee is hollow — the
  guard reduces to point-in-time parity. If the project cannot sustain a refresh cadence, the owner must decide whether
  point-in-time parity is the honest, stated bar.

## Open questions

- The capture-refresh **cadence and owner** (a harness-ops follow-up — how often, gated on what, in CI or manual).
- **E10** (the purpose-gated credentialed-transport decision) — this ADR *scopes* it (credentialed cross-site transport
  is parity-critical on the Chrome-majority cohort, cookieless first-party + CAPI on Safari/Firefox; the long-term cohort
  trend is E10's to assess, not this ADR's) but does not make it; the transport implementation is parked as a
  need-triggered refinement-todo, and E10 is its own ADR with its own frame-critique.

## Amendments

- **2026-09-08 — kill-criterion #1's "(038-02 models `partial`)" parenthetical is superseded (owner-approved).** When
  this ADR was accepted, spec 038-02 (the GA4 field-map oracle) was DRAFT and modelled the "present but lossy" case as a
  `partial` bucket. 038-02 **as built** (DONE 2026-09-08) **retired `partial`**: it reuses 038-01's engine buckets
  (`maps` / `normalised-out` / `dropped` / `expected-dropped` / `gap-closed` / `divergent`) and models GA4 **session
  continuity** (OQ13-2) as a **scope residual** — owned here + by spec 039's gtag connector, surfaced as a report note
  rather than a per-field bucket. That residual is itself an instance of kill-criterion #1's "field present/equal yet
  semantics diverge (across beacons)," so the criterion's **substance is unchanged and confirmed**; only the
  parenthetical example is corrected. The original Kill-criteria prose above is preserved per the immutability convention
  (ADR-0010).
