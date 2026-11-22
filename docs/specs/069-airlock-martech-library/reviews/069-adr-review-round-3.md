---
round: 3
verdict: changes-requested
reviewer: Opus 5.5 jig:reviewer (fresh, read-only)
reviewed_at: 2026-11-22T00:56:13Z
prompt_source: ADR-0065 and slices 069-01 to 069-03, the re-scoped 064-31 and spec 069 as drafted after 84499749 on vendor-adobe (squashed into f1f2c685, which adds this file). The reviewer read the files from disk, not a diff.
scope: ADR-0065 with the generic data layer and the opt-in proxy, slices 069-01 to 069-03, 064-31
---

# ADR-0065 and slice review (round 3, the cap)

The author saved this text from the reviewer's output. The reviewer returned `needs-changes` (recorded as `changes-requested`): the design matches the owner's direction, with 9 findings. The author fixed all in the same docs commit. This is the last round; no re-review runs, so the verdict stays the reviewer's.

| # | Sev | Finding | Disposition |
|---|---|---|---|
| 1 | Medium | ADR said the library applies the denylist; AC8 said core's path strips it. | Fixed: core's dispatch strips, the library copies nothing (ADR point 5 gap row, AC8). |
| 2 | Medium | AC8's core stand-in has no denylist, so the test proves nothing. | Fixed: a real `createAirlock` with a recording connector; the strip depth is asserted against core's behavior. |
| 3 | Medium | No named double-send guard for `page_view`. | Fixed: the forward skips events on a fixed list pinned against the Alloy connector's subscriptions; the test uses `page_view`. |
| 4 | Medium | "Live by reference" vs lazy cached fold. | Fixed: the fold updates one state object in place; outside mutation is unsupported and noted (AC3, AC5). |
| 5 | Low | Stale "data-layer bridge's drain". | Fixed (ADR point 4). |
| 6 | Low | Stale `dataLayerInstanceName` rationale. | Fixed: inert by default, rejected by the proxy install (ADR point 3, 069-03 AC2). |
| 7 | Low | "write-only capture surface" inaccurate. | Fixed: capture plus a read-only state getter. |
| 8 | Low | Custom `instanceName` globals unclear. | Fixed: only the custom name is written (AC6, AC9). |
| 9 | Low | Forwarded keys unspecified. | Fixed: `event`, `xdm`, `data` only (ADR, AC8). |

Reconciliation notes: the deliberate differences from stock are recorded in 069-02 Notes for the DONE Findings; 064-31 depends on 069-02 only through 069-03. The Option A call-the-handle "(recommended)" wording stays until the owner accepts; the DoR box is ticked only after acceptance.
