---
status: DONE
kind: spike
dependencies: []
last_verified:
---

## Slice 004-01 — Worker + Trusted Types under the EDS CSP

**Question:** does `new Worker(new URL("./chamber.worker.js", import.meta.url),
{ type: "module" })` instantiate **and run one cycle** (post a batch in, get a
mapped request back) under the EDS boilerplate's real CSP
(`script-src 'nonce-aem' 'strict-dynamic' 'unsafe-inline' http: https:`, **no
`worker-src`**) with `require-trusted-types-for 'script'` active — and if not, what
is the minimal accommodation?

**Time-box:** half a day. This is cheap to probe and gates the whole spec; do not
gold-plate — answer the question and record it.

**Goal:** a reproducible verdict (worker runs / worker blocked + the exact reason)
on the real testbed page, plus the pinned CSP/TT requirement the rest of the spec
builds against.

**DoR:**
- ✅ Spike runtime exists (`core/airlock.js`, `core/chamber.worker.js`) and the
  testbed carries the boilerplate CSP + TT (`probes/eds-testbed/head.html`,
  `index.html`).

**Acceptance Criteria:**

1. **Executed under the real CSP.** A Playwright probe loads a testbed page that
   carries the boilerplate CSP + `require-trusted-types-for 'script'` (not a relaxed
   local variant), boots the airlock runtime, and captures any CSP violation or
   TrustedTypes `TypeError` (via `securitypolicyviolation` events + page errors).
2. **Worker cycle attempted end-to-end.** The probe pushes one event and waits for a
   mapped GA4 request to come back from the worker (or a definitive failure),
   distinguishing three outcomes: worker **constructed + cycled**, worker
   **construction blocked** (CSP/TT), or worker **constructed but cycle failed**.
3. **Verdict recorded.** The result (which outcome, the exact violated directive or
   TT sink if blocked) is captured in the spec Findings.
4. **Accommodation pinned if blocked.** If the worker is blocked, the slice pins the
   minimal fix (e.g. add `worker-src 'self' blob:`; or route the worker URL through
   the `default` TT policy; or a documented no-worker fallback) and whether it is
   within the site owner's control (the CSP ships from the EDS pipeline / `head.html`).

**DoD:**
- [x] ACs 1–4 answered; the probe is reproducible (`npm run rig:csp`).
- [x] Findings record the verdict (worker RUNS under the unmodified boilerplate CSP;
      no accommodation needed).
- [x] Spike-light review (as spec 003): self-verified against ACs, full review
      deferred; deviation log + reconciliation sweep (below).
      `JIG_REVIEW_EVIDENCE_GATE=0` for the lifecycle transition, noted here.

**Findings:**
- **The worker RUNS under the unmodified EDS boilerplate CSP** — `new Worker(new
  URL("./chamber.worker.js", import.meta.url), { type: "module" })` constructs AND
  cycles a mapped GA4 request under an **enforced** `script-src 'nonce-aem'
  'strict-dynamic' … ` (no `worker-src`) with `require-trusted-types-for 'script'`
  active. `npm run rig:csp` → `runs_under_boilerplate: true`, `egress: 2` (the
  worker-path `page_view` + the ADR-0004 `pushCritical` click both delivered), zero
  worker-related CSP violations. **No accommodation needed.**
- **The verdict is trustworthy — the CSP is provably enforced.** A negative control
  (a non-nonce'd inline `<script>`) was **blocked** with the exact violation
  (`Executing inline script violates … 'script-src 'nonce-aem' 'strict-dynamic'
  …'; 'unsafe-inline' is ignored … a nonce value is present`), so `strict-dynamic`
  is active — the positive result is not a header-not-applied false positive.
- **Why it works:** a same-origin module worker created by a nonce-trusted script
  is admitted (the dynamic-import trust chain), and the `Worker` constructor's
  TrustedScriptURL sink is satisfied by the boilerplate's `default` TT policy
  (`createScriptURL` passes the same-origin URL through). The probe replicates that
  default policy exactly (`rig/csp-probe.html`).
- **Caveat (honest scope):** the probe delivers the CSP as an HTTP header on a
  local static server with a static `nonce="aem"`; a live EDS deploy issues a
  per-request nonce and may add directives. The load-bearing tokens
  (`'strict-dynamic'`, absent `worker-src`, `require-trusted-types-for 'script'`)
  are reproduced faithfully; re-confirm on the real `aem up`/pipeline host when
  004-04's Lighthouse run puts the runtime on the served page anyway.

**Outcome:** `spec 004 unblocked — airlock worker runs under the unmodified EDS
boilerplate CSP + Trusted Types; no CSP accommodation required; R-005 open
question #3 answered (yes).`

**Anti-horizontal-phasing check:** after this slice, we **know** the airlock worker
can run on a real EDS page — the single fact the whole graduation rests on — and the
CSP/TT contract is confirmed, so no later slice discovers it the hard way.

### Deviation log

- Answered the spike's question with a stronger result than the plan assumed: the
  plan hedged toward a likely CSP accommodation; the probe found **none needed**.
  Kept the auto-escalation ladder (`worker-src 'self'` → `'self' blob:`) in the
  probe anyway so a stricter real-deploy CSP has a ready, tested answer.
- Added a **negative control** not in the original ACs — a non-nonce'd inline
  script that must be blocked — because a clean "it runs" verdict is untrustworthy
  without proof the CSP was actually enforced. This is the spike's honesty guard.

### Reconciliation sweep

| Artifact | Disposition | Rationale |
|----------|-------------|-----------|
| `docs/research/R-005-eds-no-flicker-eager-swap.md` | `updated` | Open question #3 (Worker under boilerplate CSP) answered — annotated. |
| `docs/specs/README.md` | `updated` | Regenerated by `workflow.py status-board` (004-01 → DONE). |
| `package.json` | `updated` | Added `rig:csp` reproducibility script. |
| `docs/architecture.md` / ADRs | `no-op` | No boundary/contract change; ADR-0001 plain-Worker assumption confirmed on a real CSP. |
| `docs/refinement-todo.md` | `no-op` | No new deferral; the risk was tracked in R-005, now answered. |
