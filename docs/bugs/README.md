# Bug Status Board

> Status: Draft (wizard-generated)
>
> Current state of tracked defects for airlock. Related:
> [Spec Status Board](../specs/README.md). Check both boards before folding
> reported defects into spec acceptance criteria.

| ID | slug | severity | tier | status | reproduces? | regression test | claimed_by | escalated_to | Notes |
|----|------|----------|------|--------|-------------|-----------------|------------|--------------|-------|
| 001 | meta-fbp-wire-redaction | medium | gnarly | DONE | yes | test/parity-meta-fbp.test.js | google-and-meta-feasibility |  |  |
| 002 | local-fixture-import-closure | medium | gnarly | DONE | yes | test/local-browser-journeys.test.js::serves two fixed pages and the entire actual adapter/module-worker import closure | local-fixture-import-closure |  |  |
| 003 | shared-host-live-consent | medium | gnarly | FIXING | yes | test/wrapped-sdk-host.test.js::revocation before the deferred capability call holds without replay | shared-host-live-consent |  |  |
