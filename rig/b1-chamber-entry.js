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
    post({ type: "rig-observed", request: { url: message.url, method: message.method, headers: message.headers, body: message.body } });
  }
  return post(message, ...rest);
};

self.addEventListener("message", async (event) => {
  const m = event.data || {};
  if (m.type !== "rig-command") return;
  try {
    post({ type: "rig-command-result", id: m.id, result: await self.alloy(m.command, m.options) });
  } catch (error) {
    post({ type: "rig-command-result", id: m.id, error: String((error && error.message) || error) });
  }
});
