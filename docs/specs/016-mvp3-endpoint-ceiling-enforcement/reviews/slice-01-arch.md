---
slice: 016-01 — GA4: confine the chamber + wire-protocol endpoint ceiling (the EXACT archetype)
pass: arch
verdict: pass
reviewer: orchestrator-opus
reviewed_at: 2026-08-31T00:42:42Z
prompt_source: independent Opus review of Sonnet implementer diffs (016-01)
substrate: non-interactive
---

## Arch review — 016-01 (new core enforcement seam + chamber confinement + data-flow) — PASS

Independent Opus review of the Sonnet implementer's diffs.
- **The load-bearing ordering fix is correct.** Confinement is applied via `core/confine-ga4-chamber.js`,
  which is `core/chamber.worker.js`'s FIRST import (verified: line 44, above the connector imports), and
  applies `applyEgressConfinement(self, {withholdFetch:true})` at its own module top-level. By ES-module
  post-order evaluation this runs before the connector modules evaluate — closing the top-level
  self.fetch-capture bypass the round-2 frame-critique caught. A captured-before-confinement unit test
  proves the reassignment-doesn't-retroactively-fix property; a source-order test pins first-import.
- **Confinement relocated to core/ (vendor-neutral) not coupled.** `core/egress-confinement.js` operates
  on a passed-in scope, imports nothing from rig/connectors; the GA4 chamber and alloy chamber both apply
  it. No core→rig import (boundary test green). Clean shared primitive, the 015 relocate precedent.
- **The archetype-specific fetch disposition is honest.** withholdFetch withholds fetch + reports
  fetchWithheld; the default alloy path preserves fetch + reports fetchPreserved — never the inverted
  signal. alloy's confinement + manifest tests stay green (no regression to the mediated-fetch invariant).
- **Attribution is a construction-time data-flow, not request-derived.** The ceiling is reduced once from
  the host's declared `endpoints` at `createAirlock`; the seam checks `r.url` against it — a compromised
  chamber cannot widen its own ceiling. EgressRequest carries no connector id; single-connector-per-host,
  as the spec grounds. Multi-chamber attribution named as forward-looking.
- **Seam placement correct** — the check is in `worker.onmessage` before `fetch(r.url)`, holds via
  `continue` (no fetch, no dispatched++), surfaces via 009-02. Gated on ceiling.length (back-compat).
No arch findings.
