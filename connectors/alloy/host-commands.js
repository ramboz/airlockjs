// Spec 064-26 / ADR-0063: the host command entry's allowlist and wire shapes, shared by the
// main-thread entry (adapters/eds/host-command.js) and the chamber worker so both enforce one list.
// Pure: no `self`, no DOM.

/** The only Alloy commands a site can reach through `handle.command`. */
export const ALLOY_HOST_COMMANDS = Object.freeze(["getIdentity", "appendIdentityToUrl", "applyResponse", "getLibraryInfo", "createEventMergeId"]);

export const COMMAND_MESSAGE = "command";
export const COMMAND_RESULT_MESSAGE = "command-result";

/** Where a stock command the list excludes is reached instead. */
const POINTERS = Object.freeze({
  sendEvent: "use handle.push",
  setConsent: "use handle.setConsent",
  configure: "set it through the bootAlloy options",
  applyPropositions: "use handle.applyPropositions",
  subscribeRulesetItems: "use handle.subscribeRulesetItems",
});

export const isAllowedCommand = (name) => typeof name === "string" && ALLOY_HOST_COMMANDS.includes(name);

export function refusalMessage(name) {
  if (typeof name !== "string" || !name) return "airlock command: the command name must be a non-empty string";
  const hint = POINTERS[name] ? `; ${POINTERS[name]}` : "";
  return `airlock command: "${name}" is not a host command (allowed: ${ALLOY_HOST_COMMANDS.join(", ")})${hint}`;
}

/** Plain structured-clone-safe data: primitives, arrays, plain objects. No function, symbol, bigint, DOM node or class instance. */
export function plainDataProblem(value, path = "options", seen = new Set()) {
  if (value === null || ["string", "boolean"].includes(typeof value)) return null;
  if (typeof value === "number") return Number.isFinite(value) ? null : `${path} is not a finite number`;
  if (typeof value !== "object") return `${path} is a ${typeof value}, which cannot cross the airlock`;
  if (seen.has(value)) return `${path} is a circular reference`;
  seen.add(value);
  try {
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i += 1) {
        const p = plainDataProblem(value[i], `${path}[${i}]`, seen);
        if (p) return p;
      }
      return null;
    }
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) return `${path} is not a plain object`;
    for (const key of Object.keys(value)) {
      const p = plainDataProblem(value[key], `${path}.${key}`, seen);
      if (p) return p;
    }
    return null;
  } finally {
    seen.delete(value);
  }
}

/** Error envelope: structured clone drops custom properties, so name, message and code are copied explicitly. */
export function errorEnvelope(error) {
  const e = error || {};
  return { name: String(e.name || "Error"), message: String(e.message === undefined ? error : e.message), ...(e.code !== undefined ? { code: e.code } : {}) };
}

/** A caller never receives a TypeError (064-18 contract): the original name stays on the plain Error. */
export function errorFromEnvelope(envelope) {
  const e = envelope || {};
  const out = new Error(String(e.message || "command failed"));
  if (e.name && e.name !== "Error") {
    out.alloyName = e.name;
    if (e.name !== "TypeError") out.name = e.name;
  }
  if (e.code !== undefined) out.code = e.code;
  return out;
}
