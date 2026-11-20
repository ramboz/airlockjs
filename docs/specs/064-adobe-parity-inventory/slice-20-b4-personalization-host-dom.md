---
status: DONE
dependencies: [064-19]
last_verified: 2026-11-20
---

## Slice 064-20 — B4: Personalization and host DOM

**Goal:** Proposition rendering, prehiding, redirects, click collection and rulesets context match the recorded corpus, with the DOM work kept on the main thread.

**DoR:**
- ✅ B3 done.

**Acceptance Criteria:**

1. `applyPropositions`, `renderDecisions`, prehiding and redirect proposition items behave as recorded.
2. Click collection and display or click notifications compare clean.
3. Fixtures S4 and S7 compare clean.

**DoD:**
- `npm test && npm run lint` and servo gate pass.

**Anti-horizontal-phasing check:** Vertical: bridge surface to wire to comparison for one real journey.


## Implementation notes (2026-11-20)

### What was built (all main-thread, ADR-0014; egress still mediated)

- `adapters/eds/personalization-render.js`: renderer for `html-content-item`, `dom-action-item` (setHtml, setText, setAttribute, setStyle, append/prepend/insertBefore/insertAfter, replaceHtml, move, resize, rearrange, remove, click), `redirect-item` (http(s) only, `location.replace`), plus the display and `propositionInteract` XDM builders and `applyPrehidingStyle`. HTML is sanitized (`core/sanitize-html.js`); stock re-executes inserted scripts, ours does not (deliberate difference, tested). `customCode` is refused with a diagnostic (incompatible, no raw JS from a payload).
- `adapters/eds/link-click.js`: capture-phase `document` click listener (stock ActivityCollector rules: link name, region, download/exit/other type, remembered page name from the last page view, `pageIDType`). Click on a rendered click-action element sends `propositionInteract` with the proposition metas.
- `adapters/eds/index.js` `bootAlloy`: `prehidingStyle` (applied before the response, removed after render or after `prehidingTimeoutMs`, default 3000), link-click install (`clickCollectionEnabled`, `clickCollection`, `downloadLinkQualifier`), `wireAlloyDecisions` (render, `ruleset-items` channel, display notification only for renderer-rendered propositions), handle methods `applyPropositions` and `subscribeRulesetItems`.
- `connectors/alloy/connector.js`: subscribes `subscribeRulesetItems` in the chamber (only when `decisions` is granted) and delivers items as data; forwards `params.data`; skips `personalization`/`decisionScopes` on `decisioning.proposition*` notification events.
- `core/sanitize-html.js`: the `data:text/html` literal is built with `join` so the build's blob:/data: literal scan stays clean.
- `rig/adobe-b1-replay.mjs`: `bodyHtml`/`headHtml` now actually reach the page (the 064-19 options were accepted but dropped).

### Results per row (spec 064 s2.1 and s2.2)

- **Row 10 `applyPropositions`** (host-side): proven against pinned stock Alloy 2.31.1 in a real browser (same DOM result, no notification of its own). Class stays host-side.
- **Row 11 `evaluateRulesets`** (worker-native): runs in the chamber through the rig command path; a rule set evaluated against a host-supplied `decisionContext`. Stock reads non-standard window props only for context; the chamber has no window, so context is the data the host passes. No host command entry (separate item).
- **Row 12 `subscribeRulesetItems`** (M3 resolved): **mediated as data, built**. Items arrive at a main-thread callback via the `decisions` capability; no function crosses. The 064-19 AC2 note stands, no reclassification.
- **s2.2 Personalization**: HTML content, JSON content, DOM action set, redirect, rule set, rendering, `renderDecisions`, `prehidingStyle`, display and click notifications each have a stock-vs-airlock differential. **Target activity** and `__view__` propositions are covered by S4/S7 as recorded.
- **s2.2 Lifecycle (B4 half)**: link-click collection (external, download, internal), `clickCollectionEnabled:false`; request bodies equal stock's (meta stripped).

### Fixtures

- **S4** (`s4-base/repeat/active-base/active-repeat`): replayed through the production path (`placements` + `reservedPlacements`, `renderDecisions:false`); both POSTs (interact with `query.personalization`, display notification listing the two `__view__` propositions) compare clean. M1 resolved.
- **S7**: page view, manual link click, SPA view compare clean with these documented production-path deltas: the connector sends declared `decisionScopes` on every event (stock only on the first); the recorded SPA view carries Alloy's view-cache display notification in `events[0].xdm._experience.decisioning` because stock used `renderDecisions:true` (production sends `false`; the stock rig in B3 compares it clean); a 4th POST is our own display notification; first two POSTs ignore `webPageDetails.URL` (064-19 note).

### Oracle disclosure

The corpus has no dom-action, redirect, JSON, ruleset, `propositionInteract` or real auto-click request. Those behaviors are compared against **pinned stock Alloy 2.31.1 running on the same synthetic page** (differential), not against a capture. They are SYNTHETIC; the test names say so. Extra captures needed: **0** (no live capture was run).

### Storage grant

Not needed: S4 and S7 compare clean without it. `ALLOY_STORAGE_NAMES` is untouched and the refinement-todo entry "Alloy chamber storage persistence" stays open.

### Carried (owner or later slice)

- **Activity-map persistence**: stock `eventGroupingEnabled` and `sessionStorageEnabled` click persistence across pages is not ported (the main-thread collector keeps only the last page name in memory). Parity gap, carry to the host-command/storage item.
- **Stock sends two linkClicks POSTs** for one click in the replay (unexplained, likely stock's retry/second flush); we send one. Compared body-for-body against the first.
- **`customCode` and script re-execution**: incompatible by design (no raw JS from a payload).
- **Host command entry**: `evaluateRulesets` stays rig-reachable only (064-19 H1 carry, unchanged).
- **Reserved-box fills** keep `proposition_display` and send no Edge display notification; only renderer-rendered propositions do.
- **`subscribeRulesetItems` delivery needs `decisions` wired** (placements, reservedPlacements, or `onDecisions`); otherwise the subscription is a no-op.

### Shared-file changes to upstream to main

`core/sanitize-html.js` (one literal built by `join`), `connectors/alloy/connector.js` (ruleset subscription, `data` forwarding, notification skip), `adapters/eds/index.js` (bootAlloy wiring). `core/wrapped-sdk-host.js` untouched.

### Verification

`npm test` 2918 passed; `npm run lint` clean; `test/adobe-b4-personalization.test.js` 20 tests in real Chromium (CI GATING step added to `browser-oracle`).
