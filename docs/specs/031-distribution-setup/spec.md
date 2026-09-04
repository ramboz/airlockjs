---
status: DONE
skill:
use_cases: []
---

<!-- jig self-defining vocabulary (soft, forward-only): expand each acronym on first use and link the term to docs/memory/glossary.md (or jig's lexicon). See docs/workflow.md "Self-defining vocabulary". -->

# Spec 031: Distribution setup

> Downstream of [ADR-0015](../../decisions/adr-0015-distribution-git-subtree.md) (git-subtree of ready-to-serve
> built artifacts). The MVP6 risk-first item: everything downstream (the 1.0 pin's versioning, the real-site
> validation) consumes through the channel this spec builds. See [MVP6 release plan](../../releases/mvp6.md).

## Overview

ADR-0015 decided airlock's primary distribution channel: **git-subtree of ready-to-serve built artifacts** for
the buildless EDS audience (npm deferred, not rejected). This spec makes that real — it turns the decision into a
consumable channel and **proves the mechanism the ADR left asserted**.

Today the build ([`build.mjs`](../../../build.mjs)) emits its N+1 sibling-worker tree straight into
`probes/eds-testbed/scripts/airlock/` — the testbed reaches airlock by *direct build-emit*, not a subtree pull.
So no artifact yet demonstrates that a real EDS site can `git subtree add` airlock and boot it. This spec:

1. Decouples the build's distributable output from the testbed into a **first-class, ready-to-serve tree** and
   **publishes it to a dist-rooted ref** (a `dist` branch/tag whose root *is* the artifacts) a consumer can
   `git subtree add`, and
2. Proves — on a **clean EDS checkout** (not the testbed's emit path) — that a `git subtree add` of that ref
   **boots airlock same-origin with no build step, CWV preserved**, and that a later `git subtree pull` **updates
   cleanly**.

**Scope boundary — this is the *mechanism* proof, not the customer-prod proof.** The adoption proof here runs on a
**clean EDS-boilerplate fixture**. Validating airlock's supported connectors on the **actual customer production
site** is a *separate* MVP6 item (the real-production-site validation), gated on that stack's availability — it is
not in this spec. Likewise, the **config-driven instrumentation ergonomics** ("a few lines + a rich JSON config")
is a **separate follow-up spec**; 031 ships the consumption channel, not the authoring surface. The 1.0 API
stability pin (which would freeze the distribution layout + any config schema) is also its own later MVP6 item —
this spec's surfaces stay **pre-1.0**.

## Assumptions

<!-- Spec 064-02 / ADR-0020 §1–§2 — grounding-by-probe (risk-gated). -->

- The build emits N+1 **self-contained, same-origin sibling** bundles (`eds.js` + `chamber.worker.js`,
  `pixel-chamber.worker.js`, `dom-chamber.worker.js`, `helix-rum-chamber.worker.js`) into
  `probes/eds-testbed/scripts/airlock/`, and asserts no `blob:`/`data:` worker on every build — **grounded** (read
  [`build.mjs`](../../../build.mjs) this session; `OUTDIR`, `WORKER_ENTRIES`, the positive/negative assertions).
- **The core bet (slice 031-01 pins + proves it):** `git subtree add --prefix` sets the *local* landing path and
  pulls a ref's **root** (not a remote subdirectory), so airlock must **publish its generated servable tree to a
  dist-rooted ref** (a `dist` branch/tag whose root IS `eds.js` + the worker siblings) — a clean EDS checkout then
  `git subtree add`s THAT ref and boots same-origin with no build step (the runtime's `new Worker(new
  URL('./x.worker.js', import.meta.url))` resolves to a same-origin file URL under the 004-01 CSP envelope).
  ADR-0015 delegated "the exact served-artifact layout" to this spec; the mechanism is **unproven until 031-01's
  rig** exercises the real publish → add → boot path (not a scratch root).
- **The update bet (slice 031-02 proves it):** `git subtree pull` **overwrites** the generated (non-mergeable)
  tree wholesale — treating it as a *generated release*, per ADR-0015's "Becomes harder" note — sidestepping the
  bundle-merge-hostility the ADR-0015 frame-critique flagged. Unproven until 031-02.

## Decomposition

**SPIDR — Path split** (happy path first, second path later). The "user" is an **EDS site integrator** adopting
airlock; end-to-end value = *"I can get airlock into my site and it boots (and keep it updated)."*

- **P — Path.** 031-01 is the **install** path (happy path): build a first-class distributable + `git subtree add`
  → boot on a clean EDS checkout, CWV preserved. 031-02 is the **update** path: a versioning marker + `git subtree
  pull` → clean re-land. Each slice is vertical (integrator-facing, end-to-end).
- **Not a Spike.** The subtree-serve-boot mechanism is *buildable*, not a research unknown — the proof is 031-01's
  acceptance criterion (a rig), not a timeboxed investigation. Resisting the eager-spike default (SKILL.md).
- **Deferred by ADR-0015:** non-EDS/bundler adapters and npm publication (the second channel for the future
  bundler audience) — out of scope here.

## Slices

- [031-01 — the distributable build target + subtree-install proof (boots on a clean EDS checkout, CWV preserved)](slice-01-distributable-build-and-install.md)
- [031-02 — the update path: versioning marker + `git subtree pull` (generated-release overwrite)](slice-02-update-path.md)
