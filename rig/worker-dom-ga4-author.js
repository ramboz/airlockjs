// worker-dom GA4 (gtag.js) ADOPTION-LITMUS author script (spec 025-01 AC3).
// A minimal, standard GA4 install snippet's worker-side equivalent: seed
// window.dataLayer/gtag (the DOCUMENTED public install pattern — see
// https://developers.google.com/analytics/devguides/collection/ga4), THEN
// importScripts() the REAL, UNMODIFIED, public gtag.js (a synthetic/debug
// measurement id — no live identifiers), mirroring how a real page loads it
// async after the inline snippet. Status is reflected via a DOM attribute
// (the only worker->main channel available to an unmodified tag).
(function () {
  self.dataLayer = self.dataLayer || [];
  self.gtag = function () { self.dataLayer.push(arguments); };
  self.gtag('js', new Date());
  self.gtag('config', 'G-DEBUGTEST0');

  var status = document.createElement('span');
  status.id = 'wd-status';
  document.body.appendChild(status);
  status.setAttribute('data-phase', 'pre-import');

  // AC3's failure-axis diagnostics — ground WHICH ambient globals gtag.js's
  // own auto-page-view/beacon logic likely depends on that a worker
  // (mirror `window` or not) genuinely cannot supply, vs a fixable gap.
  status.setAttribute('data-has-screen', String(typeof screen !== 'undefined'));
  status.setAttribute('data-screen-wh', typeof screen !== 'undefined' ? (screen.width + 'x' + screen.height) : 'n/a');
  status.setAttribute('data-has-sendbeacon', String(typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function'));
  status.setAttribute('data-has-uadata', String(typeof navigator !== 'undefined' && !!navigator.userAgentData));
  try { status.setAttribute('data-cookie', String(document.cookie)); } catch (e) { status.setAttribute('data-cookie-error', String(e && e.message)); }
  status.setAttribute('data-has-fetch', String(typeof fetch === 'function'));
  status.setAttribute('data-has-xhr', String(typeof XMLHttpRequest === 'function'));

  try {
    // importScripts is a real WorkerGlobalScope global; eslint.config.js's
    // rig/**/*.js glob applies globals.browser (which covers self/document/
    // navigator/fetch above), not globals.worker, so this ONE worker-only
    // global needs a targeted disable rather than a config change.
    // eslint-disable-next-line no-undef
    importScripts('https://www.googletagmanager.com/gtag/js?id=G-DEBUGTEST0');
    status.setAttribute('data-import-ok', '1');
  } catch (e) {
    status.setAttribute('data-import-ok', '0');
    status.setAttribute('data-import-error', String((e && e.message) || e));
  }

  try {
    self.gtag('event', 'debug_test_event', { debug_mode: true, value: 1 });
    status.setAttribute('data-event-ok', '1');
  } catch (e) {
    status.setAttribute('data-event-ok', '0');
    status.setAttribute('data-event-error', String((e && e.message) || e));
  }
  status.setAttribute('data-datalayer-length', String(self.dataLayer.length));
  status.setAttribute('data-phase', 'done');
})();
