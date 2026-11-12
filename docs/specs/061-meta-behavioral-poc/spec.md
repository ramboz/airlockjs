---
status: DONE
skill:
use_cases: [UC-10]
---

# Spec 061: Meta behavioral proof of concept

> Local provisional reservation, 2026-11-03. No push or pull request.

## Overview

A small Playwright recorder and one PageView comparison let us see where the
existing replacement differs from native behavior. We record approved real-site
loads passively. On our controlled page, we intercept and replay known resources.
The tradeoff is narrower evidence: browser observations can guide construction,
but they don't establish complete wire behavior or production readiness.

The owner approved this separate proof of concept (POC) on 2026-11-03 and asked
for a fresh session. This doesn't reopen guarded native slice 059-18, consume or
refund its historical grant, accept the parked isolation proposal, or complete
060-01's full-assurance criteria. Hidden retries, hardened containment, Linux
isolation and the complete controller/relay qualification remain open.

**Grounded starting point:** clean
`c2ac0c0ee2c4e0036633f60a14249a90c248b71b`, the exact requested base and ancestor,
280 commits ahead of the local `origin/main` ref. The adapter's browser chamber
creates a real module worker (`adapters/meta-pixel-prototype.js:164-179`).
The worker routes through `createConnectorHost` and a correlated host request
(`connectors/meta-pixel/pageview-prototype.worker.js:25-43,112-143`).
The existing passive Adobe recorder listens to Page request/response events
(`probes/adobe-compatibility/stock-wire-recorder.mjs:121-230`); use its observation
pattern without importing its vendor qualification contract.

No change to the stable core, production boot or accepted decision records.
Task-relevant private source reads are allowed; native SDK execution and new
vendor traffic still need this POC's specific approval.

## Assumptions

At framing, the retained authenticated-2026-10-21 pair's replay usefulness was
unobserved. The approved headed pair has now produced one native PageView and
one actual worker PageView. This resolves that narrow construction assumption;
it doesn't establish full wire behavior, browser equivalence or delivery.
Missing resources, responses and unsupported fields remain explicit.

## Decomposition

**Path split:** one small end-to-end slice covers recording, controlled PageView
comparison and operator output. Local SDK-free observations establish development
behavior while live input is pending. The approved native comparison and passive
reference loads are evidence within this slice, not a new qualification system.
No separate parser, supervisor or research slice.

## Slices

- [061-01 - Record and compare one PageView](slice-01-pageview-comparison.md)
