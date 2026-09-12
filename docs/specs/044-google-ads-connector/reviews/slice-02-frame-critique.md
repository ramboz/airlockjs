---
slice: 044-02 — g-ads opts into hold-until-granted (denied-consent parity)
pass: frame-critique
verdict: pass
reviewer: general-purpose (jig frame-critique, opus)
reviewed_at: 2026-09-12T17:15:14Z
prompt_source: review.py frame-critique docs/specs/044-google-ads-connector/spec.md 044-02 <slice>
---

VERDICT: pass (two secondary notes folded before recording)

REASONING:
The single load-bearing assumption — g-ads' denied-consent parity is "hold-then-re-map-on-grant," provable as a vertical slice at the seal-config level without production boot — decomposes into three sub-claims, all of which survive attack:
(a) *denied = hold* is grounded on a real Playwright reject-all re-capture (R-009 §(b): ad-family 23→2, Google Ads "none — fully held," only GA4 cookieless — docs/research/R-009-gtag-family-fidelity.md:162-181), settled in accepted ADR-0023 A2;
(b) the re-map is feasible because the g-ads connector is pure and strictly 1:1 event→beacon (connectors/google-ads/connector.js:163-166), so ADR-0023's "one request per held item" limit never bites, and a main-thread `remap` can re-source ctx (cookies.js:90-99) + re-encode gcs/npa from the passed vector (connector.js:65-68,96-98);
(c) it is a genuine vertical slice, not the 045-01 orphaned-channel flaw, because 044-02 supplies BOTH halves — the producer (`handle` attaches `event`) and the consumer input (g-ads `remap`) — activating the already-landed seal (core/airlock.js) end-to-end via the existing FakeWorker pattern, exactly as test/consent-seal.test.js:300 reserves for this slice. Boot deferral mirrors the accepted 044-01 precedent (039→041). The frame is well-grounded and survives the strongest attack.

SPECIFIC ISSUES:
- [strength][spec] PRIMARY — "denied AW egress = hold at the seal, then re-map on grant, provable pre-boot" is sound. The attack (deferring boot orphans the opt-in) fails: 044-02 wires a real producer AND a real consumer; the landed seal + FakeWorker harness prove connector→held→re-mapped-flush without production boot (test/consent-seal.test.js:301-382). Non-opted-in GA4/pixel untouched by construction — the seal reads `r.event` only under `canRemap = holdOnDenied && remap && r.event != null` (core/airlock.js:452), and 044-02 edits only connectors/google-ads/.
- [nit][spec] SECONDARY (FOLDED) — AC2/AC4's "flushed beacon carries a fresh `auid`" over-claimed vs the §A5 residual: on a real container-removed page nothing writes `_gcl_au`, so `auid` is absent both under denial and after grant; the load-bearing re-map correctness is the `gcs`/`npa` flip (from the consent vector, always available), not auid presence. FOLDED: AC2/AC4 now cite §A5 and scope the fresh-auid assertion to in-test (synthetic cookie), naming the gcs/npa flip as the live-page-relevant correction.
- [nit][spec] SECONDARY (FOLDED) — the seal-level FakeWorker test does not exercise the real worker→main structured-clone of `EgressRequest.event` (onmessage invoked with an object literal, test/consent-seal.test.js:320-321). Low-risk (AirlockEvent is plain, clone-safe data) and belongs to the deferred boot slice. FOLDED: new Assumption A2 names both the boot-wiring deferral and the postMessage-clone edge as deferred-to-boot.

RECONCILIATION NOTES:
Both secondary notes folded into the slice before recording (AC2, AC4, and a new A2). The frame is ready for implementation.

---
Reviewer substrate: general-purpose subagent (Opus), read-only, jig adversarial frame-critique rubric. Verified against the landed 045-01 mechanism (core/airlock.js, core/consent.js, contracts/connector.d.ts), the g-ads connector surface (connectors/google-ads/{connector,cookies}.js), R-009 §(b), and ADR-0023.
