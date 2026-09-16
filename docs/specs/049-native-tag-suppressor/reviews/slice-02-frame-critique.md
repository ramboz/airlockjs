---
slice: 049-02 — direct-beacon-transport suppression (egress-parity completeness)
pass: frame-critique
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-09-15T19:55:55Z
prompt_source: custom frame-critique (slice 049-02)
---

Frame-critique pass on slice **049-02 — direct-beacon-transport suppression** — reviewer `jig:reviewer`; two rounds.

**Round 1 (verdict: revise — frame NOT sound).** The load-bearing assumption — binding 049-01's URL/query matchers to the
beacon transports to suppress the container's direct beacon WHILE carving out airlock's own egress — breaks for a
PARITY-REPRODUCED beacon (the slice's own "sole emitter" goal). airlock reproduces Meta `/tr` + gtag `/g/collect` at the
container's byte-identical URL, so the URL matcher cannot separate airlock's copy from the container's (an `allow` protects
both; a `suppress` drops both). AC2 also had the transports backwards (labeled airlock's pixel `/tr` as `<img>` when airlock
uses `fetch`). The one real discriminator is transport-of-emission — airlock emits via main-thread `fetch`/keepalive, never
`<img>`/`sendBeacon`/`XHR`.

**Resolution (redesign, pre-implementation, in the DRAFT).** The carve-out is now transport-of-emission: airlock emits EVERY
own beacon via `fetch(url,{keepalive:true})` (grounded `core/egress.js` `fetchInit`; no `Image`/`sendBeacon`/`XHR` in
airlock's own main-thread code), so the beacon-block EXEMPTS `fetch`+`keepalive` and SUPPRESSES the container's
`<img>`/`sendBeacon`/`XHR`/non-keepalive-`fetch` at the same URL. AC2 labels fixed; the mutation test is now satisfiable
(remove the keepalive exemption → airlock's own keepalive-fetch beacon dropped → red — impossible under the old symmetric
framing). AC1 patches the full image-src surface (`.src`/`setAttribute`/`srcset`). `arch_review` flipped false→true (a public
carve-out contract change). Escape vectors + the same-URL keepalive-fetch collision scoped as fail-safe residuals.

**Round 2 (verdict: PASS).** The reframe resolves the flaw + introduces no new one; both grounding claims (A-transport,
A-collision) verified against source; the AC2 mutation test is now satisfiable. Non-blocking notes folded: the
residual-honesty clause tightened (the golden's `fetch`-shaped beacons are runtime-emitted → killed by 049-01, so the
same-URL collision cannot bite the four-runtime-vendor MVP9 trial); an IMPLEMENTATION note carried forward — the exemption
must key on airlock's exact `fetch(urlString, initObject)` shape (`init.keepalive === true`); a `fetch(new Request(url,
{keepalive:true}))` reads `arguments[1]` as undefined → treated non-keepalive (harmless: airlock never uses the Request
form; the rig asserts against airlock's actual `fetch(url, fetchInit(...))` shape). Deviation-log fodder: the `arch_review`
flip + the transport-of-emission carve-out dimension beyond 049-01's URL-only allow-set → record against ADR-0030 at
close-out.

**VERDICT: pass.**
