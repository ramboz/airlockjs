---
status: Accepted
dependencies: []
last_verified: 2026-09-04
frame_review: true
---

# ADR-0016: Stock alloy bundle: adopter-supplied `bundleUrl`, same-origin recommended

## Status

Accepted (2026-09-04)

## Context

To boot **Adobe/alloy** via `boot(config)` on a *buildless* EDS site (spec 033), the classic alloy chamber worker
`importScripts` the ~766 KB stock **Adobe Experience Platform Web SDK** (`@adobe/alloy`, byte-pinned per AD-7 at
**v2.35.0**). The 033-01 spike proved this *loads* under the enforced EDS boilerplate CSP once the worker installs its
own Trusted Types policy. That leaves the distribution question: **does airlock ship the stock bundle, and from what
origin is it loaded?**

**Two origin questions, not one — the load-bearing correction.** These are distinct and must not be conflated:

1. **The worker-script URL** (`new Worker(url)` — airlock's own `alloy-chamber.worker.js`): 004-01 requires this to be
   **same-origin** (the served-`dist` story; `build.mjs` asserts same-origin file URLs, no `blob:`/`data:`). Not at
   issue here — the airlock worker ships in `dist` like the other four.
2. **The URL the worker `importScripts` for the stock bundle:** the 033-01 spike **proved by probe that this admits
   BOTH same- and cross-origin** once the worker's TT policy is installed (`probes/alloy-csp-spike/probe2.mjs`:
   `cross_origin_importscripts_admitted_after_tt_fix`; spike finding #2: *"the 766 KB stock bundle need NOT be
   same-origin"*). So the **bundle's origin is a free design choice**, not a constraint — under `'strict-dynamic'`
   host-source allowlists are ignored, so the boilerplate CSP admits either.

**Grounding (probes, 2026-09-04).** `@adobe/alloy@2.35.0` is **Apache-2.0** (`probes/alloy-worker/package-lock.json`) —
redistribution is *permitted* (with §4 attribution), so this is **not** a licensing prohibition. Cross-origin
`importScripts` of the bundle is **green** under the boilerplate CSP (the probes above). With both the licensing-fear
and the same-origin-requirement premises removed, the honest option space is wider than "ship it vs. vendor it
same-origin," and the decision splits into two sub-questions: **(D1)** does airlock *ship/bundle* the stock SDK? and
**(D2)** for an adopter-supplied bundle, what *origin* does airlock recommend?

## Decision Options Considered

### Option A: airlock ships/bundles the stock SDK (a served `dist` artifact)
- **Pros:** zero adopter setup; airlock guarantees the exact byte-pinned version (provenance).
- **Cons:** airlock carries Apache-2.0 **LICENSE + NOTICE + attribution** for a third-party blob in every release and
  re-ships on every alloy bump (compliance + maintenance surface for code it does not author); **couples adopters to
  airlock's alloy cadence, not Adobe's**; **bloats the baseline `dist`** for the majority of adopters who never run
  alloy, breaking 031's lean/connector-agnostic property.

### Option B: adopter supplies it, **same-origin** (`bootAlloy({ bundleUrl })` → a vendored same-origin path)
- **Pros:** no redistribution obligation on airlock; **the adopter holds + byte-pins the exact bytes** that run on
  their origin (supply-chain integrity — the core airlock confinement property); **most CSP-portable** (a same-origin
  path survives adopter CSP variations — a stricter `script-src`/`worker-src`/`trusted-types` policy — that a
  third-party origin may not); no third-party runtime dependency on the page's critical path.
- **Cons:** one documented prerequisite (vendor `alloy.js` + set `bundleUrl`); the adopter owns version-tracking
  (airlock pins the *API contract* it drives — `configure`/`sendEvent` — not the bytes; mitigated by a tested floor).

### Option C: adopter supplies it, **cross-origin from Adobe's CDN** (`bootAlloy({ bundleUrl })` → an Adobe CDN URL)
*(the option the earlier same-origin-only framing wrongly excluded)*
- **Pros:** **lowest friction — zero vendoring, nothing to serve same-origin**; no redistribution by anyone; tracks
  Adobe's cadence directly.
- **Cons:** **no byte-pin — the origin executes whatever the CDN serves at load time** (a CDN compromise or silent
  bump runs live in the chamber); runtime executable third-party code is exactly what airlock's confinement model
  exists to discipline; **less CSP-portable** (a stricter adopter CSP is likelier to block a third-party script
  origin than a same-origin path); a third-party request + availability coupling on the boot path.

### Option D: opt-in **airlock-hosted** artifact (separately pulled; the steelman of "airlock provides it")
A distinct, separately-installed `dist` artifact (not in the baseline install), so non-alloy adopters carry no bloat.
- **Pros:** convenience of A without baseline bloat; provenance guaranteed.
- **Cons:** airlock still carries the Apache-2.0 attribution + re-ships on every bump; still couples to airlock's
  cadence; a second install path to document + test. **Deferred**, not chosen — it is the natural reversal path if
  Option B's prerequisite proves too high-friction across adopters.

## Recommended Decision

1. **(D1) airlock does NOT ship or bundle the stock SDK.** Option A is rejected — the attribution/maintenance +
   cadence-coupling + baseline-bloat costs hold **regardless of load origin**, and 031's lean/connector-agnostic
   `dist` is worth preserving.
2. **The config surface is `bootAlloy({ bundleUrl })`** — an **adopter-supplied** URL (the spike's design). airlock's
   own `alloy-chamber.worker.js` still ships in `dist` (same-origin, per 004-01); only the *stock bundle it loads* is
   adopter-supplied.
3. **(D2) airlock RECOMMENDS a same-origin, byte-pinned vendored copy (Option B)** — the documented default — on
   **supply-chain-integrity (AD-7 / the confinement model) + CSP-portability** grounds, and **SUPPORTS cross-origin
   (Option C, e.g. Adobe's CDN)** as an explicit, documented adopter opt-in with the integrity/CSP trade-off stated.
   airlock does not *forbid* cross-origin — it defaults to the choice that matches its reason for existing (the
   adopter controlling exactly which vendor bytes execute on their origin), while leaving the lower-friction path open.

The recommendation deliberately does **not** rest on the (false) same-origin *requirement* or the (defused) licensing
*prohibition*; it rests on integrity + portability, which is where airlock's value actually lies.

## Consequences

**Becomes easier:**
- airlock's baseline `dist` stays **lean + connector-agnostic**; **no Apache-2.0 redistribution obligation** accrues
  to it.
- Adopters **track Adobe's cadence** and, on the recommended path, **hold + byte-pin the exact bytes** that run —
  the strongest supply-chain-integrity posture, consistent with the airlock model.
- Adopters who prefer lowest-friction can point `bundleUrl` at Adobe's CDN with eyes open to the trade-off.

**Becomes harder:**
- alloy adopters have a documented prerequisite (`bundleUrl` + a vendored file on the recommended path).
- airlock does not guarantee the exact alloy version — it pins the driven **API contract**; version-skew risk shifts
  to the adopter (mitigated by a documented tested floor, v2.35.0, and byte-pinning per AD-7 becoming the adopter's).
- Two supported load origins means **two documented paths** (with their trade-offs) rather than one.

## Assumptions

- **`@adobe/alloy@2.35.0` is Apache-2.0** — redistribution permitted with §4 attribution (probe:
  `probes/alloy-worker/package-lock.json`, 2026-09-04). The decision stands on integrity/coupling/bloat, not on a
  licensing prohibition (shipping would be *permitted*).
- **Cross-origin `importScripts` of the stock bundle is admitted under the boilerplate EDS CSP** once the worker
  installs its TT policy — **grounded** by the 033-01 probes (`probe2.mjs`/`probe3.mjs`; spike finding #2), not
  assumed. This is what makes Option C real and D2 a genuine choice.
- **Same-origin is the more CSP-portable default** — reasoned: `'strict-dynamic'` ignores host allowlists (so the
  boilerplate admits either origin), but real adopters vary the CSP, and a same-origin path survives more variations
  (stricter `script-src`/`worker-src`/`trusted-types <names>`) than a third-party origin. Partially grounded (the
  boilerplate case is probed; the stricter-adopter case is inference).
- **AEP/EDS sites often already load alloy** (Adobe tags / a datastream) — an industry-pattern assumption; if false
  for an adopter it only reduces the reuse upside, not the decision.

## Kill criteria

- If **same-origin vendoring is broadly infeasible** for the EDS adopter base (their platform forbids adding static
  assets / same-origin serving), the **D2 recommendation flips to cross-origin (Option C) as the default** — a
  documentation/recommendation change, *not* a reversal of D1 (airlock still does not ship the bundle).
- If a real adopter's CSP **blocks same-origin `importScripts`** via a restrictive `trusted-types <names>` directive
  omitting the worker's policy name, the worker's policy name must be admitted (033-01 residual) — re-confirm on the
  live host in 033-02's proof.
- If adopter feedback shows the `bundleUrl` prerequisite is too high-friction on *both* origins, revisit **Option D**
  (an opt-in airlock-hosted artifact, carrying the Apache-2.0 attribution then).

## Open questions

- The exact default `bundleUrl` path + config field name (`vendor/alloy.js`, or a required explicit URL?), and whether
  docs ship a **versioned Adobe CDN URL** as the documented cross-origin example — **033-02's** to fix.
- Whether to provide a small **"fetch-and-vendor alloy" convenience helper** for adopters on the recommended path —
  deferred (not core).
