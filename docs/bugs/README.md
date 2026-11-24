# Bug Status Board

> Status: Draft (wizard-generated)
>
> Current state of tracked defects for airlock. Related:
> [Spec Status Board](../specs/README.md). Check both boards before folding
> reported defects into spec acceptance criteria.

| ID | slug | severity | tier | status | reproduces? | regression test | claimed_by | escalated_to | Notes |
|----|------|----------|------|--------|-------------|-----------------|------------|--------------|-------|
| 001 | [stock-bootstrap-query-isolation](001-stock-bootstrap-query-isolation.md) | high | standard | DONE | yes | test/adobe-stock-site.test.js::BOOTSTRAP-QUERY | adobe-adoption-goal |  |  |
| 004 | [shared-host-live-consent](004-shared-host-live-consent.md) | medium | gnarly | DONE | yes | test/wrapped-sdk-host.test.js::revocation before the deferred capability call holds without replay | shared-host-live-consent |  | Consent recheck before deferred capability call |
| 005 | [admission-ledger-capacity](005-admission-ledger-capacity.md) | high | standard | DONE | yes | ^ledger capacity admits the fourth finite reservation after 38 resources without increasing its cap$ | routing-continuity-implementation |  |  |
| 006 | [post-fold-oracle-stock-domain](006-post-fold-oracle-stock-domain.md) | medium | standard | DONE | yes | a stock arm is a pure stock page | bug-006-post-fold-oracle |  |  |
| 007 | [martech-event-order-vs-stock](007-martech-event-order-vs-stock.md) |  |  | REPORTED | no |  | Building phase coordinator 23 |  |  |
