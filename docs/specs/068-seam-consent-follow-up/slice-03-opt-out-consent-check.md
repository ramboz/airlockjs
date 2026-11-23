---
status: READY_FOR_IMPLEMENTATION
dependencies: [068-02, ADR-0062]
last_verified: 2026-11-23
---

## Slice 068-03: The opt-out forward carries only the consent the page gave (core and main adapter)

**Goal:** The 068-02 opt-out forward sends the chamber's `consent` and `meta` keys unchecked, so an untrusted chamber can put other data through the exemption. After this slice the host forwards a matching opt-out only when its `consent` value equals one the adapter registered as expected; anything else is held as any other request. This is the vendor-neutral part of 064-33 (owner direction 2026-11-23, from the ADR-0064 review). The Adobe-object part stays on `vendor-adobe` as 064-33.

**DoR:**
- ✅ 068-02 built (`optOutForward`, `ALLOY_CONSENT_OPT_OUT`).
- ✅ The owner decision of 2026-11-20 ("Forward the opt-out only, via a narrow seam exemption (Recommended)") stands; this narrows it.
- ⏳ Owner answer: record the rule as an ADR-0062 amendment note or as a new ADR (064-33 AC2). Phase 2 starts after it.

**New host method (the contract).** `host.expectOptOutConsent(values)` on `createWrappedSdkHost`'s returned handle:

- `values` is an array of JSON values, opaque to core. `null`, `undefined` or `[]` clears the registration.
- Each call replaces the previous registration (it is not additive), so the adapter calls it each time it posts consent to the chamber.
- With a `consentOptOut` declaration and no registered value, the opt-out is held (fail closed).
- Core compares the forwarded request's top-level `consent` with every registered value by deep equality: plain objects ignore key order, arrays keep order, primitives use `Object.is`-style strict equality. One equal value is enough. It never throws.
- Core never inspects the value's structure and knows nothing about Alloy's request shape.

**Acceptance Criteria:**

1. `expectOptOutConsent` exists as above. A matching opt-out whose `consent` equals a registered value is forwarded (068-02 behaviour: declared keys only, `opt-out-forwarded` diagnostic). Shown by a hermetic test.
2. A matching opt-out whose `consent` differs from every registered value (a changed field, an extra field, a changed array order or length, a different type) is held like any other request, counts as held and parks (068-01). Key order alone does not matter (equal). Shown by hermetic tests, including one where the chamber tampers a field of the forwarded `consent`.
3. With a `consentOptOut` declaration but no registered value (never called, or cleared), a refusal is held. A later registration applies to the next request; replacing the registration drops the earlier values.
4. The adapter (`adapters/eds/index.js`, `bootAlloy`) registers `shapeAlloyConsent(consentRef)` (the vector-shaped consent, `connectors/alloy/consent.js`) on every path that posts consent on `main`: at boot (so a boot-time denial forwards), on `handle.setConsent` (so the CMP `onChange` driver, which calls it, and a direct call are covered), and with no consent vector wired (`consentHoldOff`) it registers nothing. Shown by hermetic tests that a refusal on each path still forwards and a tampered body is held.
5. `test/core-boundary.test.js` stays green: `core/` holds no Alloy request shape, and the new method takes an opaque value.
6. The `meta` key: this slice records it as a remaining risk (see Notes), not a constraint, and states the choice in Findings; the ADR-0062 amendment names it.
7. The 068-01 and 068-02 tests are updated only to register the expected consent where the old behaviour forwarded without one (each such change noted in Findings); `test/wrapped-sdk-host.test.js`, `test/consent-hold-default.test.js`, `test/onetrust-consent-driver.test.js` and `test/contract-stability.test.js` stay green.

**Out of scope:** the page's Adobe 2.0 object and the chamber's retry (064-33 on `vendor-adobe`, because `setAdobeConsent` and the 064-30 path exist only there); the ADR-0063 allowlist; the real-browser proofs of the opt-out (064-33).

**DoD:**
- `npm test && npm run lint` and servo gate pass on Node 22.
- Three fresh Opus 5.5 reviews saved under `reviews/`.
- The owner's answer is recorded (ADR-0062 amendment or ADR-0066), `docs/architecture.md` names the host method, CHANGELOG Unreleased has the entry.
- Findings name the test for each AC and each fix, and say which are real-Chromium and which are hermetic.

**Consumers:** 064-33 on `vendor-adobe` (depends on this slice).

**Anti-horizontal-phasing check:** Vertical: a refusal from the adapter's consent registration through the chamber's set-consent to the host's forward decision, with a tampered `consent` held.

## Notes

**Why `meta` is a recorded risk.** Alloy's `meta.state.entries` mirrors the page's cookie state (names and values that change per session), so there is no fixed value to register, and a structural check would be Alloy-specific, which core must not be. The residual: a hostile chamber can still put data into `meta` of a refusal request that goes to the already-allowlisted Adobe endpoint (the ceiling and config-integrity gates still apply). Keeping `meta` follows the owner's 2026-11-20 choice.

**Draft amendment wording (ADR-0062, not yet applied).** "Opt-out forwarding is checked (2026-11-23). The forwarded request's `consent` must equal a value the adapter registered through `host.expectOptOutConsent`; otherwise the request is held. The value is opaque to core. With no registration the opt-out is held. `meta` is still forwarded unchecked, a recorded residual."

**Ownership of 064-33's ACs.** AC1's core compare and registration method, the vector-shaped registration on main's paths, AC2 (vendor-neutral, ADR) and AC4 (`meta`) are owned here (068-03 AC1 to AC6). 064-33 keeps: registering the page's object plus the vector for the chamber's retry on the 064-30 path, the vector on its fallback, the full-object opt-out test, the hermetic retry test, and the tampered object-path `consent` held. 064-33 is reworded on `vendor-adobe` once the fold lands.
