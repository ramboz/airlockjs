---
reviewer_model: claude-opus-5.5
reviewed_at: 2026-11-20
round: 1
verdict: changes-requested
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
