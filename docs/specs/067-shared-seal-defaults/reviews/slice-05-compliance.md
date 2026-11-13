---
slice: 067-05: Default cookie and storage grant is the stock set
pass: compliance
verdict: pass
reviewer: claude-opus-5.5:jig:reviewer
reviewed_at: 2026-11-13T22:30:00Z
prompt_source: jig:reviewer-agent
---

Round 1 verdict was needs-changes. One MEDIUM: nothing tested that `bootAlloy` passes `cookiePurposes: ALLOY_COOKIE_PURPOSES` (AC4 on the alloy track). Fixed with a `bootAlloy` test (denied `analytics_storage` drops `kndctr_`, granted `ad_storage` keeps `demdex`). One LOW (AC6 only tested on the write side for the fixture vendor; the read seed is covered by the narrowing tests in `test/eds-boot-alloy.test.js`) is noted. The AC5 split to 067-12 was judged grounded under spec 067 check 7. No second round; the fix is covered by a test.
