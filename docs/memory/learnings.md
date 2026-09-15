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
