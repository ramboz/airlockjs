---
status: DRAFT
dependencies: [038-01]
last_verified:
frame_review: true
---

## Slice 038-03 — credential/cookie context + per-cohort report (feeds E10)

**Goal:** Capture and report the **credential / cookie context** of the container's beacons per cookie cohort
(third-party-cookies-allowed vs blocked), producing the transport-parity signal ADR-0018 **E10** consumes. The harness
**observes and reports** the transport gap; whether airlock re-attaches a credentialed transport is the **E10 decision**
this slice feeds, not one it makes.

**DoR:**
- ✅ 038-01 done — capture + report exist.
- ✅ Grounded: airlock egress carries no cross-site cookies (`core/airlock.js` `fetchInit` sets only
  `method`/`body`/`keepalive` — the transport gap this slice makes visible).

**Acceptance Criteria:**

1. **Credential context captured.** For each captured vendor beacon, the harness records whether the attribution rode a
   **cross-site cookie** (`fr`, `IDE`, `_gcl_*`) vs **first-party params** (`_fbp`/`fbc`, `gclid`) — read from the
   network log's request cookie/credential context.
2. **Per-cohort classification.** The report classifies each attribution path as cross-site-cookie-dependent vs
   first-party-param, split by cohort: third-party-cookies-**allowed** vs **blocked**.
3. **The transport gap is flagged.** Where a cross-site-cookie-dependent path exists, the report flags that airlock's
   cookieless `fetch` egress would drop it — the gap made visible, per ADR-0018 (E10 "made visible, never absorbed").
4. **Output is the E10 input** — a per-vendor, per-cohort transport-parity table an ADR author reads to decide the
   credentialed-transport question. No live identifiers (cookie *names*/presence only, never values).

**DoD:**
- [ ] All ACs pass; full suite green.
- [ ] Coverage includes a beacon that rides a cross-site cookie (flagged as a gap) and one that rides only first-party
      params (no gap).
- [ ] Each new test shown to fail when its feature is removed.
- [ ] Reviewed by `reviewer` (compliance + craft).
- [ ] Deviation log + reconciliation sweep produced.

## Assumptions

- **Both cohorts require captures under both cookie regimes** — a blocked-cohort capture needs a session with
  third-party cookies disabled. Until both exist, the report covers only the captured cohort and says so. (Why
  `frame_review: true` — the cohort split is assumed until both captures exist.)

**Anti-horizontal-phasing check:** After this slice a developer gets a per-cohort transport-parity table showing which
attribution rides the cross-site cookie — the concrete, visible input the E10 credentialed-transport ADR is decided on.

### Deviation log (after reconciliation)

_TBD at implementation._

### Reconciliation sweep

_TBD at implementation._
