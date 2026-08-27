---
status: Accepted
dependencies: []
last_verified: 2026-08-27
frame_review: true
---

# ADR-0005: Servo oracle design: AND-gate, isolation routing, and flicker (OQ6)

## Status

Accepted (2026-08-27)

## Context

Spec 007 (drive-order steps 8–9) wires the three servo oracle components named
in [architecture.md:65](../architecture.md) and stands up CI, so a
servo-unattended loop has a runnable truth-source. Authoring and implementing
those components surfaced three load-bearing design choices that are not
localized to one component — they define how the oracle *gates* and how each
component is *routed* (servo-unattended vs jig-supervised). This ADR records
all three together because they share one theme ("how strong is each oracle,
and how does the composite gate?") and because two of them were forced by
spec-007 frame-critique findings that overturned the spec's first framing.

Concrete state this ADR is grounded on (all probe-verified during spec 007):

- The `/servo:scaffold-init` Tier-0 [oracle.sh](../../oracle.sh) is a **weighted
  mean**: each component is a `score_<name>()` returning `[0.0, 1.0]`, registered
  `"<name>:<weight>"` in `COMPONENTS`, composite `= Σ(w·score)/Σ(w)`, gated
  `composite ≥ THRESHOLD` (exit 0 ≥, 1 <, 2 env-error). There is **no built-in
  non-gating tier** and nothing constrains a `score_*` to be binary.
- The chamber's no-DOM guarantee ([chamber.worker.js](../../core/chamber.worker.js),
  ADR-0001) is a **browser-Worker realm property**: in Node (the vitest env,
  which has no jsdom) `document` is absent regardless of the chamber, so a Node
  test asserting "touching `document` throws" is true even with the airlock
  removed — vacuous.
- The MVP1 CWV numbers are single-run, machine-dependent measurements from the
  risk-retirement spike (003): worker INP p75 ~8 ms ties the rIC-deferred
  control; the naive multi-tracker stack was ~152 ms; TBT 0 / CLS 0; drain-stage
  delivery 300/300 under storm. Spec 003 itself declares absolute INP
  machine-dependent and only the *delta between two runtimes* load-bearing
  (003/spec.md:56-57, R-005).
- The structural no-flicker invariant already exists and is automatable
  ([rig/uc1.mjs](../../rig/uc1.mjs): experiment applied before `body:appear`,
  both arms); the *perceptual* half is a screenshot the spike left to human
  review (OQ6).

## Decision Options Considered

This ADR settles three coupled sub-decisions. For each, the rejected
alternative is what a future agent would most plausibly "restore" without this
record.

### D1 — How does the servo-unattended composite gate?
- **Chosen: AND of binary checks (`THRESHOLD=1.0`).** Gating components return
  exactly `1.0`/`0.0`; at `THRESHOLD=1.0` the weighted mean equals `1.0` iff
  *every* component passes, so any single `0.0` fails the composite.
  - **Pros:** a hermetic MUST-pass check (e.g. GA4 conformance) can never be
    diluted to green by other passing components; matches the semantics a
    servo-unattended gate needs.
  - **Cons:** a single flaky component fails the whole gate (acceptable — you
    should not race variants on a flaky suite); the binary invariant is a
    convention `oracle.sh` does not enforce (a future fractional score would
    make `THRESHOLD=1.0` a near-impossible bar).
- **Rejected: the scaffold default (soft weighted mean, `THRESHOLD=0.5`).** A
  broken hermetic component scoring `0.0` beside a passing one averages to `0.5`
  and *passes* — the gate goes green on a real conformance defect (07-01
  frame-critique caught exactly this). A per-component hard-fail short-circuit
  in the template was also considered and deferred as unnecessary for MVP1
  (all gating components are binary).

### D2 — Where does `isolation_invariant` run, and does it gate the composite?
- **Chosen: a real-Worker browser rig, gated in browser CI — NOT an `oracle.sh`
  `COMPONENTS` entry.** `rig/isolation.mjs` loads the unmodified chamber into a
  real chromium Worker and asserts a bare `document` reference throws
  `ReferenceError` in the *same* realm that runs `mapToMp`.
  - **Pros:** faithfully asserts the airlock's placement choice (Worker realm),
    not the generic platform fact; exercises the shipped chamber.
  - **Cons:** needs Playwright/chromium (not hermetic), so it cannot be a
    servo-unattended hermetic gate — it gates the browser-CI job instead.
- **Rejected: a hermetic Node/vitest `COMPONENTS` entry.** Vacuous — Node has no
  `document` regardless of the chamber, and MVP1's chamber has no
  arbitrary-connector seam to exercise (07-02 frame-critique).

### D3 — Flicker oracle strength (OQ6), and how are CWV budgets pinned/routed?
- **Chosen: structural flicker invariant automated + gated in browser CI; the
  perceptual (screenshot) half stays human-reviewed. `cwv_budget` is
  jig-supervised — a separate advisory invocation, never in `COMPONENTS`. INP is
  budgeted as a cross-invocation, median-of-N delta vs the rIC-`deferred`
  control within a tolerance band; TBT/CLS as before/after Lighthouse deltas;
  delivery as a drain-stage rate.**
  - **Pros:** the statistical, rIC-protected CWV signal never auto-fails a
    servo-unattended variant race; the perceptual proxy-gap is owned by a human
    rather than a brittle pixel-diff; the INP budget is measured the way spec
    003 says is load-bearing (a delta), on the same machine per run.
  - **Cons:** CWV regressions surface for judgment rather than blocking; a
    human-review step remains in the loop for flicker.
- **Rejected: auto-gate the perceptual screenshot diff, and/or pin an absolute
  INP threshold.** A pixel-diff gate is the widest proxy-gap in the demo and
  would flap; an absolute INP threshold checked on CI-runner hardware goes red
  on *environment*, not regression (07-03 frame-critique).

## Recommended Decision

Adopt D1 + D2 + D3 as above. In one sentence each:

1. **The servo-unattended oracle is a logical AND of binary hermetic checks**
   (`THRESHOLD=1.0`); gating `score_*` components MUST return `1.0`/`0.0`.
2. **`isolation_invariant` is a real-Worker browser-CI gate, not a hermetic
   `COMPONENTS` entry.**
3. **Flicker/CWV is jig-supervised:** structural flicker gates in browser CI,
   the perceptual half is human-reviewed, and `cwv_budget` is an advisory
   invocation outside the gating composite, with INP pinned as a same-machine
   cross-invocation delta.

Pinned `cwv_budget` budgets (from `rig/cwv-budget.mjs`, re-confirmed on the
current tree): **TBT** before/after delta ≤ 50 ms (observed 0); **CLS** ≤ 0.01
(observed 0); **INP p75** `median(worker) − median(deferred)` within a **±30 ms**
tolerance band (observed 0 — both medians 8 ms; the band swamps the 0–8 ms
cross-run noise and sits far below the ~144 ms a regression to naive-stack levels
would show); **drain-stage delivery** ≥ 99 % under storm (observed 100 %), with
the `pushCritical` fast path (5/5) and ring-tail flush (50/50) delivering full
count.

**What the INP budget can and cannot detect (be honest about the proxy).**
Because the ±30 ms band is ~4× the entire worker-vs-`deferred` signal (0–8 ms),
this advisory budget detects a **catastrophic INP collapse** — a regression
toward the naive-stack ~144 ms — and **not** the fine worker-vs-`deferred`
margin, which sits below the cross-invocation noise floor (spec 003's own kill
criterion, "noise swamps the delta", predicts exactly this). Do not read a green
INP budget as a sensitive regression watch on the worker-vs-control margin; it is
a coarse "did the runtime fall off a cliff?" check, and it is advisory (never
gates), so a missed sub-30 ms drift misdirects nothing downstream.

The only servo-unattended-strong+hermetic component in MVP1 is therefore
`ga4_mp_conformance`. This is an honest narrowing of the release plan's "two
servo-unattended-strong components" framing.

## Consequences

**Becomes easier:**
- A servo-unattended loop can trust `bash oracle.sh` as a hard gate: any
  hermetic failure fails it, none is diluted.
- Routing is legible: `oracle.sh` `COMPONENTS` holds only hermetic gating
  checks; browser-realm and statistical checks live in CI/rig invocations that
  cannot silently become servo-unattended gates.
- CWV regressions and flicker are reviewed by the discipline that can actually
  judge them (human / jig-supervised), not auto-blocked by a noisy proxy.

**Becomes harder:**
- Adding a *fractional* gating component later requires revisiting D1 (either a
  per-component hard-fail short-circuit, or a documented non-1.0 threshold) —
  the binary invariant is a convention, guarded only by a comment at
  `COMPONENTS`.
- The flicker perceptual half and CWV budgets need a human in the loop; they
  are not part of the unattended gate.

## Assumptions

- **The Tier-0 `oracle.sh` weighted-mean shape is as probed above** (verified by
  reading the scaffolded file; A1 in spec 007). If a future `/servo:scaffold-init
  --force` re-emits `oracle.sh`, the hand-set `THRESHOLD=1.0` (which lives
  *outside* the SEED blocks) could reset to 0.5 — a warning comment marks this at
  the line.
- **The pinned CWV numbers hold on the current tree** — re-confirmed by
  `npm run cwv:budget` (exit 0); they are single-machine and will differ in
  absolute terms on other hardware, which is exactly why INP is a delta and CWV
  is advisory, not a gate.

## Kill criteria

- If a future gating component genuinely needs a *fractional* score (not
  binary), D1's AND-via-`THRESHOLD=1.0` is the wrong shape — revisit with a
  per-component hard-fail mechanism.
- If MVP2 runs untrusted vendor JS in a chamber (alloy / wrapped-SDK, OQ1), the
  isolation guarantee D2 asserts (realm placement of one pure function) is too
  weak — a containment/permission oracle is needed, superseding D2's scope.
- If the perceptual flicker proxy is later made reliable enough to gate
  unattended (a stable, low-flake screenshot diff), D3's "human-reviewed"
  routing should be revisited.

## Open questions

- The `cwv_budget` INP tolerance band (±30 ms) and `N` (=3) are pinned from
  observed noise on one machine; a future run on CI hardware may want a wider
  band or larger `N`. This is advisory, so it is tuned, not gated.
- The `rig/harness.html` `pct()` p75 is a crude nearest-rank estimator over
  small samples — fine for an advisory delta where both sides use the identical
  estimator, but not a calibrated percentile.
