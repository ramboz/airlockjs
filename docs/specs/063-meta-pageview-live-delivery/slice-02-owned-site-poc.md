---
status: DONE
dependencies: [062-01]
last_verified: 2026-11-04
kind: feature
frame_review: true
arch_review: true
---

## Slice 063-02 - Prepare one owned-site worker PageView

**Goal:** An operator can prepare the owned EDS (Edge Delivery Services) POC
(proof of concept) page without sending, then explicitly arm one consented
PageView through the existing module worker. This slice delivers reviewed
source and staged site assets, not deployment or a live receipt.

The owner approved execution of the session plan on 2026-11-04. Source work,
an isolated checkout of `adobe-rnd/aem-eds-airlock-poc` and SDK-free tests are
authorized. Remote writes, deployment and a live page/send check are not.
The owner selected the existing test-consent signal and explicit arming.

063-01 remains independent and incomplete for its positive Test Events
criterion. Its two live grants are spent. Current historical evidence is
**likely received, not individually verified**, not a diagnosed delivery
failure or full compatibility result.

**DoR:**
- [x] Approved source plan and explicit consent/arming choices.
- [x] Clean Airlock baseline `963771cfdbffb804f5c41676d29af2d12a7629ab`.
- [x] Site source pinned at `e05bf7b8f3aa5647ea12152a33dd7df1ec5973ff`
  in an isolated session checkout; no main-checkout work.
- [x] Fresh explicitly pinned Sol framing pass and normal readiness/claim.

**Acceptance Criteria:**

1. Add a separate default-off `ownedPocBinding` to the prototype adapter,
   connector and serialized worker configuration. It is mutually exclusive
   with `liveBinding` and incompatible with experimental feature grants.
   Keep the existing localhost binding/validator and defaults unchanged.
   Validate a closed plain-data shape containing `pixelId`, `documentURL`,
   `notBefore` and `notAfter` in both constructors. Freeze the complete
   binding; reject invalid or wider authority.
2. Admit only the canonical document
   `https://main--aem-eds-airlock-poc--adobe-rnd.aem.live/?airlock-meta=pageview-v1&meta-pixel=off&consent=accept&run=<synthetic-one-use-marker>`.
   The marker uses the existing bounded `[A-Za-z0-9_-]` alphabet. Reject
   aliases, ports, credentials, fragments, other paths, query ordering or
   encoding changes, extra/duplicate keys and normalization tricks.
   The UTC window is finite, positive and at most six minutes. Check the
   active window immediately before host Fetch; it cannot refund a send.
3. Keep actual worker-side mapping and host correlation to the active plain
   PageView, one Pixel/document and exactly one each of `id`, `ev`, `dl`,
   `rl`, `if`, `sw`, `sh`, `tz`. Destination is exactly
   `https://www.facebook.com/tr/`. Use captured real top-level document,
   empty referrer and existing bounded screen/timezone values. Preserve the
   endpoint ceiling, strict `ad_storage` seal and consent-generation checks.
   One application Fetch maximum, spent before invocation on every result.
   GET/CORS, credentials omitted, redirects forbidden, no-referrer,
   no-store, bounded abort and Fetch at most three seconds. No cookies,
   persistent identifiers, headers/body, new events, SDK metadata, fallback,
   keepalive or application retry.
4. Add a standalone prototype page entry outside stable EDS boot. A
   page-local, non-resettable one-shot latch is claimed before adapter
   creation. Exact opt-in installs only an inert arm surface and consent
   listener; no worker or Fetch starts until an explicit arm with the
   existing private Pixel/window supplied in memory. Loading/reloading is
   inert. Repeated entry evaluation, boot, arm, failure or expiry cannot
   recreate authority in the same document. No `fbq`/`_fbq` installation.
   Pending/denied/absent consent blocks without a deferred automatic send.
   A latch does not claim global enforcement across independent navigations.
5. In the site source, import that entry only for the exact eligible URL,
   before the existing delayed consent module runs. Observe its initial
   `consent.update` and forward later updates through `setConsent`.
   Literal `true` grants, literal `false` denies, malformed/missing is
   ungranted. Revocation invalidates queued work even after regrant and
   attempts to abort in-flight Fetch without undoing past transmission.
   Held work never replays. Dispose worker/listeners on completion/exit;
   expose fixed redacted errors, including disposal failure. Do not silently
   hang or report success after an invalid setup.
6. Require the site's existing `meta-pixel=off` before entry startup.
   Leave `head.html`, consent policy, `scripts/consented.js`,
   `scripts/aem.js`, Google and Adobe integrations unchanged. Do not install
   Meta SDK or a native fallback. Stage exactly the new page entry,
   separately bundled adapter and module worker beneath
   `tools/airlock-meta/{adapters,connectors/meta-pixel}` with the existing
   relative worker URL intact. Check emitted same-origin file-worker layout
   and hashes. No stable core, contracts, production build/distribution or
   dependency-manifest changes. Site changes are limited to that directory,
   the conditional bootstrap, directly owning tests and README guidance.
7. Witness SDK-free red/green tests for policy, actual initial site consent,
   denied/missing/revoke/regrant, one-shot failures and cleanup. Exercise the
   serialized worker and packaged module worker at the exact owned origin
   using locally fulfilled resources and Meta responses, with all upstream
   traffic denied. Cover readable CORS, unavailable response access,
   forbidden redirect and no retry. Check ordinary/invalid site URLs do not
   load this entry, existing vendor query isolation stays unchanged, and
   private binding values do not enter new source or reports. Restore
   existing locked dependencies only after a missing-tool failure; no SDK
   acquisition or upgrades.
8. Record targeted existing 063 regressions, owning new suites and site
   query-isolation checks, changed-file lint and diff checks. Fresh pinned
   Sol compliance/craft/architecture and reconciliation cover both source
   repositories and staged hashes. Preserve a local source/deployment
   manifest and rollback scope, then stop before remote writes or live work.
   Main-code publication is deployment, not source staging. Keep other
   vendors' normal-page effects explicit in any later page-visit approval.
   No receipt or Test Events debugging prerequisite for this source slice;
   no change to 063-01's unmet criterion or private historical originals.

**DoD:**
- [x] Witnessed SDK-free red/green and targeted regression evidence.
- [x] Fresh pinned Sol compliance, craft and architecture passes recorded.
- [x] Deviation log, reconciliation sweep and fresh reconciliation pass.
- [x] Source/assets committed locally; board current; no remote/live action.

## Grounding

At the pinned site commit, `head.html:28-59` implements independent
`meta-pixel=off`; `scripts/scripts.js:206-208,294-297` imports the consent
module during delayed startup; `scripts/consent-check.js:16-46` reads the
test query and dispatches its initial boolean state. The source set is
closed for this integration to those bootstrap paths and the explicitly
staged module closure. This is not a claim about unrelated installations.

Airlock's old binding validator is
`connectors/meta-pixel/pageview-prototype.js:14-29`; host policy and spending
are in `adapters/meta-pixel-prototype.js:419-442`; worker configuration is in
`connectors/meta-pixel/pageview-prototype.worker.js:137-173`. The fixture's
explicit module closure is `rig/meta-behavioral-poc.mjs:7-20`.
The existing site Pixel was compared privately with the existing case input;
only equality was output.

## Assumptions

The deployed site's exact CSP and served asset bytes will permit this
same-origin module-worker closure. Source tests use the pinned site policy
and local fulfillment, not a deployment observation. A later separately
approved deployment/readback must establish served bytes and actual CSP.
No head/CSP relaxation is permitted by this source plan.

### Deviation log

Source is implemented at `09be93c96172950984a2d5135702758832d92faa`.
The isolated site source is `f2a7f213bdc1982a752b407290e1c373e5196504`,
based on the pinned original. No remote write or live action occurred.

- The first custom Terra writer refused a handoff already at IN_PROGRESS.
  The coordinator checked the framing DoR box, used the normal transition
  back to READY_FOR_IMPLEMENTATION and supplied an isolated native Terra
  writer. That writer claimed IN_PROGRESS normally; no gate override.
- The new browser suite initially required an external site directory even
  under ordinary test discovery. Fresh Sol compliance caught this regression.
  A witnessed correction makes only an absent variable opt-in skip.
  Supplied empty, nonexistent and non-directory values fail. All six
  configured browser cases remain required for qualification.
- The site's pre-existing manifest/lock mismatch blocked `npm ci`.
  The exact locked lint versions were restored in isolated session tooling,
  without source-manifest changes. Three new bootstrap lint errors were
  corrected. Actual site lint has the same 12 errors and one warning as the
  pinned baseline, with no added or changed findings.
- Hidden `tools/airlock-meta/.eslintrc.cjs` metadata ignores exactly the
  three copied/generated runtime assets under the site's Airbnb rules.
  This is packaging metadata, not a fourth runtime asset or a canonical
  source suppression. Airlock's source lint still covers their originals.
- Craft N1 is deferred as nonblocking test hardening: count redirect-target
  attempts explicitly in the new packaged browser fixture. Current source
  forbids redirects; exact Fetch-option checks and the existing live-delivery
  browser fixture remain passing. No followed redirect was observed or
  inferred from the nit.
- Two generated `node-compile-cache/` directories remain untracked in the
  isolated writer/site checkouts. Jig refused their explicit recursive
  deletion. No alternative deletion or gate bypass followed. Committed
  source is preserved, but these checkouts are not described as clean.

The writer witnessed policy, missing-entry, bootstrap and discovery
red-to-green checks. The coordinator independently observed all 202 final
configured regression/owning cases pass across 11 files, with zero skips,
plus 63 site checks. Final changed-source lint/diff checks passed.
Fresh pinned Sol compliance, craft and architecture pass on the final
source. Reconciliation has its own recorded gate.

### Reconciliation sweep

- Updated: the owning guide, source slice, plan/tasks and work-plan handoff.
  A private source/deployment manifest preserves both source commits, the
  three runtime asset hashes, exact changed paths and a bootstrap-disable
  rollback diff. It contains no Pixel value or live grant.
- No-op: closed 061/062, 063-01 and private case originals. No original
  criterion, capture, timing supplement or spent grant was rewritten.
- No-op: stable core/contracts, production EDS boot/build/distributions and
  dependency manifests. The finite source-path comparison showed no edits
  there. Eight frozen site surfaces, including head, consent module,
  vendored EDS code and Adobe config, remain byte-identical.
- No-op: accepted decisions, conventions and architecture interfaces.
  Fresh architecture review found no new ADR requirement.
- No-op: inbox and vocabulary. This bounded prototype does not resolve a
  broader adoption/qualification item or introduce a new domain term.
  Use-case coverage reports no gap or dangling link; its nine unrelated
  unanchored specs remain unchanged.
- Deferred: actual served bytes/CSP, deployment and the one-page/one-send
  check require separate fresh approval. Other vendors retain their normal
  page effects. Historical assessment remains likely received, not
  individually verified; 063-01 remains incomplete.
- Leanness: one prototype binding, one inert entry and three runtime
  assets; no stable capability, generic runner or automatic successor.

### Close-out (post-DONE)

- [x] Regenerate and check the derived board.
- [x] Record the source handoff without claiming deployment or receipt.
