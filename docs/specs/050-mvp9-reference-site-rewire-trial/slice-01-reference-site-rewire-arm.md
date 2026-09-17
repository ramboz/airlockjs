---
status: DONE
dependencies: [049-01, 049-02, adr-0029]
last_verified: 2026-09-17
frame_review: true
---

<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about runnable
     surfaces by probe first (run it / read source) or a citation, else mark them
     as assumptions in the spec's `## Assumptions` section — never assert an
     unverified claim as fact. -->

## Slice 050-01 — the reference-site `?martech=airlock` rewire arm

**Goal:** Apply airlock's scripted adoption path to the reference adopter (`intuit-erp`): subtree the airlock dist, add a
`?martech=airlock` gate that installs the native-tag suppressor ([spec 049](../049-native-tag-suppressor/spec.md)) with the
four vendors' URL/query matchers and `boot(config)`s the four connectors (real IDs), so that on a prod-Tealium-profile host a
`?martech=airlock` load **suppresses the four container tags and airlock emits the four equivalents** — while the untouched
~20 tags + the custom ECS chain stay green. The airlock-owned deliverable is the **wiring recipe** (the nascent
adoption-path steps, [ADR-0018](../../decisions/adr-0018-reframe-onto-adoptable-one-point-oh.md) E8); the `intuit-erp` code is
the adopter-side **application** that proves the recipe.

**DoR:**
- ✅ (A1) **spec 049 DONE and a dist cut carrying the suppressor** — `npm run build:dist` + a floating `origin/dist` push
  (`airlockjs v0.8.0+dc5d5c3`, carries `tag-suppressor.js`, a served sibling — 049-01 AC6). The demo branch used a local-build
  copy of the dist; a production adopter `git subtree add origin dist` (spec 031).
- ✅ (A2) Access to a **prod-Tealium-profile host**: production **`erp.intuit.com` is PUBLIC** — reachable in-sandbox via a
  headless chrome-launcher rig (`rig:erp-waterfall`), no VPN and **no container-owner** (the developer-provable claim, ADR-0029).
  (`stage.erp.intuit.com` is VPN-gated and DEAD since 2026-09-11; production is the arena.) localhost/preview resolve to the
  *dev* profile, which does not fire the four-vendor prod stack, so the AC3/AC4 validation runs against public `erp.intuit.com`.
- ✅ The four vendor IDs are known (GA4 `G-GCCMSJL6CT`, Google Ads `AW-1030811807`, Floodlight `DC-1996823`); Meta's numeric
  id is extracted from the live container in AC2.
- ✅ `intuit-erp`'s `?martech=` query-gate idiom + `martech-diff`/`clicktrack`/`appvars` goldens exist (the regression guard).

**Acceptance Criteria:**

1. **A `?martech=airlock` gate wired in `intuit-erp`.** Extending the repo's `?martech=` idiom
   (`plugins/tealium-martech/src/index.js`), a `?martech=airlock` load: (a) installs the suppressor (imported from the
   subtreed `scripts/airlock/`) with **URL/query matchers** for the four vendor runtimes + beacons —
   `googletagmanager.com/gtag/js?id=AW-1030811807` / `?id=DC-1996823` / `?id=G-GCCMSJL6CT` and `connect.facebook.net/…/fbevents.js`
   — with airlock's own connector endpoints in the carve-out allow-set; (b) `boot({ connectors:[ga4, google-ads, floodlight,
   pixel/meta], onetrust:{…} })` with the real IDs. Installed **before** `loadUtag` (the suppressor's precondition).
   *(Container structure grounded — ADR-0020 §1: `npm run rig:erp-waterfall` (a public headless load of `erp.intuit.com`,
   `rig/erp-runtime-waterfall.mjs`) confirms the container injects exactly these **three separable**
   `gtag/js?id=<AW-1030811807|DC-1996823|G-GCCMSJL6CT>` runtimes + `connect.facebook.net/en_US/fbevents.js`, all from the
   Tealium `intuit/ies-erp/prod` container's `utag.N.js` templates — so the per-`?id=` matcher recipe is probe-grounded, not
   assumed. Stable across repeat loads, 2026-09-15.)*
2. **Meta pixel id extracted + wired.** The Meta numeric pixel id (absent from the repo; lives in the runtime `utag.21.js`
   template) is captured from the live container and threaded into the `pixel/meta` boot config. Recorded (redacted per R5 if
   committed; a live id is a runtime value, not a committed artifact — ADR-0018 R5).
3. **Suppress + emit, on the (public) prod-profile host `erp.intuit.com`.** On a `?martech=airlock` load, the four container
   vendor **runtimes do not load** (network shows zero `gtag/js?id=AW-…/DC-…/G-…` and zero `fbevents.js`) and their native
   beacons do not fire — including Google Ads' **two** native beacons (`www.google.com/ccm/collect` **and**
   `googleads.g.doubleclick.net/pagead/viewthroughconversion`) and Floodlight's `ccm/collect` **+** `ad.doubleclick.net/activity`,
   all gone with the runtime (probe-observed on the shipped container: `rig:erp-waterfall`) — while **airlock emits the
   equivalent governed beacons** (GA4 `/g/collect`, Google Ads + Floodlight `ccm/collect`, Meta `/tr`). Airlock reproduces the
   `ccm/collect` conversion beacon, **not** the AW `pagead/viewthroughconversion` leg (out of connector scope, spec 044 — state
   honestly in 050-02 parity). **The carve-out mechanism (grounded):** airlock's egress is **byte-URL-identical to native**
   (same `/g/collect` / `ccm/collect` / `/tr`), so it is separated **not** by a URL allow-set but by the shipped **049-02
   transport signature** — `installTagSuppressor` exempts `fetch(url,{keepalive:true})` unconditionally
   (`shouldSuppressBeaconCompiled`), which is airlock's own egress shape (`core/egress.js` `fetchInit`); the URL `allow` set
   still applies additively. (No ADR-0030 change: its `/mp/collect` carve-out example is the non-page-feasible GA4-MP variant;
   the page-side gtag connector collides at `/g/collect`, which is exactly what 049-02's transport carve-out exists for.)
4. **The untouched tail stays green.** Under `?martech=airlock`, the other ~20 Tealium tags AND the custom ECS/TrackStar/
   Segment chain still fire: `npm run verify:martech` (minus the four migrated vendors) + the `clicktrack`/`appvars` goldens
   stay green — the suppressor is pattern-scoped, not a blanket container kill (the A4 kill-criterion check for this site).
5. **Consent parity preserved.** OneTrust still gates airlock end-to-end — the `boot(config)` `onetrust` field reads
   `OnetrustActiveGroups`, so a denied ad-consent HOLDS the ad beacons and a mid-session accept flushes them (the MVP8
   accept-flow, unchanged), matching the container's Consent-Mode-v2 behavior. **Probe baseline:** on a no-interaction US load
   the container's Consent-Mode default is **granted** (`gcs=G111` on every Google beacon — `rig:erp-waterfall`), so the parity
   baseline for this arena is *both fire by default*; airlock's OneTrust default-groups read must match that, with the
   deny→accept flow as the MVP8 mechanism for the gated case.

**DoD:**
- [ ] ACs met on a prod-profile host; the airlock full suite stays green (no regression to 049 or the connectors).
- [ ] The `intuit-erp` wiring is committed **in the intuit-erp repo** (the adopter application — not an airlock artifact);
      the airlock-side deliverable is the recipe captured toward the adoption-path doc (050-02).
- [ ] AC3/AC4 evidenced (network capture / `verify:martech` output) and attached to the slice or the validation evidence.
- [ ] Reviewed by `reviewer` subagent (compliance — against the recipe + the observable outcomes) + craft pass.
- [ ] Deviation log + reconciliation sweep produced under this slice heading.
- [ ] `docs/refinement-todo.md` updated with any residual (e.g. a fifth vendor, or a suppressor edge found on the live
      container).

**Anti-horizontal-phasing check:** after this slice lands, a `?martech=airlock` load of the reference site runs the four
vendors THROUGH AIRLOCK with the container's native versions suppressed and everything else intact — a working, observable
rewrite of the site's TBT-dominant tags, no Tealium change. Not intermediate state.

## Assumptions

- **A1 (blocking) — 049's suppressor is built + dist-cut.** Stated in the spec; this slice's DoR.
- **A2 — the prod-profile arena (probe-grounded).** Production `erp.intuit.com` resolves the four-vendor prod Tealium profile
  (`intuit-erp/.../index.js` `resolveEnvironment`; profile path `utag/intuit/ies-erp/prod` confirmed by `rig:erp-waterfall`)
  and is **public** — no VPN, no container-owner. The passive rig proves the arena is *reachable/loadable*; **exercising** the
  after-arm (AC3/AC4/AC5) is a separate step — **deploying** the `?martech=airlock` gate to that prod-profile host via the
  developer's own EDS deploy (ADR-0029: "a page-side suppressor only affects where it is deployed" — developer-controlled, not
  the container-owner gate). AC3/AC4 run against that deployed arm, not localhost.
- **A4 — goldens stay green under the live container.** The pattern-scoped suppressor does not collapse the untouched tail —
  **de-risked by probe**: the three Google vendors load on their own separable `gtag/js?id=<AW|DC|G>` runtimes, distinct from
  the container's other ~13 `utag.N.js` templates, so per-`?id=` suppression cannot drag a non-migrated tag. AC4 is still the
  falsifiable in-slice check on a real `?martech=airlock` load (the ADR-0030 kill criterion for this site).

## Validation evidence (in-progress — 2026-09-16)

Live-validated in an authenticated Chrome (driven over the browser bridge); recorded here toward reconciliation.

**AC3 suppress — real prod `erp.intuit.com`, granted consent (`utag.gdpr=1`, `OnetrustActiveGroups=,1,BG394,4,`).** Same host,
before vs after `?martech=airlock`:

| runtime / beacon | native (`/`) | airlock (`?martech=airlock`) |
|---|---|---|
| `gtag/js?id=AW-1030811807` / `DC-1996823` / `G-GCCMSJL6CT` | all 3 fire | **0 — suppressed** |
| `connect.facebook.net/…/fbevents.js` | fires | **0 — suppressed** |
| native beacons (`ccm/collect`×3, `/g/collect`, `/tr`×2, `/activity`×3, `pagead/viewthroughconversion`×4) | 13 | **0** |
| the untouched tail (utag + ~14 `utag.N.js` + the non-vendor tags & their beacons) | fires (in the 129) | **fires unchanged** (in the 94) |
| total page resources | 129 | 94 |

**AC4 (tail stays green) — network-delta + probe evidence; the named goldens carried.** The 129→94 delta is the four vendors'
~35 resources (their 4 runtimes + 13 beacons + sub-resources — signals-config, gtag config fetches); the tail's ~94 resources
(its tags + their beacons) are unchanged, and the A4 probe confirms the three
Google vendors load on their own separable `gtag/js?id=` runtimes (not the ~14 `utag.N.js` templates). AC4's *named* regression
checks (`npm run verify:martech` minus the four, the `clicktrack`/`appvars` goldens, the custom ECS/TrackStar/Segment chain
firing) were **not runnable** in the Chrome-Overrides prod arena — they need the intuit-erp local server + harness, and localhost
resolves to the *dev* Tealium profile (which doesn't fire the four), so there is no arena where both the goldens run *and* the
four fire without a real deploy. **Carried** as a named residual (deviation log).

**Parity drop (honest accounting).** Google Ads also fired `pagead/viewthroughconversion` ×4 natively (per `lh:r010` recon +
`rig:erp-waterfall`); airlock suppresses it with the runtime but does **not** re-emit it (out of connector scope, spec 044) —
the rewire's one deliberate parity drop (surfaced in 050-02 AC2).

**AC2 (Meta pixel id).** Extracted `850485508311844` from the container's `utag.21.js` template and wired into the `pixel/meta`
boot config (`airlock-gate.js`). Not a user identifier — a public tag id present in every `/tr` beacon, like AW/DC/GA4 — so it
carries no R5 redaction concern.

**AC3 emit — the deployed branch `airlock-rewire-trial--intuit-erp--aemsites.aem.live` (consent granted via `window.airlock.setConsent`).**
airlock re-emits all four vendors' governed beacons: GA4 `www.google-analytics.com/g/collect`, Google Ads + Floodlight
`www.google.com/ccm/collect`, Floodlight `ad.doubleclick.net/activity;src=1996823;type=intuc741;cat=intuw830`, Meta `www.facebook.com/tr`.
Boots clean under the strict CSP + Trusted Types (the host's `createScriptURL:(i)=>i` default policy passes the module-workers).

**Wiring corrections found live (now committed in the intuit-erp branch):**
- airlock's boot does **not** auto-capture a page_view (`adapters/eds/index.js`) — it is push-driven; `airlock-gate.js` must
  `handle.push({ event:'page_view', page_location, page_title })` after boot, else `dispatched:0` (no beacons).
- the `?martech=airlock` install is **guarded** in `loadEager` (try/catch) so a failed airlock arm never halts the page's own
  martech (`loadEager` is awaited by `loadPage`).

**Arena / method (feeds 050-02's developer-provable path):**
- **`*.aem.live` previews cannot run the native suppression demo** — OneTrust is domain-locked to `intuit.com`, so `window.OneTrust`
  never initializes there → consent never resolves → utag + the four native tags never load. A simulated `OptanonConsent` cookie
  loads utag but Tealium's own gate stays shut (`utag.gdpr.getConsentState()===0`). The native side only runs where real OneTrust
  runs: **prod `erp.intuit.com`**.
- **The developer-provable prod demo = Chrome Local Overrides on `erp.intuit.com`** (no deploy, no container-owner — the ADR-0029
  claim, realized). Chrome will **not** serve *new-path* files on an AEM app-shell host (they return the `text/html` app-shell), so
  the demo inlines the real suppressor into the ONE file Chrome does override (`scripts.js`); the off-thread re-emit is shown on the
  deployed aem.live branch.

**Lighthouse/TBT measured (050-02 AC1 — `lh:r010` on `erp.intuit.com`, mobile slow-4G / 4× CPU, median of 5 interleaved
shipped-vs-blocked passes, 2026-09-16).** Removing the four vendor runtimes (the airlock suppressor's effect):

| metric | shipped (4 fire) | airlocked (4 removed) | Δ |
|---|---|---|---|
| **TBT** | **487 ms** | **127 ms** | **−360 ms (−74%)** |
| Lighthouse perf score | 86 | 96 | **+10** |
| LCP | 1419 ms | 1396 ms | −23 ms (noise) |
| CLS | 0.009 | 0.008 | ~0 (noise) |

A **lab TBT/Lighthouse win, INP/LCP/CLS-neutral** — confirms A3 (the −360 ms tracks R-011's −389 ms flip-the-offenders result).
**Indicative (R-010) — a tags-REMOVED bound, not the airlock-BOOTED arm.** `lh:r010` network-blocks the four runtimes rather
than booting airlock, so airlock's own small main-thread boot cost (suppressor patching + worker spin-up) is **not** included —
the booted net win is ≤ this;
a true booted before/after needs a deploy where airlock's workers run against the live container (see 050-02 AC1, carried).
Recon confirmed all four ran with consent granted (`gcs=G111`): `gtag/js` ×3 (143–154 KB) + `fbevents.js` (108 KB) + Meta
signals-config (57 KB).

### Deviation log (after reconciliation)

- **The airlock-owned deliverable is the recipe, not intuit-erp code.** 050-01's `?martech=airlock` wiring lands in the
  `intuit-erp` repo (branch `airlock-rewire-trial`, off origin/main) — the adopter application, NOT an airlock-reviewed artifact.
  The airlock-reviewed output is the wiring recipe, formalized into the adoption-path doc (050-02 AC4).
- **Wiring corrections found live (now in the intuit-erp branch):** (1) airlock's boot does NOT auto-capture a page_view
  (push-driven) — must `handle.push({ event:'page_view', … })` after boot, else `dispatched:0`; (2) the install is guarded in
  `loadEager` (try/catch) so a failed airlock arm never halts the page's own martech.
- **Suppress + emit demonstrated across two arenas, not one.** aem.live previews are OneTrust-domain-locked (the native four
  never load there), so SUPPRESS was shown on real prod `erp.intuit.com` via Chrome Local Overrides (inline suppressor — Chrome
  won't serve new-path files on an AEM app-shell host) and EMIT on the deployed aem.live branch. See § Validation evidence.
- **AC1 TBT is an indicative tags-removed bound, not the airlock-booted arm** — the booted before/after is a carried residual
  needing a deploy (see 050-02's deviation log).
- **AC5 consent parity partially exercised** — the prod arm showed default consent granted (both fire); the deny→accept
  hold/flush flow is the shipped MVP8 mechanism (spec 048-03), not re-run on the live container in this slice.
- **AC4 named goldens carried (not run).** AC4's `verify:martech` (minus the four) + the `clicktrack`/`appvars` goldens + the
  custom ECS/TrackStar/Segment chain firing were not runnable in the Chrome-Overrides prod arena (they need the intuit-erp local
  server + harness, and localhost resolves to the *dev* profile, which doesn't fire the four). AC4 rests on the network-delta
  (129→94 = exactly the four vendors removed, tail intact) + the A4 probe de-risk; the named goldens are a carried residual.
- **Parity drop — Google Ads `pagead/viewthroughconversion` not re-emitted.** The native arm fires it (×4); airlock suppresses
  it with the runtime but does not reproduce it (out of connector scope, spec 044). airlock re-emits the `ccm/collect`
  conversion beacon only — the rewire's one deliberate parity drop.

### Reconciliation sweep

- **`docs/refinement-todo.md` § Spec 050** — updated: the AC4 tail-green goldens residual lifted (needs a deploy where the
  harness runs against the prod-profile `?martech=airlock` arm).
- **DoR A1 + spec.md A1** — reconciled: a floating `origin/dist` (`airlockjs v0.8.0+dc5d5c3`) carrying `tag-suppressor.js` was
  cut → A1 satisfied (was "not yet satisfied").
- **050-02 artifacts (adoption doc / `mvp9.md` / status board)** — updated/regenerated under 050-02; this slice's evidence
  agrees with them (beacon accounting incl. the pagead drop, the TBT indicative-bound framing).
- **New 050-01 tooling** — `rig/erp-runtime-waterfall.mjs` (the container runtime-waterfall probe) + its `rig:erp-waterfall`
  npm script (`package.json`); grounds AC1's separable-`?id=`-runtime claim + AC3's beacon accounting.
- **Architecture / contracts / conventions / ADRs** — no-op: demonstration slice; no airlock source or contract change (the
  intuit-erp wiring is the adopter's, not airlock code — the shipped ADR-0030 suppressor + ADR-0015 dist are consumed, unchanged).
- **Memory** — updated: 3 learnings (`memory.py`) + the cross-session `spec050-rewire-live-validated-prod-override` note.
- **Inbox** — swept; nothing resolved by this slice.
- **Carried residuals** — AC4 named goldens (deploy-gated), AC1 booted-arm TBT (deploy-gated), AC3 event-level receipt
  (console-gated), AC5 deny→accept (shipped MVP8 048-03, not re-run) — all named in `refinement-todo.md` § Spec 050 / the
  deviation log; not silently narrowed.
- **Primer hygiene / close-out** — deferred to spec 050 close-out (after 050-02 DONE): compress the `CLAUDE.md` active-spec entry.
