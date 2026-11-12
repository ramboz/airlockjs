# Proposed option: owner-attested native control

No independent issuer, verification key or approval-receipt service has
been supplied. The selected source-only direction makes the owner and the
coordinating session responsible for their attestations. It would also keep
the browser handle in the owner's foreground process while a separate
command requests stop. The tradeoff is that a malicious same-user coordinator
could forge or bypass the workflow; software cannot establish independence
from that actor under this model.

**Status: selected direction for source-only framing.** The owner said
"I give you my approval" at `2026-11-04T23:21:49.600Z` to the bounded
source-only continuation and this direction. The cooperative stop retains
the narrower closure dependency described below. This does not accept
[ADR-0051](../../decisions/adr-0051-fresh-native-only-admission.md) or
release any native effect. A new actual independent frame pass is required
before source implementation; the exact reviewed decision needs explicit
owner acceptance, a new finite physical allocation and actual owner
readiness before effects.

The original approved plan stays unchanged at SHA-256
`42ad9313e9c98b04716ec6ce414fa6e2660eb9d8cfb4545d3f80dca8c68b478e`.
The existing frame passes reviewed earlier checkpoints; they do not review
or approve this amendment. The current canonical frame result is
`needs-changes` on `47c9511500bdb9054a505d4df49430d5b897fb9a` for the
initial deadline and remains non-clearing. The earlier option is retained in
Git at `5f3e4379`.

At `2026-11-05T00:50:41.283Z`, the owner approved the browser-owned bundle
manifest and limited owned-descriptor cleanup directions. The exact schema
and limits in the [native contract](slice-09-fresh-native-readiness-contract.md)
remain proposed and need a new actual frame review. At
`2026-11-05T00:59:12.813Z`, the owner approved source-only continuation
and delegated extensions as needed for this scope. Neither approval accepts
the exact decision or grants physical or cleanup effects.

## Trust boundary

The owner personally starts the reviewed foreground command in an actual
external native terminal, remains available, and authorizes the exact job
and its readiness challenge. The parent records the actual owner acceptance
and each actual owner readiness confirmation as auditable attestations,
without claiming direct observation of the external terminal or independent
human authentication. The coding-session terminal, a model-piped response, a chat
message alone, a caller-created boolean or a fabricated receipt is not
the owner's real external-terminal action. Missing actual action or owner
confirmation stops the case.

The owner and same-user coordinating process are inside the trusted
computing base. They can write the same private records and can bypass or
forge their own workflow. File ownership, private permissions, hashes and
challenge matching support consistency and accountable operation; they do
not prove who performed an action against a malicious same-user actor.
This option relies on the actual owner action and the parent's truthful
record of the owner's confirmation, rather than a cryptographic guarantee
the current environment does not provide.

Software would validate the closed case and field set, owner user ID,
reviewed source and decision digests, exact job and allocation binding,
reservations, timestamps, challenge and receipt consistency. It would
refuse absent, conflicting, altered or stale START evidence. A valid-looking
receipt by itself does not establish that the real owner was present.

The proposed invocation also supplies initial deadline timestamps before
controller filesystem work. They must match the immutable job and plan and
cannot widen later. They are trusted-operator consistency inputs, not
independent authentication or physical authority. STOP uses the hard stop,
not START expiry; the contract defines the fixed bootstrap and cleanup
bounds. Node startup and OS completion are not qualified by those checks.

The stronger alternative remains independent issuer authentication. It is
blocked until a real external trust anchor and verification mechanism are
provided. A newly generated same-user key, an arbitrary caller-supplied key
or an approval broker built for this checkpoint would not satisfy it.

## Proposed attestation sequence

This sequence is an option for the next frame review, not an available
command or authorization to perform it:

1. The owner explicitly accepts the exact reviewed decision separately from
   the work-window approval. The parent retains an acceptance record naming
   the owner, decision digest, acceptance time and actual source of that
   acceptance. A plan approval or review verdict is not acceptance.
2. Before each case, the parent and owner agree on the immutable job,
   including its named case, nonce, owner, source pins, decision, allocation,
   deadlines and predetermined private receipt references. Hash the complete
   job after those references are fixed. The readiness receipt then binds that
   job digest, the case nonce and a fresh challenge without changing the job.
3. The owner personally starts the reviewed command in the external native
   terminal, checks the displayed job identity, responds to the exact
   challenge there and confirms readiness for that job to the parent.
   Before reservation or browser acquisition, the command waits for the
   parent's case release and matching readiness record. The parent records
   the owner's confirmation and its time, binding it to the same job,
   challenge and acceptance record. No model supplies or pipes the response.
4. The parent releases the specific case only after the actual source safety
   reviews and all other gates pass. START verifies the matching records,
   release and freshness before reservation and again before launch. The
   fixed 45-second case and ten-second observation must fit before the
   earlier of admission expiry and the hard stop.

The parent does not claim to observe the real external terminal or
independently authenticate human presence. Owner and coordinator are trusted
to perform and record their roles honestly. If the owner has not personally
acted and confirmed readiness, the case does not start. Private challenge
values, endpoints and detailed handles remain out of public records.

## Proposed stop-only protocol

As an alternative to selecting an endpoint from a file, the foreground
producer retains the actual `BrowserServer` handle returned by its own
launch. The separately invoked stop-only command can durably write a
job-bound revocation under the fixed case coordination rules. It cannot
choose an endpoint, start a browser, create a context or page, resume work,
or issue an arbitrary command. The still-live producer consumes that
revocation and closes the handle it retained, subject to the deadline.

The existing short lock and no-clobber reservation rules still need source
review. Stop must serialize with each next admission. While the actual
launch promise is unresolved, the lock cannot prevent the separate command
from recording revocation. After launch settles, the producer must observe
that revocation before publishing readiness or admitting a context, and
close the returned owned handle within the remaining hard-stop bound.
The second control only passes if the actual stop was recorded while the
real launch was unresolved. Delayed publication or a mocked launch is not
that observation.

For an already consumed case, the same owner/job/source/decision-bound
revocation and closure remain available after START admission expires,
strictly before the hard stop. START freshness must not be reapplied to
deny this STOP. No new stop or browser effect starts at or after the hard
stop. The contract separately proposes a finite, owner-allocated exception
for closing already-owned file or directory descriptors only; no such
allocation exists now. Missing
producer, unconsumed revocation, unverified retained handle, failure,
timeout or unobserved closure is UNKNOWN. A stop command returning after
writing a marker is not a closure result.

This option makes stop invocation independent of the foreground command's
terminal, but closure still depends on the foreground producer being alive
and responsive. Foreground-producer-loss cleanup, recursive descendant
closure, host-wide isolation and general filesystem race safety remain
unqualified. It does not add a daemon, service, broker or generic runner.
The frame reviewer must decide whether this concrete dependency remains
within the approved fixed foreground and independent-stop scope. If it does
not, stop instead of claiming an independent close.

## Unchanged boundaries

The proposed future ceiling remains two fixed, SDK-free blank controls, one launch and at
most one isolated context and page per case, no retries, and 45 seconds plus
at most ten seconds of observation per case. The first must be positively
observed before the second can be released. Attempted and UNKNOWN work stays
charged; an unsafe or UNKNOWN result stops further attempts. The earlier
unused physical allocation expired and is not renewed; a new finite
allocation is required before any such control.

No Adobe changes, deployment, external page navigation, credential-bearing
browser environment, owner profile, SDK acquisition/evaluation/dispatch or
live admission follows. The existing external-terminal, review, owner
decision, source/decision pin, allocation, deadline and preflight gates
remain separate. Historical run/retry refusals, C FAIL and UNKNOWNs remain
intact. Full 051-09 remains IN_PROGRESS; actual evidence, provenance and
execution readiness remain false. The earlier window ended at
`2026-11-04T23:10:25.228Z`. The earlier source-only window ended at
`2026-11-05T00:51:49.600Z`. The new source-only continuation has an initial
progress checkpoint at `2026-11-05T02:29:12.813Z`, with extensions delegated
for the same source scope. It admits no physical cases. No old allocation
or session count is reset.
