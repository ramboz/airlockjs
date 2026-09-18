---
status: Proposed
dependencies: [adr-0007, adr-0023, adr-0031, adr-0032]
last_verified: 2026-09-18
frame_review: true
---

# ADR-0035: Prerender as a seal hold reason + speculative decision prefetch defaults

## Status

Proposed (2026-09-18) — **accept only after the prerender probe** on the EDS testbed records its findings; see
Assumptions and Kill criteria.

## Context

Chrome speculation rules change the economics of eager personalization more than any other lever, and airlock has not
accounted for them. A prerendered page runs its eager phase while nobody is watching, and Chrome reports LCP relative to
`activationStart`, so a hero personalized before activation costs nothing the user can see — which is why
[ADR-0032](./adr-0032-eager-paint-policy-and-flag.md) forces `blocking` under `document.prerendering`. But prerendering
also **inflates counts**: every beacon, display notification and exposure fired during a prerender that is later discarded
is a phantom. aem-experimentation and aem-martech both handle this ad hoc (`onPageActivation` wrapping their RUM/alloy
calls). `docs/architecture.md` AD-9 says airlock's egress is "prerender-aware (held until activation)", but a search of
`core/`, `adapters/`, `connectors/` and `test/` at `2bccb2c` finds **no prerender or activation handling** — the hold is
declared, not implemented.

Speculation also opens a **decision cache**: propositions fetched for a likely next page (from the document's own
speculation rules, from hover/pointerdown on a same-origin link, or from an idle worker) make the hero decision instant on
navigation. Target experiences are sticky per profile, so a recent decision is usually still right. The trade-offs are
staleness (a just-ended activity shows once more), **profile side effects** (a speculative interact still updates the
Target profile and can trigger AJO journeys), and Target server-call volume.

## Decision Options Considered

### Hold mechanism

- **Option H-A (chosen): prerender is a hold reason at the seal**, alongside pending consent (ADR-0023). Egress is split
  by purpose: **decisioning fetches flow** (that is the point of prerendering), everything else — page views, display /
  interact notifications, exposure to any sink — is **held until `prerenderingchange`** and **dropped if the prerender is
  discarded**. One rule for every connector.
  - Pros: makes AD-9 true structurally; reuses the hold/flush/drop machinery; no per-connector special-casing.
  - Cons: the seal must learn a second hold reason and a "drop on discard" outcome; decisioning egress needs a purpose tag
    the seal can distinguish.
- **Option H-B: per-connector `onPageActivation` wrapping** (the aem-experimentation pattern).
  - Pros: trivial per connector. Cons: every connector re-implements it; misses are silent count inflation.
- **Option H-C: no hold** — rejected (phantom counts).

### Prefetch and cache defaults

- **Cache policy per placement: `off | fresh-only | stale-ok(+TTL)`, default `fresh-only`.** `fresh-only` still serves a
  decision at zero latency when this session's head fetch or a prefetch already delivered it; `stale-ok` is the marketer's
  explicit acceptance that a just-ended activity may show once more. **Stale never swaps** (ADR-0031): a revalidated
  decision lands on the *next* view.
- **Prefetch triggers:** the document's own `speculationrules` URLs; `pointerover`/`pointerdown` on same-origin links
  (cross-browser "moderate eagerness", ~one RTT of head start); idle-worker prefetch for in-viewport links. **Default
  eagerness `moderate`/`conservative`; `immediate`/`eager` opt-in** (server-call volume, profile side effects).
- **Prefetched interacts are fetch-shaped** (`decisioning.propositionFetch`, no page-view XDM) and never emit display
  until rendered — impressions count on display, so prefetch does not inflate reports; profile side effects remain and
  are a vendor question (Assumptions).
- **Personalization-driven speculation** (a JSON offer naming URLs to prerender, applied as a capped `speculationrules`
  op: same-origin, allowlisted, small N) is **recorded as a later option**, not decided here.

## Recommended Decision

**H-A for the hold; the cache/prefetch defaults as stated**, both gated on the probe. RUM and the CWV scoreboard subtract
`activationStart` from LCP/FCP and report `lcp_hold_ms = 0` for prerendered navigations.

## Consequences

**Becomes easier:**
- Speculated navigations get pre-paint hero personalization at zero perceived cost, and blocking is free there.
- Phantom-count prevention is one seal rule, provable once for every connector.

**Becomes harder:**
- The seal grows a second hold reason and a discard path; ADR-0023's remap-on-flush semantics must be preserved for
  beacons held for both reasons.
- Cache invalidation and TTL semantics become adopter-facing config.

## Assumptions (to be retired by the probe before acceptance)

- **A dedicated Worker runs inside a Chrome prerendered page** and `fetch` is permitted; several APIs are deferred until
  activation and cross-origin iframes are delayed (Chrome "Prerender pages" documentation). **Not probed.**
- **`prerenderingchange` fires exactly once on activation; a discarded prerender fires nothing** — documented; the probe
  must show held beacons flush once and never on discard.
- **LCP for a prerendered page is reported relative to `activationStart`** — documented (`web-vitals`); probe reads it.
- **A speculative `propositionFetch` updates the Target profile / can trigger AJO journeys** — plausible from how the Edge
  processes events; **needs Target/AJO team confirmation** before prefetch defaults are enabled.
- **Impressions count on the display notification, not the fetch** — Web SDK documentation; consistent with
  `sendDisplayEvent:false` semantics.

## Kill criteria

- The Worker does not boot, or `fetch` is blocked, in a prerendered page → drop the "free blocking" rule in ADR-0032 and
  re-scope to prefetch-only.
- Held beacons cannot be reliably dropped on discard → H-B for the connectors that matter, supersede.
- Vendors confirm speculative fetches materially pollute profiles/journeys with no fetch-only mode → prefetch defaults
  become `off`; cache stays for same-session reuse only.

## Open questions

- Purpose tag for decisioning egress so the seal can let it through while holding notifications.
- Whether `helix-rum-js` already subtracts `activationStart`.
- TTL default for `stale-ok`.
