---
status: DONE
dependencies: [060-17, adr-0055]
last_verified: 2026-11-09
kind: feature
frame_review: true
arch_review: true
---

## Slice 060-18 - Govern persisted first-PageView referrer state

**Goal:** An operator can exercise source-backed persisted referrer behavior
through the local serialized worker and consent seal, with exact storage
authority and honest native-evidence limits.

The owner selected the exact capability design and approved this session's
authoring/implementation plan on 2026-11-06. The canonical coordinator
subsequently relayed explicit final owner acceptance of
[ADR-0055](../../decisions/adr-0055-meta-local-referrer-storage.md) exactly
as written at `fecc0c93`. No SDK/browser/native/live/site/account/
deployment operation is commissioned. The future optional `ler`/`plt`
comparison requires its own exact source/operational reviews and explicit
owner execution approval.

**DoR:**
- [x] Clean local/canonical base is `d3f624418897cbc698214705c0c05d0fee0fed9d`.
- [x] Canonical integrator assigned 060-18/ADR-0055 after current cross-lane
      noncompetition checks; no overlapping referrer implementation is owned.
- [x] Retained original runtime/configuration/request roles and pins were
      verified through static reads without executing vendor code.
- [x] Owner selected the exact preliminary local capability design and app plan.
- [x] Fresh explicitly pinned Sol ADR and slice framing reviews pass.
- [x] Owner explicitly accepts the final numbered ADR-0055 recommendation.
- [x] Authoring/readiness pass without foreign ownership. The implementer
      enters at READY_FOR_IMPLEMENTATION and takes its own normal working claim.
- [x] Existing selected import paths are audited browser-free; new test files
      must be source-audited before each execution, as required by criterion 11.

**Acceptance Criteria:**

1. Add `experimentalPageViewReferrer`, default false, only to the standalone
   local adapter, connector and actual serialized worker. Enabled use requires
   a host-owned exact `referrerStorageBinding` for one canonical
   `http://127.0.0.1:<port>` origin, port 1-65535. Binding with the flag off
   rejects configuration. Both live/owned factories reject the feature/binding;
   arbitrary routing, multi-Pixel and non-PageView combinations reject. Preserve
   default context/query shapes, stable core/contracts, other vendors and
   existing timing/cookie grants.
2. Fulfill only exact `lastExternalReferrer` and `lastExternalReferrerTime`
   `get`/`set` and worker-detected-expiry-only `remove`. Backing window and
   captured page origins must match the trusted binding. No worker-selected
   origin/backing, alias/port expansion, prefix, enumeration, `clear`, probe key,
   denial-time deletion, migration, automatic repair or rollback. Every value
   is null or a well-formed ASCII string of at most 16 bytes. Limit one
   installation to eight primitive operations, with one outstanding storage
   request and no concurrent cookie fulfillment or egress during sampling.
3. Host captures bounded raw page URL/referrer and, only for an explicitly
   granted enabled installation, actual UA of at most 1024 characters and an
   actual XMLHttpRequest-defined boolean. Snapshot own scalar fields before
   serialization; reject malformed/accessor/inherited/object/extra data at
   private boundaries. Never transfer a Storage object, callable or DOM node.
   No new capture, storage access or probe when disabled, pending, denied,
   missing grant or revoked. UA is neither persisted nor emitted.
4. Worker alone interprets platform/referrer/storage semantics. Apply the
   pinned no-argument Android/iOS predicates from ADR-0055 before requesting
   storage. Native platform markers and realm remain actual inputs, not
   spoofed constants. Ineligible platform and genuinely absent/unsupported
   storage omit `ler` with distinct fixed dispositions.
5. Sample once after validating the first successful local `init`, before
   committing its sample/initialization. Both keys absent is valid fresh state.
   A complete pair requires canonical nonnegative safe-integer epoch milliseconds
   no later than worker sample time. Partial/malformed/future/oversized state
   rejects visibly. Unknown bounded category with valid timestamp maps to
   `other` in the worker. No native-seeded state or copied case category is
   needed for construction.
6. Worker calculates expiry as age greater than 90 days, without rounding.
   Exactly 90 days is valid. Expired state removes both keys before processing
   the current referrer. Absent referrer writes `empty` plus current worker
   time; external Facebook/Instagram exact hosts or dot-delimited subdomains
   write `fb`/`ig`, other external hosts write `other`, each with fresh time.
   Same-host navigation changes neither stored category nor timestamp and may
   legitimately have no `ler`. PageView uses the cached installation result,
   never rereads or refreshes it. Malformed URLs retain the existing explicit
   context-rejection behavior rather than silently becoming absent referrers.
7. The host intersects declared storage, exact binding, current explicit
   `ad_storage` and admitted tag permission. Recheck lifecycle, active command,
   exact envelope, origin, consent and revocation generation immediately before
   each primitive access and after async waits before response delivery/egress.
   Correlate monotonic operation IDs and command/generation; unsolicited,
   duplicate, late, wrong-order, extra/accessor/inherited messages and pending
   operations at command completion fail explicitly.
8. Host/tag revoke invalidates queued/prepared work and ordered worker
   referrer/raw cache. Persisted keys remain untouched while denied. Regrant
   neither replays events nor revives a saved sample; later PageView on that
   instance omits `ler`. A fresh explicitly initialized instance may sample
   under a current grant. Already issued effects remain reported; no atomic
   recall, native retention or cross-tab coherence is claimed.
9. Missing storage and platform ineligibility are legitimate non-success
   dispositions, not fabricated persistence. Storage-access exceptions,
   write-readback mismatch, invalid inputs/protocol and timeout fail visibly.
   Report partial issued storage effects and stop sampling without retry,
   rollback or a success-shaped ephemeral/`empty` fallback. Public outcomes
   contain fixed dispositions/counts only, no raw UA/referrer/category/time,
   cookies, Pixel values, private dynamic names or derived private fingerprints.
10. Prove the path through synthetic pure controls, the actual serialized
    first-party Node worker and an independently observed loopback receiver.
    Cover absent/external/same-host referrers; exact/subdomain/deceptive hosts;
    fresh/preserved/exactly-expired/over-expired/partial/malformed/future state;
    platform/XHR combinations; unavailable/throwing storage; initialization
    versus event sampling; denied/revoke-during-read/write/regrant; wrong
    names/scope/size; malformed/duplicate/late protocol; partial effects,
    readback and timeouts. Witness red-to-green and meaningful mutation
    controls. Combined existing `plt` controls establish only own-input
    worker arithmetic/cache behavior.
11. Read the executed import closure of every selector before running it.
    New tests and the named existing regressions must be browser-free.
    Verify both fixed fixture page/worker closures with all flags off; the
    missing-asset control must still fail. Do not widen unrelated serving
    allowlists, remove refusal guards or run broad Meta/default discovery,
    browser smoke or `test/meta-behavioral-replay.test.js`.
12. Preserve closed 060-16/17 records, the static disposition matrix, immutable
    case originals and frozen old reader. Record raw-document versus SDK-manager
    and replacement-init versus native-installation limits, strict invalid-state/
    regrant local deviations, two-key partial/concurrent-write limitations and
    missing native lifetime/consent/cohort/timing/response/receipt evidence.
    Source changes invalidate old closure readback; do not weaken its reader.
    Full 060-01/C1-C9, its foreign claim, 063-01 ownership, 059-18's NO-GO,
    historical A's UNKNOWN cleanup/traffic and B's withheld-history boundaries,
    oracle defaults/thresholds and unapproved rubric/plan gates remain unchanged.
13. Finish fresh explicitly pinned Sol compliance, craft, architecture and
    reconciliation, normal committed Jig DONE/derived-board/index checks and
    verified clean canonical `meta-pixel-chamber` handoff. Runtime TDD is by
    an isolated explicitly pinned Terra implementer; it does not review itself.
    No main/PR operation, unsafe audit ancestry or automatic next journey is
    commissioned. An indispensable owner approval remains a visible stop gate,
    not an agent-fabricated acceptance.

**DoD:**
- [x] All owning criteria have browser-free positive/negative evidence.
- [x] Default/live/owned and governed storage/protocol regressions pass.
- [x] Meaningful red-to-green/mutation controls and actual Node worker/receiver.
- [x] Fresh pinned Sol compliance, craft, architecture and reconciliation pass.
- [x] Faithful operator/evidence documentation, normal lifecycle and clean handoff.

## Grounding

The exact retained source roles/pins and semantic offset citations are in
ADR-0055. Its source contract does not imply browser execution or native
qualification. Existing raw capture and fixed private-cookie operations are
in `adapters/meta-pixel-prototype.js:610-662,723-768,798-813`; actual worker
cookie correlation is `connectors/meta-pixel/pageview-prototype.worker.js:33-43,110-124`.
`contracts/capability.d.ts:123-128` preserves the mediated storage signature,
without granting a browser localStorage backing.

The timing experiment and documented failed broad-selector incident remain
in closed 060-17. Initial inspected browser-free selectors are
`test/meta-pageview-performance-experimental.test.js`,
`test/meta-pageview-fixture-closure.test.js`,
`test/meta-pageview-disposition.test.js`, and only
`test/local-browser-journeys.test.js`'s
`serves two fixed pages and the entire actual adapter/module-worker import closure`.
Re-audit exact imports in the implementation state before execution.

## Assumptions

The existing private command/capability seam can support the narrow operation
without changing a frozen interface. Cookie messages demonstrate a candidate
seam, not this storage implementation.

The first successful local replacement init supplies a useful installation
point. Native configuration-plugin timing and any enabled SDK referrer-manager
mode remain unqualified; this packet does not resolve them with fixtures.

### Deviation log

The first app child received an already-claimed IN_PROGRESS
slice, but its configured admission rule required READY_FOR_IMPLEMENTATION.
Its bounded session status reported that conflict, no implementation/tests,
and zero source changes/commits. The failed child was archived after current
no-work and automation checks. The handoff is corrected through the normal
READY_FOR_IMPLEMENTATION release point so the implementer can take its own
working claim. No agent configuration, host/model, acceptance criterion or
authority boundary changed at that checkpoint; the proposed native Task
fallback had not yet been implemented.

The owner-selected strict invalid-state/regrant safety rules are part of this
new slice, not amendments to closed native criteria.

The owner also explicitly selected one native Terra Jig Task on the existing
isolated coordinator worktree after the initial no-work app failure. That
selection preceded the later withdrawal/recovery messages and was not
cancelled by them. The corrected app child had already produced `d250cf70`
and the origin-boundary remediation `66d98c6e` when the selection reached
this coordinator. Both commits and their TDD evidence were preserved and
integrated; the child was frozen, checked clean/fully merged with no
automation, then archived. Remaining implementation completion uses the
selected native Task route without overlapping writers or discarding work.
The exact four-file runtime/test scope, Terra model and Sol reviews stay
unchanged. Normal READY_FOR_IMPLEMENTATION handoff lets that Task take its
own working claim.

#### Delivered source and review corrections

The final runtime/test source is committed at `38b79748`. The adapter binds
one exact loopback origin and two storage names; only its bounded private
protocol fulfills primitives. The worker samples once during validated
initialization and owns platform/category/time/expiry/cache behavior.
No new runtime module or fixture-serving allowance was added.

Fresh Sol compliance identified and Terra corrected current-origin rechecks
at primitive/response/egress boundaries (`66d98c6e`), late-unavailable and
worker binding admission plus non-vacuous mode controls (`9272a7b1`),
host-known initialization disposition/admission/effect accounting (`f38fac80`),
and closing further storage authority after any non-ok response (`38b79748`).
These enforce the original criteria; none changes owner authority or native
acceptance. Prior non-passing review records remain in Git history, and
fresh final compliance, craft and architecture all pass.

`referrerStorage.effects` counts issued mutation attempts, including an
attempt that throws or times out. It is not confirmed persistence, rollback
or atomicity. A partial pair can remain after a failed second operation;
the failure is explicit and sampling does not retry or repair it.

Native configuration-plugin installation versus replacement initialization,
raw document referrer versus an enabled SDK referrer manager, and actual
native/browser lifetime/consent/cohorts remain unqualified. Strict malformed/
partial/future-state rejection and no-cache-revival on regrant are selected
local safety choices. Cross-tab changes have no locking/coherence guarantee.
Existing `plt` arithmetic/cache controls do not establish native timing
causality. `iw`, vendor response/receipt and full 060-01/C1-C9 stay open.

#### Witnessed offline evidence

All commands were source-audited before execution. The final set is exactly
the owning referrer, existing performance, fixture-closure and disposition
Vitest files, plus the single Node HTTP import-closure selector. No broad
Meta/default discovery, SDK/browser smoke, oracle or native job ran here.
The fixture closure keeps its browser-forbidden Playwright mock; the
disposition child is only the missing-input Node verifier negative.

| Witness | Observation and limit |
|---|---|
| Initial app Terra TDD | 18 failures/5 passes, then 24 failures/8 passes before the original 77-test owning green; four restored mutations were detected by 1/1/1/2 tests. |
| App Terra origin correction | Seven failures/77 passes, then body-read one failure/87 passes; 89 owning tests green. The frozen app work was integrated, not discarded. |
| Native Terra protocol correction | Eleven new controls: eight failures/three passes before focused 12 green; guard removals detected by adapter/worker/host 3/2/2 tests. |
| Native Terra ledger correction | Twenty-six new controls exposed ten focused failures before all 26 green. |
| Resumed native Terra failure latch | Latch removed: three failures/two passes; restored: five passes. Three storage controls detect extra primitives/effects; cookie/egress controls already reject under independent initialization guards. |
| Parent final integrated run, 2026-11-09 | 159 tests pass across exactly four files; selected HTTP closure passes with 11 sibling cases deselected, not qualified. Scoped four-file ESLint and diff checks pass. |

These are synthetic pure and actual serialized first-party Node-worker/
independent-loopback-receiver controls. They do not execute or qualify the
native SDK, a browser or actual browser persistence. Missing local runners
were first witnessed by exit 127, then restored from the unchanged lockfile
with cache-only `npm ci --offline --ignore-scripts --no-audit --no-fund`.
No network fallback, package/SDK upgrade, browser installation or lifecycle
script ran. The unrelated Lighthouse engine warning was not permission to
upgrade Node or run a browser.

### Reconciliation sweep

| Surface | Disposition | Result |
|---|---|---|
| Three standalone runtime files and `test/meta-pageview-referrer-experimental.test.js` | updated | Implement exact grant/private protocol and worker-owned semantics, with causal controls. No extra runtime asset or serving roster. |
| Owning slice, plan/tasks, operator and connector guides, work plan, changelog | updated | Describe actual source, issued-effect accounting, evidence and remaining native limits. |
| New ADR-0055, its frame evidence and slice frame/compliance/craft/architecture evidence | updated | Preserve explicit owner acceptance and independent pinned Sol verdicts. Superseded needs-changes verdicts remain in Git history, not hidden passing claims. |
| Architecture and decision index | updated | Accepted ADR-0055 is the exact new authority; runtime citations show host enforcement versus worker semantics. Derived index checked; Accepted ADR body is unchanged during close-out. |
| Spec board | updated | Regenerated through the current helper. Other spec/foreign claim metadata is preserved. |
| Core/contracts, production boots, other vendors, package manifests, build/oracle policy and thresholds | no-op | The exact changed-file set contains no such source. Defaults remain SDK-free opt-ins without new identifiers. |
| Closed 060-16/17, disposition matrix, private originals and frozen reader | no-op | No tracked closed record or old reader was edited. Source changes do not renew old closure admission. |
| 060-01, 063-01 and 059-18 | no-op | Foreign claims and original criteria/NO-GO preserved; no full journey or native qualification. |
| Historical A/B and old audit lineage | no-op | UNKNOWN cleanup/traffic remains UNKNOWN. Withheld private-fingerprint ancestry is excluded; safe clean d3f is the delivery base. |
| Vision, conventions, inbox and primers | no-op | No new contributor rule/out-of-spec product decision or matching inbox item. Full spec 060 remains open, so no compress-on-close primer rewrite. |
| Memory | no-op | Reviewed domain/source/lifecycle findings belong in this slice/ADR, not new global memory. Memory summary/team-check uses the existing people opt-out. |
| Leanness | no-op | No generic store/broker, second mapper, new runtime asset, runner, scheduler or unrelated serving expansion. |
| Native comparison | deferred | The exact separate proposal below requires fresh source/operational review and explicit owner execution approval. |

Memory summary/team-check completed on 2026-11-09 with the existing opt-out;
no private/task-specific facts were added to global memory. Advisory use-case
coverage reports zero gaps/dangling links and nine pre-existing orphan specs
outside this packet. The current generator's board check passes.

The canonical integrator fast-forwarded the exact reviewed/reconciled
`bd75991d2f3c32d697cd439f5425a7c31c696ecf` from safe `d3f62441` on
2026-11-09 and confirmed its index/worktree clean and board current. Parent
independently observed the canonical ref equal that exact SHA. Runtime/tests
remain byte-identical to reviewed `38b79748`; known withheld audit ancestors
are excluded. The owning task's normal DONE and final metadata handoff do not
authorize a successor, browser/SDK comparison or broader qualification.

#### Optional later `ler`/`plt` comparison proposal, not execution authority

A later commissioned packet must bind the current source closure/digests,
retained original source roles/pins, one finite native/candidate/control
budget and exact private consent/platform/document/storage inputs. Record raw
navigation timing and the relevant before/after governed storage state,
including the actual installation/event sample points. Use independent
fresh replacement state, never native-seeded state or copied categories.
Compare generated values by each side's source-backed input relationships.

Before any SDK/browser operation, obtain fresh exact source and operational
review and the owner's explicit execution decision. Pin no-send routing,
response provenance, private retention and ordinary cleanup observations.
Unknown dependencies or missing positive/control evidence stop that bounded
attempt without automatic retry. Synthetic no-send responses are not native
vendor responses or receipts. Preserve 059-18's physical-qualification gate.
Any shared owned-site/browser window first needs current coordination with
the Google lane; no site/deployment/window change is assigned here.

Raw records must remain exclusively in 0600 files under a fresh owned 0700
private directory outside tracked source. Public evidence uses fixed
categories/counts and source citations, never private values, dynamic names
or identifier-derived fingerprints. This outline creates no runnable
comparison source or new run grant.

### Close-out (post-DONE)

- [x] Regenerate/check derived board and ADR index; verify clean integration.

**Anti-horizontal-phasing check:** The operator exercises governed persisted
referrer-to-wire behavior through the real local worker/receiver and receives
specific refusal/evidence limits, not an isolated storage helper.
