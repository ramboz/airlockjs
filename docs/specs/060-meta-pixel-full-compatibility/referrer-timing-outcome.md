# Referrer and timing comparison: bounded outcome

**One approved attempt ran. The result is inconclusive because the native
internal sample remains unresolved. The grant is spent.**

The owner selected "Approve this exact single attempt (Recommended)" after
the source and operational reviews passed. The decision bound clean
`d92f53f22b93fec44a36e142c10ff590b18bb5b9`, existing verified private inputs,
the exact route roster, one unused case directory and the complete
[reviewed proposal](referrer-timing-execution-proposal.md). Its public source
admission was
`ae34558f39500cc3b14837b911293b9fd614d027f2032ca96d29afe22c8a9076`.
The actual returned selection supplied permission, not a parent relay timeout.

## What ran and what returned

The final source/private precheck passed before the sole CLI invocation.
It confirmed 33 source files, 22 browser-serving files, original-role pins,
unchanged private input/roster bindings, restricted modes and the unused case
path. The route inventory remained native/off/on 4/32/32.

The exact reviewed `run` entry was invoked once with its five fixed arguments.
It returned exit 1 with:

```json
{
  "status": "inconclusive",
  "reason": "sample-unresolved",
  "cleanup": "completed",
  "contexts": 3,
  "fullCompatibility": false,
  "full06001": false,
  "fullParity": false
}
```

The three contexts are the reviewed native, replacement-off and
replacement-on cases. This result is expected by the reader's conservative
browser rule. It is not a successful per-field parity verdict, and exit 1
does not authorize a retry.

A separate read-only invocation of the reviewed private reader confirmed
`inconclusive` / `sample-unresolved`, with evidence `browser`. It checked
the source admission and packet binding without changing the packet. The
case directory and both exclusive files passed owned 0700/0600 checks.
Only fixed categories/counts and the public source digest were emitted.
No browser or SDK was executed by that verifier.

## Observed own-input relationships

Readback classifies existing records only. It does not execute another case
or compare redacted tokens.

| Cohort | `ler` observation | `plt` observation |
|---|---|---|
| Native | One wire value matches its own stored category. The initial pair is absent; the category rule matches, its timestamp falls inside the installation bracket, and the pair is unchanged through the event. | One positive wire duration matches the unrounded duration from its own before-install observation. All four timing snapshots are unchanged. |
| Replacement off | Zero wire values, zero observer reads and zero runtime primitives. | Zero wire values and zero feature timing captures. |
| Replacement on | One wire value matches its own stored category. The initial pair is absent; the category rule and installation timestamp bracket match, and the pair stays unchanged through the event. | One positive wire duration matches its own first positive command snapshot. Both command durations are the same; all four timing snapshots are unchanged. |

No own-input mismatch was found in those retained checks. This is a match to
each side's observations, not identical-input/native equivalence. There are
4/32/32 actual request rows, one measurement row in each cohort, 8/0/8
issued and confirmed observer reads, and 4/0/4 feature timing captures.
Replacement off/on recorded 0/6 runtime storage primitives, below the
unchanged eight-operation ceiling. Native ambient SDK storage operations
are not counted by those observer counters.

The native timing reference is the harness's before-install snapshot, not an
observed SDK-internal read. Neither the plugin-installation sample/cache
creation point nor its relationship to later init/PageView is directly
observed. The raw document-referrer versus SDK referrer-manager decision also
remains unobserved. The two replacement command durations being equal does
not discriminate cached reuse from resampling in this browser case.
Changed-input cache behavior remains synthetic evidence.

These are the precise reasons the retained matches do not clear
`sample-unresolved`. The recorder marks both observed cohorts' sample
assessments ambiguous, and the reader deliberately keeps browser-labelled
records inconclusive (`rig/meta-referrer-timing-browser.mjs:314-320`;
`rig/meta-referrer-timing-case.mjs:402-417,476-496,543-548`).
Retained-source relationships remain C:L121-122, 158035-159692 for referrer,
and C:L172, 206577-207356 for timing.

Private originals and the new raw packet remain outside tracked source.
The session preserves the actual operation result, read-only verification
source/receipt and exact approval record. No private identifier, URL, timing,
storage value or private digest is reproduced here.

## What remains unproved

The reader validates the recorded envelope and source-backed relationships,
but installation/event brackets do not observe the native internal timing
sample or referrer-manager decision. Origin and sampling differences remain
visible. Native HTTPS state was not copied into the loopback replacement.
The report's evidence-layer labels remain `unavailable`, including worker
execution, native attempt and actual dispatch/response qualification.
Backend receipt, matching, deduplication, catalog/audience and attribution
also remain unavailable.

`cleanup: completed` records owned API close-call and deadline-tracker
settlement. It does not independently establish worker-process exit,
temporary-profile deletion, OS process termination or host-wide cleanup.
Those layers remain unknown. Terminal interception/CSP/watchdogs do not
establish physical confinement, and 059-18 stays NO-GO.

The native measurement route was aborted. Local source/document fulfillments
and candidate loopback-relay responses are not vendor responses or receipts.
No physical, native-lifetime/consent/cohort, `iw` page-realm or full Pixel
qualification follows.

## Scope and next authority

No retry, repair, installation, new source acquisition, account/site mutation,
origin expansion or automatic successor occurred. Native8/on8/off0 observer
authority and the replacement's existing runtime8/exact-loopback boundary
were unchanged. The one execution grant is consumed. Any further
browser/SDK operation requires a new separately reviewed exact decision;
none is proposed by this close-out.

The bounded 060-19 deliverable is the recorded comparison packet and honest
inconclusive result. Full 060-01/C1-C9, foreign claims, Accepted ADR-0055,
closed 060-18, historical UNKNOWN cleanup/traffic, withheld history and the
separate ADR-0045 collision remain unchanged.
