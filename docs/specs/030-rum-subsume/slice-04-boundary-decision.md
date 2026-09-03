---
status: DRAFT
dependencies: [030-02, 030-03]
last_verified:
---

## Slice 030-04 — the scoped-replace boundary + the decision landed

**Goal:** Land the MVP4 helix-rum **feed/replace/coexist** decision as **replace (core checkpoints)** and
document the **honest adoption boundary** — what "airlock replaces your RUM tag" covers vs what it does not — so
an integrator (and the release plans) have a clear, honest contract. Closes spec 030.

**DoR:**
- ☐ 030-02 + 030-03 DONE (the governed RUM authority + the demonstrated replace exist).

**Acceptance Criteria (draft — sharpened at READY):**

1. **The decision is landed** in `docs/decisions/lightweight-decisions.md`: airlock **replaces** the RUM tag for
   the **core checkpoints** (`top`/`error`/`cwv`) where a deployment wants one governed off-thread authority;
   feed/coexist remain available; this resolves the MVP4 open feed/replace/coexist item.
2. **The honest boundary is documented** (an adopter-facing doc / the connector README): "replace" covers
   `top`/`error`/`cwv`; it does **NOT** reproduce the enhancer's interaction/lifecycle checkpoints
   (`click`/`viewblock`/`enter`/`navigate`/`formsubmit`/… → worker-dom compat layer or a community connector);
   a deployment needing those keeps `sampleRUM` or waits.
3. **The creds-gated live gate is named** — a real production cutover must first confirm the live `ot.aem.live`
   collector accepts airlock's `cwv` superset shape (never verified live); recorded as a hard, named deferral,
   with the in-repo demonstration (030-02) distinguished from a real cutover.
4. **The integrator drop-in path** is documented (how to switch `aem.js` from `sampleRUM` to `bootHelixRum`).
5. Primer hygiene on spec close: update the release plans / MVP5 status where they name the RUM subsume.

**DoD:** _standard (see 030-01); full ACs sharpened when this slice reaches READY. Closes spec 030._

**Anti-horizontal-phasing check:** after this slice an integrator has an honest, bounded "airlock replaces your
RUM tag" contract — the core checkpoints covered, the interaction/lifecycle set + the live wire-shape honestly
deferred. Closes spec 030 / resolves the MVP4 feed-replace-coexist decision.
