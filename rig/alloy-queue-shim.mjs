// Test-only (spec 064-21): what a site-side `./alloy.min.js` stand-in does for the stock `aem-martech` library. The shipped
// adapter neither reads nor writes a page global (ADR-0063); this rig code takes over the loader's `stub.q` queue
// (`[resolve, reject, args]`), installs the bridge under the instance name and drains the queue through it.
// Self-contained (no imports, no closure) so the browser tests can inject it with `toString()`.
export function attachQueueShim(bridge, global, instanceName) {
  const stub = global[instanceName];
  const queued = stub && Array.isArray(stub.q) ? stub.q.splice(0) : [];
  global[instanceName] = bridge;
  for (const [resolve, reject, args] of queued) {
    let result;
    try { result = bridge(...args); } catch (e) { reject(e); continue; }
    Promise.resolve(result).then(resolve, reject);
  }
  return bridge;
}
