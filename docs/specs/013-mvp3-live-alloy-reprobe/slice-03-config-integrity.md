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
check passes — and ground the **config-integrity** control MVP3 must enforce: a **seam-side
check** (the main-thread dispatch pins the outbound `configId`/`orgId` to the host-set value
and **holds at the seal on mismatch**), with host-owned-config-at-boot + read-minimization as
**necessary-but-not-sufficient** support. Destination-allowlisting is blind to this (the
tenant ids ride *outside* the host/path the seal keys on — `datastreamId` as the `configId`
query param, `orgId` in the body); ADR-0006's endpoint ceiling does not cover it yet.

**Question:** Can a compromised alloy chamber silently re-point its datastream/org to an
attacker-controlled Adobe tenant on the same allowed host, defeating the host allow-list —
and what actually stops it: host-owned config alone (which a compromised chamber that *owns
the alloy instance* can defeat by re-`configure`-ing or bypassing alloy entirely), or a
**seam-side config-integrity check** at the main-thread dispatch?

**Time-box:** ~1 day once credentials land — needs a **second** ("attacker") test datastream
/ org (or a faithfully simulated second tenant on the same host).

**DoR:**
- ✅ [012-01](../012-mvp2-alloy-chamber/slice-01-host-and-boot.md) DONE — the chamber, the
  `ConnectorFactory(config)` hook, and how `datastreamId`/`orgId` reach alloy (`configure`)
  all exist to inspect.
- ✅ [mvp3.md](../../releases/mvp3.md) Risks — the same-host-tenant re-routing threat +
  the config-integrity mitigation are named (not yet in [ADR-0006](../../decisions/adr-0006-capability-manifest.md)).
- ⛔ **BLOCKER — credentials (AC1 only):** AC1's end-to-end repro (proving real Edge *lands*
  data in the attacker tenant on the shared host) needs a **real second** test/dev datastream
  / org — a *simulated* tenant begs the question (it assumes real Edge routes by
  `configId`/`orgId`, which is exactly what AC1 proves). **AC2 + AC3 need no creds and no
  second tenant** — config-mutability + the mitigation are code/API/seam-inspection +
  stub-alloy unit questions (mirrors 013-01's capture-once split). So the load-bearing
  findings land creds-free; only the end-to-end confirmation waits on the second datastream.

**Acceptance Criteria:**

1. **Reproduce (or bound) the attack.** A chamber whose alloy is configured with the
   **attacker's** `datastreamId`/`orgId` on `adobedc.demdex.net` sends the `interact` to the
   attacker's tenant — showing the **host allow-list is blind** to it (same host, different
   tenant). Observable: the interact reaches the attacker tenant's datastream on the allowed
   host; every host-allowlist check passes.
2. **Config mutability (creds-free — inspection + stub-alloy unit).** By reading
   `core/connector-host.js` (`factory(config)` closure-captures the config once) +
   `connectors/alloy/connector.js` (`configure({datastreamId, orgId})`) + tracing how the
   worker glue receives `config`, determine whether config is **chamber-mutable** (chamber
   code can call `configure` again with an attacker org post-`init`) or **host-owned**.
   Observable (a **stub-alloy** unit, no live traffic): `configure` once, then have
   "compromised" chamber code call it again with an attacker org — does it re-point?
3. **Mitigation grounding — the seam-side check is primary (creds-free, stub-alloy).**
   Host-ownership of the *initial* config does **not** bind a **compromised** chamber: the
   whole alloy runtime lives *in* the chamber, so compromised code owns the alloy instance
   (can re-`configure` it) **and** can bypass alloy to craft its own `?configId=<attacker>`
   fetch — closure-capture only disciplines *honest* connector code. So demonstrate the
   **enforceable** control: a **config-integrity check at the seam** — the main-thread
   dispatch (ADR-0004) pins the outbound `configId`/`orgId` to the host-set value and
   **holds at the seal on mismatch** — plus read-minimization. Observable (stub-alloy unit):
   a chamber that re-points its org is **caught at the dispatch seam** and held, even though
   it owns the alloy instance. Host-owned-config-at-boot is recorded as
   **necessary-but-not-sufficient** support, not the primary defense.
4. **Recorded.** The config-integrity requirement + its grounding (the demonstrated attack +
   the working mitigation) land in the Findings + `docs/refinement-todo.md`, feeding an
   ADR-0006 **config-integrity** addition (currently absent from ADR-0006).

**DoD:**
- [ ] **Creds-free core (un-waivable):** AC2 (config-mutability, stub-alloy unit) + AC3 (the
      seam-side config-integrity check demonstrated against a stub-alloy compromised chamber)
      + the ADR-0006 config-integrity requirement land **without** live creds or a second
      tenant. AC1 (end-to-end repro that real Edge lands data in the attacker tenant) is the
      **only** creds-gated AC — it needs a real second datastream; if unavailable, AC1 is
      deferred + honestly marked, and the core finding + mitigation are **not** blocked by it.
- [ ] Spike-light review: compliance + craft recorded pass.
- [ ] Deviation log + reconciliation sweep under this slice heading.
- [ ] `docs/refinement-todo.md` updated with the config-integrity requirement + the
      ADR-0006 gap it exposes.
- [ ] **No live identifiers committed** (redact both tenants' ids).

**Findings:** _Filled during IN_PROGRESS (once credentials land)._

**Outcome:** _Set at DONE — e.g. `same-host re-routing confirmed tenant-blind (creds-free);
seam-side config-integrity check (dispatch pins configId/orgId → hold on mismatch)
demonstrated against a stub-alloy compromised chamber; host-owned-config necessary-not-
sufficient; config-integrity requirement filed for the ADR-0006 addition`._

**Anti-horizontal-phasing check:** after this slice, MVP3's config-integrity requirement is
grounded in a **demonstrated** (or bounded) attack + a working mitigation — not a
hypothesis. Observable value: the re-routing attack + the seam-side config-integrity control
that stops it (with host-owned-config as necessary-not-sufficient support).
