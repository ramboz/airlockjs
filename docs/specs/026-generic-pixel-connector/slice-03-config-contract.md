---
status: DRAFT
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
- [ ] `PixelVendorConfig` type + `validatePixelVendorConfig()` + conformance tests (3 shipped configs) + rejection
      tests (malformed) + the coverage-bound docs, **TDD**.
- [ ] All 7 ACs proven by **targeted** tests — the type matches the interpreter (AC1, grounded read), the validator
      rejects/accepts correctly (AC2/AC4), the 3 configs conform (AC3), the empty connector/core diff (AC5).
- [ ] `npm run lint` clean; **targeted** vitest green; **no live identifiers**.
- [ ] **Frame-critique PASS recorded** (`frame_review: true`) before REVIEWED — the pass on (a) the
      identity/POST deferral being sound (not a spec-scope violation), (b) the contract being genuinely
      descriptive of the shipped interpreter (not a divergent ideal), and (c) this being a vertical
      config-author-facing deliverable (the validator guard), not horizontal type-only infra.
- [ ] Compliance + craft reviews recorded; close-out `### Reconciliation sweep` + `### Deviation log`; the
      identity/advanced-matching + POST/`ctx`-body axes remain named + real-driver-gated for 026-04.

**Anti-horizontal-phasing check:** 026-03 is **vertical for its user — the config author** (a developer adding a
pixel vendor): the `validatePixelVendorConfig` guard turns a silent mis-map into a clear, actionable error at
authoring time (the user-facing behavior), and the type documents the shape. It is not type-only infra — the
validator is a real guard, proven non-vacuous by the reject-tests, and its accuracy is anchored by validating the
three REAL shipped configs. It CLOSES the archetype (Path → Data → **Rules**) as a documented, checkable contract,
with the speculative/security-critical expansions (identity, POST) honestly deferred to a real driver.
