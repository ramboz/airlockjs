---
slice: 013-02 — egress-breadth fan-out
pass: frame-critique
verdict: pass
reviewer: general-purpose
reviewed_at: 2026-08-30T13:29:59Z
prompt_source: review.py frame-critique docs/specs/013-mvp3-live-alloy-reprobe/spec.md 013-02 slice-02-egress-fanout.md
---

## Frame-critique — slice 013-02 (egress-breadth fan-out)

**Round 1 verdict: needs-changes** (general-purpose reviewer, bounded ≤7-file context:
ADR-0006, 012-04 §Findings, egress-confinement.js, alloy-chamber.worker.js, R-004). Five
findings; **1/3/5 compounded into one load-bearing frame failure** — a headless-chamber-only
live run *structurally under-observes* the fan-out. All applied.

### Findings + resolution

- **[3] highest — the confinement check had no bucket for the fan-out's actual surface.**
  demdex/AAM partner syncs classically fire as **DOM-injected `<img>` pixels** (the
  cross-origin GET carrying the 3rd-party cookie — must be client-side, not a same-origin
  `fetch`). In the no-DOM chamber that hits the no-op DOM shim (`createElement('img')`→`makeEl`,
  `.src=`/`appendChild` inert) or `new Image()` throws — **invisible**: not `fetch`-routed, not
  thrown-as-blocked. So the chamber could report "fan-out = interact + 0, all confined" — a
  **false negative** mislabelling shim-suppression as confinement. **Fix:** AC1 now captures the
  true fan-out via a **real-DOM main-thread reference run** (the grounding 012-04 Axis-2 already
  uses for shim-invisible behavior); AC2 gains a **third outcome — shim-swallowed** (confined /
  escaped / swallowed), with mislabelling-as-confined named as the failure it prevents.

- **[1] over-scoped as standing-creds-gated + under-specified capture + multi-hop.** Like
  013-01, classifying a *captured* fan-out needs no creds — only the capture does. But 013-02
  can't copy 013-01's *single-response* capture: the partner fan-out is plausibly **multi-hop**
  (interact → demdex `/id` → partner-URL list → partner fires), so one response reproduces only
  the first hop; and the 012-01 chamber short-circuits `interact` to a *stub*, so "reuse the
  chamber" won't follow the live chain. **Fix:** Time-box/DoR now split a **one-time
  creds-gated full-chain capture** (dispatcher repointed at real Edge, redacted multi-response
  fixture) from **creds-free replay**, and name the multi-hop + real-Edge-dispatcher
  requirement.

- **[5] the hedge let the spike launder an under-count.** Fan-out breadth tracks the org's AAM
  third-party-**destination** config; a fresh test/dev org typically has **~zero** partner
  destinations → the demdex fan-out won't fire, and "honestly bounded if a sync doesn't fire"
  let that pass as DONE. Combined with [3], two independent mechanisms drive the count back to
  the single `interact` host — reproducing the R-004 artifact ADR-0006 + 012-04 explicitly flag
  as "not evidence of narrowness," now re-dressed as live-validated. **Fix:** new **AC4 validity
  floor** — a zero-sync result is a config artifact + **lower bound**, *never* evidence of
  narrow egress; test-org-vs-production divergence named as a validity risk; the enforcement
  design **barred** from reading the test-org count as ceiling cardinality. DoR carries the ⚠
  destination-config warning.

- **[2] AC3's enumerability binary was mis-cut.** "Server-directed → advisory/FLOOR" is
  ADR-0006's settled prior; the fact that would flip it to an *authoritative* ceiling is not
  static-URL enumerability but **bounded origin cardinality + roster stability** (a fixed
  Adobe-owned origin set — the middle granularity ADR-0006's own open questions float).
  **Fix:** AC3 recut to measure **origin cardinality + roster stability** as the discriminating
  fact, not URL-enumerability.

- **[4] sound — no finding.** Honestly scoped measure→record with a real downstream (update
  012-04 Axis-1 + refinement-todo); no production seam smuggled in.

### Net
The fix was architectural, not wording: the true fan-out must be captured **once** via a
real-DOM main-thread reference run over the **full live chain**, fixtured redacted, then
answered **confined / escaped / shim-swallowed** + origin-cardinality creds-free on replay —
with a floor that forbids a null test-org result from reading as "narrow." A cross-cutting
spec.md Assumptions constraint (real-DOM run + destination-config validity) was added.
