---
status: DONE
dependencies: [064-33, 068-03]
last_verified: 2026-11-24
review_reopened_at: 2026-11-24T22:50:26Z
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

### Deviation log

Replaced the first pass's never-consumed generation list with request-correlated consumption (the matched generation and older ones leave on dispatch) after the acceptance hold; ADR-0062 is untouched apart from a dated Corrections entry. Details in Findings.

### Reconciliation sweep

Reconciled: spec.md, CHANGELOG, slice-33 annotations, ADR-0062 Corrections, the status board and the slice-34 history file. No core/ change, so nothing lands on main first.

## Notes

Found by the 064-33 craft review. Any change to how `core/` stores registrations lands on main first (vendor-neutral); an adapter-only approach (registering both generations until the next request) needs no core change.

## Findings

**Design.** Adapter-only, `core/` unchanged (`git diff bcaccab7.. -- core/` is empty), so it stays on vendor-adobe. Every consent update (`setConsent`, `setAdobeConsent`) adds a *generation*: the page's object (if one was posted) plus the vector-shaped consent; an update identical to the last update (remembered even after its generation was consumed) adds none. The host registration is the flattened union of the live generations, passed to core's replacing `expectOptOutConsent`. **Lifetime is request-correlated, against Alloy 2.31.1's own behaviour** (read from the pinned bundle and confirmed in real Chromium): `setConsent` runs through a serialized task queue, so requests leave in order, and a request is sent only when the consent differs from the last one stored (a repeated identical consent sends none; an object Alloy rejects sends none and the chamber's vector retry is the request). So when a request reaches `dispatch` (only after the host gates pass), the oldest generation holding its `consent` (key-order-free) and every older generation are consumed. A value already sent is held when replayed. There is no timer and no cap; every registered value is one the page gave, and the host forwards an opt-out only while consent is denied, so a value no update produced is still held.

**AC1 (hermetic, `test/alloy-adobe-consent.test.js`, describe "064-34").** "setAdobeConsent then setConsent" and "two setAdobeConsent calls" fail on the 064-33 code (the first request is held) and pass now; a never-registered value is held in both. Further tests: retirement once a newer update's request has left; a key-reordered request matches and retires; a value repeated in a later update does not retire one still in flight; a value already sent is held when replayed, and a later update still adds; the same update given again after its request left adds nothing; **post-settlement**: 25 cycles of A/B each forward exactly once and a replay of both afterwards is held (the registration does not grow). Mutation checks: no consumption fails 6 tests, keeping the matched generation (consuming only older ones) fails 4, removing the repeat skip fails 1, bypassing core's compare fails 9.

**AC2 (real Chromium, `test/adobe-064-34-consent-refusal-chromium.test.js`, GATING step in `browser-oracle`).** Stock Alloy 2.31.1, SYNTHETIC responses, 0 captures. The wire body equals stock's and the page's own object, alone and for a same-tick pair (in order). **This test is green on the 064-33 code too**: in real Alloy the first request leaves before the second registration, so it is a wire-equals-page-object check, not the regression proof. The red regression is the hermetic AC1 pair. A real-Chromium probe (not committed) showed stock Alloy sends one request for `A, A` and for `A` then a later `A`, and `[A, B, A]` sends three; the adapter's duplicate skip mirrors that (a repeat of the last update adds no generation, even after the first was consumed), and a hermetic test pins it. The chain is: hermetic tests show what is registered is the page's object; the real-Chromium test shows what reaches the wire is that object. It does not read the registration directly.

**Deviations from earlier slices.** (1) The 064-33 test "a later `handle.setConsent` drops the page object" now asserts the object still forwards while its request may be in flight (the vector request consumes the boot generation, not the object's); 064-33's "stays registered until the next update" now reads "until a request carrying its consent leaves". The 064-33 retry test now sends the vector alone: the retry exists only when Alloy rejected the object, which sends no object request. (2) The 068-03 AC4 re-register test in `test/opt-out-consent-registration.test.js` expects accumulation on vendor-adobe; core's replace semantics are unchanged, so this file may conflict when main next changes it. (3) ADR-0062 is Accepted, so its text is unchanged; a dated entry under its new "Corrections" heading records the Adobe adapter's behaviour.

**Residuals.** An update whose request never leaves (a rejected object whose retry never comes, a refusal the page withdrew, or a chamber that sends nothing) keeps its generation until a later request consumes it; each new distinct update adds one generation, so with no request reaching `dispatch` at all the list grows by the page's own distinct updates, and the next request that gets through clears everything up to its match; there is no timer or cap, and it never lets a value the page did not give through. Not checked against the bundle: whether Alloy stores a consent whose request failed on the network (the repeat skip assumes it does; if not, the repeat is held, the safe side). Accepted edge: a vector retry that arrives after a newer update's request has consumed its generation is held, which matches stock's final state (the older value would overwrite the newer). The vector retry after a rejected object followed by the same vector again as a later update can also linger (Alloy stored it already), bounded to that one generation. A compromised chamber can send such a not-yet-consumed page value while consent is denied. Consumption assumes Alloy sends consent requests in order, which its task queue guarantees; the oldest-match rule errs toward keeping registrations.

**Reviews (Opus 5.5, `reviews/slice-34-*.md`).** Original round 1 and 2 wording is kept in `reviews/slice-34-history.md`; the current verdict files are the round 3 results on the full final diff, recorded with `review.py record-review`. Scout was unavailable to reviewers; they read the provided source and diff. The first design (generations that retire only when a *newer* generation's request leaves) was put on hold: matched generations were never consumed, so repeated values could stay registered forever. This remediation is the third and last round.

**Quality gate.** Servo `quality-gate` skill (`gate.py . --json`) on the final source: exit 0, status pass, composite 1.0, threshold 1.0. (`oracle.sh` alone is not that receipt.)
