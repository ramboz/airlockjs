---
status: Proposed
dependencies: [adr-0035]
last_verified:
frame_review: true
---

# ADR-0038: Supervised native Meta resource lifecycle

## Status

Proposed (2026-10-21)

## Context

A fixed supervised native runner would preserve owned browser lifetimes through interrupted launch and cleanup.

The tradeoff is one narrowly defined parent/child protocol and temporary root,
instead of treating successful normal cleanup as proof of interrupted cleanup.
It adds no event grant or runtime capability: the single additional Meta case,
eight physical attempts, byte/privacy limits and absolute 60-second window in
[ADR-0035](adr-0035-additional-one-shot-meta-authority.md) remain unchanged.

The committed `74fa0cc` tooling checkpoint qualifies SDK-absent additional
authority/reservation and ownership controls, not native resource readiness.
Native preparation and transport leases are process-local WeakMaps
(`rig/inspected-meta-stock.mjs:1009-1056`). Canonical consumption precedes
SDK execution (`:1349-1358`). Durable ports/pending/browser registration is
currently local-and-additional only (`:1444-1455`); the supervisor accepts its
fixed local programs (`rig/meta-additional-supervision.mjs:169-183`).

Native browser handles, fresh contexts, authenticated proxy peers, endpoint
closure and key removal provide real normal-path evidence. Root-process
escalation and sixteen cleanup flags do not independently establish Node
failure handling, detached-group closure or positive profile removal
(`rig/inspected-meta-stock.mjs:1704-1743`). Pinned Playwright creates the
temporary profile before process launch and returns BrowserServer only after
browser/driver setup (`node_modules/playwright-core/lib/coreBundle.js:39503-39509,56823-56876`).
There is no established public `launchServer` userDataDir option or complete
pre-return logger here. An assumed external wrapper cannot fill that gap.

The coordinator selected this proposal under existing autonomous preparation
delegation. The focused design question could not receive an owner answer;
no new explicit owner design acceptance is claimed. This record remains
Proposed, with independent framing and offline falsification required before
any acceptance or native admission.

Partial executed grounding (2026-10-21): the new fixed Node/TCP peer primitive
(`rig/meta-rendezvous-peer.mjs:26,187`) accepted the exact issued launcher and
rejected genuinely connected sibling, forged-PID/right-correlation,
wrong-correlation and no-frame timeout controls. The corrected-source run
closed once at23:44:32.073437Z, exit0/2,985 ms, with owned helpers/groups/
listener/sockets closed. Parent verification checked26 current artifact
hashes/file identities and replayed four material assessments from original
OS observations, separately preserving30 v1 artifacts and five correction
receipts. This proves only the fixed Node peer relationship: actual Chrome
exec/profile acquisition, interrupted launch and the native case lifecycle
remain unproved. A cleanup-error handle-retention finding was corrected with
unconditional disposal and guard-sensitive pure tests; those simulated failures
do not establish a real-time native abort bound.

## Decision Options Considered

### Option A: Reuse normal native cleanup flags as the complete ownership proof
- **Pros:** No new process boundary.
- **Cons:** Does not cover interrupted launch, unreturned handles, Node failure,
  group lifetime or profile disposition. Rejected.

### Option B: Add post-hoc discovery or private Playwright hooks
- **Pros:** Could retain the single-process shape.
- **Cons:** Recovery after a lost parent lacks a closed acquisition ledger;
  undocumented launch/profile hooks or incomplete logs are not a supported
  ownership contract. Broader process/profile inspection is not authorized.
  Rejected.

### Option C: Fixed additional-only supervised child and pre-exec rendezvous
- **Pros:** Keeps ownership before effects, reuses qualified identity/deadline
  primitives and makes interrupted acquisition attributable without host-wide
  discovery or new authority.
- **Cons:** Needs a closed IPC/resource-ticket contract, parent-owned temporary
  root, fixed launcher rendezvous and independently authoritative completion.
  These are new proof obligations, not capabilities supplied by this proposal.

## Recommended Decision

Propose Option C for the native **additional Meta** path only.

1. Keep `prepareInspectedMetaStock` inert and its private prepared-plan entry.
   Dispatch only a genuinely prepared native additional plan through a fixed
   supervised child. Pass immutable manifest locator/hash and closed case
   metadata, never a serialized WeakMap plan or transport lease. The child
   independently reprepares and alone reserves the same canonical slot before
   SDK execution. Original/synthetic legacy behavior and disabled stock CLI
   remain unchanged; no selectable executable, URL, clock or bypass.
2. Before child acquisition, create/register one private case temporary root
   by path/device/inode/birth/UID and bind it to the exact manifest, source,
   cohort/window, authority/lineage and canonical reservation. Internally
   scope the dedicated child's temporary directory to that root. Do not use
   unsupported browser profile arguments or inspect global profile directories.
3. Use a fixed additional-only launcher rendezvous **before Chrome exec**.
   Persist and independently verify the launcher lifetime/group and newly
   allocated profile identity before acknowledging launch. Keep an owner for
   pending/late acquisition even if the engine Node dies before launchServer
   returns. Cover exact descendants through closure or an explicit attributable
   unqualified abort; never call unknown ownership closed or signal a guessed
   PID/group/profile. Reuse serialized discovery and fresh lifetime checks.
4. Distinguish native common resource roles (Node, browser/profile, proxy/
   driver endpoints and inspector key) from fixture-only receiver roles.
   A synthetic receiver key/port cannot masquerade as a native resource.
   The proxy's private construction lease is not upstream authority. Require
   genuine ownership readiness before document/bootstrap fulfillment,
   SDK-source continuation and native logical/upstream continuation.
5. Retain all existing setup/source/permission/review, physical semantic/count/
   response, strict TLS and no-retry checks. Bind resource tickets/registrations
   to the exact immutable case, not reusable IPC acknowledgements. Source or
   grant mutation across parent preparation, child reprepare, reservation and
   continuation fails closed. Never modify/refund the original or extra spend.
6. Use one absolute case deadline including launch, observation, termination,
   cleanup and publication. Child reprepare cannot restart it. Qualify explicit
   phase reserves; reject an observation_end incompatible with those reserves
   **before reservation**. Do not blindly apply the local 40-second cutoff,
   increase the case allowance or let registration drain escape the deadline.
   Signals remain specific-PID and fresh-identity checked, not name/group-wide.
7. Keep child HTTP/source originals and its sixteen narrow cleanup facts.
   The additional final resource result additionally needs independently
   observed Node exit, browser-group disposition, exact profile removal,
   endpoint/key disposition and publication. Child wire completeness alone
   cannot establish final resource-complete success. Failed/unknown cleanup
   produces a durable unqualified result/abort handoff with actual spend and
   available originals preserved, never a successful fallback or retry grant.
8. Qualify the **new orchestration/acquisition branch itself** SDK-absent,
   through a closed synthetic counterpart using literal-loopback first-party
   traffic and the same fixed child/launcher/ownership path. Synthetic plans
   must remain unable to mint a native transport lease. Require real H1/H2
   positives, allocated-browser/TERM-ignoring-Node shutdown, and an actual
   pre-return rendezvous interruption/late-browser acquisition without a
   returned BrowserServer handle. Preserve failures. Add semantic identity/
   chronology/disconnect/deletion/window/source contradictions and remove a
   real guard to defeat its regression. Pin all new helpers/tests/launcher
   dependencies and refresh current shared proof after changes.
9. This proposal cannot clear historical browser/profile UNKNOWNs, Adobe's
   whole-helper gate or host-wide quiescence. It authorizes no source GET,
   SDK initialization, case permission, hold/window, event, deployment, wider
   process/profile action, Google/chamber/production inspection or C2/C3 claim.

### Closed ticket and result contract

The resource protocol is internal control data, not a bearer network grant.
Its proposed logical records are closed and versioned:

- **Ticket:** manifest locator/hash/file identity; binding/source/cohort/window
  digests; authority/lineage locators and canonical slot; observation end and
  the same absolute deadline; parent/child lifetime identities; owned temporary
  root identity. Program/driver/destination/clock fields are not caller options.
  A one-case unpredictable rendezvous correlation value is private; receipts
  retain only its digest, never reusable secret material.
- **Acquisition:** ordered cumulative Node, pending launch, launcher/profile,
  actual Chrome/group, endpoints and key registrations. Each names exact
  PID/parent/group/UID/birth/command and path/device/inode/birth/UID facts as
  appropriate. The supervisor independently verifies attribution and fsyncs
  its ledger before issuing the corresponding sequence/hash acknowledgement.
  Self-reported PIDs or possession of a correlation value alone cannot prove
  connection ownership. The rendezvous must bind its actual peer/owned lineage
  through supported OS observations; if that cannot be proved, no Chrome exec.
- **Readiness:** exact ticket/registration digest and current owned-resource
  state; it permits only the next fixed acquisition/continuation step. It
  cannot reserve, mint a native lease or override an admission failure.
  Parent disconnect stops readiness/egress continuation. A lost peer, failed
  registration or unproved launch remains attributable pending/unknown, never
  accepted as completed cleanup.
- **Final disposition:** immutable child report/capture/completion handles,
  independently observed child exit, full registration chain, browser/group/
  profile/endpoint/key dispositions, actual spend, monotonic elapsed time and
  publication ordering. Preserve the child's original claims; the parent's
  resource-complete additional result cannot be successful unless both the
  child wire result and all required final resources qualify. Unknowns remain
  explicit, unqualified and separately recoverable under their recorded owner.
- **Qualification:** a separate current-source SDK-absent index must exercise
  this new orchestration path, its common native resource roles, normals and
  allocated/pre-return aborts. It records zero SDK/provider/actual owner-slot
  execution and cannot be substituted for native authority. Existing local
  additional and shared fourteen/eleven indices remain distinct obligations.

Concrete field schemas must preserve these relationships without a generic
RPC framework or configurable launcher. Narrow helper schemas may be refined
during TDD; an unresolved attribution/deadline capability is not a schema nit
and keeps native readiness blocked.

### Proposed pre-exec bootstrap actors

The next mechanical candidate distinguishes **P** (supervisor), **E**
(launching Node), **L** (shell launcher/eventual Chrome PID), and **H**
(separate fixed Node rendezvous helper). It is not the implemented direct-child
Node/TCP probe and does not inherit that probe's group-leader predicate.

Grounded constraints: Playwright allocates its profile using the launching
Node's `os.tmpdir()` before spawn (`coreBundle.js:39489-39548`); setting only
the browser's launch `env` does not scope that earlier allocation. Driver
arguments supply the profile/debug pipe (`:43046-43063`), with stdio0-4 and
FD3/4 for the debugger (`:8898-8913,39605-39609`). Installed Node typings say
`process.execve` preserves only stdin/stdout/stderr
(`node_modules/@types/node/process.d.ts:2175-2187`); it is not this launcher.
Existing confinement is network confinement, not case-root filesystem isolation.

1. P records the private root and dedicated temporary subtree before E exists.
   E receives the scoped TMPDIR before Node/module startup; parent-global
   environment is unchanged. Observe profile/artifact directories only below
   that registered root, without calling them filesystem-sandboxed.
2. L receives and forwards the exact driver argument vector. It rejects
   duplicate or out-of-root profile arguments, invokes fixed H, then uses
   POSIX shell exec into the unchanged confined launcher. L retains PID/group/
   birth and FD0-4; close FD3/4 only in H's invocation so H cannot consume or
   retain the driver pipes. Do not use browser stdout/stderr for the handshake.
3. While E is alive, P attributes scoped E-to-L-to-H ancestry and exact images,
   L's group-leader identity/profile and H's membership in **L's group**.
   Persist both separately before permitting H's TCP. A closed role-specific
   predicate is required; never silently relax the proven direct-peer rule.
4. H has no inherited Node IPC channel to P. A private case-root enrollment
   record may enable only its fixed TCP attempt after P's scoped OS checks;
   it grants no Chrome exec. The subsequent kernel-attributed H connection,
   private challenge and revalidated L/profile must be durably recorded before
   the final exec-ready response. Announcement, claimed PID, nonce or
   enrollment-file possession alone cannot establish ownership.
5. After E fails, preserve any already observed L/H acquisition and follow
   only those recorded lifetimes through permitted exec changes. If E dies
   before L/H attribution, issue no TCP/exec-ready permission: L/H must
   self-terminate boundedly, and unproved disposition remains an explicit
   case-scoped abort, not claimed closure. Proving this earliest seam is still
   a readiness obligation, not settled by a planned timeout.

First falsify argument/profile parsing, role/group predicates and real shell
FD/PID preservation with fixed SDK-absent first-party helpers. Only a separately
reviewed/qualified browser phase may test real Chrome/CDP and pre-return
interruption. A genuine pre-return control holds L before exec, freshly stops
the owned E while its launchServer is pending, then permits/observes Chrome
allocation and interrupts E; it must not merely delay delivery of an already
returned handle. Every actual acquisition needs supported closure or truthful
attributable abort evidence; native execution stays blocked.

### Descriptor-observer replacement under qualification

The rejected lsof mechanism is not replaced by an empty identity list or a
numeric-FD assertion. The current alternative is a fixed first-party C
observation helper using installed macOS SDK declarations:
`libproc.h:96-97` exports `proc_pidinfo`/`proc_pidfdinfo`;
`sys/proc_info.h:538-571` calls `socket_fdinfo.psi.soi_so` an **opaque handle
of socket**; the bounded descriptor inventory and socket flavor are defined
at `:659-675,717,777-778`.

A self-PID-only executed probe on2026-10-22 returned nonzero, distinct socket
handles, the same handle for a `dup` alias, a complete bounded self inventory
and a real transmitted byte, then closed all five created descriptors. The
installed compiler needed its explicit installed SDK sysroot; the initial
build error is preserved. No dependency installation, other-PID observation,
child acquisition, browser or native execution was part of that proof.

This self/dup evidence is **not cross-process isolation proof**. The candidate
must independently constrain every target to the invoking supervisor's verified
E/L/H ancestry, UID, groups and kernel birth identities, before and after the
query. It must enumerate the complete bounded FD inventory, query every
socket, reject unknown types/errors/truncation/races, and compare nonzero
opaque handles rather than numbers or fabricated lsof output. Explicitly
typed non-socket descriptors are not missing sockets or guessed identities.

Compile only the fixed source as a **separate preparation step** using the
existing installed toolchain; retain source/header/compiler/binary/command
provenance. Runtime compilation was rejected because compiler descendants and
their IO would otherwise need another ownership/termination contract inside
the mechanical case. A tracked cohort pins the exact permitted source,
binary, SDK headers and compiler; runtime accepts only that known binary at
its hash-derived private path, with identity/content checks around each query.
No caller-selected executable or dynamically accepted build result is allowed.
No binary is committed. Missing or mismatched preparation blocks before E.

The existing mechanical deadline includes artifact validation and observations,
not a newly restarted allowance. Native case limits are unchanged. This is
reference tooling, not a Node addon, browser/native dispatch capability or
arbitrary-PID/program interface.

Before integration can qualify, execute an owned cross-process inherited-
socket positive and closed-socket negative, followed by the fixed bootstrap's
normal/refusal and failure controls. A self-only pass, compilation, mocks,
source review or manually supplied JSON cannot supply those results. The new
method stays unqualified until that evidence actually exists.

Subsequent first-party Node/shell evidence on2026-10-22 passed the actual
current-source normal, connected-refusal and inherited-socket controls,
with per-case measured elapsed time below45 seconds and outer CLI0.
Parent verification retained265 artifacts and the exact resource/query
relationships. This qualifies that fixed Node/shell observation mechanism
only: real Chrome/CDP/profile ownership and pre-return browser interruption
remain unimplemented/unproved, as does the native additional execution path.
It does not accept this Proposed decision or create execution authority.

A separate API-wrapper check established that `proc_listchildpids` returns a
PID **count**, unlike `PROC_PIDLISTFDS`'s byte count. Its first diagnostic
asserted the wrong units before saving its child PID; that failed probe did
not observe the child exit and remains an explicit limited UNKNOWN, not a
closure claim from its source's EOF/alarm intent. A corrected diagnostic saved
the issued PID first, retained raw return1 for its single child, and always
waited/reaped that child (actual exit0). Neither probe created a browser,
profile or provider connection. They cannot clear the independent historical
resource gates.

## Consequences

**Becomes easier:**
- A native case can eventually have supported acquisition/abort evidence,
  including failure before a browser handle exists.
- Known case resources remain attributable without guessing old/unowned PIDs
  or treating historical-directory cleanup as a substitute.

**Becomes harder:**
- Parent/child state, one-shot reservation and authoritative completion must
  be reconciled without transporting private execution capabilities.
- The pre-return path, role topology and finite cleanup reserves need genuine
  executed evidence, not just normal-success mocks.

## Assumptions

<!-- Spec 064-02 / ADR-0020 §1–§2 — grounding-by-probe (risk-gated). -->

- Unverified: scoped temporary-directory creation plus a fixed pre-exec
  rendezvous can close the acquisition ledger without private browser hooks
  or widening existing OS/network confinement. Prove with pinned real browser
  launch, not unsupported option declarations.
- Unverified: the rendezvous can independently bind the connecting launcher
  and its owned profile/lineage using supported observations, rather than
  trusting a message's PID or a correlation secret. Prove this before treating
  the resource protocol as an authentication boundary.
- Unverified: same-path SDK-absent tests can exercise the proposed native
  resource topology and interruption boundary without gaining native
  authority. Failure of that separation blocks admission.
- Unverified: the complete acquisition/observation/abort/publication contract
  fits the unchanged case deadline. Qualify reserves and reject incompatible
  windows rather than assuming a successful fast path establishes the bound.
- Historical mechanism falsified by executed evidence (2026-10-22): this host's `/usr/sbin/lsof`
  4.91 rejects `+ff` and does not advertise file-structure-address field `F`.
  That lsof observer could not prove debugger-handle noninheritance. The
  subsequent fixed SDK observer qualified the Node/shell mechanism with its
  own actual controls; FD numbers, zero identities, generic manual
  text and skipped checks are not substitutes. The normal-only v3 diagnostic
  stopped before enrollment/exec; no browser or native case ran.
- The fixed Node/shell cases now demonstrate cross-process socket-handle
  comparability, inherited-alias rejection and complete observed inventories.
  Still unverified: real Chrome/profile and interrupted browser acquisition,
  including whether its descriptor dynamics can be sampled without concealing
  changed/vanished entries. Node/self/dup results do not qualify that context.

## Kill criteria

- Missing/late ownership can be reported closed, or cleanup requires guessed
  process/profile authority, ambient discovery or broadened confinement.
- Serialized plan/IPC state bypasses real child preparation, native transport
  capability checks, source/lineage continuity or canonical one-shot spend.
- Real pre-return interruption or pending acquisition cannot yield bounded,
  attributable closure/unknown handoff within the unchanged deadline.
- Proof requires public SDK/provider activity, a real slot or fake native
  receipts; normal local coverage is relabelled as the new branch.

## Open questions

Frame review must settle the closed resource-ticket, launcher rendezvous,
deadline and authoritative result contract before implementation is treated as
ready. Exact helper schemas/reserves require executed evidence; no guessed
numeric cutoff is accepted here. Native admission stays blocked.
The Node/shell descriptor-isolation mechanism is now supported by its actual
controls. Applying it to real Chrome, profile/late-acquisition cleanup and the
native case remains open; the conditional frame pass never supplied the
rejected lsof capability or those unexecuted browser results.

0038 is a local provisional reservation coordinated with the Adobe lane;
0036/0037 remain its identifier-only reservations. On2026-10-22,0039 was
separately coordinated for that lane's additive setup-refresh design, not this
native runner. Coordinate before0040+.
Normal before-landing origin/duplicate checks remain required. No remote,
main checkout, Accepted-body rewrite or landing permission follows.
