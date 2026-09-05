---
status: READY_FOR_IMPLEMENTATION
dependencies: [033-01]
last_verified:
arch_review: true  # extends the public boot(config) surface + the config schema to a new (wrapped-SDK) connector.
frame_review: true  # re-framed on the landed spike design + ADR-0016; a new connector governance-class in the seam.
---

<!-- jig self-defining vocabulary (soft, forward-only): expand each acronym on
     first use and link the term to docs/memory/glossary.md (or jig's lexicon). -->
<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about runnable
     surfaces by probe first (run it / read source) or a citation, else mark them
     as assumptions — never assert an unverified claim as fact. -->

## Slice 033-02 — build: config-boot alloy (the analytics vertical) — `{type:"alloy"}` in `boot(config)`

> **Reopened from DEFERRED (2026-09-04)** — 033-01 returned **GO** and **[ADR-0016](../decisions/adr-0016-alloy-stock-bundle-site-supplied.md)**
> (adopter-supplied `bundleUrl`; same-origin recommended, cross-origin supported) is Accepted. This slice is now the
> concrete build, **scoped by a SPIDR-Path split to the analytics vertical** (boot alloy from a config → one
> `sendEvent` → the intercepted interact dispatched). **Personalization / decisions-as-data → [033-03](slice-03-alloy-decisions.md)**
> (the follow-on vertical). Rationale: the combined build spans ~7 areas (worker CSP fix, adapter, dispatch,
> distribution, schema, consent, proof) across two independent user outcomes; the analytics vertical alone **closes
> MVP6's "GA4 + Adobe/alloy" config-surface gap** for the (dominant) analytics adopter.

**Goal:** make `boot({ connectors: [{ type: "alloy", bundleUrl, … }] })` boot Adobe/alloy through the wrapped-SDK
path for the **analytics** use — a `bootAlloy` adapter producing a composite-compatible handle; airlock's classic
alloy chamber worker fixed to load under the enforced EDS CSP and built as a 5th `dist` entry; the **adopter-supplied**
stock SDK loaded via `bundleUrl` (ADR-0016); `{type:"alloy"}` in the config schema + a golden fixture; the strict
seam consent gate; and an end-to-end proof (boot → one `sendEvent` → intercepted interact dispatched + ECID
write-back). Decisions-as-data (Target personalization) is explicitly **out of scope** → 033-03.

**DoR:**
- ✅ 033-01 **GO** (the recorded design) + **ADR-0016 Accepted** (the `bundleUrl` distribution decision).
- ✅ 032 DONE — `boot(config)` + `createComposite` + `bootConnector` + the config schema exist (the surface alloy plugs into).
- ✅ Extension points grounded (read 2026-09-04): `bootConnector(entry, governance, index)` is a `switch(type)`
  returning `{handle, events}` (`adapters/eds/index.js:965`); `KNOWN_CONNECTOR_TYPES` (`:862`); `createComposite` fans
  out via `acceptsEvent(events,name)` (`:775`,`:818`); `createWrappedSdkHost` returns `{init, driveEvent (single-slot,
  re-entry-guarded :440-445), getState}` — **no `dispose`, does not spawn the Worker** (`core/wrapped-sdk-host.js:429-454`);
  alloy `manifest.events = ["page_view"]`, `manifest.egress = ["analytics_storage","personalization"]`
  (`connectors/alloy/connector.js:95,121`); the strict gate is `egressVerdict(consent, egressPurposes, {strict:true})`
  (`core/wrapped-sdk-host.js:310`).

**Acceptance Criteria:**

1. **Worker CSP fix (the spike's ~4-line fix, productized).** `connectors/alloy/alloy-chamber.worker.js` installs its
   own Trusted Types policy and loads the stock bundle via `importScripts(policy.createScriptURL(bundleUrl))` (rather
   than the bare `self.importScripts` at `:377` that `fatal{phase:"load"}`s under a real CSP today). **PROOF:** a
   Playwright rig (promote the 033-01 probe shape into a real `rig:*`/test) loads the *built* classic alloy worker +
   a stub bundle under the enforced EDS boilerplate CSP and asserts it reaches `booted` (not `fatal{phase:"load"}`),
   with the 004-01 un-nonced-inline negative control. Regression: `has_dynamic_import === false` preserved (AD-7).
2. **`bootAlloy` adapter + a multi-event host.** `bootAlloy` (`adapters/eds/`) constructs the served classic alloy
   Worker (from the `dist` path) + triggers the **adopter-supplied** stock-SDK load via `bundleUrl` (ADR-0016;
   default a documented same-origin vendored path) + wires the caps (`egress.dispatch`, `cookies.reconcile`,
   `configIntegrity`, `endpointCeiling`, `consent`/`egressPurposes`) into `createWrappedSdkHost`, and returns a
   **composite-compatible handle** (`push`/`pushCritical`/`setConsent`/`dispose`/`getState`). **Two pieces the
   DoR-grounded host does NOT yet provide — both in scope for this slice:**
   - **N sequential events (host-side — ARCH-RELEVANT).** `createWrappedSdkHost.driveEvent` today dispatches its
     queued event **only on the one-time `phase:"configured"` message** (`core/wrapped-sdk-host.js:389`); a 2nd
     `driveEvent` on the retained chamber sets `queuedEvent` but is **never re-triggered → it hangs** (`:440-450`).
     033-02 **extends the host** so that post-`configured` `driveEvent` calls dispatch **immediately** (alloy is
     already configured) — enabling N sequential events, not just the one queued-on-configure event. This is a change
     to `core/wrapped-sdk-host.js` (the shared wrapped-SDK round-trip host) — **called out for the arch review**; it
     must not regress the existing single-event callers (the alloy rigs + `test/wrapped-sdk-host.test.js`; GA4 uses
     the separate fire-and-forget `core/chamber.worker.js` path, not this host).
   - **Adapter serialization + Worker ownership.** The adapter serializes `push`/`pushCritical`→`driveEvent` via a
     **sequential queue** so calls never overlap (the `driveEvent` re-entry guard at `:440-445` is respected — never
     two in flight), and **owns Worker construction + teardown** (`dispose()` terminates the Worker — the host has
     neither `dispose` nor Worker-spawn; honors the 021-01 dispose-no-leak invariant).
3. **`{type:"alloy"}` dispatch in `boot(config)`.** `bootConnector` gains a `case "alloy"` returning
   `{ handle: await bootAlloy({...}), events: ALLOY_MANIFEST_EVENTS }` (`["page_view"]`); `KNOWN_CONNECTOR_TYPES`
   gains `"alloy"`; entry validation requires `bundleUrl` (+ `datastream`/`edgeConfigId`). Consent is threaded via the
   connector's `manifest.egress` purposes (`analytics_storage` + `personalization`) into the host's `egressPurposes`
   with the strict `egressVerdict(strict)` seam gate (drop on a denied purpose). Composite fan-out is gated by
   `acceptsEvent` (alloy sees `page_view` only — no arbitrary site events leak to the interact).
4. **Distribution — 5th classic-IIFE `dist` entry (ADR-0016), incl. the build-assertion rework.** `build.mjs` emits
   airlock's classic alloy chamber worker via a **second esbuild `format:"iife"` call** — it **cannot** join the
   `format:"esm"` `WORKER_ENTRIES` call (it's a classic `importScripts` worker); the `core/`-rooted out-namer is
   generalized for a `connectors/alloy/`-rooted basename. **This is NOT just a second call + out-namer** (the earlier
   framing understated it): because `bootAlloy` (bundled into `eds.js`) references
   `new Worker(new URL("./alloy-chamber.worker.js", …))`, the build's **HARD-CONSTRAINT layout assertions must be
   reworked across BOTH build results** — the alloy specifier added to `EXPECTED_WORKER_SPECIFIERS`, its emitted
   output merged into `emittedBasenames` + the negative `blob:`/`data:`/`ajv` scans — **else the existing
   `build.mjs:124-137` sibling-resolution assertion FAILS** the moment `eds.js` carries that specifier. And
   `publish-dist.mjs`'s `DIST_ARTIFACTS` (derived from `WORKER_ENTRIES`, `:36-39`) must be **extended to include the
   alloy worker** — else it is omitted from the published `dist` and a consumer page **404s** it. The **stock bundle
   is NOT shipped** — `bootAlloy` loads it from `bundleUrl`; README documents the adopter-supplied prerequisite
   (same-origin recommended / cross-origin supported, per ADR-0016). The same-origin / no-`blob:` / no-`data:`
   invariant (004-01) is enforced for the alloy worker too — *by the reworked assertions*, not automatically.
5. **Config schema + docs.** `contracts/instrumentation-config.schema.json` gains the `{type:"alloy"}` branch in the
   discriminated union (required `bundleUrl` + `datastream`/`edgeConfigId`) + a **golden fixture** + a **negative
   fixture** (missing `bundleUrl`), wired into `contracts/validate.mjs`. README "Configure airlock" coverage line
   updated: alloy **analytics** now covered via the config surface (personalization tracked as 033-03).
6. **End-to-end proof (incl. the multi-event no-hang case).** A rig/test boots alloy from a `boot(config)` object,
   drives a `page_view`, and asserts the intercepted alloy **interact is dispatched via the seam** (+ ECID write-back
   through `cookies.reconcile`). It then drives a **second `page_view`** (the soft-nav case) and asserts **it too**
   reaches the seam — proving the AC2 host extension (no hang on event #2). Decisions-as-data delivery is explicitly
   out of scope (→ 033-03); the host continues to ignore `{type:"decisions"}` (no regression asserted).

**DoD:** all ACs pass; **TDD red→green**; reviewed (**compliance** + **craft** + **arch** [`arch_review: true` — new
connector on the public `boot(config)` + schema surface] + **frame-critique** [`frame_review: true`]); deviation log +
reconciliation sweep; reconciliation review; `docs/refinement-todo.md` alloy entry annotated (the **analytics**
config-surface gap CLOSED; personalization tracked as 033-03); board synced; **[ADR-0016](../decisions/adr-0016-alloy-stock-bundle-site-supplied.md)**
referenced for the `bundleUrl` distribution decision.

**Residual (carried forward — NOT retired here).** AC1/AC6's proof is **hermetic**: a *stub* bundle under the
*captured* boilerplate CSP. The **live-host Trusted-Types re-confirm + the real ~766 KB alloy bundle boot** (a
restrictive live-host `trusted-types <names>` directive is the only residual CSP risk — 033-01 Outcome + ADR-0016
kill-criteria) is a **deploy/creds-gated** step, tracked as a follow-up (like the 013 live-alloy re-probe). This slice
does **not** claim to retire it — the hermetic proof establishes the mechanism, not the live-host + real-bundle boot.
