---
status: Accepted
dependencies: [adr-0018]
last_verified: 2026-09-15
frame_review: true
---

# ADR-0029: MVP9 after-arm is page-side and developer-controlled

## Status

Accepted (2026-09-15)

## Context

MVP9 is the 1.0 gate: rewire an intuit-class site's four TBT-dominant vendor tags (GA4, Meta Pixel, Google Ads,
Floodlight) from its tag-manager container onto airlock, prove parity + the CWV win, ship the adoption path
([mvp9.md](../releases/mvp9.md), [ADR-0018](./adr-0018-reframe-onto-adoptable-one-point-oh.md) Emergent E3). As written, MVP9
makes the **after-arm** — the arm where the four tags stop firing so airlock's equivalents can be measured against it — a
**Tealium profile change** (same-host, query-gated native-exclusion load rules published to the production `ies-erp`
profile). That makes it **container-owner-gated**: ADR-0018's "two-party" dependency, where the developer cannot produce the
proof alone and 1.0 waits on the customer's Tealium admin.

The owner's constraint (2026-09-15): **we must be able to run the trial without the customer changing anything on their
martech stack** — no Tealium profile change. Grounding the reference site's own repo (`intuit-erp`, an EDS/Franklin project
the developer owns) shows this is achievable page-side:

- **The repo owns the injection seam.** `plugins/tealium-martech/src/index.js`'s `loadUtag` injects `utag.js` — and utag
  injects the vendor runtimes (`gtag.js`, `fbevents.js`) — via `document.createElement('script')`. The page controls the
  order, so a suppressor installed before `loadUtag` can neutralize the migrated vendors.
- **The repo already has the idiom + a measurement harness.** Query-gated martech toggles (`?martech=off`/`=local`,
  `?tealium-phase`, `?tealium-tags`) are established, and `scripts/diff/martech-diff.mjs` + `martech.golden.json` (a
  production beacon capture) is a ready-made capture→diff parity substrate; the `clicktrack`/`appvars` goldens guard that
  the untouched ~20 other tags + the custom ECS chain still fire.
- **The naive page-side lever is insufficient — but the repo can go further.** Per the repo's own `MARTECH.md`, the
  `?tealium-tags=` allowlist only gates which tags receive lifecycle *events* — utag still downloads/initializes every
  active `utag.<uid>.js` template at INIT. So the after-arm must suppress the vendor **runtimes** (the ~150 KB `gtag.js` /
  `fbevents.js` that carry the TBT), which the page CAN do because it owns the injection seam (the mechanism is
  [ADR-0030](./adr-0030-native-tag-suppressor.md)).

The question this ADR settles: is the MVP9 after-arm a container-owner action, or a developer action in the adopter's own
EDS repo?

## Decision Options Considered

### Option A: container-owner profile-side native exclusion (the original mvp9 after-arm)
The `ies-erp` Tealium profile publishes native-exclusion load rules so the four tags stop firing for all users.
- **Pros:** authoritative and production-wide by construction; the after-arm is real for every visitor.
- **Cons:** **container-owner-gated** — the developer cannot produce it alone, so the *entire* local proof (rewire works,
  CWV win, event-level parity, scripted path) waits on the customer's Tealium admin. This is the exact dependency the owner
  says cannot be relied on. It over-couples the developer-provable majority of MVP9 to a two-party action that is only
  strictly necessary for the production live-attribution window.

### Option B: page-side, developer-controlled suppression in the adopter's owned EDS repo (chosen)
A query-gated (`?martech=airlock`) suppressor in `intuit-erp` blocks the four migrated vendors' runtime scripts + beacons
before `loadUtag` runs (pattern-scoped, so the other ~20 tags + the ECS chain are untouched); airlock (vendored as the
`dist-v0.8.0` subtree) boots the four connectors and emits the governed off-thread equivalents.
- **Pros:** the Lighthouse/TBT win, event-level parity (the 038 harness + `martech-diff` against the golden + vendor
  DebugView/Test-Events), and the scripted developer path are **provable with zero container-owner dependency**; repeatable
  and scriptable (the `?martech=airlock` gate *is* the adoption procedure); pattern-scoped so it never touches the untouched
  container tail (the existing goldens guard it).
- **Cons:** a page-side suppressor only affects **where it is deployed**, and only for the arm that runs it. It gives the
  developer the **Lighthouse/TBT win** and **event-level receipt** (both lab-observable) without the container owner — but
  it does NOT make the **production live-attribution window** dev-closable: the `?martech=airlock` arm is query-gated, so
  real visitors never trigger it (zero natural-traffic attribution), and making it the default for a live cohort would
  *suppress real users' Google Ads / Floodlight / Meta conversion tracking* — a live-attribution/revenue decision that is
  the container owner's regardless of who holds the deploy keys. So the live-attribution leg re-inherits ADR-0018's
  container-owner gate (see Open questions). Also: the naive allowlist is insufficient, so the suppressor must block
  runtimes, not just beacons (ADR-0030), and the honest test arena is a **prod-Tealium-profile host** (stage — VPN-gated — or
  production), since a localhost build AND an AEM preview both resolve to the *dev* Tealium profile, not the four-vendor prod
  one (no query-string can escalate a host to the prod profile; `intuit-erp`'s `resolveEnvironment`).

### Option C: don't load utag.js at all
Skip the container entirely in the airlock arm.
- **Pros:** trivially removes all vendor TBT.
- **Cons:** kills the **untouched** ~20 tags AND the customer-custom ECS/TrackStar/Segment chain — an ADR-0018 R2 violation
  (never break/ship the custom chain) and it destroys the regression baseline the `clicktrack`/`appvars` goldens protect.
  The measurement would compare two non-comparable pages. Rejected.

## Recommended Decision

**Option B.** The MVP9 after-arm is **page-side and developer-controlled** — a pattern-scoped suppressor in the adopter's
owned EDS repo, not a container-profile change. This **narrows ADR-0018's two-party dependency to exactly the leg that
genuinely needs it** (it does not supersede ADR-0018, whose broader 1.0 reframe stands): the rewire proof, the
**Lighthouse/TBT win**, **event-level parity** (harness + vendor DebugView/Test-Events), and the **scripted adoption path**
are **developer-provable without container-owner cooperation**. The **production live-attribution window** (view-through /
cross-device / CM360) is NOT developer-closable — it re-inherits ADR-0018's container-owner gate, because a query-gated arm
collects no natural-traffic attribution and defaulting it for real users suppresses their live conversion tracking (a
container-owner revenue decision). So this ADR removes the two-party dependency for the developer-provable *subset* (the
majority of MVP9), and keeps it, honestly, for the live-attribution leg.

## Consequences

**Becomes easier:**
- A developer runs the rewire + measures the **Lighthouse/TBT win** + **event-level parity** on a reachable
  **prod-Tealium-profile host** (stage, VPN-gated, or production), on their own clock, with no container-owner gate —
  collapsing the *majority* of MVP9's critical path from "customer Tealium change" to "developer repo change".
- The trial IS the scripted adoption path: the `?martech=airlock` gate + the airlock config + the `martech-diff` run are the
  repeatable procedure (ADR-0018 E8) — it largely falls out of the trial rather than being a separate deliverable.

**Becomes harder:**
- The after-arm now lives in the adopter's **page code**: the suppressor must be correct and strictly pattern-scoped so it
  never suppresses a non-migrated tag, the ECS chain, or airlock's *own* egress (guarded by the existing goldens). The
  mechanism + its home is ADR-0030.
- The 1.0 bar is now honestly split: the developer-provable subset (Lighthouse/TBT + event-level lab receipt) is
  unblocked, but **production live-attribution stays container-owner-gated** (a deploy that defaults the arm for real users
  suppresses their conversion tracking — the container owner's revenue call), and the honesty of that split must be
  preserved (never a silent narrowing of 1.0 to lab-only; ADR-0018 kill criterion).

## Assumptions

<!-- Spec 064-02 / ADR-0020 §1–§2 — grounding-by-probe (risk-gated). -->

- **The adopter's repo owns the utag injection seam** — verified: `plugins/tealium-martech/src/index.js`'s `loadUtag`
  injects `utag.js` via `document.createElement('script')`, page-side, after OneTrust (the loader header + `loadScriptOnce`).
- **The page-side `?tealium-tags=` allowlist does NOT stop template/runtime init** — from the repo's own `MARTECH.md`
  (98–125): every active `utag.<uid>.js` template initializes at INIT regardless; true per-tag isolation is profile-side.
  This is why the after-arm must suppress the vendor **runtimes** page-side (ADR-0030), not merely use the allowlist.
- **The four vendor runtimes are page-suppressible** — `gtag.js` (googletagmanager.com; AW+GA4+Floodlight, distinguished
  only by `?id=`) and `fbevents.js` (connect.facebook.net; Meta) are injected as separate `<script>`s by utag templates,
  interceptable before load. **Assumed** that blocking their `<script>` injection prevents the runtime download/eval (the
  TBT source) — validated by the first trial slice's Lighthouse arm before the win is claimed (the kill criterion below).
  (The shared `googletagmanager.com` host across three of the four is why suppression must be URL/query-pattern granular,
  not host-scoped — ADR-0030.)
- **The "win" is a Lighthouse / lab-TBT win, not a field-CWV improvement.** The reference site's perf report grounds a large
  TBT/Lighthouse-score win from removing the ad runtimes (the ~100→~60 collapse is TBT-weighted), but removing the three ad
  tags showed **no material INP/CLS change** and LCP is already ~1.4 s — so the trial claims a Lighthouse/TBT (lab) win, not
  a field INP/LCP/CLS improvement the evidence does not support. Stated here so the release-check phrases the win honestly.

## Kill criteria

- **If page-side suppression cannot actually prevent the vendor runtime download/eval** (e.g. a runtime is inlined into the
  container bundle rather than injected as a separate `<script>`, or arrives by a mechanism the page cannot intercept), the
  CWV win is not developer-provable — fall back to Option A's profile-side after-arm for the CWV arm (the container owner
  re-enters), while event-level parity may still be dev-provable.
- **If suppressing the four cannot be kept pattern-scoped** without collapsing the untouched container tail or the ECS chain
  (the `clicktrack`/`appvars` regression goldens go red and cannot be made green), the page-side after-arm is unsafe on this
  site and Option A is required.

## Open questions

- **Production live-attribution window — stays container-owner-gated (ADR-0018), NOT developer-closable.** View-through /
  cross-device / CM360 parity is observable only under live traffic. A query-gated `?martech=airlock` arm gets zero
  natural-traffic attribution, and defaulting it for a live cohort suppresses real users' Google Ads/Floodlight/Meta
  conversion tracking — a live-attribution/revenue decision the container owner owns (ADR-0018 §(ii)/(iii)), regardless of
  who holds the EDS deploy keys. So this leg re-inherits the two-party dependency and is revisited *with* the container owner
  only after the developer-provable subset passes. Open sub-question: whether an event-level *production* receipt — the arm
  live for an internal/QA cohort only, with no real-user conversion suppression — can partially de-risk it beforehand.
