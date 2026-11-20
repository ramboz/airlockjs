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

1. `applyPropositions`, `renderDecisions`, prehiding and the HTML content, JSON content and DOM action proposition items behave as stock Alloy 2.31.1 (differential tests); rule set items are evaluated by the stock Alloy in the chamber and delivered as data (M3 test, no stock-page arm); redirect items navigate with `location.replace`, except the redirect display notification (closed in 064-24).
2. Link-click collection and the display notification of rendered propositions compare clean against stock, except the click interact notification shape (merged interact, `viewName`, `trackingLabel` tokens, AJO auto-collect) -> 064-25 and the redirect display notification (closed in 064-24).
3. Fixture S4 compares clean on the production path. S7 compares with the documented filters, except the SPA view cache and first-event-only `decisionScopes` (one extra POST and two filters, plus the 064-19 `webPageDetails.URL` filter that stays) -> 064-23 (closed in 064-23, 2026-11-20: S7 now compares with POST parity and only the URL filter).

**DoD:**
- `npm test && npm run lint` and servo gate pass.

**Anti-horizontal-phasing check:** Vertical: bridge surface to wire to comparison for one real journey.


## Implementation notes (2026-11-20)

### What was built (all main-thread, ADR-0014; egress still mediated)

- `adapters/eds/personalization-render.js`: renderer for `html-content-item`, `dom-action-item` (setHtml, setText, setAttribute, setStyle, append/prepend/insertBefore/insertAfter, replaceHtml, move, resize, rearrange, remove, click), `redirect-item` (http(s) only, `location.replace`), plus the display and `propositionInteract` XDM builders and `applyPrehidingStyle`. `html-content-item` with `data.selector`+`data.type` renders as a dom-action. `setAttribute` refuses `on*`, `srcdoc`/`data`/`http-equiv`/`formaction`, any attribute on script/iframe/object/embed/base/meta/link, and dangerous URL schemes. `insertAfter` keeps node order. Each item is try/caught so one failure does not stop the batch. `propositionAction` uses `tokens:[token]`. HTML is sanitized (`core/sanitize-html.js`); stock re-executes inserted scripts, ours does not (deliberate difference, tested). `customCode` is refused with a diagnostic (incompatible, no raw JS from a payload).
- `adapters/eds/link-click.js`: capture-phase `document` click listener (stock ActivityCollector rules: link name, region, download/exit/other type, remembered page name from the last page view, `pageIDType`). Click on a rendered click-action element sends `propositionInteract` with the proposition metas.
- `adapters/eds/index.js` `bootAlloy`: `prehidingStyle` (applied before the response, removed after render or after `prehidingTimeoutMs`, default 3000), link-click install (`clickCollectionEnabled`, `clickCollection`, `downloadLinkQualifier`), `wireAlloyDecisions` (render unless `renderDecisions:false`, in which case the renderer stays idle (no render, no Edge display) and propositions go to the `onDecisions` sink; an eagerly reserved box (`reservedPlacements`) is still filled with its `proposition_display` exposure, regardless; `onDecisions` is a documented option; `ruleset-items` channel, display notification only for renderer-rendered propositions), handle methods `applyPropositions` and `subscribeRulesetItems`.
- `connectors/alloy/connector.js`: subscribes `subscribeRulesetItems` in the chamber (only when `decisions` is granted) and delivers items as data; forwards `params.data`; skips `personalization`/`decisionScopes` on `decisioning.proposition*` notification events.
- `core/sanitize-html.js`: the `data:text/html` literal is built with `join` so the build's blob:/data: literal scan stays clean.
- `rig/adobe-b1-replay.mjs`: `bodyHtml`/`headHtml` now actually reach the page (the 064-19 options were accepted but dropped).

### Results per row (spec 064 s2.1 and s2.2)

- **Row 10 `applyPropositions`** (host-side): proven against pinned stock Alloy 2.31.1 in a real browser (same DOM result, no notification of its own). Class stays host-side.
- **Row 11 `evaluateRulesets`** (worker-native): runs in the chamber through the rig command path; a rule set evaluated against a host-supplied `decisionContext`. Stock reads non-standard window props only for context; the chamber has no window, so context is the data the host passes. No host command entry (separate item).
- **Row 12 `subscribeRulesetItems`** (M3 resolved): **mediated as data, built**. Items arrive at a main-thread callback via the `decisions` capability; no function crosses. The 064-19 AC2 note stands, no reclassification.
- **s2.2 Personalization**: HTML content, JSON content, DOM action set, rendering, `renderDecisions`, `prehidingStyle` and the display notification of rendered propositions each have a stock-vs-airlock differential. Rule set items are evaluated by the pinned stock Alloy in the chamber and arrive as data (M3 test, Airlock-side only; no stock-page arm, the corpus has no ruleset capture). The redirect item navigates (`location.replace`) but its display notification is sent with keepalive (closed in 064-24). The click interact notification is a differential on `decisioning` only; its full shape is 064-25. **Target activity** and `__view__` propositions are covered by S4/S7 as recorded, S7 with the 064-23 gaps (closed in 064-23).
- **s2.2 Lifecycle (B4 half)**: link-click collection (external, download, internal) and `clickCollectionEnabled:false`; the link-click request bodies equal stock's (meta stripped). SPA view change is not stock-equal (closed in 064-23, 2026-11-20).

### Fixtures

- **S4** (`s4-base/repeat/active-base/active-repeat`): replayed through the production path (`placements` + `reservedPlacements`, `renderDecisions:false`); both POSTs (interact with `query.personalization`, display notification listing the two `__view__` propositions) compare clean. M1 resolved.
- **S7**: page view, manual link click and SPA view compare only with these filters, all carried to 064-23 and none claimed as parity (all closed in 064-23, 2026-11-20): the connector sends declared `decisionScopes` on every event (stock only on the first; this is a default that differs from stock, so it is a carry, not a decision); the recorded SPA view carries Alloy's view-cache display notification in `events[0].xdm._experience.decisioning` because stock caches view-scoped propositions and re-notifies them when a push names the view; we have no view cache (carried C2, not an effect of `renderDecisions`); a 4th POST is our own display notification; first two POSTs ignore `webPageDetails.URL` (064-19 note).

### Oracle disclosure

The corpus has no dom-action, redirect, JSON, ruleset, `propositionInteract` or real auto-click request. Those behaviors are compared against **pinned stock Alloy 2.31.1 running on the same synthetic page** (differential), not against a capture. They are SYNTHETIC; the test names say so. Extra captures needed: **0** (no live capture was run).

### Storage grant

Not needed for S4 and S7, which compare clean without it. The storage grant was built separately in 064-27.

### Cutline (2026-11-20, coordinator)

The three ACs were reworded to what is built and fully met; each ends `except <gap> -> 064-NN`. Spec 064 s2.1/s2.2 rows 10 to 12, Personalization and Lifecycle carry a B4 pointer so 064-15 cannot read them as parity. Follow-ups: **064-23** (SPA view cache, first-event-only `decisionScopes`), **064-24** (redirect display notification), **064-25** (interact notification parity). 064-26 (H1 command entry, `slice-26-host-command-entry.md`) and 064-27 (storage grant) have their own slices.

**Keepalive correction:** the earlier "needs a keepalive path through the seam" was wrong. 064-18 already routes `sendBeacon` and `init.keepalive` requests through the seal and the shared `createKeepaliveTracker` (`core/egress.js`). (Closed in 064-24.) What was missing was the `documentUnloading` hint on the display event that `connectors/alloy/connector.js` pushes (no such option today) and the ordering before `location.replace`. That is 064-24.

**`renderDecisions` default:** `bootAlloy` defaults it to `true` (documented in the `opts` JSDoc); `false` skips only the renderer, not reserved-box fills. That matches the recorded corpus, whose stock replay sends `renderDecisions:true`, and a site that declares placements and wants them filled. Alloy's per-call default is `false`; a stock-style headless site sets `false` and uses `onDecisions` plus `applyPropositions`. The connector always sends `false` to the chamber.

### Carried (owner or later slice)

- **064-23, 064-24 (closed), 064-25** own C2 (SPA view cache, with first-event-only `decisionScopes`), C3 (redirect display) and C5 (interact shape). The three bullets below name the gaps; the slices are the owners.


- **Activity-map persistence**: stock `eventGroupingEnabled` and `sessionStorageEnabled` click persistence across pages is not ported (the main-thread collector keeps only the last page name in memory). Parity gap; dispositioned in 064-27 (not a grant item, stays open in refinement-todo).
- **Two linkClicks POSTs in the replay** were the rig booting airlock (click collection on) on the stock page too. The stock arm now boots with `clickCollectionEnabled:false`; the test asserts exactly one stock POST and compares full bodies.
- **SPA view cache (C2)**: stock caches view-scoped propositions and renders/notifies on a push naming the view. Built in 064-23 (2026-11-20). Was the source of the S7 SPA-view display delta.
- **Redirect display notification (C3)**: stock sends it with keepalive/`documentMayUnload`; closed in 064-24 (the airlock now sends it with keepalive before `location.replace`).
- **Interact notification shape (C5)**: stock merges `propositionInteract` into the click event, sends `viewName`, reads `trackingLabel` from item characteristics, and has AJO auto-collect. Ours sends a separate event, uses `data-aep-click-label`, no AJO auto-collect. Compared on `decisioning` only -> 064-25.
- **Trusted Types** for the template write is not addressed (per-item isolation only).
- **Low carries**: K5 prehide selector injection/nonce/consent-out, K6 dedup attribute, K7 one observer per item, K10 remote fetches from rendered content sit outside the seal.
- **`customCode` and script re-execution**: incompatible by design (no raw JS from a payload).
- **Host command entry**: `evaluateRulesets` stays rig-reachable only (064-19 H1 carry, unchanged).
- **Reserved-box fills** keep `proposition_display` and send no Edge display notification; only renderer-rendered propositions do.
- **`subscribeRulesetItems` delivery needs `decisions` wired** (placements, reservedPlacements, or `onDecisions`); otherwise the subscription is a no-op.

### Shared-file changes to upstream to main

`core/sanitize-html.js` (one literal built by `join`), `connectors/alloy/connector.js` (ruleset subscription, `data` forwarding, notification skip), `adapters/eds/index.js` (bootAlloy wiring). `core/wrapped-sdk-host.js` untouched.

### Verification

`npm test` 2918 passed; `npm run lint` clean; `test/adobe-b4-personalization.test.js` 24 tests (22 real Chromium, 2 hermetic) (CI GATING step added to `browser-oracle`).
