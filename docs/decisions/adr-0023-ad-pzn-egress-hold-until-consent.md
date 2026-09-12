---
status: Accepted
dependencies: [adr-0007]
last_verified: 2026-09-11
frame_review: true
---

# ADR-0023: Ad/personalization egress holds at the seal until consent (amends ADR-0007)

## Status

Accepted (2026-09-12, implemented by spec 045-01) — **amends [ADR-0007](adr-0007-purpose-vector-consent.md)** (the consent-purpose seal model; point ③, the egress seal). Does not supersede it; adds a per-purpose enforcement mode. The core-seal `holdOnDenied` opt-in + the re-map-on-grant flush landed in 045-01 (`core/consent.js` `egressVerdict`, `core/airlock.js` `createAirlock`); alloy's separate-path refinement is 045-02.

## Context

Airlock's seal (`core/consent.js` `egressVerdict`, spec 017-03) folds a beacon's governing `purposes.egress` against the consent vector to `send` / `hold` / `drop`. Its current non-strict semantics (grounded, `core/consent.js:110-121`):
- **pending** (no signal yet) → **hold** (buffer at the seal; flushed on a later `setConsent`, `core/airlock.js:412-429`).
- **denied** → **send** — a *storage*-purpose denial is treated as 017-02's cookie concern (mint ephemeral / don't read the cookie), and **the beacon still egresses**.
- **granted** → send. **strict** regime + any un-granted → **drop** (global boot flag `consentStrict`, `core/airlock.js:65`).

**The grounded problem (R-009 §(b), 2026-09-11 `erp.intuit.com` capture + denied re-capture).** Under `ad_storage`-denied the reference container **holds the entire Google Ads + Floodlight family** (23 ad requests → 0; only GA4 fired a cookieless modeling ping). So parity requires a **per-purpose difference the seal cannot currently express**: `analytics_storage`-denied should keep sending (GA4's cookieless modeling — the current `send`-on-denied is correct for it), but `ad_storage` / ad-personalization-denied should **not send** — the ad tag holds until consent, then fires. The global `consentStrict` flag can't do this (it would drop GA4 too, and drop ≠ hold-then-flush).

## Decision Options Considered

### Option A: keep `send`-on-denied for all purposes (status quo)
- **Pros:** no change; matches GA4 cookieless modeling.
- **Cons:** **fails ad parity** — airlock would fire an AW/Floodlight beacon under `ad_storage`-denied that the container suppresses. Rejected.

### Option B: global `consentStrict` (drop un-granted)
- **Pros:** reuses an existing flag.
- **Cons:** **drop, not hold** — no flush when consent is later granted (loses the OneTrust-accept re-fire); and it is **global** — it would also drop GA4's cookieless-modeling ping (a GA4 parity regression). Rejected.

### Option C: connector-side gate (each ad connector returns `[]` under denial)
- **Pros:** localized; testable without boot.
- **Cons:** moves consent enforcement **out of the seal** into each connector (duplicated, drift-prone), against the "egress held at the seal" design principle; and each connector must re-implement buffer+flush. Rejected as the primary mechanism.

### Option D: a blanket per-*purpose* hold mode in the seal (rejected — opinionated)
- The seal classifies purposes: any denied `ad_storage`/`ad_user_data`/`ad_personalization`/`personalization` → hold; denied `analytics_storage` → send. **Connector-agnostic by construction** — any connector declaring an ad/pzn purpose holds automatically.
- **Cons (why rejected):** "by construction" is the problem — it imposes hold on connectors whose real vendor behavior under denial airlock has **not captured** (LinkedIn/Bing pixels declare `["ad_storage"]` but are **not on the reference site**). That is an airlock **opinion**, not vendor fidelity. Airlock's thesis is parity — match each vendor, don't invent a uniform policy (owner correction, 2026-09-11).

### Option E (chosen): per-**connector** opt-in hold-until-granted, grounded per vendor
- The seal keeps its buffer+flush **mechanism**, but a connector **opts in** to hold-on-denied via a flag (`holdOnDenied`, mirroring the existing per-instance `consentStrict`), set from that connector's **captured** vendor behavior. A connector NOT opted in keeps today's behavior (denied storage → send; pending → hold; strict → drop).
- **Grounded opt-ins (R-009 §(b) capture):** g-ads (AW) → hold; GA4 → **not** opted in (send-cookieless). Meta/Floodlight are grounded-to-hold too (opt in as follow-ups in their own specs). LinkedIn/Bing are **not** opted in (ungrounded) until captured.
- **Pros:** fidelity, not opinion — each connector's denied-behavior matches its captured vendor; enforcement stays **at the seal** (one mechanism); reuses the existing buffer+flush; ungrounded vendors untouched.
- **Cons:** amends ADR-0007's "denied storage → send" default for *opted-in* connectors (a per-connector, grounded amendment, not a global one); adds a per-instance flag.

## Recommended Decision

**Option E — per-connector opt-in.** The seal gains a per-instance `holdOnDenied` flag (mirroring `consentStrict`): when a connector opts in, a **denied** governing purpose → **hold** (buffer + flush-on-grant) instead of send; pending → hold and strict → drop are unchanged. Opt-in is driven by **captured vendor behavior**, not purpose alone: **g-ads opts in** (grounded hold); **GA4 does not** (grounded send-cookieless); **Meta/Floodlight** are grounded-to-hold and opt in as follow-ups in their own specs; **LinkedIn/Bing** stay opted-out (ungrounded) until captured. GA4/analytics behavior is untouched.

**Re-map on grant (folded from the 045-01 frame-critique, 2026-09-11 — load-bearing).** A held ad beacon flushed on
consent-grant is **re-mapped** with the current consent/ctx (fresh `auid`, granted `gcs`/`npa`) via the connector's
main-thread mapper — NOT the stale under-denial payload the existing flush re-sends (`core/airlock.js:666-687`, the
residual named at `:660`). Without this, hold-until-granted would fire an unattributable "user-declined" beacon on accept
(no `auid`, `gcs`=denied) — the exact non-parity it exists to prevent. This resolves the deferred **mid-session
ctx-refresh** residual (`docs/refinement-todo.md`) for the seal path (the grant-flush direction); it is part of the
045-01 mechanism.

**Landed shape + scope (2026-09-12, post-arch-review).** 045-01 landed the re-map MECHANISM: an additive optional
`EgressRequest.event` re-map channel (a connector attaches its source event; ADR-0017 additive), `createAirlock({ remap })`,
and a flush that re-maps a `holdOnDenied` held beacon under the now-current consent. It is **wired-but-inactive** until a
consumer both supplies a `remap` and attaches `event` on its ready beacons — **g-ads wires it end-to-end in 044-02**; with
no `remap`/`event` the flush falls back to the 017-03 verbatim re-send and **emits a footgun diagnostic** so the
stale-payload risk is observable, never silent. The re-mapped URL is **re-checked against the host endpoint ceiling** at
flush (a connector cannot widen its ceiling via re-map; ADR-0006). **Known limit:** `remap` rebuilds **one** request per
held item, so a connector whose `handle` fans one event out to N held beacons is a future variant (g-ads is 1:1
event→beacon).

**Two independent enforcement paths (grounded 2026-09-11).** g-ads and alloy do NOT share a seal:
- **g-ads (and any `core/airlock.js`-hosted connector)** uses the **core seal** — `egressVerdict` (non-strict) + the `heldBeacons`/`setConsent` buffer+flush. This is where Option D's classification lands (spec 045-01).
- **alloy (wrapped-SDK)** is enforced by **`core/wrapped-sdk-host.js`** — its OWN path: `egressVerdict(..., { strict: true })` + a **per-purpose seam strip** (034-01: `personalization` stripped, `analytics_storage` interact flows; `core/wrapped-sdk-host.js:336-338`), and today **pending → DROP** with a **pending→hold+flush refinement mirroring 017-03 already named as a follow-up** in that module (`core/wrapped-sdk-host.js:106-109`).

So the core-seal change (045-01) **cannot regress 034-01** — it doesn't touch alloy's path. Alloy's hold-until-granted (spec 045-02) is the **separate, already-named refinement of `core/wrapped-sdk-host.js`**: hold (buffer+flush) instead of drop for the personalization concern, **preserving** 034-01's per-purpose strip (analytics interact still flows under analytics-granted/pzn-denied). GA4 (core seal, `analytics_storage`) is untouched by either.

## Consequences

**Becomes easier:**
- Ad-conversion parity (g-ads spec 044-02, Floodlight/Meta as grounded follow-ups): a grounded connector opts in with one flag; the buffer+flush is shared.
- The OneTrust-accept flow works uniformly for opted-in connectors: beacons buffer, then fire on grant, via one mechanism.

**Becomes harder:**
- Each connector's opt-in must be **grounded** (a captured vendor behavior), not assumed — an ungrounded connector must NOT be flipped (the discipline this ADR exists to enforce).
- The seal gains a per-instance `holdOnDenied` flag alongside `consentStrict`; reasoning about alloy's separate path requires the 034-01 precedence rule (A1).

## Assumptions

- **A1 (alloy's exact hold seam — grounded in 045-02).** Alloy's `personalization` is co-carried on the interact beacon and today **stripped** (034-01) when pzn-denied while the analytics interact flows; `core/wrapped-sdk-host.js` enforces alloy consent in **strict** mode with **pending → DROP** (a pending→hold+flush refinement already named there, `:106-109`). "Alloy holds pzn until consent" is therefore realized in wrapped-sdk-host.js as: **pending → hold+flush** (instead of drop); and the denied-pzn case **keeps 034-01's per-purpose strip** (analytics interact flows, pzn data absent) rather than holding the analytics interact. Whether a *personalization-only* alloy egress exists that should itself buffer+flush is grounded in 045-02 against `connectors/alloy/`. *Risk if wrong:* holding the analytics interact under pzn-denial would regress 034-01 — avoided by refining the existing per-purpose seam, not the analytics flow.
- **A2 (grounded — the ad-hold requirement).** The container holds ads under `ad_storage`-denied (R-009 §(b) denied re-capture, 23→2). *Risk:* a different adopter profile that fires cookieless ads under denial would need a per-profile override — named as a future variant, not this ADR.

## Kill criteria

- If `core/wrapped-sdk-host.js` **cannot** be refined to hold+flush the personalization concern without regressing 034-01's analytics-flows strip (the two are entangled in the single interact), the alloy hold is limited to the **pending** case (hold+flush the whole interact when consent is unresolved) plus the existing denied-pzn **strip**, and 045-02 documents that alloy has no separable pzn-only egress to buffer — a scoped limit, not an Option-D failure. The core-seal mode (g-ads) is unaffected either way.

## Open questions

- The exact alloy seam (A1) — resolved in 045's alloy slice.
- Whether `personalization` (alloy) and the Consent-Mode ad purposes should share one "hold set" or be separately classified — leaning one shared set; revisit if a purpose needs different treatment.
