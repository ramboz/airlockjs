/* Spec 033-02 AC1 rig — a same-origin stand-in the REAL built chamber worker
 * (connectors/alloy/alloy-chamber.worker.js) importScripts as its `bundleUrl`.
 *
 * The CSP verdict is decided AT the importScripts call: if the enforced boilerplate CSP
 * blocks it (Trusted Types — the pre-033-02 bare importScripts), boot()'s try/catch posts
 * fatal{phase:"load"}. With the 033-02 worker-realm TT policy, importScripts is ADMITTED,
 * THIS bundle runs, and the worker reaches phase:"loaded". A resolving self.alloy lets the
 * worker proceed through configure/sendEvent to phase:"configured" (proving nothing
 * downstream of the TT-policy'd importScripts trips the CSP). This is a CSP MECHANISM proof
 * with a STUB bundle — the real ~766 KB @adobe/alloy boot is the deploy/creds-gated residual
 * (slice § Residual); rig:alloy owns the functional boot.
 */
self.__ALLOY_STUB_BUNDLE_RAN = true;
self.alloy = function (command) {
  if (command === "sendEvent") return Promise.resolve({ propositions: [] });
  return Promise.resolve(undefined);
};
