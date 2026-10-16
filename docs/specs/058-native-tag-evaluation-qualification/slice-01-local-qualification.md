---
status: DONE
dependencies: [adr-0033]
last_verified: 2026-10-16
frame_review: true
arch_review: true
---

## Slice 058-01 - Local recorder and no-send qualification

**Goal:** An operator runs one bounded command and receives a truthful report
showing whether a real local receiving sink, recorder and declared no-send
boundary agree.

**DoR:**
- [x] ADR-0033 is accepted after frame review; this slice's frame is reviewed.
- [x] Coordinator inspected existing recorder/browser-test prior art; preserve
      Adobe-specific routing and implement a separate local qualifier.
- [x] `plan.md` pins the executed local runtime, declared transport set,
      count/byte/time ceilings, private-output and closed public-report shape.
      Untested surfaces are explicitly not qualified.

**Acceptance Criteria:**

1. **Real local positive.** A command starts a loopback-only sink and isolated
   browser, exercises synthetic GET/query and POST/body requests, and emits
   the spec's JSON report with exit 0 only when the sink-received method, URL
   multiplicity, original body and recorded response relationships agree.
   Qualification names `local_network`; vendor/chamber/outcome claims stay false.
2. **Pre-execution guard.** Guarding is active before fixture scripts/navigation.
   A finite declared test matrix attempts fetch, image, XMLHttpRequest and beacon
   traffic plus redirects to an unapproved destination. For EACH claimed case,
   a matched same-run positive leg explicitly allows only that loopback tripwire
   destination and must demonstrate the expected arrival. The enforcement leg
   uses equivalent inputs/browser conditions, observes the attempt and requires
   zero tripwire arrivals. A missing/unsuccessful positive leg is `inconclusive`,
   not proof that the guard prevented transmission. Only explicitly declared
   local resources are allowed in either leg.
3. **Unsupported transport is visible.** Declare treatment of frames, dedicated
   workers, service workers, WebSockets and browser/background requests. A surface
   not positively qualified cannot be counted as protected. The command refuses
   an invocation requesting a broader surface than it can demonstrate.
4. **No completion race.** The recorder has a finite observation cutoff and
   drains all accepted asynchronous reads before exposing an immutable snapshot.
   Delayed reads, late responses, transport aborts, unreadable bodies and a
   never-settling read are individually classified. No request vanishes because
   a new capture promise arrived during a fixed Promise.all snapshot.
5. **Complete local branches.** Include response-linked fan-out and an actual
   local HTTP redirect whose target loses its ownership marker. Record each
   request/response/redirect link and distinguish the guard's intervention from
   native behavior. Do not authorize an entire host merely to recover a marker.
6. **Non-vacuity.** An expected-positive scenario with zero observed requests,
   a removed listener, wrong body, missing response, dropped branch or failing
   tripwire cannot exit 0. A loopback-only guard-disabled/bypassed mutation for
   each claimed enforcement case must produce a tripwire arrival and make
   qualification fail; it must never permit external destinations. Complete
   material mismatches are `nonconformant`; capture/provenance or matched-control
   gaps are `inconclusive`. Expected-zero controls need their matching positive,
   not an unrelated successful GET/POST fixture.
7. **Safe operator output.** Invalid input is rejected visibly with exit 3.
   Public stdout/stderr never contains raw request values, cookies, identities
   or fixture secrets. Explicitly chosen private capture files are owner-only;
   existing files are not silently overwritten and no unrelated directory is read.
8. **Bounded cleanup.** Count/body/response/aggregate-byte/settle limits are
   enforced before unbounded retention. On success, error or timeout, this run's
   browser, sink and listeners close. No global browser, process or profile is
   stopped. Importing a module performs no network or browser work.

**DoD:**
- [x] Every AC has a witnessed failing control and passing intended behavior.
- [x] Existing targeted recorder tests, new tests and applicable lint pass in
      their explicitly recorded runtime environments; see the validation record.
- [x] Compliance, craft and architecture reviews pass after recorded corrections.
- [x] Reconciliation review passes and the recorded transition gate clears.
- [x] Usage/elapsed-work checkpoint and exact validation receipts are retained;
      exact shared AI-credit usage remains unavailable, not claimed enforced.
- [x] The operator guide distinguishes local qualification from vendor proof.

**Anti-horizontal-phasing check:** The operator gets a complete guarded local
request-to-sink-to-report journey, not an intermediate parser or library.

### Close-out (post-DONE)

- [x] Regenerate/check the spec board and consolidate durable learnings.

### Deviation log (after reconciliation)

1. **Separate local tool, not a generalized Adobe recorder.** The executable is
   `rig/native-tag-qualification.mjs`, with its operator guide beside it. Existing
   Adobe routing, POST/JSON contracts, fixtures and runtime code are unchanged.
   The tool has no arbitrary native script, account or external-URL input.
2. **Real browser controls are explicit.** Tests live in
   `rig/native-tag-qualification.test.mjs`, selected only by
   `vitest.native-qualification.config.js`. The default config excludes that
   exact new path; no existing test, oracle threshold or component is weakened.
3. **Matched controls caught a real enforcement gap.** The initial
   Playwright-route experiment allowed a redirected tripwire arrival. Chromium
   request-stage CDP interception replaced it for this fixed local fixture.
   Each transport has independent positive/enforced/bypass receiver evidence,
   and each leg requires its redirect and response-URL branch relationships.
   This does not qualify frames, workers, page WebSockets or background traffic.
4. **Independent compliance corrections.** The first compliance pass blocked
   late-event classification, per-leg branch falsification and the deadline
   through cleanup/output. Accepted response/terminal listeners now remain
   active during finite settlement; late reads cannot mutate the published
   snapshot. Named timing/abort/dropped-branch controls demonstrate failures.
   A fresh correction review passed; the earlier verdict remains in Git history.
5. **Owned process and deadline handling.** A loopback-only Playwright browser
   server exposes only the spawned browser's process handle for forced cleanup.
   One budget remains active through acquisition, execution, settlement, cleanup
   and output. Architecture review caught the original pre-clock directory
   acquisition; the correction and its stalled-acquisition control passed
   independent re-review. An uncancellable filesystem completion may leave only
   an incomplete empty private directory, never resume fixture execution.
6. **Runtime cohorts are not interchangeable.** During preparation the host
   browser updated from `.79` to `.80`; the old pin refused it. Previous `.79`
   receipts remain historical. The current complete matrix is explicitly
   qualified on Node `v24.10.0` / Chrome `155.0.8059.80`.
7. **Report timing nit is documented, not hidden.** Saved `report.json` is the
   pre-publication snapshot. Final `run_elapsed_ms` is present only in the
   post-output API/stdout result; the operator must require successful command
   completion, not treat a partial file as a pass.
8. **Bounded continuation.** The owner approved one additional active hour on
   2026-10-16 to finish review recording, local validation, reconciliation and a
   local commit within the same shared 25K preparation budget. No credit-meter
   enforcement or exact consumption is claimed. No vendor sessions, live
   requests/events, site deployments, account mutations or release work resumed.

### Validation record

- `node_modules/.bin/vitest run --config vitest.native-qualification.config.js`:
  **28 passed**, Node `v24.10.0`, Chrome `155.0.8059.80`, 2026-10-16 close-out.
  This includes the exact negative fault categories, delayed/late accepted
  observations, every-leg branch links and physical owned-browser PID exit while
  an unrelated receiver/signal listener survives. Earlier red controls and the
  genuine blocking reviews were retained before their corrections.
- `node_modules/.bin/eslint rig/native-tag-qualification.mjs rig/native-tag-qualification.test.mjs vitest.native-qualification.config.js vitest.config.js`:
  **passed**. Default Vitest collection excludes only the new browser-test path.
- `node_modules/.bin/vitest run test/adobe-stock-wire-recorder.test.js`:
  **133 passed under Node `v22.16.0`**. The unchanged adjacent suite's Node
  `v24.10.0` run passed 132 cases but failed its existing import-side-effect
  monkeypatch when Node's ESM loader called patched filesystem code. Neither the
  Adobe test nor implementation differs from the original branch base; no
  assertion was weakened and no general Node 24 compatibility claim is made.
- The final direct CLI run returned `qualified` / exit 0, **30 captured requests**,
  **20 receiver requests**, complete capture, zero pending reads, and all owned
  resources/listeners closed. Runner SHA-256:
  `8b1067087244f0d9333e32c6433083ddd17d209ccee1da8292f1ac5db546daf2`.
  Original private capture/report and grant checkpoint remain in the session
  artifact area, not Git. Every vendor/chamber/matching/attribution/full-support
  claim remains false.
- Only 058-01's `local_network` / `core-http` layer is qualified. 058-02/03 and
  the Google/Meta implementation specs remain unqualified; Meta's automated
  no-beacon and Google's incomplete fan-out are not reclassified by these checks.

### Reconciliation sweep

| Artifact | Disposition | Rationale |
|---|---|---|
| Local runner, explicit browser tests and operator guide | `updated` | Complete fixed-fixture CLI, independent receiver controls, limits, private output and honest claim boundary. |
| Vitest configs | `updated` | New browser suite is explicit; exact-path exclusion preserves default hermetic collection. |
| `spec.md`, `plan.md`, `tasks.md` and spec board | `updated` | Local qualification is distinct from native-reference/comparison work; lifecycle and board use the real helpers. |
| README and CLAUDE primer | `updated` | Reflect local qualifier progress without promoting vendor drafts or changing Adobe-first scope. |
| Vision, architecture, accepted ADRs and decision index | `no-op` | Existing full-target authority already distinguishes preparation from runtime grants. No module interface, capability, frozen core or Accepted record changes. |
| 059/060 live overview/plan text | `updated` | Replace stale claims that every 058 slice is DRAFT; actual native/evaluation prerequisites remain open. |
| `docs/refinement-todo.md` | `updated` | Keep native reference, full sequence, Meta observation and Google auxiliary evidence as open work. |
| `docs/inbox.md` | `no-op` | No existing parked idea was completed by this narrow local qualifier. |
| `docs/memory/learnings.md` | `updated` | Persist the runtime-pinned local evidence layer, finite settlement and scope limits via memory-sync; do not duplicate the existing per-hop-redirect learning. |
| Conventions and lightweight decisions | `no-op` | No convention or independent product/visual decision changed. CDP/process handling is a bounded implementation detail of this spec. |
| Adobe implementation/evidence and EDS site | `no-op` | No mutation, deployment or replay. Existing adjacent regression checked separately. |
| Global oracle, approvals, workflows and vendor runtime code | `no-op` | No threshold/component/grant changes; no unattended implementation loop started. |
