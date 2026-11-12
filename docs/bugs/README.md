# Bug Status Board

> Status: Draft (wizard-generated)
>
> Current state of tracked defects for airlock. Related:
> [Spec Status Board](../specs/README.md). Check both boards before folding
> reported defects into spec acceptance criteria.

| ID | slug | severity | tier | status | reproduces? | regression test | claimed_by | escalated_to | Notes |
|----|------|----------|------|--------|-------------|-----------------|------------|--------------|-------|
| [001](001-stock-bootstrap-query-isolation.md) | stock-bootstrap-query-isolation | high | standard | DONE | yes | test/adobe-stock-site.test.js::BOOTSTRAP-QUERY | adobe-adoption-goal |  |  |
| [004](004-shared-host-live-consent.md) | shared-host-live-consent | medium | gnarly | DONE | reproduces | `test/wrapped-sdk-host.test.js` | shared-host-live-consent | | Consent recheck before deferred capability call |
| [005](005-admission-ledger-capacity.md) | admission-ledger-capacity | high | standard | DONE | yes | ^ledger capacity admits the fourth finite reservation after 38 resources without increasing its cap$ | routing-continuity-implementation |  |  |

<!-- Regenerate with `bug.py status-board`. Add rows as bugs are reported. -->
