---
status: DONE
dependencies: []
last_verified: 2026-08-30
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
2. **Consent-input seam = a PRE-CONSTRUCTION source folded into `ctx` (017-01 frame-critique).** The host
   supplies the consent vector **at/before boot**, and the adapter folds it into `ctx` in
   `adapters/eds/index.js` **before** `createAirlock({ ctx })` runs (parallel to the existing `sourceGa4Ctx`
   identity fold). **This ordering is load-bearing, not incidental:** the worker receives a
   **structured-clone snapshot** of `ctx` at `init` (`core/airlock.js` `postMessage({type:"init", …, ctx})`),
   while the sync fast path closes over a **live reference** (`core/egress.js`'s captured `ctx`) — so consent
   must be on `ctx` **before the init-clone** to reach **both** (AC4). A **post-construction / live
   `setConsent(...)`** handle method is therefore **NOT** this slice's seam — it would reach only the
   fast-path reference, never the frozen worker clone — it is the **mid-session-update follow-up** (AC6,
   which needs a worker `ctx` re-send). Consent Mode `gtag` / TCF `__tcfapi` are named follow-up drivers on
   this same pre-construction seam.
3. **Grant resolver → the MP `consent` object (GA4 shaping, injected — not in `core/`).** The **data-use**
   purposes (`ad_user_data`, `ad_personalization`) resolve into `ctx.consent = { ad_user_data:
   "GRANTED"|"DENIED", ad_personalization: "GRANTED"|"DENIED" }` (the MP shape `map.js:74` already consumes).
   This GA4-specific mapping lives in the GA4 connector/adapter (the 016 vendor-injection precedent), reading
   `core/consent.js`'s generic resolver. Observable: a denied data-use purpose → the MP-shaped object marks
   it `"DENIED"`.
4. **Threaded into BOTH mapping sites — because consent is on `ctx` BEFORE construction (017-01
   frame-critique).** Since `ctx.consent` is folded **pre-construction** (AC2), it is captured by **both** the
   worker's `init` structured-clone **and** the sync fast path's live `ctx` reference — the two
   `mapToMp(event, ctx)` sites. This is the OQ16 fast-path parity for the *consent reshape*, achieved by
   construction (one `ctx`, one `mapToMp`) — **not** a second code path, but it holds **only** under the
   pre-construction ordering (a symmetry the two sites do not otherwise have: init-clone vs live-reference).
   Observable: a denied data-use purpose → `body.consent` DENIED in the mapped beacon at **both** the worker
   site (the connector's `handle`/`mapToMp`) **and** the sync site (`core/egress.js`).
5. **Delegate-and-send: the beacon STILL POSTs (ADR-0007's named departure, stated honestly).** A denied
   data-use purpose does **not** hold the beacon — the full event crosses the seal with `consent` DENIED,
   *delegating* data-use-denial to Google's server-side honoring (lawful + Consent-Mode-correct for GA4:
   `ad_user_data` denial restricts ad *use*, not measurement transmission). Observable: egress **happens**;
   the `consent` field is DENIED. A comment + the spec name this as the deliberate departure from "nothing
   crosses the seal unhonoured," and that a future connector with **no** server-side consent flag would need
   a different path (the ADR's kill-criterion row) — not this slice's concern.
6. **Boot-time (pre-construction) source; mid-session update is the SAME mechanism, deferred (017-01
   frame-critique).** Boot works **because** consent is folded **pre-clone** (AC2/AC4); a **mid-session
   update** does **not** — the worker's `ctx` is a frozen `init`-clone, so honoring a *later* consent change
   needs a **worker `ctx` re-send** (`core/airlock.js` has only `init`/`events` messages today — no ctx-update
   path) **plus** a per-purpose replay/stop. That re-send is exactly what the boot-time fold avoids, so
   mid-session is the honest deferral (tracked in `refinement-todo`, ADR-0007's consent-update open question):
   the boot claim and the residual are the **same** frozen-clone mechanism, split cleanly at construction.
   Observable: the enforcement reflects the pre-construction vector; a post-construction change is out of
   scope + named, not silently half-applied.
7. **E2E at both sites.** A `test/` harness: host sets `{ ad_user_data: "denied" }` → drive a GA4 event →
   the mapped beacon carries `consent.ad_user_data: "DENIED"` **and still POSTs**, asserted at the worker
   mapping (via the connector's `handle`/`mapToMp`) **and** the sync fast path (`core/egress.js`'s
   `dispatch`); host sets `"granted"` → `consent.ad_user_data: "GRANTED"`; no consent set → `ctx.consent`
   absent (unchanged `map.js` behavior — `body.consent` omitted, back-compat).

**DoD:**
- [x] ACs 1–7 pass — a denied data-use purpose → MP `consent` DENIED (tested via `mapToMp` — the mechanism
      both sites share — **and** the sync fast path `createCriticalDispatcher`), beacon still POSTs; granted
      → GRANTED; unset → omitted (back-compat). _(Targeted: consent 6/6, ga4-consent 8/8, ga4-map 5/5,
      egress-fastpath 6/6, core-boundary 1/1 — green.)_
- [x] **No regression** — `map.js` is **untouched** (`git diff` empty — the `body.consent = ctx.consent`
      hook already existed); the EDS adapter suite (143/143 incl. `eds-boot`'s exact-`ctx`-equality when no
      consent) + contract-stability stay green.
- [x] Reviews: compliance + craft + **arch** (a new `core/` consent seam + resolver + the pre-construction
      `ctx` fold reaching both mapping sites) recorded pass (independent Opus review of the Sonnet diffs).
- [x] Deviation log + reconciliation sweep; `docs/refinement-todo.md` got the mid-session-consent-update +
      Consent-Mode-`gtag`/TCF-driver + alloy-wrapped-SDK-consent follow-ups + the Google-Consent-Mode
      semantic-detail re-verify flag; `docs/releases/mvp3.md` updated.
- [x] **No secrets committed** — no `api_secret`/`measurement_id`/live ids; synthetic consent vectors only.

### Deviation log

- **`map.js` untouched — the reshape hook pre-existed.** 017-01 is purely additive: `core/consent.js`
  (vendor-neutral vector + `resolveConsent`), `connectors/ga4/consent.js` (`shapeMpConsent` — the MP shape,
  reads the core resolver), and the pre-construction fold in `adapters/eds/index.js`. The `body.consent =
  ctx.consent` hook (`map.js:74`) was already there.
- **Pre-construction ordering honored (frame-critique).** The consent fold is computed BEFORE
  `createAirlock({ ctx: ctxWithConsent })` (adjacent statements), so both the worker's init structured-clone
  and the sync path's live `ctx` reference carry it. No post-construction `setConsent` handle.
- **Pending data-use omitted, not fail-safe DENIED.** `shapeMpConsent` omits an unset data-use purpose (its
  seal-hold semantics are 017-03's, not the reshape's) — a deliberate scope boundary, tested.
- **Both-sites proof is pragmatic (no real worker).** The worker + sync sites share `mapToMp(event, ctx)`;
  the reshape is proven at the `mapToMp` level (both sites' mechanism) + concretely at the sync site
  (`createCriticalDispatcher` + a fetch spy). A real-worker E2E is the rig's job.

### Reconciliation sweep

- New `core/consent.js` (vendor-neutral, zero imports) + `connectors/ga4/consent.js` (connector→core only);
  the adapter fold. No `core/ → rig/` or `core/ → connector/` import (boundary test green).
- Reviews recorded: frame-critique + compliance + craft + arch — all pass.
- `docs/refinement-todo.md`: mid-session-update, CMP `gtag`/TCF drivers, alloy consent, and the Google-doc
  semantic re-verify tracked. `docs/releases/mvp3.md` reflects the 017-01 delivery.
- No inbox items; the delegate-and-send posture + the deferrals are named, not hidden.

**Anti-horizontal-phasing check:** after this slice, a host that denies a data-use purpose (`ad_user_data` /
`ad_personalization`) sees the GA4 beacon carry `consent` DENIED at **both** mapping sites — the first
real consent enforcement in `core/`, the consent vector made observable end-to-end. (Storage-deny is 017-02;
seal-hold is 017-03; the delegate-and-send posture, mid-session update, and CMP drivers are named residuals.)
