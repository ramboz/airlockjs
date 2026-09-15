---
status: DRAFT
dependencies: [049-01, 049-02, adr-0029]
last_verified:
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
- ◻️ (BLOCKING, A1) **spec 049 DONE and a dist cut carrying the suppressor** (049-01 AC6 — a served sibling in the airlock
  `dist`) — 050-01 subtrees that dist.
- ◻️ (A2) Access to a **prod-Tealium-profile host** — `stage.erp.intuit.com` (VPN-gated) or production — for the
  suppress+emit validation (localhost/preview resolve to the *dev* profile, which does not fire the four-vendor prod stack).
  The wiring itself can be authored against dev; the AC3/AC4 validation needs the prod profile.
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
2. **Meta pixel id extracted + wired.** The Meta numeric pixel id (absent from the repo; lives in the runtime `utag.21.js`
   template) is captured from the live container and threaded into the `pixel/meta` boot config. Recorded (redacted per R5 if
   committed; a live id is a runtime value, not a committed artifact — ADR-0018 R5).
3. **Suppress + emit, on a prod-profile host.** On a `?martech=airlock` load of a prod-profile host, the four container
   vendor **runtimes do not load** (network shows zero `gtag.js?id=AW-…/DC-…/G-…` and zero `fbevents.js`) and their native
   beacons do not fire, while **airlock emits the four equivalent governed beacons** (its GA4 `/g|mp/collect`, AW/Floodlight
   `ccm/collect`, Meta `/tr`). Airlock's own egress is NOT suppressed (the carve-out holds).
4. **The untouched tail stays green.** Under `?martech=airlock`, the other ~20 Tealium tags AND the custom ECS/TrackStar/
   Segment chain still fire: `npm run verify:martech` (minus the four migrated vendors) + the `clicktrack`/`appvars` goldens
   stay green — the suppressor is pattern-scoped, not a blanket container kill (the A4 kill-criterion check for this site).
5. **Consent parity preserved.** OneTrust still gates airlock end-to-end — the `boot(config)` `onetrust` field reads
   `OnetrustActiveGroups`, so a denied ad-consent HOLDS the ad beacons and a mid-session accept flushes them (the MVP8
   accept-flow, unchanged), matching the container's Consent-Mode-v2 behavior.

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
- **A2 — the prod-profile arena.** Only `erp.intuit.com`/`stage.erp.intuit.com` resolve the four-vendor prod Tealium profile
  (`intuit-erp/.../index.js` `resolveEnvironment`); AC3/AC4 run there, not localhost.
- **A4 — goldens stay green under the live container.** The pattern-scoped suppressor does not collapse the untouched tail;
  AC4 is the falsifiable check (the ADR-0030 kill criterion for this site).

### Deviation log (after reconciliation)

_TODO at reconciliation._

### Reconciliation sweep

_TODO at reconciliation._
