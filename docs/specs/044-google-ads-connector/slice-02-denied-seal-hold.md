---
status: DONE
dependencies: [044-01, 045-01, adr-0023]
last_verified: 2026-09-12
frame_review: true
arch_review: false
---

<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about runnable
     surfaces by probe first (run it / read source) or a citation, else mark them
     as assumptions in `## Assumptions` — never assert an unverified claim as fact. -->

## Slice 044-02 — g-ads opts into hold-until-granted (denied-consent parity)

**Goal:** Make the Google Ads connector **opt into** the core seal's `holdOnDenied` mode (spec 045-01 / [ADR-0023](../../decisions/adr-0023-ad-pzn-egress-hold-until-consent.md)
Option E), so under `ad_storage`-denied the AW beacon **holds at the seal** (buffers + flushes on a later grant) instead
of sending — matching the reference container's **captured** behavior (R-009 §(b): the container held the whole ad family
under reject-all). This is a **grounded, per-connector opt-in**, NOT a blanket rule: g-ads opts in *because its vendor
was captured holding*; GA4 does not (it sends cookieless); ungrounded vendors (LinkedIn/Bing) are untouched.

**The load-bearing claim (grounded 2026-09-11).** The denied re-capture (Playwright `OneTrust.RejectAll()` → reload,
R-009 §(b)) collapsed the ad-family egress **23 → 2**: under reject-all **no** Google Ads beacon fired (only GA4
cookieless-modeled). So the parity-correct denied behavior for the AW connector is **hold** (buffer, flush on grant),
grounded on the container — not chosen speculatively, and not a cookieless AW send.

**DoR:**
- ✅ 044-01 shipped the AW beacon (granted path) + the connector's `purposes.egress: ["ad_storage"]`.
- ✅ 045-01 provides the **mechanism** — the per-instance `holdOnDenied` opt-in on the core seal (denied governing
  purpose → hold+flush) **plus the re-map-on-grant channel** (`createAirlock({ remap })` + the additive optional
  `EgressRequest.event` field), landed **wired-but-inactive** (no connector supplies them yet). This slice **sets the
  flag AND supplies the re-map inputs** for g-ads (activating the channel); it does not build the mechanism.
- ✅ Grounded (R-009 §(b)): the container held AW under `ad_storage`-denied — the opt-in is evidence-backed, not opinion.

**Acceptance Criteria:**

1. **g-ads opts into `holdOnDenied` AND supplies the re-map inputs.** The google-ads connector's airlock instance is
   configured `holdOnDenied: true` (wired at whatever boot/config seam is in scope — mirroring how
   `consentStrict`/`egressPurposes` are threaded; note 044-01 deferred full boot wiring, so this AC is satisfied at the
   connector-config + seal level the 044-01 tests use, with runtime boot wiring following in the deferred boot slice). To
   make the hold-until-granted flush **re-map** (not re-send) — the load-bearing 045-01 correction — the connector also
   (a) **attaches its source `event`** to each ready `EgressRequest` (the additive optional `EgressRequest.event`
   channel, 045-01), and (b) is wired with g-ads' **main-thread `remap(event, consent)`** that re-reads `_gcl_au`→`auid`
   and re-encodes `gcs`/`npa` under the passed consent (reusing `sourceGoogleAdsCtx` / the 042 main-thread mapper path).
   A one-line rationale cites R-009 §(b) as the grounding.
2. **AW egress holds under `ad_storage`-denied, then RE-MAPS on grant (not a stale re-send).** With `holdOnDenied: true` +
   `ad_storage` denied (or pending), the AW beacon **buffers at the seal** (no egress) and the inspector records the hold;
   on a later `setConsent({ ad_storage: "granted" })` it **flushes RE-MAPPED under the now-granted consent**. The
   **load-bearing correction** is the Consent-Mode flip: the re-mapped beacon carries the **granted** `gcs`/`gcd`/`npa`
   (derived from the consent vector, ALWAYS available), **NOT** the stale under-denial `gcs`=denied/`npa`=1 that a verbatim
   re-send would fire (the unattributable "user-declined" beacon 045-01 forbids). The re-map ALSO re-sources the consent-gated
   `_gcl_au`→`auid` under the now-granted `ad_storage` (omitted-when-absent, never minted — §A5). **§A5 scope:** on a real
   container-removed page nothing writes `_gcl_au`, so `auid` may be absent both under denial and after grant — the
   fresh-`auid` assertion is proven **in-test with a synthetic (real-shaped) `_gcl_au`**, demonstrating the consent-gated
   re-source; the always-present `gcs`/`npa` flip is the field a live rewired page relies on. With `ad_storage` granted
   from the start, 044-01's beacon fires unchanged.
3. **No cookieless AW fallback (parity).** The connector emits exactly one beacon shape (044-01's ccm/collect); under
   denial the seal **holds** it — the connector does **not** produce a separate cookieless AW variant (contrast GA4's
   analytics path). Asserted against R-009 §(b) (the container held, it did not cookieless-send ads).
4. **Behavior-preserving.** Full `npx vitest run` green; unit tests cover granted→fires / denied→held / pending→held /
   grant→**re-mapped** (the flushed beacon carries granted `gcs`/`gcd`/`npa` — the load-bearing flip — and, in-test with a
   synthetic `_gcl_au`, a fresh `auid`; **not** the stale under-denial payload), and the no-cookieless-fallback assertion.
   No arch pass (reuses 045-01's mechanism; `arch_review: false`).

**DoD:**
- All ACs met; full suite green; the denied-hold + grant-flush witnessed by tests.
- Compliance + craft passes recorded; reconciliation walked.

**Out of scope (explicit):**
- The `holdOnDenied` **mechanism** itself — 045-01.
- Meta/Floodlight opt-ins (grounded follow-ups, their own specs); LinkedIn/Bing (ungrounded).
- The true conversion ping / enhanced-match hashes (MVP9); the cross-site DMP sync (E10).

## Assumptions

**A1 (denied = hold, grounded).** The container holds the Google Ads family under `ad_storage`-denied (R-009 §(b),
23→2). *Risk if wrong:* a different adopter profile that cookieless-sends AW under denial would opt out (leave
`holdOnDenied` unset) or need a per-profile override — a named future variant, per ADR-0023 A2; this slice grounds the
reference profile.

**A2 (provable pre-boot; two deferred edges — folded from the 044-02 frame-critique, 2026-09-12).** This slice proves the
opt-in end-to-end at the **seal-config level** — a real `createAirlock({ holdOnDenied, remap })` plus the g-ads producer
(`handle` attaching `event` + `createGoogleAdsRemap`) wired through the `FakeWorker` seal harness
(`test/consent-seal.test.js`) — NOT through production boot. Two edges are deferred: (a) the `adapters/eds` runtime
threading of `holdOnDenied` + `remap` for the `google-ads` connector type follows 044-01's **deferred g-ads boot** (the
039→041 precedent); (b) the `FakeWorker` harness invokes `onmessage` with an object literal, so the real worker→main
**structured-clone** of the attached `EgressRequest.event` is not exercised here. *Risk if wrong:* a non-clone-safe event
field would fail at real boot — mitigated because `AirlockEvent` is plain, clone-safe data (`contracts/connector.d.ts`);
named so the deferred boot slice verifies both edges.

### Deviation log (after reconciliation)

The slice as framed (DRAFT + the frame-critique folds) held up. Notes:

- **[as framed] g-ads supplies BOTH re-map halves.** `handle` attaches the source `event` to its ready
  `EgressRequest` (the 045-01 additive channel); `createGoogleAdsRemap` (pure — injected
  `readCookieString`) re-sources `_gcl_au`→`auid` under granted `ad_storage` + re-encodes `gcs`/`gcd`/`npa`
  from the passed consent, reusing the existing `mapToAwCollect` + `sourceGoogleAdsCtx` (no forked encoding).
- **[craft nit → CLOSED, not just logged] gcd flip coverage.** The re-map re-encodes `gcs`/`gcd`/`npa`, but
  the initial test asserted only `gcs`/`npa`. Added a `gcd` denied→granted flip assertion to the seal
  re-map test (a regression caching the boot-time `gcd` now fails) + a `createGoogleAdsRemap` unit test
  exercising `consentDefault`. AC2/AC4 wording aligned to `gcs`/`gcd`/`npa`.
- **[craft nit → CLOSED] consentDefault + landingUrl.** The new unit test passes both — asserting the `gcd`
  default-scope re-encode + inbound `gclid` re-discovery from `landingUrl` (consent-independent, forwarded
  on both denied and granted re-maps).
- **[compliance nit → CLOSED] pending→held.** AC4 enumerates it; added a pending-vector g-ads hold test
  (held, no fetch, reason names "pending" via 045-01's state-derived reason) — was mechanism-redundant but
  now explicitly covered for g-ads.
- **[informational, accepted] `event` on every g-ads beacon.** `handle` attaches `event` even on the
  granted immediate-send path (the connector can't know the seal verdict in the worker); plain clone-safe
  `AirlockEvent` data, connector-local — other connectors keep `event===undefined` → the seal's `canRemap`
  is false for them, byte-unchanged. Accepted cost, not a finding.
- **Ratified strengths (craft).** The injected-`readCookieString` purity seam, the connector-local `event`
  attach, and the non-vacuous re-map test (pins the stale denied payload, asserts all three flip) are
  patterns the sibling ad connectors (Floodlight/Meta opt-ins) should copy.
- **Deferred edges (A2, tracked for the g-ads boot slice).** (a) `adapters/eds` runtime threading of
  `holdOnDenied`+`remap` for the `google-ads` type (follows 044-01's deferred boot); (b) the real
  worker→main structured-clone of `EgressRequest.event` (the `FakeWorker` harness uses an object literal).

### Reconciliation sweep

- Full `npx vitest run` → **104 files / 1604 passed, 0 fail** (1602 after implementation + 2 added in
  reconciliation: the pending→held case + the `createGoogleAdsRemap` consentDefault/landingUrl unit;
  `test/google-ads-seal.test.js` is 8 `it()`). `eslint .` → 0.
- Behavior-preserving: 044-01's granted path + all other connectors byte-unchanged; the `event` attach is
  g-ads-local (other connectors' `EgressRequest`s keep `event===undefined`).
- `core/**` and `contracts/**` untouched — the 045-01 mechanism is reused, not modified.
- Changed-file dispositions (working tree, since c11f681):
  - `connectors/google-ads/connector.js` — `handle` attaches `event`; new `createGoogleAdsRemap`; doc updates.
  - `test/google-ads-seal.test.js` (new, 8 `it`) — seal-level hold + re-map-not-re-send proof + purity +
    the reconciliation coverage adds.
  - `docs/specs/044-google-ads-connector/slice-02-denied-seal-hold.md` — frame-critique folds, AC2/AC4 `gcd`
    wording, lifecycle frontmatter, this reconciliation.
  - `docs/specs/044-google-ads-connector/reviews/slice-02-{frame-critique,compliance,craft}.md` — review
    evidence (`slice-02-reconciliation.md` is recorded at the RECONCILED transition, after this sweep).
- Status board (`docs/specs/README.md`) still shows 044-02 as `DRAFT` — **to be** regenerated at DONE
  (deferred-to-DONE board regen; not a content change in this slice).

### Close-out (post-DONE)

- [x] Spec 044 rolls up when 044-02 is DONE (044-01 already DONE); regenerate the board — spec 044 → DONE, board regenerated.
