---
status: IN_PROGRESS
dependencies: [067-07, 067-09, 067-10]
last_verified: 2026-11-13
claimed_by: 067-08-alloy-context-option
---

## Slice 067-08: Alloy `context` defaults to the stock list

**Goal:** The Alloy connector's `context` option defaults to stock `[web, device, environment, placeContext]` and is fed by the 067-07 channel. A site narrows it. The code default `context = []` goes away.

**DoR:**
- ✅ ADR-0062 point 2 and its Assumptions. The stock default is verified from source: `@adobe/alloy@2.31.1`, `packages/core/src/components/Context/index.js:32-36,53`. The check against the pinned bytes stays with 064 inventory.
- 067-07 is done.
- Boundary with 064-17 (spec 067 section 4): this slice ships the option, the wiring and a minimal mapping from channel groups to Alloy's `context` input. Per-field fidelity against the pinned 2.31.1 bytes, the apex probe and recorded before-state seeding stay with 064-17.

**Acceptance Criteria:**

1. `connectors/alloy/connector.js` no longer defaults `context = []`. The default is `["web", "device", "environment", "placeContext"]`. The chamber `configure()` receives the list the site chose, or the stock list.
2. A site narrows the list with the existing `context` option. A reduced list yields only those groups (its own tested state). The site-facing doc comment at `:60` and `:95` is updated.
3. The chamber feeds Alloy's context collection from the 067-07 channel, not from fabricated shims, for the groups listed. An unset channel yields no fabricated values.
4. A test proves the default configure call carries the stock list and a narrowed call carries the narrowed list.
5. `toXdm` forwards the site-supplied `xdm` as stock does. The 2-field mapping becomes an opt-in (ADR-0062's table, ADR-0013:24-30 row). A test pins the default (full `xdm` forwarded) and the opt-in (2-field).
6. The credentials denylist still applies to what the connector sends (067-09 pins it).
7. The slice states in its notes what it does not do: no claim of byte parity with the pinned Alloy 2.31.1 output. That is 064-17.

**DoD:**
- `npm test && npm run lint` and the servo quality-gate pass.
- ADR-0013's status line from 067-01 already marks the "read-minimized" claim superseded. This slice updates the code comments that repeat it.

**Consumers:** Adobe 064-17 and 064-18 onward (vendor-adobe). Not used by Google or Meta.

**Anti-horizontal-phasing check:** Vertical: option, channel feed and a real Alloy configure in the chamber rig.

## Notes

- **What shipped:** `ALLOY_DEFAULT_CONTEXT` (the stock four groups) is the connector default; `bootAlloy` collects the listed groups through 067-07's `collectStockContext` and posts `stock-context` to the chamber before `init` and again, deduped, ahead of each queued event. The chamber maps the channel onto the page shim through `connectors/alloy/stock-shim.js` (pure, Node-tested), and clears every shim field a listed group owns before applying values, so a denylisted or dropped field leaves neither a placeholder nor a stale value.
- **What it does not do (AC7):** no claim of byte parity with the pinned Alloy 2.31.1 output. Per-field fidelity, the apex probe and recorded before-state seeding stay with Adobe 064-17, as does removing the remaining shim stand-ins on `vendor-adobe` (spec 067 section 8, check 11).
- **Governance:** the channel honors `payloadDenylist` and `payloadDenylistOverride`. The interact body still passes the seam strip (067-09/067-10).

### Deviation log

- **`toXdm` falls back to the 2-field mapping when the event carries no `xdm`, and only with the fields present** (no `airlock.example`/`airlock` placeholders that would override Alloy's channel-fed URL). Forwarding "the site xdm" with nothing to forward would break the composite `page_view` fan-out, which sends only `page_location`/`page_title`. `minimalXdm: true` forces the 2-field mapping even when `xdm` is supplied; `bootAlloy` forwards the option.
- **`bootAlloy` re-collects per queued event, not on DOM listeners.** The collection runs inside the serialized queue, never in a capture handler (ADR-0002), and covers SPA navigation without `pushState` hooks.
- **The default `location` placeholder stays when the web group is unset.** Alloy's apex-domain probe and cookie scope read `location.hostname`; changing that is 064-17's apex work. Screen, viewport, referrer, title, pixel ratio and the rest of the location placeholders are cleared.
- **The chamber worker itself has no Node test.** The mapping and the apply step it calls (`shimValuesFromStockContext`, `applyStockContextToShims`) are unit-tested with plain objects, and the real-bundle browser run stays with 064-17.
- **Hand-off to 064-17:** `location.href` is cleared while `origin/hostname` stay; if the pinned Alloy web collector falls back to the `location` object when `href` is missing, a page that denylists `url` would send a serialized location as `URL`. Verify against the 2.31.1 bytes.
- **An all-empty collection is not re-posted** (the last non-empty context stays in the chamber); unreachable while `placeContext` is listed.
- **Open item, not collected:** high-entropy client hints (async), as noted in 067-07. Alloy only requests them when `highEntropyUserAgentHints` is configured; follow-up for 064-17.

### Reconciliation sweep

Round 1 found four mediums (per-field clearing, stale values, `minimalXdm` forwarding, xdm placeholders) plus craft test gaps; all fixed in 956c8bee. Round 2 found one medium (navigator fields not cleared; the proxy falls back to its own placeholder), fixed by setting owned navigator keys to an own `undefined`. Shipped matches AC1-7; deviations are logged above.
