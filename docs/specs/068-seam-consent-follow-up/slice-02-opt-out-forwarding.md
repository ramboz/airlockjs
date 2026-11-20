---
status: DONE
dependencies: [068-01]
last_verified: 2026-11-20
---

## Slice 068-02: Forward the opt-out after an explicit refusal

**Goal:** Owner decision 2026-11-20: "Forward the opt-out only, via a narrow seam exemption (Recommended)". After an explicit refusal, Airlock forwards Alloy's `privacy/set-consent` carrying `collect: "n"` and no `query.identity.fetch`, so Adobe records the refusal. Everything else stays held or dropped. This is a narrow exemption to ADR-0062 exception (a), recorded as an amendment (no new ADR).

**DoR:**
- ✅ The recorded `s6-out` fixture on `vendor-adobe` (read-only): `POST .../ee/v1/privacy/set-consent?configId=...`, body `{"consent":[{"standard":"Adobe","version":"2.0","value":{"collect":{"val":"n"}}}],"query":{"identity":{"fetch":["ECID","CORE"]}},"meta":{"state":{...}}}`.
- Ground first: the consent gate in `core/wrapped-sdk-host.js` runs after the endpoint ceiling and config integrity, so the exemption is scoped to the consent hold only.

**Acceptance Criteria:**

1. The connector declares the opt-out signal (`ALLOY_CONSENT_OPT_OUT`: path suffix, one body marker, the body keys that may leave). Core reads the declaration and has no Alloy-specific code.
2. After an explicit denial of a governing purpose, a matching request is forwarded with only the declared keys (so `query.identity.fetch` is removed) and a redacted `opt-out-forwarded` diagnostic. It does not count as held.
3. A pending (not refused) state does not qualify: the request stays held (and parks, 068-01).
4. After a refusal, an interact, a set-consent that is not a refusal, and an unparseable body all stay held.
5. The endpoint ceiling still applies: the exemption cannot send to an undeclared destination.
6. With no declaration the refusal is held as before.

**DoD:**
- `npm test && npm run lint` and the servo quality-gate pass.
- ADR-0062 carries the dated amendment (status line plus short section).

**Consumers:** Adobe 064-19's S6 scenario (`s6-out`) on vendor-adobe.

**Anti-horizontal-phasing check:** Vertical: connector declaration, host honouring, adapter wiring, tests and the ADR note.

## Notes

**Mechanism.** `consentOptOut: { path, match: { path, equals }, forward }` on `createWrappedSdkHost`. The match walks the parsed body along `match.path` and requires `equals`; the forwarded body keeps only the `forward` keys. The check runs in the consent `hold()` branch only when a governing purpose is explicitly denied, after the ceiling and config-integrity gates. The forwarded body keeps only `consent` and `meta`, so the XDM denylist strip has nothing left to act on.

**Main's ceiling.** On `main` the Alloy ceiling is the interact floor, so set-consent is still held by the endpoint ceiling there; the exemption does not widen the ceiling. On `vendor-adobe` the stock ceiling already lists set-consent, so the opt-out flows end to end.

### Reconciliation sweep

Review (Opus 5.5, round 1, `reviews/slice-02-*.md`): no blocking findings; two MEDIUM carried, LOW fixed or noted.

- **MEDIUM, carried:** only top-level keys are filtered. The `consent` array and `meta` object pass as the chamber built them, so a compromised chamber could place data there. Reason: the destination is the pinned Adobe tenant (the ceiling still applies), the request only exists after a refusal, and narrowing to nested fields would couple core to Alloy's shape. A later tightening can forward `consent[i].{standard,version,value.collect}` only.
- **MEDIUM, carried:** `meta.state.entries` can carry an existing `kndctr_*` identity cookie value, so the forward removes the new ECID fetch but not an identity the visitor already has. That is intended: Adobe records the refusal against that identity. The ADR and connector wording say "no identity fetch".
- **LOW, fixed:** tests now assert the `opt-out-forwarded` diagnostic (once per request, no body values) and that a re-tenanted set-consent is held by the ceiling after a refusal. `optOutForward` uses `Object.hasOwn`.
- **LOW, noted:** the XDM denylist does not act on the forwarded body (no XDM is kept), so a denylist test would not apply.
- **LOW, noted:** a set-consent parked while pending and then refused is forwarded, not dropped.
