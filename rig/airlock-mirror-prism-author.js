// airlock-mirror-prism AUTHOR script (spec 025-03 AC2) — a CLASSIC (non-ESM)
// script, executed byte-unmodified against airlock's OWN worker-side mirror
// (core/dom-chamber-host.js's boot(), via `new Function(authorSource)()` with
// the mirror `document` bound onto `globalThis` — see that module's header).
//
// THIS file is fetched byte-unmodified (rig/airlock-mirror-prism.mjs's
// static file server never templates it server-side); the __REPEAT__
// substitution + the CONCATENATION with the REAL, UNMODIFIED
// node_modules/prismjs/prism.js content (read fresh, never copied/forked
// into this repo — AC8) happen CLIENT-SIDE, in the CALLER that builds the
// `authorSource` posted to the dom chamber
// (rig/airlock-mirror-prism-harness.html's module script; mirrored for a
// fast hermetic Node/vitest iteration loop by
// test/dom-chamber-host-prism.test.js — see either for the exact PREFIX).
//
// PREFIX, grounded by running Prism against this host (not assumed — see
// either caller's own comment for the full write-up): (1) `Prism.manual =
// true` — a DOCUMENTED public config Prism reads off a pre-existing global
// BEFORE its own auto-highlight-on-load path runs (prism.js:34-56), a
// supported integration mode, not a code change to Prism. (2) a minimal
// `Element` global STUB — prism.js's BUNDLED file-highlight component
// carries an IE11-era `Element.prototype.matches` polyfill guard that runs
// UNCONDITIONALLY at load and references a bare `Element` global, absent
// from a Worker's global scope (grounded by running this fixture inside a
// REAL Worker — NOT reachable from Node/vitest, where Prism's own `_self`
// resolution takes an early-return branch that never reaches this code at
// all). Both are lib-completeness gaps (zero live-layout info needed), not
// model-inherent. Unlike 025-01's glue (which patched `self.Element.
// prototype.matches` directly, since `@ampproject/worker-dom` DOES install
// an ambient `self.Element`), airlock's OWN mirror deliberately installs NO
// ambient globals beyond `document` (ADR-0001/025-02's own design) — so
// both stubs live in the CALLER's prefix, never in core/worker-dom/
// mirror.js itself (which instead implements `matches()` as a real,
// documented MirrorElement method — see that module).
//
// SAME sample code (12,718 raw chars at REPEAT=60 — 025-01's own grounded
// scale, `docs/specs/025-worker-dom-mirror/slice-03-real-tag-innerhtml.md`'s
// DoR cites 12,718 -> 148,558 chars) and the SAME reused-<pre><code>-pair
// shape as 025-01's rig/worker-dom-prism-glue.js, for direct comparability;
// THIS file's own status-attribute reporting mirrors
// rig/worker-dom-nasty-tag-author.js's `wd-status` convention.
/* eslint-disable no-undef -- __REPEAT__ is a TEXT-SUBSTITUTION placeholder
   (substituted client-side by this file's caller — see this file's header);
   `Prism` is defined at runtime by the concatenated prism.js content this
   glue is served AFTER — never a real static undefined reference. */
(function () {
  var SAMPLE_LINES = [
    'function fibonacci(n) {',
    '  if (n <= 1) return n;',
    '  return fibonacci(n - 1) + fibonacci(n - 2);',
    '}',
    'const cache = new Map();',
    'for (let i = 0; i < 50; i++) {',
    '  cache.set(i, fibonacci(i % 20));',
    '}',
    'export default cache;',
  ];
  var REPEAT = __REPEAT__;
  var CODE = new Array(REPEAT).fill(SAMPLE_LINES.join('\n')).join('\n\n');

  var status = document.createElement('span');
  status.id = 'wd-status';
  document.body.appendChild(status);
  status.setAttribute('data-completed', '0');
  status.setAttribute('data-clicks', '0');
  status.setAttribute('data-highlighted-len', '0');
  status.setAttribute('data-raw-len', String(CODE.length));

  // A SINGLE, reused <pre><code> pair across clicks — re-highlighting the
  // SAME node in place (025-01's own grounded fixture design; an earlier
  // remove+recreate design hit a repeatable HierarchyRequestError, see that
  // slice's deviation log).
  var pre = document.createElement('pre');
  var codeEl = document.createElement('code');
  codeEl.className = 'language-javascript'; // spec 025-03 AC1: exercises the NEW className surface
  pre.appendChild(codeEl);
  document.body.appendChild(pre);
  // Expose the code element's mirror id so the harness can target a
  // DIRECT hostile setInnerHTML op at it for AC3's sanitizer proof
  // (a crafted op, not something real Prism would ever emit — Prism's own
  // tokenizer HTML-entity-escapes source text, so a live <script>/onerror=
  // construct never naturally appears in ITS output; AC3's threat model is
  // AD-5's untrusted-chamber op stream, not a Prism bug).
  codeEl.setAttribute('data-airlock-code-el', '1');

  var clicks = 0;
  document.addEventListener('click', function () {
    clicks++;
    codeEl.textContent = CODE; // reset to plain text before each re-highlight pass
    Prism.highlightElement(codeEl); // the REAL, UNMODIFIED call — tokenizes + `codeEl.innerHTML = highlightedMarkup`

    status.setAttribute('data-completed', String(clicks));
    status.setAttribute('data-clicks', String(clicks));
    // innerHTML growth vs the raw text length is the correctness signal —
    // real highlighting wraps tokens in `<span class="token ...">`, so
    // highlighted markup is always longer than the plain text it replaces.
    status.setAttribute('data-highlighted-len', String(codeEl.innerHTML.length));
  });
})();
