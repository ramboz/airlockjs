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
2. **Reconcile EVERY frozen surface's stale now-resolved-OQ self-disclaimers BEFORE guarding — a grep-gated COMPLETE
   sweep, not a hand-enumerated line list** (r1→r2→r3 kept finding missed spots: the inline field docstrings, then the
   file-header "DEFERRED" summary blocks, then the `README.md` index rows — so completeness must be *verifiable*, not
   enumerated). A frozen file must never self-disclaim "provisional / deferred / sketched / not exposed /
   do-not-rely / intentionally absent" about something that has SHIPPED. Sweep ALL frozen-surface files —
   `contracts/seams.d.ts`, `connector.d.ts`, `capability.d.ts`, `push-api.md`, `ga4-mp.md`, and `contracts/README.md`
   (header blocks + inline docstrings + index rows + the deferred table) — and STRIP/correct every disclaimer tied to a
   RESOLVED question or a SHIPPED surface:
   - **OQ7** (inspector) — RESOLVED, spec 028/`refinement-todo:40`: the stale `(OQ7)` pointer at `seams.d.ts:69`.
   - **OQ9 sync-ACCESS surface** — SHIPPED (`capability.d.ts` `sync.readSync/writeSync` :90-93, 012-01): the "sync … is
     OQ9 and is intentionally absent here" (:63-64) + header "not exposed here yet" claims + `README.md:20,:66` "only
     async". (The multi-chamber-COHERENCE OQ9 sub-axis is the one carve-out survivor — 2b.)
   - **OQ10** (egress dispatch/delivery) — RESOLVED, ADR-0004 (`caps.egress.dispatch` by ADR-0010/014-01): the header
     "not the send" (`capability.d.ts:21-22`, `connector.d.ts:22`) + inline "provisional on OQ10" (`seams.d.ts:15/:18/:52`,
     `connector.d.ts:59/:69`) + `README.md:19,:20,:21,:67`.
   - **OQ11** (payload read-governance) — RESOLVED, ADR-0012/019-01 (`refinement-todo:80,84(f)`): `connector.d.ts:24-26`
     ("crosses as-is") + `:41-42` ("MVP1 only … deferred to MVP2"), `capability.d.ts:23-24`, `push-api.md:107`,
     `README.md:19,:68` (the `capability.d.ts:23-24` note reads "a denylist model is deferred" — the denylist SHIPPED
     (019-01); only the OQ3 allowlist-tightening remains, so reword to that, do not leave it "deferred").
   - **decisions-as-data** — FINALIZED, slice 012-03 (`capability.d.ts:27/:131-133`): the stale "deferred"/"sketched"
     disclaimers at `capability.d.ts:55` ("wrapped-SDK; deferred") + the header (:25-26 "sketched") + `README.md:20`
     ("decisions-as-data sketched"). NOT OQ-tagged — caught by pass (b) below, not the OQ-grep.
   **Verification gate — TWO complementary passes (an OQ-grep alone is insufficient — r4):** (a) an **OQ-grep** over the
   frozen files (`OQ7|OQ9|OQ10|OQ11|provisional|do not rely|not exposed|not the send|crosses as-is|only async|
   intentionally absent|MVP1 only|deferred to MVP2`) returns ONLY the permitted still-open survivors (2b); AND (b) a
   **`deferred|sketch|finalized|for now` classification pass** over the same files — a pure grep can neither catch bare
   "deferred/sketched" (`:55` decisions carries no OQ term) nor tell stale-about-shipped from legitimately-open, so EACH
   such hit is hand-classified: **strip/reword** if it disclaims a SHIPPED surface (decisions 012-03 at `:55`/header/
   `README:20`; the OQ11 denylist at `:24`), **keep** if genuinely open (the 2b carve-outs) or plain historical prose
   (`capability.d.ts:132` "the deferred `fetch` sketch is reconciled", `README:56` alloy config "deferred to its own
   spec", `push-api.md:105` dropped-ACDL listeners). Freeze/guard is gated on BOTH passes clean — no disclaimer about a
   resolved question OR a shipped surface survives in a frozen file.

   THEN add the **contract-stability guards for the net-new frozen surfaces**, additive to `test/contract-stability.test.js`
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
