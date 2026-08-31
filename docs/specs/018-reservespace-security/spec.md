---
status: DRAFT
skill:
use_cases: [UC-1]
---

<!-- jig self-defining vocabulary (soft, forward-only): expand each acronym on first use and link the term to docs/memory/glossary.md. -->

# Spec 018: `reserveSpace` security — the `fill` sanitizes active markup, not just "trusts the TT policy"

## Overview

The MVP2 `reserveSpace` DOM-injection capability ([`adapters/eds/dom.js`](../../adapters/eds/dom.js),
spec 012-03) fills a pre-reserved layout box with a personalization decision's HTML. Its `fill(content)`
writes through a `setContent` seam whose **default is raw `innerHTML`** (dom.js:96-98). The 012-03 craft
review flagged this as the release's one **load-bearing security debt** (refinement-todo item **k**,
[mvp3.md](../../docs/releases/mvp3.md) Risk-First security-trust-boundary): `innerHTML` does not execute an
inserted `<script>`, but **`on*` event-handler attributes survive** (`<img src=x onerror=…>`,
`<div onmouseover=…>`), as do `javascript:` URLs — so a compromised chamber / a malicious Target offer / a
tampered Edge response (all **inside airlock's threat model** — the chamber is untrusted, AD-5) can inject
**active markup** through the one mediated DOM path.

**The load-bearing correction this spec exists to make (grounded, not assumed).** The 012-03 code comment
(dom.js:87) and the capability contract ([capability.d.ts:103-105](../../contracts/capability.d.ts)) say the
`innerHTML` write is *"Trusted-Types-safe … the EDS default TT policy accepts it (R-005)."* **Read literally
that is a false sense of security.** Trusted Types under the EDS boilerplate
(`require-trusted-types-for 'script'`, R-005:79) makes the raw-string→`innerHTML` write **not throw** — it is
a **compatibility** gate, not a sanitizer. Grounded against the actual EDS `default` policy
([`probes/eds-testbed/scripts/scripts.js:61-78`](../../probes/eds-testbed/scripts/scripts.js)): its
`createHTML` strips `<script>` **only** when `sink.includes('createContextualFragment' | 'Document write')`
and strips `iframe[srcdoc]` — for the **`Element innerHTML` sink it returns the input essentially unchanged**
(no `on*` stripping, no `<script>` stripping). So "rely on the EDS TT policy" leaves the `on*`-handler
surface **wide open**. The sanitizer must be **airlock's own**, running in `setContent` **before** the write —
TT then stringifies an already-clean value.

**What this spec delivers.** `setContent`'s default becomes **sanitize-then-write**, not raw `innerHTML`: a
vendor-neutral, DOM-parser-based `sanitizeHtml` that neutralizes the active-markup surface (`on*` attributes,
`javascript:`/`vbscript:`/`data:text/html` URLs on active attributes, `<script>`/`<iframe>`/`<object>`/
`<embed>`/`<base>`/`<meta>`/`<link>` elements) on an **inert** `DOMParser` parse, re-serialized to a clean
string. It stays **injectable** (a deployment hosting genuinely untrusted content slots DOMPurify + a strict
TT policy via the same `setContent`/`sanitize` seam) — the airlock default is **conservative
defense-in-depth, not a complete XSS guarantee** (the security-MUST posture in CLAUDE.md: guardrails are
defense-in-depth, not a guarantee). It is safe **by default**: today a caller must *know* to pass a sanitizing
`setContent`; after this spec, `fill()` is sanitized unless a caller opts out.

**Also folded in — the tracked `reserveSpace` hardening nits (f, g, i).** The same-surface robustness debt from
the 012-03 review rides in slice 02 so the DOM-injection capability lands production-clean in one arc:
**(g) overflow-clip** so an over-tall fill *clips* rather than reflows (closing the "layout-stable is
conditional on `minHeight >= decision height`" honest boundary, dom.js:117-122); **(i) a shared
proposition/`content` accessor** extracted from the two sites that re-narrow it
([`connectors/alloy/decisions.js`](../../connectors/alloy/decisions.js) `propositionOf`/`htmlOfDecision` +
[`adapters/eds/decisions-exposure.js`](../../adapters/eds/decisions-exposure.js) `propositionOf`);
**(f) `decisions.fetch` not-built loudness** + a `contract-stability` pin for `DomHandle`/`decisions`.

**Not in scope (named, deferred).** **(h)** production **eager-phase wiring** of `reserveSpace` into the EDS
pre-paint window — this spec secures the *capability's default*; wiring a real production caller is a separate
adapter-integration concern (the capability is contract-pinned and rig-demonstrated, not yet
production-wired, refinement-todo h). **(j)** the DOM-writer-invariant `core/` migration (OQ13). The
wrapped-SDK **`eslint-disable` scope** + **dead-man-fetch guard** nits (they live in
[`connectors/alloy/alloy-chamber.worker.js`](../../connectors/alloy/alloy-chamber.worker.js), a chamber file,
not the `reserveSpace` surface) — carried on refinement-todo, not this spec's DOM-injection surface. The
**fetch-shim timeout** nit is already **DONE** (014-01). Genuinely-untrusted-content hardening (mutation-XSS,
a full allowlist sanitizer) is the injectable-seam's job, not the airlock default.

## Assumptions

<!-- Grounded 2026-08-30 by reading adapters/eds/dom.js, contracts/capability.d.ts,
     probes/eds-testbed/scripts/scripts.js, connectors/alloy/decisions.js,
     adapters/eds/decisions-exposure.js, test/eds-dom-reserve.test.js, docs/research/R-005; risk-gated. -->

- **`setContent`'s default is raw `innerHTML` today.** Grounded: dom.js:96-98 —
  `opts.setContent` or `(el, content) => { el.innerHTML = content }`. So `fill()` is unsanitized unless a
  caller passes a sanitizing `setContent`. **Grounded.**
- **The EDS default TT policy does NOT sanitize the `innerHTML` sink.** Grounded against the actual policy
  (`probes/eds-testbed/scripts/scripts.js:61-78`): `<script>` removal is gated on the sink being
  `createContextualFragment`/`Document write`; the `Element innerHTML` sink passes through (only
  `iframe[srcdoc]` is stripped). TT under `require-trusted-types-for 'script'` (R-005:79) is a
  **compatibility** gate (the write doesn't throw), not an active-markup sanitizer. **Grounded.**
- **`innerHTML` does not execute an inserted `<script>`, but inline `on*` handlers and `javascript:` URLs
  fire.** Standard HTML behaviour (external domain knowledge, universally documented): `<script>` inserted
  via `innerHTML` is inert, but `<img src=x onerror=…>` / `<svg onload=…>` / `<a href=javascript:…>` are the
  live vectors. This is the surface item **k** names ("`on*` handlers survive"). **Domain knowledge, stated.**
- **`DOMParser.parseFromString(html, "text/html")` is inert.** Parsing does not execute scripts or fetch
  resources (no `<img>` load, no `<script>` run) — it builds a detached document. Standard, and it is the
  safe way to walk+strip untrusted markup before assigning. `DOMParser` is a main-thread global; `dom.js` is
  the **main-thread** host adapter (it already DI's `doc`), so it is available (and DI-able for the Node/
  vitest unit tests, mirroring the existing `fakeDoc`/`fakeEl` shim in test/eds-dom-reserve.test.js).
  **Grounded** (adapter is main-thread; verify `DOMParser` availability/DI at implementation).
- **A hand-rolled denylist sanitizer is defense-in-depth, not a complete XSS defense.** Mutation-XSS and
  parser-differential bypasses are why DOMPurify exists; airlock ships vanilla ES modules (no runtime
  dependency, architecture § Stack), so the **default** sanitizer is a conservative active-markup neutralizer
  and the seam stays **injectable** for a stricter policy. Framed honestly, not as a guarantee. **Grounded**
  (architecture constraint) + **domain knowledge** (mXSS).
- **`reserveSpace().fill()` has no production caller yet (rig-demonstrated).** Grounded: refinement-todo **h**
  ("the rig proves the mechanism, not the production wiring"). So this spec secures the capability's
  **default behaviour**; it does not depend on, and does not add, a production caller. **Grounded.**
- **Two sites re-narrow a proposition/`Decision.content` (item i).** Grounded: `connectors/alloy/decisions.js`
  `htmlOfDecision`/`extractDecisions` and `adapters/eds/decisions-exposure.js` `propositionOf` both unwrap
  `{ content }` → proposition. Rule-of-three reached (2 copies + this touch). **Grounded.**

## Decomposition

SPIDR = **Rules (R)** — the boundary rule that governs what `fill` is allowed to write. Split by
**security-first**: the load-bearing **active-markup sanitizer** (item k — the one that turns an open
`on*`-handler injection into a neutralized write) first, then the **hardening nits** (g overflow-clip, i
shared accessor, f `decisions.fetch` loudness + contract pin) that harden the same capability's edges. Each
slice touches the user-facing DOM-injection capability end-to-end (a decision's HTML → a filled box), so
neither is horizontal: 01 changes what bytes reach the DOM (a stripped `onerror` is observable in the filled
box); 02 changes the box's overflow behaviour + the contract surface a connector author sees.

- **018-01 `[R]` the active-markup sanitizer boundary (the load-bearing security point)** — `setContent`'s
  default becomes sanitize-then-write; a vendor-neutral `sanitizeHtml` (inert `DOMParser` parse → strip
  `on*` / `javascript:`-family URLs / `<script>`/`<iframe>`/`<object>`/`<embed>`/`<base>`/`<meta>`/`<link>` →
  serialize) runs before the `innerHTML` write; the seam stays injectable; the honest defense-in-depth
  boundary is documented. E2E: a decision carrying `<img src=x onerror=alert(1)>` fills the box with the
  handler **stripped**; a benign `<div class=hero>…</div>` fills **unchanged**; a caller can still inject a
  stricter `setContent`/`sanitize`.
- **018-02 `[R]` `reserveSpace` hardening — overflow-clip + shared accessor + contract loudness** — (g) the
  reserved box gets an overflow-clip so an over-tall fill clips instead of reflowing (CWV-safe by
  construction, not just by host-config discipline); (i) a single shared proposition/`content` accessor
  replaces the two re-narrowing sites; (f) `decisions.fetch` is made loud-not-built (reject/throw like
  `insertAfterInteraction`, not docstring-only) and `DomHandle`/`decisions` are pinned in
  `contract-stability.test.js`. E2E: an over-tall decision fill leaves surrounding geometry unchanged
  (clipped, not reflowed); the shared accessor drives both exposure + html extraction; a `decisions.fetch`
  call fails loudly.

## Slices

1. [018-01 — the active-markup sanitizer boundary](slice-01-sanitizer-boundary.md)
2. [018-02 — reserveSpace hardening (overflow-clip + shared accessor + contract loudness)](slice-02-hardening.md)
