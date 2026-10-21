---
status: Accepted
dependencies: [adr-0017, adr-0033]
last_verified: 2026-10-20
frame_review: true
---

# ADR-0034: Inspected Meta stock references preserve a distinct transport cohort

## Status

Accepted (2026-10-20)

## Context

The first Meta stock reference may use an explicitly inspected network cohort.

The owner approved this design on 2026-10-20, conditionally on all remaining
guard, review, setup and scheduling gates. It uses the existing one-PageView
`meta-stock` slot, not an additional event. The owner was explicitly told that
Meta sees the inspector's TLS connection rather than Chrome's, and that
ordinary browser-network behavior and matching/attribution need separate
evidence. There is no immediate execution or booked measurement window.

Actual local receivers exposed an opaque-transport limitation: browser
retries produced nine HTTP attempts from eight logical admissions, including
an H2 retry on the same tunnel. Fetch pause, requestWillBeSent and final
ExtraInfo did not repeat. This is not a coordinator retry or the previously
approved later-header timing exception.
[059-15](../specs/059-google-ads-full-compatibility/slice-15-native-stock-capture.md)
preserves the blocker and its unchanged strict count requirement.

An owner-approved local experiment now counts physical header blocks before
forwarding them (`rig/reference-inspection.mjs:25-128`). Actual cold
cross-origin Chrome H1/H2 positives preserved original bidirectional HTTP
bytes, browser bodies and partitioned-cookie attachment. H1 close, H2
REFUSED_STREAM and GOAWAY enforced controls stopped at eight while matched
bypasses delivered nine. Peer and upstream certificate controls are explicit
at `rig/reference-inspection.mjs:212-253`; receiver byte comparisons and the
qualified matrix are at `:399-464`. The
[scoped independent review](../specs/059-google-ads-full-compatibility/reviews/slice-15-local-inspection.md)
passed this local-only proof, not the full live guard or native case.

The test-only opaque-TLS rule lives in the open 059-15 slice, not an accepted
product API contract. This decision adds a specific Meta-reference exception;
it does not supersede [ADR-0033](adr-0033-reframe-onto-full-google-meta-compatibility.md),
rewrite a closed record, change the frozen core or re-baseline the full
replacement target.

## Decision Options Considered

### Option A: Keep opaque browser TLS as the only reference path

- **Pros:** Preserves the ordinary browser-to-collector TLS cohort.
- **Cons:** The tested logical controller cannot enforce the physical ceiling
  or observe every hidden retry. Complete retained captures or another
  qualified mechanism would be needed; live admission remains blocked.

### Option B: Count logical admissions and tolerate unobserved physical retries

- **Pros:** Avoids TLS inspection.
- **Cons:** Weakens the approved physical ceiling and complete-wire evidence.
  Not authorized or selected.

### Option C: Inspect the first Meta reference in a separately labelled cohort

- **Pros:** Exposes physical attempts and original HTTP application bytes
  before forwarding, including retries below browser interception.
- **Cons:** Changes TLS fingerprints and can change vendor processing. It
  cannot establish ordinary browser-network equivalence or attribution.

## Recommended Decision

Select Option C for the existing `meta-stock` reference only, under the
owner's conditional approval.

1. Keep one native initialization/PageView, eight physical vendor HTTP
   attempts and the original sixty-second/byte/observation envelope. No retry,
   candidate-slot reuse, extra PageView or new canonical namespace follows.
2. Bind the original authority and this separate inspected-reference
   permission to the private case manifest. Durably reserve the original
   canonical stock slot before executing the SDK. A different output path,
   transport label, failure or interruption cannot renew it.
3. Keep the browser process confined. Authenticate the local browser peer,
   allow only the exact approved collector authorities and check every
   physical request's decoded semantic fields and final header/body budget
   before forwarding. The local raw-framing proof alone does not supply that
   complete policy.
4. Trust only the exact ephemeral inspector certificate in the isolated
   reference browser. Preserve strict upstream certificate and hostname
   validation. No system trust edit, global certificate bypass, credential
   logging, TLS key logging or open proxy is authorized.
5. Preserve original request/response bytes, pair order and duplicates,
   redirects, browser credentials/cookies and response/storage effects.
   Complete bounded originals and causal relationships must qualify before
   accepting a reference; missing or over-limit evidence stays inconclusive.
   Any blocked retry is a visible incomplete outcome, not full-reference
   success with native behavior silently removed.
6. Record `inspected-network` as a mandatory cohort dimension in manifests,
   captures, completion and comparisons. Stock and chamber comparisons must
   state their actual transport cohorts; do not equate an inspected stock
   trace with an ordinary browser trace by deleting that distinction.
7. Complete guard qualification, all required independent reviews, current
   setup/source binding and a fresh nonoverlapping finite window before
   effects. Neither this ADR nor the local proof admits a run by itself.
8. Leave Google, chamber/production inspection and browser-native TLS
   equivalence unapproved. The full replacement, performance, matching,
   reporting and attribution obligations of ADR-0033 remain open; an
   inspected reference cannot close them by implication.

## Consequences

**Becomes easier:**
- An initial Meta application-layer reference can progress without pretending
  that logical browser interception sees all backend-bound attempts.
- Hidden retries and intermediate originals become explicit evidence rather
  than silently omitted traffic.

**Becomes harder:**
- The operator must qualify and source-pin an additional privileged test
  boundary and distinguish both sides' TLS behavior.
- Further ordinary-browser and vendor-outcome evidence is still required;
  inspected-network equality is not the customer's complete adoption proof.

## Assumptions

- Unverified: the composed semantic/header/response/aggregate guard can handle
  all branches of the pinned Meta case within the original envelope. The
  GET-only local framing proof does not include HPACK semantic policy,
  compressed-response limits or actual SDK dependencies.
- Unverified: the real collector accepts and processes the inspected cohort
  usefully. HTTP delivery alone will not establish product receipt,
  ordinary-browser matching or attribution.
- Unverified: the complete native case fits eight physical attempts without
  suppression. Exhaustion spends/stops the case; it does not expand authority.

## Kill criteria

- The composed guard cannot enforce pre-forward semantic/count budgets or
  preserve complete originals: do not admit the SDK.
- An accepted trace requires header/body rewriting, manufactured response
  bytes, identity seeding or hiding a suppressed retry: keep it inconclusive.
- Collector TLS-sensitive behavior prevents meaningful use of the reference:
  report the observed limit; do not label it ordinary-browser equivalence.

## Open questions

No unresolved owner design choice for this conditional Meta exception.
Implementation qualification and a fresh execution window remain required.
