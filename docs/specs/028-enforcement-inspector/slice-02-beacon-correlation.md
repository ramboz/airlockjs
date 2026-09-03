---
status: DONE
dependencies: [028-01]
last_verified: 2026-09-03
---

<!-- jig grounding (ADR-0020): the correlation-scope claims below are PROBE-BACKED
     (2026-09-03, pre-draft): the worker's `ready` requests are bare
     EgressRequest{url,method,body} (core/chamber.worker.js:14,69-71), so the
     originating push() EVENT TYPE is stripped before airlock's consent/ceiling
     emit sites; it survives only on `dropped` (d.type). wrapped-sdk-host has a
     per-fetch `m.id` in scope at its config-integrity/consent/ceiling emits
     (wrapped-sdk-host.js:222,260,310). airlock's held beacons (heldBeacons,
     airlock.js:234) flush per-beacon at setConsent (airlock.js:450-461). Every
     existing id-minter is an INSTANCE-LOCAL closure counter (airlock.js:139
     `seq`; alloy-chamber af-N) — so a beacon id must carry a per-instance
     NAMESPACE to stay unique in the SHARED collector (028-02 frame-critique). -->

## Slice 028-02 — per-beacon correlation

**Goal:** Give each governed beacon a **collector-unique** correlation id (+ its destination as context) threaded
into the enforcement records where the beacon identity is already in scope, and let the inspector **reconstruct a
governed beacon's ordered decision chain** by that id — so the flat 028-01 stream becomes per-beacon causal
chains. The headline chain is **held → flushed**: a beacon held at the async seal (consent pending) and the same
beacon later flushed when consent is granted share one id, so a developer sees the full life of that beacon.

**Grounded scope (pre-draft + frame-critique, both folded in) — two honest corrections:**
1. **BEACON-keyed, not event-type-keyed.** The worker maps events → bare `EgressRequest{url,method,body}` and
   strips the originating push() **event type** before airlock's ready-path emit sites — so correlation is keyed
   by a synthetic per-beacon id, NOT the event type (which survives only on `dropped` as `d.type`).
2. **Unique at COLLECTOR scope, not instance scope.** The collector is ONE shared sink across all instances
   (028-01). Every natural id-minter is an instance-local counter, so two co-wired instances (a GA4 airlock +
   a Meta-pixel airlock → one collector) would both mint `1,2,3…` and conflate. The beacon id therefore carries
   a **per-instance namespace** (a short random instance tag minted once per host construction) so ids are
   unique across the whole collector: `<instanceTag>#<local>` (airlock's `seq`; wrapped-sdk-host's `m.id`).
   Destination is **display context, NOT the uniqueness mechanism** (for GA4 every beacon hits the one collect
   endpoint, and two same-tracker instances produce a byte-identical destination — it cannot disambiguate).

**Honest limit (reframed per frame-critique):** the id is minted internally at the emit site with no handle
returned to the caller, so a chain answers *"these records belong to one governed beacon"* — NOT *"and that
beacon is the `page_view` you fired."* The inspector **reconstructs** a beacon's decision chain; it does not let
a developer name a beacon they have in mind.

**DoR:**
- ✅ 028-01 DONE (the collector + query exist to correlate over).
- ✅ Grounded per-site (2026-09-03): the in-scope refs — airlock `heldBeacons`→flush (`airlock.js:234`,
  `:450-461`); wrapped-sdk-host `m.id` (`:222` onward). Event type NOT in scope on ready-path beacons.
- ✅ Frame-critique passed (2026-09-03) — caught the collector-scope id-collision; folded into AC2/AC4/AC5 below.

**Acceptance Criteria:**

1. **The held → flushed chain shares one collector-unique beacon id.** When a beacon is held at the async seal, it
   is tagged `<instanceTag>#<seq>`; the `consent held` record AND the later `consent flushed` record for that same
   beacon carry the **same** `beaconId` (+ the beacon's `destination`). A test holds a beacon, grants consent via
   `setConsent`, and asserts both records share `beaconId` + `destination`.
2. **wrapped-sdk-host records carry a collector-unique beacon id.** Its `config-integrity` / `consent` /
   `endpoint-ceiling` records carry `beaconId = <instanceTag>#<m.id>` (the existing intercepted-fetch id,
   namespaced). A test drives a config-integrity hold and asserts the record's `beaconId` is present and carries
   the fetch id.
3. **The inspector reconstructs a beacon's ordered decision chain by id.** The collector's `query` gains a
   `beaconId` filter; `query({ beaconId })` returns that beacon's records in emission order (e.g.
   `["held", "flushed"]`).
4. **Collector-scope uniqueness — two sources do NOT conflate (the frame-critique's must-have).** Two co-wired
   host instances feeding ONE collector mint **different** `beaconId`s for their respective first beacons;
   `query({ beaconId })` for one instance's beacon returns ONLY that instance's records, never the other's. A
   test wires two GA4 airlocks (or an airlock + a wrapped-sdk-host) into one collector, holds/emits a beacon in
   each, and asserts the ids differ and the query does not merge them. **This test must go red if the id were
   instance-local (un-namespaced).**
5. **Uniqueness lives in the id, not the destination.** `destination` is captured as display context only; the
   AC4 non-conflation must hold even when the two instances' destinations are byte-identical (same GA4 tracker).
6. **Additive / back-compat, flat-record invariant preserved.** `beaconId` + `destination` are ADDED string
   fields — no existing record field removed/renamed; every existing 028-01 + host-suite test stays green;
   records with no `beaconId` (a host that threads none; `dropped` carrying `d.type`) still collect + query. The
   `collector.js` flat-record invariant comment is extended to enumerate `beaconId`/`destination`. No PII — the
   id is a synthetic per-beacon token, never user identity.

**DoD:**
- [x] All ACs pass; full real-repo suite green (**923**, worktree excluded; 4 new). No host-suite regression —
      `beaconId`/`destination` are additive; every host assertion on these records is `toMatchObject` (subset).
- [x] Coverage exercises each AC — a real held→flush chain (real `setConsent` flush); a real wrapped-sdk-host
      config-integrity fetch-id; a `beaconId` query; the two-source non-conflation control (identical destinations).
- [x] Each new test shown to fail when its feature is removed — an instance-local (un-namespaced) id mutation
      redded **only** AC4 (idA===idB), the other 16 green; restored.
- [x] Reviewed by independent reviewer; **compliance PASS + craft PASS** (recorded under `reviews/`).
- [x] Implementation review passed.
- [x] Deviation log + Reconciliation sweep produced below; reconciliation review recorded.
- [x] No decisions deferred; the beaconId-scope-boundary + short-tag hardening are recorded in the Deviation log.

**Anti-horizontal-phasing check:** after this slice a developer can **reconstruct a governed beacon's decision
chain** (held → flushed; or an alloy fetch's config-integrity hold) from the inspector — the vision's per-beacon
answer, on top of 028-01's flat stream, and correct in the multi-tag topology that is the inspector's reason to
exist.

### Deviation log (after reconciliation)

1. **Beacon-keyed + collector-unique (both corrections folded in pre-code).** Pre-draft grounding caught that the
   worker strips the event type (→ beacon-keyed, not event-type-keyed); the frame-critique then caught that a
   naive instance-local id collides in the SHARED collector (two co-wired instances both mint `1,2,3…`). The
   implemented id is `<instanceTag>#<local>` — a per-instance random tag (airlock's `seq`, wrapped-sdk-host's
   `m.id`), proven collision-safe by the AC4 two-source non-conflation test (which reds under an instance-local id).
2. **Short-tag hardening (craft-review note 1).** `Math.random().toString(36).slice(2,8)` could theoretically
   yield a short/empty tag (~2^-53: `0→""`, `0.5→"i"`). Not a real bug (nothing splits `beaconId` on `#`), but
   hardened to a fixed 6-char `(…slice(2) + "000000").slice(0,6)` in both hosts — the theoretical case is gone.
3. **beaconId scope boundary (craft-review note 2, as-designed).** The `config-integrity unpinned-declared-origin`
   disclosure and the payload-governance `stripped`/`skipped` records intentionally OMIT `beaconId` — matching
   AC2's enumerated set (config-integrity held/overridden, consent, endpoint-ceiling). A future slice can extend
   the strip chain if the story is wanted. The AC6 test pins the payload-governance record to a `beaconId`-free shape.
4. **`destination` semantics vary by record kind (display context only — reviewer note).** airlock consent
   held/flushed carry the full URL (`r.url`/`b.url`); wrapped-sdk-host config-integrity/consent carry host-only
   (`hostOf(m.url)`); endpoint-ceiling carries origin+path (`c.destination`). Not load-bearing — uniqueness lives
   in the id (AC5), destination is display context.
5. **Touches host files (not purely additive like 028-01).** `core/airlock.js` + `core/wrapped-sdk-host.js` gained
   fields on existing records + a construction-time tag/counter — additive to each record shape, no field
   removed/renamed; regression-safe because every host-suite assertion on these records is a `toMatchObject`
   subset. `core/inspector/collector.js` gained a 1-field `beaconId` query filter.

### Reconciliation sweep

| Artifact | Disposition | Rationale |
|----------|-------------|-----------|
| `README.md` | `no-op` | Internal correlation enrichment — no user-facing entrypoint change. |
| `docs/specs/README.md` | `updated` | Regenerated by `workflow.py status-board` (028-02 → DONE). |
| `docs/product-vision.md` | `no-op` | OQ7 resolution deferred to spec close (028-03 pending); no use-case/scope drift. |
| `docs/architecture.md` | `no-op` | No module boundary changed — fields added to existing 009-02 records on the pre-existing `onDiagnostic` seam; no new public contract (`contracts/*.d.ts` does not type diagnostic record fields). |
| Primer surfaces: `CLAUDE.md` / `AGENTS.md` / scaffold templates | `no-op` | Slice does not close the spec (028-03 DRAFT) — primer hygiene deferred to spec close. |
| `docs/inbox.md` | `no-op` | No new parked item (the 028-01 flat-record entry already covers the shallow-copy invariant, which the string `beaconId`/`destination` preserve). |
| `docs/refinement-todo.md` | `no-op` | No deferred decision — the scope boundary + hardening are Deviation-log records, not decisions. |
| `docs/memory/**` | `no-op` | Nothing cross-session beyond the spec/reviews. |
| `docs/decisions/README.md` / ADR index | `no-op` | No ADR touched. |

**Reconciliation review — PASS (self-recorded, jig:reviewer prompt-source).** Both grounded corrections
(beacon-keyed, collector-unique) are folded in and proven by the two-source non-conflation test; both gating
passes PASS; the two craft notes are dispositioned (hardened / recorded scope boundary); host changes are
additive + regression-safe. No orphans. Ready RECONCILED → DONE.
