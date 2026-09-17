# Learnings

> Status: Draft (wizard-generated)
>
> Dead ends, failed approaches, and "we tried X and here's why it didn't work."
> The institutional memory that ADRs don't capture — these are not decisions,
> they're anti-patterns and gotchas discovered in practice.
>
> Update via `/jig:memory-sync` during reconciliation.

<!-- Learnings below. Format: ## Title, followed by what happened and what to do instead. -->

## Ad connectors are worker-chamber gtag-family connectors — boot = mirror spec 041, not main-thread remap
connectors/google-ads/ + connectors/floodlight/ are {manifest,init,handle} gtag-family connectors hosted via core/connector-host.js (like ga4-gtag/pixel) — their STEADY-STATE beacon is mapped OFF-THREAD in a worker chamber. createGoogleAdsRemap/createFloodlightRemap cover ONLY the seal's held->grant-flush re-map, NOT the steady-state producer. Their seal tests (test/*-seal.test.js) SIMULATE the chamber's ready output via FakeWorker, which HIDES the chamber requirement. So booting one = mirror spec 041 (ga4-gtag): a core/<c>-chamber.worker.js + core/confine-<c>-chamber.js (withholdFetch) + a core/airlock.js connector: branch (Worker-URL + init + requestMapper) + a build.mjs WORKER_ENTRIES entry — NOT a main-thread remap seam. The 048-01 frame-critique caught this exact wrong assumption before implementation; spec 048 built all of it (bootGoogleAds/bootFloodlight).

## OneTrust composite consent: sole-subscriber-by-construction, not via the driver idempotency guard
When wiring OneTrust (or any consent-input driver) into a boot(config) composite: the composite must be the SOLE subscriber, guaranteed BY CONSTRUCTION (boot(config) strips any per-connector onetrust from a connector entry + never threads config.onetrust to a sub-boot + subscribes ONCE after createComposite). Do NOT rely on subscribeOnetrustConsentChanges's idempotency guard for precedence — it is first-writer-wins keyed on OBJECT IDENTITY, and boot(config) builds sub-boots BEFORE createComposite exists, so a per-connector subscription would register first and the composite subscription would no-op, STRANDING the ad beacons. Full rationale + rejected alternative in ADR-0027 (spec 048-03).

## Developer-provable rewire demo: Chrome Overrides on prod + inline suppressor (NOT aem.live)
Spec 050's suppress-side is demonstrated on REAL prod erp.intuit.com via Chrome Local Overrides (no deploy, no container-owner — ADR-0029 realized), NOT on aem.live. (1) aem.live previews are OneTrust-domain-locked to intuit.com -> window.OneTrust never inits -> consent never resolves -> utag + the four native tags never load; a simulated OptanonConsent cookie loads utag but Tealium's own gate stays shut (utag.gdpr.getConsentState()===0). aem.live can show airlock EMITTING (consent granted via window.airlock.setConsent) but not native SUPPRESSION. (2) Chrome Local Overrides won't serve NEW-path files (airlock-gate.js, the dist) on an AEM app-shell host — they return the text/html app-shell — so inline the REAL suppressor into the ONE file Chrome does override (scripts.js). Result (2026-09-16, same host, granted consent): native / fires all four (129 resources); ?martech=airlock suppresses all four + their 9 beacons, tail intact (94). Evidence: spec 050-01 § Validation evidence.

## airlock boot does NOT auto-capture a page_view (push-driven)
adapters/eds/index.js: 'Boot still does NOT auto-capture a page_view.' A config-booted airlock (boot({connectors,...})) emits nothing until the host pushes an event: window.airlock.push({ event:'page_view', page_location, page_title }). Symptom when missing: airlock boots (window.airlock present, full API) but stats.dispatched=0 and no beacons. Found live while wiring spec 050 (intuit-erp airlock-gate.js). The native gtag auto-fires page_view; the adopter's rewire wiring must push the equivalent AFTER boot. Held under pending/denied consent, flushed on grant + flushNow (MVP8 accept-flow).

## Validate martech on auth-gated hosts by driving the user's authed browser (Chrome MCP)
aem.live previews return 401 (Adobe/AEM access control), so headless chrome-launcher rigs can't reach them. To validate a live arm, drive the USER's authenticated Chrome via the claude-in-chrome MCP: list_connected_browsers -> pick the inUse session -> navigate + javascript_tool to capture performance.getEntriesByType('resource') + window.airlock.stats()/getState(). Gotcha: read_console_messages only starts tracking on first call (arm it before the load, or rely on network/perf evidence — the MCP also redacts cookie/query strings in URLs, so read host+pathname via new URL()). This is how spec 050's live suppress+emit was validated (2026-09-16).
