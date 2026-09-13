---
status: Accepted
dependencies: [adr-0023]
last_verified: 2026-09-13
frame_review: true
---

# ADR-0024: N-beacon fan-out re-map via a per-beacon `remapKey` (extends ADR-0023)

## Status

Accepted (2026-09-13, implemented by spec 045-03) — **extends [ADR-0023](adr-0023-ad-pzn-egress-hold-until-consent.md)**
(the per-connector `holdOnDenied` opt-in + the re-map-on-grant flush). Does not supersede it; it lifts ADR-0023's
explicitly-named **1:1 limit** ("`remap` rebuilds **one** request per held item, so a connector whose `handle` fans one
event out to N held beacons is a future variant", ADR-0023 "Landed shape + scope") so a **fan-out** connector's held
beacons each re-map to their correct wire form on grant.

**Landed shape + scope (2026-09-13, spec 045-03).** Shipped as Option B: an additive-optional `EgressRequest.remapKey`
(`contracts/connector.d.ts`), the seal preserving it on the held record and threading it into
`remap(event, consent, remapKey)` **only when set** (`core/airlock.js` hold + flush) — so a 1:1 connector's
`remap(event, consent)` call is arity-byte-identical to 045-01 (backward-compat verified: every pre-existing seal test
passes unmodified). The per-flush endpoint-ceiling re-check + the declined-re-map terminal `dropped` diagnostic apply per
rebuilt URL with no new plumbing. Mechanism + a synthetic 2-beacon proof only; Floodlight (spec 046-03) is the first real
consumer.

## Context

Spec 045-01 shipped hold-until-granted with a **re-map on grant**: a `holdOnDenied` held beacon is rebuilt under the
now-current consent/ctx via the connector's main-thread `remap`, not re-sent as the stale under-denial payload
(ADR-0023). The shipped mechanism is **1:1 event→beacon** (verified in-tree):

- **Hold** (`core/airlock.js:452-454`): a re-map hold buffers `{ event: r.event, remap: true, beaconId }` — it carries
  the source `event` but **no discriminator** for *which* of a connector's beacons this held item is.
- **Flush** (`core/airlock.js:747`): `const req = b.remap ? remap(b.event, consentVector) : {…}` — a **single**
  `remap(event, consent)` call returning **one** `EgressRequest`.
- The contract records the limit (`contracts/connector.d.ts:100-103`): "the `remap` rebuilds ONE request, so a connector
  whose `handle` fans one event out to N held beacons is not yet supported by re-map (g-ads is 1:1 event→beacon)"
  (also `docs/refinement-todo.md`).

**The grounded need (spec 046, Floodlight/DC).** A container's Floodlight tag fires **two** page-load beacons from one
`page_view` — `www.google.com/ccm/collect` (query-delimited) **and** `ad.doubleclick.net/activity` (`;`-delimited)
— and, grounded on R-009 §(b) (the `ad_storage`-denied re-capture held the whole DC family), **both** must opt into
`holdOnDenied` (spec 046-03). After spec 046-02 the Floodlight connector's `handle(page_view)` returns **two**
`EgressRequest`s. Under the 1:1 mechanism both held beacons carry the same `event` and the seal calls `remap(event)`
twice — a single `remap` cannot know which held item is the ccm form and which is the activity form, so both would
rebuild as the *same* form: ccm parity or activity parity is lost, and spec 046-03 AC2 ("both flush RE-MAPPED … NOT the
stale payload") cannot be met by pure reuse. This is the exact "future variant" ADR-0023 deferred.

## Decision Options Considered

### Option A: connector self-contains the discriminator (no core change)
- The connector attaches a **form-discriminating synthetic `event`** to each beacon (e.g. `{ …event, _form: "ccm" }` /
  `{ …event, _form: "activity" }`); the single `remap` branches on `event._form`. The shipped seal is untouched — each
  held item already carries its own `r.event`, so two distinctly-tagged events flow through unchanged.
- **Pros:** zero core/contract change; ships entirely inside spec 046.
- **Cons (why rejected):** overloads the `event` channel — a connector's *source* event — with a wire-form tag it was
  not designed to carry (`AirlockEvent` is the captured event, not a re-map routing key), so the discriminator is an
  undocumented private convention each fan-out connector reinvents; it leaves the contract's "fan-out not supported"
  note **false in prose but true in the type**, and a reviewer reading `connector.d.ts` would still believe fan-out is
  unsupported. The seam that makes fan-out work should be **named in the contract**, not smuggled through a payload
  field. Rejected as the mechanism (kept only as the fallback intuition it generalizes).

### Option B (chosen): a per-beacon `remapKey` on `EgressRequest`, threaded into `remap`
- Add an **additive-optional** `readonly remapKey?: string` to `EgressRequest` (ADR-0017 frozen-core rule: a connector
  that doesn't set it is byte-unchanged). A fan-out connector's `handle` sets a **distinct** `remapKey` per beacon
  (`"ccm"` / `"activity"`). The seal **preserves** it on the held record (`core/airlock.js` hold site) and passes it as
  a **third argument** to the re-map: `remap(event, consent, remapKey)`. The connector supplies **one** key-aware
  `remap` that dispatches on `remapKey` to rebuild the correct form.
- **Pros:** general across **independently-reconstructable** N-beacon fan-outs (not just Floodlight — see the coordinated-fan-out carve-out under Open questions); **backward-compatible by construction** — a
  1:1 connector (g-ads) sets no `remapKey`, the held record stores `undefined`, and its `(event, consent) => …` remap
  ignores the unused third arg, so the shipped path is byte-identical; the seam is **named in the contract**; the
  existing per-flush endpoint-ceiling re-check (`core/airlock.js:771-784`) already re-checks each rebuilt URL, so the
  activity form's `;`-pathname is covered with no extra plumbing.
- **Cons:** adds one optional contract field + a third remap parameter (both additive).

### Option C: `remap` returns `EgressRequest[]`, matched back by `beaconId`
- The flush calls one `remap(event, consent)` returning **all** forms, then matches each back to its held record.
- **Cons (why rejected):** the flush is inherently **per held beacon** (it splices `heldBeacons` and iterates,
  `core/airlock.js:742-747`); making one held item's flush rebuild the *whole* fan-out and then re-associate N results
  to N held records needs new identity plumbing and re-runs the connector's full fan-out once per held beacon (N×N).
  More invasive than Option B for no added expressiveness. Rejected.

## Recommended Decision

**Option B — per-beacon `remapKey`.** `EgressRequest` gains an additive-optional `remapKey?: string`; the seal carries
it on the held record and passes it to `remap(event, consent, remapKey)`. A fan-out connector sets a distinct key per
beacon and its single `remap` dispatches on the key. 1:1 connectors set no key and are byte-unchanged. Accepts as the
mechanism spec 045-03 lands; spec 046-03 (Floodlight) is its first consumer.

## Consequences

**Becomes easier:**
- A fan-out connector whose beacons are **independently reconstructable** — each rebuildable from
  `(event, consent, remapKey)` + live host ctx, with no value that must be *coordinated across* the beacons — holds
  **all** its beacons under denial and re-maps **each** to its correct form on grant, via the one shared seal, with no
  per-connector buffer/flush. Floodlight qualifies (spec 046 recon): its shared id is `_gcl_au`-derived (§A4) and the
  only cross-beacon-differing value is the `activity` form's random `num`/`ord` pathname cachebuster, which needs no
  coordination. (Coordinated fan-outs are carved out — see Open questions.)
- The contract states the fan-out seam explicitly (`remapKey`), so the capability is discoverable, not folklore.

**Becomes harder:**
- A fan-out connector must set a **stable, distinct** `remapKey` per beacon AND supply a key-aware `remap`. Two failure
  modes: a key for which `remap` returns **no** beacon reuses 045-01's terminal `dropped` diagnostic
  (`core/airlock.js:752-762`), so it is **observable**; a **colliding** key (two held beacons keyed the same) makes
  `remap` return a *valid but wrong* form for both, with **no** diagnostic **today** — an authoring footgun the consumer
  (046-03) must avoid by construction (distinct keys). This is a *chosen* omission, not an impossibility: the flush holds
  the entire held set in hand before iterating (`core/airlock.js:749-750`), so an O(n) duplicate-`remapKey`-within-a-batch
  warn is **structurally possible and deferred** until a real fan-out consumer needs it (Floodlight uses two distinct
  keys by construction). The seal still cannot judge a single beacon's *semantic* correctness — only a structural key
  collision.

## Assumptions

None load-bearing beyond the in-tree mechanism cited above (`core/airlock.js` hold `:452-454` / flush `:747` /
ceiling-re-check `:771-784`; `contracts/connector.d.ts:100-103`), all read at authoring. The change is additive to a
mechanism spec 045-01 already shipped and tested.

## Open questions

- **Coordinated fan-outs are out of scope (a future re-open).** Option B reconstructs each held beacon
  **independently** — one `remap(event, consent, remapKey)` call per held item, with no cross-beacon channel. A
  hypothetical vendor whose N beacons must share a **non-derivable coordinated** value (a single server-assigned
  batch/dedup id echoed across all beacons, or mutually-exclusive sequence numbers) cannot be reproduced by isolated
  per-key re-maps — it would fire N internally-valid but mutually-inconsistent beacons, which the seal cannot detect.
  No such vendor is in scope today (Floodlight's two forms are independently reconstructable); flagged so a future
  coordinated-fan-out consumer **re-opens this decision** (a coordinated-flush variant) rather than silently assuming
  reuse.
- Whether `remapKey` should be a free-form string (connector-chosen) or a typed enum. **Leaning free-form** — the seal
  treats it as an opaque token it round-trips to the connector's own `remap`; the connector owns the vocabulary. Revisit
  only if a cross-connector consumer ever needs to interpret it.
- **The additive-optional contract carve-out is precedent-based.** ADR-0017's frozen-core rule reads "a superseding ADR +
  a major-version break"; this slice's additive-optional `remapKey` (semver-minor, non-breaking) follows the established
  `EgressRequest.event` (ADR-0023) + `ConsentPurpose` additive-only (012-04) precedent, with this ADR as the governing
  record. Whether that carve-out should be captured **authoritatively** (an ADR-0017 amendment or `docs/conventions.md`)
  rather than inferred from precedent each time is left open — flagged to `docs/refinement-todo.md`.
