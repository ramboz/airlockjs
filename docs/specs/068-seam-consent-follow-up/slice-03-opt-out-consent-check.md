---
status: DONE
dependencies: [068-02, ADR-0062]
last_verified: 2026-11-23
---

## Slice 068-03: The opt-out forward carries only the consent the adapter registered (core and main adapter)

**Goal:** The 068-02 opt-out forward sends the chamber's `consent` and `meta` keys unchecked, so an untrusted chamber can put other data through the exemption. After this slice the host forwards a matching opt-out only when its `consent` value equals one the adapter registered as expected; anything else is held as any other request. This is the vendor-neutral part of 064-33 (found by the ADR-0064 review, 2026-11-20; landing it on `main` first is coordinator direction). The Adobe-object part stays on `vendor-adobe` as 064-33.

**DoR:**
- ✅ 068-02 built (`optOutForward`, `ALLOY_CONSENT_OPT_OUT`).
- ✅ The owner decision of 2026-11-20 ("Forward the opt-out only, via a narrow seam exemption (Recommended)") stands; this narrows it.
- ✅ Owner answer 2026-11-23: "ADR-0062 amendment note (Recommended)".

**New host method (the contract).** `host.expectOptOutConsent(values)` on `createWrappedSdkHost`'s returned handle:

- `values` is an array of JSON values, opaque to core. `null`, `undefined` or `[]` clears the registration.
- Each call replaces the previous registration (it is not additive), so the adapter calls it each time it posts consent to the chamber.
- With a `consentOptOut` declaration and no registered value, the opt-out is held (fail closed).
- Core compares the forwarded request's top-level `consent` with every registered value by deep equality: plain objects ignore key order, arrays keep order, primitives use `Object.is`. One equal value is enough. It never throws.
- Core never inspects the value's structure and knows nothing about Alloy's request shape.

**Acceptance Criteria:**

1. `expectOptOutConsent` exists as above. A matching opt-out whose `consent` equals a registered value is forwarded (068-02 behaviour: declared keys only, `opt-out-forwarded` diagnostic). Shown by a hermetic test.
2. A matching opt-out whose `consent` differs from every registered value (a changed field, an extra field, a changed array order or length, a different type) is held and counted, never forwarded. A refusal-shaped request held while consent is only pending is dropped, not parked, so no stale or tampered `collect: "n"` can be sent after a later grant (the 068-01 re-run). A request held after a denial is rejected and never re-run, so a second refusal's registration cannot release it. Key order alone does not matter (equal). Shown by hermetic tests, including one where the chamber tampers a field of the forwarded `consent`.
3. With a `consentOptOut` declaration but no registered value (never called, or cleared), a refusal is held. A later registration applies to the next request; replacing the registration drops the earlier values.
4. The adapter (`adapters/eds/index.js`, `bootAlloy`) registers the wire `consent` array of `shapeAlloyConsent(consentRef)` (the vector-shaped consent, `connectors/alloy/consent.js`) on every path that posts consent on `main`: at boot (so a boot-time denial forwards), on `handle.setConsent` (so the CMP `onChange` driver, which calls it, and a direct call are covered), and with no consent vector wired (`consentHoldOff`) it registers nothing. Shown by hermetic tests that record the registration on each path. On `main` the Alloy endpoint ceiling is the interact floor, so set-consent cannot pass `bootAlloy` end to end here; the forward and the tampered-body hold are shown at the host (AC1, AC2) and the adapter-level end-to-end proof is owned by 064-33 on `vendor-adobe`, where the ceiling lists set-consent.
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

**Amendment wording (summary; the applied text is in ADR-0062, 2026-11-23).** "Opt-out forwarding is checked (2026-11-23). The forwarded request's `consent` must equal a value the adapter registered through `host.expectOptOutConsent`; otherwise the request is held. The value is opaque to core. With no registration the opt-out is held. `meta` is still forwarded unchecked, a recorded residual."

**Ownership of 064-33's ACs.** AC1's core compare and registration method, the vector-shaped registration on main's paths, AC2 (vendor-neutral, ADR) and AC4 (`meta`) are owned here (068-03 AC1 to AC6). 064-33 keeps its AC1 (Adobe part: the page object and the retry vector), its AC3 (the 064-30 and 068-02 opt-out tests stay green, the hermetic retry test), and the adapter-level end-to-end forward and tampered-body hold for each path (the ceiling allows set-consent there) and the tampered object-path `consent` held. 064-33 is reworded on `vendor-adobe` once the fold lands.

## Findings (2026-11-23)

All tests below are hermetic (Vitest, fake chamber or mocked host); none is real-Chromium, so no `browser-oracle` step is added. `npm test` 139 files green on Node 22, `npm run lint` clean, servo gate pass.

| AC | Test (file) |
|---|---|
| 1 | "forwards a consent equal to a registered value, ignoring object key order" (`test/wrapped-sdk-host.test.js`, 068-03 describe). It would also pass on 068-02 code; AC1 is proven by the method existing and by the hold tests of AC2/AC3. |
| 2 | "holds a consent the chamber changed ..." (changed field, extra field, extra entry, string, missing `consent`); "keeps array order significant"; "holds a value whose type differs but still parses as a refusal"; "any one of several registered values is enough"; "a refusal-shaped request held while pending is never sent after a later grant"; "a tampered refusal held after a denial is gone: a second refusal's registration and a grant send nothing of it"; "a refusal forwarded under a denial, then moved to pending by a diagnostic before the recheck, is never sent after a grant"; "a registration replaced between the first gate and the deferred recheck holds the request"; "an interact still parks while pending and flushes on a grant (the park exemption is for refusals only)". |
| 3 | "with nothing registered (never called, cleared, or empty) the refusal is held"; "a later registration applies to the next request and replaces the earlier values"; "deep-copies the registration ...". |
| 4 | `test/opt-out-consent-registration.test.js`: boot denial, `setConsent` grant then refusal, `consentHold:false` with no vector. See the deviation below. |
| 5 | `test/core-boundary.test.js` green; core knows only the top-level `consent` key. |
| 6 | `meta` choice: recorded as a remaining risk, not constrained (it mirrors per-session cookie state; a structural check would be Alloy-specific). Named in the ADR-0062 amendment. |
| 7 | One line changed in an existing test: the 068-02 `make()` in `test/wrapped-sdk-host.test.js` now calls `host.expectOptOutConsent([JSON.parse(refusal()).consent])`. No 068-01 test changed. |

**Revert-checks** (break, confirm red, restore): removing the compare (tampered tests fail), removing the no-park rule at the first gate and at the recheck (pending tests fail), removing the adapter registration (registration tests fail), `jsonEqual` order-insensitive (array-order test fails), `Object.is` replaced by `==` (type test fails), `structuredClone` replaced by `slice()` (deep-copy test fails).

**Deviations from the AC text.**
- AC2 reworded from "counts as held and parks (068-01)" to "rejected, never parked" for a refusal-shaped request (owner correction, 2026-11-23): a parked refusal could be sent after a grant. The pending-hold diagnostic reason for this case reads "opt-out request held at the seal and dropped, never sent after a later grant".
- AC4: on main the endpoint ceiling is the interact floor, so set-consent cannot pass `bootAlloy` end to end. The forward and tamper-hold are proven at the host (AC1, AC2); the adapter-level end-to-end proof is owned by 064-33 on vendor-adobe. The CMP `onChange` path is covered by construction (it calls `handle.setConsent`), not by its own test.
- With no consent input and the hold on, the adapter registers the wire `consent` for `collect:"n"` (`consentRef` is `{}`); harmless, since a forward needs an explicit denial. With `consentHold:false` and no vector it registers `[]` (clears), rather than "nothing".
- A registration that cannot be deep-copied clears the registration (fail closed).

**Accepted edges** (ADR-0062 amendment): a refusal that reaches the host after a grant has landed is sent as stock Alloy does; a request whose `collect:"n"` is outside the declared entry or whose URL varies from the declared suffix parks like any request; `meta` is unchecked; a forward later dropped at the recheck does not bump `consentHeld` (carried, see reviews).

**Reviews.** Three rounds (cap) of fresh Opus 5.5 reviewers; round 3 approved on all three. Files in `reviews/slice-03-{compliance,craft,reconciliation}.md`.

**Core change** (vendor-neutral, named in the ADR-0062 amendment): `core/wrapped-sdk-host.js` (`expectOptOutConsent`, deep equality, no-park for refusal-shaped requests on both gates).
