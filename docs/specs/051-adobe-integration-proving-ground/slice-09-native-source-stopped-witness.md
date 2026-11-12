# 051-09 stopped partial native source checkpoint

This checkpoint is incomplete and unreviewed. The current frame verdict is
NEEDS-CHANGES, and START refuses before any job read, reservation or
Playwright import. This is a safety stop, not an implemented or qualified
native adapter.

## Frame and authority

The actual same-reviewer frame backedge completed on 2026-11-05 at
00:11:07Z against `d6e46854a8064dcb076ba63c25d8686c1b35188c`. Its
[canonical record](../../decisions/reviews/adr-0051-frame-critique.md) and
[immutable adverse copy](reviews/fresh-native-owner-attested-source-frame-adverse-2.md)
contain the complete supplied verdict. The raw body SHA-256 is
`54056bdebfadbace010cd42169c329d5bf560ce54d738f735e6c92ab6ba3cfaa`.
The earlier [23:30:11Z PASS](reviews/fresh-native-owner-attested-source-frame-pass.md)
remains historical evidence and does not clear the new finding.

The contract requires executable-dependency coverage. The draft checks
repository and Playwright package bytes, but does not bind the external
Chromium executable and its helper/framework bundle. Owner clarification
on a browser-bundle representation and trusted OS/Node baseline was
unavailable, not approval. No new representation, trust boundary or
reduced coverage was authorized. ADR-0051 remains Proposed, and the ADR
and native contract are unchanged by this checkpoint.

The current work allocation is source-only. It is not owner acceptance of
the decision, operator readiness, or a physical allocation. The old native
window and its unused `0/2` allowance remain closed. No browser launch,
native control probe, SDK execution or traffic, network or Adobe call,
activity mutation, deployment, push, merge or landing occurred in this
source continuation. No native qualification, source safety pass, Adobe
proof or full 051-09 completion is claimed.

## Partial source and checks

The draft contains admission validation, private record and lock handling,
a producer-held handle and cooperative stop flow, and synthetic tests.
`requireNativeExecutableCoverage` always throws
`native-executable-coverage-unqualified`; the real START entry calls it
before any acquisition-related work. Test doubles replace this refusal
only inside mock-only control tests. STOP is not qualified.

The stop-publication regression was observed red: a mocked publication
finishing at the hard stop returned `stop-requested`. The implementation
now reports UNKNOWN and does not begin lock removal after that deadline.
The red log SHA-256 is
`30a0aecb6df4f76784c0aba7b9577aea5cb3416828b0686af68b69eb8e505f7a`;
the focused green log SHA-256 is
`fa0773cb14c4fc14aee56f7317069973c8282b78be1aa1462ef3117d260787ec`.
These logs are in the writer's session files as `native-stop-hardstop-red.log`
and `native-stop-and-guard-green.log`.

The record writer still lacks a deadline recheck between each asynchronous
filesystem step. A stalled publication can start a later write or sync
after the hard stop. This is an unresolved source safety issue. The draft
also has not received compliance, craft or architecture review. Producer
loss, unconsumed stop, late acquisition and unobserved closure remain
UNKNOWN. A mock cannot establish the real unresolved launch required for
future case two.

The final focused run passed 33 tests across four files, using synthetic
inputs and mocked process/browser controls. Its session log
`native-partial-focused-green.log` has SHA-256
`6c2fe5a409628712fa01562559e19af28e8b5634dc70a31f12834c87670dbbf4`.
Focused test lint, explicit Node-global source lint and syntax checks
passed. One earlier parallel run failed during cleanup because tests raced
over the shared `secrets/` parent; the test cleanup no longer removes that
shared parent while other tests may use it. These checks do not establish
native behavior.

## Partial source closure

All nine files below are new. Their SHA-256 digests are for the bytes at
this checkpoint.

| File | SHA-256 |
|---|---|
| `docs/specs/051-adobe-integration-proving-ground/slice-09-native-source-interface.md` | `6f80fa64f5437f88a6858e75716a2f49da1775bd1fe05c22415d8be944e1852c` |
| `probes/adobe-compatibility/fresh-native-admission.mjs` | `96a73aa03f495b45c564f7ab2abefcccadb72150288120f7461661cdd677cba5` |
| `probes/adobe-compatibility/fresh-native-control.mjs` | `f7771d2e5eb93de6126053f2c1a18c377984c01d2dda01df315e3a5f9d346f31` |
| `probes/adobe-compatibility/fresh-native-io.mjs` | `da719419ad32f69caf5782c357721b4796873581b386da7fdc1b5a0b70724830` |
| `test/adobe-fresh-native-admission.test.js` | `d0daa9ce6a1c44003d777a85a7a56e6b33750d89445c71140c2671e2b8e61e07` |
| `test/adobe-fresh-native-control.test.js` | `16ce97746f2f4ded648a4c83659aada3200679d8bf0a7ce67aefc6b7c3c7a0b1` |
| `test/adobe-fresh-native-source-binding.test.js` | `a5a06782a9c86135e6a893d949bd21a3c4ced485eedd26e46f2aa73f51e3125e` |
| `test/adobe-fresh-native-storage.test.js` | `48ddd08abb6c930633a9c57980d9a3c2ae599845d100ee44013e9afdd06d1412` |
| `test/helpers/adobe-fresh-native-fixture.js` | `df2e117763740a3d8e9f84eb31c14538aa9826a169e65681bac5128bf0b15149` |

At this stop, the new reviewer count is `1/5`, source-track count is
`11/15`, and the three earlier readiness sessions remain charged. A
different reviewer is planned for documentary reconciliation only. That
review cannot clear the frame or qualify the partial source. The source
window hard stop remains 2026-11-05T00:51:49.600Z.

The independent [documentary-fidelity reconciliation](reviews/fresh-native-owner-source-stopped-documentary-reconciliation-pass.md)
passed at 2026-11-05T00:20:12Z on checkpoint
`f85a3f8214763ab413b05ac0c100eeab260b002b`. It covers the stopped
partial record only. The current frame and source safety issues remain
open. Counts are now `2/5` additional reviewers and `12/15` source-track
sessions, with three earlier readiness sessions still charged. This final
recording and note are outside the independent pass; the parent mechanical
check is pending.
