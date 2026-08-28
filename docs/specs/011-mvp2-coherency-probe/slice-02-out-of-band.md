---
status: DRAFT
kind: spike
dependencies: [011-01]
last_verified:
frame_review: true
---

<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about
     runnable surfaces by probe first (run it / read source) or a citation. -->

## Slice 011-02 — out-of-band write coherency

**Goal:** The coherency rig from 011-01 is extended with the out-of-band
cookie-mutation sources OQ9 names — writes to the shared first-party identity
cookie from **outside any chamber**: a main-thread `document.cookie` write (by
another first-party script), a second-tab write, and a same-origin server
`Set-Cookie` (cross-site as a negative boundary) — each driven deterministically,
and reports the staleness window each opens in a chamber's sync-cache.

**Scope vs 011-01 (what this slice adds).** 011-01 covers **in-band** writes —
the chambers' own writes of the identity cookie (e.g. Alloy persisting `AMCV_*`
from the Edge response body, the R-004 pattern), concurrent across two chambers.
011-02 is disjoint: it covers writes the chambers do **not** make — a host-side
script, another tab, a first-party server — which the broker must detect and
propagate. Together they cover the write's full provenance.

**Question:** When the authoritative cookie jar is mutated **outside** any
chamber — by a network `Set-Cookie`, a main-thread write, or another tab — how
stale does a chamber's synchronous cached view become, and for how long, given
async write-back and no cross-thread shared memory?

**Time-box:** ~1 day. Reuse the 011-01 rig; add one driver per out-of-band
source. Stop when each source has a characterized staleness window.

**DoR:**
- ✅ 011-01 DONE — the two-worker proxy + incoherency detector exist and open a
  staleness window on demand.

**Acceptance Criteria:**

1. **Credentialed-`fetch` `Set-Cookie` source — first-party lands, cross-site is
   a negative boundary.** Grounded in R-004: the shared identity cookies
   (`AMCV_*`, `kndctr_*`) are **first-party**, written by Alloy's synchronous
   `document.cookie` JS from the Edge *response body* — so a network `Set-Cookie`
   is **not** how Adobe identity is written, and the primary network out-of-band
   write is a **same-origin server `Set-Cookie`** (e.g. a first-party session /
   consent cookie, or a first-party-CNAME edge) that genuinely lands in the jar
   the chambers cache. The rig drives that same-origin write and measures when
   the chambers' sync-caches observe it. A **cross-site** demdex-style
   `Set-Cookie` is driven only as a **recorded negative boundary** — confirming
   it writes Adobe's own domain or is CHIPS-partitioned and *provably does not*
   mutate the customer-origin identity cookie (so it is not a coherency threat to
   the shared cookie, which is the finding). Detection is by broker jar re-read
   (`cookieStore` / `document.cookie`), **not** response-header inspection —
   `Set-Cookie` is a forbidden response header (R-006 F4). A source that cannot
   be driven or detected is recorded as such per the DoD kill-criteria clause.
2. **Main-thread write source.** The broker (main thread) writes the shared
   cookie via `document.cookie` out-of-band, and the rig measures the chamber
   sync-cache staleness window that opens until write-back/seed reconciles it.
3. **Second-tab write source.** A second page/tab (same origin) writes the shared
   cookie, and the rig measures whether a chamber in the first context ever
   observes it, and the window before it does (if ever). Driven via the existing
   Playwright multi-context capability.
4. **Per-source staleness scoreboard.** For each of the three sources, the rig
   reports — programmatically retrievable — a characterized result: does the
   chamber's synchronous view go stale, for how long (window), and whether it
   ever reconciles without SAB. Captured in Findings.

**DoD:**
- [ ] ACs 1–4 pass; each out-of-band source is driven deterministically (the
      write happens on demand, and the measurement is reproducible across runs).
- [ ] Any source that **cannot** be driven deterministically in the harness is
      recorded as such with rationale (Kill-criteria check: the method is
      revisited before a verdict rather than silently omitting the source).
- [ ] Spike-light review: self-verified against ACs (measurement rig).
- [ ] Deviation log + reconciliation sweep produced under this slice heading.
- [ ] `docs/refinement-todo.md` OQ9 annotated with the out-of-band findings if
      they move the go/no-go.

**Findings:** _Filled during IN_PROGRESS._

**Outcome:** _Set at DONE — e.g. `spec 011-03 unblocked`._

**Anti-horizontal-phasing check:** after this slice, the rig answers the
*realistic* coherency threats — the identity cookie really does get rewritten by
the network, the host, and other tabs in a live Adobe deployment — with a
per-source staleness window for each. Observable value: the evidence the go/no-go
in 011-03 is built from.

### Deviation log (after reconciliation)

_TODO._

### Reconciliation sweep

| Artifact | Disposition | Rationale |
|----------|-------------|-----------|
| `docs/refinement-todo.md` | `updated` | _TODO: OQ9 annotated with out-of-band findings, or deferred to 011-03._ |
| `docs/specs/README.md` | `updated` | _TODO: regenerated by `workflow.py status-board`._ |
| `docs/architecture.md` | `no-op` | _TODO: probe rig, no contract change (ADR lands 011-03)._ |
| `docs/decisions/README.md` / ADR index | `no-op` | _TODO: no ADR this slice._ |
| Primer surfaces: `CLAUDE.md` / `AGENTS.md` / scaffold templates | `no-op` | _TODO: checked._ |
| `docs/memory/**` | `no-op` | _TODO: memory-sync result._ |
