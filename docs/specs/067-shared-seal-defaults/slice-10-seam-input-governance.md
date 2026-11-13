---
status: IN_PROGRESS
dependencies: [067-09]
last_verified: 2026-11-13
claimed_by: 067-10-seam-input-governance
---

## Slice 067-10: Input governance at the wrapped-SDK seam

**Goal:** The credentials denylist also governs what the wrapped SDK's own input carries (ADR-0012's deferred second placement). Today governance runs on the connector's mapped payload. An Alloy chamber that sees the site's raw `xdm`, and now stock context (067-08), needs the same protection at the seam where input enters the chamber.

**DoR:**
- ✅ ADR-0062 point 3 names this a required follow-up. ADR-0012:82-83 and :196-199 (the ambient-context boundary note) are superseded in part by ADR-0062 (067-01 status line).
- 067-09 is done: the denylist, the explicit override and the diagnostic are the shared building blocks.
- Ground first: the seam's request and response interception in `core/wrapped-sdk-host.js` (the dispatch path, `dispatchInterceptedFetch`) and where `governPayload` already runs (`core/airlock.js:147-160`, `core/payload-governance.js`). Decide and record where a second governance pass is safe: on the SDK's outbound request body before dispatch, and on the input the chamber is given.

**Acceptance Criteria:**

1. The denylist applies to the wrapped-SDK input at the seam on the default path. A denylisted field in the site's `xdm` or in context never reaches the Edge request body. The existing `payload-governance` diagnostic is emitted (field name only, never the value).
2. The pass is a no-op that returns the same reference when nothing is stripped (same back-compat rule as ADR-0012's mapped-payload pass).
3. A malformed or unparseable body is passed through with an error-level diagnostic, never silently dropped and never throwing in the seam (same shape as `govern-failed`).
4. The 067-09 override and `payloadDenylist` extension apply here too. The override off-state is its own tested state.
5. The strip is a value-preserving pass for non-denylisted fields: a stock recording without credentials fields compares byte-clean through the seam.
6. A test proves the pass runs once per request and not twice, so the existing mapped-payload pass and the seam pass do not double-strip or double-warn.
7. The slice states ADR-0012's honest boundary: renamed fields and value-level PII in a benign-named field are out of a field-name denylist's reach.

**DoD:**
- `npm test && npm run lint` and the servo quality-gate pass.

**Consumers:** Adobe 064-17 and 064-18 onward (vendor-adobe). Not used by Google or Meta (Alloy only).

**Anti-horizontal-phasing check:** Vertical: seam pass, diagnostic and a wire-level test of a denylisted field through a real wrapped-SDK chamber.

### Deviation log

- 067-09 already ran the default-on denylist over `events[].xdm` in `stripInterceptedXdmBody`. This slice extends that one function instead of adding a second pass, so the single-pass rule (AC6) holds by construction. Gaps closed: `events[].data`, `events[].query`, top-level `query` and `meta` are now governed (Alloy writes site `xdm` and context into `events[].xdm`; the rest ride in those containers); an unparseable body now emits the `skipped` error diagnostic (reason `unparseable-body`) instead of passing silently.
- "The input the chamber is given": the host hands the chamber only config and the captured event, and the chamber builds its own body. The interact body at the seam is the one place that sees everything Alloy sends, so the pass lives there. Not a separate chamber-input pass.
- 067-08 not required: stock context reaches the Edge only through the request body, so it is covered by the same pass.

### Honest boundary (AC7)

A field-name denylist cannot catch renamed fields (`pw` for `password`) or value-level PII inside a benign-named field (an email in `xdm.web.pageName`). ADR-0012's boundary stands.

**Implementation notes (2026-11-13):**
- Wire-level test: `test/seam-input-governance.test.js` runs `bootAlloy` -> real `createWrappedSdkHost` -> egress with a self-reacting chamber Worker emitting the body under test (same harness style as `test/eds-boot-alloy.test.js`). A real-browser chamber is the existing rig/credentials-gated residual.
