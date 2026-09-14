---
slice: 048-01 — bootGoogleAds + worker chamber + `{type:"google-ads"}` config type + composite membership (consent-gated)
pass: frame-critique
verdict: pass
reviewer: jig:reviewer (frame-critique, 2-round)
reviewed_at: 2026-09-14T22:15:12Z
prompt_source: /tmp/claude-503/-Users-ramboz-Projects-misc-airlock--claude-worktrees-tealium-inp-instrumentation-17ba9c/9f678cbf-3d87-4d40-985c-9272ed2921fb/scratchpad/fc-048-01-v2.txt
---

# Frame-critique — 048-01 (bootGoogleAds + worker chamber)

**Verdict: pass** (after one needs-changes → re-scope → re-run).

## Round 1 — needs-changes (load-bearing assumption WRONG)
The DRAFT's A1 ("boot on the main-thread `remap`/seal seam, no worker chamber, no
`core/airlock.js` change") was false. `connectors/google-ads/connector.js` is a
gtag-family `{manifest,init,handle}` connector "hosted the SAME way
`core/connector-host.js` hosts GA4-gtag/pixel" (`:92`, `:103`); its steady-state
page-load beacon is mapped in a WORKER CHAMBER. `createGoogleAdsRemap` covers only
the seal's held→flush re-map. `core/airlock.js` has no `google-ads` branch → an
un-branched boot falls through to the default GA4-MP `chamber.worker.js` and emits
the WRONG beacon. The seal test (`test/google-ads-seal.test.js`) simulates the
chamber's `ready` output via FakeWorker, which hid this.

## Fix — re-scoped to mirror spec 041 (ga4-gtag chamber+boot)
Each ad-boot slice now includes: `core/<connector>-chamber.worker.js` +
`core/confine-<connector>-chamber.js` + a `core/airlock.js` `connector:` branch
(Worker URL + init + `requestMapper` case) + a `build.mjs` WORKER_ENTRIES entry,
plus the boot adapter + config type + composite membership. spec.md §A1/§A2 +
§Decomposition + slice-01 + slice-02 corrected.

## Round 2 — pass (re-scoped frame sound)
A1' (chamber+boot mirrors ga4-gtag with no new core mechanism) verified across
every dimension: `createGoogleAdsConnector(config).handle` is `requestMapper`-
compatible (`core/egress.js:120-122` reads only url/method/body, `[]` = no-op);
held→remap→flush is sound by inspection (`core/connector-host.js:75-76` preserves
`event`; `core/airlock.js:456-461` buffers `r.event` for re-map, 045-01); the
chamber/build/branch additions are mechanical (5th branch over 4 identical siblings).

## Non-blocking residuals folded in
- AC2 now lists `remap: createGoogleAdsRemap({conversionId, readCookieString})` —
  bootGoogleAds is the FIRST adapter to wire hold+remap+cookie-reader through a real
  chamber (an axis the "mirror 041" template does not cover; ga4-gtag wires none).
- AC5 notes the real-chamber rig arm proves the GRANTED steady-state GET; the
  held→remap+real-chamber combination stays source-verified (not end-to-end).
