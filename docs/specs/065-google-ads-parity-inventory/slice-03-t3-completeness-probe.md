---
status: DONE
dependencies: [065-01, 065-02]
last_verified: 2026-11-13
---

## Slice 065-03: T3: Completeness probe on real configs

**Goal:** Run the completeness probe of 7.1: acquire at least 50 distinct Ads/gtag configs, compute the feature-level and site-level out-of-inventory rates, and give a verdict against the threshold. The freeze waits for it.

**DoR:**
- T1 and T2 done.
- D4 approved by the owner on 2026-11-13, and recorded in section 11. Public crawl data comes first.
- If crawl data cannot reach 50 configs, stop and ask the owner, via the coordinator, for a list of public pages. Each page is added to section 11 with its date before any GET. (Done 2026-11-13: the owner approved a ranked-list rule instead, recorded as the D4 amendment in section 11.)

**Acceptance Criteria:**

1. Sample of at least 50 distinct configs, with the source (crawl or approved GET) recorded per config. No page JavaScript, cookies or consent clicks.
2. Features are extracted by a bounded scan of the config region and classed covered or uncovered against sections 2 and 6.
3. Both rates are reported with the verdict. Above 10% feature-level or 25% site-level is kill criterion 6: stop and report to the owner before the freeze.
4. The share of sites not covered by the combined state is reported for information only.

**DoD:**
- Section 7.1 value filled in (it says not measured) and section 11 lists any approved page.
- `npm run lint` passes. Spec lint passes.

**Source:** spec 065 section 9 and the owner answers in section 12.

### Deviation log

- The crawl route failed, so every config came from the approved single downloads under the D4 amendment (Tranco `Y897G`, 473 of 500 homepages, stop at 50). Detail in 7.1 and `t3-completeness-table.md`.
- 80 script downloads were needed for the 50 configs, because a GTM container cannot be known to hold Ads tags before it is downloaded. The amendment allowed one container download per page, and the run stayed within that.
- Verdict: kill criterion 6 tripped on the site-level rate (62% primary, 100% strict). Feature-level 7.4% primary, 38.5% strict. The freeze waits for the owner. No new inventory rows were added. The 5 uncovered groups would exceed kill criterion 4 if added.

### Reconciliation sweep

- Spec 7.1 filled (table, totals, kill criterion value), 11 and 12 D4 carry the dated amendment, 13 notes the run. Full table and per-config sources in `t3-completeness-table.md`, planned pages in `t3-planned-pages.csv`. No ADR change. Kill criterion 6 tripped, so the freeze waits for the owner.
