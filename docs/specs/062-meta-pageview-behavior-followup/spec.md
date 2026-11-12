---
status: DONE
skill:
use_cases: [UC-10]
---

# Spec 062: Small PageView behavior follow-up

> Local provisional reservation, 2026-11-04. No push or pull request.

## Overview

The first observed comparison exposed a timezone encoding difference and missing
browser-cookie behavior. This increment corrects those two bounded behaviors
where existing permissions allow it, and groups the remaining field gaps into
a short backlog. SDK experiments remain evidence to understand, not flags to
copy until a report turns green.

The owner approved this source increment with "ok, do it." The baseline is clean
`88be1c99e5a970fbbe62defb6b207a54bb2c6559`. Completed 061-01 and its receipts stay
unchanged. Keep the preserved SDK 2.9.426 runtime/configuration pair; no source
download, SDK upgrade, broader event work, transport redesign or full qualification.
Earlier live grants remained consumed. The owner later approved one new
controlled pair with "yes, approved"; that pair has now executed once. The new
grant is spent and permits no retry or further run.

## Framing baseline (88be1c9)

- The hash-verified configuration body contains the opted-in timezone plugin at
  character offset 291440: it negates `Date.getTimezoneOffset()` with no unit
  conversion. The runtime alone doesn't contain that expression; both preserved
  pins matter. The configuration SHA-256 remains
  `b1720ebb329e506fd223f066353d977281280866d85e908dc2561a6c1161c46d`.
- The baseline context supplied integer minutes from `getTimezoneOffset()`
  (`adapters/meta-pixel-prototype.js:155-160`), while the connector
  wrote that value unchanged (`connectors/meta-pixel/pageview-prototype.js`).
  Keep the context contract and correct the wire boundary.
- The baseline standalone prototype granted no cookie names and wired only
  egress (`adapters/meta-pixel-prototype.js:633-641`). The existing capability
  contract has mediated get/set plus exact-name grants
  (`contracts/capability.d.ts:36-53,74-76`). A whole-jar accessor isn't a grant
  (`adapters/eds/cookies.js:13-17`). Cookie behavior cannot bypass this distinction.
- The preserved runtime's `SignalsFBEventsPixelCookie` / `SignalsPixelCookieUtils`
  modules contain packed browser-cookie and domain/write/reuse behavior.
  Their exact generation details still needed a bounded source inspection at
  framing; the later implementation uses no captured cookie as input.

## Assumptions

At framing, a narrow `_fbp` binding's fit and authority were unresolved. The
owner subsequently approved the exact default-off source grant, scoped source
reviews passed, and one newly approved pair observed each side's own cookie
matching its request. No frozen-core or production change was needed.
This doesn't establish every cookie attribute, native failure path or full parity.

## Observed comparison - 2026-11-04

The existing headed procedure executed once on clean reviewed source
`f4a5cd0f03e9221b7b1b193fc387dd591e815d44`, with SDK 2.9.426, exact preserved
configuration and Airlock's approved `_fbp` option enabled. Each fresh context
issued one init and one PageView. Timezone now matches. Both sides have an
`_fbp` cookie that matches that same side's emitted value; cross-context IDs
are volatile, with no literal-equality claim.

Native remained GET/image-aborted with no response. The actual module worker
used GET/fetch and received a synthetic localhost 204. Eight common fields
matched, and the separately generated `fbp` is classified volatile. Other
native-only occurrences remain explicit; full compatibility is inconclusive.
See the slice result for receipt/hash, timing, browser and remaining-field detail.

## Decomposition

One rules/data follow-up delivers a corrected PageView through the existing
worker, an explicit cookie disposition and a short prioritized gap inventory.
Independent timezone/triage source work continues if cookie authority is blocked.
This isn't a separate infrastructure or research programme.

## Slices

- [062-01 - Correct pinned PageView behavior](slice-01-pageview-behavior.md)
