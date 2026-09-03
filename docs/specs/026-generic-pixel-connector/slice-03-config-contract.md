---
status: DONE
dependencies: []
last_verified: 2026-09-02
frame_review: true
---

<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about
     runnable surfaces by probe first (run it / read source) or a citation. -->

## Slice 026-03 — the config contract (`PixelVendorConfig`): pin + validate + conformance

**Goal:** Pin the **`PixelVendorConfig`** type — the documented, validated contract that formalizes 026's proven
"one connector + N configs" archetype — **descriptively** from the SHIPPED interpreter
(`connectors/pixel/connector.js:73-82` destructures the exact config surface) and 026-02's grounded findings
(esp. `eventMap` value = **`string | null`**). Add a `validatePixelVendorConfig()` guard that rejects a malformed
config with a **clear, actionable error** (a config author's real footgun-catcher), and prove the **three shipped
configs** (Meta / LinkedIn / Bing) conform. This is the **Rules** axis that CLOSES 026's proven core.

> **Scope: a DESCRIPTIVE contract of shipped behavior + a validator — ZERO runtime-behavior change.** The type +
> validator are **additive**; `createPixelConnector` keeps interpreting exactly the same fields (its diff stays
> empty). **Identity / advanced-matching + the POST/`ctx`-body wire shape are OUT → 026-04** (real-driver-gated,
> security-critical PII handling the connector was deliberately designed without — the AC8 identity-free invariant
> both 026-01/02 reviews praised; and no real POST pixel exists, per 026-02). Building them speculatively is the
> "theoretical tool" the maintainer rejected — this slice does not.

**DoR (grounded 2026-09-02):**
- ✅ **The exact config surface the interpreter reads (source-grounded, `connectors/pixel/connector.js:73-82`):**
  `{ name?, endpoint, eventMap, paramMap, egressPurposes?, endpoints?, capabilities? }`. `handle()` interprets
  `paramMap` entries as `{ from: "static", value } | { from: "event" } | { from: "params", key }`
  (`connector.js:136-144`); `eventMap[type]` is the per-event value, `null`/absent → the event is omitted
  (`:127`, `:142`). The contract **describes this**, it does not invent a new DSL.
- ✅ **The three shipped configs to conform** (`connectors/pixel/vendors/{meta,linkedin,bing}.js`) — the contract
  must validate all three (proving it describes the REAL archetype, not a divergent ideal). LinkedIn's
  `eventMap: { page_view: null }` is the `string | null` proof case (026-02).
- ✅ **The contract style to mirror:** `contracts/connector.d.ts` (the `ConnectorManifest` type + JSDoc
  conventions); the validator mirrors `core/payload-governance.js`'s pure, import-free style.
- ⚠️ **Descriptive-accuracy bet:** the contract + validator must match the interpreter's ACTUAL reads. If pinning
  surfaces a field the interpreter reads but the contract misses (or a validator check stricter/looser than the
  interpreter), that is a **finding** — the contract is grounded against `connector.js`, not assumed.

**Acceptance Criteria:**

1. **`PixelVendorConfig` type pinned** (e.g. `contracts/pixel-connector.d.ts`): a documented type capturing the
   shape `createPixelConnector` interprets — `name?`, `endpoint: string`, `eventMap: Record<string, string | null>`
   (the `string | null` finding, with the `null`-omits idiom documented **first-class**), `paramMap:
   Record<string, PixelParamSpec>` where `PixelParamSpec = { from: "static"; value } | { from: "event" } |
   { from: "params"; key }`, `egressPurposes?: ConsentPurpose[]`, `endpoints?`, `capabilities?`. **Descriptive of
   the shipped interpreter** (matches `connector.js:73-82,136-144`), not aspirational. Wire method: **GET** (POST
   → 026-04, noted in the type's JSDoc).
2. **`validatePixelVendorConfig(config)` guard** (e.g. `connectors/pixel/validate.js`): pure, import-free; returns
   `{ valid: boolean, errors: string[] }`. Catches a config author's real mistakes — missing/empty `endpoint`; a
   non-object `eventMap` or a non-`string|null` value; a `paramMap` entry with an unknown/missing `from`, or
   `from:"static"` without `value` / `from:"params"` without `key`; a non-array `egressPurposes`. Each error is
   **specific + actionable** (names the offending field/key). **The validator is deliberately STRICTER than the
   interpreter** (which fails soft — `connector.js:143,146` `String()`s any scalar / tolerates a missing
   endpoint) — its job is to catch a config author's mistake at authoring time; the JSDoc states this so a reader
   never mistakes the type for "what runtime tolerates."
3. **The three shipped configs conform.** `validatePixelVendorConfig` returns `{ valid: true }` for Meta,
   LinkedIn, and Bing (a per-vendor test) — proving the contract DESCRIBES the real archetype (incl. LinkedIn's
   `eventMap: { page_view: null }`).
4. **Malformed configs are rejected with clear errors (the guard's real value).** Table-driven: a config missing
   `endpoint`, an `eventMap` with a non-`string|null` value, an unknown `paramMap` `from`, a `from:"params"`
   without `key`, a non-array `egressPurposes` → each fails with a specific error naming the field. Proves the
   guard is non-vacuous.
5. **Descriptive, not new behavior — ZERO change to the INTERPRETER or core.** `git diff
   connectors/pixel/connector.js` AND `git diff core/` are **empty** — the type + validator are additive
   (`contracts/` + `connectors/pixel/validate.js` + tests); the connector interprets the same fields it always
   did. **Scope note (frame-critique):** the empty-diff constraint is on the **interpreter** (`connector.js`) +
   `core/` ONLY — the vendor config files (`connectors/pixel/vendors/*.js`) MAY be touched, and AC6 requires it
   (the stale "deferred to 026-03" comments). The validator's REQUIRED exercise is AC3's conformance run against
   the three real configs (a standing harness), not an optional adapter call.
6. **Coverage bound + deferred axes documented; stale forward-refs corrected.** The type's JSDoc + this slice
   state the honest bound: **GET wire-protocol pixels only**; **no identity/advanced-matching** (→ 026-04,
   real-driver-gated); the archetype covers config-shaped wire-protocol GET pixels — a *subset* of martech
   (R-007 / ADR-0014's coverage honesty), not "everything." **AND fix the fossil forward-refs** (frame-critique):
   `connectors/pixel/vendors/{meta,linkedin,bing}.js` each say advanced-matching is "deferred to **026-03**" —
   the re-decomposition moved it to **026-04**; correct all three (they are config files, not the interpreter, so
   permitted by AC5).
7. **No live identifiers.** The type's examples + validator tests use synthetic values.

**DoD:**
- [x] `PixelVendorConfig` type (`contracts/pixel-connector.d.ts`) + `validatePixelVendorConfig()`
      (`connectors/pixel/validate.js`) + conformance tests (3 shipped configs) + rejection tests (malformed) +
      the coverage-bound docs, **TDD**.
- [x] All 7 ACs proven by **targeted** tests (`test/pixel-config-contract.test.js`, 22) — the type matches the
      interpreter (AC1, grounded field-by-field, review-confirmed), the validator rejects/accepts correctly
      (AC2/AC4, incl. the review-hardened non-`string|number` static-value reject), the 3 configs conform (AC3),
      the empty connector/core diff (AC5), fossils fixed (AC6).
- [x] `npm run lint` clean; **targeted** vitest green (1002+ non-oracle); **no live identifiers**.
- [x] **Frame-critique PASS recorded** — `reviews/slice-03-frame-critique.md` (first-pass PASS: the identity/POST
      deferral is a settled/justified decision, the contract is descriptive not fiction, the validator is a real
      config-author guard).
- [x] Compliance + craft reviews recorded (both PASS with nits → the two cheap nits applied); close-out
      `### Deviation log` + `### Reconciliation sweep` below; the identity/advanced-matching + POST/`ctx`-body axes
      remain named + real-driver-gated for 026-04.

**Anti-horizontal-phasing check:** 026-03 is **vertical for its user — the config author** (a developer adding a
pixel vendor): the `validatePixelVendorConfig` guard turns a silent mis-map into a clear, actionable error at
authoring time (the user-facing behavior), and the type documents the shape. It is not type-only infra — the
validator is a real guard, proven non-vacuous by the reject-tests, and its accuracy is anchored by validating the
three REAL shipped configs. It CLOSES the archetype (Path → Data → **Rules**) as a documented, checkable contract,
with the speculative/security-critical expansions (identity, POST) honestly deferred to a real driver.

### Deviation log

- **`PixelParamSpec` `from:"static".value` is typed `string | number` — a disclosed authoring narrowing stricter
  than BOTH the interpreter (which `String()`s any scalar, `connector.js:143`) and, in the first draft, the
  validator (presence-only).** Both review passes flagged the type↔validator gap; **review-hardened:** the
  validator now rejects a non-`string|number` static value (`validate.js`), closing the `value:{}` →
  `"[object Object]"`-in-a-URL footgun it exists to catch, and the type's JSDoc no longer overstates `number`
  usage (no shipped config uses one; it is supported-but-unused). Type ↔ validator now agree; the interpreter
  stays deliberately looser (soft `String()`), as documented.
- **AC5's embedded `git diff` tests are a weak *standing* guard** (both reviews): `git diff -- <path>` is
  working-tree-vs-index, so post-commit they are green-by-construction regardless of a committed interpreter
  change, and they couple the unit suite to VCS/cwd state. The **durable** proof that this slice left the
  interpreter untouched is the **additive file structure** (the type + validator are new files) + the grep
  showing `validatePixelVendorConfig` is imported only by the test (never `connector.js`/`core/`) + the
  orchestrator's external empty-diff confirmation. Kept as a dev-time belt; noted as not the load-bearing guard.
- **The validator is intentionally silent on `endpoints`/`capabilities`/`name` type errors** (spec-omitted, AC2's
  named checks only) — a candidate hardening if those footguns surface; recorded, not built (YAGNI).

### Reconciliation sweep

- **Question answered + Outcome:** the `PixelVendorConfig` type + `validatePixelVendorConfig()` **pin 026's proven
  archetype as a documented, validated, author-facing contract** — descriptive of the shipped interpreter
  (verified field-by-field by both review passes), conformed by all three shipped configs (incl. LinkedIn's
  `eventMap: { page_view: null }`), with a non-vacuous reject guard. **ZERO interpreter/core change** (connector.js
  + core/ + the pinned contracts diffs all empty). This CLOSES 026's Rules axis.
- **Promoted, no orphans:** the identity/advanced-matching + POST/`ctx`-body axes stay **named + real-driver-gated
  for 026-04** (security-critical PII handling / a nested-body vocabulary the connector was deliberately built
  without — no driver yet). The `build.mjs` bundle-entry (pixel + dom-chamber workers) stays tracked in
  `docs/inbox.md` for the live-shippability slice. The 3 vendor configs' stale "026-03" identity forward-refs
  were corrected to "026-04" (AC6).
- **Downstream named:** 026-04 (identity/advanced-matching + POST/body, real-driver-gated); the `build.mjs`
  live-shippability step. No dependency left dangling.
- **No live identifiers, no new dependency, zero interpreter/core code.**
