import { parentPort, threadId } from "node:worker_threads";

// Fixed first-party bridge, not a Node sandbox or a browser qualification.
globalThis.self = globalThis;
globalThis.postMessage = (message) => parentPort.postMessage(message);
await import("../connectors/meta-pixel/pageview-prototype.worker.js");
parentPort.on("message", (data) => self.onmessage({ data }));

let ambientFetchDenied = false;
try {
  await globalThis.fetch("airlock-probe:ambient-fetch");
} catch (error) {
  ambientFetchDenied = error.message.includes("withheld in the chamber");
}
parentPort.postMessage({ type: "prototype-node-probe", threadId, ambientFetchDenied });
