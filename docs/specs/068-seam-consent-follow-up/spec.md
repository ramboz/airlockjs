---
status: IN_PROGRESS
skill:
use_cases: [UC-2, UC-6]
---

# Spec 068: Seam consent follow-up (ADR-0062 point 4 and the opt-out amendment)

> Follows [spec 067](../067-shared-seal-defaults/spec.md) (DONE). Implements two settled decisions; neither is re-opened here.
> Lands on `main` once, then `main` is merged into the three vendor branches.

## 0. Summary for the owner

**What changes.** The Alloy seam now does what ADR-0062 point 4 says: "Hold" means hold and flush on grant. A request held while consent is pending is sent exactly once when consent is granted, and dropped on a denial or at teardown. Separately, after an explicit refusal Airlock forwards Alloy's `collect: "n"` set-consent request (without the ECID identity fetch) so Adobe records the refusal. Everything else stays held.

**Why it matters.** Before this, a stale Alloy consent cookie plus a pending page lost the first interact after a grant, and Adobe never learned about a refusal.

**Main tradeoff.** A held Alloy fetch stays pending in the chamber until the decision, so the page event that triggered it waits too (bounded by the existing consent hold ring).

**What needs you.** Nothing. Both parts are settled: ADR-0062 point 4, and the owner decision of 2026-11-20, "Forward the opt-out only, via a narrow seam exemption (Recommended)".

## 1. Scope

In scope: `core/wrapped-sdk-host.js`, the Alloy connector's declared opt-out signal, the EDS adapter wiring and teardown, tests, ADR-0062 amendment note, refinement-todo.

Out of scope: the real-Chromium proofs of the vendor-adobe tests (a follow-up commit on `vendor-adobe`), any change to the consent hold ring cap (ADR-0062 point 6), GA4 and the pixel connectors (they have their own async seal).

## 2. Decomposition

| Slice | One line |
|---|---|
| [068-01](slice-01-flush-on-grant.md) | A pending seam hold keeps the fetch pending and flushes exactly once on grant |
| [068-02](slice-02-opt-out-forwarding.md) | A connector-declared opt-out signal is forwarded alone after an explicit refusal |
| [068-03](slice-03-opt-out-consent-check.md) | The opt-out forward carries only the consent the adapter registered (core and main adapter; Adobe part is 064-33) |

## 3. Decisions

Both are settled (see section 0). The mechanism choices are slice design:

- 068-01 is opt-in per host (`flushOnGrant`, Alloy only) and parks the original request in the host and re-runs it through every gate on the next `setConsent`, rather than replaying from the chamber, because the chamber's fetch rejects on hold and has no consumer later.
- 068-02 keeps core vendor-neutral: the connector declares the request path, one body marker and the keys that may leave; core only honours that declaration.

## 4. Definition of done

- `npm test && npm run lint` pass on Node 22, and the servo quality-gate passes.
- Each slice has an Opus 5.5 review (compliance, craft, reconciliation).
- Commit to `main` with Conventional Commits.
