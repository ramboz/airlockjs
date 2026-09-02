// worker-dom real-tag GLUE script (spec 025-01 AC2) — a CLASSIC (non-ESM)
// script. rig/worker-dom-prism.mjs SERVES this file CONCATENATED after the
// REAL, UNMODIFIED `prismjs` package content (node_modules/prismjs/prism.js,
// read fresh at serve time — never copied/forked into this repo) plus a
// one-line `self.Prism = { manual: true };` prefix (see the driver's
// AUTHOR_SCRIPT_PATH handling). Concatenation, not importScripts(), because
// importScripts() rejects same-origin absolute paths from inside a
// Blob-URL worker ("The URL '...' is invalid" — an observed, grounded
// browser quirk of worker-dom's Blob-URL worker bootstrap, recorded in this
// slice's deviation log) — and because @ampproject/worker-dom's public
// upgradeElement(el, domURL) API only accepts ONE authorURL per element
// anyway, so a real off-thread deployment of Prism+glue would face the same
// single-script constraint; concatenation is the faithful shape here, not a
// workaround unique to this probe.
//
// Prism is the AC2 candidate: a real, write/compute-heavy DOM-CONSTRUCTING
// tag (regex tokenization + `element.innerHTML = highlightedMarkup`) with
// NO synchronous layout read anywhere in its source (grounded: this slice's
// deviation log records the grep across node_modules/prismjs/prism.js for
// getBoundingClientRect/offsetHeight/offsetWidth/getComputedStyle/
// scrollHeight/clientHeight — zero hits) — the actual Tier-0 target shape,
// not a connector-shaped tag (gtag.js/pixels). `Prism.manual = true` (see
// node_modules/prismjs/prism.js:56, a DOCUMENTED public config Prism reads
// off a pre-existing global before its own auto-highlight-on-load path
// runs) is used so Prism.highlightElement() is invoked explicitly below,
// instead of via its DOMContentLoaded/document.currentScript auto-run path
// — a supported, unmodified integration mode, not a code change to Prism.
/* eslint-disable no-undef -- __REPEAT__ is a TEXT-SUBSTITUTION placeholder
   (rig/worker-dom-prism.mjs's server-side templating, see this file's
   header); `Prism` is defined at runtime by the concatenated prism.js
   content this glue is served AFTER (see rig/worker-dom-prism.mjs's
   AUTHOR_SCRIPT_PATH handling) — never a real static undefined reference. */
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

  // A SINGLE, reused <pre><code> pair across clicks (steady-state DOM size,
  // like AC1's fixed pool) — re-highlighting the SAME node in place, not
  // remove+recreate each click. An earlier version of this fixture removed
  // and recreated the <pre> every click and hit a repeatable mid-run
  // "HierarchyRequestError: insertBefore... This node type does not
  // support this method" after ~half the clicks — see this slice's
  // deviation log; in-place reuse avoids it and is also the more common
  // real-world shape for a live-updating widget.
  var pre = document.createElement('pre');
  var codeEl = document.createElement('code');
  codeEl.className = 'language-javascript';
  pre.appendChild(codeEl);
  document.body.appendChild(pre);

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
