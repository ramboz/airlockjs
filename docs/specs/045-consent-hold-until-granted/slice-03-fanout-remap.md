---
status: DONE
dependencies: [045-01, adr-0024]
last_verified: 2026-09-13
frame_review: true
arch_review: true
---

<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about runnable
     surfaces by probe first (run it / read source) or a citation, else mark them
     as assumptions in `## Assumptions` — never assert an unverified claim as fact. -->

## Slice 045-03 — seal N-beacon fan-out re-map (per-beacon `remapKey`)

> **Grounded 2026-09-13** in the shipped 045-01 seal: the re-map hold buffers `{ event, remap: true, beaconId }`
> (`core/airlock.js:452-454`) and the flush calls a single `remap(event, consent)` (`core/airlock.js:747`) — **1:1
> event→beacon**, the limit named in `contracts/connector.d.ts:100-103`, [ADR-0023](../../decisions/adr-0023-ad-pzn-egress-hold-until-consent.md)
> "Landed shape + scope", and `docs/refinement-todo.md`. This slice lifts that limit per
> [ADR-0024](../../decisions/adr-0024-fanout-remap-per-beacon-key.md) (Option B — a per-beacon `remapKey`), so a connector
> whose `handle` fans one event out to N held beacons re-maps **each** to its correct wire form on grant. Its first
> consumer is Floodlight (spec 046-03, ccm + activity); this slice ships the **mechanism + synthetic proof only** — no
> real connector opts in here.

**Goal:** Extend the core seal's re-map-on-grant so an N-beacon fan-out connector's held beacons each rebuild to their
correct form (implements [ADR-0024](../../decisions/adr-0024-fanout-remap-per-beacon-key.md)). Add an additive-optional
`EgressRequest.remapKey`; the seal preserves it on the held record and threads it into `remap(event, consent, remapKey)`.
A 1:1 connector that sets no `remapKey` is **byte-identical to today** (the third arg is unused). Delivers: the seal can
hold + correctly re-map a multi-beacon connector, connector-agnostic.

**Why additive, not a rewrite (ADR-0017 frozen-core rule).** `EgressRequest.remapKey?` is optional; a connector that
never sets it stores `undefined` on the held record and its `(event, consent) => …` remap ignores the third argument —
so g-ads (044-02, 1:1) and every non-opted-in path are unchanged. The seam is **named in the contract** rather than
smuggled through the `event` payload (ADR-0024 Option A, rejected).

**DoR:**
- ✅ 045-01 shipped the `holdOnDenied` opt-in + the 1:1 re-map-on-grant flush (`core/airlock.js` hold `:452-454` /
  flush `:747` / per-flush endpoint-ceiling re-check `:771-784`; `contracts/connector.d.ts` `event` channel).
- ✅ [ADR-0024](../../decisions/adr-0024-fanout-remap-per-beacon-key.md) (Option B) is the governing decision; this slice
  moves it Proposed → Accepted.

**Acceptance Criteria:**
1. **`EgressRequest.remapKey?: string`** is added to the contract (`contracts/connector.d.ts`), additive-optional
   (ADR-0017), documented as the fan-out re-map disambiguator a connector's `handle` sets per beacon; the "known
   limitation … fan-out … not yet supported" note is updated to state fan-out IS supported via `remapKey`.
2. **The seal carries `remapKey` hold→flush and passes it to `remap`.** The hold site (`core/airlock.js:452-454`)
   records `remapKey: r.remapKey` on the re-map held item; the flush (`core/airlock.js:747`) calls
   `remap(b.event, consentVector, b.remapKey)`. Witnessed by a FakeWorker seal test: a **synthetic 2-beacon fan-out
   connector** (one `page_view` → two `EgressRequest`s with distinct `remapKey`s, e.g. `"a"`/`"b"`, both carrying the
   source `event`) held under `holdOnDenied` + denied purpose → on `setConsent(granted)` **both** held beacons flush,
   each RE-MAPPED to its **own** form (two distinct URLs matching each key), via one key-aware `remap`.
3. **Backward-compatible (opt-out byte-identical).** A 1:1 connector that sets no `remapKey` behaves exactly as 045-01:
   the held record's `remapKey` is `undefined`, `remap`'s third arg is unused, and every existing seal/consent/g-ads
   test passes **unmodified**. A `remap` that returns no beacon for a given key reuses 045-01's terminal `dropped`
   diagnostic (`core/airlock.js:752-762`); the per-flush endpoint-ceiling re-check (`:771-784`) runs per rebuilt URL, so
   each fan-out form is ceiling-checked independently.
4. **Behavior-preserving + accepted.** Full `npx vitest run` green; `eslint` clean. [ADR-0024](../../decisions/adr-0024-fanout-remap-per-beacon-key.md)
   flipped Proposed → Accepted (this slice is its implementation). `arch_review: true` — the change touches the frozen
   `EgressRequest` contract + the core seal's re-map path.

**DoD:**
- All ACs met; full suite green; `eslint` clean; ADR-0024 Accepted.
- Compliance + craft + **arch** passes recorded (arch ratifies the contract field + the fan-out re-map seam).
- Reconciliation walked; `docs/architecture.md` seal note mentions the `remapKey` fan-out re-map; `docs/refinement-todo.md`
  limit (b) marked resolved.

**Out of scope (explicit):**
- **The Floodlight consumer** — spec 046-03 wires ccm + activity into this mechanism (distinct `remapKey`s + a key-aware
  `createFloodlightRemap`). This slice ships the mechanism + a synthetic-connector proof only.
- The `holdOnDenied` opt-in + the 1:1 re-map — 045-01 (unchanged here).
- alloy's separate path (`core/wrapped-sdk-host.js`, 045-02) — untouched.

### Deviation log (after reconciliation)

The slice as framed (ADR-0024 Option B — a per-beacon `remapKey`) held up; all ACs met, full suite green (1643). Deviations + folds across the frame-critique + compliance/craft/arch passes:

- **Conditional third-arg threading (deviation from AC2's literal wording).** AC2 said the flush "calls `remap(b.event, consentVector, b.remapKey)`"; the implementation passes the 3rd arg **only when `b.remapKey !== undefined`**, else the exact 2-arg `remap(b.event, consentVector)` (`core/airlock.js:762-766`). Reason: always appending a trailing `undefined` breaks vitest's exact-arity `toHaveBeenCalledWith` in the pre-existing 045-01 test (`test/consent-seal.test.js:361`), violating AC3's "existing tests pass unmodified." Runtime-identical for any real `remap`; the arch pass **ratified** it (call-arity byte-identical backward-compat), craft flagged it a mild smell but defensible. Kept; if AC3's "unmodified" constraint is ever relaxed, prefer the unconditional form + adjust that one assertion.
- **Comment precision fix (craft nit).** `core/airlock.js` claimed "(this file + the g-ads seal test)" pin the 2-arg shape; corrected — only the 045-01 seal test (`test/consent-seal.test.js`) pins the arity (`test/google-ads.test.js` carries no `remap` arity assertion).
- **ADR-0024 accuracy folds (arch nits).** (a) The colliding-key framing "not a seal-detectable error" **overstated** it — the flush holds the whole held set in hand, so an O(n) duplicate-key warn is *structurally possible*; reworded to "chosen not to detect / deferred." (b) Added an Open question noting the additive-optional contract carve-out rests on ADR-0017 precedent (not written into ADR-0017), flagged to `docs/refinement-todo.md`.
- **Frame-critique folds (pre-implementation).** Tempered ADR-0024's generality claim to **independently-reconstructable** fan-outs; corrected the declined-vs-colliding-key mitigation; added the **coordinated-fan-out re-open** carve-out (a vendor needing a non-derivable cross-beacon value re-opens the decision).
- **ADR-0024 flipped Proposed → Accepted** + a "Landed shape + scope" clause (this slice is its implementation; mirrors the 045-01 → ADR-0023 pattern).

### Reconciliation sweep

- **Tests / lint — updated.** Full `npx vitest run` → 106 files / 1643 passed, 0 fail (incl. **4** new `test/consent-seal.test.js` `it()` cases, 26→30: AC2 both-held-under-denial, AC2 grant-flushes-both-re-mapped-keyed (not swapped/duplicated), declined-key, and 1:1 backward-compat); `npx eslint .` clean.
- **`core/airlock.js` + `contracts/connector.d.ts` — updated.** Hold preserves `remapKey`, flush threads it (conditionally); `EgressRequest.remapKey?` added + the "fan-out not supported" contract note flipped to supported.
- **1:1 backward-compat — no-op (byte-identical).** Every pre-existing seal/consent/g-ads test passes **unmodified** (the 2-arg call shape is preserved for 1:1 connectors).
- **`docs/architecture.md` — updated.** The seal re-map note (§ Runtime, the airlock bullet) now names the `EgressRequest.remapKey` fan-out re-map path.
- **`docs/refinement-todo.md` — updated.** Limit **(b)** (fan-out "not yet supported") marked **RESOLVED** by this slice / ADR-0024; added the ADR-0017 additive-optional-carve-out capture follow-up (from the arch open question).
- **`docs/decisions/adr-0024-*.md` — updated + Accepted.** Status Proposed → Accepted; Landed-shape clause; arch/frame nit folds.
- **`docs/decisions/README.md` index — updated.** Added the ADR-0024 entry AND the missing ADR-0023 entry (pre-existing index drift from 045-01 — a live-prose inline fix per [ADR-0010](../../decisions/adr-0010-amendment-scope-records-vs-live-prose.md); the index skipped 0022→[0023 missing]).
- **alloy path (`core/wrapped-sdk-host.js`) — no-op (untouched).** The fan-out re-map is core-seal only; alloy's separate path (045-02) is unaffected.
- **ADR trigger — satisfied.** ADR-0024 is this slice's governing load-bearing decision (rejected alternatives: event-tag self-contain; array-return) — authored, frame-critiqued, arch-ratified, Accepted.
- **Conventions — deferred (flagged).** The additive-optional contract-evolution carve-out capture is a refinement-todo item, not a conventions edit now (needs owner approval + an ADR-0017 revisit).
- **Lightweight decisions / inbox — none.**
- **Status board (`docs/specs/README.md`) — regenerated** at each transition; 045 rolled to IN_PROGRESS on this slice's addition, → DONE at close.
- **Forward robustness note (for 046-03, not a 045-03 defect — compliance re-review).** The flush splices `heldBeacons` empty before iterating (`core/airlock.js:749-750`, pre-existing 045-01) and calls `remap` unguarded (`:762-766`); a `remap` that **throws** on one key would lose its already-spliced sibling held beacons. 1:1 has blast-radius 1; **fan-out amplifies it to N**. When 046-03 lands the real `createFloodlightRemap`, wrap the per-beacon re-map in a try (per-beacon guard) so one throwing form doesn't drop the others — carried to 046-03.
- **Memory-sync — deferred to session close** (the `remapKey` fan-out re-map mechanism + the "independently-reconstructable vs coordinated fan-out" distinction is a glossary/memory candidate).
