# Real-site validation (spec 036 — CWV + supported-subset smoke)

> The consolidated run-procedure for the MVP6 adoption proof's two rigs:
> `rig/lh-live.mjs` (spec 036-01 — *"does adopting airlock preserve Core Web Vitals on a
> real EDS site?"*) and `rig/subset-smoke.mjs` (spec 036-02 — *"does the supported
> connector subset boot cleanly and emit conformant/present beacons on a real EDS
> page?"*, [below](#supported-subset-smoke-spec-036-02)). I (the implementer) build +
> mechanically prove both harnesses against the local testbed; **you (the operator) hold
> the creds and run them against your real site** — the same build/run split spec 013's
> live-Alloy rigs use (env creds, never handled here).

## Part 1 — CWV before/after (spec 036-01)

## Before you start (pre-flight)

A stale pre-034 built bundle under `probes/eds-testbed/scripts/airlock/` or `rig/out/`
would silently exercise old bytes (034-02:117). Rebuild fresh immediately before any
validation run:

```sh
node build.mjs
```

`rig/lh-live.mjs` also runs this itself for its **local dry-run** path — the rebuild
matters most here for **your own throwaway validation branch**, whose `scripts/airlock/`
tree you vendor via `git subtree` (see `README.md` § Install into an EDS site) and must
refresh the same way if you bump to a newer `dist-vX.Y.Z` before validating.

## PRIMARY recipe — query-gated single deployment

The harness (`rig/lh-live.mjs`) drives Lighthouse against **two URL variants of ONE
deployment** — same cache, same edge PoP, same content, same origin, so the only thing
that differs is whether airlock boots. This is what makes the acceptance band
meaningful: a **two-deployment** comparison carries a fixed CDN/edge/hostname bias the
[fallback](#fallback--two-deployments-band-withheld) below cannot get around.

### 1. Add the client-side gate (throwaway branch only)

On a **throwaway validation branch** (never merged, never shipped — this is scaffolding
for the measurement, not a production flag), wrap **BOTH** airlock entrypoints in your
`scripts.js` behind one query-string check. Using the boilerplate `scripts.js` shape
(see `probes/eds-testbed/scripts/scripts.js` for the reference layout airlock ships
against):

```js
// THROWAWAY validation-only change — revert before merging real changes back.
const AIRLOCK_HARNESS_ON = new URLSearchParams(location.search).get('airlock') === '1';
```

Wrap the **eager reserve** (the pre-`appear` personalization box reservation, at
`scripts.js:184` in the reference layout — runs BEFORE `body.appear` at `:196`, i.e.
pre-paint):

```js
if (AIRLOCK_HARNESS_ON && window.__airlockConfig) {
  // ...the existing reservePersonalization(...) block, byte-unchanged...
}
```

Wrap the **lazy boot** (`scripts.js:246` in the reference layout — `boot(config)` for
alloy/config, else `bootEdsAnalytics()`, post-LCP):

```js
if (AIRLOCK_HARNESS_ON) {
  try {
    // ...the existing if (window.__airlockConfig) { boot(...) } else { bootEdsAnalytics() }
    // block, byte-unchanged...
    rec('airlock:init'); // (or your own equivalent — omit if you didn't copy the probe)
  } catch (e) {
    window.__airlockBootFailed = String(e);
  }
}
```

Both wraps together mean: **plain `URL` = OFF, a genuinely bare no-airlock page** (no
eager reserve, no lazy boot call at all); **`URL?airlock=1` = ON**, airlock boots exactly
as it would in production. Nothing about this gate ships to your real production
`scripts.js` — it lives only on the branch you deploy for this one measurement, exactly
like `rig/lh-eds.mjs`'s own "no test flag ships" principle for the local rig.

### 2. Deploy the throwaway branch

Deploy it to get a live preview URL (an EDS per-ref preview URL, e.g. your
`branch--site--org.aem.page`, works well here — it is still ONE deployment, so the
query-gate's cache/edge/origin-constant property holds).

### 3. Cache-parity pre-check (do this before the measured run)

Before trusting a run, confirm **both arms are in the same cache state** — otherwise the
query variant could be silently origin-rendered while the plain URL is edge-cached (or
vice versa), which reintroduces the exact fixed-offset confound the query-gate exists to
avoid. A quick check:

```sh
curl -sD - -o /dev/null "https://<your-preview-url>/"               | grep -i 'x-cache\|age:'
curl -sD - -o /dev/null "https://<your-preview-url>/?airlock=1"     | grep -i 'x-cache\|age:'
```

Look for comparable `age:` values and the same `x-cache` (or your CDN's equivalent hit/
miss header) on both. If one is a cold MISS and the other a warm HIT, **warm both**
(a couple of throwaway requests to each URL) and re-check before running the harness —
don't measure on a cold/warm split.

### 4. Run the harness

```sh
LIVE_URL="https://<your-preview-url>/" PROFILE=ga4 LH_N=5 npm run lh:live
```

- `LIVE_URL` — your one deployment's plain URL (no query string).
- `PROFILE` — **which profile's band to read** (see below): `ga4` (default) |
  `alloy-analytics` | `personalization`. The harness can't introspect your remote
  `window.__airlockConfig`, so tell it what you deployed.
- `QUERY_PARAM` — the query flag name, default `airlock` (only change this if your
  throwaway gate above used a different name).
- `LH_N` — iterations per arm, interleaved (off, on, off, …); default 5.

The harness emits a JSON card to stdout: per-arm median LCP/TBT/CLS/performance (+
min/max spread), the median deltas, and an `acceptance` block + honest `note` — read
the note, it names the mode + profile + band disposition in prose.

## Which profile's band to read

The acceptance band's shape depends on **whether your deployed config sets
`window.__airlockConfig`** — you (the operator) declare this via `PROFILE=`, since the
harness cannot see your remote config:

| You deployed... | `PROFILE=` | LCP claim | Band |
|---|---|---|---|
| GA4 only (`bootEdsAnalytics()`, no `window.__airlockConfig`) | `ga4` | **~0 by construction** — all airlock work runs post-LCP, it structurally cannot move LCP | Tight: **TBT delta ≤ 50ms AND \|CLS delta\| ≤ 0.01** |
| Adobe/alloy analytics, no `placements` | `alloy-analytics` | **MEASURED** — the eager pre-`appear` import (`reserve-personalization.js`) fires before paint, so a real pre-paint import cost is possible; this is exactly what 036-01 measures, not asserts | TBT delta ≤ 50ms still applies; CLS should hold (no box reserved) |
| Adobe/alloy personalization (`placements` declared) | `personalization` | **MEASURED**, same reason as above | TBT delta ≤ 50ms still applies; CLS should hold **or improve** — an improved CLS is the intended no-flicker win (033-03), reported as a PASS, not a band violation |

If you deployed alloy (either flavor) and see an LCP delta that concerns you, that is
the number to look at closely — it is never asserted "~0" for those profiles, unlike
GA4-only.

## `window.__airlockOwnsRum` — a SEPARATE toggle axis

If your deployment also sets `window.__airlockOwnsRum` (the RUM-replace toggle,
`scripts.js:270` guard → the `bootHelixRum` import at `:272`, invoked `:273`), know that it is a **distinct axis** from
`window.__airlockConfig`:

- `bootHelixRum` boots **post-`appear`** (post-LCP) regardless of your profile, so it
  never touches the LCP-by-construction discriminant above — its cost rides the **TBT**
  band alongside everything else in the lazy phase.
- Don't conflate the two: gate the axis you're actually validating (your
  `window.__airlockConfig` profile, above) and leave `__airlockOwnsRum` out of this
  harness's query-gate unless you mean to validate RUM-replace boot-health in the SAME
  run. RUM-replace's own conformance (does the live `ot.aem.live` collector accept
  airlock's `cwv` superset shape?) is spec 030-04 / 036-02 territory, not this harness.

## FALLBACK — two deployments, band withheld

If you genuinely cannot add a client-side query gate (e.g. no throwaway branch is
practical), the harness accepts two separate deployments instead — a baseline and an
adopted one (e.g. `main` vs an `airlock` branch's EDS preview):

```sh
BASELINE_URL="https://main--site--org.aem.page/" \
ADOPTED_URL="https://airlock--site--org.aem.page/" \
PROFILE=ga4 LH_N=5 npm run lh:live
```

**Read this mode's output with its caveat, not the tight band.** Two separate
deployments carry a **fixed** between-deployment bias — cold-vs-warm CDN cache,
different edge PoP, per-hostname routing — that is plausibly 10-100x the ~50ms/0.01
band, and interleaving (which cancels only *time-varying* drift against ONE server)
does **not** remove a fixed two-host offset. The harness's `acceptance.band_withheld`
is `true` in this mode and the card's `note` carries the caveat verbatim — this mode
answers **"did adopting airlock grossly regress CWV?"**, not **"is it preserved within
50ms."** Prefer the PRIMARY query-gate recipe whenever you can.

## Local dry-run (mechanical proof, no creds needed)

`npm run lh:live` with no `LIVE_URL`/`BASELINE_URL`+`ADOPTED_URL` set drives the SAME
query-gate mode against the local testbed (`probes/eds-testbed/`) — useful to sanity-check
the harness itself before pointing it at a real site:

```sh
npm run lh:live                          # PROFILE=ga4 (default) — the existing testbed page
PROFILE=alloy-analytics npm run lh:live  # the authored index-alloy.html fixture, no placements
PROFILE=personalization npm run lh:live  # same fixture, WITH a placements entry
```

The alloy profiles' local fixture uses a **stub** `bundleUrl` (`rig/alloy-csp-stub-bundle.js`)
— it proves the eager-reserve pre-`appear` code path runs, not a live Adobe Edge
round-trip (that live behavior is what your `LIVE_URL` run above validates).

## Part 2 — Supported-subset smoke (spec 036-02)

`rig/subset-smoke.mjs` answers the SECOND half of the MVP6 adoption proof: *"does the
supported connector subset (GA4 + Adobe/alloy) boot cleanly and emit conformant/present
beacons on a real EDS page?"* It asserts **presence + client-side conformance ONLY —
never presence-as-acceptance**:

| Check | What "pass" means | Is this acceptance? |
|---|---|---|
| boot-health | no `window.__airlockBootFailed` / `__airlockRumBootFailed`; the `airlock:init` (and, when RUM is owned, `airlock:rum`) mark fired | n/a — a boot-side property |
| GA4 | a `/collect` beacon is captured AND validates against `contracts/ga4-mp-request.schema.json` | **Yes** — MP-schema conformance is a legitimate client-side oracle for GA4 |
| alloy | the interact **FIRED** to the pinned datastream host | **No** — presence only. A malformed XDM still POSTs and can get an error handle back; the SHAPE + ECID write-back is NOT confirmed here (see [Named live residuals](#named-live-residuals-spec-036-02) below) |
| RUM | the beacon airlock **SENT** (when `window.__airlockOwnsRum`) is captured and shaped correctly | **No** — sent-shape only, never collector acceptance (see below) |

### Running it

Local dry run (no creds, no live URL — proves the mechanism against the local testbed):

```sh
npm run rig:subset-smoke
```

This drives two arms against `probes/eds-testbed/`: `index.html?rum=airlock` (GA4,
booted via `bootEdsAnalytics()`, plus the `?rum=airlock` opt-in from spec 030-03 so the
RUM `top` checkpoint's SENT shape is captured too) and `index-alloy.html` (alloy, booted
via `boot(config)` against the SAME CSP stub bundle `rig/lh-live.mjs`'s own local dry run
uses, `rig/alloy-csp-stub-bundle.js`). The stub performs **no network call**, so the
card honestly reports alloy's interact-FIRED check as **"not exercised locally"** rather
than faking a pass — chamber **boot-health** is what the local run actually proves for
alloy (the local-provability split, spec 036-02 AC3).

Live run (your creds-gated preview URL — same `LIVE_URL` convention as `rig/lh-live.mjs`
and spec 013's live-Alloy rigs; run manually, never wired into `npm test`):

```sh
LIVE_URL="https://<your-preview-url>/" node rig/subset-smoke.mjs
```

The rig loads your page as-is, reads its own `window.__airlockConfig` to see which
connectors it declares (absent config → `bootEdsAnalytics()`'s GA4-only shape, mirroring
`scripts.js`'s own dispatch), then fires ONE generic trigger — `window.airlock.push({
event: "page_view" })` — the same public `push()` contract every airlock boot path
installs on `window.airlock`. This needs no testbed-specific selector (a real page has no
`#cta-engage`): GA4's `["*"]` catch-all and alloy's `["page_view"]` manifest both accept
it, so one call exercises both connectors. (The trigger deliberately carries **no**
`page_location`: the GA4 MP schema's generic param cap is `maxLength: 100`, so injecting a
long live URL would trip a *smoke artifact* non-conformance, not a real airlock fault; a
bare `page_view` is still MP-conformant. That 100-char cap on a real long URL is a
pre-existing schema limit, shared with `rig/e2e.mjs` — not this smoke's to fix.)

**Boot-health is gated on the POSITIVE signal** `window.airlock` being installed (set by
`installOnWindow` only on a completed boot) in addition to no `__airlock*BootFailed` — so
a boot that silently *hung* (never threw) is caught, not reported "clean".

**RUM is SAMPLED live.** A RUM-owning page auto-sends its `top` checkpoint on boot, but
live RUM sampling may not select a given load — so an **absent** RUM beacon on a live run
is reported **informational, not a failure** (a genuinely broken RUM *boot* is caught
separately by the `rum_boot_health` `__airlockRumBootFailed` check; and acceptance is
downstream regardless — see [the residuals checklist](#1-rum-otaemlive-cwv-superset-acceptance--a-hard-gate-030-04)).
For a *definitive* SENT-shape capture, force-select RUM (as the local dry-run does) or
re-run until a beacon appears.

**The smoke assumes consent is GRANTED** for the exercised connectors. Airlock holds
egress at the seal until consent is granted, so on a consent-gated live page with nothing
granted, GA4 reads ABSENT and alloy NOT FIRED — an honest FAIL that is a *consent-state*
signal, not a boot defect. Grant consent (or run on a consent-free validation page) before
reading the smoke's beacon checks.

**Expect ~20 s per arm on a real page.** The rig waits for the testbed's `airlock:init`
`__flicker` mark to short-circuit the boot wait; a real adopter page normally has no
`__flicker` probe, so the wait runs its full ~20 s timeout before the positive
`window.airlock`-installed read. The verdict is still correct — just don't mistake the
wait for a hang. (If you copied the reference `rec('airlock:init')` probe onto your
throwaway branch, it short-circuits as on the testbed.)

**No Adobe org/datastream credentials are read by this rig** (unlike
`rig/alloy-live-*.mjs`, spec 013) — it only needs your page's URL. If your validation
branch is the SAME one spec 036-01's query-gate procedure uses, you can run both rigs
against it.

### Env / creds handling

- `LIVE_URL` — your page's URL. Never commit it if it embeds anything sensitive (a
  preview URL is normally fine to share).
- This rig never reads `ALLOY_*` (those belong to spec 013's org-level live-Edge rigs,
  `rig/alloy-live-*.mjs`, used for the interact-SHAPE residual below) and writes no
  fixtures — its own captured beacons only appear in this run's stdout JSON card, never
  committed.
- If you separately run the spec-013 rigs for the SHAPE/ECID residual, follow their own
  redacted-fixture discipline (`ALLOY_DATASTREAM_ID` / `ALLOY_ORG_ID` from `.env`,
  gitignored; only the DENY-BY-DEFAULT-redacted fixture is ever committed) — **never
  paste a raw datastream id, org id, or ECID into chat, a commit, or this doc.**

## Named live residuals (spec 036-02)

The smoke actively exercises boot-health + GA4 conformance + presence (above). The
following are **creds-gated live gates it does NOT decide** — each is named here with its
HONEST reveal, so a residual is never silently assumed-passed by a green smoke card.

### 1. RUM `ot.aem.live` `cwv`-superset acceptance — a HARD gate (030-04)

airlock's `cwv` RUM beacon is a **superset** of the stock enhancer's (it carries the
`web-vitals/attribution` build's extra LCP/CLS/INP fields —
[`connectors/helix-rum/README.md`](../connectors/helix-rum/README.md)). `ot.aem.live` is
**fire-and-forget** (a bare 2xx, no synchronous validation), so a captured beacon, a 2xx
status, or clean boot-health reveals only what airlock **SENT** — it can **NEVER** confirm
what the collector **KEPT**.

> **A captured beacon is explicitly NOT a sufficient reveal for this item.** The required
> reveal is **downstream AEM RUM-data inspection** — open the RUM bundler/explorer for
> your site and confirm the superset's extra fields are present in the COLLECTED data
> (not truncated/rejected in a way that breaks the pipeline). Ideally run this as a
> **differential against a stock `sampleRUM` run** on the same page, so a silent field
> drop is visible by comparison.

**Stakes:** `window.__airlockOwnsRum` neutralizes ALL inline `sampleRUM` egress —
`cwv` included (the testbed's own `sampleRUM`-neutralize guard in `aem.js`, spec 030-03).
If the downstream collector rejects/truncates the superset, the site silently loses CWV
telemetry with airlock as the sole (now-broken) RUM authority and **no error anywhere** —
this is exactly the false-green this residual exists to prevent.

### 2. alloy endpoint-ceiling breadth

`bootAlloy`'s ceiling is the grounded interact **floor**
(`connectors/alloy/connector.js`'s `ALLOY_INTERACT_ENDPOINT`). The server-directed
`demdex`/ID-sync URLs a real Adobe Edge *response* returns at runtime are **held**, not
silently dropped, when they land outside that floor — surfaced fail-closed as a
`kind:"endpoint-ceiling"` diagnostic (`core/wrapped-sdk-host.js`, captured through your
host's `onDiagnostic` callback: `{ level:"error", kind:"endpoint-ceiling",
disposition:"held", destination, reason, beaconId }`). See
[`docs/refinement-todo.md`](refinement-todo.md) (~L563) for the grounded gap this closes.

**Reveal:** wire an `onDiagnostic` sink (or your inspector, spec 040-series) on your live
run and confirm you see the held diagnostic (not silence) if your Adobe org's Edge
response ever returns a server-directed sync URL outside the floor.

### 3. Real ~766 KB bundle boot under live-host Trusted-Types

The hermetic CSP proof (`rig:alloy-csp`) uses a **stub** bundle under a captured
boilerplate CSP. The real `@adobe/alloy` bundle (~766 KB) booting under YOUR live host's
actual `trusted-types <names>` directive is a genuinely deploy-side property — a
restrictive policy that omits the worker's policy name would block it
([`docs/refinement-todo.md`](refinement-todo.md) ~L575, ADR-0016's kill-criterion).

**Reveal:** run `rig/subset-smoke.mjs` (or just load the page) against your LIVE deployed
bundle and confirm **boot-health** — no `__airlockBootFailed`, the `airlock:init` mark
fires. A failure here means the real bundle didn't boot on your real CSP; the local dry
run's stub cannot tell you this.

### 4. alloy interact SHAPE + ECID

The smoke proves the interact **FIRED** — presence only. Confirming the XDM SHAPE is
recognizable + that the response's identity handle yields a real ECID that round-trips
into your jar is [spec 013](specs/013-mvp3-live-alloy-reprobe/spec.md)'s job:

```sh
ALLOY_DATASTREAM_ID=… ALLOY_ORG_ID=… node rig/alloy-live-reprobe.mjs
```

This rig (creds-gated, run manually — see its own header for the redaction discipline)
captures a REAL Edge round-trip, redacts it (DENY-BY-DEFAULT — every value scrubbed
except a curated shape-token allowlist), and writes the durable, creds-free regression
fixture (`test/fixtures/alloy-live-interact.redacted.json`) this repo's hermetic suite
replays. **Never paste a raw datastream id, org id, or minted ECID into chat, a commit,
or this doc** — only the redacted fixture is safe to commit.

## Advisory discipline (ADR-0005)

Like `docs/scoreboard.md`, every card these harnesses emit is **advisory** — a
human-read, jig-supervised signal, never a CI gate. Read the `note` field; it is
written in tolerance-band + provenance language on purpose, so it survives a
noisy single run.
