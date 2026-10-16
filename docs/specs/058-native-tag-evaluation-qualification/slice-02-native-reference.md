---
status: DONE
dependencies: [058-01]
last_verified: 2026-10-16
frame_review: true
arch_review: true
---

## Slice 058-02 - Pinned native attempted-request reference

**Goal:** An operator can acquire a complete, provenance-qualified native
attempted-request reference without external dispatch, or receive an explicit
inconclusive result instead of an empty baseline.

**DoR:**
- [x] 058-01 qualifies the fixed local HTTP/redirect observation principles.
      A native-profile runner still needs its own all-fulfill/abort boundary
      and explicit unsupported-surface controls; no generic SDK safety is inferred.
- [x] Meta's exact retained runtime/configuration and transport hashes are
      explicitly supplied in a private local manifest. Google lacks these bytes
      and remains blocked; absence never triggers download or a resend.
- [x] Actual headed/headless Chrome are separate cohorts, without UA/webdriver
      spoofing or native filter overrides. Node24.10.0/Chrome155.0.8059.80
      are pinned for this pass.
- [x] Frame review retains the outside-HTTP networking condition. An independent
      process-local denial probe demonstrates matched loopback positive HTTP200
      versus confined zero arrival. The implementation must preserve/retest it.

### Bounded offline profile for this pass

The owner approved up to two active hours on 2026-10-16 within the existing
shared 25K preparation target. No new vendor event, resource download, site
deployment or account mutation is authorized. First qualify the retained Meta
PageView profile; Google is blocked if its actual runtime/configuration bytes
are absent. A passing profile is not all vendor scenarios or full replacement.

The only native resources may be explicitly supplied saved runtime/configuration
bytes with their request/response provenance and SHA-256s. Fulfill the exact
document and qualified script dependencies from those bytes at Chromium's
request stage; **no request may be continued to a network destination**, even
an owned one. All other HTTP attempts are retained and aborted. Explicit CSP
denies workers, frames and page WebSockets; a forbidden-surface or unknown
dependency attempt is inconclusive, not silently dropped from a positive run.
Launch only the owned Chrome process under a macOS `sandbox-exec` policy
denying IP networking, allowing Unix IPC for Chrome's own process plumbing,
and denying both known mDNSResponder Unix-socket aliases plus its named Mach
lookup. The same fixed policy is required for matched zero-query resolver
connection controls; ordinary connects must succeed and confined connects
must fail with EPERM/EACCES. This is not a global host-network change.
A failed/unavailable sandbox or mismatched positive/negative local tripwire is
inconclusive before native code; no unconfined-native fallback is permitted.

Use actual stock bootstrap/native code without patching vendor bot/consent
filters, user agent, webdriver or other browser evidence. Normal headed Chrome
is a separate recorded cohort from headless Chrome, not a spoof of it. Retained
configuration includes a native user-agent-based BotBlocking plugin; an offline
headed diagnostic emitted one PageView attempt while the headless diagnostic
consumed its command without a beacon. Those are preliminary, source-grounded
observations, not a complete reference or proof of every reason for suppression.

Before promotion, require a positive attempted request with original URL
multimap/method/body/available request headers and its input relationships,
closed runtime/configuration dependencies, linked disabled and changed-input
controls, and independent proof that the all-fulfill/abort boundary never sends
to its local network tripwire. HTTP framing and output/time/byte limits must
stay explicit. Missing Google loader bytes cannot be synthesized from its
successful HTTP status or repaired with an automatic download/resend.

**Acceptance Criteria:**

1. The command records native runtime/configuration hashes, dependency closure,
   browser conditions, scenario inputs, consent and the finite observation window.
   A body/schema placeholder cannot impersonate official-runtime execution.
2. Locally fulfilled resources execute the pinned native tag. The recorder retains
   every in-scope attempted request, including ordering, duplicate query fields,
   original bodies, relevant headers and response/ownership relationships.
   Dispatch, cookie acceptance and redirects not actually executed remain unproved.
3. Missing resources, an empty expected-positive PageView/conversion, asynchronous
   capture failure or unexplained branch produces `inconclusive`, never exit 0.
   The known Meta no-beacon case is an explicit failing reference fixture, not
   a successful empty expected set.
4. Disabled and consent-negative scenarios report absence only when tied to
   their qualified positive reference. No URL flag, simulated callback or
   user-reported receipt substitutes for the positive native attempt.
5. Changing an input amount/identity/consent/destination must have a discriminable
   observed effect where the pinned native contract requires one; otherwise the
   scenario remains blocked rather than accepted on mere field presence.
6. No real vendor event, customer traffic or network fallback occurs. An actual
   owned-backend experiment requires a separate finite grant outside this phase.

**DoD:**
- [x] Targeted tests and independent compliance/craft/architecture reviews pass.
- [x] Independent reconciliation review passes and the RECONCILED gate clears.
- [x] Positive and falsifiable negative controls are retained separately.
- [x] Unresolved native behavior is carried to the vendor spec and readiness gate.

**Anti-horizontal-phasing check:** The operator acquires a named trustworthy
reference or an actionable blocked result through one end-to-end command.

### Close-out (post-DONE)

- [x] Final DONE gate cleared after the implementation commit.
- [x] Regenerate/check the board; record evidence limits and durable learnings.

### Deviation log (after reconciliation)

1. **First retained profile, not a universal native host.** The implementation is
   `rig/native-tag-reference.mjs`, a fixed macOS Chrome launcher/shared policy,
   explicit browser tests and an operator guide. It executes only the two exact
   retained official Meta resource pins and generated stock-bootstrap fixtures.
   Arbitrary commands/scripts, remote acquisition and unconfined native fallback
   are refused. The generated document is not a captured production document.
2. **Actual cohorts preserved.** The old headless no-beacon is not rewritten into
   success. Actual headed Chrome emits a pinned native PageView attempt; the
   genuine headless diagnostic still has loaded runtime/config, an executed
   callable SDK, one Pixel/event record and no measurement. Native BotBlocking
   configuration examines browser evidence, but no UA/webdriver/filter override
   is applied and this is not a universal suppression diagnosis.
3. **One native consent negative is now witnessed.** Initial code had only a
   query-disabled control, which did not satisfy the native consent requirement.
   Revoke-before-init now leaves the actual native init/track queue held with
   no configuration or measurement. Removing the generated fixture's actual
   revoke API call falsifies that negative marker. Other consent states,
   grant/replay and transition behavior remain unqualified.
4. **Compliance corrections were real.** The initial review blocked an
   overbroad favicon exception, FIFO acquisition and weak headless assertions.
   Only the exact query-free browser `Other` GET with absent body is an exempt
   favicon; script/query/POST variants block closure. `O_NONBLOCK` is applied
   before regular-file validation. The first real FIFO red probe hung and its
   specific test process family was stopped; the corrected CLI promptly refuses
   the FIFO. Genuine SDK state now prevents an unrelated empty failure from
   impersonating the headless reference.
5. **Process and resolver controls are separate from HTTP observation.** Frame
   review warned that HTTP interception alone could not close DNS/preconnect
   effects. The first process policy retained too broad a Unix exception.
   Architecture review correctly blocked it. A syntactically valid nested
   socket-path filter proved ineffective and remains failed evidence. The final
   shared policy directly denies both known mDNSResponder aliases plus its named
   Mach lookup, while retaining Chrome's required Unix IPC. A same-policy bounded
   helper witnesses ordinary connections versus confined EPERM/EACCES, sending
   no resolver-query payload. This does not generalize to arbitrary helpers,
   operating systems, SDKs or page WebSockets.
6. **No native network continuation.** Exact source resource URLs are fulfilled
   from retained unmodified bytes; other attempts are captured and aborted.
   Unknown dependencies, unsupported targets, policy violations or capture gaps
   are inconclusive. Aborted measurements have no vendor response/receipt proof.
   Source HTTP statuses and generated responses are labeled separately.
7. **Craft provenance nit corrected.** Boundary-only synthetic resources now say
   supplied-but-unexecuted, not native fulfillment. A failing exact-label test
   preceded the correction. Private `report.json` remains a pre-publication
   snapshot; consumers require successful command completion and its final
   stdout/API result, including elapsed time.
8. **Google stays blocked.** The inspected saved Google recording has 12
   requests and three stored measurement-response bodies, not the official
   runtime/configuration/dependency bytes. HTTP 200 metadata cannot reconstruct
   those bytes or missing auxiliary outcomes. The native-profile tool is a
   narrow Meta capability; it does not satisfy 059's Google reference gate or
   the complete Meta inventory.

### Validation record

- `AIRLOCK_META_REFERENCE_INPUTS=<explicit-private-manifest>
  AIRLOCK_META_HEADLESS_DIAGNOSTIC=1 node_modules/.bin/vitest run
  --config vitest.native-qualification.config.js`: **63 passed**, including
  028 local-recorder cases and 035 native-reference cases with actual retained
  resources and falsification controls. No native test was silently counted
  from synthetic bytes; without explicit private input those tests are visibly
  unexecuted and cannot establish native qualification.
- Targeted ESLint and `git diff --check`: **passed**. The only default-test change
  excludes this exact new browser-test path; the explicit browser configuration
  includes it. Closed 058-01 source/tests, Adobe code, core/connectors, the
  global oracle and approvals remain unchanged.
- Final operator CLI: `qualified` / exit 0 for `native_attempt` /
  `meta-pageview` on macOS `27.0.1`, Darwin `27.0.0`, Node `v24.10.0`,
  Chrome `155.0.8059.80`. Baseline / disabled / revoked / value1 / value2
  attempted measurements are **1 / 0 / 0 / 1 / 1**. The native value/currency/
  owner/event relationships match and the same-run positive links both negatives.
- Separate controls: ordinary loopback HTTP 200 / one arrival versus confined
  zero; two resolver-alias positive connections versus two confined denials
  with zero query payload; CDP tripwire one attempt / one abort / zero arrival.
  All owned processes, contexts, servers and signal listeners closed.
- Private raw capture/report retains **22 request records**, three aborted
  measurement attempts, 5-second case windows and original input/resource pins.
  All vendor dispatch/receipt, chamber, matching, attribution and full-support
  claims are false. Runner SHA-256:
  `f9b260779e30a8a59c01f3bcd4d7f44e3e384450657cdc5a4a7c397aecb7b4c8`;
  policy SHA-256:
  `e70871c2d70b0c6df678358da9ea6f45f2876557284fef4e66d6538458c51ebc`.
- Original captures, unsuccessful probes, Google input-readiness artifact and
  the corrected operator receipt stay in private session state. The approved
  two-hour pass uses the existing shared 25K target, not a new allocation;
  exact credit metering remains unavailable. No vendor event, download, site/
  account mutation, deployment, campaign or full implementation loop occurred.

### Reconciliation sweep

| Artifact | Disposition | Rationale |
|---|---|---|
| Native runner, fixed launcher/shared policy, explicit tests and guide | `updated` | Bounded one-profile attempted reference, independent process/resolver/HTTP controls, exact pins and truthful private/public evidence. |
| 058 overview/plan/tasks and status board | `updated` | Distinguish completed narrow Meta reference from missing Google inputs and unimplemented full comparisons. Lifecycle and board use real helpers. |
| README and CLAUDE | `updated` | Publish profile scope without promoting DRAFT vendor specs or implying delivery/attribution. |
| 060 live overview/plan and refinement ledger | `updated` | Headed retained profile now has positive attempted evidence; original headless/owner receipt history remains distinct and the rest of Meta's matrix remains open. |
| 059 live overview | `updated` | Explicitly retain the missing official Google byte/dependency gate; no native resend/download authority inferred. |
| Memory learnings | `updated` | Preserve genuine headed/headless cohorts and the independently qualified known resolver-channel requirement. |
| Closed 058-01 and historical native captures/reviews | `no-op` | No historical evidence rewriting or closed-record amendment. Earlier failed verdicts remain in Git history. |
| Accepted ADRs, stable core, conventions and global oracle/approvals | `no-op` | No runtime contract, grant, threshold, component or convention changed. |
| Adobe code/evidence, EDS site and vendor/account resources | `no-op` | No mutation or replay; this pass was offline/contained only. |
| Inbox and unrelated vendor features | `no-op` | No parked feature or broader compatibility/outcome requirement was completed. |
