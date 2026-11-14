---
status: DONE
dependencies: [067-01]
last_verified: 2026-11-13
---

## Slice 067-11: A privacy-safe measurement purpose for helix-rum

**Goal:** helix-rum keeps sending with no consent input, as stock EDS does, once the consent hold (067-02) is on by default. It does this through a new `measurement` purpose that is granted by default. A site's consent input can still deny it explicitly. This is owner decision D4 (2026-11-13).

**DoR:**
- ✅ ADR-0062 point 4 and exception (a). Owner answer D4 in spec 067 section 7.
- Ground first: helix-rum wires `egressPurposes: []` today ("RUM governance class: confined, NOT consent-gated", `adapters/eds/index.js:1361`). List what helix-rum sends and stores (`connectors/helix-rum/`) before writing the qualification test.

**Acceptance Criteria:**

1. `measurement` joins the purpose taxonomy in `core/consent.js`. Absent from the consent vector it resolves to `granted`, not `pending`. An explicit `denied` in the vector denies it. Every other purpose keeps its pending default.
2. helix-rum declares `measurement` as its egress purpose. With no consent input it sends, as it does today. With an explicit `denied` it does not send.
3. A connector qualifies for `measurement` only if all of these hold: it sets no cookies or storage, it sends no user, device or click identifiers, and it sends no personal data. Only helix-rum qualifies. A test inspects helix-rum's payload against that rule, and a guard test fails if any other connector declares `measurement`. Adding another connector needs owner approval.
4. Dated amendment lines go on ADR-0007 (the new purpose and its default) and ADR-0062 (RUM sits outside the hold, matching stock EDS), following the existing "Amended by" status-line pattern. The ADR frontmatter stays `Accepted`.
5. Tests cover the default-granted state and the explicit-deny state as separate cases.

**DoD:**
- `npm test && npm run lint` and the servo quality-gate pass.
- `docs/architecture.md` names the purpose next to the consent taxonomy.

**Consumers:** 067-02 (it must never hold helix-rum without this purpose). No vendor slice depends on it directly.

**Anti-horizontal-phasing check:** Vertical: taxonomy entry, helix-rum wiring, qualification test and ADR lines in one slice.

### Deviation log

1. **Explicit deny holds, it does not drop.** helix-rum opts into `holdOnDenied`, so a denied `measurement` is held at the seal (buffered, released if consent is later granted) and dropped at unload. The AC only says it does not send.
2. **Boot-time consent now reaches helix-rum.** The `boot(config)` helix-rum branch passes `consent` and `consentStrict` (not the denylist) to `bootHelixRum`, so a site's consent input can deny RUM. The review found this gap. Spec 022's "exempt from config governance" test was rewritten to match.
3. **OneTrust cannot deny `measurement`.** The driver maps only the Consent Mode v2 four. A site denies RUM through the `consent` vector or `setConsent`. Recorded in `docs/architecture.md`; a OneTrust mapping is not in this slice.
4. **Guard is a source scan plus a payload test.** It fails if any source outside `connectors/helix-rum/connector.js` and `core/consent.js` names the purpose, and checks the adapter wires the constant only once.

### Reconciliation sweep

- ADR-0007 and ADR-0062: dated amendment lines added; frontmatter stays Accepted.
- `docs/architecture.md`, `connectors/helix-rum/README.md`, `contracts/instrumentation-config.schema.json`, `contracts/connector.d.ts`, `core/consent.js` JSDoc: updated to the new purpose.
- 067-02 (consent hold warning) can rely on helix-rum declaring `measurement`. The held-beacon cap there also bounds RUM held under explicit deny.
