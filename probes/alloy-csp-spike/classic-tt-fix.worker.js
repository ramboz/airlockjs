/* Spike 033-01 follow-up — does a WORKER-REALM default Trusted Types policy
 * unblock importScripts under `require-trusted-types-for 'script'`?
 *
 * The first probe showed importScripts is blocked by Trusted Types (a
 * TrustedScriptURL sink), NOT by script-src/strict-dynamic. TT policies are
 * per-realm, so the page's `default` policy does not reach here. This worker
 * installs its OWN `default` policy (createScriptURL passes the URL through) at
 * the very top — the one-line accommodation the shipped chamber would add — then
 * calls importScripts. If the same-origin import now runs, the ONLY blocker was
 * TT and the fix is within airlock's own worker source.
 *
 * The harness passes a same-origin URL and (optionally) a cross-origin URL to
 * separate the TT question from strict-dynamic's host-allowlist behavior.
 */
let policyInstalled = false;
let policyError = null;
try {
  if (self.trustedTypes && self.trustedTypes.createPolicy) {
    // No `trusted-types` directive in the boilerplate CSP => any policy name
    // (incl. `default`) may be created. `default` is auto-invoked to coerce a
    // plain string passed to a sink like importScripts.
    self.trustedTypes.createPolicy("default", { createScriptURL: (s) => s, createHTML: (s) => s, createScript: (s) => s });
    policyInstalled = true;
  }
} catch (e) { policyError = String((e && (e.message || e.name)) || e); }

function tryImport(url) {
  self.__RAN = false;
  try {
    self.importScripts(url);
    return { url, executed: self.__RAN === true, threw: false, error: null };
  } catch (e) {
    return { url, executed: false, threw: true, error: String((e && (e.message || e.name)) || e) };
  }
}

self.onmessage = (ev) => {
  const m = ev.data || {};
  if (m.kind !== "go") return;
  self.__RAN = false;
  const sameOrigin = tryImport(m.sameOriginUrl); // marker: probe-bundle.js sets self.__RAN
  let crossOrigin = null;
  if (m.crossOriginUrl) crossOrigin = tryImport(m.crossOriginUrl);
  self.postMessage({ kind: "tt-fix-result", policyInstalled, policyError, sameOrigin, crossOrigin });
};
