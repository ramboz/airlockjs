---
status: Accepted
dependencies: [adr-0006]
last_verified: 2026-09-13
frame_review: true
---

# ADR-0025: Endpoint-ceiling granularity for matrix-URI wires — a segment-anchored prefix match (extends ADR-0006)

## Status

Accepted (2026-09-13, implemented by spec 046-02) — **extends [ADR-0006](adr-0006-capability-manifest.md)** (the
capability manifest's authoritative `endpoints` ceiling — ADR-0006's "declared-as-ceiling" law, enforced by
`core/endpoint-ceiling.js`). Does not supersede it; it **resolves, for the matrix-URI case, ADR-0006's named open
question** "Endpoint declaration granularity — literal URL vs origin vs parameterized template" and the adjacent kill
criterion ("revisit declaration granularity … declare an origin or a parameterized template, not a literal"). Nygard-
immutable, so extend-not-edit (mirroring [ADR-0023](adr-0023-ad-pzn-egress-hold-until-consent.md)-amends-0007 /
[ADR-0024](adr-0024-fanout-remap-per-beacon-key.md)-extends-0023).

## Context

The endpoint ceiling (`core/endpoint-ceiling.js`) enforces ADR-0006's law that a connector may only egress to its
**declared** endpoints (`granted = declared ∩ host-policy ∩ consent`). It matched a destination by **exact**
origin+pathname (`originPath(url)` = `origin + pathname`, query dropped; then `Set.has`).

Spec 046-02's DC Floodlight **activity** beacon rides a wire the exact match cannot express: the params ride the URL
**path** as `;`-delimited RFC-3986 **matrix segments** —
`https://ad.doubleclick.net/activity;src=<id>;type=<t>;cat=<c>;ord=<o>;num=<per-request-cachebuster>` — and a
**per-request `num`/`ord` cachebuster sits in the pathname**. So every request produces a *different* `origin+pathname`,
no declared literal can match, and the granted beacon is wrongly **held** at the seal. This is exactly the "a literal-
endpoint ceiling is too rigid" case ADR-0006 flagged: the fix is a **coarser declaration granularity**, not reverting
`endpoints` to advisory.

## Decision Options Considered

### Option A (chosen): segment-anchored prefix match, opt-in by the declared path's own shape
- A declared origin+path that **contains `;`** (a matrix path) opts into a **prefix** match; every other declared
  endpoint keeps the **exact** set-membership match, unchanged. Admission for a matrix prefix:
  `destination === prefix || destination.startsWith(prefix + ";")`. The floodlight manifest declares the origin +
  `/activity;src=<id>` (the stable Floodlight identity) as the prefix.
- **Opt-in is structural + safe:** origins never contain `;`, and `originPath` drops the query before the check, so a
  `;` in a declared endpoint's *query* cannot coerce prefix mode. Verified against every shipped endpoint constant
  (alloy `/ee/v1/interact`, ccm `/ccm/collect`, GA4 `/g/collect`, meta `/tr`, bing `/action/0`, linkedin `/collect`) —
  none carries a `;`, so **all stay in exact mode**; the fail-closed ceiling is provably unweakened for existing
  connectors.
- **Anchored at a `;` boundary:** matching `prefix + ";"` (not a bare `startsWith(prefix)`) holds a **value-extension**
  attack — `src=00000001` does not match declared `src=0000000`.
- **Pros:** vendor-neutral (keys on RFC-3986 matrix syntax, not DoubleClick specifics); allowlist-shaped (pins the
  stable prefix, admits only the variable cachebuster tail); no coupling of the ceiling to per-connector cachebuster
  names; composes with the flush-time re-check unchanged.

### Option B (rejected): strip the cachebuster, then exact-match
- Normalise `num`/`ord` out of the destination pathname before an exact match — the parity **oracle** already does this
  on its side (`rig/parity/descriptors/floodlight-activity.js` `normaliseDenylist: ["num","ord"]`).
- **Rejected:** it couples the **vendor-neutral** ceiling to each connector's cachebuster **param names** — a
  **denylist**, which is fragile (a new/renamed cachebuster param silently escapes and defeats the match). Option A's
  prefix-anchor is an **allowlist** (pin the stable prefix, admit the tail) and needs no per-vendor param knowledge.

### Option C (rejected): origin-only coarsening
- Match just the origin (`ad.doubleclick.net`), dropping the path entirely.
- **Rejected:** too permissive — *any* path on the origin would pass, discarding the `/activity;src=<id>` path+identity
  pin. That coarsens far more than the cachebuster problem requires and weakens the ceiling well beyond ADR-0006's intent.

## Recommended Decision

**Option A — a segment-anchored prefix match, opt-in when the declared path contains `;`.** It resolves ADR-0006's
declaration-granularity open question for the matrix-URI case with a coarsening that is *minimal* (only the variable
cachebuster tail is admitted), *vendor-neutral*, and *provably non-weakening* for every existing query-delimited
connector. The `;`-encoder home is a new pure leaf `core/path-matrix.js` (`appendMatrixParam` / `joinMatrixUrl`), the
sibling of `core/query-params.js`.

## Consequences

**Becomes easier:**
- Any matrix-URI vendor (DC Floodlight activity; future `;`-path wires) can declare a ceiling that survives a per-request
  path cachebuster, without the ceiling learning vendor-specific param names.
- Composes with the 045/046-03 re-map-on-grant path: the flush-time ceiling re-check (`core/airlock.js`) re-validates a
  re-mapped activity URL through the same checker; because the connector emits `src` first and `src` is config-stable, a
  re-mapped activity beacon admits by construction (no airlock.js change).

**Becomes harder / residual (named — the matrix analogue of ADR-0006 residual (i)):**
- The prefix pins **origin + `/activity;src=<id>`** but **not** `type`/`cat`, and admits **any** trailing `;`-segments
  after the anchor. A compromised chamber could append arbitrary matrix segments
  (`;type=<evil>;cat=<evil>;exfil=<data>`) to the pinned host+`/activity;src`. This does **not** open a new-destination
  escape — origin + path + `src` are pinned, so ADR-0004/0006's foreign-sink defense holds — but it is the matrix-path
  analogue of ADR-0006's residual (i) "tenant-in-query re-route": the dropped-query **append surface** reappears as the
  path suffix. Tightening the anchor to also pin `type`/`cat`, or applying payload-governance (ADR-0012) to the matrix
  tail, is a future option, not required for 046 parity. Tracked in `docs/refinement-todo.md`.

## Assumptions

None load-bearing beyond the in-tree mechanism, all read at authoring: `core/endpoint-ceiling.js` (the two-mode
partition + `;`-boundary anchor), `core/path-matrix.js` (encoded leaf), `connectors/floodlight/connector.js` (the
declared prefix + emitted URL share `joinMatrixUrl`), `core/airlock.js` flush-time re-check, and the shipped endpoint
constants (enumerated above — none carries `;`).

## Open questions

- **Anchor granularity:** is advertiser-level (`src`-only) pinning the intended ceiling granularity, or should the
  prefix pin `type`/`cat` too? `src`-only is the minimal stable identity; tighter pinning narrows the append residual at
  the cost of a longer declared prefix. Deferred (refinement-todo).
- **Matrix-tail append surface:** whether the arbitrary-trailing-segment surface warrants a payload-governance strip
  (ADR-0012) on the matrix path, or stays an accepted residual under the pinned-destination defense.
