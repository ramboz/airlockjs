---
status: DONE
dependencies: [046-01, 046-02, 045-01, 045-03, adr-0023, adr-0024]
last_verified: 2026-09-13
frame_review: false
arch_review: true
---

<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about runnable
     surfaces by probe first (run it / read source) or a citation, else mark them
     as assumptions in `## Assumptions` — never assert an unverified claim as fact. -->

## Slice 046-03 — DC opts into hold-until-granted, both forms (ad_storage-denied parity)

> **Grounded:** DC's `ad_storage`-denied behavior is full seal-hold (R-009 §(b): 23→2 reject-all; "none — fully held",
> identical to Google Ads), the mechanism is spec 045's shipped `holdOnDenied` opt-in + re-map-on-grant, and 044-02 already
> proved the pattern for AW. This slice wires BOTH DC forms (046-01 ccm/collect + 046-02 activity) into it. (The prior
> frame-critique's endpoint contingency — `reviews/slice-03-frame-critique.md` — is RESOLVED: both forms are now in scope,
> built in 046-01/046-02.)

**Goal:** Both DC beacons (ccm/collect + activity) opt into the core seal's `holdOnDenied` mode so under
`ad_storage`-denied they hold at the seal (buffer + re-map + flush on a later grant) instead of sending — matching the
container (R-009 §(b)). A grounded per-connector opt-in mirroring 044-02.

**The load-bearing claim (grounded 2026-09-11):** the denied re-capture collapsed ad-family egress 23→2; Floodlight fired
nothing ("none — fully held", R-009:171,175-181). DC's parity-correct denied behavior is hold, not a cookieless send.

**DoR:**
- ✅ 046-01 + 046-02 shipped both DC beacon forms + `manifest.purposes.egress: ["ad_storage"]`.
- ✅ 045-01 provides the `holdOnDenied` mechanism (opt-in + re-map-on-grant), proven for AW (044-02).
- ✅ 045-03 ([ADR-0024](../../decisions/adr-0024-fanout-remap-per-beacon-key.md)) provides the **fan-out** re-map (`EgressRequest.remapKey` → key-aware `remap(event, consent, remapKey)`) so Floodlight's TWO held beacons each re-map to their own form on grant — the 1:1 seal (044-02) cannot.
- ✅ Grounded (R-009 §(b)): the container held the DC family under `ad_storage`-denied.

**Acceptance Criteria:**
1. **Both forms opt into `holdOnDenied` + supply re-map inputs (via the 045-03 fan-out mechanism).** The floodlight
   airlock instance is `holdOnDenied: true`; `handle` attaches the source `event` AND a **distinct `remapKey`**
   (`"ccm"` / `"activity"`) to each ready `EgressRequest` (the 045-01 `event` + 045-03 `remapKey` channels), and a
   **key-aware** `createFloodlightRemap(event, consent, remapKey)` dispatches on `remapKey` to rebuild the correct form —
   re-sourcing the linker id under granted `ad_storage` + re-encoding `gcs`/`gcd`/`npa` from the passed consent — for BOTH
   the ccm/collect (`auid`) and the `;`-delimited activity (`auiddc`) mappers. Mirrors `createGoogleAdsRemap` but keyed for
   the 2-beacon fan-out ([ADR-0024](../../decisions/adr-0024-fanout-remap-per-beacon-key.md)); the two `remapKey`s are
   **distinct by construction** (the colliding-key footgun ADR-0024 names).
2. **Both DC beacons hold under denial, then RE-MAP on grant (not a stale re-send), and the flush egresses.** Denied (or
   pending) → both buffer at the seal (no egress; the inspector records the hold); on `setConsent({ ad_storage: "granted"
   })` both flush RE-MAPPED under granted consent (granted `gcs`/`gcd`/`npa`, re-sourced `auid`/`auiddc`), **each keyed by
   its `remapKey` to its OWN form (not swapped, not duplicated — the 045-03 guarantee)**, NOT the stale under-denial
   payload. The activity flush clears the 046-02 endpoint-ceiling path-match fix (its `;`-pathname is not held on flush);
   ccm/collect's fixed pathname is already clean. Granted-from-the-start → 046-01/046-02 beacons fire unchanged.
3. **No cookieless DC fallback (parity).** Under denial the seal holds both beacons — no cookieless DC variant. Asserted
   against R-009 §(b) (the container held; it did not cookieless-send ads).
4. **Behavior-preserving.** Full `npx vitest run` green; unit tests cover, for BOTH forms, granted→fires / denied→held /
   pending→held / grant→re-mapped-and-egressed (granted consent-mode + re-sourced linker id, not the stale payload; the
   activity flush not held by the ceiling), plus the no-cookieless-fallback assertion.

> **Robustness (fan-out flush, from the 045-03 compliance review).** The seal's flush splices `heldBeacons` empty before
> iterating and calls `remap` unguarded (`core/airlock.js`), so a `remap` that THROWS on one key would drop its
> already-spliced sibling — blast-radius 1 for a 1:1 connector, **N for a fan-out**. Make `createFloodlightRemap`
> **non-throwing per form** (return nothing on a per-form failure → the seal's terminal `dropped` diagnostic fires for
> just that beacon, the sibling still flushes) rather than letting an exception escape into the shared flush loop. Prefer
> this connector-side guard over a core change; if a seal-side try is judged necessary instead, that is a 045 follow-up,
> not 046-03.

**DoD:**
- All ACs met; full suite green; denied-hold + grant-flush (egressed, both forms) witnessed by tests.
- Compliance + craft + **arch** passes recorded (`arch_review: true` — this slice activates the 045-03/ADR-0024 fan-out
  re-map for a real 2-beacon consumer, so the arch pass ratifies the `remapKey` wiring + the non-throwing-per-form guard).
- Reconciliation walked.

**Out of scope (explicit):**
- The `holdOnDenied` mechanism itself — 045-01.
- The two beacon forms — 046-01 (ccm) / 046-02 (activity).
- Conversion activity / enhanced-match hashes (MVP9); the cross-site DMP sync (E10).

### Deviation log (after reconciliation)

All four ACs + the fan-out robustness guard met; full suite 1685 green; both `parity:floodlight-*` PASS (046-01/02 regression intact). The slice landed as framed at the DoR level (a 044-02 mirror keyed for the fan-out); notes:

- **AC1/AC2 tightened to the fan-out signature during authoring (pre-implementation).** The DRAFT AC1 specified a 2-arg `createFloodlightRemap(event, consent)`; it was sharpened to the 3-arg `(event, consent, remapKey)` fan-out form and AC2 gained the "each keyed to its OWN form (not swapped, not duplicated)" guarantee — an internal-consistency fix aligning the ACs with the DoR's pre-existing 045-03/ADR-0024 `remapKey` dependency (neither weakens nor expands scope).

- **`createFloodlightRemap` try/catch wraps the WHOLE rebuild (a superset of AC's "non-throwing per form").** The seal invokes `remap` once per held beacon (`core/airlock.js:762-766`), so a per-invocation catch IS per-form; wrapping the whole rebuild additionally contains a shared ctx-sourcing throw (`readCookieString`/`sourceGoogleAdsCtx`) to a single-beacon drop instead of letting it abort the flush loop and take out the already-spliced sibling. Diverges from `createGoogleAdsRemap` (no try/catch — 1:1, blast-radius 1); spec-sanctioned by the Robustness note above.
- **Zero core change (git-confirmed).** 046-03 lands entirely connector-side (`connectors/floodlight/connector.js` + `test/floodlight-seal.test.js`); `core/airlock.js`/`consent.js`/`endpoint-ceiling.js` + `contracts/connector.d.ts` are untouched (last touched by the 045-03 commit). It consumes the shipped 045-03/ADR-0024 fan-out re-map unchanged — the arch pass called this "the strongest evidence the ADR-0024 seam was cut at the right boundary." No new ADR.
- **`handle` attaches a distinct `remapKey` per beacon** (`"ccm"`/`"activity"`, string literals set by one `handle`) → the colliding-key footgun ADR-0024 names is avoided by construction; `createFloodlightRemap` defaults unrecognized/absent keys to the ccm form, so it stays safe as a 1:1 two-arg drop-in. The activity flush's re-mapped `;`-URL clears the ceiling by construction (`joinMatrixUrl` is the shared home for the emitted URL + the declared prefix; ADR-0025 prefix-match; the flush re-check runs per rebuilt URL).
- **[nit → logged] bare `catch {}` discards the error cause.** A rebuild failure surfaces only as the seal's generic terminal `dropped` ("re-map declined — produced no beacon"); a poisoned config vs a throwing `readCookieString` vs a mapper bug are indistinguishable in diagnostics. Acceptable given the pure-remap contract (the connector has no `diagnose` seam and must not throw into the shared flush); a review→clarify candidate only if it recurs on the next fan-out consumer.
- **[nit → logged] `landingUrl` is inert today.** Threaded into `createFloodlightRemap` → `sourceGoogleAdsCtx` for sibling-signature parity with `createGoogleAdsRemap`, but DC's `mapToDcCollect`/`mapToDcActivity` read no inbound click-ids (`gclid`/`wbraid`/`gbraid`), so it has no observable effect. Documented in the JSDoc; a minor leanness smell, kept for parity.
- **Provenance (immaterial):** the additive `EgressRequest.event` channel was already committed with 046-01/02; 046-03's actual delta is the per-beacon `remapKey` + `createFloodlightRemap`.

### Reconciliation sweep

- **Tests / lint — updated.** Full `npx vitest run` → 108 files / 1685 passed, 0 fail (incl. 13 new `test/floodlight-seal.test.js` cases: denied→both held, grant→both re-mapped keyed/not-swapped/re-sourced-not-stale, pending→held, granted-from-start→fire, no-cookieless, activity-flush-clears-ceiling, throw-guard); `npx eslint .` clean; `npm run parity:floodlight-ccm` + `parity:floodlight-activity` PASS.
- **`core/` untouched — no-op (git-confirmed).** The fan-out re-map mechanism is 045-03's (shipped, DONE); this slice only consumes it.
- **`docs/refinement-todo.md` — updated.** Added the deferred real-boot single-`{connector, remap}`-factory follow-up (the arch open question — applies to AW 044-02 too).
- **`docs/architecture.md` connector inventory + `airlock/floodlight` namespace — done at spec 046 close-out** (all three slices now DONE → the connector is complete; the entry is written in the close-out sweep below, per compress-on-close-out).
- **`CHANGELOG.md` [Unreleased] — Floodlight feature bullet added at spec 046 close-out** (per-feature).
- **Boot/worker wiring — out of scope (no-op).** Like AW (044), the `holdOnDenied` opt-in + `createFloodlightRemap` are proven in tests (`createAirlock({ holdOnDenied, remap })`), not in `adapters/eds` boot (deferred).
- **ADR trigger — none.** 046-03 consumes ADR-0023 (holdOnDenied) + ADR-0024 (fan-out remap) + ADR-0025 (ceiling); no new load-bearing decision.
- **Lightweight decisions / conventions / inbox — none.**
- **Status board (`docs/specs/README.md`) — regenerated** at each transition; spec 046 rolls up DONE at close.
- **Memory-sync — at session close** (the Floodlight connector + the ccm/activity fan-out + the seal fan-out re-map are glossary/memory candidates).

### Close-out (post-DONE)

- [x] Spec 046 rolls up when all three slices are DONE; regenerate the board. (All three DONE 2026-09-13; board
  regenerated → 046 rolls up DONE. Close-out: `docs/architecture.md` connector inventory + `airlock/floodlight`
  registry namespace added; `CHANGELOG.md` [Unreleased] Floodlight + fan-out + ceiling bullets added.)
