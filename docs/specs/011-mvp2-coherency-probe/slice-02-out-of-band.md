---
status: RECONCILED
kind: spike
dependencies: [011-01]
last_verified: 2026-08-28
frame_review: true
claimed_by: claude/chambers-io-security-5867f9
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
   synchronous view go stale, for how long (window), whether it ever reconciles
   without SAB, and — via 011-01's identity-consuming-read instrument (AC5) —
   whether a stale read produces an identity **fault** (duplicate / split) or a
   **self-heal**; for the **negative boundary** (network `Set-Cookie`,
   both variants), confirmation that it does not reach the cached cell. Captured
   in Findings.

**DoD:**
- [x] ACs 1–4 pass; each out-of-band source is driven deterministically (the
      write happens on demand, and the measurement is reproducible across runs).
- [x] Any source that **cannot** be driven *or detected* deterministically in the
      harness is recorded as such with rationale (Kill-criteria check): the
      `cookieStore` `change` detect-miss for `document.cookie` writes is recorded and
      degrades to the `document.cookie`-polling fallback — a valid recorded window,
      not an omission.
- [x] Spike-light review: self-verified against ACs (measurement rig). Compliance +
      craft passes both recorded `verdict: pass` (`reviews/slice-02-*.md`).
- [x] Deviation log + reconciliation sweep produced under this slice heading.
- [x] `docs/refinement-todo.md` OQ9 annotated with the out-of-band findings.

**Findings:**

**Instrument extended** (throwaway measurement rig, not runtime — extends the
011-01 rig in place, does not rebuild it):
- `rig/coherency-model.mjs` — added the out-of-band ops to the pure core: an `oob`
  op (a **foreign** write to the jar from outside any chamber — jar moves, no
  chamber cache is touched, the broker is not notified) and a `detect` op (the
  broker learns of it — cookieStore `change` / poll). Added `jarIdentityHistory`
  (the distinct identities asserted for one visitor, **including** an out-of-band
  write) and `oobDecomposition` (splits the staleness window into
  broker-**detection** lag + broker→chamber **propagation** lag, R-006 F4). Two
  new scenarios: `oob-foreign-writeback` (option A) and `oob-broker-push` (option
  B). Plus the two 011-01 forward-logged nits (below).
- `rig/coherency-harness.html` — the broker now installs a persistent cookieStore
  `change` listener + a `document.cookie`-polling helper (R-006 F3), runs the two
  oob scenarios, and drives two empirical same-document probes: **AC1** (a foreign
  main-thread `document.cookie` write) and **AC3 same-origin** (a server
  `Set-Cookie` of a *different* cookie, confirmed by jar re-read + proof the
  `Set-Cookie` header is unreadable, R-006 F4). It validates the change listener
  against the async `cookieStore.set()` path first, so a negative for
  `document.cookie` writes is real platform behavior, not a broken probe.
- `rig/coherency.mjs` — the Node driver now uses one browser **context** (one
  shared jar) so it can drive **AC2** (a second same-origin **page** writes the
  cookie; measure whether tab-1 detects it) and **AC3 cross-site** (a demdex-shaped
  cross-site `Set-Cookie` via `page.route`). It re-runs the deterministic scenarios
  once and asserts byte-identity (011-01 nit #2 made executable), assembles the
  per-source scoreboard (AC4), and self-gates fails-both-ways (exit non-zero
  otherwise). Added two tiny server routes (`/__set-cookie__`, `/__blank__`) — local
  to this rig, not a refactor of the shared static-server block (still parked for
  `rig/serve.mjs`).
- `test/coherency-model.test.js` — +12 vitest cases (161 → **173** total, all
  green): the coherence absent-cache fix, `jarIdentityHistory`, the out-of-band
  `classifyIdentity` path, the two oob scenarios (fault + self-heal + decomposition),
  and per-scenario oob byte-identity.
- Run: **`npm run rig:coherency`** (exit 0 = discriminated + fails-both-ways) and
  **`npm test`**. Scoreboard → `rig/out/coherency.json` (`.out_of_band`).

**Detection primitive — measured + validated (chromium, headless).** The broker
runs on the Window, where `cookieStore` **is** present, and the `change` listener
is **validated** (an async `cookieStore.set()` fired it, ~0 ms). But — the
load-bearing empirical result — the `change` event **did NOT fire** for a
same-document `document.cookie` write (AC1) **nor** for a cross-tab
`document.cookie` write (AC2). Since the identity cookie is *only ever*
`document.cookie`-written (R-004), **cookieStore `change` misses every positive
out-of-band source in this build; detection degrades to the `document.cookie`
polling fallback** (R-006 F3) — a valid recorded window per the DoD kill-criteria
clause, not an omission. Consequence handed to 011-03: a broker-push (option B)
mechanism must **poll** to cover foreign/second-tab writes; it cannot rely on
`change` events alone.

**Per-source out-of-band scoreboard** (`rig/out/coherency.json` → `.out_of_band`;
staleness in broker **ops**, deterministic; seed `MCMID|`, foreign identity
`ECID-foreign`). The correctness *mechanism* is **source-independent** (it turns on
detect-before-consume, not on which foreign actor wrote), so both positive sources
share the two deterministic correctness rows; the per-source variable is
**detectability**:

| Source | goes stale? | window (ops) | reconciles w/o SAB? | **identity verdict** | detection |
|---|---|---|---|---|---|
| **foreign main-thread script** (AC1) — *option A, no invalidation* | YES | **2** (`totalStalenessOps`) | window *closes* (cache re-equals jar) but **NOT to the foreign identity** (`reconciledToOobValue=false`) | **FAULT — split identity** `{ECID-foreign, ECID-c1}`: the chamber mints a **duplicate** off its stale seed while a valid foreign identity already exists; the foreign one is clobbered (lost update) | via **`document.cookie` polling** (cookieStore `change` did **not** fire same-document) |
| **foreign main-thread script** (AC1) — *option B, broker-push on detection* | YES | **3** = detection-lag **2** + propagation-lag **1** (R-006 F4) | **YES** — `reconciledToOobValue=true` | **SELF-HEAL**: broker detects + pushes `ECID-foreign` **before** consumption → chamber **attaches** it, mints nothing (`{ECID-foreign}`) | same (polling drives the detect) |
| **second tab** (AC2) — same origin, shared jar | YES (a chamber in tab-1 **does** eventually observe it) | same correctness rows as above (source-independent) | option B: YES; option A: no | option A FAULT / option B SELF-HEAL | via **`document.cookie` polling** (cross-tab cookieStore `change` did **not** fire) — so a chamber observes a second-tab write **only if the broker polls**, never by a free push |

The sharpest single result — the `oob-foreign-writeback` row: the chamber's cache
ends **`coherent:true`** with the jar **and** its staleness window **closed**
(`reconciled_within_run:true`), yet the run is a **FAULT**. Cache-coherency *and* a
closed window both say "fine"; the identity-consuming-read instrument (011-01 AC5)
says split identity. This re-proves — now for the out-of-band case and even more
sharply than 011-01 — that **window/coherence ≠ correctness**; `reconciledToOobValue`
is the disambiguator (the window closed to the chamber's *own duplicate*, not the
foreign identity).

**Negative boundary — network `Set-Cookie` (AC3), both variants, driven.** Detected
by broker **jar re-read**, not header inspection:
- **Same-origin server `Set-Cookie`**: wrote a **different** cell
  (`airlock_session`, `other_cookie_written:true`); the `AMCV_TESTORG` identity cell
  was **unchanged** (`identity_cell_mutated:false`); and the `Set-Cookie` **response
  header was unreadable** from `fetch` (`set_cookie_header_readable:false`) —
  empirically confirming R-006 F4's forbidden-header fact.
- **Cross-site demdex `Set-Cookie`** (routed via `page.route`): the customer-origin
  identity cell was **unchanged** (`identity_cell_mutated:false`) and **no `demdex`**
  landed in the customer jar (`demdex_in_customer_jar:false`) — it targets Adobe's
  domain / is CHIPS-partitioned and by same-origin policy cannot reach the
  customer-origin identity cell.
- **Out of scope (recorded follow-up):** the server-side / first-party-CNAME
  deployment that *would* `Set-Cookie` `kndctr_*` **directly** is a different
  deployment R-004 never probed — not exercised here; handed to OQ9 / 011-03.

**Verdict (out-of-band coherency axis).** The out-of-band writers that actually
matter for the identity cookie are **foreign JS actors** (a co-resident main-thread
script, a second tab), and against them the MVP1 seed+async-write-back shim
(option A) produces the **same split-identity FAULT** as the in-band concurrent
case (011-01), now with the *foreign* identity as the "other" one. **Broker-push
invalidation on detection (option B) self-heals it** — but detection must be by
**polling `document.cookie`**, because cookieStore `change` (though present and
listener-validated) fires for neither a same-document nor a cross-tab
`document.cookie` write in this build, and the identity cookie is only ever
`document.cookie`-written (R-004). Network `Set-Cookie` — both variants — is a
confirmed **non-event** for the cached identity cell. The detector fails
**both** ways on the new scenarios (fault on `oob-foreign-writeback`, self-heal on
`oob-broker-push`), the jar lived in the real `document.cookie` every run, and the
deterministic scenarios re-ran **byte-identical** across two browser loads. No
SharedArrayBuffer / COOP-COEP (AD-4).

**011-01 nits folded in (both now closed):**
1. `coherence()` no longer filters out absent caches — a missing/undefined cache
   (which an out-of-band writer can legitimately leave) reads as **INCOHERENT**
   (`anyAbsent`), not vacuously coherent. Pinned by 3 new vitest cases.
2. The "byte-identical across two **browser** runs" determinism claim is now
   **executable**: `rig/coherency.mjs` re-runs the scenarios once and self-gates on
   byte-identity (`scenarios_byte_identical`), alongside the in-memory vitest
   determinism checks for the oob scenarios.

**Outcome:** `spec 011-03 unblocked` — the out-of-band verdicts + the
polling-detection finding feed the 011-03 scoreboard/ADR.

**Anti-horizontal-phasing check:** after this slice, the rig answers the
*realistic* coherency threats — the identity cookie really does get rewritten by
the network, the host, and other tabs in a live Adobe deployment — with a
per-source staleness window for each. Observable value: the evidence the go/no-go
in 011-03 is built from.

### Deviation log (after reconciliation)

Conformant choices + material findings; reviewer hardening applied where cheap:

1. **AC2 realized as a second same-origin *page* in one shared browser context**,
   not literal Playwright multi-context. Deliberate: separate Playwright contexts
   have isolated cookie jars (a rig artifact, not a browser fact), so one context /
   two pages is the faithful model of "a second tab."
2. **`cookieStore` `change` fires for no `document.cookie` write path in this
   Chromium** (the listener itself was validated via `cookieStore.set()`, 0ms). This
   is the DoD kill-criteria degradation (detect via `document.cookie` polling), not a
   scope deviation — and a **material finding: option B (broker-push) must *poll*,
   not rely on `change`** (a load-bearing input for 011-03).
3. **Staleness in op-count** (deterministic), not wall-clock — same conformant
   choice as 011-01.
4. **Reviewer hardening applied in this reconciliation (rig re-run green, verdict
   PASS):** compliance nit — `crossSiteNegativeHolds` now also asserts
   `crossSite.routed === true`, so the cross-site negative boundary can no longer
   pass *vacuously* if `page.route` ever stopped intercepting; craft nit — file
   banners updated `011-01` → `011-01 + 011-02` in `rig/coherency-model.mjs` and
   `test/coherency-model.test.js`.
5. **Reviewer nits forward-logged (defensible as-is):** craft —
   `foreignScriptDetectable` / `secondTabDetectable` are near-tautological pass-gate
   legs (`pollingDetected` for a synchronous same-document write is always true); the
   real content (`detection_mechanism==='document.cookie-polling'`) is recorded but
   not gated (matches DoD intent) — **carry to 011-03** if the legs are reused, gating
   on the expected mechanism to discriminate. `detectionLagOps` is a function of
   scripted step position, not a measured latency (empirical latency is separately
   `cookieStoreChangeLatencyMs`) — disclosed, left. `foreignScriptWrite` /
   `writeAmcvCookie` are byte-identical by design (only provenance differs) — left.
6. **`rig/serve.mjs` extraction** stays tracked from 011-01 (011-02 added two
   additive rig-local routes `/__set-cookie__`, `/__blank__`, not a refactor).

### Reconciliation sweep

| Artifact | Disposition | Rationale |
|----------|-------------|-----------|
| `docs/refinement-todo.md` | `updated` | OQ9 annotated with the out-of-band finding: both positive JS sources detect only via `document.cookie` polling in this Chromium (`change` does not fire for those writes); option B (broker-push **on polling**) self-heals the out-of-band split-identity fault — a **go** on the out-of-band axis, not stop-and-re-shape. Substantive go/no-go + resolving ADR are 011-03's. |
| `docs/specs/README.md` | `updated` | Regenerated by `workflow.py status-board`. |
| `docs/architecture.md` | `no-op` | Throwaway probe rig; no module-boundary/contract change (the resolving ADR lands in 011-03). |
| `docs/decisions/README.md` / ADR index | `no-op` | No ADR this slice. |
| Primer surfaces: `CLAUDE.md` / `AGENTS.md` / scaffold templates | `no-op` | Checked — spec 011 is not closed (011-03 remains). |
| `docs/memory/**` | `no-op` | The load-bearing learnings (out-of-band fault self-heals via broker-push+polling; `cookieStore` `change` misses `document.cookie` writes; coherent+window-closed can still be a FAULT) are captured in the Findings and feed 011-03 — repo-recorded. |
