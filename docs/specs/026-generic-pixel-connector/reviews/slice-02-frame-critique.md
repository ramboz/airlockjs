---
slice: 026-02 — more vendors as configs: the archetype generalises across real GET pixels
pass: frame-critique
verdict: pass
reviewer: jig:reviewer (independent, 2 rounds)
reviewed_at: 2026-09-03T00:45:51Z
prompt_source: review.py frame-critique
---

Frame-critique (026-02 — more vendors, pre-implementation) — FAIL → PASS after one reframe.

- v1 FAIL: the added POST/JSON proof (AC4) — expressing GA4's Measurement-Protocol shape as a generic-pixel config
  "to prove both wire shapes" — was internally contradictory against the shipped 026-01 connector, on three
  source-grounded counts: (1) GA4-MP's body is nested/arrayed/splatted (connectors/ga4/map.js:68-72), which the
  interpreter's FLAT scalar paramMap (connectors/pixel/connector.js:136-144) cannot express — a body-map for it is
  a whole new nested DSL, not "one anticipated extension"; (2) a real MP body needs client_id/session_id from ctx,
  which the pixel connector is STRUCTURALLY designed never to read (connector.js:44-46,125 — the AC8 invariant the
  026-01 craft review praised); (3) R-007 has ZERO POST pixels (R-007:43; all ~10 are GET image beacons) — so POST
  is speculative (YAGNI) and GA4-MP the worst target. The GET half (LinkedIn + Bing as flat configs) was sound.
- Reframe (MUST-FIX 2): POST cut entirely + deferred to 026-03 (which pins the config contract + the ctx/identity
  surface a body needs; or a later slice when a real POST pixel appears). 026-02 scoped to the two real GET vendors
  as flat configs with ZERO connector code (both git diff connectors/pixel/connector.js AND git diff core/ empty);
  wire-method named as a future axis. The reframe note cites the exact source evidence.
- PASS: the internal contradiction is gone (no body → no ctx → AC8 preserved); nothing new broke (AC count
  consistent; empty-diff assertions now achievable); the remaining frame is exactly the GET-generality thesis the
  reviewer already deemed de-risked (both vendors are flat GET query strings the scalar interpreter handles; uetq
  is client-side SDK batching not a wire format; the honest-finding escape valve retained). One non-blocking prose
  nit (AC1 borrowed Meta's id/ev vocabulary for LinkedIn) fixed to LinkedIn's real pid/conversionId keys.
