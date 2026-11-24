---
status: DONE
dependencies: [064-33, 068-03]
last_verified: 2026-11-24
---

## Slice 064-34 — an opt-out in flight for a superseded consent update still forwards

**Goal:** A refusal the chamber sends for a consent update that a newer update has already replaced is not held, so a quick sequence of updates records at Adobe as stock does, with no widening of what the chamber may put on the wire.

**DoR:**
- ✅ 064-33 built (the adapter registers the object and the vector; core's `expectOptOutConsent` replaces the registration on each call).
- ✅ 068-03 built (`host.expectOptOutConsent`, the checked forward).

**Acceptance Criteria:**

1. When the page updates consent twice in one tick (`setAdobeConsent` then `setConsent`, or two `setAdobeConsent` calls), the chamber's set-consent request for the first update still forwards and the newer one does too, while a value that was never registered is still held. Shown by a hermetic test that fails on the 064-33 code (the first request is held).
2. A real-Chromium check, behind `describe.runIf(process.env.AIRLOCK_REAL_CHROMIUM === "1")` with a GATING step in the `browser-oracle` job, shows the refusal Alloy puts on the wire for the page's Adobe 2.0 object equals the registered object, using a SYNTHETIC response (stop and report `blocked` if a new live capture is needed).

**DoD:**
- `npm test && npm run lint` and servo gate pass.

**Anti-horizontal-phasing check:** Vertical: two quick consent updates through the chamber to both forwarded requests on the wire.

## Notes

Found by the 064-33 craft review. Any change to how `core/` stores registrations lands on main first (vendor-neutral); an adapter-only approach (registering both generations until the next request) needs no core change.

## Findings

**Design.** Adapter-only, `core/` unchanged (`git diff bcaccab7.. -- core/` is empty), so it stays on vendor-adobe. Every consent update (`setConsent`, `setAdobeConsent`) adds a *generation*: the page's object (if one was posted) plus the vector-shaped consent. The host registration is the flattened union of the live generations, passed to core's replacing `expectOptOutConsent`. When a request reaches `dispatch` (only after the host gates pass), its `consent` is matched, key-order-free, to the **oldest** generation holding that value and every older generation retires. The newest generation never retires, there is no timer, and an update that repeats the last generation adds nothing. Every registered value is one the page gave, and the host forwards an opt-out only while consent is denied, so a value no update produced is still held.

**AC1 (hermetic, `test/alloy-adobe-consent.test.js`, describe "064-34").** "setAdobeConsent then setConsent" and "two setAdobeConsent calls" fail on the 064-33 code (the first request is held) and pass now; a never-registered value is held in both. Further tests: retirement once a newer update's request has left; a later update still adds a generation; a value repeated in a later update does not retire one still in flight, and a key-reordered request matches. Mutation checks: no retirement fails 2 tests, bypassing core's compare fails 9, `findLastIndex` fails 2.

**AC2 (real Chromium, `test/adobe-064-34-consent-refusal-chromium.test.js`, GATING step in `browser-oracle`).** Stock Alloy 2.31.1, SYNTHETIC responses, 0 captures. The wire body equals stock's and the page's own object, alone and for a same-tick pair (in order). **This test is green on the 064-33 code too**: in real Alloy the first request leaves before the second registration, so it is a wire-equals-page-object check, not the regression proof. The red regression is the hermetic AC1 pair. The chain is: hermetic tests show what is registered is the page's object; the real-Chromium test shows what reaches the wire is that object. It does not read the registration directly.

**Deviations from earlier slices.** (1) The 064-33 test "a later `handle.setConsent` drops the page object" now asserts the object still forwards while its request may be in flight; because the vector sits in both generations, a vector request retires nothing. 064-33's "stays registered until the next update" now reads "until a request carrying a newer generation's own consent leaves". (2) The 068-03 AC4 re-register test in `test/opt-out-consent-registration.test.js` now expects accumulation (`[n, y]`, then `[n, y, n]`) on vendor-adobe; core's replace semantics are unchanged, so this file may conflict when main next changes it.

**Residuals.** Generations grow while no request carrying a distinct consent leaves (bounded by the page's updates). Retirement assumes Alloy sends consent requests in order; the oldest-match rule errs toward keeping registrations. A compromised chamber can send a superseded page value (one the page gave, while consent is denied) until a newer generation's request retires it.

**Reviews (Opus 5.5, `reviews/slice-34-*.md`).**
- Round 1 (a9e52864): compliance approved, craft changes-requested, reconciliation changes-requested (docs pending). The craft and compliance findings on repeated values (over-retirement) and key-order compare led to the cd4fba06 fix.
- Round 2: compliance, craft and reconciliation approved; the remaining low findings are accepted and listed in each file. Maximum rounds not exceeded.
