---
slice: 050-01 — the reference-site `?martech=airlock` rewire arm
pass: frame-critique
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-09-16T01:41:52Z
prompt_source: review.py frame-critique <spec> 050-01 <slice-01.md> (re-run after reframe)
---

Frame-critique pass (pre-implementation, adversarial) — RE-RUN after reframe. Reviewer: read-only `jig:reviewer`.

VERDICT: pass

The frame survives the strongest attack. The prior `needs-changes` (container runtime-load shape asserted as three
separable `?id=` gtag runtimes, unprobed) is **resolved by probe**: `rig/erp-runtime-waterfall.mjs` (`npm run
rig:erp-waterfall`), a public headless load of `erp.intuit.com`, confirms exactly three separable
`gtag/js?id=<AW-1030811807|DC-1996823|G-GCCMSJL6CT>` runtimes + `connect.facebook.net/en_US/fbevents.js` from the Tealium
`intuit/ies-erp/prod` container (stable across repeat loads). The reviewer independently verified every load-bearing
grounding:

- **Container structure** — the committed probe rig genuinely distinguishes SEPARABLE from UNIFIED; real grounding.
- **Transport carve-out (AC3)** — shipped 049-02 code: `adapters/eds/tag-suppressor.js` `shouldSuppressBeaconCompiled`
  exempts `fetch`+`keepalive===true` unconditionally; `core/egress.js` `fetchInit` confirms airlock's egress is exactly that
  shape; allow-before-suppress precedence holds. No ADR-0030 change needed (its `/mp/collect` example is the non-page-feasible
  GA4-MP variant).
- **Runtime-kill suppresses native beacons + goldens stay green (A4)** — ADR-0029 kill criteria, forward-validated in-slice
  with the beacon-matcher backstop; A4 de-risked by the probe (three vendors on their own runtimes, separate from the other
  ~14 `utag.N.js` templates).

Non-blocking note (FOLDED IN): the reviewer observed A2 leaned on the *passive* rig (proves the arena is reachable/loadable)
where AC3/AC4/AC5 require *deploying + exercising* the after-arm. A2 now makes the exercise mechanism explicit — deploy the
`?martech=airlock` gate to the prod-profile host via the developer's own EDS deploy (ADR-0029: page-side, deploy-controlled,
distinct from the container-owner gate). The reviewer flagged this as the point where, if ADR-0029's developer-owns-deploy
premise were itself shaky, the whole spec would be misdirected — but ADR-0029 is Accepted, so it is a settled known-residual,
not a fresh flaw.
