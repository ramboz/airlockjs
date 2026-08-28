---
status: Accepted
dependencies: []
last_verified: 2026-08-28
frame_review: true
---

# ADR-0007: Purpose-dimensioned consent for per-capability grants

## Status

Accepted (2026-08-28)

## Context

Airlock gates egress on a single global consent state, which cannot express the
per-purpose granularity that both privacy law and GA4's own Consent Mode v2
signals assume. AD-9 (architecture.md) makes consent a lone pending→granted
gate: the seal holds egress until activation and is prerender-aware, but it is
one switch for the whole page. OQ13 item 1 confirms the seam is even narrower in
practice — "the seal gates egress only (AD-9); the first-party `_ga` write is
consent-ungated in MVP1."

[ADR-0006](./adr-0006-capability-manifest.md) makes this a blocking gap. Its I/O
law is `granted = declared ∩ host-policy ∩ consent/user-choice`, and it flagged
the consent term as the one piece that needs a product call. With a **binary
global** consent state the term is degenerate — a single multiplier applied to
every channel of every connector at once — so the "selectively gated by consent
or user choices" thesis collapses to "everything on or everything off." A page
that runs an analytics connector and an advertising connector cannot honour
"analytics yes, ads no," which is exactly the granularity GDPR/ePrivacy and the
CMP ecosystem are built around, and exactly what GA4 expects: **Consent Mode v2**
carries distinct `analytics_storage`, `ad_storage`, `ad_user_data`, and
`ad_personalization` signals, mandatory for EEA traffic since 2024.

So the consent term in ADR-0006's law must be a **vector, not a scalar**: a set
of independently-grantable *purposes*, resolved per declared capability. This ADR
decides that model and its default posture; it deliberately does **not** pin the
full taxonomy or the CMP wire format (those ride a consent-input seam, below).

**Scope and timing.** MVP1 shipped; this is MVP2 work, coupled to ADR-0006 and to
the seal (ADR-0004). It refines the AD-9 proto-decision (binary → dimensioned)
rather than superseding an accepted ADR.

## Decision Options Considered

### Option A: Keep binary/global consent (status quo, AD-9)

- **Pros:** Simplest; already implemented for the egress seal; adequate for a
  single-purpose, analytics-only page (the literal MVP1 GA4 case).
- **Cons:** Cannot attenuate per purpose, so ADR-0006's consent term is a global
  on/off and its per-capability grant story does not exist. Cannot honour
  "analytics yes, ads no." Does not match GA4's own Consent Mode v2 signals, so
  airlock would have to collapse four Google signals into one — losing
  information the connector needs to set its own gcs/gcd state correctly.

### Option B: Purpose-dimensioned consent, Consent-Mode-aligned starter set (RECOMMENDED)

A small set of independently-grantable purposes — the Consent Mode v2 four
(`analytics_storage`, `ad_storage`, `ad_user_data`, `ad_personalization`), plus
`functional`/`personalization` as connectors need them — each defaulting to
pending/denied, sourced through a **consent-input seam** (a CMP driver:
Consent Mode `gtag`, IAB `__tcfapi`, or a host-provided callback), and enforced
per purpose at the airlock chokepoints. The manifest (ADR-0006) tags each
declared capability/endpoint/read with the purpose(s) it serves; the grant
resolver consults consent state for those purposes.

- **Pros:** Makes ADR-0006's law real — the consent term becomes a per-capability
  vector. Matches the legal model and GA4's native signals. Per-connector,
  per-purpose attenuation. A seam means "add TCF" or "swap CMP" is a driver swap,
  not a rewrite (mirrors AD-1). Preserves AD-9's held-until-activation +
  prerender-aware behaviour, now per purpose.
- **Cons:** Needs a purpose taxonomy, a consent-input seam contract, and a
  manifest purpose annotation. The taxonomy choice couples to the connector
  ecosystem (GA4 → Consent Mode; an ad-tech publisher → TCF), risking a starter
  set that a later deployment outgrows.

### Option C: Full IAB TCF v2.2 (purposes 1–11 + vendor consent + Global Vendor List)

- **Pros:** The ad-tech industry standard; maximal publisher interop; vendor-scoped
  consent and encoded TC strings.
- **Cons:** Heavy (GVL, TC-string decode, `__tcfapi` event loop) and premature for
  a GA4-first MVP2 whose connectors are not registered IAB vendors. A lot of
  machinery before it pays off. Better modelled as a **driver onto Option B's
  seam** when an actual TCF deployment appears than as the core consent model.

## Recommended Decision

**Option B.** Consent is a set of independently-grantable purposes; the grant
resolver in ADR-0006's law reads the vector, not a scalar.

- **Starter taxonomy: the Consent Mode v2 four** (`analytics_storage`,
  `ad_storage`, `ad_user_data`, `ad_personalization`), because GA4 is the first
  and second connector and this is its native model; extend with `functional` /
  `personalization` when a connector needs them. The set is intentionally small
  and behind the seam, so a wrong guess is a driver/taxonomy revision, not a
  rewrite.
- **A consent-input seam.** Airlock does not implement a CMP; it accepts consent
  state through a driver (Consent Mode `gtag('consent', …)`, IAB `__tcfapi`, or a
  host callback) exactly as it accepts decision-source and egress through seams.
  The TCF full model (Option C) becomes a driver on this seam later.
- **Denial behaviour is per-channel and per-regime — not a uniform seal hold.**
  This is the correction the Consent Mode taxonomy forces: a *denied* purpose does
  not mean the same thing on every channel.
  - **Pending** (no signal yet): hold at the seal + flush-on-arrival (AD-9 / Q2),
    per purpose; prerender-aware holding is per purpose. Unchanged.
  - **Denied — a *storage* purpose** (`analytics_storage` / `ad_storage`): a genuine
    deny at the **cookie/storage capability** — don't write `_ga` / identity, drop
    the persistent client_id (OQ13 item 1). These are client-storage concepts; the
    MP body has no field for them, so the beacon still sends — but it needs an
    *ephemeral, non-persisted* `client_id`, because the pinned MP schema
    (`contracts/ga4-mp-request.schema.json`) requires `client_id` and a beacon with
    none fails the `ga4_mp_conformance` oracle. Minting that ephemeral id is
    identity-ctx sourcing, not something the cookie capability alone does — so a
    *storage* denial actually touches **two** places (the cookie write **and**
    identity sourcing), a small qualification to "one signal → one enforcement
    point."
  - **Denied — a *data-use* purpose** (`ad_user_data` / `ad_personalization`):
    *reshape and send* at the **mapper**, not a hold. Airlock's GA4 connector uses
    the **Measurement Protocol** to a fixed endpoint
    ([`mpUrl`](../../connectors/ga4/map.js) → `google-analytics.com/mp/collect`), so
    the mechanism is the **MP `consent` body field**, *not* gtag's gcs/gcd query
    params (a `/g/collect` client-beacon concept airlock does not use). The hook
    already exists — [`map.js:74`](../../connectors/ga4/map.js) sets
    `body.consent = ctx.consent` with `{ ad_user_data, ad_personalization }`. So a
    denied data-use purpose sets the MP `consent` object DENIED and the beacon
    **still POSTs**; the seal does not hold it. **Posture, stated plainly:** for GA4
    this *delegates* data-use-denial enforcement to Google's server-side honoring —
    the full event still crosses the seal with `consent` DENIED — rather than
    withholding it. That is lawful and Consent-Mode-correct for GA4 (`ad_user_data`
    denial restricts ad *use*, not measurement transmission) and is the only MP
    mechanism, but it is a deliberate departure from the "nothing crosses the seal
    unhonoured" thesis; a future connector whose vendor offers **no** server-side
    consent flag falls to the partial-payload/drop kill criterion below, not to this
    delegate-and-send path.
  - **Denied — egress under a strict / TCF no-processing regime**: drop or hold at
    the seal (no beacon at all). Which regime applies is a host-policy / connector
    property, declared alongside the consent-input driver.
- **The consent vector is consumed at three enforcement points, not one:** the
  cookie/storage capability grant (deny the write), the connector's **mapper**
  (reshape the payload — the Consent Mode case), and the **seal** (hold-pending /
  strict-drop). ADR-0006's grant resolver *produces* the vector; these three
  *consume* it. Collapsing them into a single seal hold is the error this ADR
  exists to prevent.
- **Manifest carries the purpose annotation** (ADR-0006): each declared
  capability/endpoint/read names the purpose(s) it serves, so denial is
  per-declared-I/O, not per-connector.

Staging: MVP2 delivers the vector consent state + the consent-input seam + the
three-point enforcement above (capability-deny for cookies, mapper-reshape for
Consent Mode egress, seal-hold for pending) — unblocking ADR-0006's consent half
and OQ13 item 1's identity-write gating. The TCF driver and the end-user per-tag
choice surface (finer than purpose — ADR-0006's "user choices" horizon) are later.

## Consequences

**Becomes easier:**
- ADR-0006's grant law has a real consent term; "analytics yes, ads no" is
  expressible and enforceable per connector.
- The four signals fall out cleanly on GA4 by transport: the *storage* signals
  (`analytics_storage` / `ad_storage`) gate the cookie capability (no `_ga` write),
  and the *data-use* signals (`ad_user_data` / `ad_personalization`) set the MP
  `consent` body field ([`map.js:74`](../../connectors/ga4/map.js)) on a beacon that
  **still POSTs** — rather than the seal wrongly holding it. The reshape model makes
  this expressible; a uniform seal hold could not. (gtag's gcs/gcd cookieless ping
  is the `/g/collect` sibling mechanism; airlock uses the MP, not gtag.)
- OQ13 item 1 (consent-gating the `_ga` write) has a home: the cookie write is
  tagged `analytics_storage` and gated like any other declared capability.
- New CMPs / consent regimes arrive as seam drivers, not core changes.

**Becomes harder:**
- The seal's consent check goes from one boolean to a per-purpose lookup; every
  gated channel must name its purpose.
- Enforcement is now three-point (capability, mapper, seal): a connector's mapper
  must consume the consent vector and implement reshape (gcs/gcd, id-strip), so
  mapping is no longer consent-agnostic. The per-purpose ring retention +
  flush-on-arrival (Q2) applies only to the *pending* hold, not to denied-reshape.
- Consent *updates* mid-session need per-purpose replay/stop semantics (a
  per-purpose version of Clarifications Q2's flush-on-arrival).
- A purpose taxonomy is now a contract surface with its own compatibility
  concerns.

## Assumptions

<!-- Spec 064-02 / ADR-0020 §1–§2 — grounding-by-probe (risk-gated). -->

- AD-9 is currently a single global consent gate and the identity-cookie write is
  consent-ungated — grounded in architecture.md (AD-9), the glossary (the seal),
  and refinement-todo OQ13 item 1, not assumed.
- GA4 consumes Consent Mode v2's four signals (`analytics_storage`, `ad_storage`,
  `ad_user_data`, `ad_personalization`) and expects them distinct — external domain
  knowledge about Google Consent Mode; **verify against current Google documentation
  before implementation.** But the *transport split* is repo-**grounded**: airlock's
  GA4 connector uses the **Measurement Protocol** to a fixed endpoint and already
  threads an MP `consent` object (`ad_user_data` / `ad_personalization`) — verified
  by reading [`connectors/ga4/map.js`](../../connectors/ga4/map.js) (`mapToMp`
  `body.consent`; `mpUrl` → `/mp/collect`). So the egress reshape mechanism is the MP
  `consent` field, not gtag gcs/gcd, and the storage signals
  (`analytics_storage` / `ad_storage`) are not MP payload fields — they are enforced
  at the cookie capability. A wrong or aged *semantic* detail is a driver revision,
  not a structural bet.
- The orchestrator already owns consent state on the main thread (architecture §
  Module boundaries), so dimensioning it does not move where consent lives.

## Kill criteria

- **The first real deployment is an IAB-TCF publisher context.** Then the
  Consent-Mode-aligned starter set is insufficient and the TCF driver must lead —
  the signal is to prioritise the TCF seam driver, not to abandon purpose
  dimensioning.
- **Connectors cannot be cleanly mapped to a small purpose set** (one connector
  serves several purposes ambiguously). Then per-connector purpose tagging is too
  coarse — move the purpose annotation to per-capability/per-endpoint (which
  ADR-0006's manifest already permits) rather than widening the taxonomy.
- **The actual MVP2 connector set is all-analytics**, so purpose dimensioning adds
  no observable legal/UX value yet. That is a reason to keep the vector *minimal*
  (analytics vs the rest), not to drop it — ADR-0006 still needs a non-degenerate
  consent term, and retrofitting dimensionality after connectors ship against a
  scalar is the breaking change this ADR exists to avoid.
- **A connector's denial need doesn't fit the deny / reshape / hold trichotomy.**
  If a real connector requires denial behaviour that is none of {deny-write,
  reshape-and-send, hold-or-drop} — e.g. a partial-payload send, or defer-until-
  grant for egress — the three-point model is too coarse and the denial-behaviour
  matrix needs another row, surfaced before connectors ship against the current
  three.

## Open questions

- Final taxonomy (Consent Mode four vs + `functional`/`personalization` vs TCF
  full) and where the seam-driver boundary sits.
- The consent-input seam contract (Consent Mode `gtag` / IAB `__tcfapi` / host
  callback) — pinned with the seam, coupled to the connector contract at step 5.
- Where reshape lives and how the regime is declared: the connector's mapper owns
  Consent-Mode reshape (consuming the consent vector), but the choice of regime
  (Consent Mode reshape vs strict drop) must be declared somewhere — the
  consent-input driver, the host policy, or the connector manifest. Pin with the
  seam contract. Reshape must also land at **both** mapping sites — the worker
  `mapBatch` and the main-thread unload fast path (`core/egress.js`, ADR-0004 /
  OQ16) — or an unload-critical data-use-denied beacon egresses without the consent
  flag. OQ16 already tracks fast-path mapper parity.
- Consent-update semantics mid-session: on grant, replay *pending*-held events
  (Q2 flush-on-arrival, per purpose); on revoke, stop future egress for that
  purpose (already-sent cannot be unsent).
- OQ13 item 1: confirm the identity-cookie write gates on `analytics_storage`
  with the cookie-grant-wrapper work.
- Interaction with AD-9 prerender-aware holding, now evaluated per purpose.
