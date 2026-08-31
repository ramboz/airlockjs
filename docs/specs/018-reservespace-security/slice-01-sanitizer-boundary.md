---
status: DONE
dependencies: []
last_verified: 2026-08-30
frame_review: true
---

<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about
     runnable surfaces by probe first (run it / read source) or a citation. -->

## Slice 018-01 — the active-markup sanitizer boundary

**Goal:** Make `reserveSpace().fill(content)` **sanitized by default** — `setContent`'s default becomes
sanitize-then-write instead of raw `innerHTML`, so a personalization decision carrying active markup (`on*`
handlers, `javascript:` URLs, `<script>`/`<iframe>`) cannot inject it through the one mediated DOM path. The
sanitizer is **airlock's own** (the EDS TT policy is compatibility, not sanitization — the load-bearing
correction) and stays **injectable** (a stricter policy slots via the same seam). Closes refinement-todo item
**k** / the mvp3.md release-check security criterion.

**DoR:**
- ✅ `adapters/eds/dom.js` exists with the `setContent` seam (dom.js:96-98) whose default is raw `innerHTML`;
  `fill()` (dom.js:149-153) calls `setContent(target, content)` for a string. **Grounded** (read).
- ✅ The EDS default TT policy is **compatibility-only for the `innerHTML` sink** — it does not strip `on*`
  or `<script>` for that sink (`probes/eds-testbed/scripts/scripts.js:61-78`). So airlock must sanitize
  itself. **Grounded** (read the policy).
- ✅ **The real-parse security proof runs in a Playwright rig (real chromium), NOT hermetic vitest — grounded
  substrate, frame-critique 018-01 correction.** `DOMParser` is a main-thread global, but **vitest runs in
  the Node default environment** (`vitest.config.js` sets no `environment`) where `DOMParser` **does not
  exist**, and the project ships **no** `jsdom`/`happy-dom`/`linkedom` (deliberately — the DOM tests use
  `fakeDoc`/`fakeEl` shims that store markup opaquely — `test/eds-dom-reserve.test.js:59-72`, `68-69`). A sanitizer
  fundamentally **parses→walks→strips→re-serializes**, so it **cannot** be faithfully shimmed the way
  `{ querySelector }` is — a fake parser would make the vector table green-but-meaningless (an *unverified
  sanitizer that looks verified* — worse than no test for a security primitive). And even a jsdom/happy-dom
  parse ≠ **chromium**'s for the adversarial mXSS edges, so real chromium (what production runs on the main
  thread) is the **only** faithful substrate. **Decision (no new dep — respects the project's deliberate
  no-jsdom pattern + the conventions-approval rule):** the parse→strip→serialize **vector table** (each
  stripped vector, benign round-trip, mXSS-adjacent, the AC2/AC3/AC5 security assertions) is the
  **Playwright-rig** leg — the same real-DOM-proof routing the project already uses (007-02
  `isolation_invariant`, `rig:csp`, `rig:alloy-decisions`); **node/vitest** covers only what is genuinely
  hermetic: the **pure strip-predicate helpers** (`isEventHandlerAttr` / `isDangerousUrl` / `isStrippedTag`),
  non-string/empty→`""`, the DI-parser wiring, and the injectable-override. **Grounded** (env + deps probed;
  substrate named).
- ✅ Threat model: the chamber is untrusted (AD-5); a decision's HTML originates outside airlock's trust
  boundary (a Target offer / an Edge response a compromised chamber can tamper). So sanitizing it is
  in-model, not hypothetical. **Grounded** (architecture AD-5).

**Acceptance Criteria:**

1. **`setContent`'s default sanitizes before writing.** The default `setContent` in `createDomCapability`
   (dom.js) becomes `(el, content) => el.innerHTML = sanitizeHtml(content)` (via the TT/DI write path, AC5) —
   **not** raw `content`. A caller that passes its own `opts.setContent` still overrides completely
   (injectable, unchanged). Observable: with the default seam, `fill('<img src=x onerror="alert(1)">')`
   leaves the box's content **free of the `onerror` attribute**; the `<img>` (benign) may remain.
2. **`sanitizeHtml(html)` neutralizes the active-markup surface, on an inert parse.** A new vendor-neutral
   `sanitizeHtml` (its home settled at implementation — a `core/` vendor-neutral module with a DI'd parser,
   or alongside `dom.js` in the adapter; **grounding-honest:** `core/` modules stay import-free and this one
   needs a DOM parser, so if it lands in `core/` the parser is **injected**, not imported) parses the input
   with `DOMParser` `text/html` (inert — no script exec, no resource load) and **removes**, before
   re-serializing: (a) every `on*` attribute on any element; (b) `javascript:` / `vbscript:` /
   `data:text/html` values on active URL attributes (`href`, `src`, `xlink:href`, `formaction`, `action`,
   `background`, `poster`); (c) the elements `<script>`, `<iframe>`, `<object>`, `<embed>`, `<base>`,
   `<meta>`, `<link>`. It returns a **string** (the cleaned `body` innerHTML), never throws, and returns `""`
   for non-string/empty input. Observable: each vector above is absent from the output; a benign
   `<div class="hero"><p>Hi</p></div>` round-trips **unchanged**. **Substrate (DoR pillar 4):** these
   parse→strip→serialize assertions run in the **Playwright rig** (real chromium `DOMParser` — AC5/DoD),
   because Node vitest has no `DOMParser` and a fake parser would prove nothing; the **pure** predicate
   helpers (`isEventHandlerAttr`/`isDangerousUrl`/`isStrippedTag`) + non-string/empty→`""` + the DI wiring
   are node-unit-tested.
3. **Benign authored content is preserved (no false-positive breakage).** Ordinary Target-offer markup —
   nested elements, `class`/`id`/`style`/`data-*`/`aria-*` attributes, `<a href="https://…">`, `<img
   src="https://…">`, text — survives the sanitizer byte-equivalent (modulo the parser's own normalization).
   Observable: a representative authored offer fills identically before/after, minus nothing dangerous.
4. **The seam stays injectable + the honest boundary is documented.** A deployment hosting genuinely
   untrusted content can pass a stricter `opts.setContent` (e.g. DOMPurify + a dedicated TT policy) — the
   default is **conservative defense-in-depth, not a complete XSS guarantee** (mutation-XSS / parser-
   differential bypasses are out of a hand-rolled denylist's reach; that is the injectable seam's job).
   Observable: the docstring + spec state this explicitly; a custom `setContent` fully replaces the default.
5. **Trusted-Types: the write passes under `require-trusted-types-for 'script'` — sanitize is the same step,
   not a second trust.** The default write path produces its assigned value through a Trusted-Types policy
   **whose `createHTML` runs `sanitizeHtml`** when TT is available (so sanitization and TT-stringify are one
   atomic step — there is no window where an *un*sanitized string is trusted), and falls back to
   `sanitizeHtml` + a plain-string assignment when TT is absent (non-TT browsers, the vitest shim) or when
   creating a policy throws (a restrictive `trusted-types` CSP directive — caught, not fatal). **Never breaks
   the page:** the whole write stays inside a try/catch (dom.js:98's existing swallow posture) — even the
   pathological edge (active `require-trusted-types-for 'script'` + no registered `default` policy + a blocked
   named-policy creation, where a plain-string `innerHTML` assignment would itself throw) is caught, not
   fatal. On EDS this edge does not arise (the boilerplate always registers a `default` policy, scripts.js:61,
   and 012-03 already ships the raw write under this same model), so it is not a regression — covered for
   defensiveness. **Grounding-honest:** whether airlock may create a *named* TT policy depends on the host's
   `trusted-types` CSP directive (R-005:79 shows `require-trusted-types-for 'script'` but does not pin the
   policy-name allowlist) — so policy creation is **best-effort with a sanitize-anyway fallback**, never a
   hard dependency. Observable (rig, browser): under the testbed CSP, a `fill` of a malicious offer writes the
   sanitized markup with no `securitypolicyviolation` and no thrown error; the `onerror` never runs.
6. **No behavioural regression to reserve/prehide/fill/release.** The layout-box reserve, prehide/reveal,
   timeout backstop, markers (`data-airlock-reserved`/`-filled`), and `release()` are byte-unchanged; only
   the *bytes written by `setContent`* change (sanitized). The existing `test/eds-dom-reserve.test.js` stays
   green except where a test asserted a raw-`innerHTML` passthrough of active markup (update that assertion
   to expect the sanitized result, with a comment).

**DoD:**
- [x] ACs 1–6 pass, split by substrate (DoR pillar 4):
      - **Node/vitest** `test/sanitize-html.test.js` — the **pure** logic only: the strip-predicate helpers
        (`isEventHandlerAttr` over an `on*` sample; `isDangerousUrl` over `javascript:`/`vbscript:`/
        `data:text/html` vs benign `https:`/relative; `isStrippedTag` over the tag set), non-string/empty→
        `""`, the DI-parser wiring (an injected parser is called), and the injectable-override contract.
        **No real parse here** (Node has no `DOMParser`).
      - **Playwright rig** (real chromium) — the parse→strip→serialize **security vector table**: each
        vector (`<img src=x onerror=…>`, `<a href=javascript:…>`, `<script>`, `<iframe>`/`<object>`/…)
        absent from the output; a benign authored offer round-trips unchanged (modulo parser normalization).
        **mXSS scoping (reconcile with AC4):** the rig asserts only that the **denylist-reachable** cases are
        neutralized — i.e. that parse-normalization does not *resurrect* a stripped vector (a `<noscript>`/
        nesting case where the strip must still hold after re-serialize). Genuinely **parser-differential
        mXSS bypasses are NOT asserted defended** (AC4's honest boundary — the injectable seam's job); if the
        rig includes such a case it is a **documented known-boundary** (xfail/annotated), never a green
        "defended" claim. This is the meaningful proof — it MUST run against a real DOM, not be faked.
      - `test/eds-dom-reserve.test.js` updated: the default `fill` now sanitizes — assert via the DI seam
        (inject a `setContent`/parser spy) that sanitization is invoked and a passed `setContent` still
        overrides; the real-`onerror`-stripped assertion belongs to the rig leg, not this Node file.
- [x] **No regression** — targeted sweep: `sanitize-html`, `eds-dom-reserve`, `decisions-exposure`,
      `alloy-decisions`, `alloy-decisions-stub`, `contract-stability`, `core-boundary` (if the sanitizer
      lands in `core/`). _(Full vitest suite hangs on the stale worktree — run named files only.)_
- [x] **Browser/rig leg (AC5 + the AC2/AC3 vector table) — REQUIRED, not optional.** Extend an existing
      decisions rig (`rig/alloy-decisions.mjs` / `rig/alloy-decisions-harness.html`) OR add a focused
      CSP-honest rig, running the real-chromium parse: a malicious offer's `onerror`/`javascript:` is
      stripped **and does not fire** under `require-trusted-types-for 'script'` (no `securitypolicyviolation`,
      no thrown error, the handler never runs), plus the benign round-trip. Wire it as an `npm run rig:*`
      script **AND as a GATING step in `.github/workflows/ci.yml`'s `browser-oracle` job** (alongside
      `rig:isolation`/`rig:uc1`) — merely adding the npm script does NOT gate it (frame-critique
      reconciliation note); the reconciliation sweep must verify the CI wire-up, not just the script's
      existence. This is the security proof — do NOT downgrade it to a
      DI'd `trustedTypes`/parser shim in a Node test (a shimmed parse is the false-confidence the frame-
      critique flagged); the Node test covers only the pure predicates.
- [x] Reviews: **frame-critique** (2 rounds — pass) + compliance + craft + arch + reconciliation, all
      **recorded pass** (independent Opus review of the Sonnet diffs — verdicts under `reviews/`). The
      security-critical findings converged (the module-global TT policy's first-write-wins-over-`sanitize`
      coupling; the `core/` import-free invariant) and were folded in; no blocker survived.
- [x] Deviation log + reconciliation sweep; refinement-todo item **k** marked RESOLVED; mvp3.md release-check
      security criterion (`reserveSpace innerHTML path gated by a sanitizer`) checked. **Log the deliberate
      deviations (frame-critique reconciliation notes):** (a) this slice's load-bearing AC (the active-markup
      vector table) is intentionally proven ONLY in the browser-CI leg, NOT `npm test` — consistent with the
      project's real-DOM-proof posture (007-02/007-05), logged so a future reader does not read the vitest
      suite as the security gate; (b) confirm + record which `sanitizeHtml` home was chosen (`core/` with a
      DI'd parser vs alongside `dom.js`) and, if `core/`, that `test/core-boundary.test.js` was updated for
      the injected-parser (import-free) boundary.
- [x] **No live identifiers committed** — synthetic offer HTML only (no real ECIDs/datastream/org in
      fixtures).

**Anti-horizontal-phasing check:** after this slice, a real decision's HTML flowing through the one mediated
DOM path (`fill`) has its active markup neutralized by default — an end-to-end change to what bytes reach the
user's DOM (a stripped `onerror` is observable in the filled box), not an internal-only helper. The
capability is safe-by-default where it was safe-only-if-the-caller-knew.

### Deviation log

- **`sanitizeHtml` home: `core/sanitize-html.js`, vendor-neutral and IMPORT-FREE** (no `import` statement at
  all — mirrors `core/consent.js` / `core/endpoint-ceiling.js`'s "this file simply never imports anything"
  posture, not just the `core/`-may-not-import-`rig/` guard). The parser is injected via `opts.parse`
  (default: the ambient `DOMParser` global, `null` when absent — Node/vitest). `test/core-boundary.test.js`
  needed **no edit**: it only guards `core/ -> rig/` imports, and the new module has zero imports of any kind,
  so it is trivially compliant. `adapters/eds/dom.js` imports `sanitizeHtml` from `core/` — the same
  adapter-imports-from-core direction `adapters/eds/index.js` already uses (`createAirlock`,
  `resolveConsent`), not a new coupling shape.
- **Internal DI seam added beyond the spec's literal text: `opts.sanitize` on `createDomCapability`.** The
  spec names `opts.setContent` (unchanged) as the injectable override; to satisfy the DoD's "assert via the
  DI seam ... that sanitization is invoked" for `test/eds-dom-reserve.test.js` — Node has no `DOMParser`, so
  the TRUE default write path cannot be exercised meaningfully there — `createDomCapability` also accepts an
  internal `opts.sanitize` (default: `sanitizeHtml`), used by both the default `setContent` and its
  Trusted-Types policy's `createHTML`. This is additive, undocumented in `contracts/capability.d.ts` (not a
  public contract surface — `setContent`/`sanitize` are `createDomCapability`'s own `opts`, never pinned by
  `contract-stability.test.js`), and mirrors the existing `now`/`schedule` DI pattern already on this
  function. Flagged for arch review as a design choice, not hidden.
- **Fixed a real gap found while building the rig, not just documented it: `<template>` content recursion.**
  A `<template>` element's children live in a separate `.content` `DocumentFragment` that plain
  `querySelectorAll("*")` does not reach, yet DOES serialize back out through an ancestor's `.innerHTML` — a
  well-known sanitizer-bypass vector (`<template><script>...</script></template>` would otherwise survive
  untouched). `core/sanitize-html.js`'s walk now recurses into `.content` (nested templates included). Judged
  in-scope (not "more than the AC requires") because AC2's own text says "removes ... before re-serializing"
  and template contents ARE re-serialized — leaving them unwalked would contradict AC2's stated intent, not
  just fall outside a boundary case. Covered by both a Node algorithm-wiring test (hand-built fake tree) and
  the real-chromium rig (`v-template-script` vector — PASS).
- **The `<noscript>` mXSS-adjacent vector (`v-noscript-mxss`) is included in the rig exactly as the DoD's
  named example, but reported HONESTLY rather than left with the originally-drafted framing.** My first draft
  described it as "a classic parser-differential mutation-XSS this denylist cannot reach," implying a
  demonstrated bypass. Running it for real showed the OPPOSITE this run: Chromium's attribute-value
  serialization HTML-entity-escaped the smuggled `<`/`>` characters, so the specific payload used here did
  NOT reproduce a live bypass (`xssFiredAfterAllVectors: false`). Rewrote the rig's + harness's comments to
  say exactly that — a non-reproduction is NOT proof of safety against noscript-based (or other
  scripting-context) mXSS in general, and is NOT counted toward `pass` in either direction. Flagging this
  because the DoD explicitly warns against a "green 'defended' claim," and an unexamined bypass claim that
  didn't actually reproduce would have been the mirror-image dishonesty.
- **Memoized (module-level) Trusted-Types policy, not created per-call.** Not explicit in the spec text, but
  necessary for correctness: a NAMED `trustedTypes.createPolicy` call throws "already exists" on a second
  call with the same name (R-005's CSP does not set `trusted-types` to allow duplicates), and a naive
  per-call-create design would have that throw silently swallowed by the existing try/catch — meaning every
  `fill()` after the FIRST would write `""` instead of sanitized content. Caught this by reasoning through the
  multi-fill case before running the rig, then added a dedicated rig proof (`v-multi-a`/`v-multi-b`, two
  separate `createDomCapability` instances filled AFTER many prior fills) — PASS, the memoization holds.
- **KNOWN LIMITATION of the memoized policy (all three review passes flagged — non-blocking, zero current
  blast radius):** because the module-global policy is created ONCE and its `createHTML` closes over the
  `sanitize` it was FIRST called with, a second `createDomCapability` built with a DIFFERENT `opts.sanitize`
  would, when Trusted-Types is available, reuse the first policy — so its own `sanitize` is honored only on
  the non-TT plain-string fallback, silently dropped on the TT path (first-write-wins on the closure
  identity). UNREACHABLE today: `opts.sanitize` is an internal test-only DI seam (Node tests run without TT
  → they hit the direct `sanitize` fallback, not the policy), there is no production caller, and a production
  deployment wanting a stricter sanitizer routes through `opts.setContent` (which bypasses this policy
  entirely). Recorded so a future dev who promotes `opts.sanitize` to a public seam knows the constraint; a
  proportionate fix then would be a per-`sanitize` policy name, not a restructure.
- **Post-review nits applied (compliance/craft/arch passes, all PASS):** (1) `.github/workflows/ci.yml`'s
  `browser-oracle` header comment updated "two structural asserts" → "three" (the sanitizer rig is now a
  third gating rig — craft nit); (2) `test/core-boundary.test.js` gained a focused **import-free guard** for
  `core/sanitize-html.js` (machine-enforcing the invariant its `core/` home leans on, which previously held
  only "by inspection" — arch open question); (3) the rig's AC3 benign gate now asserts `data-x`/`aria-label`
  preservation (AC3 names them — compliance nit), and a `v-vbscript-href` vector was added so a `vbscript:`
  scheme on a SURVIVING `<a>` is stripped in the real DOM (not only in the Node predicate test — compliance
  nit). Rig re-run PASS; core-boundary 2/2.
- **`contracts/capability.d.ts`'s `dom?:` docstring updated (comment-only, no signature change)** to remove
  the same "Trusted-Types-compatible … so injection flows through it" framing the spec names as needing
  correction at `dom.js:87` — it carried the identical false-sense-of-security claim. Verified
  `contract-stability.test.js` stays green (24/24) since it only pins literal signature substrings, never this
  surrounding prose.
- **CSP reality check that reshaped the rig's gating design (not a deviation from the AC, but worth logging):**
  under the exact EDS boilerplate CSP, `'strict-dynamic'` causes Chromium to ignore `'unsafe-inline'`
  ENTIRELY for `script-src` (confirmed empirically: `script-src-attr` falls back to `script-src`), so inline
  event handlers are CSP-blocked regardless of whether the sanitizer stripped them. This makes
  `window.__xssFired` and the full CSP-violation list unreliable as a sole PASS/FAIL gate (a marker that never
  fires either way proves nothing) — so the rig's actual gate is the deterministic structural check (the
  denylisted construct is ABSENT from the sanitized output), with `xssFired`/CSP violations/page errors kept
  as corroborating evidence, exactly mirroring this project's existing structural-over-quantitative posture
  (`rig/alloy-decisions.mjs`'s CLS-is-advisory precedent). AC5's literal "no `securitypolicyviolation`" text is
  interpreted narrowly as "no `trusted-types`-directive violation" (the one AC5 is actually about — the
  sanitized write itself must not be TT-rejected), not "zero violations of any kind" — a `base-uri` violation
  from the sanitizer's OWN inert `DOMParser` processing a `<base>` start tag (before that element is stripped)
  and a `script-src-attr` violation from the AC4 override-control's DELIBERATELY-unsanitized `onerror=` both
  fire in a clean run and are neither a sanitizer failure nor a TT rejection.
- **`test/eds-dom-reserve.test.js`'s "fill() is the ONLY mediated write" test was rewritten, not just extended**
  — its old assertion (`hero.innerHTML` equals the raw benign string, no sanitize step existed) no longer
  reflects reality now that the default sanitizes; per the spec's own instruction this was expected, not an
  unplanned deviation. Three new tests were added alongside it (default-routes-through-sanitize,
  override-fully-bypasses, true-Node-default-fails-safe) rather than folding everything into one, for
  assertion clarity.

### Reconciliation sweep

- **New surface:** `core/sanitize-html.js` (vendor-neutral, import-free, DI'd parser — mirrors
  `core/consent.js` / `core/endpoint-ceiling.js`); the sanitize-then-write default + memoized Trusted-Types
  policy in `adapters/eds/dom.js`; `test/sanitize-html.test.js` (pure predicates + DI wiring) and the
  real-chromium `rig/sanitize-boundary.mjs` + harness (the security vector table), wired as a **gating**
  `browser-oracle` step in `.github/workflows/ci.yml`.
- **No new `core/` boundary breach** — `core/sanitize-html.js` imports nothing (the new
  `test/core-boundary.test.js` guard machine-enforces it); `contracts/capability.d.ts` change is comment-only
  (`contract-stability.test.js` green, 24/24).
- **Reviews recorded:** frame-critique (2 rounds) + compliance + craft + arch + reconciliation — all pass,
  under `reviews/`. The convergent TT-memoization first-write-wins coupling is a disclosed, zero-blast-radius
  known limitation; the coverage nits were folded in and re-verified (node sweep + rig PASS).
- **Docs:** `docs/refinement-todo.md` item **k** RESOLVED (f/g/h/i/j stay tracked — g/i land in 018-02; h/j
  remain deferred with their triggers); `docs/releases/mvp3.md` release-check criterion MET (scoped to the
  sanitizer, not the 018-02 hardening nits). No inbox items.
- **Named residuals (tracked, not closed):** mutation-XSS / parser-differential bypasses (AC4's honest
  boundary — the injectable `opts.setContent` seam's job, slot DOMPurify for genuinely-untrusted content);
  the `opts.sanitize` first-write-wins constraint (test-only seam today); production eager-phase wiring of
  `reserveSpace().fill()` (refinement-todo **h**, a separate adapter-integration concern).

### Reviews / reconciliation — recorded

All gating passes ran as independent Opus reviewers over the Sonnet diffs and are recorded under `reviews/`:
**frame-critique** (2 rounds → pass), **compliance** (pass), **craft** (pass), **arch** (pass),
**reconciliation** (pass). The convergent security findings (the module-global TT policy's
first-write-wins-over-`sanitize` coupling — non-blocking, zero current blast radius; the `core/` import-free
invariant now machine-guarded) and the coverage nits (rig `data-x`/`aria-label` + `v-vbscript-href`; the
`ci.yml` three-asserts comment) were folded in and re-verified green before the RECONCILED → DONE transition.
