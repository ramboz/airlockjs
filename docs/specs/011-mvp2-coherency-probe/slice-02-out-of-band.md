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

**Goal:** The coherency rig from 011-01 is extended with the out-of-band writes to
the shared first-party identity cookie from **outside any chamber**. Because that
cookie is only ever JS-written (R-004), the two load-bearing sources are a
**foreign main-thread script** write (e.g. a co-resident legacy Adobe Visitor/ECID
lib) and a **second-tab** write; network `Set-Cookie` is exercised only as a
**negative boundary** (it does not mutate the cached cell). Each is driven
deterministically, and the rig reports the staleness window each opens in a
chamber's sync-cache.

**Scope vs 011-01 (what this slice adds).** 011-01 covers **in-band** writes —
the chambers' own writes of the identity cookie (e.g. Alloy persisting `AMCV_*`
from the Edge response body, the R-004 pattern), concurrent across two chambers.
011-02 is disjoint: it covers writes the chambers do **not** make — a *foreign*
JS actor (another first-party script on the main thread, or another tab) that the
broker must detect and propagate. Together they cover the write's full provenance.

**Question:** When the shared identity cookie is JS-written **outside** any
chamber — by a foreign main-thread script or another tab — how stale does a
chamber's synchronous cached view become, and for how long, given async
write-back and no cross-thread shared memory? (And: does any network `Set-Cookie`
path reach the cached cell at all?)

**Time-box:** ~1 day. Reuse the 011-01 rig; add one driver per out-of-band
source. Stop when each source has a characterized staleness window.

**DoR:**
- ✅ 011-01 DONE — the two-worker proxy + incoherency detector exist and open a
  staleness window on demand.

**Acceptance Criteria:**

1. **Foreign main-thread script source (positive).** A first-party script *other
   than the chambers* — running on the main thread, e.g. a co-resident legacy
   Adobe Visitor/ECID lib during a migration — writes the shared identity cookie
   via `document.cookie`. This is a genuine out-of-band write (the writer is not a
   chamber, and not the broker/authority — so it carries a real detection lag).
   The rig measures the chamber sync-cache staleness window that opens until the
   broker detects the write (`cookieStore` `change`) and propagates it. [Note:
   a *broker*-authored write has zero detection lag and is **not** this case;
   the discriminating source is the foreign script.]
2. **Second-tab write source (positive).** A second page/tab (same origin) writes
   the shared cookie, and the rig measures whether a chamber in the first context
   ever observes it, and the window before it does (if ever — a foreign tab's
   write may need `cookieStore` `change` / polling to detect). Driven via the
   existing Playwright multi-context capability.
3. **Network `Set-Cookie` — negative boundary (both variants).** Grounded in
   R-004: the shared identity cookies (`AMCV_*`, `kndctr_*`) are **first-party,
   JS-written** from the Edge response body — *not* `Set-Cookie`-written — so no
   network `Set-Cookie` mutates the cached cell in this deployment. The rig
   confirms that as a recorded boundary for **both** variants: a **same-origin
   server `Set-Cookie`** writes a *different* cookie (session/consent), and a
   **cross-site** demdex-style one writes Adobe's domain / is CHIPS-partitioned —
   neither reaches the customer-origin identity cookie. (Detection would be by
   broker jar re-read, **not** header inspection — `Set-Cookie` is a forbidden
   response header, R-006 F4.) The server-side / first-party-CNAME mode that
   *would* `Set-Cookie` `kndctr_*` directly is a **different deployment R-004
   never probed — explicitly out of scope here**, recorded as an open follow-up.
   A source that cannot be driven or detected is recorded as such per the DoD
   kill-criteria clause.
4. **Per-source staleness scoreboard.** For each source, the rig reports —
   programmatically retrievable — a characterized result: for the two **positive**
   sources (foreign main-thread script, second-tab), does the chamber's
   synchronous view go stale, for how long (window), and whether it ever
   reconciles without SAB; for the **negative boundary** (network `Set-Cookie`,
   both variants), confirmation that it does not reach the cached cell. Captured
   in Findings.

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
