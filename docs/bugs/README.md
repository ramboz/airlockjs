# Bug Status Board

> Status: Draft (wizard-generated)
>
> Current state of tracked defects for airlock. Related:
> [Spec Status Board](../specs/README.md). Check both boards before folding
> reported defects into spec acceptance criteria.

| ID | slug | severity | tier | status | reproduces? | regression test | claimed_by | escalated_to | Notes |
|----|------|----------|------|--------|-------------|-----------------|------------|--------------|-------|
| 001 | stock-bootstrap-query-isolation | high | standard | DONE | yes | test/adobe-stock-site.test.js::BOOTSTRAP-QUERY | adobe-adoption-goal |  | [record](001-stock-bootstrap-query-isolation.md) |
| 004 | shared-host-live-consent | medium | gnarly | DONE | yes | test/wrapped-sdk-host.test.js::revocation before the deferred capability call holds without replay | shared-host-live-consent |  | Consent recheck before deferred capability call — [record](004-shared-host-live-consent.md) |
| 005 | admission-ledger-capacity | high | standard | DONE | yes | ^ledger capacity admits the fourth finite reservation after 38 resources without increasing its cap$ | routing-continuity-implementation |  | [record](005-admission-ledger-capacity.md) |
| 006 | post-fold-oracle-stock-domain | medium | standard | DONE | yes | a stock arm is a pure stock page | bug-006-post-fold-oracle |  | [record](006-post-fold-oracle-stock-domain.md) |
| 007 | martech-event-order-vs-stock | medium | standard | DONE | yes | bug 007: the bridge posts calls in the order the tag made them | martech-event-order-bug-007 |  | [record](007-martech-event-order-vs-stock.md) |
