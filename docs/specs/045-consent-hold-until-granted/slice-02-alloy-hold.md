---
status: DONE
dependencies: [adr-0023]
last_verified: 2026-09-12
frame_review: true
arch_review: true
---

<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about runnable
     surfaces by probe first (run it / read source) or a citation, else mark them
     as assumptions in `## Assumptions` — never assert an unverified claim as fact. -->

## Slice 045-02 — apply hold-until-granted to alloy (via alloy's native `defaultConsent:"pending"` queue, preserving 034-01)

**Goal:** Give alloy **hold-until-granted** by using alloy's **OWN native `defaultConsent:"pending"` queue** — under
unresolved (pending) consent, configure alloy with `defaultConsent:"pending"` so **alloy itself queues** its
`sendEvent`s (no interact egresses); on a later grant, a host→chamber `setConsent` message drives alloy's own
`setConsent(collect:"y")`, which **flushes alloy's queue** — each queued interact fires through the now-open seal with its
**full round-trip preserved** (decisions / identity / consent cookie), because it is a real `sendEvent`, not a replay of a
mapped payload. This realizes hold-until-granted with the **library's own mechanism** (maximal fidelity, minimal custom
code) rather than a hand-rolled buffer. The TRUSTED seam (`core/wrapped-sdk-host.js`) is unchanged and stays the backstop;
034-01's per-purpose strip is preserved (analytics-granted / pzn-denied still **flows**, pzn stripped, never queued).
Implements [ADR-0023](../../decisions/adr-0023-ad-pzn-egress-hold-until-consent.md) for alloy.

**GROUNDED (creds-free rig probe, 2026-09-12).** Against the real `@adobe/alloy@2.35.0` bundle (playwright, local origin,
interact + set-consent intercepted/stubbed — no live Edge, no creds): `defaultConsent:"pending"` **queued** a `sendEvent`
(0 interacts); a later `setConsent(collect:"y")` — with the set-consent request egressing + returning a valid consent
handle — logged *"User consented."* and **flushed** the queued `sendEvent` (the interact fired, `sendEvent` resolved with
its decisions round-trip). See `rig/alloy-consent-pending.mjs` (this slice packages the probe as a permanent rig).

**Why native queue, not a seam-hold or a hand-rolled chamber buffer (folded from two frame-critiques + owner steer +
grounding).** (1) The originally-named seam "buffer+flush like 017-03" is infeasible — alloy's interact is a synchronous
request-response round trip; leaving the chamber fetch pending HANGS (`core/wrapped-sdk-host.js:377` returns before the
`:430` `timeoutMs` timer) and DEADLOCKS single-slot `driveEvent` (`:574`); a seam fire-and-forget flush DISCARDS the
response; and under pending alloy already self-suppresses (`shapeAlloyConsent`→`collect:"n"`). (2) A hand-rolled in-chamber
buffer works but re-invents what alloy already does. (3) alloy's **native `defaultConsent:"pending"`** IS the vendor's
designed hold-until-consent — grounded above — so airlock uses it (fidelity, not opinion).

**DoR:**
- ✅ Two-path grounding (spec 045 §A1): alloy egress is enforced by `core/wrapped-sdk-host.js` (strict `egressVerdict` +
  the 034-01 per-purpose seam strip `:336-402`), NOT the core seal — 045-01 doesn't touch it. Boot already drives alloy's
  own `setConsent` DELEGATE (020-02, `connectors/alloy/alloy-chamber.worker.js:444-460`); this slice refines that delegate
  to use `defaultConsent:"pending"` under pending + a grant-time flush.
- ✅ Native-queue mechanism GROUNDED by the creds-free rig probe (above) — the DoR/kill gate the 045-02 frame-critique
  required is satisfied *before* building.
- ✅ Chamber message protocol (`alloy-chamber.worker.js:590-597`) handles `init`/`event`/`intercepted-fetch-response`;
  this slice ADDS a `setConsent` message (host→chamber) to drive alloy's `setConsent` mid-session (the flush trigger).

**Acceptance Criteria:**

1. **A1 topology + native-queue GROUNDED.** alloy egresses ONE `interact` endpoint; `personalization` is co-carried +
   strip-only (no separable pzn-only egress). The hold is of the WHOLE interact under pending `analytics_storage`, realized
   by alloy's native `defaultConsent:"pending"` queue. Grounded by `rig/alloy-consent-pending.mjs` (creds-free, real alloy
   2.35.0): pending queues (0 interacts) → `setConsent(y)` + a valid set-consent round-trip flushes (interact fires). The
   rig ships in this slice + the grounding is recorded in the deviation log.
2. **Boot under pending → alloy NATIVELY queues (was self-suppress).** The chamber maps the host consent vector to alloy's
   `configure({ defaultConsent })`: **pending → `"pending"`** (alloy queues; do NOT drive `setConsent(collect:"n")`, which
   self-suppresses); granted → drive `setConsent(collect:"y")` (or `defaultConsent:"in"`); denied → `setConsent(collect:"n")`
   (self-suppress, byte-unchanged from today). Witnessed by a rig/test: pending boot → `sendEvent` → **no** interact
   egresses (queued in alloy).
3. **Grant → host→chamber `setConsent` message → native flush (full round-trip).** The host handle gains a `setConsent`
   that posts a `setConsent` message to the chamber; the chamber's `onmessage` drives alloy's `setConsent(collect:"y")`,
   which flushes alloy's queue — each queued interact fires through the seal (now consent-granted → seam SENDS) and the
   response returns into alloy (decisions/identity delivered — full round-trip, no discard). The **set-consent request**
   itself egresses on grant (the seam sends it — consent is granted; it is the consent-propagation the flush depends on).
   Witnessed by a rig/test: pending (queued) → `setConsent` grant → interact egresses.
4. **034-01 preserved + the seam stays the TRUSTED backstop (load-bearing).** Under analytics-granted / pzn-denied, alloy
   is configured to SEND (not `defaultConsent:"pending"`) → the interact fires → the seam strips pzn → analytics flows
   (034-01 unchanged). The seam's strict `egressVerdict` remains the trusted enforcement: a compromised chamber that fires
   under pending is still gated **pending → drop** at the seam. All existing 034-01 / wrapped-sdk-host tests
   (`test/eds-boot-alloy.test.js`, `test/alloy-consent.test.js`, `test/wrapped-sdk-host.test.js`) pass **unmodified**.
5. **Behavior-preserving + no core-seal coupling.** Full `npx vitest run` green; `core/consent.js` / `core/airlock.js`
   (the g-ads/GA4 path) untouched. The `defaultConsent` mapping + the host→chamber `setConsent` message are ADDITIVE (no
   consent vector wired → no `defaultConsent:"pending"`, byte-unchanged). `arch_review: true` (a new host→chamber consent
   channel + the boot `defaultConsent` mapping).

**DoD:**
- All ACs met; full suite green; the native-queue grounded by the committed rig.
- Compliance + craft + **arch** passes recorded; reconciliation walked.

**Out of scope (explicit):**
- The core seal `holdOnDenied` mode (045-01) and g-ads (044-02) — different path.
- Changing 034-01's strip semantics — this slice adds the pending-queue mapping, it does not alter the analytics-flows strip.
- A LIVE-Edge confirmation of the flush (creds-gated) — the creds-free rig grounds the mechanism against the real bundle;
  a live re-probe is a named nice-to-have, not a blocker.

## Assumptions

**A1 (alloy egress topology — GROUNDED 2026-09-12).** alloy egresses ONE `interact` endpoint
(`connectors/alloy/connector.js` `ALLOY_INTERACT_ENDPOINT`), one request per event; `personalization` is co-carried
(`purposes.egress: ["analytics_storage","personalization"]`) and strip-only — no separable pzn-only egress. The hold is of
the WHOLE interact under pending `analytics_storage`.

**A2 (native `defaultConsent:"pending"` queue+flush — GROUNDED by `rig/alloy-consent-pending.mjs`, creds-free).** alloy
2.35.0 natively queues `sendEvent`s under `defaultConsent:"pending"` and flushes them on `setConsent(collect:"y")`, with
the full round-trip. *Integration nuance (grounded):* the flush requires the `set-consent` request to **egress and return
a valid consent response** (a `state:store` consent handle → "User consented"); an empty response does NOT flush. In the
chamber this means on grant the set-consent intercepted-fetch must pass the seam (it does — consent is granted then) and
reach a real Edge (or, in a rig/test, a stub returning a consent handle). *Risk if wrong at real-site:* a live-Edge
re-probe (creds-gated) is the named confirmation; the creds-free rig grounds the mechanism against the real bundle.

**A3 (double-fire — named).** alloy's native queue IS the single accept-fire (flush on `setConsent`). If the host
application ALSO re-drives events on a consent-change callback, a queued event could double-fire; typical adopters do not
re-drive past events. Named so the adapter wiring avoids a re-drive-on-grant.

**A4 (unload under persistent denial).** Events queued by alloy under `defaultConsent:"pending"` and never granted are
discarded at page teardown (the worker tears down) — correct "no ping" under persistent denial, mirroring the seal's
sync/unload drop (045-01 AC3).

### Deviation log (after reconciliation)

- **[MAJOR — approach pivot, grounded] From the framed seam hold+flush → alloy's NATIVE `defaultConsent:"pending"`
  queue.** The old seam-refinement framing lived in THREE places — spec.md's Decomposition bullet, spec.md's Assumptions
  A1, and ADR-0023's A1 — all originally describing "refine `core/wrapped-sdk-host.js`'s pending→DROP to hold+flush" (a
  seam-side buffer); **all three are amended to the native-queue realization** by this slice. Two frame-critiques + a creds-free grounding probe drove the pivot: (1) the seam
  hold is INFEASIBLE — alloy's interact is a synchronous request-response round trip; leaving the chamber fetch pending
  HANGS (hold returns at `wrapped-sdk-host.js:377` before the `:430` timer) and DEADLOCKS single-slot `driveEvent`; a
  seam fire-and-forget flush DISCARDS the response; and under pending alloy self-suppresses (`collect:"n"`). (2) Owner
  steer ("hold in the chamber"). (3) The creds-free rig `rig/alloy-consent-pending.mjs` GROUNDED that alloy's native
  `defaultConsent:"pending"` queues sendEvents + flushes them on `setConsent(collect:"y")` with the full round-trip. So
  045-02 uses the vendor's own mechanism (maximal fidelity) via a boot `defaultConsent` mapping (`shapeAlloyBoot`) + a
  host→chamber `setConsent` message; the seam stays the trusted backstop (byte-unchanged). This realizes ADR-0023's
  kill-criterion "hold+flush the whole interact when consent is unresolved" — in the chamber, not the seam.
- **[craft + arch nit → FIXED] `applyConsent` mid-session asymmetry.** `applyConsent` now uses the pending-aware
  `shapeAlloyBoot(...).setConsentOptions` (was `shapeAlloyConsent` unconditionally): a mid-session update that leaves
  `analytics_storage` still pending now KEEPS alloy's native queue holding (skips the drive), instead of driving
  `collect:"n"` which would reject `awaitConsent` and DISCARD the held queue. Consistent with the boot path. (Both
  gating reviewers flagged this independently; privacy-safe either way — the fix prevents queue-loss on a partial update.)
  `shapeAlloyConsent` dropped from the worker import (now unused there; still used inside `consent.js`'s `shapeAlloyBoot`).
- **[craft nit → logged, no change] `summary.consentDriven` is last-write-wins** (shared by the boot path + `applyConsent`)
  — a minor observability limit if `setConsent` is driven repeatedly. Harmless in the primary flow (boot leaves it `null`
  under pending, so the flush result survives); left as-is (cosmetic).
- **Coverage split (honest — ratified by all three reviewers).** The chamber boot glue + `applyConsent` are not directly
  unit-testable (classic worker, not importable). Covered by: `shapeAlloyBoot` (pure decision) unit tests; the connector
  `defaultConsent`→`configure` threading test; the host→chamber message-channel + seam-hold tests; and the creds-free rig
  (real alloy queue/flush). Matches the repo's established worker-glue-via-rigs convention.
- **Ratified strengths (logged, not blocking):** the seam enforcement is byte-unchanged (git-verified `wrapped-sdk-host.js`
  +15/-0 — JSDoc + the additive `setConsent`); the adapter mutates the seam's live `consentRef` BEFORE triggering the
  chamber flush, so flushed interacts are still seam-gated (a compromised chamber firing under pending is still
  strict-dropped); the native-queue layering (vendor mechanism = untrusted-chamber liveness delegate, strict
  `egressVerdict` = trusted enforcement); the creds-free rig grounding; and the compliance no-deadlock deep-dive.
- **Deferred:** a LIVE-Edge confirmation of the flush (creds-gated) — named nice-to-have; the creds-free rig grounds the
  mechanism against the real bundle.

### Reconciliation sweep

- Full `npx vitest run` → **104 files / 1616 passed, 0 fail** (1604 pre-slice + **12** new `it()`: 6 in
  `test/alloy-consent.test.js`, 2 in `test/alloy-connector.test.js`, 2 in `test/wrapped-sdk-host.test.js`, 2 in
  `test/eds-boot-alloy.test.js`). `eslint .` → 0.
- Behavior-preserving: `shapeAlloyConsent` is unchanged; granted/denied/no-vector boots are byte-identical; the seam
  enforcement (strict `egressVerdict` + the 034-01 strip) and the core seal (`core/consent.js`, `core/airlock.js`) are
  untouched (not in the change set). Only behavioral change: pending `analytics_storage` → `defaultConsent:"pending"`
  (native queue) instead of `collect:"n"` (suppress).
- Changed-file dispositions (working tree since 0815a2b):
  - `connectors/alloy/consent.js` — new pure `shapeAlloyBoot` (boot posture mapper); `shapeAlloyConsent` unchanged.
  - `connectors/alloy/alloy-chamber.worker.js` — boot uses `shapeAlloyBoot` (threads `defaultConsent`, drives boot
    `setConsent` only when resolved) + the `setConsent` message handler `applyConsent` (pending-aware after the fix).
  - `core/wrapped-sdk-host.js` — additive handle `setConsent` (posts the chamber message); seam enforcement byte-unchanged.
  - `adapters/eds/index.js` — `bootAlloy` `setConsent` mutates the seam `consentRef` then calls `host.setConsent`.
  - `rig/alloy-consent-pending.mjs` (new) — the creds-free grounding rig; `package.json` — the `rig:alloy-consent-pending` runner.
  - `test/{alloy-consent,alloy-connector,wrapped-sdk-host,eds-boot-alloy}.test.js` — +12 `it` across the three surfaces.
  - `docs/specs/045-consent-hold-until-granted/spec.md` (045-02 bullet + A1 lines updated to native-queue),
    `docs/decisions/adr-0023-...md` (A1 amended), `slice-02-alloy-hold.md` (this slice) + `reviews/slice-02-*.md`.
- Status board (`docs/specs/README.md`) still shows 045-02 as `REVIEWED`/`DRAFT` — **to be** regenerated at DONE.
- Review evidence recorded under `reviews/` — frame-critique + compliance + craft + arch (`slice-02-reconciliation.md`
  recorded at the RECONCILED transition, after this sweep).

### Close-out (post-DONE)

- [x] ADR-0023 A1 amended: alloy hold realized via native `defaultConsent:"pending"` (not the seam hold+flush its A1
      originally named); cites the grounding rig `rig/alloy-consent-pending.mjs`.
- [x] Spec 045 rolls up when 045-01 + 045-02 are DONE; regenerate the board — spec 045 → DONE, board regenerated.
