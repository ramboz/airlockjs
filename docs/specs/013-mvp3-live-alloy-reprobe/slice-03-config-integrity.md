---
status: DONE
kind: spike
dependencies: []
last_verified: 2026-08-30
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
- [x] **Creds-free core (un-waivable):** AC2 (config-mutability, stub-alloy unit) + AC3 (the
      seam-side config-integrity check demonstrated against a stub-alloy compromised chamber)
      + the ADR-0006 config-integrity requirement land **without** live creds or a second
      tenant. AC1 (end-to-end repro that real Edge lands data in the attacker tenant) is the
      **only** creds-gated AC — it needs a real second datastream; **AC1 is DEFERRED** + honestly
      marked, and the core finding + mitigation are **not** blocked by it.
- [x] Spike-light review: compliance + craft recorded pass.
- [x] Deviation log + reconciliation sweep under this slice heading.
- [x] `docs/refinement-todo.md` updated with the config-integrity requirement + the
      ADR-0006 gap it exposes.
- [x] **No live identifiers committed** (redact both tenants' ids) — the demonstration uses
      **synthetic** datastreams (`1111…` / `9999…`); no real datastream/org appears.

**Findings:** _Creds-free core demonstrated 2026-08-30 (`rig/config-integrity.js` +
`test/alloy-config-integrity.test.js`, stub-alloy units, **synthetic** datastreams — no live
traffic, no second tenant). AC1 (end-to-end real-Edge repro) deferred — needs a real second
datastream._

- **AC2 — config is CHAMBER-MUTABLE (creds-free).** Grounded in `connectors/alloy/connector.js`
  (`getAlloy()("configure", {datastreamId, orgId})`) + `core/connector-host.js` (`factory(config)`
  closure-captures the config once): the closure disciplines only *honest* connector code. A
  compromised chamber **owns the alloy instance** — it can re-`configure` alloy to an attacker
  datastream **or** bypass alloy and craft its own `?configId=<attacker>` fetch. The stub-alloy
  unit shows a re-pointed interact carries the attacker `configId` on the **same host**
  (`adobedc.demdex.net`) — so the host allow-list is **blind** to it (verified tenant-blind vs
  ADR-0004/0006 in the frame-critique: the tenant rides in `configId`, outside the host/path the
  seal keys on).
- **AC3 — the seam-side check is the enforceable mitigation (creds-free, demonstrated).**
  `checkConfigIntegrity(interactUrl, pinnedDatastream)` — run at the orchestrator's main-thread
  dispatch (ADR-0004), the chokepoint every intercepted interact crosses — pins the outbound
  datastream to the host-set value and **HOLDS at the seal on mismatch**. Demonstrated: a
  re-pointed chamber (whether via re-`configure` or a crafted bypass fetch) is **caught + held**
  even though it owns the alloy instance; honest egress (matching datastream) is allowed.
  **Host-owned-config-at-boot is necessary-but-NOT-sufficient** — it disciplines honest code, but
  a compromised chamber crafts its own fetch, which only the seam check catches.
  - **Robust shape (013-03 craft review).** A naive parse-and-compare **trusts the hostile
    chamber's own URL**, so it is evadable (parameter pollution `?configId=<honest>&configId=<attacker>`
    slips past a `.get()`; an omitted/encoded id). The demonstrated control therefore (a) **fails
    CLOSED** — absent / duplicated / mismatched configId all HOLD (`getAll`, not `get`); and (b)
    provides an **OVERRIDE** posture (`pinnedDispatchUrl`) that **re-derives** the dispatch URL with
    only the host pin, discarding whatever the chamber supplied — evasion-proof because it never
    trusts the chamber's value. **The ADR-0006 addition must say "re-derive / override," not
    "parse-and-compare."**
  - **Carry forward.** (i) the control must **bind at BOTH egress seams** (worker `mapBatch` + the
    unload fast path, ADR-0006 / OQ16), not just one; (ii) the **orgId/body co-vector** — datastream
    (`configId`) pinning controls Edge *routing*; the `orgId` in the body is identity-namespacing, a
    **residual** to close via read-minimization / body inspection if it proves routing-relevant.
- **AC1 — DEFERRED (creds-gated).** Proving real Edge *lands* data in an attacker tenant on the
  shared host needs a **real second** ("attacker") datastream on `adobedc.demdex.net` — not
  provided. A *simulated* second tenant begs the question (it assumes real Edge routes by
  `configId`, which is what AC1 proves), so AC1 is honestly deferred; the core finding + mitigation
  (AC2/AC3) are **not** blocked by it.
- **AC4 — recorded.** The config-integrity requirement (seam-side datastream pinning;
  host-owned-config + read-minimization as necessary-not-sufficient support) + the ADR-0006 gap
  (its endpoint ceiling is tenant-blind) land in `docs/refinement-todo.md`, feeding an ADR-0006
  config-integrity addition.

**Outcome:** `same-host tenant re-routing confirmed tenant-blind (creds-free, vs ADR-0004/0006);
config is chamber-mutable (the chamber owns the alloy instance); the SEAM-SIDE config-integrity
check (dispatch pins the outbound datastream → hold on mismatch) demonstrated to catch a
re-pointed / bypass chamber, host-owned-config necessary-not-sufficient; config-integrity
requirement filed for the ADR-0006 addition; AC1 end-to-end repro deferred (needs a real second
datastream)`.

### Deviation log

_2026-08-30._
- **AC1 deferred (creds-gated).** No real second ("attacker") datastream was available, and a
  *simulated* second tenant begs the question the frame-critique flagged. AC1 (end-to-end
  real-Edge repro) is deferred; AC2/AC3 (the load-bearing creds-free core) are delivered. Per the
  corrected DoD, AC1 is the only creds-gated AC and does not block the slice.
- **Mitigation reframed to the seam-side check.** Per the frame-critique, host-owned-config-at-boot
  alone can't bind a compromised chamber (it owns the alloy instance) — the demonstrated primary
  control is the seam-side integrity check (`rig/config-integrity.js`), with host-owned-config as
  necessary-not-sufficient support. New rig + test; `core/` untouched (the check is the MVP3
  enforcement deliverable, not wired into core yet — tracked debt).
- **Mitigation hardened post-review.** The craft review caught that a naive parse-and-compare
  **trusts the hostile chamber's own URL** (evadable by parameter pollution; fails open on an
  absent configId). Hardened to **fail-closed + pollution-aware (`getAll`) + an OVERRIDE posture**
  (`pinnedDispatchUrl` re-derives the dispatch URL from the host pin); the ADR-0006
  "re-derive not parse-and-compare", "bind at both seams", and "orgId/body residual" lessons are
  recorded (Findings + refinement-todo). Test grew 4 → 7 (pollution / absent / override cases).
- **Synthetic datastreams.** The demonstration uses synthetic UUIDs (`1111…` / `9999…`), not the
  real datastream — creds-free + no identifiers.

### Reconciliation sweep

Parallel-and-minimal holds — `core/` + `connectors/` + `contracts/` untouched; new rig
(`config-integrity.js`) + test only. Full suite green (465). `docs/refinement-todo.md` carries the
config-integrity requirement + the ADR-0006 tenant-blind gap. No `architecture.md` / glossary
drift. Tracked follow-ups (noted, not blockers): AC1 (live end-to-end repro with a second
datastream) + wiring the seam-side check into `core/` (MVP3 enforcement). No live identifiers
committed.

**Anti-horizontal-phasing check:** after this slice, MVP3's config-integrity requirement is
grounded in a **demonstrated** (or bounded) attack + a working mitigation — not a
hypothesis. Observable value: the re-routing attack + the seam-side config-integrity control
that stops it (with host-owned-config as necessary-not-sufficient support).
