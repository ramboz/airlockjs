---
status: DRAFT
dependencies: [012-01]
last_verified:
frame_review: true
arch_review: true
---

<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about
     runnable surfaces by probe first (run it / read source) or a citation. -->

## Slice 012-02 — concurrent-chamber mint coalescing (lift ADR-0008's hold)

**Goal:** With the wrapped-SDK host + intercepted egress from 012-01, drive **two
concurrent chambers** both first-minting identity, and build
[ADR-0008](../../decisions/adr-0008-oq9-coherency-sync-access.md)'s **broker-side async
request coalescing + XDM mint-recognition** so both chambers attach **one** ECID, not
two — retiring the concurrent-first-mint **split-identity fault** for the async mint,
demonstrated against the minting-Edge stub. This turns ADR-0008's *analytical* GO into
a *demonstrated* one and **lifts the wrapped-SDK contract-freeze hold**.

**DoR:**
- ✅ 012-01 DONE — the wrapped-SDK host, the chamber, the additive sync-cookie
  capability, and alloy's `fetch` intercepted into the orchestrator's main-thread
  dispatch all exist and are proven for a single chamber.
- ✅ ADR-0008 records the mechanism to build: broker-side async request coalescing
  (single-threaded broker holds the second concurrent mint, returns the first's ECID),
  conditional on (i) fetch-interception into the orchestrator's dispatch — delivered by
  012-01 — and (ii) XDM mint-recognizability — built here. Kill-criteria (ADR-0008):
  the XDM must be reliably parseable to recognize the mint.
- ✅ [spec 011](../011-mvp2-coherency-probe/spec.md) rig/model as the measurement
  reference (`rig/coherency-model.mjs`, `rig/coherency.mjs`) — the abstract mint
  model this slice makes concrete for real alloy chambers.

**Acceptance Criteria:**

1. **Baseline fault reproduced (no coalescing).** Two chambers both read an empty
   identity and both first-mint → **two** intercepted `interact` requests → **two**
   distinct ECIDs → split identity. Observable, deterministic: the detector reports the
   fault for the two-chamber concurrent case with coalescing off.

2. **Broker-side async request coalescing built.** When a second identity-mint
   `interact` arrives at the broker while a first mint is in flight, the broker
   **holds** it and, on the first's response, returns the **one** server-assigned ECID
   to **both** chambers — issuing **no** second Edge request. Observable: **exactly one**
   `interact` egresses for two concurrent chambers; both attach the **same** ECID; the
   detector reports **no** fault.

3. **XDM mint-recognition.** The broker parses the vendor XDM `interact` to recognize an
   **identity mint** (`query.identity.fetch` of ECID) as coalescable, distinguishing it
   from a non-mint `interact`. Observable: a non-mint `interact` is **not** coalesced
   (passes straight through); two concurrent **mints** are coalesced to one.

4. **No SAB / async-only.** The coalescing uses only the broker's single-threaded
   serialization + an async hold — **no SharedArrayBuffer, no COOP/COEP** (AD-4). It
   rides the Option-B two-Worker topology from 012-01 and is model-independent (the
   coalescing point is the broker), per ADR-0008. Observable: no `SharedArrayBuffer`
   reference on the path; the mechanism works with two independent dedicated-Worker
   chambers.

5. **Detector fails both ways, reproducibly.** Coalescing **off** → split-identity
   fault; coalescing **on** → one ECID, no fault. Both outcomes are deterministic and
   retrievable programmatically (against the minting-Edge stub — no live creds).

6. **Freeze hold lifted; kill-criteria checked.** Record that ADR-0008's mechanism is
   now **built + demonstrated**, lifting the wrapped-SDK contract-freeze hold for the
   identity path. Explicitly check ADR-0008's kill-criteria against the *stub* XDM and
   flag the residual: the **live-Alloy** XDM shape is not re-verified here (creds-gated),
   so mint-recognizability against real Alloy is a carried-forward validation, not a
   closed one. Update `docs/refinement-todo.md` OQ9 accordingly.

**DoD:**
- [ ] ACs 1–6 pass; full suite green (012-01 path + GA4 no regressions).
- [ ] Each new test shown to fail when its feature is removed (coalescing off → red).
- [ ] Reviewed by `reviewer` subagent; **compliance + craft + arch** recorded (arch: the
      broker gains a coalescing/in-flight-mint table — a runtime-boundary change).
- [ ] Frame-critique recorded — the "one interact, one ECID, model-independent, no SAB"
      claim is the framed premise; the stub-vs-live-Alloy gap is honestly bounded.
- [ ] Deviation log + reconciliation sweep; reconciliation review passed.
- [ ] `docs/refinement-todo.md` OQ9 updated: mechanism demonstrated → wrapped-SDK
      freeze hold lifted; live-Alloy mint-recognition carried forward.

**Anti-horizontal-phasing check:** after this slice, **two alloy chambers share one
identity** — the split-identity fault ADR-0008 identified is demonstrably retired by the
built mechanism, and the contract-freeze hold is lifted on evidence, not argument.
Observable value: coherent identity across chambers, shown.
