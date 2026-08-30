---
status: DRAFT
kind: spike
dependencies: []
last_verified:
frame_review: true
---

<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about
     runnable surfaces by probe first (run it / read source) or a citation. -->

## Slice 013-03 — config-integrity / same-host-tenant re-routing

**Goal:** Test whether a compromised chamber can re-point its `datastreamId` / `orgId` (or
`edgeConfigId`) to an **attacker's Adobe org on the _allowed_ host** (`adobedc.demdex.net`)
— sending the user's identity/analytics to the attacker while every destination-allowlist
check passes — and ground the **config-integrity** control (host-owned config +
read-minimization) that MVP3 must enforce. Destination-allowlisting is blind to this;
ADR-0006's endpoint ceiling does not cover it yet.

**Question:** Can a compromised alloy chamber silently re-point its datastream/org to an
attacker-controlled Adobe tenant on the same allowed host, defeating the host allow-list —
and does making the connector config **host-owned** (orchestrator-set, chamber-immutable)
actually prevent it?

**Time-box:** ~1 day once credentials land — needs a **second** ("attacker") test datastream
/ org (or a faithfully simulated second tenant on the same host).

**DoR:**
- ✅ [012-01](../012-mvp2-alloy-chamber/slice-01-host-and-boot.md) DONE — the chamber, the
  `ConnectorFactory(config)` hook, and how `datastreamId`/`orgId` reach alloy (`configure`)
  all exist to inspect.
- ✅ [mvp3.md](../../releases/mvp3.md) Risks — the same-host-tenant re-routing threat +
  the config-integrity mitigation are named (not yet in [ADR-0006](../../decisions/adr-0006-capability-manifest.md)).
- ⛔ **BLOCKER — credentials:** two test/dev tenants on the allowed host (a "legit" + an
  "attacker" datastream/org), or a faithful simulation of a second tenant.

**Acceptance Criteria:**

1. **Reproduce (or bound) the attack.** A chamber whose alloy is configured with the
   **attacker's** `datastreamId`/`orgId` on `adobedc.demdex.net` sends the `interact` to the
   attacker's tenant — showing the **host allow-list is blind** to it (same host, different
   tenant). Observable: the interact reaches the attacker tenant's datastream on the allowed
   host; every host-allowlist check passes.
2. **Config mutability.** Determine whether `datastreamId`/`orgId` is **chamber-mutable**
   (the vendor SDK's own config, set by code inside the chamber via `configure`) or already
   **host-owned** (injected by the orchestrator, unreachable to chamber code post-boot).
   Observable: whether chamber code can change its own datastream/org after `init`.
3. **Mitigation grounding.** Demonstrate that **host-owned config** — the orchestrator sets
   `datastreamId`/`orgId` and the chamber cannot alter them — prevents the re-routing (or,
   if config must live in the chamber for alloy to boot, record exactly why and what the
   next-best control is: read-minimization + a config-integrity check at the seam).
   Observable: with host-owned config, the re-route attempt fails.
4. **Recorded.** The config-integrity requirement + its grounding (the demonstrated attack +
   the working mitigation) land in the Findings + `docs/refinement-todo.md`, feeding an
   ADR-0006 **config-integrity** addition (currently absent from ADR-0006).

**DoD:**
- [ ] ACs 1–4 pass (or the attack is honestly bounded — e.g. if alloy refuses a mismatched
      org, that itself is the finding).
- [ ] Spike-light review: compliance + craft recorded pass.
- [ ] Deviation log + reconciliation sweep under this slice heading.
- [ ] `docs/refinement-todo.md` updated with the config-integrity requirement + the
      ADR-0006 gap it exposes.
- [ ] **No live identifiers committed** (redact both tenants' ids).

**Findings:** _Filled during IN_PROGRESS (once credentials land)._

**Outcome:** _Set at DONE — e.g. `same-host re-routing reproduced; host-owned config
prevents it; config-integrity requirement filed for the ADR-0006 addition`._

**Anti-horizontal-phasing check:** after this slice, MVP3's config-integrity requirement is
grounded in a **demonstrated** (or bounded) attack + a working mitigation — not a
hypothesis. Observable value: the re-routing attack + the config-ownership control that
stops it.
