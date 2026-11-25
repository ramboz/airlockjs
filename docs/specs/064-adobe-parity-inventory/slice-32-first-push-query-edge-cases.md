---
status: IN_PROGRESS
dependencies: [064-29]
last_verified: 2026-11-25
claimed_by: slice-064-32-first-push-edges
---

## Slice 064-32 — first push query edge cases match stock

**Goal:** The decision of whether a push carries a personalization query, and what it carries, matches pinned stock Alloy 2.31.1 for the odd inputs 064-29 left out: invalid surfaces and scopes, placement scopes spent by `applyResponse`, a notification-shaped push that passes scopes, and the order of a push against an `applyResponse` call.

**DoR:**
- ✅ 064-29 done (the host tells the chamber the view cache is warm; `carriesQuery` follows stock for well-formed scopes and surfaces).

**Acceptance Criteria:**

1. (Amended by the owner, 2026-11-25; see Findings.) A push whose `personalization.surfaces` is a non-empty array sends the personalization query even when stock drops every entry as invalid (not `web://...` or `#...`), and the query carries the surfaces stock keeps (none, then). A cache-only answer, with no fetch, applies only to empty or absent surfaces, subject to scopes and default selectors. Shown by a differential test on the request bodies and the DOM. The original text said stock answers from the cache without a fetch; the pinned 2.31.1 bundle shows that is false.
2. A push whose `decisionScopes` holds an empty string or a non-string entry behaves as stock for the same call (a query, or the validation error stock raises), shown by a differential test on the request bodies and the settled result.
3. A push whose XDM names a `decisioning.proposition*` event type and passes `decisionScopes` sends the personalization query as stock does (today the connector sends none, 064-20), shown by a differential test on the request body.
4. A boot with `placements` naming scopes other than `__view__`, then `applyResponse`, then a first push that passes no scopes: the placements' scopes are not fetched (stock declares none and sends no query on a warm cache), shown by a differential test on the request bodies; the adopter docs say an earlier `applyResponse` spends the declared placement scopes.
5. A push enqueued before an `applyResponse` call, and still waiting when that call finishes, does not see its cache (stock runs the push first, with the declared scopes and a cold cache), and an event pushed after an `applyResponse` never reaches the wire ahead of that response's redirect display, shown by a differential test on the request bodies. Today the host reads the cache state when an event runs, not in call order.

**DoD:**
- `npm test && npm run lint` and servo gate pass.
- Real-browser tests run under `describe.runIf(process.env.AIRLOCK_REAL_CHROMIUM === "1")` with a GATING step in the `browser-oracle` job.

**Anti-horizontal-phasing check:** Vertical: host `carriesQuery` and connector scope handling to request body and rendered view.

## Notes

Found by the 064-29 reconciliation review (M1, M2, L1 to L3, AC1 to AC4) and the round 2 craft review (AC5). Use SYNTHETIC responses only; if a new live capture is needed, stop and report `blocked`. Confirm each stock behavior in the pinned 2.31.1 bundle before building the AC (the review read stock from memory).

## Findings

All five ACs are met. Stock was read from the pinned 2.31.1 bundle (SHA-256 `7dd09409bb07d47b1b2289eec4ca15d67084a85a3d832bef6c73180889da32e8`, matching `ALLOY_SHA256`) and compared in real Chromium, SYNTHETIC responses, 0 captures. No `core/` change.

**Owner decision on AC1 (2026-11-25).** The first run of the differential showed AC1's premise was wrong. In stock, `shouldFetchData` is `hasScopes() || hasSurfaces() || shouldRequestDefaultPersonalization()`, and `hasSurfaces` is a raw non-empty-array check. Entries are filtered only later, so an all-invalid or empty-string surfaces array still sends a query (with `surfaces: []`). Airlock already sent that query. The owner approved correcting the AC to match stock ("Approve the stock-matching correction (Recommended)"), kept the request-body and DOM comparison, and left the other ACs unchanged. The original wording is kept in the amended criterion above. The decision and the differential's evidence are in the coordinator's session record, not in this repo.

- **AC1.** The host's `carriesQuery` and the chamber now share one rule, `carriesPersonalizationQuery` (`connectors/alloy/connector.js`): a raw non-empty array of scopes or surfaces, an explicit default `true`, or a value that is not an array (so Alloy rejects it, as stock does). Test: "AC1 (owner-amended)" in `test/adobe-b4-personalization.test.js`.
- **AC2.** A scope list with an empty, non-string or repeated entry goes to Alloy as given, boot scopes after the page's own so the index in the error stays stock's. `""` and `null` query, `[1]`, `"x"` and `["a","a"]` reject with stock's message (the namespace prefix differs, `[alloy]` against `[stockAlloy]`, and the test normalizes only that). Well-formed lists are merged as before. Surfaces now go through as given too. This replaces 064-21's silent drop of non-string surfaces and its dedupe of repeated scopes: both differ from stock, which rejects them. Tests: "AC2" plus the connector tests.
- **AC3.** A `decisioning.proposition*` push that passes scopes, surfaces or an explicit default is a query: no boot scopes, `sendDisplayEvent: false`. A notification with no query input is unchanged. Test: "AC3", warm and cold. Still open: such a push does not deliver its decisions to the page.
- **AC4.** Already matched stock, so no code change; the differential is the proof. Test: "AC4". The adopter note (an earlier `applyResponse` spends the declared placement scopes) is in the `placements` option JSDoc, ADR-0063 and the CHANGELOG.
- **AC5.** a) A push now takes its cache warmth from call order: it is warm only if the cache was initialized (or an apply was in flight) when it was called, or an earlier push fetched. Before, it read the cache when it ran. The differential uses a push rejected by option validation (no request, no scopes spent) as the slow predecessor. Hermetic: "AC5: a push queued before an applyResponse call runs cold ...". b) The ordering of a later push behind an apply's redirect display could not be broken in a test: the gate drain already sends a front display before the gated push. Round 1 review named one path (a display queued in the turn the awaited promise settles), so the drain now checks the front once more after its wait. It is covered by the existing 064-29 test "round 1: the redirect display an in-flight applyResponse queues is sent ahead of the push waiting on that applyResponse", which was not changed.
- **Red to green.** With the production change reverted: AC1, AC2, AC3 and AC5 fail in real Chromium (AC4 already passed), and the hermetic AC5 test fails (p1 reads warm). All pass with it.
- **Round 1 review fixes:** a malformed top-level `decisionScopes` no longer drops a well-formed `personalization.decisionScopes` (AC2 differential case added); a notification-shaped push that carries a query is held behind an in-flight `applyResponse` like any push; a `null` value counts as absent in the query rule.
- **Carried, not fixed here (owner: a follow-up slice):** AC5 cold covers the host cache and the boot scopes, not the chamber Alloy's own cache, so a boot with no placement scopes and a push called before an apply sends no `__view__` query where stock does; `calledWarm` is a boolean, so an apply that fails while a later one succeeds can warm a push stock runs cold; a bare `decisionScopes: null` renders the cache view where stock does not (unverified cause); the differential's wire view hides every root surface. Also: the page's default surface `web://host/` in the query (unattributed domain mismatch, filtered in the test's wire view), the 064-35 `getTld` mirror, bug 007 residuals, the 064-24 redirect-order flake, and the notification decision-delivery gap above.
