import { createGoogleAdsPrototype } from "../adapters/google-ads-prototype.js";

const context = { pageURL: "https://example.test/google-a", referrer: "" };
const params = {
  send_to: "AW-0000000000/SYNTHETIC_LABEL", value: 28.75, currency: "CAD", transaction_id: "synthetic-a",
};
let adapter;
let deadline;
let positive;
let closing;
let phase = "not-started";
let failure = null;
let disposal = "not-created";
const controls = {};

function getJourneyState() {
  return {
    vendor: "google", phase, failure, disposal, controls: { ...controls },
    captureAndTransport: adapter?.getState() || null,
    receipt: "requires-independent-receiver-observation",
    workerEvidence: "requires-independent-worker-event-and-source-resource-observation",
    overall: "INCONCLUSIVE", fullCompatibility: false,
    nativeShape: { historicalRows: 12, names: 62, primaryNames: 39, localNames: 5, missingPrimaryNames: 34 },
    limitations: "059-19 complete gap report unchanged; response-linked branch, native values/SDK/browser/cookies/CWV/outcomes unavailable",
  };
}
function show() {
  document.getElementById("journey-state").textContent = JSON.stringify(getJourneyState(), null, 2);
}
function check(condition) {
  if (!condition) throw new Error("page-check-failed");
}
async function dispose() {
  if (!closing) closing = (async () => {
    let timer;
    try {
      await Promise.race([
        Promise.resolve().then(() => adapter?.dispose()),
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("dispose-deadline")), 1000); }),
      ]);
      disposal = adapter ? "adapter-dispose-resolved-worker-exit-needs-independent-observation" : "not-created";
    } catch {
      disposal = "UNKNOWN";
      throw new Error("page-cleanup-failed");
    } finally { clearTimeout(timer); }
  })();
  return closing;
}
async function fail(reason) {
  failure ||= reason;
  phase = "closing";
  clearTimeout(deadline);
  try { await dispose(); } catch { failure = "page-cleanup-failed"; }
  phase = "failed";
  show();
  return getJourneyState();
}
async function beginNegativeControls() {
  if (arguments.length || phase !== "not-started") return fail("invalid-page-phase");
  try {
    check(/^http:\/\/127\.0\.0\.1:[1-9]\d{0,4}$/.test(location.origin) && location.pathname === "/google" && !location.search && !location.hash);
    phase = "negative-controls";
    deadline = setTimeout(() => { void fail("page-deadline"); }, 19000);
    adapter = createGoogleAdsPrototype({
      endpoint: `${location.origin}/pagead/conversion/0000000000/`, captureContext: () => context,
      consent: { ad_storage: "pending" }, initTimeoutMs: 5000, commandTimeoutMs: 7000, transportTimeoutMs: 5000,
    });
    disposal = "pending";
    adapter.gtag("config", "AW-0000000000");
    adapter.gtag("event", "conversion", params);
    const pending = await adapter.flush();
    check(pending.outcomes.length === 2 && pending.outcomes[0].disposition === "configured" &&
      pending.outcomes[1].disposition === "held" && pending.host.dispatchAttempts === 0);
    controls.pendingDispatchAttempts = pending.host.dispatchAttempts;
    adapter.setConsent({ ad_storage: "denied" });
    adapter.gtag("event", "conversion", params);
    const denied = await adapter.flush();
    check(denied.outcomes.length === 3 && denied.outcomes[2].disposition === "held" && denied.host.dispatchAttempts === 0);
    controls.deniedDispatchAttempts = denied.host.dispatchAttempts;
    adapter.setConsent({ ad_storage: "granted" });
    const granted = await adapter.flush();
    check(granted.outcomes.length === 3 && granted.host.dispatchAttempts === 0 && granted.phase === "ready");
    controls.grantWithoutCommandDispatchAttempts = granted.host.dispatchAttempts;
    check(!failure);
    phase = "negative-controls-complete";
    show();
    return getJourneyState();
  } catch { return fail("negative-controls-failed"); }
}
async function beginPositiveControls() {
  if (arguments.length || phase !== "negative-controls-complete") return fail("invalid-page-phase");
  phase = "positive-in-flight";
  positive = (async () => {
    try {
      adapter.gtag("event", "conversion", params);
      Object.assign(params, { value: 0, currency: "", transaction_id: "synthetic-b" });
      context.pageURL = "https://example.test/google-b#second";
      adapter.gtag("event", "conversion", params);
      show();
      const state = await adapter.flush();
      check(!failure && state.phase === "ready" && state.host.dispatchAttempts === 2 && state.outcomes.length === 5 &&
        state.outcomes.slice(3).every((outcome, index) =>
          outcome.seq === index + 4 && outcome.disposition === "transport-settled" && outcome.status === 200));
      phase = "page-transport-settled";
      show();
      return getJourneyState();
    } catch { return fail("positive-controls-failed"); }
  })();
  return positive;
}
async function finishJourney() {
  if (arguments.length || !positive) return fail("invalid-page-phase");
  await positive;
  if (failure) return getJourneyState();
  try {
    check(phase === "page-transport-settled");
    const before = adapter.getState();
    check(before.phase === "ready" && before.terminalReason === null && before.cleanupFailure === null);
    phase = "closing";
    await dispose();
    const after = adapter.getState();
    check(!failure && after.phase === "disposed" && after.terminalReason === "disposed" && after.cleanupFailure === null);
    clearTimeout(deadline);
    phase = "completed-page-checks";
    show();
    return getJourneyState();
  } catch { return fail("page-cleanup-failed"); }
}
async function runJourney() {
  if (arguments.length) return fail("invalid-page-phase");
  await beginNegativeControls();
  if (!failure) await beginPositiveControls();
  if (!failure) return finishJourney();
  return getJourneyState();
}

Object.assign(window, { runJourney, getJourneyState, beginNegativeControls, beginPositiveControls, finishJourney });
window.addEventListener("pagehide", () => { if (adapter && phase !== "completed-page-checks") void fail("page-unloaded"); }, { once: true });
show();

if (location.pathname === "/google-browser-operation") {
  const allowedCases = ["readable", "opaque", "unreadable-primary", "csp-negative", "redirect-307", "revoke", "lifecycle"];
  const data = document.body.dataset;
  const origins = data.recipients.split(" ");
  const identity = {
    conversionId: "AW-1234567890", label: "fixture-conversion-label", value: 1, currency: "USD",
    transaction: "airlock-test-12345678-1234-1234-1234-123456789012",
    pageURL: "https://owned.example.test/tools/google-ads/test-purchase.html", auid: "123.456",
  };
  let operationAdapter;
  let operationPromise;
  let operationPhase = "not-started";
  let operationFailure = null;
  let operationDisposal = "not-created";
  function operationState() {
    return {
      caseName: data.case, phase: operationPhase, failure: operationFailure, disposal: operationDisposal,
      runtime: operationAdapter?.getState() || null, overall: "INCONCLUSIVE", fullCompatibility: false,
      receipt: "requires-independent-receiver-observation",
    };
  }
  function operationShow() {
    document.getElementById("journey-state").textContent = JSON.stringify(operationState(), null, 2);
  }
  async function prepareBrowserOperation() {
    if (arguments.length || !["not-started", "disposed"].includes(operationPhase) || !allowedCases.includes(data.case) ||
        origins.length !== 2 || origins.some((origin) => !/^http:\/\/127\.0\.0\.1:[1-9]\d{0,4}$/.test(origin)) ||
        !origins.includes(data.primary) || !origins.includes(data.secondary)) throw new Error("invalid-operation-case");
    operationPhase = "preparing";
    operationPromise = undefined;
    operationFailure = null;
    operationAdapter = createGoogleAdsPrototype({
      endpoint: `${data.primary}/pagead/conversion/1234567890/`,
      captureContext: () => ({ pageURL: identity.pageURL, referrer: "" }),
      consent: { ad_storage: "granted" }, experimentalRouting: true,
      experimentalBrowserOperation: {
        auid: identity.auid, recipientOrigins: origins, secondaryOrigin: data.secondary,
        secondaryMode: data.case === "opaque" ? "no-cors" : "cors",
        permissions: Object.fromEntries(origins.flatMap((origin) => [
          [new URL(origin).origin, ["ad_storage"]],
          [new URL(origin.replace("http:", "https:")).origin, ["ad_storage"]],
          ...(origin.endsWith(":80") ? [["https://127.0.0.1", ["ad_storage"]]] : []),
        ])),
      },
      initTimeoutMs: 2000, commandTimeoutMs: 5000, transportTimeoutMs: data.case === "lifecycle" ? 300 : 1500,
    });
    operationDisposal = "pending";
    operationAdapter.gtag("config", identity.conversionId);
    const state = await operationAdapter.flush();
    if (state.phase !== "ready" || state.outcomes.at(-1)?.disposition !== "configured") throw new Error("operation-config-failed");
    operationPhase = "ready";
    operationShow();
    return operationState();
  }
  function beginBrowserOperation() {
    if (arguments.length || !["ready", "settled"].includes(operationPhase)) throw new Error("operation-not-ready");
    operationPhase = "in-flight";
    operationAdapter.gtag("event", "conversion", {
      send_to: `${identity.conversionId}/${identity.label}`, value: identity.value,
      currency: identity.currency, transaction_id: identity.transaction,
    });
    operationPromise = operationAdapter.flush().then((state) => {
      operationPhase = state.phase === "ready" ? "settled" : "terminal";
      operationShow();
      return operationState();
    }).catch(() => {
      operationFailure = "operation-flush-failed";
      operationPhase = "failed";
      operationShow();
      return operationState();
    });
    operationShow();
  }
  function stopBrowserOperation(kind) {
    if (arguments.length !== 1 || !operationAdapter) throw new Error("invalid-operation-stop");
    if (kind === "consent") operationAdapter.setConsent({ ad_storage: "denied" });
    else if (kind === "permission") operationAdapter.setBrowserPermissions({});
    else if (kind === "worker") operationAdapter.retireBrowserWorker();
    else if (kind === "realm") {
      const frame = document.querySelector("iframe");
      if (!frame) throw new Error("missing-operation-frame");
      frame.remove();
    } else throw new Error("invalid-operation-stop");
    operationShow();
  }
  async function disposeBrowserOperation() {
    if (arguments.length || !operationAdapter) throw new Error("invalid-operation-dispose");
    try {
      await operationAdapter.dispose();
      operationDisposal = "resolved-worker-exit-needs-independent-observation";
    } catch { operationDisposal = "UNKNOWN"; throw new Error("operation-cleanup-failed"); }
    operationPhase = "disposed";
    operationShow();
    return operationState();
  }
  async function waitBrowserOperation() {
    if (arguments.length || !operationPromise) throw new Error("operation-not-started");
    return operationPromise;
  }
  async function probeDisallowedReceiver() {
    if (arguments.length || data.case !== "csp-negative" ||
        !/^http:\/\/127\.0\.0\.1:[1-9]\d{0,4}$/.test(data.denied)) throw new Error("invalid-reachability-control");
    const response = await fetch(`${data.denied}/reachability`, { credentials: "omit", redirect: "error", mode: "cors" });
    if (response.status !== 200 || (await response.text()) !== "") throw new Error("reachability-control-failed");
    return "reachable";
  }
  Object.assign(window, {
    prepareBrowserOperation, beginBrowserOperation, stopBrowserOperation, disposeBrowserOperation, waitBrowserOperation,
    getBrowserOperationState: operationState, probeDisallowedReceiver,
  });
  window.addEventListener("pagehide", () => { if (operationAdapter) void operationAdapter.dispose(); }, { once: true });
  operationShow();
}
