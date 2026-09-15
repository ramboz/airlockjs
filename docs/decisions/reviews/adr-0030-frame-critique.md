---
adr: 0030
pass: frame-critique
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-09-15T15:03:26Z
prompt_source: review.py frame-critique docs/decisions/adr-0030-native-tag-suppressor.md
---

Frame-critique pass on **ADR-0030** — two rounds, reviewer `jig:reviewer`, prompt built via
`review.py frame-critique docs/decisions/adr-0030-native-tag-suppressor.md`.

**Round 1 (cold read) — verdict: needs-changes.** The core decision (ship a vendor-generic runtime+beacon suppressor from
airlock's adopter-facing layer; block the runtime not just the beacon) is sound and grounded. But the "**block by declared
host**" framing was actively wrong on this site: airlock's own GA4 egress (`www.google-analytics.com/mp/collect`,
`connectors/ga4/map.js`) shares a host with the container's GA4 gtag beacon (`…/g/collect`) — a host-scoped beacon block
would suppress airlock's **own** arm → false parity failure; and AW/GA4/Floodlight all load from one host
(`googletagmanager.com`, distinguished only by `?id=`), so host-blocking cannot express a **partial** migration (a real
possibility under ADR-0018's GA4 MP-vs-gtag kill criterion).

**Resolution applied:** URL/query-pattern granularity elevated to **first-class** across Decision / Assumptions /
Kill-criteria; added an explicit **carve-out of airlock's own arm egress** (an allow-set that wins over adopter matchers)
and a **partial-migration** requirement (matchers tight enough to hit a subset of a shared-host runtime); added a loud
per-suppression diagnostic so an over-match is visible.

**Round 2 (confirmation) — verdict: pass.** Both parts of the finding resolved and internally consistent across Decision,
Consequences, Assumptions, and Kill criteria; no new load-bearing flaw. One cosmetic leftover ("host/URL patterns" in the
Home option) corrected to "URL/query matchers." Non-blocking future note (recorded, not required): if a generic adopter
consolidates to one `gtag.js` serving multiple `?id` configs, by-query suppression could not separate them — already
covered by the existing kill criterion.

VERDICT: **pass**.
