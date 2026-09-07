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

## Question

When a `gtag.js`-family tag (GA4 `/g/collect`, Google Ads AW conversion pings, Floodlight/CM360 DC activity pings) is
rewired from a tag-manager container onto airlock's off-thread governed egress, can it reach **parity at the vendor
boundary** — the same events with the same attribution-bearing fields, confirmed by a per-protocol oracle *and* the
vendor console? Split into what a **lab spike can decide now** vs what only the **MVP9 live rewire** can confirm.

## Sources / findings

_To fill during MVP7. Ground every wire-shape claim on a **redacted real capture** (ADR-0018 R5; no live identifiers,
spec-013 discipline) — a speculative wire shape already failed 026-02's frame-critique._

Starting points (grounded 2026-09-07):
- airlock's GA4 connector emits the **Measurement Protocol** (`/mp/collect?measurement_id=…&api_secret=…`,
  `connectors/ga4/map.js:81`; `contracts/ga4-mp.md`) — a *different protocol* from a container GA4 tag's `gtag.js`
  `/g/collect` (different endpoint, encoding, field vocabulary: `cid`/`sid`/`_p`/`gcs`/`gcd`/`dl`/`dr` vs JSON
  `client_id`/`events[]`).
- airlock's egress carries **no cross-site cookies** today (`core/airlock.js:48-50` `fetchInit`; no `credentials`/`mode`
  handling in `core/`/`adapters/`/`connectors/`/`contracts/`). The container's tags fire credentialed requests carrying
  the vendor cookie (`_gcl_au`, and — on the third-party-cookies-allowed cohort — google/doubleclick cross-site cookies).
- OQ13-2 (`docs/refinement-todo.md`) records a known GA4 divergence: on a gtag-free MPA, nothing writes `_ga_<stream>`,
  so sessions mint per page.

## Three parts

### (a) GA4 — MP-vs-`gtag`, and MP's fitness for a public property [MVP7]
- The `/g/collect` → Measurement-Protocol **semantic field-map** (what maps, what has no MP equivalent).
- **Session / engagement continuity** on an MPA (OQ13-2): does MP-only reach console-level session parity?
- **Consent Mode** state carriage.
- **The `api_secret` adoption blocker** (an *adoption* question no parity check sees): MP requires an `api_secret` that
  airlock places in browser-side config/URL, and MP hits bypass GA4 bot filtering — a property owner replacing a
  container GA4 tag will not publish a server secret in page JS.
- **Decision it feeds:** MP-only parity, **or** an additive `/g/collect` gtag-protocol GA4 connector (frozen surface 1,
  the MP schema, untouched → no stable-core break), **or** owner re-decides the bar (ADR-0018 GA4 kill criterion).

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

_To fill (MP-only vs additive gtag-protocol connector for GA4; credentialed transport vs cookieless for Ads/Floodlight)._

## Open questions

- Does MP-only reach GA4 console-level parity, or is the additive `/g/collect` connector required?
- Is the MP `api_secret` browser-exposure acceptable for a public property, or does it force the gtag-protocol path?
- Can Ads/Floodlight conversion pings reach attribution parity off-thread, and does that require the E10 credentialed
  transport?

## Conclusion

_Open._ Promoted to: — (feeds MVP7's GA4-parity decision + the E10 transport ADR, and MVP8's Ads/Floodlight connector
scope; promote to those specs/ADRs as it settles).
