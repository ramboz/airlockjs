# Slice 065-03 completeness table (spec 065, 7.1)

Run on 2026-11-13 under the D4 amendment in section 11 (Tranco list `Y897G`, ranks 1 to 473 tried of the 500 planned, stop at 50 distinct configs). Homepages: 473 plain downloads, 207 failed to load. Script downloads: 80 in total (one per page that showed an Ads tag id or a GTM container). A container cannot be known to hold Ads tags without downloading it, so 30 of the 80 turned out to hold no Ads-scope tag or the same body as an earlier page and were dropped. No page JavaScript, no cookies, no consent clicks, one request per second.

**What counts as a config.** A served Google script body (`gtag/js?id=` for a page that names an `AW-` id, otherwise one `gtm.js` container) whose `tags` region has at least one Ads-scope tag, deduplicated by body digest. 41 of the 50 are GTM containers (the rule counts one container download as the page's script download) and 9 are `gtag/js` bodies. A GTM container is wider than a `gtag/js` config, so only tags in the Ads scope below were scanned. Four of the 50 (ranks 151, 183, 292, 311) have no `AW-` id and count only through `__gclidw` (the conversion linker). Without them the sample would be 46.

**Extraction (bounded, no execution, no full parse).** Inside the `tags` region only, split top-level tag objects by brace depth and keep tags whose `function` is `__awct`, `__sp`, `__gclidw`, `__awud`, `__dest_aw`, `__ogt_*` (ads data terms of service, auto events, 1p data, cross domain), `__ccd_*` or a `__googtag` that names an `AW-` destination. Feature = the tag function name (`tag:__x`) or one top-level key of such a tag (`__x.key`, key names only, never values). Conversion ids, labels and other tenant values were never written down.

**Classing.** Covered means a section 2 row or section 6 candidate names the same setting (the matching reference is in the column). **J** marks a judgement call: the row covers the setting in spirit but not by name. The primary rate counts J as covered, and a strict rate counts J as uncovered. Both are shown below.

## Per-config source

All 50 configs came from public homepages on the Tranco list, with the script from Google's own script host. The crawl route failed (HTTP Archive needs credentials, Common Crawl has no usable script bodies), so no config came from crawl data.

| Rank | Domain | Source |
|---|---|---|
| 42 | fastly.net | approved GET: homepage, then one `gtm.js` download |
| 51 | doubleclick.net | approved GET: homepage, then one `gtm.js` download |
| 59 | zoom.us | approved GET: homepage, then one `gtm.js` download |
| 79 | opera.com | approved GET: homepage, then one `gtm.js` download |
| 80 | b-cdn.net | approved GET: homepage, then one `gtag/js` download |
| 99 | wordpress.com | approved GET: homepage, then one `gtag/js` download |
| 115 | chatgpt.com | approved GET: homepage, then one `gtag/js` download |
| 117 | bit.ly | approved GET: homepage, then one `gtm.js` download |
| 132 | android.com | approved GET: homepage, then one `gtm.js` download |
| 151 | discord.gg | approved GET: homepage, then one `gtm.js` download |
| 165 | ubuntu.com | approved GET: homepage, then one `gtm.js` download |
| 181 | forter.com | approved GET: homepage, then one `gtm.js` download |
| 183 | discord.com | approved GET: homepage, then one `gtm.js` download |
| 192 | cnn.com | approved GET: homepage, then one `gtm.js` download |
| 210 | medium.com | approved GET: homepage, then one `gtag/js` download |
| 216 | roku.com | approved GET: homepage, then one `gtm.js` download |
| 223 | amplitude.com | approved GET: homepage, then one `gtm.js` download |
| 224 | criteo.com | approved GET: homepage, then one `gtm.js` download |
| 255 | salesforce.com | approved GET: homepage, then one `gtm.js` download |
| 259 | hubspot.com | approved GET: homepage, then one `gtm.js` download |
| 260 | cpanel.net | approved GET: homepage, then one `gtm.js` download |
| 268 | linktr.ee | approved GET: homepage, then one `gtm.js` download |
| 270 | who.int | approved GET: homepage, then one `gtm.js` download |
| 277 | datadoghq.com | approved GET: homepage, then one `gtm.js` download |
| 278 | launchdarkly.com | approved GET: homepage, then one `gtm.js` download |
| 280 | slack.com | approved GET: homepage, then one `gtm.js` download |
| 292 | nature.com | approved GET: homepage, then one `gtm.js` download |
| 304 | onelink.me | approved GET: homepage, then one `gtm.js` download |
| 309 | grammarly.com | approved GET: homepage, then one `gtm.js` download |
| 311 | springer.com | approved GET: homepage, then one `gtm.js` download |
| 316 | zendesk.com | approved GET: homepage, then one `gtm.js` download |
| 328 | vungle.com | approved GET: homepage, then one `gtag/js` download |
| 345 | chatgpt.site | approved GET: homepage, then one `gtag/js` download |
| 350 | unisys.com | approved GET: homepage, then one `gtm.js` download |
| 353 | smartadserver.com | approved GET: homepage, then one `gtm.js` download |
| 355 | okta.com | approved GET: homepage, then one `gtm.js` download |
| 359 | branch.io | approved GET: homepage, then one `gtm.js` download |
| 360 | tradingview.com | approved GET: homepage, then one `gtag/js` download |
| 364 | dynatrace.com | approved GET: homepage, then one `gtm.js` download |
| 366 | checkpoint.com | approved GET: homepage, then one `gtm.js` download |
| 386 | globo.com | approved GET: homepage, then one `gtag/js` download |
| 400 | name.com | approved GET: homepage, then one `gtm.js` download |
| 404 | bloomberg.com | approved GET: homepage, then one `gtm.js` download |
| 412 | washingtonpost.com | approved GET: homepage, then one `gtm.js` download |
| 417 | plesk.com | approved GET: homepage, then one `gtm.js` download |
| 423 | calendly.com | approved GET: homepage, then one `gtm.js` download |
| 424 | substack.com | approved GET: homepage, then one `gtag/js` download |
| 455 | appsflyer.com | approved GET: homepage, then one `gtm.js` download |
| 467 | duolingo.com | approved GET: homepage, then one `gtm.js` download |
| 473 | braze.com | approved GET: homepage, then one `gtm.js` download |

## Totals

| Measure | Primary (J covered) | Strict (J uncovered) |
|---|---|---|
| Distinct features | 135 | 135 |
| Covered | 125 | 83 |
| Uncovered | 10 | 52 |
| Feature-level rate | 7.4% | 38.5% |
| Sites sampled | 50 | 50 |
| Sites with an uncovered feature | 31 | 50 |
| Site-level rate | 62% | 100% |
| Sites not covered by the combined state (information only) | at least 31 of 50 not covered | 50 of 50 not covered |

The not-covered count is a lower bound: a site with an uncovered feature cannot be covered by the combined state, and nothing here measures whether the combined state covers a site that has none.

## Features

| Feature (config key or flag slot) | Sites seen | Covered by | Class | Notes |
|---|---|---|---|---|
| `__awct.vtp_enableSmartDestinationId` | 1 | - | uncovered | smart destination id is not named |
| `__awud.vtp_enableUnusedConversionLinkerRemoval` | 9 | - | uncovered | unused-linker removal is not named |
| `__ccd_ads_conv_marking.vtp_conversionRules` | 5 | - | uncovered | URL-rule conversion marking is not named in 2 or 6 |
| `__ccd_ads_conv_marking.vtp_instanceDestinationId` | 5 | - | uncovered | URL-rule conversion marking is not named in 2 or 6 |
| `__ogt_ads_datatos.vtp_instanceDestinationId` | 8 | - | uncovered | Ads data terms-of-service flag is not named |
| `__sp.vtp_enableSmartDestinationId` | 1 | - | uncovered | smart destination id is not named |
| `__sp.vtp_enableUserId` | 18 | - | uncovered | remarketing user id is not named |
| `__sp.vtp_userId` | 1 | - | uncovered | remarketing user id is not named |
| `tag:__ccd_ads_conv_marking` | 5 | - | uncovered | URL-rule conversion marking is not named in 2 or 6 |
| `tag:__ogt_ads_datatos` | 8 | - | uncovered | Ads data terms-of-service flag is not named |
| `__awct.once_per_event` | 33 | 2.1 row 9 (counting and duplicate behavior) | covered (J) | tag firing-count flag |
| `__awct.once_per_load` | 11 | 2.1 row 9 (counting and duplicate behavior) | covered (J) | tag firing-count flag |
| `__awct.vtp_awNewCustomer` | 1 | S15 C6; 2.1 row 9 | covered |  |
| `__awct.vtp_conversionCookiePrefix` | 32 | 2.1 rows 6, 15; S15 C4 | covered |  |
| `__awct.vtp_conversionId` | 34 | 2.1 row 2 | covered |  |
| `__awct.vtp_conversionLabel` | 34 | 2.1 row 2 | covered |  |
| `__awct.vtp_conversionValue` | 10 | 2.1 row 2 | covered |  |
| `__awct.vtp_cssProvidedEnhancedConversionValue` | 15 | S15 C1; 2.1 row 10 | covered |  |
| `__awct.vtp_currencyCode` | 6 | 2.1 row 2 | covered |  |
| `__awct.vtp_enableConversionLinker` | 34 | 2.1 rows 6, 15; S15 C4 | covered |  |
| `__awct.vtp_enableCustomParams` | 34 | 2.1 rows 1, 2, 9 (custom variables, params) | covered (J) | generic parameter tables |
| `__awct.vtp_enableCustomerLifecycleReporting` | 28 | 2.3 key customer_lifetime_value | covered (J) | toggle name differs from key |
| `__awct.vtp_enableEnhancedConversion` | 27 | S15 C1; 2.1 row 10 | covered |  |
| `__awct.vtp_enableEnhancedConversions` | 1 | S15 C1; 2.1 row 10 | covered |  |
| `__awct.vtp_enableEnhancedConversionsCheckbox` | 34 | S15 C1; 2.1 row 10 | covered |  |
| `__awct.vtp_enableEventParameters` | 33 | 2.1 rows 1, 2, 9 (custom variables, params) | covered (J) | generic parameter tables |
| `__awct.vtp_enableNewCustomerReporting` | 32 | S15 C6; 2.1 row 9 | covered |  |
| `__awct.vtp_enableNewCustomerReportingCheckbox` | 34 | S15 C6; 2.1 row 9 | covered |  |
| `__awct.vtp_enableProductReporting` | 33 | 2.1 row 9 (cart data) | covered (J) | toggle name differs from key |
| `__awct.vtp_enableProductReportingCheckbox` | 34 | 2.1 row 9 (cart data) | covered (J) | toggle name differs from key |
| `__awct.vtp_enableRdpCheckbox` | 34 | 2.3 key restricted_data_processing | covered |  |
| `__awct.vtp_enableShippingData` | 32 | 2.3 key shipping; 2.1 row 9 | covered |  |
| `__awct.vtp_enableTransportUrl` | 34 | 2.1 row 19 (transport_url) | covered |  |
| `__awct.vtp_eventSettingsTable` | 4 | 2.1 rows 1, 2, 9 (custom variables, params) | covered (J) | generic parameter tables |
| `__awct.vtp_items` | 1 | 2.1 row 9 | covered |  |
| `__awct.vtp_newCustomerReportingDataSource` | 1 | S15 C6; 2.1 row 9 | covered |  |
| `__awct.vtp_orderId` | 4 | 2.1 row 2 | covered |  |
| `__awct.vtp_productReportingDataSource` | 2 | 2.1 row 9 (cart data) | covered (J) | toggle name differs from key |
| `__awct.vtp_rdp` | 33 | 2.3 key restricted_data_processing | covered |  |
| `__awct.vtp_url` | 34 | 2.1 row 2 (page_location) | covered |  |
| `__awud.once_per_event` | 9 | 2.1 row 9 (counting and duplicate behavior) | covered (J) | tag firing-count flag |
| `__awud.vtp_conversionCookiePrefix` | 6 | 2.1 rows 6, 15; S15 C4 | covered |  |
| `__awud.vtp_conversionId` | 9 | 2.1 row 2 | covered |  |
| `__awud.vtp_enableConversionLinker` | 9 | 2.1 rows 6, 15; S15 C4 | covered |  |
| `__awud.vtp_enableEventParameters` | 9 | 2.1 rows 1, 2, 9 (custom variables, params) | covered (J) | generic parameter tables |
| `__awud.vtp_eventSettingsTable` | 2 | 2.1 rows 1, 2, 9 (custom variables, params) | covered (J) | generic parameter tables |
| `__awud.vtp_userDataVariable` | 9 | 2.1 row 10 | covered |  |
| `__ccd_add_1p_data.vtp_acceptAutomatic` | 9 | 2.3 keys ccd_add_1p_data, ccd_enable_cm; C1, C3 | covered |  |
| `__ccd_add_1p_data.vtp_acceptCode` | 9 | 2.3 keys ccd_add_1p_data, ccd_enable_cm; C1, C3 | covered |  |
| `__ccd_add_1p_data.vtp_acceptManualSelector` | 9 | 2.3 keys ccd_add_1p_data, ccd_enable_cm; C1, C3 | covered |  |
| `__ccd_add_1p_data.vtp_acceptUserData` | 9 | 2.3 keys ccd_add_1p_data, ccd_enable_cm; C1, C3 | covered |  |
| `__ccd_add_1p_data.vtp_instanceDestinationId` | 9 | 2.3 container tags; 2.1 row 1 | covered |  |
| `__ccd_add_1p_data.vtp_matchingRules` | 9 | 2.3 keys ccd_add_1p_data, ccd_enable_cm; C1, C3 | covered |  |
| `__ccd_ads_first.vtp_instanceDestinationId` | 11 | 2.3 container tags; 2.1 row 1 | covered |  |
| `__ccd_ads_last.vtp_instanceDestinationId` | 11 | 2.3 container tags; 2.1 row 1 | covered |  |
| `__ccd_em_form.vtp_includeParams` | 8 | 2.1 rows 11, 17 (uncertain) | covered (J) | mapping uncertain: could be enhanced matching (row 11) or measurement (row 17). If uncovered, the primary feature rate would be 13.3% |
| `__ccd_em_form.vtp_instanceDestinationId` | 8 | 2.1 rows 11, 17 (uncertain) | covered (J) | mapping uncertain: could be enhanced matching (row 11) or measurement (row 17). If uncovered, the primary feature rate would be 13.3% |
| `__ccd_em_page_view.vtp_deferPageView` | 4 | 2.1 rows 11, 17 (uncertain) | covered (J) | mapping uncertain: could be enhanced matching (row 11) or measurement (row 17). If uncovered, the primary feature rate would be 13.3% |
| `__ccd_em_page_view.vtp_historyEvents` | 7 | 2.1 rows 11, 17 (uncertain) | covered (J) | mapping uncertain: could be enhanced matching (row 11) or measurement (row 17). If uncovered, the primary feature rate would be 13.3% |
| `__ccd_em_page_view.vtp_includeParams` | 7 | 2.1 rows 11, 17 (uncertain) | covered (J) | mapping uncertain: could be enhanced matching (row 11) or measurement (row 17). If uncovered, the primary feature rate would be 13.3% |
| `__ccd_em_page_view.vtp_instanceDestinationId` | 7 | 2.1 rows 11, 17 (uncertain) | covered (J) | mapping uncertain: could be enhanced matching (row 11) or measurement (row 17). If uncovered, the primary feature rate would be 13.3% |
| `__ccd_enable_cm.vtp_instanceDestinationId` | 8 | 2.1 rows 11, 17 (uncertain) | covered (J) | mapping uncertain: could be enhanced matching (row 11) or measurement (row 17). If uncovered, the primary feature rate would be 13.3% |
| `__ccd_pre_auto_pii.vtp_instanceDestinationId` | 9 | 2.1 rows 11, 17 (uncertain) | covered (J) | mapping uncertain: could be enhanced matching (row 11) or measurement (row 17). If uncovered, the primary feature rate would be 13.3% |
| `__dest_aw.vtp_configSettingsTable` | 2 | 2.1 rows 1, 2, 9 (custom variables, params) | covered (J) | generic parameter tables |
| `__dest_aw.vtp_destinationId` | 11 | 2.3 container tags | covered |  |
| `__dest_aw.vtp_enableVariablesInDestinationId` | 11 | 2.1 row 1 | covered (J) | destination id handling |
| `__dest_aw.vtp_ignoreDupeGtagConfigCalls` | 9 | 2.3 container tags | covered |  |
| `__gclidw.once_per_event` | 28 | 2.1 row 9 (counting and duplicate behavior) | covered (J) | tag firing-count flag |
| `__gclidw.once_per_load` | 7 | 2.1 row 9 (counting and duplicate behavior) | covered (J) | tag firing-count flag |
| `__gclidw.vtp_acceptIncoming` | 9 | 2.1 row 7 | covered |  |
| `__gclidw.vtp_enableCookieOverrides` | 35 | 2.1 row 15 | covered |  |
| `__gclidw.vtp_enableCrossDomain` | 35 | 2.1 row 7 | covered |  |
| `__gclidw.vtp_enableCrossDomainFeature` | 3 | 2.1 row 7 | covered |  |
| `__gclidw.vtp_enableUrlPassthrough` | 34 | 2.1 row 7 | covered |  |
| `__gclidw.vtp_formDecoration` | 9 | 2.1 row 7 | covered |  |
| `__gclidw.vtp_linkerDomains` | 11 | 2.1 row 7 | covered |  |
| `__gclidw.vtp_urlPosition` | 9 | 2.1 row 7 | covered |  |
| `__googtag.once_per_event` | 16 | 2.1 row 9 (counting and duplicate behavior) | covered (J) | tag firing-count flag |
| `__googtag.once_per_load` | 3 | 2.1 row 9 (counting and duplicate behavior) | covered (J) | tag firing-count flag |
| `__googtag.vtp_configSettingsVariable` | 1 | 2.1 rows 1, 2, 9 (custom variables, params) | covered (J) | generic parameter tables |
| `__googtag.vtp_eventSettingsTable` | 1 | 2.1 rows 1, 2, 9 (custom variables, params) | covered (J) | generic parameter tables |
| `__googtag.vtp_eventSettingsVariable` | 1 | 2.1 rows 1, 2, 9 (custom variables, params) | covered (J) | generic parameter tables |
| `__googtag.vtp_tagId` | 22 | 2.1 row 1 | covered |  |
| `__ogt_1p_data_v2.vtp_autoAddressEnabled` | 8 | 2.3 container tag __ogt_1p_data_v2; C1, C3 | covered |  |
| `__ogt_1p_data_v2.vtp_autoCollectExclusionSelectors` | 8 | S15 C3 (exclusions) | covered |  |
| `__ogt_1p_data_v2.vtp_autoEmailEnabled` | 8 | 2.3 container tag __ogt_1p_data_v2; C1, C3 | covered |  |
| `__ogt_1p_data_v2.vtp_autoPhoneEnabled` | 8 | 2.3 container tag __ogt_1p_data_v2; C1, C3 | covered |  |
| `__ogt_1p_data_v2.vtp_emailValue` | 2 | 2.1 row 11 (selector collection) | covered |  |
| `__ogt_1p_data_v2.vtp_isAutoCollectPiiEnabledFlag` | 11 | 2.1 row 11 | covered (J) | flag slot of automatic detection |
| `__ogt_1p_data_v2.vtp_isAutoEnabled` | 10 | 2.3 container tag __ogt_1p_data_v2; C1, C3 | covered |  |
| `__ogt_1p_data_v2.vtp_isEnabled` | 11 | 2.3 container tag __ogt_1p_data_v2; C1, C3 | covered |  |
| `__ogt_1p_data_v2.vtp_isManualEnabled` | 10 | 2.3 container tag __ogt_1p_data_v2; C1, C3 | covered |  |
| `__ogt_1p_data_v2.vtp_manualAddressEnabled` | 2 | 2.3 container tag __ogt_1p_data_v2; C1, C3 | covered |  |
| `__ogt_1p_data_v2.vtp_manualEmailEnabled` | 2 | 2.3 container tag __ogt_1p_data_v2; C1, C3 | covered |  |
| `__ogt_1p_data_v2.vtp_manualPhoneEnabled` | 2 | 2.3 container tag __ogt_1p_data_v2; C1, C3 | covered |  |
| `__ogt_auto_events.vtp_enableDownload` | 11 | 2.1 row 17 | covered |  |
| `__ogt_auto_events.vtp_enableForm` | 11 | 2.1 row 17 | covered |  |
| `__ogt_auto_events.vtp_enableHistoryEvents` | 11 | 2.1 row 17 | covered |  |
| `__ogt_auto_events.vtp_enableInPageEventsHidden` | 11 | 2.1 row 17 | covered (J) | UI-only switches |
| `__ogt_auto_events.vtp_enableOutboundClick` | 11 | 2.1 row 17 | covered |  |
| `__ogt_auto_events.vtp_enablePageView` | 9 | 2.1 row 17 | covered |  |
| `__ogt_auto_events.vtp_enableScroll` | 11 | 2.1 row 17 | covered |  |
| `__ogt_auto_events.vtp_enableVideo` | 11 | 2.1 row 17 | covered |  |
| `__ogt_auto_events.vtp_hidePageViewToggle` | 8 | 2.1 row 17 | covered (J) | UI-only switches |
| `__ogt_cross_domain.vtp_rules` | 2 | 2.1 row 7 | covered |  |
| `__sp.once_per_event` | 16 | 2.1 row 9 (counting and duplicate behavior) | covered (J) | tag firing-count flag |
| `__sp.once_per_load` | 4 | 2.1 row 9 (counting and duplicate behavior) | covered (J) | tag firing-count flag |
| `__sp.vtp_conversionCookiePrefix` | 13 | 2.1 rows 6, 15; S15 C4 | covered |  |
| `__sp.vtp_conversionId` | 18 | 2.1 row 8 | covered |  |
| `__sp.vtp_conversionLabel` | 4 | 2.1 row 8 | covered |  |
| `__sp.vtp_customParamsFormat` | 18 | 2.1 rows 1, 2, 9 (custom variables, params) | covered (J) | generic parameter tables |
| `__sp.vtp_enableConversionLinker` | 14 | 2.1 rows 6, 15; S15 C4 | covered |  |
| `__sp.vtp_enableDynamicRemarketing` | 18 | 2.1 row 8 | covered (J) | remarketing toggles |
| `__sp.vtp_enableEventParameters` | 18 | 2.1 rows 1, 2, 9 (custom variables, params) | covered (J) | generic parameter tables |
| `__sp.vtp_enableOgtRmktParams` | 18 | 2.1 row 8 | covered (J) | remarketing toggles |
| `__sp.vtp_enableRdpCheckbox` | 18 | 2.3 key restricted_data_processing | covered |  |
| `__sp.vtp_eventSettingsTable` | 1 | 2.1 rows 1, 2, 9 (custom variables, params) | covered (J) | generic parameter tables |
| `__sp.vtp_rdp` | 16 | 2.3 key restricted_data_processing | covered |  |
| `__sp.vtp_url` | 18 | 2.1 row 2 (page_location) | covered |  |
| `tag:__awct` | 34 | 2.1 row 2 | covered |  |
| `tag:__awud` | 9 | 2.1 row 10 | covered |  |
| `tag:__ccd_add_1p_data` | 9 | 2.3 keys ccd_add_1p_data, ccd_enable_cm; C1, C3 | covered |  |
| `tag:__ccd_ads_first` | 11 | 2.3 container tags | covered |  |
| `tag:__ccd_ads_last` | 11 | 2.3 container tags | covered |  |
| `tag:__ccd_em_form` | 8 | 2.1 rows 11, 17 (uncertain) | covered (J) | mapping uncertain: could be enhanced matching (row 11) or measurement (row 17). If uncovered, the primary feature rate would be 13.3% |
| `tag:__ccd_em_page_view` | 7 | 2.1 rows 11, 17 (uncertain) | covered (J) | mapping uncertain: could be enhanced matching (row 11) or measurement (row 17). If uncovered, the primary feature rate would be 13.3% |
| `tag:__ccd_enable_cm` | 8 | 2.3 keys ccd_add_1p_data, ccd_enable_cm; C1, C3 | covered |  |
| `tag:__ccd_pre_auto_pii` | 9 | 2.1 rows 11, 17 (uncertain) | covered (J) | mapping uncertain: could be enhanced matching (row 11) or measurement (row 17). If uncovered, the primary feature rate would be 13.3% |
| `tag:__dest_aw` | 11 | 2.3 container tags | covered |  |
| `tag:__gclidw` | 35 | 2.1 row 6 | covered |  |
| `tag:__googtag` | 22 | 2.1 row 1 | covered |  |
| `tag:__ogt_1p_data_v2` | 11 | 2.3 keys ccd_add_1p_data, ccd_enable_cm; C1, C3 | covered |  |
| `tag:__ogt_auto_events` | 11 | 2.1 row 17 | covered |  |
| `tag:__ogt_cross_domain` | 2 | 2.1 row 7 | covered |  |
| `tag:__sp` | 18 | 2.1 row 8 | covered |  |
