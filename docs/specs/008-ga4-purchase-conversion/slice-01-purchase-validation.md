---
status: DONE
dependencies: []
last_verified: 2026-08-27
servo_driven: true
---

## Slice 008-01 — purchase-conversion validation in the GA4 connector

**Goal:** Add purchase-scoped validation to `mapToMp`
([connectors/ga4/map.js](../../../connectors/ga4/map.js)) so a `purchase` event
missing a required GA4 ecommerce field (`transaction_id`, `currency`, `value`,
non-empty `items[]`) is rejected with a clear, field-naming error, while
non-purchase events map unchanged.

**Oracle target (the executable spec):**
[test/ga4-purchase.test.js](../../../test/ga4-purchase.test.js) — 6 assertions
(1 valid-mapping regression guard, 4 missing-field throws, 1 non-purchase
untouched). Gated by `score_vitest` in `oracle.sh` at `THRESHOLD=1.0`.

**Done when:** `bash oracle.sh` exits 0 (composite 1.0) — i.e. the full vitest
suite (including `test/ga4-purchase.test.js`) is green and the `contracts`
validator stays green — with `connectors/ga4/map.js` the only production file
changed. The runner must NOT weaken the test to pass it.

**Implementation guidance (for the servo runner):**
- Validate only when `event.type === "purchase"`. Leave all other events on the
  existing generic path.
- Required fields: `transaction_id` (non-empty string), `currency` (non-empty
  string), `value` (finite number), `items` (non-empty array). Throw an `Error`
  whose message names the missing/invalid field.
- Keep `mapToMp` a pure function (no DOM, no globals, no network) — it runs in
  the chamber worker. Reject, don't repair (no deriving `value` from items).
- Do not change the emitted body shape for a VALID purchase (regression guard AC1).

### Servo delivery (close-out)

**Delivered autonomously by `/servo:agent-loop`** (loop driver, run
`20260827T…`), 1 iteration, ~$0.18. The `runner` agent added a
`validatePurchase(params)` helper + a purchase-scoped guard in `mapToMp`
([connectors/ga4/map.js](../../../connectors/ga4/map.js), +30 lines).

**Gate = the oracle + a human diff review** (this is a servo-driven feature, not
the jig review ceremony):
- `bash oracle.sh` → composite **1.0** at `THRESHOLD=1.0` (the full vitest suite
  125/125 green + the `contracts` validator green).
- Orchestrator reviewed the diff: real field-naming validation, pure function,
  purchase-scoped, non-purchase events untouched; **only `map.js` changed — the
  fixed tests were not edited or gamed** (no reward-hacking).

**Notes on the loop run itself** (kept as a servo case study): the first two
attempts (goal driver, then loop driver) ran the guardrails correctly but made
**zero edits** — the headless `claude -p` child lacked edit permission
(`loop.py` passes no skip-permissions flag), so its `Edit`/`Write` calls were
denied. Both failed **safely**: guardrails fired (iteration-cap, then plateau),
fail-closed (no false pass — `gate.py` stayed the authority at composite 0.5),
tests not gamed, ~$2.2 total. After a `.claude/settings.local.json`
`bypassPermissions` grant (the `settings.json` force-push/`reset --hard`/`rm -rf`
denies still apply on top), the loop converged in one iteration.
