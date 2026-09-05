# Real-site CWV validation (spec 036-01)

> The run-procedure for `rig/lh-live.mjs` — the operator-run half of the MVP6 adoption
> proof: *"does adopting airlock preserve Core Web Vitals on a real EDS site?"* I (the
> implementer) build + mechanically prove the harness against the local testbed; **you
> (the operator) hold the creds and run it against your real site** — the same
> build/run split spec 013's live-Alloy rigs use (env creds, never handled here).

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
`scripts.js:270` → `bootHelixRum`, `:272`), know that it is a **distinct axis** from
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

## Advisory discipline (ADR-0005)

Like `docs/scoreboard.md`, every card this harness emits is **advisory** — a
human-read, jig-supervised signal, never a CI gate. Read the `note` field; it is
written in tolerance-band + provenance language on purpose, so it survives a
noisy single run.
