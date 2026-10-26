import { createMetaPixelPrototype } from "../adapters/meta-pixel-prototype.js";

const context = {
  pageURL: "https://example.test/meta-a", referrer: "", inFrame: false,
  screenWidth: 412, screenHeight: 823, timezoneOffset: -420,
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
    vendor: "meta", phase, failure, disposal, controls: { ...controls },
    captureAndTransport: adapter?.getState() || null,
    receipt: "requires-independent-receiver-observation",
    workerEvidence: "requires-independent-worker-event-and-source-resource-observation",
    overall: "INCONCLUSIVE", fullCompatibility: false,
    limitations: "060-13 gaps unchanged; no native, browser, identity, attribution or performance qualification",
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
    check(/^http:\/\/127\.0\.0\.1:[1-9]\d{0,4}$/.test(location.origin) && location.pathname === "/meta" && !location.search && !location.hash);
    phase = "negative-controls";
    // Original page interval is 20s, reserving its last second for disposal.
    deadline = setTimeout(() => { void fail("page-deadline"); }, 19000);
    adapter = createMetaPixelPrototype({
      endpoint: `${location.origin}/tr/`, captureContext: () => context,
      consent: { ad_storage: "pending" }, initTimeoutMs: 5000, commandTimeoutMs: 7000, transportTimeoutMs: 5000,
    });
    disposal = "pending";
    adapter.fbq("init", "000000000000000");
    adapter.fbq("track", "PageView");
    const pending = await adapter.flush();
    check(pending.outcomes.length === 2 && pending.outcomes[0].disposition === "initialized" &&
      pending.outcomes[1].disposition === "held" && pending.host.dispatchAttempts === 0);
    controls.pendingDispatchAttempts = pending.host.dispatchAttempts;
    adapter.setConsent({ ad_storage: "denied" });
    adapter.fbq("track", "PageView");
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
      adapter.fbq("track", "PageView");
      context.pageURL = "https://example.test/meta-b#second";
      adapter.fbq("track", "PageView");
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
