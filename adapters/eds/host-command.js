// Spec 064-26 (ADR-0063): the main-thread side of the host command entry.
// `createHostCommandEntry` owns the call table, the ready latch and the loss paths. It never
// touches the network or the DOM itself: it posts one allowlisted command to the chamber and
// settles the caller's promise from the chamber's answer. Every rejection it raises is a plain
// Error (064-18: never a TypeError).
import { COMMAND_MESSAGE, COMMAND_RESULT_MESSAGE, errorFromEnvelope, isAllowedCommand, plainDataProblem, refusalMessage } from "../../connectors/alloy/host-commands.js";

/**
 * @param {{ worker: { postMessage: Function, addEventListener: Function }, renderer: { render: Function } }} deps
 * @returns {{ command: (name: string, options?: object) => Promise<unknown>, dispose: () => void }}
 */
export function createHostCommandEntry({ worker, renderer }) {
  let state = "booting"; // booting -> ready | failed (a terminal reason sits in `failure`)
  let failure = null;
  let seq = 0;
  const pending = new Map();
  const waiting = [];

  const settleAll = (error) => {
    for (const { reject } of pending.values()) reject(error);
    pending.clear();
    for (const { reject } of waiting.splice(0)) reject(error);
  };
  const fail = (message) => {
    if (state === "failed") return;
    state = "failed";
    failure = new Error(message);
    settleAll(failure);
  };
  const post = (call) => {
    pending.set(call.id, call);
    worker.postMessage({ type: COMMAND_MESSAGE, id: call.id, command: call.name, options: call.options });
  };

  worker.addEventListener("message", (e) => {
    const m = (e && e.data) || {};
    if (m.type === "phase" && m.name === "configured") {
      if (typeof m.configureSettled === "string" && m.configureSettled.startsWith("rejected")) return void fail(`airlock command: the Alloy chamber failed to configure (${m.configureSettled})`);
      if (state !== "booting") return;
      state = "ready";
      for (const call of waiting.splice(0)) post(call);
    } else if (m.type === "fatal" && (m.phase === "load" || m.phase === "post-load")) {
      fail(`airlock command: the Alloy chamber was lost (${m.message || m.phase})`);
    } else if (m.type === COMMAND_RESULT_MESSAGE) {
      const call = pending.get(m.id);
      if (!call) return; // late result for an id already settled
      pending.delete(m.id);
      if (m.error) call.reject(errorFromEnvelope(m.error));
      else call.resolve(m.result);
    }
  });
  worker.addEventListener("error", () => fail("airlock command: the Alloy chamber was lost (worker error)"));

  // `applyResponse` runs headless in the chamber; a caller who asked to render gets the 064-20 renderer on the result.
  const finish = async (name, wantsRender, result) => {
    if (name !== "applyResponse" || !wantsRender || !result || !Array.isArray(result.propositions)) return result;
    const out = await renderer.render(result.propositions);
    return { ...result, propositions: out.propositions };
  };

  return {
    command(name, options) {
      try {
        if (state === "failed") throw failure;
        if (!isAllowedCommand(name)) throw new Error(refusalMessage(name));
        const problem = options === undefined ? null : plainDataProblem(options);
        if (problem) throw new Error(`airlock command: ${problem}`);
        if (options !== undefined && options !== null && (typeof options !== "object" || Array.isArray(options))) throw new Error("airlock command: options must be a plain object");
      } catch (error) {
        return Promise.reject(error instanceof Error && error.name !== "TypeError" ? error : new Error(error.message));
      }
      const wantsRender = Boolean(options && options.renderDecisions === true);
      return new Promise((resolve, reject) => {
        const call = { id: ++seq, name, options: options || {}, resolve, reject };
        if (state === "ready") post(call); else waiting.push(call);
      }).then((result) => finish(name, wantsRender, result));
    },
    dispose() {
      if (state === "failed") return;
      fail("airlock command: the handle was disposed");
    },
  };
}
