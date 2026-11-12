---
status: Proposed
dependencies: [adr-0017, adr-0039, adr-0039]
last_verified:
frame_review: true
---

# ADR-0044: Disposable Linux boundary for first-party qualification

## Status

Proposed (2026-10-22)

## Context

A kernel-contained Linux qualification could replace sampled descendant closure.

Use a disposable, positively owned local Linux environment for future
first-party process-lifetime qualification instead of treating macOS snapshots
as a complete process tree. This can contain a child that detaches/reparents;
the tradeoff is a new execution platform, independent supervisor and evidence
cohort, none of which is currently qualified.

The owner approved **design and independent review only** at
2026-10-22T20:37:52.777Z. This Proposed record authorizes no installation,
daemon contact, VM/container/browser launch, vendor traffic or implementation.
No environment is adopted, no older UNKNOWN is cleared and no live gate is
waived. The prepared macOS driver remains hard-disabled before consumption.
This is not a replacement execution grant for its old source or deadlines.

Separate subsequent grants permitted bounded read-only readiness checks and,
at2026-10-22T22:12:13.666Z, a source-only fixed supervisor control path with
synthetic failure tests. The
[051-02 source-controller increment](../specs/051-adobe-integration-proving-ground/slice-02-test-baseline.md#disabled-isolated-supervisor-source-controller--2026-10-22)
is a disabled deterministic protocol replay, not a real durable supervisor,
backend adapter or adopted runtime. All actual launches remain disabled.
Neither later grant accepts this Proposed runtime design or qualifies its
kernel, timing, custody or cleanup prerequisites.

The owner subsequently permitted bounded first-party preparation/containment
tests after required reviews, using only an already-present pinned image,
the stated resource ceilings and no pulls/builds/settings/browser/vendor
operations. Missing prerequisites stop execution; old UNKNOWNs remain.
One exact local inspection of the prior-art Node base digest returned404
at2026-10-22T22:46:19Z. No image was listed, pulled, built, allocated or
started. This conditional grant does not accept this record, supply an image,
qualify an independent supervisor/clock or waive any earlier gate.

A further genuine answer at2026-10-22T22:52:46.889Z permits downloading that
exact public image after manifest and ownership/download/storage validation,
with no builds, containers, browsers, vendor events or settings changes.
The exact Linux arm64/v8 Node24.10.0 content was subsequently staged privately:
81530463 compressed descriptor bytes, five layers and257477632 bytes verified
by streaming decompression/diff-ID checks without extraction.
Host staging preserved its2GiB free-space reserve. No daemon pull/load was
issued; Docker image-store capacity/import, an independent supervisor and
actual runtime support remain unqualified. This is content preparation,
not a built derived image, environment adoption or Bug003 resolution.

[Bug003](../bugs/003-managed-browser-descendant-closure.md) records a causal
unchanged-function VM model: the cleanup predicate reports verified while a
previously unseen detached/reparented synthetic child survives. No actual
Chromium escape is established. [Bug002](../bugs/005-active-runner-lifetime.md)
and the two earlier unattributed acquisitions remain separate unresolved
history. The existing [051-02](../specs/051-adobe-integration-proving-ground/slice-02-test-baseline.md)
checkpoint, ownership, cases, costs and reservations are unchanged.

### Grounding and limits

- [Linux PID namespaces](https://man7.org/linux/man-pages/man7/pid_namespaces.7.html)
  document birth-time membership, prohibition on entering ancestor PID
  namespaces and termination of namespace members when namespace init exits.
  This is a kernel contract, not evidence of a configured local backend.
- The [cgroup v2 documentation](https://docs.kernel.org/admin-guide/cgroup-v2.html)
  documents inherited membership, `cgroup.kill` handling concurrent forks/
  migrations, and `cgroup.events:populated` for live processes in a subtree.
  An empty `cgroup.procs` listing is not a substitute for the complete lifecycle
  contract; zombies/reaping require separate observation.
- [pidfd_open](https://man7.org/linux/man-pages/man2/pidfd_open.2.html) documents
  stable task references and explicit constraints on obtaining them after
  fork. Implementation must acquire custody without a PID-reuse window.
- Installed macOS SDK `sys/event.h:248-255,355-362` says a fork event does not
  deliver the child PID and NOTE_TRACK/NOTE_CHILD are unsupported. This rules
  out those specific tracker assumptions, not every possible native boundary.
- Initial PATH observations found Docker/Podman clients; those observations
  alone supplied no backend ownership or execution permission.
- Following separate read-only permission and explicit confirmation of the
  exact local endpoint's nonshared use, three fixed GETs at
  2026-10-22T21:13:19Z observed Docker Desktop Engine28.5.1/API1.51,
  Linux6.10.14-linuxkit/arm64 and reported cgroup v2 with memory/CPU/task-limit
  support. The private bounded metadata receipt retains endpoint identity,
  allowlisted fields and response hashes; no workloads/images were listed
  or changes/launches issued. These are daemon-reported capabilities, not
  actual namespace/cgroup ownership, independent-supervisor, timing,
  workload-sandbox or cleanup qualification.

The other lane's Proposed ADR-0038 contains a related first-party Node-only
namespace design. Its exact cited source and narrower frame are retained
privately by hash; they are prior art, not an accepted dependency or runtime
proof. This lane's provisional0040 number is peer-confirmed free;0033-0039
reservations and all accepted records remain unchanged. Coordinate before0041+.

The project owner decides any later environment or execution grant. The051-02
orchestrator would operate the exact qualification and retain its evidence;
independent reviewers judge the proposed contract and later implementation.
No other lane, guest workload or producer receipt can grant those permissions.

## Decision Options Considered

### Option A: Continue with sampled macOS identity/group closure
- **Pros:** Reuses the existing platform and lower-lease code.
- **Cons:** Does not exclude Bug003's unobserved-child counterexample.
  Rejected as complete-closure evidence; the current driver stays no-go.

### Option B: Research a supported native lifetime boundary
- **Pros:** Could preserve macOS browser and measurement conditions.
- **Cons:** No complete boundary is established by the inspected sources.
  Retained as an alternative, not an assertion that Darwin cannot support it.

### Option C: Separate local Linux qualification with kernel containment
- **Pros:** Namespace/cgroup lifetime semantics do not depend on recovering
  ancestry from intermittent snapshots after detachment.
- **Cons:** Requires independently owned allocation/cleanup, real local support,
  bounded timing and a new platform cohort. Selected for proposed design only.

## Recommended Decision

Prepare Option C as a separate, disabled first-party qualification path.
Do not port the whole Adobe runtime, enable the existing driver, change the
stock/chamber gate or introduce a generic backend/executable broker.

### 1. Closed scope and custody before allocation

The first future executable milestone is **first-party process controls only**:
fixed Node/helper code and synthetic inputs, not Chromium, Playwright, an
official SDK, provider requests, reference-site operations or vendor selectors.
No Linux result qualifies the existing macOS browser or stock arm.

Before a later authorized discovery, name one exact local backend endpoint,
its expected owner and management API. An inherited default/remote context,
credential helper or pre-existing shared daemon/VM is not a permissible
fallback. Do not list unrelated containers, profiles or host processes.
Docker/Podman choice and exact image are deliberately unresolved until the
owner approves a concrete discovery/preparation scope; no portable multi-
backend adapter is proposed.

A fixed external supervisor must own the new allocation independently of
the calling worker/session before any start request. It is not a future
file flag, the same worker's finally block or a presumed background service.
Its qualified independent lifetime, exact backend custody and failure path
are prerequisites. No accepted supervisor means no allocation.

The supervisor first writes an exclusive private ticket binding source,
image/kernel/runtime cohort, case nonce, owner, expected configuration,
resource ceilings and nonrenewable timing. Creation is separate from start:
retain the exact returned immutable allocation identity and original
configuration before any worker can request execution. Pending create/start/
stop/wait operations remain owned even if a client or worker exits.
Losing an API response or killing its CLI does not cancel a daemon operation.
Resolve only the exact preissued case identity; ambiguity is UNKNOWN, never
permission for a broad search, prune, removal or substitute allocation.

The closed evidence sequence is proposed as ticket, pending management
operation, allocation identity, containment-ready, armed, work-issued,
work-revoked, terminal observation and external completion. Each binds the
same nonce/cohort, its predecessor hash and an immutable raw observation.
Only the supervisor advances resource custody; the external observer alone
adds actual command/publication completion. Missing or conflicting events
mean UNKNOWN. No guest-reported boolean can advance containment-ready.

The external supervisor is outside the new workload namespace. If its own
custody is lost without a separately qualified successor, qualification is
invalid and remains UNKNOWN. Detection closes further permit issuance and
case admission; it does not synchronously cancel an already issued message.
Do not report closure from the guest alone.
No test may deliberately start an unowned allocation to discover this seam.

### 2. Boundary before first untrusted or forking work

Use an exclusive case PID namespace inside a positively owned disposable
local Linux environment, with private mount/network views and a dedicated
cgroup v2 subtree controlled only by the supervisor. The workload cannot
enter ancestor namespaces, join host namespaces or migrate out of that
subtree. It receives no namespace/cgroup management handles, ancestor procfs,
daemon socket, privileged mode, host user/home/repository/secret mounts or
delegated host capability.

A fixed trusted namespace init is born inside the boundary. Its child workload
is born into the case namespace/subtree, not spawned on the host and moved
afterward. Bind namespace/cgroup identities and stable task handles through
the supported creator before releasing a one-use work permit. A child
announcement, nonce, PID listing or receipt file alone is not independent
attribution. Missing kernel support, writable escape paths or uncertain
creation custody refuses before workload.

Case limits are proposed ceilings, not measured capacity: one concurrent
case, at most2 vCPU,4GiB memory,512 tasks,512MiB case tmpfs and64MiB total
exported diagnostics; read-only image, no persistent profile or swap-backed
host case directory. The backend's outer disk footprint and any image
acquisition need their own approved finite limit before provisioning.
Targets may only reduce these ceilings; insufficiency is an unqualified stop,
not an automatic increase. No image pull, build or VM start is implicit.

Networking is disabled at the allocation boundary, not merely denied by
JavaScript. Only guest-local loopback fixtures are permitted; no host port
publication, DNS, provider access or connection to the backend control socket
from the workload. Management transport is supervisor-only and separate from
the workload network. Credentials and genuine Adobe inputs never enter.

### 3. Nonrenewable time and delayed-start safety

The new first-party mechanical case uses a proposed **20-second total budget**
including allocation/start, controls, teardown, evidence and whole-command
publication. This preserves, rather than extends, the old lower-cell ceiling.
It is not a45/60-second vendor case and consumes no vendor slot. Exact phase
reserves must be pinned and demonstrated before implementation is called
ready. Cold startup or unavailable capacity is a blocker, not a fresh clock.

The supervisor issues the original monotonic start/fences before allocation
and never restarts them on worker replacement, API completion, HELLO or retry.
A namespace init initially runs only its fixed fail-closed custody handshake;
it cannot fork workload. It captures a local monotonic origin before HELLO,
validates a nonce/cohort/origin-bound ARM, installs its exit backstop before
ARMED, and accepts WORK only while its already-armed work fence is current.

Host and guest wall-clock timestamps are not interchangeable deadlines.
Remaining durations from the original supervisor fence may only map to the
init's earlier retained monotonic origin under a separately qualified clock
rate/suspend/transport bound and conservative margin. No such clock bound is
established here. Without it, there is no work permit. A delayed create/start
or late init must receive no work; an expired ARM/duplicate WORK refuses.
Source-only clock models or self-reported times do not qualify actual timing.

Permit issuance, guest acceptance and workload start are distinct events.
S may issue the one-use WORK only while its original work fence and custody
hold. Init records acceptance only after validating the case/cohort/nonce and
its already-armed fence, then rechecks that fence immediately before forking
the fixed workload. No acknowledgement renews either fence or creates another
permit. Their evidence order cannot establish that S is still alive at the
instant of guest acceptance or fork.

In particular, S can die after issuing WORK while its message is buffered.
Init might accept that previously authorized permit and start within the
original fence before detecting loss. This design does not claim zero starts
after S death or instant revocation via disconnect, polling or acknowledgements.
Outstanding permits remain one-use and bounded by the original qualified
fences; detected loss/uncertain custody denies further acceptance/start, new
permits and new cases. Any S-loss cell is unqualified even if guest output
looks successful. The armed guest watchdog is a backstop, not evidence of
management-operation settlement, complete closure or a surviving custodian.
A future requirement for synchronous post-death start prevention would need
a different supported enforcement boundary before implementation.

An operation that will not settle by the original budget stays UNKNOWN.
There is no promise of bounded kernel/daemon exit, post-deadline normal work,
automatic retry, replacement namespace or timer extension. An attributable
unresolved operation stays in the supervisor's cleanup ledger under its
separately authorized emergency disposition, not a fabricated timed PASS.

### 4. Complete closure and evidence, not a frozen PID set

Normal teardown revokes WORK, closes fixed guest endpoints, obtains supported
case-init termination and whole-subtree closure, and reaps retained children.
The supervisor may operate only on its exact namespace/subtree/allocation
identity through the supported owned API. No host group/name/global process
signals, daemon-wide prune or disappearance inference is proposed.

Require actual observations of namespace-init exit via stable custody,
recursive `populated:0` for the exact dedicated subtree, retained-child reaping
and disposal/settlement of the exclusive allocation and its pending operations.
Snapshots help diagnostics; they cannot establish the membership invariant.
An empty subgroup, CLI0, a closed endpoint, accepted stop request or marker
alone never proves complete closure. Kernel-resource/profile storage disposal
is reported separately from process termination; no automatic host deletion.

Keep originals in a bounded private host evidence directory. Import only a
closed, length-bounded, non-executable data stream over the supervisor's
already-owned control channel; no arbitrary host file export or guest-selected
path. Bind raw output, nonce, cohort, actual acquisition/termination timings,
all pending-operation dispositions and producer result to immutable hashes.
An external observer records actual foreground command exit and completed
publication. The producer cannot attest its future process exit/fsync.
Uncertainty, missing output, overflow or cleanup error cannot become success.

### 5. Required controls before any browser extension

Each cell needs a fresh reviewed ticket, its own exact one-use allowance
and a prior supported ownership/cleanup path. Stop on the first unexpected
outcome; no automatic refusal cell or retry follows a failed normal cell.

| Control | Required falsification |
|---|---|
| Normal | Known first-party child completes; complete owned boundary closes without affecting an outside sentinel. |
| Detached/orphan | A first-party child forks after a snapshot, changes session/group and reparents; kernel membership, not ancestry reconstruction, still closes it. |
| Worker loss | Loss before init/ARM and after ARM cannot issue late WORK or abandon pending management operations. |
| Init/transport loss | Init exit, disconnected control, duplicate/late permits and lost replies retain custody or explicitly UNKNOWN; no readiness-shaped default. |
| Supervisor loss | S loss invalidates qualification. Model the buffered pre-loss WORK race; an already issued permit cannot extend its original fence. Detected loss/uncertain custody denies further admission and new cases. Require independent closure/custody evidence or UNKNOWN; worker-loss controls cannot prove this. |
| Resource failure | Task/memory/output limits, stalled exit and missing kernel/control support fail closed without relaxed limits or broad cleanup. |

Actual controls must show original-command completion within the one
nonrenewable budget for a qualified result. A supported emergency cleanup
after an unqualified failure does not retroactively qualify that cell.
Deliberate actual S-loss injection is withheld until a separately proven
outside owner retains the exact pending operations and cleanup before the
injection. This is an execution prerequisite, not a presumed third actor.
Until then the S-loss control is source/model-only and cannot satisfy the
actual failure-coverage gate.

Chromium is a later separately approved design/implementation/qualification
extension: pin actual Linux browser/Playwright/image bytes, maintain the
browser sandbox/process model, and prove pending launch, endpoint/CDP,
temporary-profile storage and controller-loss behavior. Do not use
`--no-sandbox`, a single-process stand-in or a toy child as Chromium proof.
Mac hardware/native receipts and performance bands cannot be promoted to a
new Linux cohort. The spent controls and vendor case cap cannot be replayed;
any necessary additional vendor evidence requires an explicit separate grant.

### 6. Invariants and adoption boundary

No edit to the accepted setup-refresh contract, original authority, old
checkpoint/history, counters, owned lock, SDK reservations or driver latch
follows from this Proposed design. Bug003 remains ROOT_CAUSED, not fixed by
a document or new namespace. The two old unidentified acquisitions remain
UNKNOWN; a future contained run does not clear or exclude them.

Implementation and actual first-party discovery/preparation/execution each
require the applicable review and explicit scoped go-ahead before any of
those actions. Live SDK, EDS/source push, a new observation window and
measurement-platform adoption are not approved here. Do not accept/supersede
an old record or transition051-02 from this design-only approval.

## Consequences

**Becomes easier:**
- Testing a real membership boundary against Bug003's specific counterexample.
- Separating supported cleanup facts from sampled-set observations.

**Becomes harder:**
- An independent supervisor, kernel/runtime/image custody, phase reserves and
  clock bounds must be qualified before any new workload.
- A different platform cannot reuse Mac native/measurement evidence or solve
  historical whole-helper uncertainty.

## Assumptions

- The confirmed local backend can expose and enforce the required
  namespace/cgroup/custody contract without new privileged host control.
  Read-only version/info identifies the candidate, but does not establish
  this enforcement or a management API for every required observation.
- An independent supervisor and qualified host/guest timing contract can fit
  the proposed20-second budget. Clock bounds, startup, actual operation
  settlement and emergency cleanup behavior are unqualified.
- The required Linux image/tool cohort can preserve browser sandbox behavior
  in a later extension; no image, browser or actual negative control was run.

## Kill criteria

- Shared/remote/unattributed backend, target born outside containment,
  escape-capable workload, lost supervisor/operation custody or an unqualified
  clock requires UNKNOWN/no admission, not weaker evidence.
- Unmet ceilings or cleanup/whole-command completion budget, unavailable
  existing image/backend, or a need for broader host privileges blocks.
- Any attempt to clear old UNKNOWNs, reinterpret Mac evidence as Linux,
  replay spent controls, reset costs/ownership or bypass live readiness.

## Open questions

The exact owned backend/API/image, independently durable supervisor and
timing/reserve proof are deliberately unresolved admission prerequisites.
Independent design review may approve the conditional framing, not those
facts or execution. If no available bounded implementation can satisfy them,
keep the current path disabled rather than adopting a permissive substitute.

## Bounded outside-owner design increment — 2026-10-26

Use one temporary native macOS job to own the existing fixed roles outside
the coding session. This could remove the immediate lifetime dependency
without building another container runner. The existing H becomes the managed
job, with a narrow native binding and registration cleanup. There is no extra
wrapper-owner process and no browser or Linux qualification.

At17:06:57.864Z the owner approved the exact request to **design and review**
this bounded integration without launching containers, browsers or Adobe
operations. This is not implementation, launchd contact/registration, a new
first-party control, environment adoption or acceptance of this ADR.
The [focused journey source](../specs/051-adobe-integration-proving-ground/slice-09-focused-chamber-journey.md)
is committed separately and remains live-unexecuted.

### Installed-interface grounding

Installed manual pages/headers and the existing fixed-role source were read;
no `launchctl` command, service registration, qualification-role acquisition
or endpoint query was issued.

- Installed `launchctl(1)`, domain specifiers and `bootstrap | bootout`,
  distinguishes a per-user GUI service domain from a calling process domain,
  and documents exact service-target registration/removal. This supplies
  native manager semantics, not evidence of a currently available domain.
- Installed `launchd.plist(5)` documents `Program`, `ProgramArguments`,
  `RunAtLoad`, `KeepAlive`, `MachServices`, `TimeOut`, `ExitTimeOut` and
  `AbandonProcessGroup`. `TimeOut` is unimplemented; `ExitTimeOut` is only
  termination grace, **not a runtime limit**. Group cleanup covers only the
  same group, not a detached supervisor or a complete process tree.
- Installed SDK `launch(3)` documents `bootstrap_check_in`: the requested
  receive right must belong to the caller's job's `MachServices`. A name not
  in that job fails `BOOTSTRAP_UNKNOWN_SERVICE`. This is the candidate native
  managed-job check, not a JSON/PID/parent/`detached` assertion.
- SDK `launch.h:7-13,177-204` limits the supported socket activation interface
  to the caller's configured sockets and documents `ESRCH` for a caller not
  managed by launchd. That alternative requires a host socket listener, so
  it is not selected. Legacy `launch_msg` helpers are deprecated and are
  not the selected provenance or job-status API.
- Installed `launchctl(1)` explicitly says `print` is not an API. Its text,
  `list`, `managerpid`, and apparent PID1 parentage cannot admit a job.
- Installed `kqueue(2)`, `EVFILT_PROC`, documents `NOTE_EXIT` observation.
  `NOTE_EXITSTATUS` is valid only for children: an observer of a
  launchd-owned nonchild cannot claim its exit code from that flag.
  No descendant tracking or post-exit PID lookup is proposed.
- SDK `mach/message.h:525-533,754-757` declares the audit trailer and
  `MACH_RCV_TRAILER_AUDIT`; `bsm/libbsm.h:1537-1577` documents extracting
  sender PID and its version from the native audit token. These are the
  candidate peer-incarnation primitives, not application-supplied identity.

These are source/documentation facts only. Native API support in a compiled
entry, job attribution, IPC binding and actual independent lifetime remain
unqualified. No header symbol is treated as an executed capability.

### Prefer the existing execution host before adding a native service

The current execution host offers a native detached command facility whose
stated purpose is to outlive the calling process, with an opaque command handle
and later native output/completion observations. That offered contract is not
an actual accepted outside-holder integration. In particular, it does not alone
establish retention across session loss, pre-effect custody or cold completion
readback. No detached command was issued during this design.

**Preferred least-change route:** establish whether that existing facility can
own one fixed outer observer and the existing H/S roles with their original
fence. Bind its actual host-issued handle/native observations to the exact
reviewed command, source, capsule and native H/S channels. A caller-chosen
handle, `detach:true` job field, PID, helper log or matching file is insufficient.
Missing completion/retention evidence stays UNKNOWN; no new owner is fabricated
from the opaque handle. Source code alone cannot qualify the host facility.

A separately admitted **host-only** first-party control must establish those
specific semantics before backend allocation. Its original normal case and any
later calling-process-loss case need fresh one-use grants; the consumed native
fixture is not reusable. Actual parent/session-loss injection is not approved
by this design. Retain status, streams and pending ownership separately.

Do not implement the native service below unless a precise retained-evidence
or lifetime gap rules out this existing facility and the fallback is separately
chosen. This is a selection gate, not a second platform being built in parallel.

### Native-service fallback, not a service framework

The fallback candidate is a **conditional** one-case per-user `launchd` job. Do not install into
`~/Library/LaunchAgents`, register at login, use root/system-domain services,
add a daemon, change Desktop settings or create a portable backend adapter.
Use an explicitly approved existing `gui/<uid>` domain; if unavailable, stop.
No automatic fallback to `user`, `pid`, root or a remote execution host.

The proposed job has one nonce-bound label, the pinned Node24 executable and
one fixed H entry with a minimal pinned first-party native binding. The binding
exposes only the native check-in, bounded fixed-message custody handshake and
exact-process exit observation; it is not a command, path or callback broker.
The absolute `Program`/argument vector and private canonical input/output
paths are fixed. `RunAtLoad:true`, `KeepAlive:false`, `EnablePressuredExit:false` and
`AbandonProcessGroup:false` are explicit. There are no sockets, watches,
calendar/interval triggers, arbitrary environment overlays, shell commands,
downloaders, caller-selected programs or executable callbacks.
One exact Mach service is used only for native job attribution and a bounded
first-party custody handshake, never guest/SDK traffic. This new native
control endpoint is a proposed **outside-owner** interface; it does not
quietly relax the existing no-WORK component's no-host-listener contract.
Its implementation and later use require their own accepted scoped contract.

H checks in to that exact Mach service before acquiring S. An external
observer O verifies a kernel-supplied audit trailer, including expected UID
and the H PID/version, for a fresh case-bound message. O registers `NOTE_EXIT`
for that PID, then creates a fresh unpredictable challenge. H must reply to
that challenge with the same kernel-supplied audit identity before O sends
the sole readiness acknowledgement. This post-registration exchange must
show that the original incarnation was still alive after watcher registration;
a buffered pre-registration reply, a claimed PID or a restarted H cannot do so.
H reciprocally binds O's audit identity and retained native rights.
Any registration, peer, challenge or right-lifetime uncertainty refuses before
S acquisition. Executed race/loss tests remain required; the cited primitives
do not by themselves prove this proposed composition.
No `outside_owner:true` Ref or caller flag can open the existing denied entry.

The managed H retains the current fixed H/S relationships and pending-operation
rules. The native binding is not another Docker client. The current
`runNoWorkSupervisor()` refusal remains unchanged. Any later integration must
pin and review the minimal native binding plus its fixed entry into the existing
roles, rather than AST-project or transplant private test functions into a
production launcher. No existing role or deadline is enabled by this proposal.

### Original time, one-use effects and retained uncertainty

O captures the one original same-host monotonic origin before job preparation
or bootstrap; the existing20-second total is not restarted when H/S begins.
O/H/S use the same pinned Node monotonic basis already required by the host
roles; a native binding must not substitute a different native clock origin.
The fixed bootstrap conveys the same origin/end so H installs original-fence
loss/watchdog handling before private input validation or S acquisition.
Each downstream role binds the same values; no receipt or handshake renews it.
No `launchd` timer, CPU limit, wall timestamp, JavaScript timeout or GUI-session
assumption is a hard wall-clock termination guarantee.

The journal/capsule is consumed before any child/backend effect. `KeepAlive:false`
does not promise one invocation: the Mach service can cause demand activation
after a process exits. Every later invocation must refuse the consumed case
before acquiring a role or touching the backend. No retry, second case,
reconstructed ACK or adoption of a matching diagnostic prefix follows.
If preventing or accounting for a second invocation cannot be established,
the control is unqualified; do not call this a one-shot platform guarantee.

Record bootstrap as a pending management operation **before** sending it.
Lost/late CLI acknowledgement leaves ownership UNKNOWN; do not repeat it or
enumerate jobs to find a substitute. Admission requires native readiness for
the exact case, not just bootstrap exit0. Neither the Mach handshake nor source
passes prove loss survival, guest containment or current host quiet.

Before any future registration, approve exact-label `bootout` and disposal of
its private endpoint as part of the same one-case cleanup scope. Remove only
that service target, never a domain, directory or matching-name set. Do not
remove the owner while H/S, native streams or issued backend work are pending.
An uncertain removal remains owned and prevents new registration; no retry
or postdeadline cleanup is implicit.

H observes its native child S and actual exit/stream facts; O observes H's
exact-process exit separately. H cannot attest its own future exit.
O cannot label a nonchild exit as native exit0 without a separately supported
status observation. That unresolved distinction must be closed or explicitly
remain UNKNOWN before a qualifying control is admitted.
Domain removal, logout, host sleep/shutdown or H loss invalidates the run;
no continuity across them is claimed. A detached S is not killed by an
assumed launchd process-group sweep. Pending resource custody must remain
explicit, never converted into a stopped/removed claim.

### Smallest next gate and stop conditions

| Gate | Permitted proposed scope | Not established |
|---|---|---|
| Design now | Public native contracts, one fixed interface, independent frame/architecture review. | Compilation, service registration, runtime admission. |
| Separately approved source increment | Only fixed native entry/handshake and controlled tests; existing runtime denial stays. | Actual launchd ownership or survival. |
| Separately approved first host control | Fresh one-use first-party Node-only job, exact cleanup grant and external observations; no Docker/guest/SDK. | Browser, Linux clocks/kernel/cleanup, H/S-loss safety. |
| Later admission | Only after actual owner lifetime/cleanup and the existing containment/clock requirements are qualified. | No automatic no-WORK, browser, vendor or case permission. |

Stop before source implementation if the bounded native attribution/observation
contract cannot be specified from supported APIs, if it needs a broader service
framework, or if exact registration cleanup cannot be owned. Do not create
another chain of source-only custody components while calling it product proof.
Do not rerun consumed native/import/peer cases or touch the peer's retained
inert container. Existing UNKNOWNs, Bug003, costs and SDK slots are unchanged.

### Additional assumptions requiring independent review

- Native Mach peer attribution and exact-process observation can be bound
  without a PID-reuse gap or an unsupported `launchctl` text parser. A managed
  check-in proves a resource belongs to a job, not by itself the complete
  caller/source/grant identity. This contract is not yet executed or complete.
- A minimal fixed native bootstrap can retain the original20-second origin,
  one-use effects and exact-label cleanup while preserving the current H/S
  boundary. No positive timing or survival result is asserted.
- New registration/endpoint cleanup and any bounded host-only fixture can
  receive an exact later grant. Current design permission supplies neither.

### Design-review checkpoint

Independent scoped frame reviews accepted the native fallback and the later
host-facility-first selection gate. Independent architecture accepted the
current design-only increment. These passes do not establish an outside-owner
capability, source implementation readiness, native completion status or a
new host control grant. The ADR remains Proposed, all runtime entries remain
disabled, and the next candidate is the existing facility rather than new
native-service code.

Even a later accepted outside owner would close only that dependency.
Guest clock/suspend bounds, kernel containment and cleanup, a browser cohort
and its source/deployment/case/setup gates remain separate. Do not describe a
successful first-party host control as permission to proceed directly to Adobe.
