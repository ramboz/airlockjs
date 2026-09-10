---
slice: 041-01 — gtag connector boots + egresses (Connector wrapper + chamber + createAirlock branch + minimal boot)
pass: frame-critique
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-09-10T00:59:33Z
prompt_source: review.py frame-critique docs/specs/041-ga4-gtag-boot/spec.md 'connector boots' slice-01-connector-boot.md
---

VERDICT: pass

## Reasoning

The single load-bearing assumption — a boot-frozen `config.ctx` is an honest first cut for 041-01, with live
consent/session carriage deferred — survives the strongest attack. It is grounded in an accepted, documented residual
(`core/airlock.js:589` "017-01's deferred worker `ctx` re-send… stays deferred"; `docs/refinement-todo.md:222-232` — the
worker ctx is a frozen structured-clone snapshot at init, mid-session update needs a new worker message type), which the
already-shipped GA4-MP connector lives under (`createGa4Connector`'s no-op `init`, boot-frozen `cid`/`sid`). The
main-thread seal still updates live via `setConsent`; 041-01 emits only boot-stable fields (`v`/`tid`/`cid`/`sid`);
`gcs`/`gcd`/session-state are explicitly deferred to 041-02. Not a dead-end — gtag's pure-mapper `handle`
(`gtag.js:335-337`) makes a future ctx re-injection lossless. Secondary assumptions also hold: the chamber init strips
the discriminant and passes the rest as `config` (so a verbatim-`connectorConfig` branch carrying `ctx` reaches
`config.ctx` in-worker, unlike the named-field MP branch); `withholdFetch:true` is correct (gtag `handle` returns
`method:"GET"`, fetch is main-thread).

## Specific issues (both folded, non-blocking)

- Boot-snapshot ctx: grounded in the 017-01 residual the MP connector already shares. **[FOLDED: the Assumptions now
  point to `airlock.js:589` + `refinement-todo.md:222-232` and note MP shares the freeze + the lossless future
  re-injection.]**
- `purposes.egress: analytics_storage` mirrors MP, but MP's "no ads signal it emits" justification doesn't literally
  hold for gtag (which carries `gcs`/`gcd` ad-consent STATE). The distinction is sound (gcs/gcd communicate consent
  decisions, don't perform ad egress; the beacon is analytics). **[FOLDED: AC1 now instructs the manifest comment to
  record gtag's OWN rationale rather than inherit MP's wording — the point where the two connectors diverge.]**
