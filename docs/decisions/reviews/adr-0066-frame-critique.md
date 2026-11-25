---
adr: 0066
pass: frame-critique
verdict: pass
reviewer: Claude Opus 5.5 (claude-opus-5.5), fresh read-only session, exact head d09543ef
reviewed_at: 2026-11-25T22:51:35Z
prompt_source: review.py frame-critique docs/decisions/adr-0066-chamber-result-bridge-order.md
---

# Frame critique: ADR-0066 (chamber result follows bridge requests)

- Target: `docs/decisions/adr-0066-chamber-result-bridge-order.md` (status Proposed), read in full, lines 1-91
- Exact head: d09543efdabca1523ed2518f97166b17282e494d (`git rev-parse HEAD`; worktree clean)
- Reviewer model: Claude Opus 5.5 (`claude-opus-5.5`), default context tier, session e38b7a66-880f-4a2e-8294-528639726c0a
- Prompt applied: coordinator29 `frame-adr.prompt.txt` (actual helper-generated prompt)
- Scout preflight: `scout-ensure_fresh` since=d09543ef → status verified, state verified_current, indexed_through d09543efdabca1523ed2518f97166b17282e494d, gap_files_reindexed 0, source_state_id d69edcb803442b0c44f9f987fabb2e9583d205c1233ab172e0f8c47acf64702e, derived_views_verified false. Later keyword calls reported query freshness "unverified (watcher_running_not_verified)", not stale.
- Source access: Scout only (investigate_expand ranges and keyword_search listings). No native source reads or searches. No writes, suites, downloads, captures, commits or PRs.
- Scope: frame critique only. This is not an owner acceptance, conformance, craft or implementation pass.

```
VERDICT: pass

REASONING:
The single load-bearing assumption is A1: Alloy 2.31.1 starts every request for an event (beacon or fetch) before that event's sendEvent promise resolves. If that holds, posting `result`/`fatal` through the bridge queue makes "entry settled" imply "request already handed to the host". A1 is not read (the pinned bundle is fetched or cached outside the repo, rig/adobe-b1-replay.mjs:31-44, and downloads were out of scope here). But the ADR states it as an assumption, not a fact, gives it a witness (T4) and a kill criterion that returns option A to the owner, and scopes the one plausible counter-path (a post-settle vendor retry) out as a named residual. The other links in the chain hold at this head: the chamber reserves a slot synchronously and fills it after `data.text()` (connectors/alloy/alloy-chamber.worker.js:284-299, 316-321), `drive()` posts `result`/`fatal` directly today (610-620), the host runs seal checks and reaches `caps.egress.dispatch` in one microtask (core/wrapped-sdk-host.js:629-667), and the adapter's `dispatch` calls `fetch` synchronously before its first await (adapters/eds/index.js:1824-1839). So A3 is grounded and A2 is kill-gated. The frame survives the strongest attack.

SPECIFIC ISSUES:
- A1: Alloy issues each event's request before resolving that event's sendEvent. This is the premise the whole "wait for settlement" gate rests on. The strongest attack is that A1 is unread, and that Alloy could start a request for the event after resolving: a Retry-After resend, or any deferred send. If so, a settled entry no longer proves its request left, and the gate releases a push that is still on its way. That reopens AC5 b after the chamber and adapter rework. The ADR anticipates this: it limits the guarantee to requests made before settlement, records post-settle requests as a residual (lines 40, 72), requires T9 so a late request never credits a newer entry, and stops on T4 (line 84). Because a pre-registered witness and kill criterion bound A1, it is a known residual, not a frame flaw. Note for the author: cite the bundle path or the transport code that A1 relies on once the pinned bundle is available. T4 witnesses one path, not all of them (line 78 says so).
- Secondary (note, not blocking for this ADR): line 58 says a request parked at the core consent seam "counts as settled without a request, as today". At this head, a parked request keeps the chamber's fetch pending, with no response (core/wrapped-sdk-host.js:352-356). The host also clears its timeout on the park path (632-643). For a non-beacon fetch, Alloy's sendEvent therefore cannot resolve. `result` is never posted and the entry never settles, so the gate falls through to the 250 ms cap. That keeps the bounded guarantee, because nothing reaches the wire before navigation. But "counts as settled" is wrong for fetch transport and only holds for a beacon. "As today" holds only in that both end at the cap (today `markIssued` runs in `runEntry`'s finally or in adapter `dispatch`, which a parked request never reaches: adapters/eds/index.js:1839, 1953-1957, 2219-2229). The slice's T5 turns this into a test claim. See slice-report.md.
```

## Grounding read (Scout, exact head)

- ADR-0066 full text: docs/decisions/adr-0066-chamber-result-bridge-order.md:1-91
- Chamber bridge queue and beacon slot: connectors/alloy/alloy-chamber.worker.js:279-328. `drive()`: 610-621
- Host intercepted-fetch path: core/wrapped-sdk-host.js:382-430, 560-685. `handleMessage`: 687-806. Park/hold: 338-381
- Adapter dispatch and gate: adapters/eds/index.js:1785-1860, 1900-1985, 2205-2260, 2261-2411, 2523-2566
- Renderer gate call: adapters/eds/personalization-render.js:360-395
- Pinned bundle sourcing: rig/adobe-b1-replay.mjs:24-44 (`ALLOY_SHA256` 7dd09409…e8, `ALLOY_URL` cdn1.adoberesources.net/alloy/2.31.1/alloy.min.js)

## Evidence gaps (honest)

- The pinned Alloy 2.31.1 bundle was not read: downloads were not allowed, and it is not an indexed repository file. A1 stays an assumption.
- Linked ADR-0063 and bug-007 records were not read in full. The ADR states it narrows nothing in ADR-0063. Bug 007's mechanism was checked directly in the chamber source instead.
- The claim that Alloy has no fetch timeout of its own (the secondary note) is not read in the bundle. The core-side pending-fetch behavior is read.
