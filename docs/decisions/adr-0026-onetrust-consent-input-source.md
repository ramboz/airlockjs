---
status: Accepted
dependencies: [adr-0007, adr-0018]
last_verified: 2026-09-13
frame_review: true
---

# ADR-0026: OneTrust consent-input driver reads OneTrust's own resolved-consent surface

## Status

Accepted (2026-09-13)

## Context

Spec 047's OneTrust consent-input driver — the first concrete driver on ADR-0007's consent-input seam (MVP8 fixed-core,
authorized by [ADR-0018](./adr-0018-reframe-onto-adoptable-one-point-oh.md) E7) — must choose which client-side surface it
reads OneTrust's resolved consent from, a choice [ADR-0007](./adr-0007-consent-purpose-model.md) deliberately left open (its
Open questions name the seam contract — "Consent Mode `gtag` / IAB `__tcfapi` / host callback" — as "pinned with the seam").
The driver is input-only: it maps OneTrust's resolved consent to `core/consent.js`'s purpose vector and feeds the existing
seam; the egress hold/flush is already built (spec 045 / ADR-0023).

Two live probes of the reference site (`erp.intuit.com`, 2026-09-13; `rig/onetrust-consent-probe.mjs` read-only +
`rig/onetrust-optout-probe.mjs` a consent-changing opt-out; raw local-only per R5) exposed OneTrust's own surfaces
(`OnetrustActiveGroups` / the `OptanonConsent` cookie `groups=<id>:1|0` flags / `GetDomainData()` under a custom taxonomy /
the `OnConsentChanged` / `OptanonWrapper` change signals) **and** the already-resolved Consent Mode v2 signals the site's
Tealium profile publishes (`gtag`/`google_tag_data.ics`).

**What the opt-out experiment establishes — and its limit.** A same-session `OneTrust.RejectAll()` before/after diff yields
one **degradation-independent** result (the two surfaces are compared under identical session conditions, so any geo/network
degradation cancels): `GetDomainData().Groups[].Status` **did not change** on opt-out → it is OneTrust's **configured
default**, unsafe to read as the grant signal; `OnetrustActiveGroups` / the `OptanonConsent` cookie flags **did change** →
they carry **resolved per-user consent**. **That is the only thing the experiment grounds.** It does **not** ground the
group→purpose map's *granularity*: `RejectAll()` denies every optional group at once (it cannot isolate any single group),
and both probe sessions were **geo-degraded** (the read-only run recorded `geolocation: null` + a `403`; the opt-out run's
`before` set `{1, BG394, 4}` already lacked groups `3`/`41`/`42`). So whether `3`/`41`/`42` are independently
consent-tracked — or were merely absent because the session never resolved geo — is **unverified**, and the host-map's shape
must not be frozen on this run.

## Decision Options Considered

### Option A: Read OneTrust's own resolved-consent surface + a host-provided group→purpose map (CHOSEN)

The driver reads OneTrust's **resolved** consent from the surface the experiment grounded — `OnetrustActiveGroups` (the
granted-group set), equivalently the `OptanonConsent` cookie `groups` flags — and maps each granted group to purposes via a
host-supplied `{ <groupId>: ConsentPurpose[] }` map. It **does not** read `GetDomainData().Groups[].Status` for grant state
(experiment: configured-default); `GetDomainData()` is used only for group taxonomy/names.

- **Pros:** It *is* the OneTrust driver (faithful to the spec title + MVP8's named deliverable). Reads OneTrust's consent
  intent **at the source**, independent of any downstream tag manager — so it works on OneTrust deployments that gate scripts
  directly and never bridge to Consent Mode. Reusable to any OneTrust site by swapping the host map. Explicit, auditable
  config; no coupling to Google gtag internals.
- **Cons:** Needs a **site-specific** host map whose **granularity is not yet grounded** (see Context) — building it needs a
  per-site, **non-degraded, per-group-toggle** experiment (below), more onboarding work than a naive read. For a CM-bridged
  site like the reference site, Option B reads the already-computed answer with less work; Option A trades that for
  source-fidelity and no-bridge portability. (Owner decision 2026-09-13: accept this trade — keep the OneTrust driver.)

### Option B: Consume the already-resolved Consent Mode v2 signals (`gtag` / `google_tag_data.ics`)

- **Pros:** No map — already in airlock's vocabulary; the OneTrust→purpose mapping is done by the site's Tealium profile;
  probe-confirmed to flip correctly on opt-out. Least work on a CM-bridged site.
- **Cons:** This is **not** the OneTrust driver — it is ADR-0007's *separate Consent Mode `gtag` driver*. It couples
  airlock's consent input to Google gtag internals (`google_tag_data.ics` is private/undocumented) and only works where a
  downstream has already bridged OneTrust → CM v2 (deployment-specific), so it silently fails on a direct-gating OneTrust
  site. Kept as the documented **fallback** for CM-bridged deployments and the future standalone gtag driver.

### Option C: Read `GetDomainData().Groups[].Status` as the grant signal (REJECTED — experiment-disproven)

- **Cons:** The opt-out experiment showed `Status` **does not change** when the user denies — it is domain configuration, not
  resolved consent. Reading it as the grant signal is the **unsafe** failure (grant an opted-out user → release held ad
  beacons). Rejected outright; `GetDomainData()` is used for taxonomy/names only.

## Recommended Decision

**Option A** — the OneTrust consent-input driver reads OneTrust's **own resolved-consent surface** (`OnetrustActiveGroups` /
the `OptanonConsent` cookie `groups` flags — experiment-grounded) and maps the granted groups → the `core/consent.js` vector
through a **host-provided `{ groupId: ConsentPurpose[] }` map**. It does **not** read `GetDomainData().Status` for grant state
(configured-default) and does **not** consume the resolved Consent Mode v2 signals (Option B — ADR-0007's separate gtag
driver, kept as the CM-bridged fallback).

**The host-map's shape and adequacy are NOT decided here** — the degraded, all-at-once probe cannot establish them, and the
site's real OneTrust→purpose logic lives in Tealium (R-007), uninspected; it may not be a static per-group `{ groupId:
purposes[] }` function at all (e.g. **combinational** — `RejectAll()` flipped the non-CM branch `BG394` in lockstep with ad
group `4` — or **region-conditional**). Before 047-01 freezes the host-map contract, ground it two ways: **(i)** a
**non-degraded, per-group-toggle experiment** (resolve geo / spoof an EEA locale so the full group set materializes, deny one
group at a time, observe which purposes drop), and **(ii)** **cross-validate the driver's output vector against the site's
own resolved Consent Mode vector** (`google_tag_data.ics` / gtag — the available ground truth on `erp.intuit.com`) across
consent states. If the per-group-map output cannot be reconciled to that ground-truth vector across states, the mapping is
not a static per-group function → Option A's map is insufficient here (Kill criteria). The decision recorded here rests
**only** on the degradation-independent surface finding, not on any map-shape claim.

This **partially resolves ADR-0007's open seam-contract question for the OneTrust facet**: source = OneTrust's own resolved
surface, mapping = host config (shape grounded at implementation). It does not decide the `gtag`/`__tcfapi` drivers or the
strict/no-processing regime.

## Consequences

**Becomes easier:**
- The OneTrust driver reads OneTrust's *own* resolved intent, correct on OneTrust deployments regardless of whether they
  bridge to Consent Mode — the broad-adoption case.
- Reuse across OneTrust sites is a config change (swap the host map), not a code change.
- Option B stays cleanly available as the CM-bridged fallback and a future standalone *Consent Mode `gtag`* driver
  (ADR-0007), un-conflated.

**Becomes harder:**
- Each OneTrust deployment needs a site-specific host map whose **shape is grounded by a non-degraded per-group experiment**
  (the config taxonomy is not a reliable proxy for the resolved-consent granularity) — more onboarding work than a naive read.
- The driver depends on OneTrust's surface shape (a vendor API); a change there is a driver change.

## Assumptions

<!-- Spec 064-02 / ADR-0020 §1–§2 — grounding-by-probe. Only the differential surface finding is grounded; the map-shape claim is explicitly NOT, per the frame-critique. -->

- **GROUNDED (opt-out experiment, degradation-independent):** `OnetrustActiveGroups` / the `OptanonConsent` cookie flags
  reflect resolved per-user consent (change on opt-out); `GetDomainData().Status` is configured-default (does not change).
  The decision rests on this alone.
- **UNVERIFIED (load-bearing for the host-map contract — must be grounded before 047-01 freezes it):** the map's **shape and
  adequacy** — not only which groups gate which purposes and whether `3`/`41`/`42` are independent, but whether a static
  per-group `{ groupId: purposes[] }` map can express the site's logic **at all** (it may be combinational or
  region-conditional; the resolving logic is Tealium-side, uninspected). The single all-at-once `RejectAll()` on a
  geo-degraded session cannot establish this. Grounded by the per-group-toggle experiment **and** cross-validation of the
  driver's output against the site's own resolved Consent Mode vector across states (Recommended Decision).

## Kill criteria

- **A target OneTrust deployment exposes no surface that changes on opt-out** (consent resolved server-side only). Then
  Option A cannot read resolved consent there — fall back to the Option-B gtag driver (where a CM bridge exists) or a
  host-callback vector. (Not the case on the reference site — a surface does change.)
- **The mapping is not a static per-group function** — the driver's per-group-map output cannot be reconciled to the site's
  own resolved Consent Mode vector across consent states (the site's logic is combinational, region-conditional, or
  irreducibly conflates purposes airlock must gate separately). Then Option A's map is insufficient for that site; prefer the
  Option-B gtag driver on CM-bridged sites (parity-correct by construction).

## Open questions

- The host-map's **shape and** granularity per site (grounded by the per-group-toggle experiment **+ cross-validation
  against the site's own resolved Consent Mode vector** before 047-01 freezes it — incl. whether a static per-group map can
  express the site's logic at all).
- The `gtag` / `__tcfapi` seam drivers and the strict/no-processing regime declaration remain ADR-0007-open.
