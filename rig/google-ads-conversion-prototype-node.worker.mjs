import { parentPort, threadId } from "node:worker_threads";

// Fixed trusted bridge, not a sandbox against adversarial Node modules.
globalThis.self = globalThis;
globalThis.postMessage = (message) => parentPort.postMessage(message);
await import("../connectors/google-ads/conversion-prototype.worker.js");
// Registration after import preserves early init in parentPort's message queue.
parentPort.on("message", (data) => self.onmessage({ data }));
let ambientFetchDenied = false;
try { await globalThis.fetch("airlock-probe:ambient-fetch"); }
catch (error) { ambientFetchDenied = error.message.includes("withheld in the chamber"); }
parentPort.postMessage({ type: "prototype-node-probe", threadId, ambientFetchDenied });
