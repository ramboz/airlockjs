---
status: READY_FOR_IMPLEMENTATION
dependencies: [064-33, 068-03]
last_verified: 2026-11-23
---

## Slice 064-34 — an opt-out in flight for a superseded consent update still forwards

**Goal:** A refusal the chamber sends for a consent update that a newer update has already replaced is not held, so a quick sequence of updates records at Adobe as stock does, with no widening of what the chamber may put on the wire.

**DoR:**
- ✅ 064-33 built (the adapter registers the object and the vector; each update replaces the registration).
- ✅ 068-03 built (`host.expectOptOutConsent`, the checked forward).

**Acceptance Criteria:**

1. When the page updates consent twice in one tick (`setAdobeConsent` then `setConsent`, or two `setAdobeConsent` calls), the chamber's set-consent request for the first update still forwards and the newer one does too, while a value that was never registered is still held. Shown by a hermetic test that fails on the 064-33 code (the first request is held).
2. A real-Chromium check, behind `describe.runIf(process.env.AIRLOCK_REAL_CHROMIUM === "1")` with a GATING step in the `browser-oracle` job, shows the refusal Alloy puts on the wire for the page's Adobe 2.0 object equals the registered object, using a SYNTHETIC response (stop and report `blocked` if a new live capture is needed).

**DoD:**
- `npm test && npm run lint` and servo gate pass.

**Anti-horizontal-phasing check:** Vertical: two quick consent updates through the chamber to both forwarded requests on the wire.

## Notes

Found by the 064-33 craft review. Any change to how `core/` stores registrations lands on main first (vendor-neutral); an adapter-only approach (registering both generations until the next request) needs no core change.
