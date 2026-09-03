---
status: DONE
dependencies: []
last_verified: 2026-09-02
frame_review: true
---

<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about
     runnable surfaces by probe first (run it / read source) or a citation. -->

## Slice 026-02 — more vendors as configs: the archetype generalises across real GET pixels

> **Reframed 2026-09-02 after the frame-critique (FAIL → reframe).** The first draft added a **POST/JSON proof**
> (AC4) using GA4's Measurement-Protocol shape "to prove both wire shapes." Verified false in source: GA4-MP's body
> is **nested/arrayed/splatted** (`connectors/ga4/map.js:68-72`), which the shipped interpreter's **flat scalar**
> `paramMap` (`connectors/pixel/connector.js:136-144`) cannot express — a body-map for it is a whole new nested DSL,
> not "one anticipated extension"; and a *real* MP body needs `client_id`/`session_id` from **`ctx`**, which the
> pixel connector is **structurally designed never to read** (`connector.js:44-46,125` — the AC8 invariant the
> 026-01 craft review praised). Plus **R-007 has zero POST pixels** (`R-007:43`; all ~10 are GET image beacons) —
> so POST is speculative (YAGNI) and GA4-MP is the worst target. **POST is deferred** (→ 026-03, which pins the
> config contract + the `ctx`/identity surface a body needs, or a later slice when a real POST pixel appears).
> 026-02 proves what it proves **well**: the flat-config archetype **generalises across the real GET pixels** that
> are R-007's actual population — **zero connector code**.

**Goal:** Prove the 026-01 declarative-map interpreter (`createPixelConnector`) **generalises across real vendors**
— add **LinkedIn Insight + Bing UET** as **flat GET configs with ZERO code** in the connector — closing 026's
central generality bet (026-01 flagged: *"is a data map expressive enough without a code escape?"*) on the real
R-007 GET-pixel population. Surface **what varies vendor-to-vendor** toward the 026-03 config contract.

> **Scope: configs + adapter wiring + tests — ZERO connector/core code.** 026-01 shipped the machinery
> (`createPixelConnector`, the declarative `{endpoint, eventMap, paramMap}` interpreter, the selection seam,
> method-aware dispatch, the seal). LinkedIn + Bing are flat GET query beacons the interpreter **already** handles,
> so 026-02 adds only **config fixtures + adapter wiring + tests**. If any vendor needs new *code* in
> `connector.js`, that is itself the **finding** (a code-escape = the archetype doesn't fully generalise). The
> **POST/JSON wire shape is OUT** — a nested-body DSL + `ctx` access = 026-03's config-contract + identity charter.

**DoR (grounded 2026-09-02):**
- ✅ **026-01 DONE:** `createPixelConnector(config)` interprets a declarative `{endpoint, eventMap, paramMap}` — a
  **flat scalar** vocabulary (`connector.js:136-144`), always **GET, no body** (`:149`), and **never reads `ctx`**
  (`:44-46,125` — the AC8 security invariant). The selection seam + method-aware dispatch + the Meta `/tr` GET
  config + adapter wiring + the seal (consent / endpoint ceiling / input-side PII strip) all exist. 026-02 adds
  configs, not code.
- ✅ **Both target vendors are flat GET beacons the interpreter already handles (frame-critique-confirmed):**
  LinkedIn Insight = a GET 1×1 to `https://px.ads.linkedin.com/collect?pid=<partnerId>&fmt=gif&…` (`R-007:36`);
  Bing UET = a GET to `https://bat.bing.com/action/0?ti=<tagId>&evt=<event>&…` (`R-007:37`; the `uetq` global
  queue is client-side SDK **batching**, not a wire-format the connector reproduces). Both **ad** vendors →
  consent-gated (`ad_storage`). Exact param names grounded in the config fixtures at impl.
- ✅ **The generality bet is the point (and is de-risked for GET):** the frame-critique confirmed both vendors are
  flat GET query strings the scalar `paramMap` genuinely expresses — so 026-02 tests the bet on the *real*
  population and expects to pass, with an honest escape valve (below) if a vendor surprises.
- ⚠️ **Honest-finding escape valve:** if LinkedIn or Bing needs a transform the flat map can't express (a derived/
  hashed field, a per-event conditional, nesting), that is a **finding** — flag it, and it shapes 026-03's
  contract (or bounds the archetype). Not a failure to hide.

**Acceptance Criteria:**

1. **LinkedIn Insight as a flat GET config, ZERO connector code.** A `PageView` + a conversion event map to the
   correct `px.ads.linkedin.com/collect` GET beacon via a declarative config fixture — LinkedIn's own param
   vocabulary (`pid` partner id + a scalar `conversionId` on conversions; no universal `ev`-style key — the base
   tag fires on load), projected per `paramMap`, `method: "GET"`, no body; **exact keys grounded in the fixture**
   (proving the `paramMap` is output-key-agnostic, not Meta-shaped). Governed: consent-gated `ad_storage`
   (held/flushed/dropped),
   endpoint-confined to `px.ads.linkedin.com`, input-side PII strip, no un-governed `ctx` identity. Synthetic
   partner id.
2. **Bing UET as a flat GET config, ZERO connector code.** Same for `bat.bing.com/action/0` (a `ti` tag id +
   `evt` + params). Governed identically. Synthetic tag id.
3. **The archetype generalises — one connector, N configs, ZERO connector code.** A **table-driven** test proves
   the SAME `createPixelConnector` handles all three vendors (Meta from 026-01 + LinkedIn + Bing) purely by
   config. **Enumerable:** `git diff connectors/pixel/connector.js` is **empty**, and a grep asserts
   `connector.js` contains **no** vendor name/string (`meta`/`facebook`/`linkedin`/`bing`/`/tr`/`collect`/
   `action`) — vendor specifics live entirely in the config fixtures.
4. **What varies vendor-to-vendor, surfaced (toward 026-03).** Document the axes that actually varied across the
   three GET configs — endpoint, event-name map, param map, consent class, endpoint-confinement origin — as the
   emerging `PixelVendorConfig` shape. **Wire method is named as a *future* axis** (GET today; POST/JSON deferred
   to 026-03 — it needs a nested-body vocabulary + `ctx` access, and no real POST pixel motivates it yet). Any
   vendor needing a transform the flat map couldn't express (a code escape) is flagged honestly.
5. **Governed end-to-end per vendor; ZERO connector + core changes.** Each vendor rides the **existing** seal
   (026-01's properties re-proven per vendor: consent held/flushed/dropped, endpoint-confined, input-governed
   params only, no un-governed `ctx` identity in the URL). **`git diff connectors/pixel/connector.js` AND
   `git diff core/` are BOTH empty** — 026-02 is config fixtures + adapter wiring (`adapters/eds/index.js`) +
   tests, nothing else.
6. **No live identifiers.** Synthetic vendor ids (fake LinkedIn partner id, Bing tag id); public documented
   endpoints; no live beacon (assert on a `fetch` spy / the built `EgressRequest`).

**DoD:**
- [x] The 2 vendor config fixtures (`connectors/pixel/vendors/{linkedin,bing}.js`) + adapter wiring
      (`bootLinkedInInsight`/`bootBingUet`) + the table-driven generality test + the empty-diff / no-vendor-string
      enumeration, **TDD**.
- [x] All 6 ACs proven by **targeted** tests — per-vendor GET maps + governance (AC1/AC2/AC5, incl. all three
      consent states + selective PII strip), the one-connector-N-configs generality + empty-diff + strengthened
      no-vendor-string grep (AC3), the "what varies" write-up (AC4, in the Reconciliation sweep below).
- [x] `npm run lint` clean; **targeted** vitest green (981 across the non-oracle suite); **no live identifiers**
      (synthetic `0000000`/`00000000` ids; fetch-spy assertions).
- [x] **Frame-critique RE-PASS recorded** — `reviews/slice-02-frame-critique.md` (PASS after the POST-deferral reframe).
- [x] Compliance + craft reviews recorded (both NEEDS-CHANGES → PASS after the remediation below); close-out
      `### Deviation log` + `### Reconciliation sweep` below promote the config-contract shape + deferred
      POST/`ctx`-body axis toward 026-03.

**Anti-horizontal-phasing check:** 026-02 is **vertical** — each vendor config is a real, governed, dispatchable
GET beacon a site could route through airlock. It proves the 026 thesis (the config-driven archetype generalises
across R-007's real ~10-vendor GET-pixel population) by adding **real vendors end-to-end**, governed at the seal —
not speculative infrastructure (the speculative POST proof was cut). It is the **Data** axis of the SPIDR split
(more vendors as data/config), building directly on 026-01's proven Path, with **zero connector/core code**.

### Deviation log

- **AC3's no-vendor-string grep is scoped to comment-stripped code** (026-01's `connector.js` JSDoc header narrates
  "Meta"/"LinkedIn Insight"/"Bing UET"/`/tr` as illustrative prose, so a literal whole-file grep is incompatible
  with the empty-diff constraint). The invariant under test is "no vendor-specific **logic**." **Review-hardened:**
  the stripper now removes block comments + **full-line** `//` comments only — **NOT inline `//`** — because an
  inline strip also eats string-literal URLs (`"https://vendor…"`), which would let a hardcoded vendor endpoint in
  `connector.js` *code* (the likeliest AC3 violation) evade the grep behind its own `//`. Full-line-only stripping
  keeps such a string in the grepped code (026-02 compliance review).
- **The empty-`git diff` tests are a worktree-vs-index check** — they catch *uncommitted* local edits (a dev belt)
  but are effectively always-green in the committed steady state (026-02 craft review). The **durable** zero-code
  guarantee is therefore the strengthened no-vendor-string grep (it inspects current file content), not the diff
  check. Both retained; the grep is the load-bearing guard.
- **Bing's `gv`/`ec`/`evt=custom` param abbreviations are MODERATE-confidence fixture data** — not a captured live
  `bat.js` beacon; `ti` + `evt=pageLoad` + the endpoint are solidly grounded (R-007:37). Disclosed in `docs/inbox.md`
  + the (softened, per review) `bing.js` header. Within AC1/AC2 scope ("keys grounded in the fixture"); param-name
  fidelity is config data and does not move the zero-code generality thesis. A tracked follow-up tightens it if a
  live UET probe ever runs.
- **Not a deviation (reclassified per compliance):** the per-vendor "consent denied + strict → dropped" tests are
  AC1/AC5-**required** coverage (the third of held/flushed/dropped), not extra.
- **Review remediation:** the LinkedIn PII test now asserts a surviving non-denied field (selective strip, matching
  Bing); the grep stripper + the `bing.js` grounding prose fixed as above.

### Reconciliation sweep

- **Question answered + Outcome:** the 026-01 declarative-map interpreter **generalises across real vendors** —
  LinkedIn Insight + Bing UET ship as flat GET configs with **zero connector/core code** (both diffs empty; the
  central generality bet HELD, **no code escape**). The elegant proof: LinkedIn — a vendor with **no event-name
  key at all** — is expressed as pure config (`eventMap: { page_view: null }`) riding the interpreter's existing
  `hasOwnProperty` + null-omit rules, no new code.
- **AC4 — what varies vendor-to-vendor (the `PixelVendorConfig` shape 026-03 pins):**
  1. **Endpoint** — 3 distinct origins+paths (varies trivially).
  2. **`eventMap`'s SEMANTIC role (the sharpest finding):** for Meta/Bing the mapped value *is* an event name; for
     LinkedIn it is a conversion **id** or `null`. Same mechanical shape (`{from:"event"}`), different meaning →
     026-03 should type `eventMap`'s value as **`string | null`** (not "name"), and document the `null`-omits idiom
     as first-class.
  3. **Param mix** varies — Meta 6 keys, LinkedIn 2 static + **0** `params`, Bing 4; `{from:"params"}` entries are
     optional/vendor-dependent.
  4. **Static params can be protocol boilerplate** (LinkedIn's `fmt: "gif"`), not only ids.
  5. **Consent class did NOT vary** in this sample (all `ad_storage`) — the field exists to vary (a future
     analytics-classed pixel → `analytics_storage`).
  6. **Multi-endpoint** (`config.endpoints[]`) exists in the interpreter but was unexercised — a named, ungrounded axis.
  7. **Wire method (GET/POST)** — POST **deferred to 026-03** (a nested-body vocabulary + `ctx` access; no real
     POST pixel motivates it yet).
- **Promoted, no orphans:** the config-contract axes above + the deferred POST/`ctx`-body axis → **026-03**. The
  Bing param-fidelity caveat + the `build.mjs` bundle-entry (now 3-vendor-wide, shared with the dom-chamber worker)
  → `docs/inbox.md` (tracked). The seal/manifest machinery (ADR-0006/0007) is unchanged.
- **Downstream named:** 026-03 (the `PixelVendorConfig` type + the identity/advanced-matching surface + POST/body);
  the shared `build.mjs` bundle-entry step. No dependency left dangling.
- **No live identifiers, no new dependency, zero connector/core code.**
