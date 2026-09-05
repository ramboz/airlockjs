/* Spike 033-01 probe — MINIMAL classic worker (NOT { type: "module" }).
 *
 * Isolates the exact load-bearing CSP question: inside a CLASSIC worker admitted
 * under the EDS boilerplate CSP (script-src 'nonce-aem' 'strict-dynamic' …, NO
 * worker-src, require-trusted-types-for 'script'), does `importScripts()` of a
 * SAME-ORIGIN script load AND execute, or does the CSP block it?
 *
 * The worker's FIRST executable act is importScripts of a same-origin sibling; we
 * capture whether the imported bundle actually ran (self.__BUNDLE_RAN) and any
 * error thrown at the importScripts call site (a CSP block throws synchronously).
 */
self.__BUNDLE_RAN = false;
let importScriptsError = null;
let importScriptsThrew = false;
try {
  // Same-origin sibling — the CSP-load-bearing call. Content is irrelevant to the
  // CSP admission decision (script-src governs the fetch+execute, not the bytes).
  self.importScripts("./probe-bundle.js");
} catch (e) {
  importScriptsThrew = true;
  importScriptsError = String((e && (e.message || e.name)) || e);
}

self.postMessage({
  kind: "classic-importscripts-result",
  workerRan: true, // if this posts, the classic worker's TOP-LEVEL script executed
  bundleExecuted: self.__BUNDLE_RAN === true, // did the same-origin importScripts target run?
  importScriptsThrew,
  importScriptsError,
});
