---
adr: 0011
pass: frame-critique
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-08-30T22:50:22Z
prompt_source: review.py frame-critique docs/decisions/adr-0011-config-integrity-enforcement.md
---

## Frame-critique — ADR-0011 (config-integrity enforcement) — needs-changes → applied → pass

The reviewer verified the foundational frame (the seam is the sole egress chokepoint — confirmed:
`connectors/alloy/egress-confinement.js` withholds XHR/WebSocket/EventSource/WebTransport/Worker/
caches/sendBeacon + revokes importScripts, so only the mediated `self.fetch` shim survives → a
hostile chamber's crafted fetch genuinely must cross the seam) and found it GROUNDED. The disposition
(hold-first, host+tenant, injected key, override opt-in, GA4 deferred) was already settled by the
slice-01 frame-critique and was not re-litigated.

**The one load-bearing error it landed (applied):** the ADR's headline claimed HOLD "neutralizes the
confirmed 013-03 tenant re-route fail-closed" and that the `orgId`/body co-vector "is unaffected" —
but the check surface is the **URL** (host + `configId`), while alloy's `orgId` rides in the **body**
(`configure({datastreamId, orgId})`). 013-03 **explicitly left `orgId` routing-relevance OPEN** ("a
residual to close if it proves routing-relevant") and AC1 varied only `configId` on a single org — so
the live evidence says nothing about `orgId`. An honest-`configId`-URL + attacker-`orgId`-body request
would pass **allowed, unheld, and (honest path emits nothing) unalerted**. The ADR resolved an open
question in the convenient direction, producing active **false assurance** (fail-closed-and-silent),
which the threat-model adversary (a chamber that builds the whole body) would simply choose.

**Fix (reviewer option b — honest re-scoping, no code change):**
- Recommended-Decision point 2 + Consequences headline now scope the win to the **URL tenant-key**
  (`configId`) vector — the exact one 013-03 measured live — and state the check surface is the URL.
- The `orgId`/body residual is **reclassified** from "unaffected / separate concern" to an
  **UNVERIFIED, currently-SILENT (unalerted) residual**: uncovered, not immune; hold protects the body
  only *when it fires*, and a body-only swap never fires it.
- The Kill criteria ("tenant routing not a single URL param → needs body/header-aware control") is
  connected explicitly to alloy's `orgId` — "not hypothetical; fires for alloy today if orgId proves
  routing-relevant."
- Tracked follow-up filed (`docs/refinement-todo.md`): live-probe whether `orgId` routes/namespaces
  identity independently of the datastream; if yes, extend to a body/header-aware check + its own alert.
- Slice-01 (AC7 + anti-phasing) and spec.md re-scoped to match.

### Net
No design/code change — the control is still host + URL-tenant-key, fail-closed hold + alert. What
changed is the ADR's CLAIMS: the headline is scoped to the measured URL vector, and the body-`orgId`
co-vector is named as an honest known-uncovered-and-silent residual with a tracked probe, instead of
being waved off as "unaffected."
