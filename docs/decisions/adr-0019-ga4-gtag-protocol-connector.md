---
status: Accepted
dependencies: [ADR-0017, ADR-0018]
last_verified: 2026-09-07
frame_review: true
---

# ADR-0019: GA4 rewire path — additive gtag-protocol connector

## Status

Accepted (2026-09-07)

## Context

ADR-0018 made confirmed vendor-boundary parity the airlock 1.0 bar with GA4 as the analytics anchor, and set a GA4 kill
criterion for when airlock's Measurement-Protocol egress cannot match a container's `gtag.js` tag. airlock's shipped GA4
connector emits the **server-side Measurement Protocol** (`/mp/collect`, `connectors/ga4/map.js:56-85`) — contract
surface 1, **frozen** by ADR-0017. A tag-manager container's GA4 tag instead loads `gtag.js` and emits `/g/collect`: a
different endpoint, encoding, and field vocabulary. ADR-0018's GA4 kill criterion named the exits, in order, for when
MP-only egress cannot reach console-level parity **or** is unfit for a public property: **(a)** a second, *additive*
gtag-protocol GA4 connector; else **(b)** the owner re-decides the bar — never a redefinition of "parity".

[R-009(a)](../research/R-009-gtag-family-fidelity.md), the MVP7 risk-first spike, ran that analysis on 2026-09-07 and
found **MP-only egress unfit for a public-web GA4 rewire** on three grounds:

- **`api_secret` — decisive and capture-independent.** MP *requires* an `api_secret`, which airlock places in
  browser-side config as the collect-endpoint URL (`connectors/ga4/map.js:82-84`,
  `contracts/instrumentation-config.schema.json:47`). `/g/collect` requires none (auth is `tid` + request
  origin/referer). A public property's owner will not publish a server secret in page JS, and MP hits **bypass GA4's
  bot/spam filtering** — a published `api_secret` invites data pollution. No parity check can see this (ADR-0018 E6).
- **Session continuity (OQ13-2).** MP reads `session_id` from `_ga_<stream>`, but nothing on a gtag-free EDS MPA
  *writes* that cookie, so sessions mint per page (`connectors/ga4/cookies.js:118-119,179`;
  `docs/refinement-todo.md:95` item 2) — inflating console session counts. `gtag.js` avoids this by being the session
  writer.
- **Consent Mode.** MP's `consent` object carries only the two data-use purposes (`ad_user_data`,
  `ad_personalization`); the two storage purposes and Consent-Mode-driven cookieless *modeling* have **no MP field**
  (`connectors/ga4/consent.js:12-15`).

R-009(a) also found the event payload and identity (`en`/`ep.`/`epn.`/`_et`/`cid`) map **cleanly** MP↔gtag — the gap is
sessions, consent, and the secret, not the events — and that a `/g/collect` GET beacon is reproducible off-thread (spec
026 already emits governed GET pixels). This ADR records the resulting protocol-path decision. It does **not** supersede
ADR-0018; it resolves that ADR's GA4 kill-criterion into exit (a).

## Decision Options Considered

### Option A: Keep MP-only (`/mp/collect`) as the GA4 rewire path
- **Pros:** already built and shipped; is the frozen surface 1 (ADR-0017); no new connector, no second egress path.
- **Cons:** forces an `api_secret` into page JS (a public owner won't; bot-filter bypass → pollution); per-page session
  minting on a gtag-free MPA (OQ13-2); no Consent-Mode storage-purpose or modeling carriage. Reaching "parity" this way
  would require **redefining parity to fit MP** — which ADR-0018 forbids.

### Option B: Add an off-thread `/g/collect` gtag-protocol GA4 connector (keep MP for server-side use)
- **Pros:** speaks the container's **own** protocol, so parity is a **same-protocol beacon diff**, not a semantic
  field-map; needs **no `api_secret`** (`tid` + origin, like the container); **additive** — leaves the frozen MP schema
  (surface 1, ADR-0017) **untouched → no stable-core break**; the GET *transport* it needs is already a shipped
  capability (`connectors/pixel/` emits governed GET beacons off-thread); it is the only path that can reproduce gtag's
  session (`sid`/`sct`/`seg`) and Consent-Mode (`gcs`/`gcd`) values **on the protocol the console expects**.
- **Cons:** unlike a pixel config this is a **stateful** connector — it must reproduce gtag's session/engagement and
  Consent-Mode *values* (not just emit the fields) and become a `_ga`/`_ga_<stream>` **writer**, a new cookie-write
  governance surface — real implementation work, not a GET-beacon config; a **second** GA4 egress path to build, govern,
  and maintain (MVP7 scope); the wire shape and console parity are not yet retired (need a redacted capture, then MVP9).

### Option C: Owner re-decides the 1.0 GA4 bar (ADR-0018 exit b)
- **Pros:** the honest exit **iff** the protocol proved irreproducible off-thread.
- **Cons:** not triggered — R-009(a) finds `/g/collect` reproducible (a GET beacon airlock's pixel path already emits).
  Choosing this now would shelve a reachable path.

### Option D: A first-party server-side Measurement-Protocol proxy (server-side tagging)
- **Pros:** would also close the `api_secret` exposure (the secret lives server-side, never in page JS) while staying
  MP-native — no new client-side connector.
- **Cons:** requires a **server / edge-function tier** to receive and forward events. airlock's runtime is a
  **client-side, off-main-thread worker** (main thread captures → worker egresses; no origin server in its trust model),
  so a server-side proxy is a **different architecture**, not an airlock connector. Out of airlock's scope by
  construction — named here to rule it out explicitly.

## Recommended Decision

**Option B.** The GA4 **rewire / parity** path is a new, **additive, off-thread `/g/collect` gtag-protocol connector**.
The existing Measurement-Protocol connector (`/mp/collect`) is **retained unchanged** for server-side / trusted-secret
contexts — it stays the frozen surface 1 (ADR-0017); this ADR adds a path, it does not modify or deprecate it. This
takes ADR-0018 GA4 kill-criterion **exit (a)**.

The reasoning is that the `api_secret` blocker is decisive and **capture-independent** — it settles the question before a
wire capture is even in hand — and speaking the container's own protocol is the natural parity path regardless (ADR-0018
defines GA4 parity as same-protocol fidelity). The connector closes the `api_secret` gap **by construction** (the
protocol carries no secret); it makes the **session and Consent-Mode** gaps *closable* by reproducing, off-thread, the
stateful `sid`/`sct`/`seg`/`gcs`/`gcd` computation `gtag.js` does on-page — the *fields* map by construction, but the
*values* require reimplementing that state machine and a `_ga_<stream>` writer, which the connector spec must size
honestly (it is **not** a GET-beacon-sized task). All of this leaves the frozen contract untouched. Exit (b) is not taken
because the protocol is reproducible off-thread.

Scope note: this ADR decides the **protocol path** only. The connector's wire shape, its cookie-write governance, and
whether it writes `_ga_<stream>`, are the committed connector spec's to settle (MVP7), grounded on a redacted
`/g/collect` capture.

## Consequences

**Becomes easier:**
- GA4 parity is verified by a **same-protocol beacon diff** (the strongest oracle), not a lossy semantic field-map.
- Session and Consent-Mode parity become **reachable on the protocol the console expects** — the connector reproduces
  gtag's `sid`/`sct`/`seg`/`gcs`/`gcd` and writes `_ga_<stream>`, closing OQ13-2 (the state is *built*, not free — see
  Cons and open questions), rather than being structurally out of reach as under MP.
- MVP7's "GA4 parity" scope resolves to a **concrete connector** with a known target protocol.

**Becomes harder:**
- **Two GA4 egress paths** (MP + gtag-protocol) to maintain and document — a page/property must choose, and the choice
  needs a deployment policy.
- The connector is **stateful**: reproducing gtag's session/engagement and Consent-Mode computation is real
  implementation work, not a GET-beacon config — the MVP7 connector spec must size it as such.
- A **new cookie-write governance surface**: the connector writing `_ga`/`_ga_<stream>` under consent must be gated as
  carefully as the MP identity path already is (`analytics_storage`, 017-02).
- The decision is **grounded but not fully retired**: the `/g/collect` field shape needs a redacted capture, and
  console-level parity needs MVP9 — see Kill criteria.

## Assumptions

<!-- Spec 064-02 / ADR-0020 §1–§2 — grounding-by-probe (risk-gated). -->

- **Grounded (in-repo, read 2026-09-07):** MP places `api_secret` in browser-side config
  (`connectors/ga4/map.js:82-84`, `contracts/instrumentation-config.schema.json:47`); MP `consent` carries only the two
  data-use purposes (`connectors/ga4/consent.js:12-15`); per-page session minting on a gtag-free MPA
  (`connectors/ga4/cookies.js:118-119,179`; `docs/refinement-todo.md:95`); off-thread governed **GET** beacon emission
  is a shipped capability (`connectors/pixel/`, spec 026).
- **Assumption pending a redacted capture (ADR-0018 R5, no live identifiers):** the `/g/collect` wire shape used above
  (GET; `no api_secret`; `tid`+origin auth; `gtag.js` maintains `_ga_<stream>`; Consent Mode as `gcs`/`gcd`) is the
  **documented** GA4 gtag MP-v2 vocabulary, **not** a measured capture. It is asserted here as documented-protocol, to be
  confirmed field-for-field before the connector's wire shape is frozen. A speculative wire shape already failed 026-02's
  frame-critique; this decision rests on the **capture-independent** `api_secret` blocker, not on the unconfirmed shape.

## Kill criteria

- **Protocol not reproducible.** If a redacted `/g/collect` capture shows a required field only the on-page `gtag.js`
  runtime can compute, or a credential beyond `tid`+origin, the additive connector is not viable off-thread → fall to
  ADR-0018 exit (b) (owner re-decides). R-009(a) judges this unlikely (a GET beacon), but the capture is the test.
- **Console parity fails at MVP9.** If the `/g/collect` connector produces a clean beacon diff yet does **not** reach
  GA4 console-level session/engagement/attribution parity under live traffic + DebugView, this decision is revisited —
  the residual console/attribution risk the lab spike cannot retire (ADR-0018's lab-vs-MVP9 split).

## Open questions

- Must the connector itself **write** `_ga_<stream>` (become the session writer) to close OQ13-2, and under what
  cookie-write governance (consent-gated like the `_ga` identity write)? → committed connector spec (MVP7).
- **Coexistence policy:** does the gtag-protocol connector replace the MP connector on a page, or may a property run MP
  server-side deliberately? → deployment/config policy in the connector spec.
- Field-for-field confirmation of the `/g/collect` → connector map on a redacted capture (carried from R-009(a)).
