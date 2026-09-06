---
status: DRAFT
dependencies: []
last_verified:
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
   "NOT FROZEN at 1.0" carve-out)** if genuinely open. The verification GATE is: (gate-1) a reviewer read-through
   confirms no un-carve-out staging claim remains; backed by (gate-2) grep BACKSTOPS whose union must return only the 2b
   carve-outs — the OQ family (`OQ7|OQ9|OQ10|OQ11`), the deferral family (`deferred|sketch|finalized|provisional|for
   now|not exposed|do not rely|crosses as-is|only async|intentionally absent`), AND the staging family
   (`unbuilt|not enforced|nothing gates|MVP1 only|MVP2|MVP3|not the teeth|disclosure only`). Known stale-about-shipped
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
   (the existing `capability.d.ts`/`connector.d.ts` pins unchanged): `seams.d.ts` (the `DecisionSourceDriver`/`EgressDriver`
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
