---
slice: 013-03 — config-integrity / same-host-tenant re-routing
pass: frame-critique
verdict: pass
reviewer: general-purpose
reviewed_at: 2026-08-30T13:30:00Z
prompt_source: review.py frame-critique docs/specs/013-mvp3-live-alloy-reprobe/spec.md 013-03 slice-03-config-integrity.md
---

## Frame-critique — slice 013-03 (config-integrity / same-host-tenant re-routing)

**Round 1 verdict: needs-changes** (general-purpose reviewer, bounded ≤7-file context:
ADR-0006, ADR-0004, connector.js, connector-host.js, mvp3.md Risks). Five findings; two
sound (threat + spike shape verified against code/ADRs), three applied — the named mitigation
was infeasible-by-construction and the load-bearing ACs are creds-free.

### Findings + resolution

- **[1] over-claimed — the load-bearing findings are creds-free; the slice gated all 4 ACs
  behind two tenants.** AC2 (config-mutability) + AC3 (mitigation) are code/API/seam-inspection
  + stub-alloy unit questions — `connector-host.js` closure-captures `config` once,
  `connector.js` calls `configure({datastreamId, orgId})`; whether a "compromised" chamber can
  re-`configure` post-`init` is a stub unit, no live traffic, no second tenant. Only AC1
  (prove Edge *lands* data in the attacker tenant) needs the second datastream. **Fix:** DoR +
  DoD split a **creds-free core** (AC2+AC3+the ADR-0006 requirement) from a **creds-gated
  confirmation** (AC1) — mirrors 013-01's capture-once split; ~80% of value lands today.

- **[3] highest — the named primary mitigation is infeasible by construction.** AC3 assumed
  host-owned config → chamber can't alter → prevented. But the **whole alloy runtime lives in
  the chamber**: `getAlloy()` resolves `globalThis.alloy`, `configure` is a chamber-side call,
  the interact `fetch` is issued *in* the chamber then intercepted. Host-ownership of the
  *initial value* does **not** bind a **compromised** chamber — it owns the alloy instance (can
  re-`configure`) and can bypass alloy to craft its own `?configId=<attacker>` fetch;
  closure-capture only disciplines *honest* code. **Fix:** the **seam-side config-integrity
  check** (main-thread dispatch pins outbound `configId`/`orgId` to the host value → holds at
  seal on mismatch) is promoted to the **primary, demonstrated** mitigation (creds-free,
  stub-alloy testable); host-owned-config-at-boot demoted to necessary-but-not-sufficient. Goal
  + Question + AC3 + Outcome all rewritten.

- **[2] sound — threat verified, not pre-mitigated.** Confirmed against ADR-0004 (§Consent
  allowlist gate) + ADR-0006 (host-owned allow-list): the seal keys on endpoint host/path, but
  the tenant ids ride **outside** that key (`datastreamId` as alloy's `configId` query param,
  `orgId` in the body), so the check is genuinely tenant-blind; neither ADR carries a
  tenant-scoped control. Grounding folded into the Goal.

- **[4] sound — real spike w/ downstream** (ADR-0006 config-integrity addition). Caveat: the
  downstream's strength rides on [3] — now that the seam-check is the demonstrated deliverable,
  the ADR addition cites a *demonstrated* mechanism, not a hypothesis.

- **[5] over-claimed — "faithful simulation of a second tenant" mis-placed.** For AC1 a
  simulated tenant **begs the question** (it assumes real Edge routes by `configId`/`orgId` —
  what AC1 proves) → AC1 needs a **real** second datastream; AC2/AC3 need no tenant at all.
  **Fix:** DoR states per-AC evidence — AC1 = real second datastream; AC2/AC3 = none — instead
  of a blanket creds-or-simulation gate that was both too strong (AC2/AC3) and too weak (AC1).

### Net
Threat + spike shape were sound; the re-frame promotes the **seam-side config-integrity check**
from a documentation hedge to the primary, stub-alloy-tested deliverable (host-owned config
alone can't bind a compromised chamber), and splits the ACs so the load-bearing finding +
mitigation land **creds-free** — only the end-to-end repro waits on a real second datastream.
