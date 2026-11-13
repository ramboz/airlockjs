---
status: READY_FOR_IMPLEMENTATION
dependencies: [065-01, 065-02]
last_verified: 2026-11-13
---

## Slice 065-03: T3: Completeness probe on real configs

**Goal:** Run the completeness probe of 7.1: acquire at least 50 distinct Ads/gtag configs, compute the feature-level and site-level out-of-inventory rates, and give a verdict against the threshold. The freeze waits for it.

**DoR:**
- T1 and T2 done.
- D4 approved by the owner on 2026-11-13, and recorded in section 11. Public crawl data comes first.
- If crawl data cannot reach 50 configs, stop and ask the owner, via the coordinator, for a list of public pages. Each page is added to section 11 with its date before any GET.

**Acceptance Criteria:**

1. Sample of at least 50 distinct configs, with the source (crawl or approved GET) recorded per config. No page JavaScript, cookies or consent clicks.
2. Features are extracted by a bounded scan of the config region and classed covered or uncovered against sections 2 and 6.
3. Both rates are reported with the verdict. Above 10% feature-level or 25% site-level is kill criterion 6: stop and report to the owner before the freeze.
4. The share of sites not covered by the combined state is reported for information only.

**DoD:**
- Section 7.1 value filled in (it says not measured) and section 11 lists any approved page.
- `npm run lint` passes. Spec lint passes.

**Source:** spec 065 section 9 and the owner answers in section 12.
