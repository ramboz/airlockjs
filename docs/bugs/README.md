# Bug Status Board

> Status: Draft (wizard-generated)
>
> Current state of tracked defects for airlock. Related:
> [Spec Status Board](../specs/README.md). Check both boards before folding
> reported defects into spec acceptance criteria.

| ID | slug | severity | tier | status | reproduces? | regression test | claimed_by | escalated_to | Notes |
|----|------|----------|------|--------|-------------|-----------------|------------|--------------|-------|
| [002](002-meta-fbp-wire-redaction.md) | meta-fbp-wire-redaction | medium | gnarly | DONE | reproduces | `test/parity-meta-fbp.test.js` | | | Meta `fbp` wire-name redaction and parity |
| [003](003-local-fixture-import-closure.md) | local-fixture-import-closure | medium | gnarly | DONE | | `test/local-browser-journeys.test.js` (old live setup, on archive tags) | | | Local fixture imports the full adapter closure |
| [004](004-shared-host-live-consent.md) | shared-host-live-consent | medium | gnarly | DONE | reproduces | `test/wrapped-sdk-host.test.js` | shared-host-live-consent | | Consent recheck before deferred capability call |

<!-- Regenerate with `bug.py status-board`. Add rows as bugs are reported. -->
