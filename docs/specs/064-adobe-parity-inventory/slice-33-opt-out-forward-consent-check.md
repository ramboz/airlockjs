---
status: READY_FOR_IMPLEMENTATION
dependencies: [064-30, ADR-0062, ADR-0064]
last_verified: 2026-11-20
---

## Slice 064-33 — the opt-out forward carries only the consent the page gave

**Goal:** After an explicit refusal, the seam forwards the `consent` part of Alloy's set-consent request only when it is the consent the page gave, so an untrusted chamber cannot send other data through the 068-02 opt-out exemption.

**DoR:**
- ✅ ADR-0062 amendment (068-02) built; the opt-out forward exists.
- ✅ 064-30 built (the page's full object now travels through the forward; ADR-0064 point 6).

**Acceptance Criteria:**

1. The adapter registers, each time it posts consent to the chamber, the `consent` value it expects on the wire: the page's object when the object is sent (together with the vector-shaped consent, which the chamber's one retry after a rejected object call puts on the wire), or the vector-shaped consent otherwise (boot-time denial, CMP `onChange`, direct `handle.setConsent`, the 064-30 fallback). It does so through a new vendor-neutral host method. Core compares the `consent` of a forwarded opt-out request with that opaque value (deep, key-order-insensitive) and forwards only on equality; otherwise it holds the request as any other. Shown by a hermetic test where the chamber changes a field of the forwarded `consent` and the request is held.
2. The rule is vendor-neutral: core reads the connector's declaration and the registered value, and knows nothing about Alloy's request shape (the `test/core-boundary.test.js` check stays green). This is a `core/` change and needs an ADR-0062 amendment note, or a new ADR if the owner wants one (stop and ask).
3. The 068-02 opt-out tests and the 064-30 full-object opt-out test stay green, and refusals with no page object (boot-denied, CMP, fallback, and the retry after Alloy rejects the object, with a hermetic test) still forward; a refusal still records at Adobe with the consent the page gave.
4. The `meta` key is forwarded unchecked too. This slice either constrains it (compared to a registered shape) or records it as a remaining risk in the ADR-0062 amendment note; the choice is stated in Findings.

**DoD:**
- `npm test && npm run lint` and servo gate pass.
- Real-browser tests, if any, run under `describe.runIf(process.env.AIRLOCK_REAL_CHROMIUM === "1")` with a GATING step in the `browser-oracle` job.

**Anti-horizontal-phasing check:** Vertical: a refusal from the page's `setConsent` through the chamber's set-consent to the forwarded request on the wire, with a tampered body held.

## Notes

Found by the ADR-0064 review: the 068-02 forward sends the `consent` subtree unchecked. Pre-existing, but 064-30 routes the page's richer object through it. This slice changes `core/`, so it stays vendor-neutral and is named in the ADR-0062 amendment.
