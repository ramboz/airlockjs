# Clean-session /goal prompt: Alloy, Target and Analytics

## Before launching

Start a new session from **freshly fetched main** containing the latest
[R-012 evidence](../research/R-012-adobe-first-compatibility.md). Use a local host
with access to the approved private inputs, or explicitly arrange an approved
credential/fixture handoff for another host. A Git checkout alone does not
contain those inputs.

Supply these local handles through the execution environment or a private launch
message; do not commit their values:

- `AIRLOCK_ADOBE_PRIVATE_INPUTS_DIR`: the directory containing the private resource
  manifest and verification reports listed in the task.
- `ADOBE_CREDENTIAL_FILE`: the approved OAuth Server-to-Server export, or an
  equivalent explicitly approved environment/secret-manager source.

Set an overall runtime/AI-credit budget when launching. No overall cap was agreed
when this brief was prepared. The prompt includes the proposed **8-active-hour
compatibility spike**, not an eight-hour estimate for the entire implementation.

This is a proposed execution grant: running the prompt authorizes the isolated
test operations and routine decisions described below. Its presence in Git is
not authorization to start a run. It does not authorize a production deployment,
a release, a changed compatibility gate or a stable-core break.

Run `/goal` with the following task text, or ask it to execute the Task text in
`docs/releases/adobe-compatibility-goal.md`.

## Task text

```text
Deliver the current Alloy/Adobe Target/Adobe Analytics adoption story in airlockjs
through the Jig workflow, from the existing DRAFT portfolio to reviewed code and
real stock-versus-chamber evidence. Work autonomously within the limits below.

SCOPE AND SUCCESS

- Start with spec 051, then refine and implement 052-055 in evidence-led dependency
  order. Include Target work in 053, remaining Analytics/Target scenario gaps in
  056, and the applicable installation/migration/performance/update/rollback work
  in 057.
- AJO, CJA and RTCDP provisioning, publication and product-workflow validation are
  deferred for this run. Preserve their requirements and ownership. Do not discard
  shared SDK semantics required by Analytics/Target merely because later products
  are deferred.
- Do not force every spec 051-057 to DONE. Finish the authorized slices, preserve
  deferred scope and actual dependencies, and let Jig derive spec rollups. A rollup
  that excludes deferred slices is not proof of complete Adobe compatibility or
  readiness for v1.0.
- Success requires reproducible stock and chamber journeys: distinct synthetic
  Analytics page/custom events with downstream receipt, and Target decision
  qualification, safe actual rendering, Adobe-native display/interaction
  notifications and observable product outcomes for the assigned scenarios.
  Extend event/proposition coverage according to the pinned inventory and refined
  ACs; do not reduce the implementation to the current page-view/HTML subset.
- Deliver a usable EDS/aem-martech adoption path, the assigned ACDL/Launch contract,
  consent/identity/lifecycle behavior, and equivalent performance/rollback evidence.
  Preserve working existing behavior and all approved safety boundaries.
- SDK boot, HTTP 200, a sent beacon, a fixture pass or a GA4 exposure is not an
  Adobe product receipt. If a mandatory behavior is infeasible or blocked, report
  it honestly and stop for the required decision; never manufacture completion.

BUDGET AND DELEGATED AUTHORITY

- Use the overall runtime/AI-credit limits explicitly approved by me for this
  /goal run. If no overall limit was supplied, ask for it before implementation
  or live mutations. Do not invent a cap or silently run unbounded.
- By running this prompt I approve at most 8 active engineering hours for 051-03,
  excluding external access/report waiting. This is only its compatibility-spike
  time-box. Track active time; stop at its limit with findings. Extensions require
  a new owner decision.
- I delegate ordinary framing, SPIDR slicing, implementation choices and the
  proceed decision inside the existing constraints to the orchestrator after
  required independent reviews. Ground the approach and initial measurement
  conditions/bands in the stock evidence before dependent implementation.
- Do not weaken an existing criterion, invent permissive performance bands to
  pass, approve a full-release bar on my behalf, change project conventions,
  break ADR-0017, fork Alloy, or grant broad DOM/global/network authority.
  Those changes require an explicit owner decision.
- I authorize code changes, normal local tools/tests, and reviewed commits/landing
  for this scope. I authorize deploying opt-in test code to the dedicated reference
  EDS repository/site and bounded synthetic tests using the approved fixtures.
- Target offer/activity/audience changes and temporary live test activation are
  authorized only for verified Airlock-owned objects in the exact approved
  workspace/property/environment, restricted to the reference test domain and
  namespaced test decision scope/marker. Record a plan before applying changes.
  The existing activity is saved and intentionally future-dated: verify and
  deliberately adjust its schedule/targeting before a live test, and restore it
  to saved/inactive after testing.
- Necessary development-only Launch fixtures may be proposed and created within
  the same approved org after a bounded ownership/cost plan. No customer container
  or production library publication. Report a missing permission; do not bypass it.
- Reuse the other allowlisted owned fixtures. No shared/customer/default-resource
  edits, role changes, sandbox resets, paid provisioning, new product entitlements,
  Platform/Profile ingestion, or production publication. The Data Collection
  objects' prod namespace is not permission to mutate unrelated AEP resources.
  Any additional resource/configuration authority outside this grant needs approval.
- No npm/GitHub release, version bump or v1.0 tag. Resource deletion needs an
  explicit exact-ID cleanup approval; prefer leaving reusable fixtures inactive.

BOOTSTRAP AND AUTHORITATIVE CONTEXT

1. Verify this checkout contains the latest main and R-012's initial routing and
   approval evidence. If it is stale, stop before implementation and explain the
   missing bootstrap; do not recreate resources because older notes lack them.
2. Invoke Jig orientation. Read CLAUDE.md/the active primer, docs/workflow.md,
   docs/conventions.md, docs/architecture.md, docs/product-vision.md,
   docs/releases/adobe-compatibility.md, docs/research/R-012-adobe-first-compatibility.md,
   ADR-0016, ADR-0017 and ADR-0031, the spec/bug boards, and specs 051-057.
   Use configured semantic-index tooling when available for broad source exploration.
3. At this brief's authoring, all seven specs remain DRAFT. Only 051 has three
   authored slices, plan and tasks. Re-read current lifecycle state before work;
   do not regress slices that have since advanced. Some DRAFT/spec/release baseline
   wording predates the verified setup. Refresh live operational/DRAFT facts from
   R-012 through normal review, preserving dated history and accepted decisions.
   Do not count ad-hoc setup checks as acceptance of 051-01/02/03.
4. Keep the official Alloy bundle unmodified and choose/document its exact
   version/hash. Begin from the aem-martech reference pinned by R-012; do not assume
   the historic v2.35.0 SDK pin is automatically the correct current target.
   Maintain a closed documented SDK command/options/results/events/callbacks
   inventory, with explicit ownership and supported/blocked/unverified status.

PRIVATE INPUT HANDOFF

Resolve AIRLOCK_ADOBE_PRIVATE_INPUTS_DIR and ADOBE_CREDENTIAL_FILE from the approved
environment or private owner-supplied handles. An explicitly approved secret-manager
source can replace the credential export. If required inputs are missing, stop and
request the handoff; do not search unrelated directories or assume a cloud clone
has local attachments.

Read airlock-adobe-resources.local.json and focused-adobe-readiness.local.json;
consult target-write-readiness.local.json, target-approval-readiness.local.json,
datastream-screenshot-verification.local.json and reference-git-write-dryrun.local.json
for provenance. The manifest contains actual org, suite, site/repository, datastream,
schema, Target environment/workspace/property/activity/offer selectors.

- Check availability and scope without printing file contents or secrets.
  Use a credential-file/env/secret-manager handle, never command-line secret
  values. Mint fresh tokens in memory; do not save bearer tokens.
- Copy non-secret fixture/evidence inputs into this run's private 0600 state and
  make the orchestrator its sole writer. Keep the original seed intact. Do not
  copy credential material into reports, test fixtures or committed files.
- Real selectors and raw captures belong in private state, not Airlock's committed
  reports/docs/fixtures. Define any necessary public test-site runtime-selector
  configuration explicitly; bearer credentials must never enter browser bundles.
- Ad-hoc verification scripts are historical evidence, not production provisioners
  or an accepted preflight utility. In particular, do not rerun the old
  create-airlock-adobe-resources.py: suite/property creation attempts were superseded
  by owner-created resources.

VERIFIED STARTING POINT AND LIMITS

The following are dated setup observations in R-012, not a substitute for
rechecking current resources or newly implemented behavior:

- Analytics reporting and exact dedicated-suite access work.
- Target content-offer and activity create/read/edit work in the exact workspace
  and property. Approval was verified on a >300-day-future schedule, then the
  activity was restored saved/inactive. No current live delivery was exercised.
- Owner screenshots showed only Analytics and Target enabled. The suite and
  property token match approved resources. The initially empty Target environment
  field was corrected and saved by the owner using the verified development ID.
  This saved pin is owner-confirmed, not a configuration API readback.
- The owner's configuration API key is rejected despite View/Manage Datastreams
  policies. Native browser tools exposed only Adobe's outer shell, not its iframe.
  Use the existing verified managed fixture. Do not substitute Adobe's UI
  application key, extract browser tokens, guess internal write endpoints, or
  send diagnostic Edge events to discover unknown routing. Any routing change
  requires fresh evidence before traffic.
- Platform ingestion is disabled for this initial baseline; no new AEP sandbox
  is needed. The selected ExperienceEvent schema has only base field coverage,
  not proven web/commerce/personalization coverage. Diagnose actual requirements
  with supported contracts; do not silently enable ingestion or mutate prod AEP.
- The reference repo has admin/push access, an authenticated push dry run passed,
  main was unprotected with no returned branch rules, and EDS advertises
  preview/live/code read/write. Actual deployment, DA authoring and site-config
  administration were not exercised; a configuration read returned 403.
  Recheck current relevant permissions and do not claim deployment already passed.
- Local Playwright/Chromium, Vitest and esbuild were available on the verification
  host. Check the run host; use fresh isolated browser contexts for synthetic SDK
  tests, not the owner's Adobe login profile.
- At this brief's authoring, runtime remains v0.8.0. No stock/chamber SDK journey
  or live product receipt was proven in the setup session.

EXECUTION THROUGH JIG

- Refine and review 051 before implementation, then implement 051-01's real,
  versioned, tested redacted preflight CLI. Distinguish verified API checks,
  scoped owner-provided configuration evidence, and unavailable automation.
  Review the input/evidence contract explicitly; do not turn unverified required
  checks green or probe undocumented APIs to evade a manual step.
- Complete 051-02's repeatable plan/apply/reuse/refusal behavior and stock live
  positive/negative baseline. Choose correlation, diagnostic/reporting surfaces
  and finite observation windows before sending data. Stock and chamber arms
  run separately with equivalent synthetic inputs, never uncontrolled dual-send.
- Execute 051-03 only after the baseline/readiness gates. Resolve the approach
  from representative callback/page-state/DOM/identity/lifetime probes, measured
  constraints and required frame/architecture reviews. Do not smuggle the full
  implementation into the spike or relax its outcome when the budget expires.
- Then refine later specs into vertical, caller-visible slices from that evidence.
  Keep actual cross-slice dependencies. Independent Target/Analytics work need not
  wait for deferred AJO/CJA/RTCDP work; missing shared prerequisites cannot be skipped.
- Follow DRAFT -> READY_FOR_REVIEW -> READY_FOR_IMPLEMENTATION -> IN_PROGRESS ->
  REVIEWED -> RECONCILED -> DONE using the installed Jig helpers. Honor DoR,
  derive frame-review flags from real assumptions and run every required pass.
- Use the configured Jig implementer with witnessed red-to-green tests, followed
  by independent compliance/craft and conditional frame/architecture/code-health
  reviews. Reviewers get specs, ACs, deliverables and evidence, not the implementer's
  reasoning transcript. Record real verdicts; fix blockers and rerun reviews.
  Do not fabricate evidence, bypass gates, or post GitHub PR reviews for this
  direct-to-main/local-review workflow.
- Reconcile docs and deviations, run the reconciliation review, regenerate/audit
  the status board and use-case links, and sync memory. Current scoped progress
  must not erase the wider release obligations or existing third-party residuals.
- Use existing targeted tests/builds first and broaden validation as warranted.
  Add no unrelated tooling or abstractions. Never weaken consent, tenant/endpoint,
  cookie, DOM or stable-core controls to make the SDK pass.

INTEGRATION AND FINISH

- Follow the repo's Conventional Commit/direct-to-main intent through the host's
  supported workflow. In a worktree, edit and commit only the session checkout
  and use the approved landing mechanism; never read/write the shared main checkout,
  create a PR flow, overwrite unrelated work or rewrite history. Include the
  required Co-authored-by trailer. Revalidate integrated results and leave a
  clean, persistent handoff.
- Compare no-martech, competent phased stock aem-martech and the chamber arm.
  Record conditions, repetitions, noise, main-thread work, worker startup/clone,
  network wait and rendering cost. Do not call lab measurements field Core Web
  Vitals or infer a gain merely from off-thread mapping.
- Finish the authorized scope with actual reviewed behavior, vendor-native
  outcomes, regression/negative tests and a reproducible operator/adopter path.
  Leave test activities inactive and stop temporary test helpers.
- Provide a concise final report: completed slice/evidence/commit links, how to
  reproduce the initial story, measured limits, what remains deferred or blocked,
  and the unchanged release gate. Do not claim full portfolio completion,
  universal Alloy support, v1.0 qualification or publication from this narrower run.
- Stop for budget exhaustion, missing required access/outcome evidence, infeasible
  behavior or a required authority/core/gate change. Preserve findings and exact
  next actions; do not silently waive the blocker or declare the goal successful.
```
