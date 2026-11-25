---
slice: 064-32 — first push query edge cases match stock
pass: frame-critique
verdict: needs-changes
reviewer: Claude Opus 5.5 (claude-opus-5.5), fresh read-only session, exact head d09543ef
reviewed_at: 2026-11-25T22:51:36Z
prompt_source: review.py frame-critique docs/specs/064-adobe-parity-inventory/slice-32-first-push-query-edge-cases.md
---

# Frame critique: slice 064-32 (first push query edge cases match stock)

- Target: `docs/specs/064-adobe-parity-inventory/slice-32-first-push-query-edge-cases.md` (status IN_PROGRESS, frame_review true), read in full, lines 1-96. Supporting record: ADR-0066 (read in full)
- Exact head: d09543efdabca1523ed2518f97166b17282e494d (`git rev-parse HEAD`; worktree clean)
- Reviewer model: Claude Opus 5.5 (`claude-opus-5.5`), default context tier, session e38b7a66-880f-4a2e-8294-528639726c0a
- Prompt applied: coordinator29 `frame-slice.prompt.txt` (actual helper-generated prompt)
- Scout preflight: `scout-ensure_fresh` since=d09543ef → verified_current, indexed_through d09543efdabca1523ed2518f97166b17282e494d, gap_files_reindexed 0, source_state_id d69edcb803442b0c44f9f987fabb2e9583d205c1233ab172e0f8c47acf64702e, derived_views_verified false
- Source access: Scout only. No native source reads or searches. No writes, suites, downloads, captures, commits or PRs.
- Scope: frame critique only. This is not an owner acceptance, conformance, craft or implementation pass. spec.md was not read; the prompt names it as an overview only.

```
VERDICT: needs-changes

REASONING:
The round 9 frame for AC5 b rests on one claim: every pending push settles, as an observable adapter event, either after its request has left or promptly when it issues none. With that, a settlement-only gate both protects pushes and releases before the cap. The first half rests on ADR-0066 A1, which is kill-gated (see adr-report.md). The second half is asserted in T5 and ADR-0066 line 58 for "core consent park", and this head contradicts it for a fetch-transport push. The contract therefore pre-registers a test that cannot go green under the proposed mechanism without a change that ADR-0066's own kill criteria forbid. That is a bounded, concrete frame defect in the regression contract, not a failure of the approach.

SPECIFIC ISSUES:
- T5 assumes a push whose request the core consent seam parks "settles and releases the gate before the cap". Counterexample at this head: when the host parks a request, it keeps the chamber's fetch pending with no response (core/wrapped-sdk-host.js:352-356, park at 365-378). On the in-microtask park path it also clears the host timeout and returns (632-643). For a non-documentUnloading push, Alloy's transport is a fetch whose promise feeds sendEvent. sendEvent stays pending, so `drive()` never reaches `post("result")` (connectors/alloy/alloy-chamber.worker.js:610-617), and the host's `onResult` stays open (core/wrapped-sdk-host.js:381, 783-790). The adapter's `runEntry` finally, which is the only proposed settlement point (adapters/eds/index.js:2219-2229), never runs before a grant, a deny or dispose. The pump also stays blocked behind it, one event at a time (2282-2287). The gate then releases only at `NAVIGATION_GATE_MS` (1959-1966). So T5's "before the cap" is red by construction for this sub-case. It only holds for a beacon, where Alloy does not await a response. That sub-case also conflicts with mutation M4 ("gate released by the cap alone" must turn a test red), because the cap is the only release there. Downstream, the implementer cannot make T5 green without a new park-to-adapter signal, a core or message change, or a synthetic response. ADR-0066 sends a message-contract change to option A (line 86) and forbids new timeouts or fallbacks (line 60). The alternative is to quietly narrow T5. Either way the round 9 contract stalls or drifts after implementation work. The fix belongs in the frame: state the parked-fetch case as a cap-bounded outcome (no request reaches the wire, so the no-loss guarantee still holds), or restrict T5's park case to beacon transport. This review does not choose or design that repair.
- Primary-premise note (not blocking here): AC5 b's no-loss half depends on ADR-0066 A1, which is unread because the pinned bundle is outside the index and could not be downloaded. The slice carries the same witness (T4) and kill criterion (line 51), so it is a known residual. T4 witnesses one path, not every Alloy request path.
```

## Grounding read (Scout, exact head)

- Slice full text: docs/specs/064-adobe-parity-inventory/slice-32-first-push-query-edge-cases.md:1-96 (assumptions 47-53, regression contract 55-71)
- ADR-0066: docs/decisions/adr-0066-chamber-result-bridge-order.md:1-91 (lines 58, 60, 84-86)
- Core park and pending fetch: core/wrapped-sdk-host.js:352-381, 589-594, 610-685. Result handling: 783-797
- Chamber drive and bridge: connectors/alloy/alloy-chamber.worker.js:284-328, 610-621
- Adapter entry lifecycle, pump and gate: adapters/eds/index.js:1937-1967, 2219-2287, 2302-2348, 2359-2392, 2556-2559
- Renderer gate: adapters/eds/personalization-render.js:362-380

## Evidence gaps (honest)

- Not witnessed in a browser or test. This is a static counterexample from the code at this head, not a reproduced failure.
- How a fetch push reaches the core park (core pending while the chamber's Alloy still sends) was not traced through `shapeAlloyBoot` or the consent vector. The slice and ADR name that case themselves; the counterexample applies wherever it occurs with fetch transport.
- That Alloy 2.31.1 applies no fetch timeout of its own is not read in the bundle (unavailable). If Alloy did time out, the push would settle late, as a rejection, still likely after the 250 ms cap.
- reviews/slice-32-history.md, ADR-0063, the bug-007 record and spec.md were not read. Per the kickoff, earlier rounds' reasoning was not imported.
