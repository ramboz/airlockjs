---
status: DEFERRED
dependencies: [039-02]
last_verified:
frame_review: true
---

## Slice 039-05 — Consent-Mode defaults carriage (gcd derivation)

> **DEFERRED (2026-09-08).** Frame-critique (round 1) correctly found this under-grounded to build: both live `gcd`
> anchors (`r` granted / `q` denied) were captured via consent *update* on one page whose *declared default is denied*
> — so they ground only the resolved-vector dimension at a fixed default, and a pure-vector encoder would pass every
> stated AC while the load-bearing declared-default input (AC1) stays untested. An attempt to add the discriminating
> grounding (mixed-vector + default-varying captures) failed: rapid `gtag('consent','update')` calls race the event
> dispatch on the live page, yielding internally-inconsistent beacons (see `captures/observed-rules.md`). `gcd` cannot be
> honestly derived from available evidence yet.
>
> **Resolution trigger:** obtain clean grounding for the declared-default dimension and per-signal independence — either
> (a) captures from a page/config whose declared Consent-Mode default differs (default-granted row), plus non-racing
> mixed-vector captures, or (b) an authoritative Consent Mode v2 `gcd` (default × update) letter table — THEN build the
> derive-from-(default+vector) encoder. Consent-STATE parity (`gcs`) ships now in 039-02; this is the modeling-defaults
> half and can follow. (Deferred, not abandoned: the two clean default-denied anchors + the declared-default read are a
> real head start.)

**Goal:** Carry the Consent-Mode **DEFAULTS** string `gcd` on the `/g/collect` beacon, **derived** from the container's
declared Consent-Mode default **plus** the resolved consent vector — the modeling-signal half of Consent Mode that
`gcs` (039-02) does not cover. Split out from 039-02 because `gcd` proved (live, 2026-09-08) to be neither a pure
function of the runtime vector nor a carry-verbatim constant: it **co-varies with consent state**.

**Grounding note (2026-09-08).** The page's **declared default is denied for all four signals** (read from dataLayer:
`gtag('consent','default',{ad_storage:denied, analytics_storage:denied, ad_user_data:denied, ad_personalization:denied,
wait_for_update:10})`). Observed live by flipping the *update* via `gtag('consent','update', …)` — so both anchors are
the **default-denied row**, varying only the update:

| declared default | update | `gcd` | `gcs` | `npa` |
|---|---|---|---|---|
| denied | granted | `13r3r3r3r5l1` | `G111` | 0 |
| denied | denied  | `13q3q3q3q5l1` | `G100` | 1 |

So `r` = (default-denied → update-granted) and `q` = (default-denied → update-denied). Per documented Consent Mode v2 the
four interior letters encode a per-signal **(declared-default × update)** pair — so `gcd` needs **both** the declared
default (config) **and** the resolved vector. **What is NOT grounded:** the default-**granted** row (a different letter,
never observed here — this page's default is denied), and per-signal independence (the mixed-vector captures raced —
`observed-rules.md`). That gap is exactly why this slice is deferred.

**DoR:**
- ✅ 039-02 done — the `gcs` encoder + the consent-vector resolution seam (`core/consent.js` `resolveConsent`,
  `connectors/ga4/consent.js`) exist; this slice adds the second Consent-Mode string alongside `gcs`.
- ✅ Two live anchors captured (granted `13r3r3r3r5l1`, denied `13q3q3q3q5l1`) as encoder test targets.

**Acceptance Criteria:**

1. **A `gcd` encoder** produces the Consent-Mode defaults string from the **declared default** (`config.consentModeDefault`
   per signal) **and** the resolved consent vector, per documented Consent Mode v2 per-signal codes.
2. **Both live anchors reproduce exactly.** With declared-default **denied**: an update-granted input yields
   `13r3r3r3r5l1`, an update-denied input yields `13q3q3q3q5l1` — asserted against the live-observed values, not
   synthetic strings. (The default-granted row must be grounded by a fresh capture before it is encoded — see the
   deferral trigger.)
3. **`gcd` co-variance is honored.** Changing the resolved vector changes `gcd`'s per-signal letters (the encoder is a
   function of the vector, not a constant); the `gcs`/`gcd` pair on a single beacon is internally consistent (never a
   granted `gcs` beside a denied-signal `gcd` letter, or vice-versa).
4. **Omit when undecidable.** With no declared default configured (or a `pending` signal per 039-02's discipline), the
   corresponding `gcd` position is omitted / the string is omitted rather than fabricated — never a misleading default.

**DoD:**
- [ ] All ACs pass; full suite green.
- [ ] Coverage: all-granted anchor, all-denied anchor, a mixed vector (some signals granted / some denied), and the
      no-default / pending omission path.
- [ ] Each new test shown to fail when its feature is removed.
- [ ] Reviewed by `reviewer` (compliance + craft).
- [ ] Deviation log + reconciliation sweep produced.

## Assumptions

- **The full Consent-Mode-v2 `gcd` letter grammar is grounded on two anchors + documentation, not exhaustively
  observed.** Only the all-granted (`r`) and all-denied (`q`) per-signal letters are live-captured; the codes for
  `default≠update` combinations (e.g. default-denied → update-granted) and any signals beyond the four observed are
  taken from documented Consent Mode v2 and **confirmed on captures spanning more consent-default/update combinations
  before the encoder is frozen**. A wrong letter yields a beacon whose `gcd` diffs clean field-presence-wise yet
  mis-signals modeling consent — the exact "diffs clean but mis-attributes" trap, surfacing at MVP9 live console. (Why
  `frame_review: true`.) **Kill-criterion:** if the observed per-signal code cannot be reproduced as a function of
  (declared default, resolved state), the derive-from-inputs frame is void and `gcd` falls back to a
  capture-provisioned per-state table.
- **`npa` (non-personalized ads) also tracks consent** (0 granted / 1 denied, observed) — if `npa` is in this
  connector's field set it derives from `ad_personalization` the same way; scoped with `gcd` here, not 039-02.

**Anti-horizontal-phasing check:** After this slice a consent-governed rewired page carries BOTH Consent-Mode strings
(`gcs` state + `gcd` defaults) GA4 needs to drive modeling — full Consent-Mode parity, end-to-end and verifiable by the
parity harness against the observed anchors.

### Deviation log (after reconciliation)

_TBD at implementation._

### Reconciliation sweep

_TBD at implementation._
