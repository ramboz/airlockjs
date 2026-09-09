---
status: DRAFT
dependencies: [039-02]
last_verified:
frame_review: true
---

## Slice 039-05 — Consent-Mode defaults carriage (gcd derivation)

**Goal:** Carry the Consent-Mode **DEFAULTS** string `gcd` on the `/g/collect` beacon for the **default-denied**
deployment (the standard Consent Mode config — deny-by-default + update-on-grant, which is airlock's consent-governed
target), **derived** from the resolved consent vector. This is the modeling-signal half of Consent Mode that `gcs`
(039-02) does not cover. Split out from 039-02 because `gcd` co-varies with consent and is not a pure `gcs`-style function.

**Grounding note (2026-09-09 — now live-grounded).** The reference page's **declared default is denied for all four
signals** (read from dataLayer: `gtag('consent','default',{ad_storage:denied, analytics_storage:denied, ad_user_data:denied,
ad_personalization:denied, wait_for_update:10})`). Careful single-update captures (one update + ~2.8s settle + one fire —
avoiding the earlier rapid-update race) ground the per-signal mapping and its independence:

| update vector (default = denied) | `gcs` | `gcd` | interior letters `[ad, analytics, ad_user_data, ad_personalization]` |
|---|---|---|---|
| all granted | `G111` | `13r3r3r3r5l1` | `[r,r,r,r]` |
| all denied  | `G100` | `13q3q3q3q5l1` | `[q,q,q,q]` |
| only `ad_storage` granted | `G110` | `13r3q3q3q5l1` | `[r,q,q,q]` |
| only `analytics_storage` granted | `G101` | `13q3r3q3q5l1` | `[q,r,q,q]` |
| only `ad_user_data` granted | `G100` | `13q3q3r3q5l1` | `[q,q,r,q]` |
| only `ad_personalization` granted | `G100` | `13q3q3q3r5l1` | `[q,q,q,r]` |

The **four single-signal-granted** captures **each pin one position independently** — so both per-signal independence
AND the full **position order** (`ad_storage`, `analytics_storage`, `ad_user_data`, `ad_personalization`) are
**live-grounded, not asserted** (the lone `r` walks positions 1→4 as the granted signal walks the vector). All six anchors
are committed at `test/fixtures/parity-ga4-consent-gcd.redacted.json`. So for the default-denied config:

```
gcd = "13" + L(ad_storage) + "3" + L(analytics_storage) + "3" + L(ad_user_data) + "3" + L(ad_personalization) + "5l1"
      where L(update=granted) = "r",  L(update=denied) = "q"
```

The `13…3…3…3…5l1` framing (leading `13`, `3` separators, trailing `5l1`) is the **structural constant for this declared
default** (denied-all + `wait_for_update:10`).

**DoR:**
- ✅ 039-02 done — the `gcs` encoder + the consent-vector resolution seam (`core/consent.js` `resolveConsent`) exist;
  this slice adds the second Consent-Mode string alongside `gcs`.
- ✅ Three clean live anchors captured (`[r,r,r,r]`, `[q,q,q,q]`, `[r,q,q,q]`) establishing the per-signal r/q mapping,
  independence, and position order for the default-denied deployment — **committed** at
  `test/fixtures/parity-ga4-consent-gcd.redacted.json` (gcs/gcd are Consent-Mode strings, not identifiers → R5-committable),
  so the anchors are verifiable, not only in a local capture log.
- ✅ Fixture prerequisite done — `test/fixtures/parity-ga4-collect.redacted.json`'s `gcd` was corrected from the earlier
  synthetic `13p3p3p2p1p1` to the live-observed granted value `13r3r3r3r5l1` (matching its `gcs=G111`), so the 038
  same-protocol oracle can diff airlock's emitted `gcd` against a real reference value once this slice closes the gap row.

**Acceptance Criteria:**

1. **A `gcd` encoder** for the default-denied deployment maps the resolved consent vector's four signals
   (`ad_storage`, `analytics_storage`, `ad_user_data`, `ad_personalization`) to the per-signal letters
   (`granted`→`r`, `denied`→`q`) and emits `13<L>3<L>3<L>3<L>5l1` in that position order. Gated to the default-denied
   config (see AC4).
2. **All six live anchors reproduce exactly** (`test/fixtures/parity-ga4-consent-gcd.redacted.json`) — all-granted →
   `13r3r3r3r5l1`, all-denied → `13q3q3q3q5l1`, and the **four single-signal-granted** anchors that pin each position:
   `ad_storage`→`13r3q3q3q5l1`, `analytics_storage`→`13q3r3q3q5l1`, `ad_user_data`→`13q3q3r3q5l1`,
   `ad_personalization`→`13q3q3q3r5l1`. Together they fail on any signal-order swap or per-signal-independence break.
   Asserted against the live-observed values, not synthetic strings.
3. **`gcd` co-varies per-signal and stays internally consistent with `gcs`.** Changing one signal's update flips exactly
   its own letter (`r`↔`q`); on a single beacon the `gcs` storage digits and the corresponding `gcd` letters never
   disagree (e.g. `gcs` shows `analytics_storage` granted while `gcd`'s analytics letter says denied).
4. **Scoped to the default-denied config; omit when out-of-scope or undecidable — a KNOWN GAP, not a parity claim.** If the
   host declares a **non-denied** default (unsupported — the default-granted letters are unobservable here, see
   Assumptions), or a governing signal is `pending` (039-02 discipline), `gcd` is **omitted** rather than emitting a
   possibly-wrong string. **Honesty note:** against a container that *does* send `gcd` under a non-denied default, omission
   is a dropped-field **non-parity** (the same-protocol oracle scores it a miss), NOT a safe default — so this is an
   explicit, tracked **unsupported-config gap** for the rare default-granted deployment, not a parity guarantee. For
   airlock's target (the default-denied config, which the reference page uses), `gcd` is emitted and achieves parity.

**DoD:**
- [ ] All ACs pass; full suite green.
- [ ] Coverage: the four single-signal anchors (each position, from the fixture), all-granted, all-denied, a
      `pending`-signal omission, and a non-denied-default omission (the tracked known gap).
- [ ] Each new test shown to fail when its feature is removed (encoder deletion → gcd absent; signal-order swap → the
      asymmetric anchor fails).
- [ ] Descriptor: the `gcd` gap row (currently owned `039-05`) closes → `gcd` classifies `maps` in the 038 oracle.
- [ ] Reviewed by `reviewer` (compliance + craft).
- [ ] Deviation log + reconciliation sweep produced.

## Assumptions

- **The default-denied per-signal mapping is live-grounded (committed); the default-GRANTED row is NOT (a tracked
  unsupported-config gap).** Six captures — committed at `test/fixtures/parity-ga4-consent-gcd.redacted.json` —
  establish `(default=denied, update=granted)→r` / `(default=denied, update=denied)→q` per signal, independent; the
  **four single-signal-granted anchors each pin one position**, so the position order (`ad_storage`,
  `analytics_storage`, `ad_user_data`, `ad_personalization`) is **live-grounded, not asserted from documentation**. The
  `(default=granted, update=X)` letters (documented Consent Mode v2 uses other codes, e.g. `p`)
  are **not observable on this page** (its declared default is fixed denied). A default-granted deployment is unusual for
  consent-required regions (airlock's target is default-deny + update-on-grant), so this slice **scopes to the
  default-denied config** and **omits `gcd`** for any other declared default rather than guessing. **This omission is a
  known non-parity for the default-granted config** (a container that sends `gcd` there → the oracle scores airlock's
  omission a dropped-field miss), tracked — NOT a claim that omission is parity-safe. (Why `frame_review: true`.)
  **Resolution trigger for the default-granted row:** a capture from a page/config declaring a granted default, or an
  authoritative CMv2 (default×update) letter table → then extend the encoder + drop the omission.
- **The `13…5l1` framing is tied to the declared default** (denied-all + `wait_for_update:10`), observed constant across
  all captures. A different declared default (or `wait_for_update`) could change the framing — another reason the encoder
  is scoped to the observed default-denied config and omits otherwise.
- **`npa` (non-personalized ads) also tracks consent** (0 granted / 1 denied, observed) — out of this slice's scope
  (`gcd` only); flagged for whoever adds `npa` to the connector's field set (derives from `ad_personalization`).

**Anti-horizontal-phasing check:** After this slice a consent-governed (default-denied) rewired page carries BOTH
Consent-Mode strings — `gcs` state (039-02) + `gcd` defaults — the pair GA4 needs to drive consent-mode modeling, verified
by the parity harness against the live-observed anchors. Full Consent-Mode parity for the standard config.

### Deviation log (after reconciliation)

_TBD at implementation._

### Reconciliation sweep

_TBD at implementation._
