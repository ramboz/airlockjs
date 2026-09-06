---
status: DONE
dependencies: []
last_verified: 2026-09-05
arch_review: true  # freezing the public surface IS an architectural commitment (what adopters may rely on at 1.0).
frame_review: true  # the frozen/experimental boundary + the three open rulings (accepts/reconcile/read-namespacing) are load-bearing 1.0 commitments.
---

<!-- jig self-defining vocabulary (soft, forward-only); jig grounding (064-02/ADR-0020): probe/cite or mark assumptions. -->

## Slice 037-01 — the capstone 1.0-API-pin ADR + contract-stability enforcement

**Goal:** land the 1.0 API pin — a **capstone ADR** recording exactly what is frozen at 1.0 (and what is explicitly
NOT), and **contract-stability guards** enforcing the frozen surfaces that are not yet guarded — so a future edit that
breaks the 1.0 contract fails a test, and an adopter knows precisely what they may rely on. **No release cut** (owner
decision: 037 pins the API; the v1.0.0 version-bump/tag/dist is a separate later step).

**DoR:**
- ✅ Grounded (read 2026-09-05, per the spec's Assumptions): the frozen-five framing (`docs/architecture.md` ~:57-69 +
  the config carve-out); the boot/handle surface (`adapters/eds/index.js` — `boot`/`bootEdsAnalytics`/`installOnWindow`,
  the two window.airlock handle shapes); `push()`→void (`contracts/push-api.md`); what `test/contract-stability.test.js`
  already guards (`capability.d.ts` + `connector.d.ts` text only — `seams.d.ts` + the boot/handle shape are NOT guarded);
  the config schema's PRE-1.0 self-declaration; the three open rulings' sources (refinement-todo:547-549 accepts,
  ~:94 iii reconcile, :462-466 read-namespacing/sampled).

**Design focus (the frame-critique + arch review ratify the 1.0 commitments — NOT asserted here):**
- **`composite.accepts(name)` — INTERNAL, via physical removal (ratified clean at the frame-critique).** Keep it off
  the frozen 1.0 handle so the installed `window.airlock` is exactly
  `{ push, pushCritical, setConsent, getState, flushNow, stats, dispose }`. The removal is clean (verified): the alloy
  exposure reporter reads `ref.accepts` on the `compositeEmit` object (`adapters/eds/index.js:874-878`), NOT
  `window.airlock.accepts` — so rebinding the ref at `:1497` from `composite.accepts(name)` to a **local predicate over
  the booted connectors** (`booted` + `acceptsEvent` are both in scope there) removes the only reference to the
  composite's method; `window.airlock === composite` is a non-issue, no wrapper needed. Implementation flag: ~6 existing
  `expect(window.airlock.accepts(...))` assertions (`test/eds-boot-config.test.js:361-371`,
  `test/eds-boot-alloy.test.js:759-760`) flip to exercise the gating BEHAVIORALLY (the 034-03 alloy-only-exposure
  drop+diagnose stays green). (The lower-churn alternative — keep the method, document it unfrozen — is available if arch
  prefers, but a 1.0 freeze is the moment to shrink the public surface, and removal is proven clean.)
- **The 035 `reconcile`/`grantedCookieNames` coupling — reconcile stays HOST-INTERNAL + unfrozen (proposed).**
  `caps.cookies.reconcile` is host-wired, not connector-granted, so the 1.0 pin freezes the *connector-facing* grant
  surface and leaves reconcile (+ its scope coupling, 035 arch #1) host-internal — no fail-open contract ships. Ratify.
- **Composite read-namespacing / `sampled` — NOT frozen (proposed);** rides the experimental config/handle carve-out
  (refinement-todo:462-466). Ratify.
- **Enforcement shape.** `test/contract-stability.test.js` is today a literal-substring guard over `capability.d.ts` +
  `connector.d.ts`. Ratify whether the net-new guards follow that shape (substring-pin `seams.d.ts`; a
  boot/handle-shape assertion — the installed handle's method set — via a runtime shape test or a doc-pin) and where
  the push-api void contract is pinned (it is behaviorally in `test/push-contract.test.js`; the freeze may add a
  handle-shape assertion). Keep it additive (the existing guards unchanged).
- **Documented residual (not a blocker): `seams.d.ts` freezes on a single implementation per driver type.** No second
  decision-source or egress driver has ever been written against the seam interface, so its second-implementer fitness
  is unvalidated at 1.0 — the ADR should record this honestly (freezing the interface as proven-for-one, not
  proven-general) rather than imply battle-tested generality.

**Acceptance Criteria (ratified at the frame-critique + arch review):**

1. **The capstone ADR** (authored + accepted via `adr-workflow`) records the 1.0 contract: the FROZEN surface (the five
   documented contract surfaces — GA4-MP, push-api, `connector.d.ts`, `capability.d.ts`, `seams.d.ts` — plus the adopter
   boot layer: `bootEdsAnalytics()` + `boot(config)` and the installed handle shape), the EXPERIMENTAL carve-out (the
   instrumentation-config schema + the per-connector handle variance + `composite.accepts` + host-internal `reconcile`),
   and the three rulings (accepts internal, reconcile host-internal, read-namespacing/`sampled` unfrozen). References —
   not re-litigates — ADRs 0002/0003/0004/0006/0007/0010/0016. **The ADR states crisply that `boot(config)`'s freeze
   covers the ENTRYPOINT (it exists, returns the frozen handle shape) but NOT its `config` argument's schema (the
   experimental carve-out)** — so the composite adopter is told exactly what is stable (the call + the handle) vs
   evolving (the config), and the frozen-set listing does not over-read. It also notes the egress surfaces are
   post-OQ10 (ADR-0004) / ADR-0010 — see AC2.
2. **Reconcile EVERY frozen file to present-tense-as-of-1.0 by a COMPLETE per-file READ-THROUGH — greps are backstops,
   not the completeness mechanism.** Five frame-critique rounds each found a stale disclaimer of a NEW form/location
   (r1 seams `provisional`; r2 field docstrings; r3 header "DEFERRED" blocks + README rows; r4 bare `deferred`
   [decisions 012-03]; r5 the "seal is unbuilt / NOT ENFORCED in MVP2 / grant resolver is MVP3" family) — proving a
   phrase-blocklist grep is structurally incomplete for contracts that accreted MVP-relative staging language across
   30+ specs. So the mechanism is a **positive read-through**: the implementer reads EACH frozen-surface file in full
   (`contracts/seams.d.ts`, `connector.d.ts`, `capability.d.ts`, `push-api.md`, `ga4-mp.md`, `contracts/README.md` —
   headers + every docstring + index rows + deferred table) and classifies **every** forward-looking / staging /
   MVP-relative / deferral claim as either **(strip/reword to present tense)** if the thing has SHIPPED, or **(explicit
   "NOT FROZEN at 1.0" carve-out)** if genuinely open. **When it is unclear whether something shipped, CARVE OUT — never
   strip** (over-stripping makes the 1.0 contract *overclaim* stability, the more dangerous error; the labeled carve-out
   is the safe default). The verification GATE is: (gate-1, the completeness guarantee) a reviewer read-through confirms
   no un-carve-out staging claim remains; backed by (gate-2, a backstop) greps **scoped to exactly the frozen
   read-through file set** (NOT the whole repo — else the legitimately-unfrozen `pixel-connector.d.ts`, the config
   schema's own "PRE-1.0" self-declaration, and MVP references in specs/tests would fire) that return **no STRIP-class
   hit** — the OQ family (`OQ7|OQ9|OQ10|OQ11`), the deferral family (`deferred|sketch|finalized|provisional|for now|not
   exposed|do not rely|crosses as-is|only async|intentionally absent`), and the staging family
   (`unbuilt|not enforced|nothing gates|MVP1 only|MVP2|MVP3|not the teeth|disclosure only`). (The 2b carve-out survivors
   are labeled "NOT FROZEN" prose the read-through verifies, not necessarily grep-matched — e.g. the OQ3 carve-out is
   not in the OQ-family pattern; the greps only prove no KNOWN strip-form slipped.) Known stale-about-shipped
   instances to fix (a STARTER list for the read-through, NOT the whole list):
   - **OQ7** inspector (spec 028): `seams.d.ts:69`.
   - **OQ9 sync-ACCESS** SHIPPED (012-01, `capability.d.ts` sync :90-93): the "sync … is OQ9 and is intentionally
     absent" (:63-64) + header "not exposed here yet" + `README.md:20,:66` "only async".
   - **OQ10** egress dispatch RESOLVED (ADR-0004; `caps.egress.dispatch` ADR-0010): `seams.d.ts:15/:18/:52`,
     `connector.d.ts:22/:59/:69`, `capability.d.ts:21-22`, `README.md:19-21,:67`.
   - **OQ11** payload governance RESOLVED (ADR-0012/019-01): `connector.d.ts:24-26/:41-42`, `capability.d.ts:23-24`
     ("denylist deferred" — the denylist SHIPPED; only the OQ3 allowlist-tightening remains), `push-api.md:107`,
     `README.md:19,:68`.
   - **decisions-as-data** FINALIZED (012-03): `capability.d.ts:55` + header :25-26, `README.md:20`.
   - **the seal** SHIPPED + ENFORCING (017-03 seal-hold / 020-02 `egressVerdict` / 022): `connector.d.ts:97-101,:131-135`
     ("DECLARED, NOT ENFORCED in MVP2 … the grant resolver … is MVP3 … the seal is unbuilt"), `capability.d.ts:162-165`
     ("lands the gate-able surface, NOT the teeth — the seal itself is unbuilt"). Reword to the true post-017-03/020-02
     state (the seal gates egress on the declared purposes today); if a finer per-I/O host-policy grant resolution
     genuinely remains open, make it an explicit 2b carve-out, NOT "unbuilt".

   The read-through is what makes completeness real; the greps only prove no KNOWN form slipped. THEN add the
   **contract-stability guards for the net-new frozen surfaces**, additive to `test/contract-stability.test.js`
   (the existing `capability.d.ts`/`connector.d.ts` pins unchanged — confirm the AC2 rewords are DISJOINT from the
   pinned substrings: the pins target the type/grant-law text, not the disclaimer comments, so a present-tense reword
   cannot alter a frozen type's documented meaning): `seams.d.ts` (the `DecisionSourceDriver`/`EgressDriver`
   + their request/result type text), and the **adopter boot/handle shape** (the two `window.airlock`-installing
   entrypoints + the frozen handle method set) — the guard mechanism is proven: `contract-stability.test.js` already
   reads runtime `.js` source + regex-asserts shape (`:193-210`), and the `eds-boot` suites boot the composite + inspect
   `window.airlock`. The `push()`/`pushCritical()`→void contract is pinned (behaviorally in `test/push-contract.test.js`,
   + a handle-shape assertion if ratified).
2b. **Still-OPEN deferrals inside the frozen surfaces are CARVED OUT, not stripped (like the config schema) — the ONLY
   permitted grep survivors.** **OQ3** (vendor-neutral event schema) is genuinely open (`refinement-todo:22`, not
   struck): freeze `AirlockEvent.payload` as a `Readonly<Record<string, unknown>>` **pass-through property** but state
   its **shape/schema is NOT frozen** (`connector.d.ts:44` "site-defined shape (OQ3)", `push-api.md:97` "OQ3 emergent
   schema" stay LIVE). The **multi-chamber sync-COHERENCE** OQ9 sub-axis (`capability.d.ts:87-88` "the remaining OQ9
   axis"; the header residual at `:17`/`:20` re-pointed to coherence-only) stays a named residual: the single-chamber
   `sync` surface is frozen (proven, 012-01), multi-chamber coherence is not. The ADR names both as explicit not-1.0
   aspects, mirroring the config carve-out. (These two — reworded to "not frozen", not "deferred/provisional" — are the
   only disclaimers the AC2 grep gate permits to survive.)
3. **`composite.accepts` resolved per the ruling.** If physical removal: the installed `window.airlock` handle no longer
   exposes `accepts`, the alloy exposure reporter routes through an internal predicate, and a test asserts `accepts` is
   NOT on the installed handle (while the alloy-only-exposure drop+diagnose behavior from 034-03 stays green). If
   document-only: a pin/note records it unfrozen. Either way the frozen handle contract excludes `accepts`.
4. **The experimental config carve-out is explicit + unguarded.** `contracts/instrumentation-config.schema.json` keeps
   its "PRE-1.0, NOT frozen" self-declaration; NO contract-stability guard freezes the config schema; the ADR +
   `docs/architecture.md` name it explicitly not-1.0. (`contracts/validate.mjs`'s data-shape fixture check on the config
   is fine — that is conformance, not a frozen-surface commitment.)
5. **Docs reconciled.** `docs/architecture.md`'s five-surfaces section references the accepted capstone ADR (the frozen
   set is now enforced); `docs/releases/mvp6.md`'s 1.0-pin item is marked shipped (API pinned; release cut deferred);
   `docs/refinement-todo.md` closes the `composite.accepts` flag (:547-549), the 032 read-namespacing/`sampled` deferral
   (:462-466, ruled unfrozen), the 035 reconcile-coupling input (~:94 iii, ruled host-internal), and the stale-comment
   residual :84(f) (connector.d.ts's OQ11 note — struck when AC2 corrects the comment).
6. **No-regression + no release cut.** `npm test` + `node build.mjs` + `contracts/validate.mjs` + `npm run lint` green;
   the existing guarded surfaces + the 034-03 exposure behavior unaffected; NO version bump / git tag / dist publish
   (owner decision — a separate later step).

**DoD:** all ACs pass; the capstone ADR is Accepted (its own `adr-workflow` frame-critique gate cleared); TDD where code
changes (the `accepts` resolution + the new guards red→green); reviewed (compliance + craft + **arch** [`arch_review: true`
— the surface freeze] + **frame-critique** [`frame_review: true`]); deviation log + reconciliation sweep; reconciliation
review; refinement-todo items closed; `docs/specs/README.md` + `docs/decisions/README.md` (ADR index) synced; board
synced. Spec 037 closes → MVP6 fixed core + 1.0 API pin complete.

### Deviation log

No deviations from the ACs or the design focus. Judgment calls made during implementation, recorded for
transparency (none blocked an AC; all reasoned from "carve-out over strip when unclear"):

- **Strip-vs-carve-out calls found close (resolved by re-grounding in the actual runtime, not just the ADR's
  summary):**
  - `EgressRequest.unloadCritical` (`connector.d.ts`) and `EgressDriver`/`SealedEgressRequest` (`seams.d.ts`):
    OQ10 (the overall dispatch/delivery model) is resolved per ADR-0004/ADR-0010, but a targeted grep of
    `core/airlock.js`/`core/connector-host.js` confirmed the connector-returned `EgressRequest.unloadCritical`
    boolean hint is declared but genuinely **not read** anywhere on the async `handle()` path (the real
    unload-critical route is the separate `pushCritical()` fast path). Reworded to state this precisely — "declared
    but not read" — rather than either leaving the stale "is OQ10" framing or overclaiming the runtime "honors" it.
  - `ConnectorPurposes`/`ConnectorManifest.purposes` (`connector.d.ts`) and the round-trip `egress.dispatch`
    docstring (`capability.d.ts`): confirmed the seal is genuinely SHIPPED and ENFORCING (017-03 GA4, 020-02 alloy,
    016-02 endpoint ceiling) — not "unbuilt" — but a deeper grep found the enforcement point reads each caller's
    OWN hand-declared `egressPurposes`/`endpointCeiling` config (`adapters/eds/index.js`), which MIRRORS but does
    not mechanically read the manifest's `purposes`/`endpoints` fields (a real, documented mirror-drift gap, same
    idiom as GA4's `DATA_USE_PURPOSES`). Reworded to say "enforced" + name the mirror precisely, rather than
    either the stale "unbuilt" claim or a new overclaim that the manifest field itself gates dispatch.
  - `capability.d.ts`'s `Decision.content` docstring ("Deferred detail") and `contracts/README.md`'s alloy
    "coverage gap" paragraph: not in the task's starter list, surfaced by the full read-through. Both were stale
    (the former implied more specificity was pending on an intentionally-permanent `unknown` type; the latter
    predated 033-02/033-03 shipping alloy config-wiring). Reworded present-tense per the same discipline.
- **`composite.accepts` removal + the "with-GA4 routing" behavioral flip:** landed as specified — physical removal
  from `createComposite`'s returned object, `boot()` rebound to a local `booted`-array predicate (byte-for-byte the
  same `acceptsEvent` logic, so a behavior-preserving refactor, not a new rule), the ~8 direct
  `window.airlock.accepts(...)` assertions across `test/eds-boot-config.test.js` and `test/eds-boot-alloy.test.js`
  flipped to behavioral push+observe equivalents, and two new tests assert `'accepts' in window.airlock` is
  `false` (one colocated in `eds-boot-config.test.js`, one as part of the new `contract-stability.test.js`
  boot/handle-shape guard). For the "with-GA4 routing" half specifically: rather than building new dual-worker
  (alloy + GA4) integration-test infrastructure, the existing hand-rolled `compositeEmit` stub convention already
  established in `eds-boot-alloy.test.js` (e.g. the AC7 end-to-end test) is relied on as-is, since it already
  behaviorally proves the routing claim and the `boot()` code change is a transparent refactor over the same
  predicate/array/helper the old `composite.accepts` used — building real multi-worker alloy+GA4 emulation would
  be a disproportionate lift for a slice whose scope is narrowing the public surface, not adding integration-test
  infrastructure. That test's stale comment (referencing "the real `createComposite.accepts` gate," a method that
  no longer exists) was corrected to reflect the new reality.

**Orchestrator note (post-review):** the arch review asked the `purposes` mirror-drift disclosure to spell out its
consequence for its actual audience — an external connector author who sets `manifest.purposes.egress` but does not
wire the parallel `egressPurposes` config gets NO purpose gate. Added that consequence sentence to
`connector.d.ts`'s `purposes` docstring (comment-only, disjoint from the pinned `readonly purposes?: ConnectorPurposes;`
line). Out-of-scope find (flagged, NOT fixed — not a frozen contract file): `connectors/alloy/connector.js:148-149`
carries the same stale "seal is unbuilt / MVP3" comment as the six frozen files did — recorded in `docs/inbox.md` as a
tiny doc-hygiene follow-on (an impl comment, not part of the 1.0 contract surface).

### Review dispositions (frame-critique + compliance + craft + arch — ALL PASS)

- **Frame-critique — PASS (6 rounds).** Each round found a real stale-disclaimer form (r1 seams/OQ10 → r2 field
  docstrings → r3 header blocks + README rows → r4 bare-`deferred` → r5 seal-staging), driving the reconciliation
  mechanism from phrase-enumeration to a **complete per-file read-through** (r6 ratified it approach-complete: a closed
  file set, greps as backstops).
- **Compliance — PASS.** All 6 ACs met; the read-through is complete (scoped grep → only carve-outs/resolved-refs);
  the boot/handle guard is non-vacuous. (Non-blocking: ADR-0017 doesn't explicitly cite ADR-0003/0016 — the intent
  holds, and the ADR is Accepted+immutable, so not edited.)
- **Craft — PASS.** The `accepts` rebind is byte-equivalent; the flipped tests are behavioral-and-stronger; the guards
  non-vacuous; the rewords comment-only + accurate; the two judgment-call rewords confirmed accurate, not overclaims.
  (Non-blocking: the dual-path alloy+GA4 `compositeEmit` integration gap is disclosed above; the AC2 grep-family lists
  OQ9 though OQ9-coherence is a legit survivor — spec-wording tidiness, the rewords are correct.)
- **Arch — PASS.** The frozen/experimental boundary is architecturally right; the `accepts` removal sound; the
  mirror-drift is a correctly-recorded residual (freeze pins the field SHAPE; egress IS gated via the mirror, so
  ADR-0006/0007 honored; the not-reading is additively fixable — no major break). Note-1 hardened (above).

### Reconciliation sweep

| Artifact | Disposition | Rationale |
|----------|-------------|-----------|
| `docs/decisions/adr-0017-airlock-1-0-api-contract.md` | `created` (Accepted) | The capstone 1.0 contract: frozen set / experimental carve-out / three rulings. Its own frame-critique gate cleared. |
| `docs/decisions/README.md` (ADR index) | `updated` | `adr.py index` added the ADR-0017 row (Accepted 2026-09-05) — already synced + committed. |
| `contracts/seams.d.ts` | `updated` | Read-through: OQ10/OQ7 stale staging → present tense; `unloadCritical` declared-but-not-read; guarded (new seams pins). Comment-only. |
| `contracts/connector.d.ts` | `updated` | Read-through: RESOLVED-vs-NOT-FROZEN split (OQ10/OQ11 resolved; OQ3 + coherence carved out); the seal + `purposes` mirror-drift reworded + the external-author consequence added. Comment-only (pins intact). |
| `contracts/capability.d.ts` | `updated` | Read-through: OQ9-sync (shipped) / OQ10 / OQ11 / decisions-012-03 → present tense; coherence + reconcile carved out. Comment-only (pins intact). |
| `contracts/push-api.md` | `updated` | Read-through: the OQ11 "do not rely on payload minimization" row → resolved (ADR-0012/019-01). |
| `contracts/README.md` | `updated` | Read-through: the index rows + deferred table reconciled (OQ9/10/11 resolved; the pre-033-02 alloy coverage-gap paragraph corrected). |
| `adapters/eds/index.js` | `updated` | `composite.accepts` removed from the installed handle; `boot()` rebinds `compositeEmit.accepts` to a local `booted` predicate (byte-equivalent). |
| `test/contract-stability.test.js` | `updated` | +new guards: `seams.d.ts` types + the exact-7-key boot/handle shape (both entrypoints; `accepts` absent). |
| `test/eds-boot-config.test.js`, `test/eds-boot-alloy.test.js` | `updated` | The ~8 `window.airlock.accepts(...)` assertions flipped behavioral; +a `'accepts' in window.airlock === false` regression; a stale AC7 comment corrected. |
| `docs/architecture.md` | `updated` | Five-surfaces section references ADR-0017; the config carve-out wording reconciled. |
| `docs/releases/mvp6.md` | `updated` | The 1.0-API-pin item marked SHIPPED (API pinned via ADR-0017 + guards; the release cut deferred, separate). |
| `docs/refinement-todo.md` | `updated` | Closed 4: the `composite.accepts` flag (:547), read-namespacing/`sampled` (:462, ruled unfrozen), the 035 reconcile-coupling (:94 iii, ruled host-internal), the stale-OQ11-comment residual (:84 f). |
| `docs/inbox.md` | `updated` | Parked the `connectors/alloy/connector.js:148-149` stale-comment follow-on (out of the frozen-contract scope) + the dual-path `compositeEmit` integration-test + the AC2 grep-family/OQ9 tidiness. |
| `contracts/instrumentation-config.schema.json` | `no-op` | AC4 — the config carve-out: keeps its PRE-1.0 self-declaration; NO guard freezes it. |
| `package.json` | `no-op` | AC6 — NO release cut (version stays 0.5.0; no tag; no dist). |
| SDD process records | `excluded` | This slice doc, `spec.md`, `docs/decisions/reviews/adr-0017-frame-critique.md`, the `reviews/slice-01-*.md` verdicts — review scaffolding, narrated here. |
| `docs/specs/README.md` (board) | `deferred` | Flips at the DONE transition. |

### Definition of Done — verification
- [x] All 6 ACs pass. The capstone **ADR-0017 is Accepted** (its own frame-critique gate cleared). **TDD red→green** for the code changes (the `accepts` removal + the new guards). `npm test`: **84 files, 1263 tests** (1256 baseline + 7 guards). `node build.mjs` OK; `node contracts/validate.mjs` all pass; `npm run lint` clean.
- [x] Every frozen file reconciled to present-tense-as-of-1.0 (scoped grep → only labeled carve-outs / resolved-refs); `composite.accepts` off the installed handle (exactly 7 frozen keys); the config schema carve-out unguarded; docs reconciled; **no release cut**.
- [x] Reviewed: frame-critique (6 rounds) + compliance + craft + **arch** all PASS. Deviation log + review dispositions + reconciliation sweep produced.
- [x] Reconciliation review PASSED; the **ADR index is already synced** (`docs/decisions/README.md` — `adr.py index`, committed); the board (`docs/specs/README.md`) syncs at the DONE transition.
