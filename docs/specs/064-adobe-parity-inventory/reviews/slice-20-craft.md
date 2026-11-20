---
model: claude-opus-5.5
reviewed_at: 2026-11-20
round: 2
verdict: pass
---

# Slice 064-20 (B4) craft review, round 1

Commit `7e8464e2`. **Verdict: changes-requested.** The renderer is compact and readable, lint is clean, the redirect
refuses non-http(s) URLs, and the HTML path goes through the shared sanitizer. One sanitizer bypass lets a payload run
script, and there are two correctness bugs in DOM application.

Lint: `npx eslint` on the changed files is clean. Hermetic tests: 2 passed (browser tests not run, per brief).

## Findings

**K1 — High (security) — `adapters/eds/personalization-render.js:120-123`.** The `setAttribute` action is a narrow denylist:
it blocks `on*` names and dangerous URLs only on `href|src|action|formaction|xlink:href`. Setting `srcdoc` on an existing
page `<iframe>` runs arbitrary script in the page origin, which is the `customCode` risk this slice explicitly refuses. The
same applies to `data` on `<object>`/`<embed>`, `href` on `<base>` (rewrites every relative URL on the page), and
`http-equiv`/`content` on `<meta>` (refresh redirect to any scheme). Fix: refuse `setAttribute` (and `setStyle`) on
`script|iframe|object|embed|base|meta|link` targets, refuse `srcdoc`, `data`, `http-equiv` and `formaction` outright, and run
`isDangerousUrl` on any attribute whose value is a URL. An allowlist is safer still. Add a hermetic test per case.

**K2 — Medium — `adapters/eds/personalization-render.js:118`.** Multi-node `insertAfter` reverses order. `el.nextElementSibling`
is re-read after each insert, so each node lands right after `el`, ahead of the previous one. It also skips text nodes, so
leading text lands after the element content. Stock inserts each node after the previous one. The test uses a single
element only. Fix: keep a running anchor (`let anchor = el; for (const n of nodes) { anchor.after(n); anchor = n; }`) and add a
multi-node, mixed text/element case.

**K3 — Medium — `adapters/eds/personalization-render.js:100`; `adapters/eds/index.js:1526-1572`.** No Trusted Types support and no
per-item error isolation. `tpl.innerHTML = html(content)` assigns a string and bypasses dom.js's `airlock-sanitize` Trusted
Types policy, so it throws on a site enforcing `require-trusted-types-for 'script'`. Any throw (that, or an invalid attribute
name from `setAttribute`) escapes the deliver loop, so later items, `onDecisions` and the display notification are all
skipped, and the prehide is only lifted by the pump's `finally`. Fix: reuse the dom.js policy for the template write, wrap
each item in `try/catch` that marks it not rendered and emits a diagnostic, and add a test with a throwing item followed by
a good one.

**K4 — Medium — `adapters/eds/personalization-render.js:264`.** `interactNotificationXdm` writes `propositionAction.token`; stock
writes `tokens: [token]`. No caller passes a token today, so the field is dead and wrong when used. Fix: emit `tokens` as an
array and wire it from the proposition's `trackingLabel`/token metadata (see compliance C5).

**K5 — Low — `adapters/eds/personalization-render.js:85-92,272`.** Prehiding: the selector is interpolated into CSS unescaped,
so a config value like `x{} body{display:none}` injects rules (config is host-owned, so low). The injected `<style>` has no
CSP nonce, so it is dropped under a strict `style-src`; stock copies the page nonce. Prehiding also starts at boot whatever
the consent state; stock skips it when consent is `out`. Fix: reject selectors containing `{`, `}` or `;`, copy the nonce from
an existing `script[nonce]`, and skip prehiding when consent is out.

**K6 — Low — `adapters/eds/personalization-render.js`.** Dedup guards only `rearrange`. Stock marks
`append/prepend/insertBefore/insertAfter/rearrange` targets with `data-adobe-proposition-ids` and skips a repeat for view
scope. Re-delivery (SPA re-push) duplicates inserted content. Fix: mark and check the attribute for those five actions.

**K7 — Low — `adapters/eds/personalization-render.js:55-61`.** One `MutationObserver` per item runs `selectAll` on every
document mutation for up to 3 s. On a busy page with many items this is a measurable INP cost. Fix: share one observer
across pending items and check only pending selectors, or debounce with `requestAnimationFrame`.

**K8 — Low — `adapters/eds/personalization-render.js:35`, deliver in `adapters/eds/index.js`.** `selectAll` has a ternary whose
branches are identical; the `if (!html)` guard in deliver is unreachable; deliver uses 6-space indentation unlike the rest of
the file. Fix: remove the dead branch and guard, reformat.

**K9 — Low — tests.** Several assertions are weaker than the claims: `toBeGreaterThanOrEqual(1)` and `stock[0]` in the click
differential, decisioning-only interact comparison, URL-only redirect check, single-node `insertAfter`, and `.catch(() => {})`
on the redirect replay, which swallows a real failure. Fix: exact counts, content-based selection, full-body comparison,
and drop the blanket catch (catch only the expected navigation error).

**K10 — Low (note) — renderer.** Rendered HTML and `setStyle` `url()` can fetch remote resources outside the seal. Stock does
the same, so this is parity, not a regression, but it is a consent-gating gap worth one line in the notes.

## Round 2 (2026-11-20, fixes in `git diff 7e8464e2 HEAD`)

**Verdict: pass.** Lint clean; the B4 suite passes 24/24 in real Chromium.

| Finding | Status | Evidence |
|---|---|---|
| K1 High setAttribute bypass | Fixed | Refuses `on*`, `srcdoc`, `data`, `http-equiv`, `formaction`, any attribute on `script/iframe/object/embed/base/meta/link`, and dangerous URLs on `href/src/action/xlink:href/poster/background/ping`. Real-Chromium test covers `srcdoc`, `http-equiv`, `onclick`, `javascript:` href. |
| K2 Medium insertAfter order | Fixed | Fixed anchor `ref = el.nextElementSibling`. This matches stock exactly (stock's running anchor also resolves to the original next element sibling, so the text-node behavior is parity). Multi-node mixed text test vs stock. |
| K3 Medium Trusted Types, per-item isolation | Fixed / carried | Each item is `try/catch`ed with a diagnostic; test has a throwing item followed by a good one. Trusted Types carried in notes and refinement-todo. |
| K4 Medium `token` vs `tokens` | Fixed (shape) | Emits `tokens:[token]`; wiring from `trackingLabel` carried under C5. |

New findings (all Low):

- **K11 — Low — `adapters/eds/personalization-render.js:121`.** The tag refusal covers `setAttribute` only; `setStyle` on
  the same tags is still allowed (harmless today), and the K1 cases are tested only in Chromium, not hermetically. The
  `tag` const is recomputed per attribute; hoist it out of the loop.
- **K12 — Low — `adapters/eds/index.js` deliver loop.** The reserved-box `handle.fill(html)` path is not inside the new
  per-item isolation, so a throwing fill still skips later decisions, `onDecisions` and the display. Pre-existing path;
  worth a `try/catch` when the file is next touched.
- K8: the identical ternary is removed and the deliver indentation fixed; the unreachable `if (!html)` guard after the handle await is still there (Low). K5, K6, K7, K10 remain carried as Low in notes and refinement-todo.
