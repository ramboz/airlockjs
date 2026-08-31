---
slice: 016-01 — GA4: confine the chamber + wire-protocol endpoint ceiling (the EXACT archetype)
pass: frame-critique
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-08-31T00:21:49Z
prompt_source: review.py frame-critique 016-01 (two rounds)
---

## Frame-critique — 016-01 (GA4: confine + ceiling) — TWO ROUNDS → all applied → pass

**Round 1 (needs-changes):** the ceiling at the ready-dispatch seam had NO foreign-sink teeth because the
GA4 chamber retains ambient fetch/XHR (applyEgressConfinement is alloy-only) → a compromised handle
bypasses via direct self.fetch. **Applied** (user chose fold-in): 016-01 folds in GA4-chamber confinement
(withhold ambient network incl. fetch — GA4's egress is the ready postMessage). + named the tenant-in-query
residual (measurement_id = GA4's deferred config-integrity).

**Round 2 re-critique (needs-changes, NEW load-bearing):** confinement placed in the chamber body/init is
TOO LATE — the GA4 chamber is a type:"module" worker that statically imports its connector, and ES-module
post-order evaluation runs the connector's top-level BEFORE the chamber body, so a compromised connector
module captures `const f = self.fetch` before confinement (which only reassigns the property) runs → bypass;
AC7 would pass a handle-time probe while shipping false confinement. **Applied:** AC2 now requires
confinement as the chamber's FIRST side-effecting import (runs before the connector module by post-order);
AC7(a) probes the top-level-capture bypass specifically; the success invariant is fetch-WITHHELD (not
alloy's inherited fetchPreserved); dynamic-import() named as a carried-over disclosed residual (a JS shim
can't withhold it — gated by a worker connect-src CSP), so "sole egress" is scoped honestly.

**Verified by the re-critique:** the honest-path safety holds (GA4 handle uses only mapToMp / busy /
JSON.stringify — zero ambient network, so withholding fetch can't break it).

### Net
Real GA4 foreign-sink teeth = chamber confinement (applied at the correct boot-ordering point, defending
whole-module compromise) + the origin+path ceiling at the seam, with the tenant-in-query and dynamic-import()
residuals named, not hidden.
