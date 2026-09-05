---
status: DONE
dependencies: []
last_verified: 2026-09-05
arch_review: true  # changes the consent → interact egress gating (a governance surface, spec 017/020).
frame_review: true  # the "analytics-only interact" reshape is load-bearing + could be wrong (render vs egress).
---

<!-- jig self-defining vocabulary (soft, forward-only): expand each acronym on first use; link to docs/memory/glossary.md. -->
<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about runnable surfaces by probe/source, else mark as assumptions. -->

## Slice 034-01 — coarse-consent split: analytics flows when only personalization is denied

**Goal:** make alloy's consent gating **per-purpose**, not all-or-nothing. Today alloy's analytics + personalization
ride the **one shared interact** gated by the strict `egressVerdict` over `["analytics_storage","personalization"]`
(`core/wrapped-sdk-host.js:310`), which HOLDS the whole interact if *either* purpose is un-granted — so the common
posture **"analytics granted, personalization denied" gets neither**. After this slice: personalization-denied +
analytics-granted sends an **analytics-only interact** (personalization suppressed at the source, gated on
`analytics_storage` alone); both-granted is unchanged (full interact + decisions); **analytics-denied still holds the
whole interact** (fail-closed — no analytics to send).

**DoR:**
- ✅ 033 landed (config-booted alloy: `bootAlloy`, the strict gate, the decisions path).
- ✅ Grounded (read 2026-09-05): the interact is one `sendEvent({renderDecisions:false, xdm})`
  (`connectors/alloy/connector.js:171-175`) — **`renderDecisions:false` suppresses only RENDER, not the personalization
  QUERY/egress**; `egressPurposes` is the STATIC `manifest.egress` (both purposes); the strict `egressVerdict` drops on
  any un-granted purpose (`core/wrapped-sdk-host.js:300-320`, `core/consent.js`); consent is a LIVE ref updated by
  `setConsent` (033-02).

**Design (frame-critique 2026-09-05 — TRUSTED SEAM-SIDE; the chamber-side reshape was rejected).** The frame-critique
traced alloy 2.35.0: the personalization query is built by `fetchDataHandler`'s `mergeQuery` only when
`shouldRequestDefaultPersonalization()` is true, and `personalization:{ defaultPersonalizationEnabled:false }` (NOT
`decisionScopes:[]`, which is already the default, and NOT `sendDisplayEvent:false`) suppresses it. So alloy CAN emit
an analytics-only interact — the premise holds. **But the suppression must NOT be chamber-side:** the chamber is
untrusted (ADR-0016 bundle) and is notified of consent only ONCE at boot (no mid-session re-delegate), so a chamber-side
reshape + a relaxed main-thread gate would (a) LEAK `query.personalization` under an analytics-only gate after a
granted→denied flip, and (b) invert the seam's "does NOT trust the chamber" invariant (020-02). Also alloy's own
`setConsent` collapses both purposes to one y/n (`connectors/alloy/consent.js` — pzn-denied kills analytics collection
too), so the split cannot ride it.

**Therefore: TWO halves — a chamber-delegate LIVENESS fix + the TRUSTED SEAM ENFORCEMENT.**

**(A) The seam enforcement (trusted, per intercepted interact).** In `core/wrapped-sdk-host.js`'s intercepted-fetch
path (where `configIntegrity`/`endpointCeiling`/`egressVerdict` already run): when `personalization` is un-granted but
`analytics_storage` is granted, **strip `query.personalization` from the intercepted interact body** (a body surgery
distinct from the existing `stripInterceptedXdmBody`) and gate the now-analytics-only interact on
`["analytics_storage"]` — both driven by the SAME live `consentRef` the seam already reads, so AC4 needs no chamber
re-notify. (`defaultPersonalizationEnabled:false` IS a per-`sendEvent` option, not configure-time — but a chamber-side
per-event reshape still can't be the enforcement: the chamber is **untrusted** AND is **not re-notified of a
mid-session consent flip**, so the per-event strip must be seam-side.)

**(B) The chamber-delegate liveness fix (REQUIRED — grounded: alloy suppresses the interact upstream otherwise).** alloy
carries a **single general consent switch** (`consentPurpose.js` GENERAL; no per-purpose granularity), and `collect:"n"`
makes alloy's `awaitConsent()` REJECT **before** the request is built (`createEventManager.js:70` gates the send at
`:99`; `createConsentStateMachine.js:85-86`) — so the interact is suppressed **upstream of the seam** and the seam never
sees it. Today `shapeAlloyConsent` (`connectors/alloy/consent.js`) sets `collect:"y"` iff **both** purposes granted →
pzn-denied → `collect:"n"` → no interact → **no analytics**. So the split REQUIRES relaxing `shapeAlloyConsent` to
`collect:"y"` iff **`analytics_storage`** granted (the primary collection purpose). You cannot express analytics-yes/
pzn-no in alloy's one-switch consent — the delegate provides **liveness** (alloy sends when analytics is consented),
the seam provides trusted **enforcement** (strips pzn per-event). Defense-in-depth, exactly as `shapeAlloyConsent`'s
own docstring frames it.

**OQ13-1 residual (documented, not silently deferred).** Relaxing `collect` authorizes alloy's full identity/collect on
every analytics-yes/pzn-no send: (i) the shared identity cookies (`kndctr_`/`AMCV_`/`s_ecid`) + `query.identity.fetch`
serve `analytics_storage` — consent-consistent under analytics-granted, and the seam correctly does **NOT** strip
`query.identity.fetch`; (ii) the one genuine residual — a **`demdex` / `ad_storage` cookie WRITE under denied
`ad_storage`** — is now reachable in the common posture (before, `collect:"n"` suppressed all writes). Pre-existing +
orthogonal (`ad_storage` is in neither the old nor new `collect` gate). **Bound (sharpened per the arch review — the
ceiling does NOT fully compensate):** the endpoint ceiling (`endpointCeiling:[ALLOY_INTERACT_ENDPOINT]`) gates *fetch
dispatch*, so it holds the demdex.net ad-sync **network egress**; but the **cookie-write-back path**
(`core/wrapped-sdk-host.js` `cookie-writeback` → `caps.cookies.reconcile`) is **ungated** — so a `demdex`/`ad_storage`
cookie **WRITE** landing under denied `ad_storage` (if alloy writes it client-side, independent of the held demdex.net
sync) is **uncompensated**. Whether that write is sync-dependent (then held) or client-side (then a real new write in
the common posture) is the exact creds-gated question **OQ13-1** must resolve. **OQ13-1 remains OPEN** — this slice
notes + bounds it, does not close it.

**Grounding the strip is Edge-safe:** the stripped shape (analytics XDM + `query.identity.fetch`, no
`query.personalization`) is exactly what alloy itself sends with personalization off (012-04 / an analytics-only
config) — a valid analytics interact, not a malformed body. A live-Edge confirmation is a **creds-gated residual**
(like 013); the hermetic proof asserts the stripped body's shape.

**Acceptance Criteria (ratified at the frame-critique — trusted seam-side):**

1. **Per-purpose gate — BOTH halves.** With `analytics_storage:granted, personalization:denied`, the interact **is
   dispatched** (analytics flows). With `analytics_storage:denied`, the interact **is held** regardless of
   personalization (fail-closed). Both-granted → dispatched. Test asserts each of the four combinations (on a FRESH
   boot each — alloy's `shouldRequestDefaultPersonalization` fires only on the first cache-uninitialized interact).
   - **(A) Chamber-delegate LIVENESS (`connectors/alloy/consent.js`):** `shapeAlloyConsent` sets `collect:"y"` iff
     **`analytics_storage`** resolves granted (was: iff BOTH granted) — so alloy actually SENDS the interact when
     analytics is consented, instead of `collect:"n"` suppressing it upstream of the seam. Test: `shapeAlloyConsent`
     with `{analytics:granted, pzn:denied}` → `collect:"y"`; `{analytics:denied,…}` → `"n"`; pending analytics → `"n"`
     (fail-closed).
   - **(B) Seam ENFORCEMENT:** AC2 (the trusted per-event strip). The two are defense-in-depth (delegate = liveness,
     seam = trusted enforcement).
2. **Personalization suppressed at the TRUSTED SEAM when denied.** The seam strips `query.personalization` from the
   intercepted interact body (driven by the live `consentRef`) so the egress carries no personalization query — a
   compromised chamber cannot leak it (the seam removes it; NOT chamber-trust). **PATH PRECISION (grounded — required):
   `query.personalization` is written PER-EVENT (`alloy-core createEvent.js` → `events[i].query.personalization`),
   while the ECID `query.identity.fetch` is TOP-LEVEL (`query.identity.fetch`).** So the strip MUST iterate
   `parsed.events[]` and `delete evt.query.personalization` (and delete an emptied `evt.query` to byte-match alloy's
   native-off shape) — NOT a top-level `parsed.query.personalization`, which never exists (a naive top-level delete is
   a silent no-op that ships a LEAK while a wrong-path test stays green). Reuse the per-event scaffold of the existing
   `stripInterceptedXdmBody` (`core/wrapped-sdk-host.js:558`, which already iterates `parsed.events[]` — operate on
   `evt.query` instead of `evt.xdm`). No decisions are delivered (Edge sees no query → none returned).
3. **Both-granted unchanged.** No strip, gate on both, full interact + decisions delivered — 033-02/03 byte-unchanged,
   existing 033 tests green (no regression).
4. **Live consent, no chamber re-notify.** `setConsent` flipping personalization granted↔denied changes the NEXT
   interact's strip+gate (the seam reads the live `consentRef` per-interact) — no mid-session chamber re-delegate
   needed (that INFEASIBILITY was the frame-critique's core finding; seam-side sidesteps it).
5. **End-to-end proof — assert the interact FIRED (via the REAL delegate).** A rig/test drives the four consent
   combinations (fresh boot each) through the REAL `shapeAlloyConsent`→`setConsent` delegate path and asserts: for
   analytics-granted/pzn-denied, an intercepted-fetch **actually FIRED** (distinguishing "`collect:"y"` sent → seam
   stripped pzn" from "`collect:"n"` suppressed everything" — a final-body-only check cannot tell these apart), the
   dispatched body retains the analytics XDM + top-level `query.identity.fetch` and carries **no
   `events[].query.personalization`**; analytics-denied → NO intercepted-fetch (suppressed/held). This also guards the
   regression where a future `shapeAlloyConsent` re-collapse to both-required silently kills analytics.
6. **Differential Edge-safe proof (grounds the "= alloy's own analytics-off interact" claim, creds-free) — as a
   DEPS-GATED RIG, not a hermetic vitest.** A rig asserts that an interact built with personalization ON then
   seam-stripped **deep-equals** the interact alloy builds natively with `defaultPersonalizationEnabled:false` — both
   from the real `@adobe/alloy@2.35.0`. Because `@adobe/alloy` is **not** a root dependency (it is adopter-supplied,
   ADR-0016; the probe-local install is gitignored), this MUST live in the **rig tier** (`node rig/…`, like
   `rig:alloy`/`rig:alloy-decisions`) — NOT in `npm test`, which the hermetic CI gate runs after a root-only `npm ci`
   with no probe deps. Keeping it a vitest would break the hermetic gate on any fresh checkout. The rig grounds
   Edge-safety without creds + catches the emptied-`evt.query` cleanup a shape-only assertion would miss; a *shape-only*
   assertion (no real bundle) may stay in the hermetic suite. (Live-Edge confirmation remains a creds-gated residual,
   013 pattern.)

**DoD:** all ACs pass; **TDD red→green**; reviewed (compliance + craft + **arch** [`arch_review: true`] + **frame-critique**
[`frame_review: true`]); deviation log + reconciliation sweep; reconciliation review; `docs/refinement-todo.md` alloy
"analytics-yes/pzn-no" follow-on **struck/closed**; board synced. **Documented residuals (not closed here):** the
**OQ13-1 `demdex`/`ad_storage` cookie-write** under denied `ad_storage` is now reachable in the analytics-yes/pzn-no
posture (compensated by the endpoint ceiling holding the ad-sync egress) — OQ13-1 stays OPEN; and the live-Edge
confirmation of the stripped-interact shape is a creds-gated residual (013 pattern).

## Close-out

### Deviation log

**The completion is TWO halves — a chamber-delegate LIVENESS fix + the TRUSTED seam ENFORCEMENT — both landed here.**
An interim cut of this slice built ONLY the seam strip and framed the in-chamber `setConsent` delegate as an unchanged,
out-of-scope live-path residual. The coordinator (with the frame-critique) correctly rejected that as insufficient for
the Goal: grounded against `@adobe/alloy@2.35.0`, alloy carries a SINGLE general consent purpose (`consentPurpose.js`
GENERAL) and `collect:"n"` makes `awaitConsent()` REJECT the send BEFORE the request is built
(`createEventManager.js:70` gates `sendEdgeNetworkRequest` at `:99`; `createConsentStateMachine.js`'s `awaitOut`
rejects) — so the pre-034 `shapeAlloyConsent` (`collect:"y"` iff BOTH purposes granted) suppressed the WHOLE interact
UPSTREAM of the seam on any personalization denial, and analytics never flowed. The seam strip alone therefore could
not meet the Goal. **Fixed:** `connectors/alloy/consent.js`'s `shapeAlloyConsent` now sets `collect:"y"` iff
**`analytics_storage`** resolves granted (the primary collection purpose) — the LIVENESS half — so alloy SENDS when
analytics is consented, and the TRUSTED seam strips the per-event `query.personalization` — the ENFORCEMENT half.
Defense-in-depth (delegate = liveness, seam = trusted per-event enforcement), SAFE because the seam, not the untrusted
chamber delegate, is where a personalization denial is enforced. This CORRECTS the interim deviation log's "seam-only /
delegate is a parked residual" framing — the delegate change is IN scope + done.

**Analytics-denied is now suppressed UPSTREAM by the delegate (faithful chamber), and the seam still holds it
independently (misbehaving chamber).** In the AC5 e2e the REAL `shapeAlloyConsent`→`setConsent` path yields
`collect:"n"` on an analytics denial, so a faithful chamber emits NO intercepted-fetch — the e2e asserts zero egress by
"no intercepted-fetch fired" (not `consentHeld`, which the seam only increments for an interact that actually reaches
it). The seam's TRUSTED strict hold of a denied interact — the backstop for a compromised chamber that fires anyway —
is separately unit-tested in `test/wrapped-sdk-host.test.js` AC1 (defense-in-depth: delegate suppresses OR seam holds).

**One pre-034 test was SUPERSEDED (an intended behavior change, not a regression).** `test/eds-boot-alloy.test.js`'s
"AC6: consent all-or-nothing (personalization denied HOLDS the whole interact)" encoded exactly the behavior 034-01
changes. It was rewritten into the AC5 four-combination coarse-split e2e that drives the REAL delegate and asserts the
analytics-only interact actually FIRED (distinguishing "sent → seam-stripped" from "suppressed" — a final-body-only
check cannot) for analytics-yes/pzn-no, and NO intercepted-fetch for the analytics-denied combos.

**OQ13-1 residual — documented, NOT closed (grounded by the frame-critique).** Relaxing `collect` authorizes alloy's
full identity/collect on every analytics-yes/pzn-no send: (i) the shared identity cookies (`kndctr_`/`AMCV_`/`s_ecid`) +
`query.identity.fetch` serve `analytics_storage` — consent-consistent under analytics-granted, and the seam correctly
does NOT strip `query.identity.fetch`; (ii) the genuine residual — a `demdex`/`ad_storage` cookie WRITE under denied
`ad_storage` — is now reachable in the common posture (before, `collect:"n"` suppressed all writes). Pre-existing +
orthogonal (`ad_storage` gates neither the old nor new `collect`). **Bound (sharpened per the arch review — do NOT
over-claim):** the endpoint ceiling gates FETCH dispatch, so it holds the demdex.net ad-sync NETWORK EGRESS — but the
cookie-write-back path (`core/wrapped-sdk-host.js` `cookie-writeback` → `caps.cookies.reconcile`) is UNGATED, so a
`demdex`/`ad_storage` cookie WRITE landing client-side under denied `ad_storage` is UNCOMPENSATED. Whether that write is
sync-dependent (then held with the egress) or client-side (a real new write) is the exact creds-gated question OQ13-1
must resolve. **OQ13-1 (cookie-write consent-gating) stays OPEN** — mirrored in `connectors/alloy/consent.js`'s docstring
+ `docs/refinement-todo.md` (§OQ13 item-1 family) + `docs/inbox.md`. Live-Edge confirmation of the stripped-interact
shape remains a creds-gated residual (013).

**AC6 differential moved to the RIG tier (craft-review PORTABILITY blocker).** The interim cut put the real-bundle
differential in `test/wrapped-sdk-host.test.js`, hard-importing `@adobe/alloy` from the gitignored, probe-local
`probes/alloy-worker/node_modules`. But `@adobe/alloy` is ADOPTER-SUPPLIED (ADR-0016), deliberately NOT a root dep, so
CI's hermetic `npm test` (after a root-only `npm ci`) has no probe deps — the import broke the WHOLE suite on a fresh
checkout. **Fixed:** the real-bundle differential now lives in the rig tier — `rig/alloy-consent-diff.mjs` +
`npm run rig:alloy-consent-diff` — mirroring `rig:alloy`/`rig:alloy-decisions` which read the probe-local bundle as a
file (it fail-louds with an actionable message + non-zero exit when the probe bundle is absent). `npm test` is now
PORTABLE: verified GREEN with `probes/alloy-worker/node_modules` moved aside (81 files, 1117 tests). The hermetic
shape-only coverage (no real bundle) is asserted by the AC1/AC2 seam tests + the AC5 e2e (stripped body has no
`events[].query.personalization`, retains top-level `query.identity.fetch` + the analytics xdm), so AC6's shape claim
stays gated in `npm test` while its real-bundle deep-equal grounding is the rig.

**Craft nit fixed.** `core/wrapped-sdk-host.js`'s split comment cited "alloy-core `event.js`'s `mergeQuery`"; the real
module is `alloy-core/src/utils/event.js` — corrected to `utils/event.js` (matching the `stripInterceptedPersonalizationQuery`
docstring, which already had it right).

**No adapter change was needed (`adapters/eds/index.js` = no-op).** `bootAlloy` already wires the LIVE `consentRef`
(`consent: consentRef`), the strict gate (`egressPurposes: ALLOY_EGRESS_PURPOSES`), the live `setConsent` mutation
(`Object.assign(consentRef, v)`), AND passes the `consent` vector to the chamber `init` (which drives the real
`shapeAlloyConsent` delegate) — all from 033/020-02. The seam reads the same live ref per-interact, so AC4 needed no new
wiring.

### Reconciliation sweep

| Artifact | Disposition | Rationale |
|----------|-------------|-----------|
| `core/wrapped-sdk-host.js` | `updated` | The seam ENFORCEMENT half (AC2): compute EFFECTIVE gated purposes from the live `consentRef` (drop `personalization` when un-granted iff another governing purpose remains), strict-gate on those, and on send strip the per-event `events[].query.personalization` via the new `stripInterceptedPersonalizationQuery` helper (sibling of `stripInterceptedXdmBody`). Imports `resolveConsent`. |
| `connectors/alloy/consent.js` | `updated` | The delegate LIVENESS half (AC1(A)): `shapeAlloyConsent` relaxed to `collect:"y"` iff **`analytics_storage`** granted (was: iff BOTH granted), so alloy SENDS when analytics is consented instead of `collect:"n"` suppressing the interact upstream of the seam. Docstring rewritten (grounded in alloy's `awaitConsent` gate + the OQ13-1 residual). |
| `test/alloy-consent.test.js` | `updated` | AC1(A): `shapeAlloyConsent` with `{analytics:granted, pzn:denied}` → `"y"` (+ pzn-pending → `"y"`), `{analytics:denied,…}` → `"n"`, analytics-pending → `"n"` (fail-closed). Reframed from the old both-required expectations. |
| `test/wrapped-sdk-host.test.js` | `updated` | AC1/AC2/AC3 four-combo seam tests (+ PATH-PRECISION + no-op-strip + non-personalization-purpose back-compat) + AC4 live-consent (mutate the same ref → next interact flips). HERMETIC + PORTABLE — no probe/real-bundle import (the real-alloy differential moved to the rig). AC2 already asserts the analytics-only shape (no `events[].query.personalization`, retains `query.identity.fetch` + xdm). |
| `rig/alloy-consent-diff.mjs` (new) + `package.json` | `updated` | AC6 differential moved OUT of the hermetic suite to the RIG tier (`npm run rig:alloy-consent-diff`): drives the REAL, probe-local `@adobe/alloy@2.35.0` query-build modules + the REAL seam and asserts the seam-stripped ON body deep-equals alloy's native `defaultPersonalizationEnabled:false` interact. Fail-louds (non-zero exit) if the adopter-supplied probe bundle is absent. Keeps `npm test` portable (root-only `npm ci`). |
| `test/eds-boot-alloy.test.js` | `updated` | AC5 four-combination e2e (fresh boot each) via a new `CoarseSplitAlloyWorker` that drives the REAL `shapeAlloyConsent` (gating the interact fire on `collect:"y"` — models alloy's `awaitConsent`) + a personalization-aware fetch mock. Asserts the analytics-only interact FIRED (not suppressed) + the stripped body shape; analytics-denied → NO intercepted-fetch. Superseded the pre-034 all-or-nothing test. |
| `docs/refinement-todo.md` | `updated` | The "analytics-yes / personalization-no coarse consent" follow-on marked **RESOLVED end-to-end** (delegate liveness + seam enforcement), with the OQ13-1 `demdex`/`ad_storage` cookie-write residual recorded (stays OPEN). |
| `docs/inbox.md` | `updated` | The delegate-vs-liveness item reframed **RESOLVED** (fixed in 034-01), leaving OQ13-1 (cookie-write consent-gating) as the remaining orthogonal open question. |
| `adapters/eds/index.js` | `no-op` | `bootAlloy` already wires the live `consentRef` + `egressPurposes` + live `setConsent` mutation + `consent`→chamber init (033/020-02); the seam reads the live ref and the chamber drives the real delegate — no new wiring. |
| `docs/specs/README.md` (board) | `deferred` | The 034-01 board row flips at the DONE transition (orchestrator-owned ceremony), not here. |

### Definition of Done — verification
- [x] All 6 ACs pass; **TDD red→green** (the seam new-behavior tests, the two `shapeAlloyConsent` liveness cases, and the superseded e2e were each confirmed RED before their implementation landed). AC1–AC5 are gated in `npm test`: **81 files, 1117 tests** (baseline 1104 → +13). AC6 (the real-bundle differential) is realized as the RIG `npm run rig:alloy-consent-diff` (PASS vs `@adobe/alloy@2.35.0`; its hermetic shape-only coverage is in the AC2/AC5 tests). Zero regressions.
- [x] **PORTABILITY (craft blocker fix) verified:** `npm test` GREEN with `probes/alloy-worker/node_modules` moved aside (simulated CI root-only `npm ci`) — no probe/real-bundle dep in the hermetic suite.
- [x] `node build.mjs` OK (`all_workers_are_same_origin_file_urls: true`, no `blob:`/`data:`); `node contracts/validate.mjs` all pass; `npm run lint` exit 0; `npm run rig:alloy-consent-diff` PASS (probe bundle present) / fail-loud non-zero exit (absent).
- [x] Deviation log + Reconciliation sweep **produced** (above).
- [x] `docs/refinement-todo.md` alloy "analytics-yes/pzn-no" follow-on **RESOLVED end-to-end** (delegate + seam); the OQ13-1 cookie-write residual documented + parked in `docs/inbox.md` (stays OPEN).
- [ ] Reviewed: compliance + craft + **arch** + **frame-critique** — frame-critique is recorded (pre-implementation); compliance/craft/arch are the independent post-implementation review flow (not self-claimed here).
- [x] Reconciliation review passed — the gated REVIEWED→RECONCILED transition (auto-ticks on recorded evidence); not self-claimed.
- [ ] Board synced — deferred to the DONE transition (orchestrator-owned).
