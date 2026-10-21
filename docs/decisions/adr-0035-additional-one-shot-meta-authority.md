---
status: Accepted
dependencies: [adr-0033, adr-0034]
last_verified: 2026-10-21
frame_review: true
---

# ADR-0035: Additional Meta stock authority preserves the original spent slot

## Status

Accepted (2026-10-21)

## Context

One newly authorized Meta stock case can proceed without refunding the spent one.

At 2026-10-21T18:33:04.581Z the owner answered the explicit request for one
additional bounded Meta stock case beyond the original four-case limit:
“You have my authorization. You don't need to ask every time. you are on
autopilot”. Preparation and operational scheduling are delegated within that
scope; ordinary in-scope steps do not need repeated owner questions.

The original 16:15Z case reserved its canonical slot and exited spent/
inconclusive before any public HTTP was forwarded. Both official resources
were resumed, while complete SDK/native processing remains unverified.
Its missing metadata vocabulary is corrected and qualified; the failure,
original authority and irreversible reservation remain evidence, not retry
authority. See the open [059-15 record](../specs/059-google-ads-full-compatibility/slice-15-native-stock-capture.md).

Current admission deliberately recognizes only the original fixed authority
(`rig/inspected-meta-stock.mjs:289-307`), binds its path/hash/device/inode and
canonical slot (`:671-700`), and reserves before source execution (`:958`).
The journal requires the original envelope at
`rig/native-stock-capture.mjs:121-144`. A copied file or different output is
not a new grant. Those restrictions must not be weakened into arbitrary
operator-selected authority IDs or reusable namespaces.

## Decision Options Considered

### Option A: Reset or copy the original authority/slot
- **Pros:** No new authority branch.
- **Cons:** Erases consumption or manufactures retry authority. Rejected.

### Option B: Allow arbitrary new IDs or reuse the chamber slot
- **Pros:** Flexible operator retries.
- **Cons:** Expands the grant and defeats one-shot limits. Rejected.

### Option C: One closed additional grant, bound to the original spent lineage
- **Pros:** Implements the actual new owner decision while preserving the
  original record, finite ceilings and no-retry boundary.
- **Cons:** Needs explicit lineage validation, source-bound qualification and
  a separate exact case binding; it is not an unrestricted autopilot budget.

## Recommended Decision

Select Option C.

1. Add exactly one Meta-only stock authority for this owner decision. It
   permits one initialization and one PageView, native-default consent,
   eight physical HTTPS attempts, 64 observations, 2 KiB URLs, 64 KiB
   request headers/body, 2 MiB accepted responses, 8 MiB aggregate retention
   and an absolute 60-second case through cleanup/publication. Existing
   isolated-reference header/response timing exceptions are unchanged.
2. Keep the original four-case record and spent Meta slot immutable. The
   additional grant has its own fixed ID, original-location binding and
   canonical reservation; not an arbitrary ID, copied grant or changed
   output. Bind the genuine new owner-decision evidence and the original
   authority plus actual spent reservation by bytes and file identity.
   Missing, changed, unspent or unrelated lineage rejects.
3. Make consumption irreversible before SDK execution. Failure, interruption,
   zero HTTP or an inconclusive result spends the additional case too.
   Concurrent admission has one winner. No reset, fallback namespace,
   chamber substitution or further stock retry is granted.
4. Extend ADR-0034's inspected-network exception only to this additional
   Meta case. Label the changed TLS cohort; preserve confined browser/peer,
   exact route/ownership/source checks, strict real upstream certificate/
   hostname validation and all physical budgets. Original and synthetic
   paths remain distinct; no Google, chamber or production inspection.
5. Let the coordinator select and, before admission only, replace a finite
   window under the delegated authorization. Every selection requires new
   exact bindings, applicable source/review/qualification receipts and
   actual nonoverlap/resource coordination. Do not reuse expired receipts,
   silently extend holds or call a coordinator-selected time an exact
   owner-chosen timestamp. Consumption ends this scheduling delegation.
6. Reuse only genuine dated setup/source facts, with their original
   provenance. New authorization is not a fabricated settings readback,
   source acquisition success, browser/socket closure or performance proof.
   A required unsupported or missing gate stops admission.
7. Qualify the additional authority/reservation/lineage path SDK-absent and
   independently review the implementation before any real case. Preserve
   the complete current source/test/driver/dependency closure and real
   command/original/cleanup witnesses; old indices become historical after
   source changes.
8. This adds one stock case to the earlier envelope; it does not change
   Google authority, candidate gates, account/campaign/billing settings,
   source-download permission, customer traffic, fabricated clicks, C2/C3
   or vendor/native acceptance. The unused Meta chamber remains separately
   gated; this record does not turn it into a retry.

This is an additive decision, not an amendment or supersession of the
historical ADR-0034 grant.

## Consequences

**Becomes easier:**
- The authorized reference can progress without repeated routine scheduling
  questions or dishonest original-slot reuse.

**Becomes harder:**
- A second closed authority must be qualified and traced alongside the
  original consumed record; failure does not guarantee a complete reference.

## Assumptions

- Unverified: the new closed lineage branch can preserve original one-shot
  behavior through concurrent reservation and file mutation. Witnessed
  SDK-absent positives and adversarial lineage/reservation controls must
  establish this before real admission.
- Unverified: the complete pinned SDK/collector chain fits the unchanged
  physical/byte envelope. Unknown branches or overflow remain spent/
  inconclusive, never an automatic larger budget.

## Kill criteria

- An additional grant can revive or mutate the original consumed slot,
  authorize a different ID/case or survive changed/unrelated lineage.
- Source/control/review/setup/resource gates cannot be established truthfully.
- A complete reference requires suppressed retries, changed payloads or larger
  limits. Preserve the result and stop; do not invent success or authority.

## Open questions

No unresolved owner choice for the additional case. Implementation,
qualification and actual coordinated admission remain required.

Number 0035 is provisional locally, coordinated with the Adobe lane. Its
independent provisional 0033/0034 records have different meanings; resolve
cross-branch numbering before landing, without rewriting historical grants.
