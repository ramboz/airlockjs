---
status: IN_PROGRESS
dependencies: [067-01]
last_verified: 2026-11-13
claimed_by: 067-07-stock-context-channel
---

## Slice 067-07: The stock-context channel

**Goal:** The main thread collects what a stock tag would read from the page (URL, referrer, screen, viewport, user agent and client hints, time zone and local time, and the like) and sends it across the airlock to the chamber on a new host-collected channel. The channel is separate from the projection snapshot, which stays default-deny. The worker no longer has to fake page values.

**DoR:**
- ✅ ADR-0062 point 2. ADR-0003's default direction (:60-63) and kill criterion (:157-159) stand. ADR-0014: the chamber has no DOM.
- Boundary with 064-17 (spec 067 section 4): this slice owns the channel and the collection API. It does not own per-field fidelity against the pinned Alloy 2.31.1 bytes.
- Ground first: how the snapshot slice is built and posted (`core/airlock.js` projection and drain, `core/chamber.worker.js`), and how `core/wrapped-sdk-host.js` shims `window` and `document` today (the hard-coded `airlock.example`, 1280x800 and `en-US` values named in 064-17).

**Acceptance Criteria:**

1. A host-side collector returns a plain, structured-cloneable object of named groups (for example `web`, `device`, `environment`, `placeContext`, each a flat record). The group names are vendor-neutral. Each vendor maps groups to its own fields (067-08 for Alloy).
2. The collected context crosses the airlock on a dedicated message type, not inside the snapshot. A test proves the snapshot's content and default-deny behavior are byte-identical with and without the channel.
3. The channel is collected once at boot and again on the events that change it (navigation, viewport, visibility), without adding work to the interaction path. Collection is off the capture path (ADR-0002 O(1)).
4. A site narrows the channel with explicit config (a list of groups). Value governance (ADR-0003:98-106) and the credentials denylist apply to the channel as opt-in controls and as the default denylist respectively: a credentials-named field never crosses.
5. The chamber side exposes the received context to the connector host through one read function, and an unset channel returns an explicit empty value, not a fake page.
6. The channel does not itself send anything to a vendor. Consent hold and endpoint ceiling still gate egress, so collecting before consent leaks nothing.
7. Measured cost: a rig run reports INP and LCP with and without collection, and the numbers go into the slice notes. A measurable regression triggers ADR-0062's kill criterion: revisit how it is collected, not the rule.
8. Tests cover the stock-default path (all groups) and the narrowed opt-in as separate states.

**DoD:**
- `npm test && npm run lint` and the servo quality-gate pass.
- architecture.md lists the channel next to the projection snapshot (builds on 067-01's rewording).

**Consumers:** Adobe 064-17 (vendor-adobe), via 067-08. Google and Meta name no need today (spec 067 section 8, check 4).

**Anti-horizontal-phasing check:** Vertical: collector, message type, chamber read function and a measured rig run.

## Notes

**What shipped.** `core/stock-context.js` (collector, chamber-side store), a `stockContext` option on `createAirlock`, and `readStockContext()` / `acceptStockContext()` on `createConnectorHost` (wired into the default GA4 chamber). Tests are in `test/stock-context.test.js`.

**The channel shape, for 067-08 and Adobe 064-17.**
- Wire message: `{ type: "stock-context", context }`. It is posted after `init` and before any event batch, and again only when the context changed (the clock sample alone never triggers a re-send).
- `context` has up to four groups, each a flat record. A field the page can't supply is left out, never faked.
  - `web`: `url`, `origin`, `protocol`, `host`, `hostname`, `pathname`, `search`, `hash`, `referrer`, `title`.
  - `device`: `screenWidth`, `screenHeight`, `screenOrientation`, `colorDepth`, `pixelRatio`.
  - `environment`: `viewportWidth`, `viewportHeight`, `userAgent`, `language`, `languages`, `cookieEnabled`, `doNotTrack`, `platform`, `mobile`, `brands` (`"Brand/version"` strings, low-entropy client hints only).
  - `placeContext`: `localTime` (ISO 8601 with offset, a sample from the last collection), `timezoneOffset` (minutes), `timeZone`.
- Option: `stockContext: true` is the stock default (all groups). `{ groups: [...], denylist: [...] }` narrows it. A denylist entry is a bare field name or a `group.field` path. The built-in credentials denylist always applies.
- The option is off unless a caller sets it, so existing connectors see no change. 067-08 turns it on for Alloy.
- Chamber side: `host.readStockContext()` returns a frozen object, `{}` when nothing arrived. For a worker that doesn't use `createConnectorHost`, `createStockContextStore()` gives the same read.
- Not covered here: high-entropy client hints (async), and per-field fidelity against Alloy 2.31.1 (064-17).

**Measured cost (AC7, spec 067 section 8 item 6).** Chromium (Playwright), `rig/harness.html` in worker mode, 5 trackers, 8 alternating runs of 40 trusted clicks each (`npm run rig:stock-context-cost`):
- Collection: 0.039 ms mean per call over 2000 calls (p99 0.3 ms, max 0.4 ms). It runs at boot and on debounced change events, never in a capture handler.
- INP-style interaction latency (p98): 8 ms with and without. No difference.
- LCP: 20 ms median with and without (p90 48 ms without, 24 ms with, which is run noise).
- Verdict: no measurable regression, so ADR-0062's kill criterion doesn't trip. The harness page is tiny, so this bounds the collector's own cost, not a heavy real page. The open question is a real EDS page with a large DOM, since `document.title` and `location` reads are cheap but resize storms are not covered by this rig.
