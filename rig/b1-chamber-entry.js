// Replay-rig wrapper around the UNMODIFIED Alloy chamber worker (spec 064-17).
// It adds two rig-only things and no production surface:
//   - tees every request the chamber hands to the main-thread seam, so the replay can compare what
//     the chamber emitted even when the seam holds it (the edge-host ceiling is 064-18's work);
//   - drives a stock Alloy command (getIdentity, appendIdentityToUrl) that the event path never
//     issues, so S5 runs through the same chamber, cookie cache and intercepted fetch.
import "../connectors/alloy/alloy-chamber.worker.js";

const post = self.postMessage.bind(self);
self.postMessage = (message, ...rest) => {
  if (message && message.type === "intercepted-fetch") {
    post({ type: "rig-observed", request: { url: message.url, method: message.method, headers: message.headers, body: message.body, init: message.init, beacon: message.beacon } });
  }
  return post(message, ...rest);
};

self.addEventListener("message", async (event) => {
  const m = event.data || {};
  if (m.type === "intercepted-fetch-response") post({ type: "rig-response", response: { id: m.id, status: m.status, statusText: m.statusText, headers: m.headers } });
  // 064-26: count the commands that reach stock Alloy, so a test can show a refused name never does.
  if (m.type === "rig-spy") {
    const orig = self.alloy;
    self.__alloyCalls = [];
    self.alloy = (...a) => { self.__alloyCalls.push(a[0]); return orig(...a); };
    // the stub queues onto self.alloy.q, whose push Alloy has swapped for its executor
    self.alloy.q = orig.q;
    return post({ type: "rig-command-result", id: m.id, result: true });
  }
  if (m.type === "rig-spy-calls") return post({ type: "rig-command-result", id: m.id, result: self.__alloyCalls || [] });
  if (m.type !== "rig-command") return;
  try {
    // Rig-only probes for the 064-18 transport: a beacon and an element load made inside the chamber.
    if (m.command === "rig:sendBeacon") return post({ type: "rig-command-result", id: m.id, result: self.window.navigator.sendBeacon(m.options.url, m.options.body) });
    if (m.command === "rig:loadElement") {
      const el = self.document.createElement(m.options.tag);
      el.src = m.options.url;
      return post({ type: "rig-command-result", id: m.id, result: true });
    }
    post({ type: "rig-command-result", id: m.id, result: await self.alloy(m.command, m.options) });
  } catch (error) {
    post({ type: "rig-command-result", id: m.id, error: String((error && error.message) || error) });
  }
});
