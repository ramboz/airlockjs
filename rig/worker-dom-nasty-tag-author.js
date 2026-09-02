// worker-dom nasty-tag AUTHOR script (spec 025-01 AC1) — a CLASSIC
// (non-ESM) script. @ampproject/worker-dom's upgradeElement() fetches this
// as raw TEXT and concatenates it after the worker-dom bootstrap inside a
// single Blob-URL classic Worker (see node_modules/@ampproject/worker-dom's
// main.mjs WorkerContext — no import/export syntax allowed here, matching
// how a real unmodified third-party tag is authored: UMD/IIFE, not ESM).
//
// This is an UNMODIFIED PORT of rig/nasty-tag-harness.html's naive-mode
// per-element step (023-01's synthetic DOM-mutation-heavy nasty tag) —
// SAME shape (write + sync-read attempt + busy-spin over a pre-collected
// element pool), now executing OFF-THREAD against worker-dom's mirror DOM
// instead of the real main-thread DOM. The ELEMENTS/WORK_US placeholder
// tokens below are substituted server-side by rig/worker-dom-nasty-tag.mjs
// before this file is served (the worker has no location.search of its own
// to read — this mirrors the harness's own ?elements=&workUs= query-string
// convention).
/* eslint-disable no-undef -- __ELEMENTS__/__WORK_US__ are TEXT-SUBSTITUTION
   placeholders (see the header note above), never real identifiers; this
   file is never linted-as-written, only after rig/worker-dom-nasty-tag.mjs
   substitutes them and serves the result to the worker. */
(function () {
  var ELEMENTS = __ELEMENTS__;
  var WORK_US = __WORK_US__;

  // --- fixture DOM: pre-collect (here, CREATE — there is no existing DOM to
  //     query inside a fresh worker-dom mirror) the node set ONCE, at boot,
  //     OUTSIDE any interaction (023-01 AC3's must-fix, preserved here).
  var collectStart = performance.now();
  var items = [];
  for (var i = 0; i < ELEMENTS; i++) {
    var d = document.createElement('div');
    document.body.appendChild(d);
    items.push(d);
  }
  // A dedicated status node the main thread polls via attributes (mutation
  // flush is the ONLY worker->main channel worker-dom exposes to an
  // unmodified tag; there is no bespoke postMessage backchannel here).
  var status = document.createElement('span');
  status.id = 'wd-status';
  document.body.appendChild(status);
  var collectMs = performance.now() - collectStart;
  status.setAttribute('data-collect-ms', String(Math.round(collectMs * 100) / 100));
  status.setAttribute('data-completed', '0');
  status.setAttribute('data-clicks', '0');

  function busy(micros) {
    if (micros <= 0) return;
    var end = performance.now() + micros / 1000;
    while (performance.now() < end) {} // eslint-disable-line no-empty
  }

  var hue = 0;
  var completed = 0;
  var clicks = 0;
  function nastyStep(el) {
    hue = (hue + 1) % 3;
    el.style.transform = 'translateY(' + hue + 'px)'; // WRITE — queued as a mutation, flushed async to main
    void el.offsetHeight; // READ, ported verbatim from the 023 fixture — see this slice's deviation log:
                           // worker-dom's mirror does NOT implement offsetHeight (grounded: it is listed
                           // "Layout Properties (TBD)" in the worker bundle source, never assigned a
                           // getter), so this evaluates to `undefined` and is an INERT no-op off-thread,
                           // NOT the forced-synchronous-reflow it is on the main thread. Kept in the step
                           // for fidelity to the ported fixture; it does not add off-thread cost here.
    busy(WORK_US);
  }

  // A SINGLE listener on `document` (not `document.body`) — registering on
  // both was observed, in this spike's grounding probe, to double-dispatch
  // (both indices alias the same main-thread base-element event-forwarding
  // path), which would double-count clicks; one listener avoids that.
  document.addEventListener('click', function () {
    clicks++;
    for (var j = 0; j < items.length; j++) nastyStep(items[j]);
    completed += items.length;
    status.setAttribute('data-completed', String(completed));
    status.setAttribute('data-clicks', String(clicks));
  });
})();
