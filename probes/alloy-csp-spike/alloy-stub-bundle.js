/* Spike 033-01 probe — a same-origin stand-in the REAL built chamber worker
 * (connectors/alloy/alloy-chamber.worker.js) importScripts as its `bundleUrl`.
 *
 * The real worker's boot() does: install() (sets self.alloy = queue fn) ->
 * importScripts(bundleUrl) -> summary.booted=true -> phase:"loaded" -> confinement
 * -> createConnectorHost -> host.init(caps) => self.alloy("configure", …).
 *
 * The CSP verdict is decided AT the importScripts call: if the CSP blocks it,
 * boot()'s try/catch posts fatal{phase:"load"}. If it is admitted, THIS bundle
 * runs and the worker reaches phase:"loaded". We ALSO install a resolving
 * self.alloy so the real worker can proceed through configure/sendEvent to
 * phase:"configured" (proving nothing downstream of importScripts trips the CSP).
 * This is a CSP mechanism probe — NOT a functional alloy boot (rig:alloy owns that).
 */
self.__ALLOY_STUB_BUNDLE_RAN = true;
// Replace the base-code queue fn with a resolving executor so configure/sendEvent
// settle (the real bundle installs an executor that drains self.alloy.q; here we
// just resolve, since functional alloy behavior is out of scope for a CSP probe).
self.alloy = function (command) {
  if (command === "sendEvent") return Promise.resolve({ propositions: [] });
  return Promise.resolve(undefined);
};
