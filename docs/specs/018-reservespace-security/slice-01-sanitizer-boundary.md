---
status: DRAFT
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
   (dom.js) becomes `(el, content) => el.innerHTML = sanitizeHtml(content)` (via the TT/DI write path, AC6) —
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
   creating a policy throws (a restrictive `trusted-types` CSP directive — caught, not fatal). **Grounding-
   honest:** whether airlock may create a *named* TT policy depends on the host's `trusted-types` CSP
   directive (R-005:79 shows `require-trusted-types-for 'script'` but does not pin the policy-name
   allowlist) — so policy creation is **best-effort with a sanitize-anyway fallback**, never a hard
   dependency. Observable (rig, browser): under the testbed CSP, a `fill` of a malicious offer writes the
   sanitized markup with no `securitypolicyviolation` and no thrown error; the `onerror` never runs.
6. **No behavioural regression to reserve/prehide/fill/release.** The layout-box reserve, prehide/reveal,
   timeout backstop, markers (`data-airlock-reserved`/`-filled`), and `release()` are byte-unchanged; only
   the *bytes written by `setContent`* change (sanitized). The existing `test/eds-dom-reserve.test.js` stays
   green except where a test asserted a raw-`innerHTML` passthrough of active markup (update that assertion
   to expect the sanitized result, with a comment).

**DoD:**
- [ ] ACs 1–6 pass, split by substrate (DoR pillar 4):
      - **Node/vitest** `test/sanitize-html.test.js` — the **pure** logic only: the strip-predicate helpers
        (`isEventHandlerAttr` over an `on*` sample; `isDangerousUrl` over `javascript:`/`vbscript:`/
        `data:text/html` vs benign `https:`/relative; `isStrippedTag` over the tag set), non-string/empty→
        `""`, the DI-parser wiring (an injected parser is called), and the injectable-override contract.
        **No real parse here** (Node has no `DOMParser`).
      - **Playwright rig** (real chromium) — the parse→strip→serialize **security vector table**: each
        vector (`<img src=x onerror=…>`, `<a href=javascript:…>`, `<script>`, `<iframe>`/`<object>`/…)
        absent from the output; a benign authored offer round-trips unchanged (modulo parser normalization);
        the mXSS-adjacent cases. This is the meaningful proof — it MUST run against a real DOM, not be
        skipped or faked.
      - `test/eds-dom-reserve.test.js` updated: the default `fill` now sanitizes — assert via the DI seam
        (inject a `setContent`/parser spy) that sanitization is invoked and a passed `setContent` still
        overrides; the real-`onerror`-stripped assertion belongs to the rig leg, not this Node file.
- [ ] **No regression** — targeted sweep: `sanitize-html`, `eds-dom-reserve`, `decisions-exposure`,
      `alloy-decisions`, `alloy-decisions-stub`, `contract-stability`, `core-boundary` (if the sanitizer
      lands in `core/`). _(Full vitest suite hangs on the stale worktree — run named files only.)_
- [ ] **Browser/rig leg (AC5 + the AC2/AC3 vector table) — REQUIRED, not optional.** Extend an existing
      decisions rig (`rig/alloy-decisions.mjs` / `rig/alloy-decisions-harness.html`) OR add a focused
      CSP-honest rig, running the real-chromium parse: a malicious offer's `onerror`/`javascript:` is
      stripped **and does not fire** under `require-trusted-types-for 'script'` (no `securitypolicyviolation`,
      no thrown error, the handler never runs), plus the benign round-trip. Wire it as an `npm run rig:*`
      script (browser-CI leg, like `rig:isolation`). This is the security proof — do NOT downgrade it to a
      DI'd `trustedTypes`/parser shim in a Node test (a shimmed parse is the false-confidence the frame-
      critique flagged); the Node test covers only the pure predicates.
- [ ] Reviews: **frame-critique** (this slice's load-bearing claim — "the TT policy is compatibility not
      sanitization, so the sanitizer must be airlock's own" — is the exact premise a reviewer should attack)
      + compliance + craft + arch (a new security primitive on the one mediated DOM-writer path; its `core/`
      vs adapter home + the DI'd-parser boundary) + reconciliation, recorded pass (independent Opus review of
      the Sonnet diffs).
- [ ] Deviation log + reconciliation sweep; refinement-todo item **k** marked RESOLVED; mvp3.md release-check
      security criterion (`reserveSpace innerHTML path gated by a sanitizer`) checked.
- [ ] **No live identifiers committed** — synthetic offer HTML only (no real ECIDs/datastream/org in
      fixtures).

**Anti-horizontal-phasing check:** after this slice, a real decision's HTML flowing through the one mediated
DOM path (`fill`) has its active markup neutralized by default — an end-to-end change to what bytes reach the
user's DOM (a stripped `onerror` is observable in the filled box), not an internal-only helper. The
capability is safe-by-default where it was safe-only-if-the-caller-knew.
