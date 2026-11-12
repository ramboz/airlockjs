---
status: Accepted
dependencies: [adr-0017, adr-0033, adr-0043]
last_verified: 2026-11-05
frame_review: true
---

# ADR-0052: Inspected Google reference for the first conversion

Use an isolated HTTPS inspector to record one owned Google conversion. It
counts physical requests before forwarding and retains complete response
bytes. Google sees the inspector's TLS connection, so the result cannot
establish ordinary-browser network parity.

## Status

Accepted (2026-11-05)

## Context

The first Google conversion needs a complete application-layer reference.

The owner approved this approach on 2026-11-05 after being told that existing
inspection permission covered Meta only. The approved question specified one
synthetic USD 1 conversion on the existing owned Secondary action, at most
20 Google requests in 60 seconds, and case-linked Google/DoubleClick routes.
It excluded system-trust, account and billing changes. Execution remains
conditional on source and safety review.

The owner also directed autonomous completion of the Google conversion.
Meta remains with its parallel session. Routine source preparation,
implementation, qualification and finite scheduling stay with this
coordinator; this decision does not require another approval for each step.

[R-015](../research/R-015-google-meta-first-journey-evidence.md#google-first-case-evidence-card)
records the incomplete retained reference. The recovered official loader
matches its recorded digest and the existing Google policy pin. It does not
restore the missing secondary response, blocked auxiliary requests or absent
bodies.

The existing opaque path cannot establish the physical ceiling from logical
browser interceptions. [ADR-0041](adr-0041-inspected-meta-stock-reference.md)
records actual retries below those interceptions and the local physical
inspection proof. Its permission is Meta-only and is not borrowed here.
`rig/inspected-http-wire.mjs:171-176,380-388` currently selects the Meta policy
and an eight-request ceiling. `rig/inspected-transport.mjs:139-152` connects
only to the fixed Meta collector. These are reusable framing/relay mechanisms,
not an already implemented or qualified Google executor.

The current local bundle reports Chrome 156.0.8078.80. Earlier .48/.49
receipts are historical. The exact executable, source and dependencies must
be bound and qualified before the Google case.

## Decision Options Considered

### Option A: Wait for a complete owner-provided recording

- **Pros:** Avoids a new automated native operation.
- **Cons:** The available recording lacks required responses and branches.
  The owner would need to perform more capture work.

### Option B: Treat logical browser admissions as physical requests

- **Pros:** Retains ordinary browser TLS.
- **Cons:** Does not enforce the approved physical ceiling when Chrome retries
  below interception. The existing controls refute that equivalence.

### Option C: Record a separately labelled inspected Google reference

- **Pros:** Makes physical requests, complete HTTP bytes and response branches
  observable before forwarding. Reuses the existing closed Google policy.
- **Cons:** Needs Google-specific composition and current-browser controls.
  TLS fingerprints differ from an ordinary browser connection.

## Recommended Decision

Select Option C for the first owned Google reference. Keep ADR-0041 unchanged.

1. Use the existing owned Secondary action, isolated origin and retained pinned
   official source. Preserve the native initialization/configuration and
   consent transcript, followed by at most one explicit USD 1 conversion.
   Generate a fresh transaction input. No real purchase, ad click, PII,
   enhanced conversion, campaign, billing or unrelated tag change is allowed.
2. Verify and durably reserve the original Google stock slot before SDK
   execution. This decision does not refund any spent slot or grant a retry.
   A different output directory, failure or incomplete capture cannot renew
   the operation. An unavailable original slot blocks execution.
3. Keep the existing per-case ceilings: 20 physical vendor HTTP attempts,
   64 observations, 2 KiB URLs, 64 KiB request headers/body, 2 MiB accepted
   response bytes, 8 MiB aggregate retention and one absolute 60-second
   window including settlement, cleanup and output. Count each physical
   request before forwarding, including retries and redirect hops.
4. Compose the existing exact Google stock policy with physical inspection.
   Permit only its fixed HTTPS authorities and eligible method/resource/
   path/query combinations. Bind destination, label, document, value, currency
   and transaction to private case inputs. No host wildcard or generic proxy
   is introduced.
5. The selector-free `ad.doubleclick.net/ccm/s/collect` companion is permitted
   only after a same-case owned primary and with its exact nonempty AUID,
   under the existing policy's explicit companion flag. That correlation
   is not independent ownership authentication. Returned or redirected
   destinations require their actual completed parent response and exact
   approved relationship. Unknown branches stop the case.
6. Confine the fresh browser to the case's authenticated loopback broker.
   Trust only the ephemeral inspector certificate in that disposable browser.
   Keep upstream hostname and certificate validation enabled. No system
   trust edit, broad certificate bypass, open proxy, personal browser
   profile, TLS-key logging or retained inspector private key is allowed.
7. Retain original application bytes, ordered duplicate headers, response
   bodies/status, redirect/fanout relationships and actual browser cookie/
   storage effects. Missing, truncated, blocked, over-limit or unobservable
   required behavior produces an incomplete reference, never a qualified
   reference with omissions normalized away.
8. Qualify positive, enforced and matched-bypass receiving controls for the
   composed Google path before live admission. Include physical retry/count,
   foreign or missing marker, parent relationship, response/body, deadline,
   current-browser ownership and normal/aborted cleanup controls. A unit
   verdict or another vendor's receipt is insufficient.
9. Record `inspected-network` in the reference, original-byte provenance,
   completion and every consumer. Preserve ordinary-browser TLS parity,
   product receipt, matching, reporting and attribution as separate unproved
   claims. Do not silently erase cohort differences in a comparison.
10. Bind current source/setup and a finite nonoverlapping measurement window.
    Honor other lanes' source holds. The existing root page must use its
    `meta-pixel=off` gate, or a separately verified Meta-free fixture.
    No Meta case or implementation is changed by this Google work.

This is reference preparation for 059-01. It changes no frozen core contract,
production consent policy or consent-wait/replay decision. The conditional
Google chamber slot still requires a complete reference, boundary/scenario/
performance readiness and its own qualifying source and evidence. It is not
another stock attempt.

## Consequences

**Becomes easier:**
- The coordinator can prepare and execute the approved finite reference
  without repeated routine permission questions.
- Complete responses and physical retries can be evaluated directly instead
  of inferred from browser event counts.

**Becomes harder:**
- The Google composition needs actual current-source qualification.
- The result remains a distinct transport cohort and cannot establish the
  customer's ordinary-browser adoption or downstream attribution.

## Assumptions

- Unverified: all applicable branches fit the unchanged request and byte
  ceilings and the closed Google policy. Exhaustion or an unknown branch
  stops the case without expansion or automatic retry.
- Unverified: the collector provides a complete useful response chain in
  the inspected cohort. HTTP acceptance alone cannot establish product receipt.
- Unverified: current-browser receiving and cleanup controls qualify the
  new Google composition. Earlier Meta/local receipts do not establish this.

## Kill criteria

- The composed path cannot enforce its physical ceiling before forwarding.
- Source, peer, upstream TLS, branch or cleanup ownership cannot be qualified.
- The original Google slot is unavailable, the owned setup differs, or the
  required behavior cannot fit the approved scope.
- The result would require presenting inspected-network evidence as
  ordinary-browser or downstream product proof.

## Open questions

Technical qualification and complete native behavior remain open. No further
owner policy choice is selected by this decision.
