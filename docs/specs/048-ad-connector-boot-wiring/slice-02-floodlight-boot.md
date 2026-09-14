---
status: DRAFT
dependencies: [048-01, 046-01, 046-03, 045-01, 032-02]
last_verified:
frame_review: true
---

<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about runnable
     surfaces by probe first (run it / read source) or a citation, else mark them
     as assumptions in the spec's `## Assumptions` — never assert an unverified claim as fact. -->

## Slice 048-02 — bootFloodlight + `{type:"floodlight"}` config type + composite membership (consent-gated)

**Goal:** Add `bootFloodlight` + the `boot(config)` `{type:"floodlight"}` connector type + composite membership, reusing
the ad-connector-boot pattern 048-01 established, so a real page can select Floodlight declaratively and consent is
enforced end-to-end across **both** DC beacon forms (the `ccm/collect` form, 046-01, and the `;`-delimited activity form,
046-02) — a denied `ad_storage` beacon holds, a granted one sends. Completes the ad-connector boot layer that 048-03's
end-to-end accept-flow depends on.

**DoR:**
- ✅ The Floodlight connector + its seal opt-in are DONE: `connectors/floodlight/connector.js` (046-01/046-02, both DC
  forms) + its `holdOnDenied` opt-in for both forms (046-03), proven via a REAL `createAirlock({ holdOnDenied, remap })` in
  `test/floodlight-seal.test.js`.
- ✅ 048-01 established (and its arch/frame passes ratified) the ad-connector-boot pattern — `bootGoogleAds`'s adapter +
  `KNOWN_CONNECTOR_TYPES` entry + `bootConnector` dispatch + composite membership + `onDiagnostic` thread — which this slice
  follows for Floodlight (so no fresh arch decision; `arch_review` off).
- ✅ The seal machinery (045-01) is DONE.

**Acceptance Criteria:**

1. **A new `bootFloodlight(opts)` adapter boots the Floodlight connector, consent-wired**, mirroring `bootGoogleAds`
   (048-01 AC1): governed egress with `egressPurposes:["ad_storage"]` + `holdOnDenied:true` + the connector's `remap`
   (`createFloodlightRemap`), returning the standard boot handle. **Both DC forms** (ccm/collect + activity) are reachable
   through the one boot (the exact form-selection — one boot with a form option, or the connector's own dispatch — read off
   `connectors/floodlight/connector.js`, per `## Assumptions`).
2. **`boot(config)` accepts `{type:"floodlight", …}`**: `floodlight` added to `KNOWN_CONNECTOR_TYPES`; the validator accepts
   a well-formed entry and rejects one missing its required id(s) (advertiser / activity ids, read off the connector),
   naming the connector by index; `bootConnector` dispatches to `bootFloodlight` + composite with its manifest events;
   top-level governance threaded like `ga4`/`pixel` (not the helix-rum carve-out).
3. **Consent enforced END-TO-END through the boot, against the REAL seal, for both forms.** Booting Floodlight with
   `consent:{ad_storage:"denied"}` + `holdOnDenied` HOLDS a beacon (zero `fetch`); a `setConsent({ad_storage:"granted"})`
   re-maps + flushes it — asserted for each DC form (the `test/floodlight-seal.test.js` proof, now driven through
   `bootFloodlight`).
4. **Back-compat + inspector-observable.** No-`floodlight` configs byte-unchanged; `opts.onDiagnostic` threaded to the
   `createAirlock` (spec 028), regression-covered by a wired-collector assertion.

**DoD:**
- [ ] All ACs pass; full test suite green (no regressions).
- [ ] Implementer test coverage exercises each AC; the held→granted→flush edge is explicit **for both DC forms**.
- [ ] Each new test shown to fail when its feature is removed (mutate → red → restore).
- [ ] Reviewed by `reviewer` subagent (compliance) + craft pass + frame-critique (`frame_review: true`).
- [ ] Deviation log + reconciliation sweep produced under this slice heading.
- [ ] Reconciliation review passed.
- [ ] `docs/refinement-todo.md` updated if any decision was deferred.

## Assumptions

- **A1-floodlight — both DC forms route through one `bootFloodlight`.** Assumed the two beacon forms (046-01 ccm/collect +
  046-02 activity) are served by one boot adapter (a form option or the connector's own internal dispatch), not two
  separate boots/config types. The exact form-selection shape is read off `connectors/floodlight/connector.js` during
  implementation; if the two forms genuinely need distinct config entries, this slice re-scopes to reflect that.
- **A1/A2 (inherited from spec 048 §Assumptions)** — the main-thread `remap`/seal seam + zero-core-change composite
  membership, ratified for the ad connectors by 048-01's frame/arch passes; re-confirmed here for Floodlight.
