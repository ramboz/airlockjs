---
status: Proposed
dependencies: [adr-0007, adr-0018]
last_verified:
frame_review: true
---

# ADR-0026: OneTrust consent-input driver reads OneTrust's own resolved-consent surface

## Status

Proposed (2026-09-13)

## Context

Spec 047's OneTrust consent-input driver — the first concrete driver on ADR-0007's consent-input seam (MVP8 fixed-core,
authorized by [ADR-0018](./adr-0018-reframe-onto-adoptable-one-point-oh.md) E7) — must choose which client-side surface it
reads OneTrust's resolved consent from, a choice [ADR-0007](./adr-0007-consent-purpose-model.md) deliberately left open (its
Open questions name the seam contract — "Consent Mode `gtag` / IAB `__tcfapi` / host callback" — as "pinned with the seam").
The driver is input-only: it maps OneTrust's resolved consent to `core/consent.js`'s purpose vector and feeds the existing
seam; the egress hold/flush is already built (spec 045 / ADR-0023).

A read-only live probe of the reference site (`erp.intuit.com`, 2026-09-13, `rig/onetrust-consent-probe.mjs`; raw
local-only per R5) found the deployment exposes, in principle, two *kinds* of surface: **(1) OneTrust's own state** —
`window.OneTrust.GetDomainData()` (a group model under a **custom** taxonomy: `3` Analytics → `analytics_storage`, `4`
Advertising-Targeting → `ad_storage`, `41` User-Data → `ad_user_data`, `42` Personalization → `ad_personalization`), the
`OptanonConsent` cookie (`groups=<id>:1|0` flags), the `OnetrustActiveGroups` string, and the `OnConsentChanged` /
`OptanonWrapper` change signals — and **(2) the already-resolved Consent Mode v2 signals** the site's Tealium profile
publishes (`gtag('consent','update',…)` / `google_tag_data.ics`, in airlock's exact vocabulary).

**Critical limit of that probe (frame-critique, this ADR):** it was **read-only, pre-interaction, on an opt-out /
US-default-granted page**, so config-default and resolved-consent coincide — the capture contains **no observation that
discriminates "does this surface track the user's choice" from "is this surface the configured default."** Worse, the
degraded run's surfaces *disagreed*: the `OptanonConsent` cookie and `OnetrustActiveGroups` showed only `{1, BG394, 4}`,
while `GetDomainData().Groups[].Status` showed nearly every group active and the CM signals showed all four granted. So the
probe grounds the *shape and existence* of these surfaces, **not** which one carries resolved per-user consent — and
`GetDomainData().Status`, being domain configuration, is the one most likely to be a configured default rather than the
user's choice. Reading the wrong surface fails in the **unsafe** direction (report `granted` for an opted-out user → the
seal releases ad beacons that should stay held).

## Decision Options Considered

### Option A: Read OneTrust's own resolved-consent surface + a host-provided group→purpose map (RECOMMENDED)

The driver reads OneTrust's **resolved per-user consent** and maps each granted group to purposes via a host-supplied
`{ <groupId>: ConsentPurpose[] }` map. The **exact** OneTrust surface that carries resolved consent — the `OptanonConsent`
cookie `groups=<id>:1|0` flags (OneTrust's documented persisted consent record — *leading candidate*), `OnetrustActiveGroups`,
or `GetDomainData().Groups[].Status` — is **not yet grounded** (see Context) and is pinned by a discriminating experiment
before 047-01 implements (Assumptions + Kill criteria).

- **Pros:** It *is* the OneTrust driver (faithful to the spec title + MVP8's named deliverable). Reads OneTrust's consent
  intent **at the source**, independent of any downstream tag manager — so it works on OneTrust deployments that gate
  scripts directly and never bridge to Consent Mode. Reusable to any OneTrust site by swapping the host map. The mapping is
  **explicit, auditable config**, not logic hidden in a Tealium profile. No coupling to Google gtag internals.
- **Cons:** Needs a **site-specific** map (OneTrust group ids are site-defined). Requires grounding **which** OneTrust
  surface reflects resolved consent (the naive first pick, `GetDomainData().Status`, is suspected configured-default and is
  explicitly **not** trusted until the experiment shows it flips on opt-out). If *no* OneTrust surface tracks the user
  client-side, Option A cannot stand for that deployment (Kill criteria).

### Option B: Consume the already-resolved Consent Mode v2 signals (`gtag` / `google_tag_data.ics`)

- **Pros:** No map — already in airlock's vocabulary; the OneTrust→purpose mapping is done by the site's Tealium profile;
  it is (by construction) the *resolved* state, sidestepping Option A's "which surface is resolved" problem.
- **Cons:** This is **not** the OneTrust driver — it is ADR-0007's *separate Consent Mode `gtag` driver*, one of the three
  seam drivers ADR-0007 names in its own right. It couples airlock's consent input to Google gtag internals
  (`google_tag_data.ics` is a private, undocumented object). It only works where a downstream has *already* bridged OneTrust
  → CM v2 — deployment-specific, not intrinsic to OneTrust — so it silently fails on a direct-gating OneTrust site. Adopting
  it *as* the OneTrust driver conflates two distinct ADR-0007 drivers. (Kept as the documented fallback if Option A's Kill
  criterion fires.)

### Option C: Read `GetDomainData().Groups[].Status` as the grant signal

- **Pros:** Richest single OneTrust object (names + status + config in one call); more entries than the cookie in the probe.
- **Cons:** `GetDomainData()` is domain **configuration**; the probe cannot show `Status` reflects the *user's* resolved
  choice (pre-interaction, opt-out-default, non-discriminating), and it read as near-all-active while the persisted cookie
  showed a subset — i.e. it looks like the configured default. Trusting it as the grant signal is the **unsafe** failure
  (grant an opted-out user). Rejected as the grant surface; `GetDomainData()` is still used for the group **taxonomy/names**
  (which *is* config).

## Recommended Decision

**Option A** — the OneTrust consent-input driver reads OneTrust's **own resolved-consent surface** and maps groups → the
`core/consent.js` vector through a **host-provided `{ groupId: ConsentPurpose[] }` map**. It does **not** consume the
resolved Consent Mode v2 signals (Option B) — that is a legitimate but **separate** ADR-0007 gtag driver, out of scope and
the documented fallback.

**The exact resolved-consent surface is NOT decided here — it is gated on a discriminating experiment.** The leading
candidate is the `OptanonConsent` cookie `groups=<id>:1|0` flags (OneTrust's persisted consent record); `GetDomainData().Status`
is explicitly rejected as the grant signal (suspected configured-default). Before 047-01 implements, a **click-through
re-capture** — opt out of one ad group in the OneTrust banner and observe **which** surface's flag flips to denied — pins the
surface. `GetDomainData()` is used only for the group taxonomy/names regardless.

This **partially resolves ADR-0007's open seam-contract question for the OneTrust facet** at the architectural level (read
OneTrust's own resolved consent, via a host map, not the gtag signals); it deliberately leaves the exact resolved-surface
read to be *grounded, not assumed*. It does not decide the `gtag`/`__tcfapi` drivers or the strict/no-processing regime.

## Consequences

**Becomes easier:**
- The OneTrust driver reads OneTrust's *own* intent, so it is correct on OneTrust deployments regardless of whether they
  bridge to Consent Mode — the broad-adoption case, not just the reference site.
- Reuse across OneTrust sites is a config change (swap the host map), not a code change.
- Option B stays cleanly available as its own future *Consent Mode `gtag` driver* (ADR-0007), un-conflated, and as the
  documented fallback if OneTrust exposes no resolved surface client-side.

**Becomes harder:**
- Every OneTrust deployment needs a site-specific group→purpose map **and** a grounded answer to "which surface is resolved
  consent here" (a per-site experiment), before the driver can be trusted — more onboarding work than a naive single read.
- The driver depends on OneTrust's surface shape (a vendor API); a change there is a driver change.

## Assumptions

<!-- Spec 064-02 / ADR-0020 §1–§2 — grounding-by-probe. The existence/shape claims are probe-grounded (rig/onetrust-consent-probe.mjs, 2026-09-13); the load-bearing SEMANTIC claim below is explicitly NOT grounded and gated on an experiment. -->

- **LOAD-BEARING, UNVERIFIED — which OneTrust surface reflects resolved *user* consent (vs configured default).** The
  2026-09-13 probe was read-only, pre-interaction, opt-out/default-granted, and its surfaces disagreed, so it **cannot**
  discriminate resolved-consent from config-default. Grounded by a **click-through opt-out re-capture** (a hard 047-01
  grounding gate): opt out of one ad group and confirm which surface's flag flips to denied. Until then the driver treats
  the `OptanonConsent` cookie `groups` flags as the resolved read (leading candidate) and **must not** trust
  `GetDomainData().Status` as the grant signal. Getting this wrong releases ad beacons against denied consent — the failure
  the whole seal exists to prevent.
- **GROUNDED (shape only):** the reference site exposes these surfaces client-side at boot under a custom numeric group
  taxonomy with the seed map above; `GetDomainData()` gives the group names (config). The full non-degraded set is confirmed
  by the same re-capture.

## Kill criteria

- **No OneTrust surface flips to denied on a user opt-out** (all surfaces stay at configured default client-side; consent is
  enforced server-side only). Then OneTrust does not expose resolved consent on the page for this deployment, Option A cannot
  read it, and the driver falls back to the **Option-B gtag-signal driver** (where a CM bridge exists) or a host-callback
  vector. This is discovered by the gating experiment **before** implementation, not after shipping.
- **Per-site group→purpose maps + per-site resolved-surface experiments prove unworkable at adoption scale.** Then lean on
  the Option-B gtag driver where a CM bridge already exists, and reserve Option A for direct-gating OneTrust sites.

## Open questions

- The exact resolved-consent surface (`OptanonConsent` cookie flags vs `OnetrustActiveGroups` vs neither) — pinned by the
  047-01 gating experiment, not here.
- The `gtag` / `__tcfapi` seam drivers and the strict/no-processing regime declaration remain ADR-0007-open.
- Whether a `BG…` branch group (e.g. the probed "Allow Information Sharing" / CCPA toggle) also gates `ad_user_data` — a
  per-site host-map detail, grounded with the same experiment.
