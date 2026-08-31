---
slice: 017-01 — data-use consent reshape + the consent machinery (the grounded first point)
pass: frame-critique
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-08-31T01:26:39Z
prompt_source: review.py frame-critique 017-01 (needs-changes → applied)
---

## Frame-critique — 017-01 (data-use consent reshape) — needs-changes → applied → pass

**Finding (load-bearing):** the "reshape lands at BOTH mapping sites FOR FREE because both call
`mapToMp(event, ctx)`" claim rested on an unstated ordering constraint that AC2 actively contradicted. The
two sites are NOT symmetric: the sync fast path closes over a LIVE `ctx` reference (`core/egress.js`), while
the worker gets a STRUCTURED-CLONE snapshot of `ctx` at `init` (`core/airlock.js` postMessage init). AC2
framed the seam as a `setConsent(...)` handle method ("set/replace the vector") — callable only AFTER
`createAirlock` has already cloned the consent-LESS ctx into the worker. So the worker E2E (AC4/AC7 "both
sites") was unachievable: a post-construction setConsent reaches only the fast-path reference, never the
frozen worker clone. The boot-time both-sites claim and the deferred mid-session update are the SAME
frozen-clone mechanism.

**Applied (reviewer's prescribed fix):** pin the seam as a PRE-CONSTRUCTION consent source folded into `ctx`
in `adapters/eds/index.js` BEFORE `createAirlock({ ctx })` (parallel to the existing `sourceGa4Ctx` identity
fold), NOT a post-construction handle method. Rewrote AC2 (pre-construction fold, the ordering named
load-bearing), AC4 (both sites reached because consent is on ctx before the init-clone — the symmetry the two
sites otherwise lack), AC6 (mid-session update deferred BECAUSE it needs the worker ctx re-send — the same
frozen-clone mechanism, split cleanly at construction), + spec.md Overview + Assumptions. A live/mid-session
`setConsent` is the honest follow-up (needs a worker ctx-update message — core/airlock.js has only
init/events today).

### Net
No change to the machinery (vector state + resolver + ctx.consent reshape); what changed is WHERE/WHEN
consent enters ctx — a pre-construction fold, which makes the both-sites claim true and the mid-session
deferral coherent (same mechanism).
