---
status: DRAFT
dependencies: []
last_verified:
frame_review: true
---

<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about
     runnable surfaces by probe first (run it / read source) or a citation. -->

## Slice 017-01 — data-use consent reshape + the consent machinery (the grounded first point)

**Goal:** Stand up the **consent vector state** + a minimal **host-callback consent-input seam** + a
**grant resolver**, and enforce the **data-use reshape** (ADR-0007 point ①): a denied `ad_user_data` /
`ad_personalization` sets the GA4 **Measurement-Protocol `consent` body field** DENIED and the beacon
**still POSTs** (the ADR's *delegate-and-send*), at **both** mapping sites. The reshape **mechanism already
exists** (`map.js:74` `body.consent = ctx.consent`); this slice **feeds** it from a real consent vector.
This is the shared machinery the later points (②/③) build on — kept minimal (one purpose-class, host seam,
boot-time source).

**DoR:**
- ✅ [ADR-0007](../../decisions/adr-0007-consent-purpose-model.md) Accepted — the purpose-vector model +
  the three-point enforcement + the delegate-and-send posture for data-use denial.
- ✅ [ADR-0006](../../decisions/adr-0006-capability-manifest.md) Accepted — `granted = declared ∩
  host-policy ∩ consent`; the manifest declares `purposes` (012-04).
- ✅ The MP reshape hook exists + both sites use it (grounded): `map.js:74` sets `body.consent = ctx.consent`;
  the worker (`connectors/ga4/connector.js` `handle` → `mapToMp`) and the sync fast path (`core/egress.js`
  → `mapToMp`) both call `mapToMp(event, ctx)` with host-sourced `ctx`. The MP schema has an optional
  `consent` object.

**Acceptance Criteria:**

1. **Consent vector state (generic, in `core/`).** A new `core/consent.js` holds a per-purpose consent
   vector over the ADR-0007 taxonomy (`analytics_storage`, `ad_storage`, `ad_user_data`, `ad_personalization`,
   `functional`, `personalization`), each **pending** by default (no signal yet). It exports a resolver:
   `resolveConsent(purpose) → "granted" | "denied" | "pending"`. **Vendor-neutral** — no GA4/MP specifics in
   `core/consent.js` (`test/core-boundary.test.js` stays green); the MP-`consent`-object *shaping* is the
   GA4 connector's job (AC3).
2. **Host-callback consent-input seam (the minimal driver).** The host supplies the vector through a
   callback/API (e.g. `setConsent({ ad_user_data: "denied", … })` on the airlock boot surface / adapter),
   the simplest ADR-0007 driver. Observable: the host can set/replace the vector; Consent Mode `gtag` /
   TCF `__tcfapi` are **named follow-up drivers on this seam** (a driver swap, not a rewrite), not built here.
3. **Grant resolver → the MP `consent` object (GA4 shaping, injected — not in `core/`).** The **data-use**
   purposes (`ad_user_data`, `ad_personalization`) resolve into `ctx.consent = { ad_user_data:
   "GRANTED"|"DENIED", ad_personalization: "GRANTED"|"DENIED" }` (the MP shape `map.js:74` already consumes).
   This GA4-specific mapping lives in the GA4 connector/adapter (the 016 vendor-injection precedent), reading
   `core/consent.js`'s generic resolver. Observable: a denied data-use purpose → the MP-shaped object marks
   it `"DENIED"`.
4. **Threaded into BOTH mapping sites (the OQ16 parity, by construction).** `ctx.consent` is populated where
   `ctx` is host-built (`adapters/eds/index.js`) and flows to **both** `mapToMp(event, ctx)` call sites — the
   worker (via the chamber's init `ctx`) **and** the sync unload fast path (`core/egress.js`'s `ctx`).
   Observable: a denied data-use purpose → `body.consent` DENIED in the mapped beacon at **both** sites (no
   second reshape code path — both use `mapToMp(ctx)`).
5. **Delegate-and-send: the beacon STILL POSTs (ADR-0007's named departure, stated honestly).** A denied
   data-use purpose does **not** hold the beacon — the full event crosses the seal with `consent` DENIED,
   *delegating* data-use-denial to Google's server-side honoring (lawful + Consent-Mode-correct for GA4:
   `ad_user_data` denial restricts ad *use*, not measurement transmission). Observable: egress **happens**;
   the `consent` field is DENIED. A comment + the spec name this as the deliberate departure from "nothing
   crosses the seal unhonoured," and that a future connector with **no** server-side consent flag would need
   a different path (the ADR's kill-criterion row) — not this slice's concern.
6. **Boot-time source; mid-session update is a NAMED residual.** Consent is sourced at boot (before events
   flow) and the worker caches `ctx` at init, so a **mid-session consent update** (re-sending `ctx` to the
   worker + a per-purpose replay/stop) is **out of scope** — tracked in `refinement-todo` (ADR-0007's
   consent-update open question). Observable: the enforcement reflects the boot-time vector; the residual is
   named, not silently unhandled.
7. **E2E at both sites.** A `test/` harness: host sets `{ ad_user_data: "denied" }` → drive a GA4 event →
   the mapped beacon carries `consent.ad_user_data: "DENIED"` **and still POSTs**, asserted at the worker
   mapping (via the connector's `handle`/`mapToMp`) **and** the sync fast path (`core/egress.js`'s
   `dispatch`); host sets `"granted"` → `consent.ad_user_data: "GRANTED"`; no consent set → `ctx.consent`
   absent (unchanged `map.js` behavior — `body.consent` omitted, back-compat).

**DoD:**
- [ ] ACs 1–7 pass — a denied data-use purpose → MP `consent` DENIED at both mapping sites, beacon still
      POSTs; granted → GRANTED; unset → omitted (back-compat). Green against targeted tests. _(Do NOT run
      the full suite unguarded — the stale worktree's oracle/conformance tests hang it; run targeted files.)_
- [ ] **No regression** — the ungated `mapToMp` behavior (no `ctx.consent` → no `body.consent`) is
      byte-identical; the `ga4_mp_conformance` golden path (where reachable) + contract-stability stay green.
- [ ] Reviews: compliance + craft + **arch** (a new `core/` consent seam + resolver + a data-flow threading
      consent into `ctx` at both mapping sites) + reconciliation, recorded pass.
- [ ] Deviation log + reconciliation sweep; `docs/refinement-todo.md` gets the mid-session-consent-update +
      the Consent-Mode-`gtag`/TCF-driver + the alloy-wrapped-SDK-consent follow-ups; the Google-Consent-Mode
      semantic detail verified against current Google docs (or the check noted); `docs/releases/mvp3.md` updated.
- [ ] **No secrets committed** — no `api_secret`/`measurement_id`/live ids; synthetic consent vectors only.

**Anti-horizontal-phasing check:** after this slice, a host that denies a data-use purpose (`ad_user_data` /
`ad_personalization`) sees the GA4 beacon carry `consent` DENIED at **both** mapping sites — the first
real consent enforcement in `core/`, the consent vector made observable end-to-end. (Storage-deny is 017-02;
seal-hold is 017-03; the delegate-and-send posture, mid-session update, and CMP drivers are named residuals.)
