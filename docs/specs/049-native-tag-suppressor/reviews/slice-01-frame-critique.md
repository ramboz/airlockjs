---
slice: 049-01 — runtime-`<script>` suppression (CWV-win core, dist-shipped)
pass: frame-critique
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-09-15T18:41:27Z
prompt_source: review.py frame-critique docs/specs/049-native-tag-suppressor/spec.md runtime-
---

Frame-critique pass on slice **049-01 — runtime-`<script>` suppression** (reviewer `jig:reviewer`, prompt built via
`review.py frame-critique docs/specs/049-native-tag-suppressor/spec.md runtime- <slice>`).

**Load-bearing assumption attacked — A2: a page-side interception technique can PREVENT (not merely observe) a vendor
runtime `<script src>` from downloading/evaluating under the reference site's Trusted-Types + `strict-dynamic` CSP.**
Grounded against the actual `intuit-erp` source + web-platform script-loading semantics + airlock's rig precedents. **A2
holds — the attack does not land:**
- The injection seam is real + page-owned: `intuit-erp/plugins/tealium-martech/src/index.js:244-299` funnels ALL injection
  through `createElement` + a DOM insertion (`:42-45`: TT + `strict-dynamic` force `createElement`, never
  `innerHTML`/`document.write`).
- The fetch begins at insertion; a synchronous insertion-method monkeypatch that refuses the native insertion for a matched
  node prevents connection → prevents fetch+eval (the standard pre-consent blocker technique). The slice correctly names the
  post-insertion `MutationObserver` route as the risky one and defers the technique choice to the network-0 rig.
- `strict-dynamic` + TT govern execution-permission and specific string→sink assignments; neither makes the fetch precede
  insertion nor governs the page monkeypatching its own prototype methods — so the CSP actually helps the suppressor.
- AC2 is constructible from existing precedents (`rig/sanitize-boundary.mjs`'s header-CSP harness with `strict-dynamic`,
  `rig/google-ads-hold-flush.mjs`'s `page.route`/`waitForRequest`), and its network-0 + sentinel-absent dual assertion
  defeats the cached-runtime confound and avoids browser-sensitive CSP-violation-event gating.

VERDICT: **pass** (frame sound; proceed to implementation). No blocker manufactured.

**Two pre-implementation refinements surfaced + FOLDED INTO THE DRAFT before implementation (not deviations):**
1. Injection-method / rig fidelity (sharpest): only `utag.js` + the consent stack are `appendChild`-verified in-source; the
   vendor runtimes (`gtag.js`/`fbevents.js`) are injected by utag's minified runtime templates (not in the repo) via the
   standard idiom `parentNode.insertBefore(script, firstScript)`, NOT `head.appendChild`. → A1 softened to name the full
   insertion surface; AC1 now requires patching `appendChild`/`insertBefore`/`append`/`prepend`/`insertAdjacentElement`/
   `replaceChild`; AC2's rig now injects via the real `insertBefore` idiom (+ variants), so it can't pass on the wrong seam.
2. "no runtime → no beacon" completeness is conditional on the four being pure-runtime tags (not container-fired direct
   pixels). → Goal hedged; a direct-pixel miss is covered by 049-02 + the ADR-0030 kill criterion; the pure-runtime check is
   a 050-trial verification.
