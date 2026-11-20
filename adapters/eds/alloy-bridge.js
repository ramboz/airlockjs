// Spec 064-21 (ADR-0063): the site-side wrapper that lets a page written against stock `alloy(command, options)`,
// such as the `aem-martech` library, run on a `bootAlloy` handle. It is site code in the adapter: it maps each stock
// command onto the handle's own entry points and adds no capability, no page-global `alloy` of its own making
// (`attachAlloyBridge` installs the page's own `alloy` name only when the site calls it; the loader's queue stub is normally already there) and no
// command beyond the ADR-0063 allowlist. It is meant for a `bootAlloy` handle (every stock `sendEvent` is pushed as
// `page_view`, which that handle ignores; a handle that routes by event name would not be a fit). `configure` options
// other than function callbacks are fixed at boot and left inert here (064-31 AC6 and AC7).
//
//   sendEvent         -> handle.push     (after the page's onBeforeEventSend, run here on the main thread)
//   setConsent        -> handle.setConsent (the consent vector the seam understands; see CONSENT_GAP below)
//   configure         -> boot options are fixed at `bootAlloy`; only `onBeforeEventSend` is taken from it
//   applyPropositions -> handle.applyPropositions
//   anything else     -> handle.command   (it rejects a name outside the allowlist with a plain Error)

/**
 * `consent` (Adobe 2.0) -> the host consent vector. `collect` and `personalize.content` are the two purposes the seam
 * governs. CONSENT_GAP: `marketing` and `share` have no counterpart in the vector, so they are not carried (the
 * recorded set-consent body names them; owned by 064-31 AC4).
 * @param {unknown} consent the `consent` option of a stock `setConsent`
 * @returns {Record<string, "granted" | "denied"> | null}
 */
export function consentToVector(consent) {
  const entries = Array.isArray(consent) ? consent : [];
  const adobe = entries.find((c) => c && c.standard === "Adobe" && c.value && typeof c.value === "object");
  if (!adobe) return null;
  const v = adobe.value;
  const verdict = (x) => (x && x.val === "y" ? "granted" : "denied");
  const out = {};
  if (v.collect) out.analytics_storage = verdict(v.collect);
  if (v.personalize && v.personalize.content) out.personalization = verdict(v.personalize.content);
  return Object.keys(out).length ? out : null;
}

const clone = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));

/**
 * @param {{ push: Function, setConsent: Function, applyPropositions: Function, command: Function }} handle a `bootAlloy` handle
 * @param {{ onDiagnostic?: (record: object) => void }} [opts]
 * @returns {(command: string, options?: object) => Promise<unknown>} a stock-shaped `alloy(command, options)`
 */
export function createAlloyCommandBridge(handle, opts = {}) {
  let onBeforeEventSend = null;
  const diagnose = typeof opts.onDiagnostic === "function" ? opts.onDiagnostic : (r) => console.warn(r);

  const configure = (options = {}) => {
    for (const [name, value] of Object.entries(options)) {
      if (typeof value !== "function") continue;
      if (name === "onBeforeEventSend") onBeforeEventSend = value;
      else diagnose({ level: "warn", kind: "unsupported-callback", option: name, reason: `alloy("configure") option ${name} is a function and cannot cross the airlock` });
    }
    return Promise.resolve({});
  };

  const sendEvent = async (options = {}) => {
    const { xdm, data, type, documentUnloading, decisionScopes, personalization, renderDecisions, edgeConfigOverrides, datasetId } = options;
    // Config overrides and dataset ids are a config-pin matter (host-owned): never carried, said out loud when present.
    for (const [option, present] of [["edgeConfigOverrides", edgeConfigOverrides && Object.keys(edgeConfigOverrides).length], ["datasetId", datasetId !== undefined]]) {
      if (present) diagnose({ level: "warn", kind: "unsupported-option", option, reason: "per-event config overrides are host-owned (config pin) and are not carried by push" });
    }
    const content = { xdm: clone(xdm) || {}, ...(data === undefined ? {} : { data: clone(data) }) };
    if (typeof type === "string" && type && !content.xdm.eventType) content.xdm.eventType = type;
    if (onBeforeEventSend) {
      let verdict;
      try { verdict = onBeforeEventSend(content); } catch (e) { diagnose({ level: "warn", kind: "hook-threw", option: "onBeforeEventSend", reason: `onBeforeEventSend threw (${e && e.message}); the event is dropped` }); verdict = false; }
      if (verdict === false) return {};
    }
    handle.push({
      event: "page_view",
      xdm: content.xdm,
      ...(content.data === undefined ? {} : { data: content.data }),
      ...(documentUnloading === true ? { documentUnloading: true } : {}),
      ...(Array.isArray(decisionScopes) ? { decisionScopes: clone(decisionScopes) } : {}),
      ...(personalization && typeof personalization === "object" ? { personalization: clone(personalization) } : {}),
      renderDecisions: renderDecisions === true, // stock defaults to false; the host default would render
    });
    return {};
  };

  const setConsent = async (options = {}) => {
    const vector = consentToVector(options.consent);
    if (vector) handle.setConsent(vector);
    else diagnose({ level: "warn", kind: "unsupported-consent", reason: "setConsent carried no Adobe 2.0 collect/personalize value; nothing was applied" });
    return {};
  };

  return function alloy(command, options) {
    switch (command) {
      case "configure": return configure(options);
      case "sendEvent": return sendEvent(options);
      case "setConsent": return setConsent(options);
      case "applyPropositions": return handle.applyPropositions(options);
      default: return handle.command(command, options);
    }
  };
}

/**
 * Take over the queue stub a stock-style loader left on `global[instanceName]` (`aem-martech` leaves one with `.q`
 * holding `[resolve, reject, args]`): replace it with the bridge and drain the queue through it, as the real library does
 * when it loads. Later calls reach the bridge directly.
 * @param {{ handle: object, global?: object, instanceName?: string, onDiagnostic?: Function }} args
 * @returns {Function} the installed `alloy` function
 */
export function attachAlloyBridge({ handle, global = globalThis, instanceName = "alloy", onDiagnostic }) {
  const bridge = createAlloyCommandBridge(handle, { onDiagnostic });
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
