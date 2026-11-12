# 051-09 native source interface

The owner granted execution and configuration changes within the owned POC
on 2026-11-05 at 16:15:55.001 UTC. Product decisions and work outside that
scope still need the owner's decision. The owner refused
[ADR-0051](../../decisions/adr-0051-fresh-native-only-admission.md) as the
wrong artifact for execution permission. Its proposed acceptance, human
challenge and approval receipts are not required.

The native controller is a bounded blank-browser ownership and stop check,
not the Adobe journey. It does not run an SDK, visit the site or establish
product evidence. The coordinator owns the foreground producer process,
retains its real server handle, and must have a separately invocable STOP
command ready. It must not claim a human terminal or observed closure when
those did not occur. A lost producer, unconsumed stop, late acquisition or
unobserved closure is UNKNOWN.

The earlier source compliance, craft and architecture reviews passed on
`4284d9e9e43f4e813ed33b8c3b58431983548bdf`; documentary reconciliation
passed on `d5dff2a28907338c2746b9515777466b192db63e`. They do not review
the later authority correction. The [historical contract](slice-09-fresh-native-readiness-contract.md)
and [source witness](slice-09-native-source-current-witness.md) retain
their checkpoint evidence. Full 051-09 remains IN_PROGRESS. Historical
public run/retry refusals, R1, C FAIL and UNKNOWNs remain unchanged under
[ADR-0050](../../decisions/adr-0050-evidence-independent-05109-source-checkpoint.md).
ADR-0045's earlier owner-presence and execution-permission assumptions do
not override the later POC grant; its product and technical controls remain.

## Preparation and commands

Prepare a fresh finite allocation, not an earlier closed or source-only plan.
Use one owner-only `secrets/fresh-native-<32 lowercase hex digits>/`
directory with `owned-stop/` and `stop-during-acquisition/` subdirectories.
The fixed files are `allocation.json`, `browser-manifest.json`, and each
case's `job.json`. Directories must have mode `0700`. Inputs must be owned
by the current user, regular, non-symlinked, singly linked, and mode `0400`
or `0600`. The program does not clear a stale lock or retry a consumed case.

The closed records contain:

| Record | Fields |
|---|---|
| `allocation.json` | `kind`, `schema_version`, `plan`, `plan_sha256`, `owner_uid`, `created_at` |
| `plan` | `kind`, `schema_version`, `owner_uid`, `source_commit`, `starts_at`, `hard_stop_at`, `cases`, `browser_manifest_sha256`, `platform_baseline`, `cleanup_until`, `stop_safety_scope` |
| case `job.json` | `kind`, `schema_version`, `case`, `case_nonce`, `owner_uid`, `plan_sha256`, `source_commit`, `source_pins`, `browser_manifest_sha256`, `platform_baseline`, `issued_at`, `expires_at`, `hard_stop_at`, `allocation_root`, `cleanup_until`, `case_seconds`, `observation_seconds` |

Kinds are `airlock.05109.native-allocation`,
`airlock.05109.native-physical-plan` and `airlock.05109.native-control`;
schema versions are `1`. The ordered plan cases are `owned-stop` then
`stop-during-acquisition`. The safety scope is exactly
`same-consumed-case-to-hard-stop`. Case and observation durations are
45 and 10 seconds. Timestamps are canonical UTC ISO strings with
milliseconds; the allocation creation time must be no earlier than the POC
grant. Digests of JSON objects use compact JSON with keys recursively
sorted and arrays in order. Source pins hash raw bytes and cover the
controller's committed source files and complete local Playwright dependency
inventory. The browser manifest separately pins the fixed home-derived
Playwright headless-shell bundle and platform. Preparing those pins does not
itself establish actual native ownership or provenance.

Supply the exact job bounds as command arguments:

```sh
node probes/adobe-compatibility/fresh-native-control.mjs start --job "$AIRLOCK_NATIVE_JOB" --expires-at "$AIRLOCK_NATIVE_EXPIRES_AT" --hard-stop-at "$AIRLOCK_NATIVE_HARD_STOP_AT" --cleanup-until "$AIRLOCK_NATIVE_CLEANUP_UNTIL"
node probes/adobe-compatibility/fresh-native-control.mjs stop --job "$AIRLOCK_NATIVE_JOB" --hard-stop-at "$AIRLOCK_NATIVE_HARD_STOP_AT" --cleanup-until "$AIRLOCK_NATIVE_CLEANUP_UNTIL"
```

START checks that the full 55-second qualification fits before expiry,
validates committed source and bundle coverage, and reserves the case before
launch. The exclusive intent binds the job, owner, plan and reservation time;
it is not refundable. Case two requires case one's same-plan ordered
launch, owned handle, ready, stop and closure observations and a
`closed-observed` terminal. STOP can be requested for the consumed case
after START expiry but before its hard stop. It only records the request;
the live producer must observe it and close its retained handle. Safety-only
records do not upgrade an UNKNOWN qualification.

The pinned browser server is asked to bind IPv4 loopback; the endpoint
validation remains restricted to `127.0.0.1`. If its returned handle fails
validation, no connection or unverified close is attempted. While the
bound case lock and deadline allow, a private `launch-failure.json` records
the safe failure category and the returned process PID if available; it
does not record the rejected endpoint. The coordinator must observe the
terminal even if the producer remains alive, and perform bounded diagnostic
cleanup only on its verified owned process tree. Such cleanup is not proof
of qualifying closure and does not change an UNKNOWN result.

For the pending-launch case, an independent process may prepare a one-shot
STOP before the producer starts. Preparation validates source bytes and the
fixed job and manifest, but does not reserve or stop the case. At the real
launch marker, the same process rechecks the intent, job, manifest, owner,
lock, commit and original deadlines before writing STOP. It checks the
validated source inventory's file and directory identities and change times
instead of rehashing all dependencies in the critical path. A changed
snapshot or an already-used token is refused; preparation does not establish
that STOP was actually observed while launch was pending.

The producer captures the launch promise's fulfillment or rejection callback
time in memory as soon as the callback runs. The private
`launch-settlement.json` records that time and the later publication time
without an endpoint or error text. The pending STOP observation similarly
records the STOP read time and elapsed monotonic time separately from its
publication time. It is published only after the normal binding checks pass.
These records do not backdate the later handle-acquired observation or turn
an earlier UNKNOWN into proof of a pending stop.

The controller retains wall and monotonic bounds for the invocation,
qualification, ordinary close and safety close, including publication and
lock cleanup. Verified descriptors have their own bounded cleanup rules.
OS operations can still settle late. A stop request or successful synthetic
test is not proof of actual browser closure. The separate Adobe stock and
chamber journey still needs its own real configuration, scope, accounting,
consent, dispatch and product observations.
