---
status: OPEN
topic: Can airlock reach beacon + attribution parity for the gtag-family tags (GA4, Google Ads, Floodlight) from off-thread governed egress?
created: 2026-09-07
related:
  - ../decisions/adr-0018-reframe-onto-adoptable-one-point-oh.md
  - ../releases/mvp7.md
  - ../releases/mvp8.md
---

# R-009: gtag-family fidelity — GA4 / Google Ads / Floodlight parity

> This is an **open investigation**, not a decision and not committed work. It is the **MVP7 risk-first** spike
> ([ADR-0018](../decisions/adr-0018-reframe-onto-adoptable-one-point-oh.md) Emergent E6): the 1.0 bar rests on it, and it
> has no code dependency, so it runs first. A decision belongs in an ADR; committed connector work belongs in a spec
> (MVP7 for GA4, MVP8 for Ads/Floodlight).

> **Progress — part (a) advanced 2026-09-07 (this note).** The GA4 `/g/collect`→MP semantic field-map, the
> session/engagement (OQ13-2) and Consent-Mode carriage gaps, and the decisive `api_secret` adoption analysis are below —
> the airlock side grounded in the in-repo MP connector; the wire-shape rows the **documented** gtag MP-v2 vocabulary, to
> be confirmed field-for-field on a redacted `/g/collect` capture. **Provisional lean: MP-only is unfit for a public-web
> GA4 rewire → ADR-0018 kill-criterion exit (a), an additive off-thread `/g/collect` connector** (see Conclusion). Parts
> **(b)** Ads/Floodlight and **(c)** transport remain stubs (MVP8-facing). Status stays `OPEN`: the field-map confirmation
> (capture) and console-level parity (MVP9) are not yet retired.

## Question

When a `gtag.js`-family tag (GA4 `/g/collect`, Google Ads AW conversion pings, Floodlight/CM360 DC activity pings) is
rewired from a tag-manager container onto airlock's off-thread governed egress, can it reach **parity at the vendor
boundary** — the same events with the same attribution-bearing fields, confirmed by a per-protocol oracle *and* the
vendor console? Split into what a **lab spike can decide now** vs what only the **MVP9 live rewire** can confirm.

## Sources / findings

_Ground every wire-shape claim on a **redacted real capture** (ADR-0018 R5; no live identifiers, spec-013 discipline) —
a speculative wire shape already failed 026-02's frame-critique. Below, the **airlock side is grounded in-repo**; the
**`/g/collect` side is the documented gtag MP-v2 vocabulary**, labelled as such and pending capture confirmation._

### airlock's MP side — grounded in-repo (2026-09-07)

- **Body shape** (`connectors/ga4/map.js:56-76`): `{ client_id, events: [{ name, params }], user_id?, consent? }`, POST
  JSON to `/mp/collect`. `session_id` + `engagement_time_msec` are injected into each event's `params`
  (`engagement_time_msec` defaults to `100`).
- **Credentials are query params, not body** (`map.js:79-85`, `contracts/ga4-mp.md` §Endpoint & auth):
  `?measurement_id=G-…&api_secret=…`. The `api_secret` sits in the **browser-side** instrumentation config as the
  collect-endpoint URL (`contracts/instrumentation-config.schema.json:47`).
- **Identity** (`connectors/ga4/cookies.js`): `client_id` reads the `_ga` cookie's last two dotted segments (or mints +
  persists one), `analytics_storage`-gated (017-02). `session_id` reads `_ga_<stream>` — **but on a gtag-free page
  nothing writes `_ga_<stream>`, so it falls back to a per-page id** (`cookies.js:118-119,179`) = OQ13-2.
- **Consent** (`connectors/ga4/consent.js:12-15,26-27`): the MP `consent` object carries **only** the two *data-use*
  purposes `ad_user_data` / `ad_personalization`. The two *storage* purposes (`analytics_storage`, `ad_storage`) have
  **no MP field** — a storage deny is enforced at the cookie-write capability, never in the beacon. PENDING is omitted,
  not fail-safe-DENIED.
- **Transport** (`core/airlock.js:48-50`): egress sets only `method`/`body`/`keepalive` — **no cross-site cookies** (the
  container's `gtag.js` fires credentialed requests carrying `_gcl_au` and, on the 3p-cookies-allowed cohort,
  google/doubleclick cross-site cookies). Feeds part (c) / E10, not part (a).

### the container's `/g/collect` side — documented gtag MP-v2 (confirm on a redacted capture)

- A container GA4 tag loads `gtag.js` and emits a **GET** beacon to `/g/collect` (region-prefixed for EU), query-string
  encoded, **no `api_secret`** — auth is `tid` + request origin/referer.
- `gtag.js` **reads and writes** `_ga` and `_ga_<stream>`, maintaining `sid`/`sct`/`seg`/session-start across pages
  (the session-writer airlock's MP path lacks — OQ13-2).
- Consent Mode rides as `gcs` (state, e.g. `G111`) + `gcd` (defaults) and — under `analytics_storage` denied — drives
  cookieless *modeling* pings, a mechanism MP has no equivalent for.

## Three parts

### (a) GA4 — MP-vs-`gtag`, and MP's fitness for a public property [MVP7]

**The `/g/collect` → MP semantic field-map** (documented gtag MP-v2 → airlock MP body; confirm field-for-field on a
redacted capture). "maps" = an MP equivalent carries the same attribution value; "partial/none" = a gap an oracle must
surface, not paper over:

| `/g/collect` (gtag) | meaning | airlock MP equivalent | parity |
|---|---|---|---|
| `tid` | measurement id | `measurement_id` (query) | **maps** |
| `cid` | client id | `client_id` (body) | **maps** — same `_ga` source |
| `en` | event name | `events[].name` | **maps** |
| `ep.<k>` / `epn.<k>` | string / numeric event param | `events[].params.<k>` | **maps** |
| `_et` | engagement time (ms) | `params.engagement_time_msec` | **maps** (defaults 100) |
| `dl` / `dr` / `dt` | location / referrer / title | `params.page_location` / `page_referrer` / `page_title` | **maps** (host-supplied) |
| `sid` | session id | `params.session_id` | **partial** — per-page mint on a gtag-free MPA (OQ13-2) |
| `sct` / `seg` / `_s` | session count / engaged flag / hit seq | — | **none** — no MP field (engagement inferred from `engagement_time_msec`) |
| `gcs` / `gcd` | Consent Mode state / defaults | `consent{ ad_user_data, ad_personalization }` | **partial** — no storage-purpose field, no modeling ping |
| `ul` / `sr` / UA hints | language / screen / device | request-derived by GA, or a permissive param | **different-by-design** — MP derives device/geo from the request |
| `_p` / `_z` / `_dbg` … | cache-buster / internal | — | **none** — nondeterministic; normalised out of any oracle |

Read-out: the **event payload and identity map cleanly**; the gaps are **session mechanics** and **Consent Mode**, plus
one **adoption blocker** the map cannot show —

- **Session / engagement continuity (OQ13-2).** MP conveys `session_id` when a `_ga_<stream>` cookie exists, but nothing
  on a gtag-free EDS MPA *writes* that cookie, so sessions mint per page (`connectors/ga4/cookies.js:118-119`;
  refinement-todo item 2, `docs/refinement-todo.md:95`). In the GA4 console this inflates session counts and fragments
  engagement/session-scoped metrics — a real parity loss, not cosmetic. `gtag` avoids it by *being* the session writer.
- **Consent Mode state.** MP's `consent` object is the two data-use purposes only; the two storage purposes and
  Consent-Mode-driven **behavioral modeling** (cookieless pings under `analytics_storage`-denied) have no MP field
  (`connectors/ga4/consent.js:12-15`). A property that relies on Consent Mode modeling loses it at the MP boundary.
- **`api_secret` fitness — the decisive, capture-independent blocker.** MP *requires* an `api_secret` that airlock puts
  in browser-side config (`map.js:82-84`, `instrumentation-config.schema.json:47`); `/g/collect` requires none. A public
  web property's owner **will not publish a server secret in page JS**, and MP hits **bypass GA4's bot/spam filtering**,
  so a public `api_secret` invites data pollution (anyone can POST arbitrary events to the property). This is an
  *adoption* blocker no parity check sees (ADR-0018 E6) — and it is **independent of the field-map**, so it decides the
  question before a capture is even in hand.

**Decision it feeds** (ADR-0018 §Kill criteria — GA4): MP-only parity, **or** an additive `/g/collect` gtag-protocol GA4
connector (frozen surface 1 — the MP schema — untouched → no stable-core break), **or** the owner re-decides the bar. On
the analysis above the lean is the **additive connector** (exit a). See Options and Conclusion.

### (b) Google Ads + Floodlight — conversion-ping fidelity [feeds MVP8]
- Consent Mode v2 incl. the **`ad_storage`-denied path**: hold-at-the-seal vs cookieless send (per ADR-0007's
  reshape-and-send model).
- Click identifiers: `gclid` / `_gcl_au` / `_gcl_aw` / `_gcl_dc`, linker, `wbraid` / `gbraid`.

### (c) Transport — per vendor, per cookie cohort [feeds the E10 ADR]
- Which attribution paths ride the **cross-site cookie** (`fr`, `IDE`) vs **first-party params** (`_fbp`/`fbc`, `gclid`),
  on the third-party-cookies-allowed cohort vs the blocked cohort. Input to the E10 purpose-gated credentialed-transport
  ADR.

## What a lab spike can decide vs what only MVP9 confirms

- **Lab (this note, MVP7):** protocol reproducibility (can the ping be emitted from governed egress at all), the
  click-through ping shape + field-map, Consent Mode behaviour per state, which params ride the cookie.
- **MVP9 only (live traffic + vendor consoles):** view-through, cross-device, and CM360 attribution — aggregate,
  delayed, real-visitor properties. R-009 retires the *protocol* risk early; the *attribution* risk is retired at MVP9.

## Options / pros & cons

**GA4 — MP-only vs an additive gtag-protocol connector** (Ads/Floodlight transport options are part (c) / E10):

| | MP-only (`/mp/collect`, today) | Additive `/g/collect` gtag-protocol connector |
|---|---|---|
| Protocol vs the container's tag | *different* (server MP) — needs a semantic field-map | **same** as the container — same-protocol beacon diff |
| `api_secret` | **required, browser-exposed** → adoption blocker + bot-filter bypass | **none** — `tid` + origin, exactly like the container |
| Session continuity | per-page mint on a gtag-free MPA (OQ13-2) | maintains `_ga_<stream>` → native continuity |
| Consent Mode | 2 data-use purposes; no storage / modeling | full `gcs` / `gcd` carriage |
| Stable core (ADR-0017) | already frozen surface 1 | **additive** — leaves the MP schema untouched, **no break** |
| Effort | already built | new connector — protocol reproducible (GET beacon; spec 026 already emits governed GET pixels) |
| Verdict | **unfit** for a public-web rewire | **the parity path** |

The additive connector satisfies parity's own definition (ADR-0018: "same events, same attribution-bearing fields reach
the vendor as from the container") *by construction* — same protocol, same fields, same cookie maintenance, no secret.
MP-only would require redefining parity to fit MP, which the kill criterion forbids.

## Open questions

- **(capture-gated)** Field-for-field, does a redacted `/g/collect` capture carry any attribution-bearing field with no
  MP equivalent beyond those mapped above? (Confirms the map; unlikely to reverse the lean — the `api_secret` blocker is
  capture-independent.)
- **(MVP9-gated)** Does the additive `/g/collect` connector reach GA4 **console-level** session/engagement/attribution
  parity under live traffic + DebugView? (The lab spike retires the *protocol* risk; the console leg is MVP9.)
- **(connector-scope)** Must the additive connector itself **write** `_ga_<stream>` (become the session writer) to close
  OQ13-2, and under what cookie-write governance (consent-gated like `_ga`)? Feeds refinement-todo item 2's resolution
  trigger (an MPA field deployment where per-page sessions inflate counts).
- **(part b/c)** Can Ads/Floodlight conversion pings reach attribution parity off-thread, and does that require the E10
  credentialed transport? (Unchanged — MVP8-facing.)

## Conclusion

**Provisional (part (a), 2026-09-07) — MP-only egress does not reach rewire parity for a *public web* GA4 property.**
Three findings point the same way: a capture-independent adoption blocker (`api_secret` browser-exposure + GA4
bot-filter bypass), and two structural carriage gaps (session continuity / OQ13-2; Consent-Mode storage-purpose +
modeling). The event payload and identity *do* map cleanly — the gap is not the events, it is sessions, consent, and the
secret.

**Recommended exit — ADR-0018 §Kill criteria (GA4) exit (a): an additive, off-thread `/g/collect` gtag-protocol GA4
connector.** The protocol is reproducible (a GET beacon; spec 026 already emits governed GET pixels), it speaks the
container's own protocol (so parity becomes a same-protocol beacon diff, not a semantic field-map), it carries Consent
Mode and can maintain `_ga_<stream>`, needs no `api_secret`, and — decisively for the stable core — leaves the **frozen
MP schema (surface 1, ADR-0017) untouched**, so it is purely additive: **no stable-core break**. Exit (b) (owner
re-decides) is not triggered — the protocol is not irreproducible.

**Not yet retired:** the field-map is confirmed field-for-field on a redacted `/g/collect` capture (R5-synthetic); and
console-level parity + attribution are retired at MVP9 (the lab-vs-MVP9 split above). Both *confirm*; neither is expected
to *reverse* the direction, because the `api_secret` blocker is independent of both.

**Next step:** obtain a redacted `/g/collect` capture to confirm the map, then promote this to a **GA4-protocol-path
ADR** (the decision belongs in an ADR, not this note). This field-map table is the seed the parity harness's GA4
per-protocol oracle (ADR-0018 E5 spec) will encode.

_Open (full note)._ Promoted to: — (part (a) feeds MVP7's GA4-parity ADR + GA4 connector scope; parts (b)/(c) still feed
MVP8's Ads/Floodlight connector scope + the E10 transport ADR).
