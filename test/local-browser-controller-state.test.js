import { afterEach, describe, expect, it, vi } from "vitest";

const fake = vi.hoisted(() => ({ adapter: null }));
vi.mock("../adapters/meta-pixel-prototype.js", () => ({ createMetaPixelPrototype: () => fake.adapter }));
vi.mock("../adapters/google-ads-prototype.js", () => ({ createGoogleAdsPrototype: () => fake.adapter }));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("controller state-only fault controls, NOT browser execution", () => {
  it.each([["meta", true], ["google", true], ["meta", false], ["google", false]])(
    "%s checks current adapter health before completion (late failure=%s)", async (vendor, lateFailure) => {
    const state = { phase: "ready", terminalReason: null, cleanupFailure: null, host: { dispatchAttempts: 0 }, outcomes: [] };
    const capture = () => {
      const seq = state.outcomes.length + 1;
      state.outcomes.push(seq === 1
        ? { seq, disposition: vendor === "meta" ? "initialized" : "configured", requests: 0 }
        : seq <= 3 ? { seq, disposition: "held", status: 0 }
          : { seq, disposition: "transport-settled", status: 204 });
      if (seq >= 4) state.host.dispatchAttempts += 1;
    };
    fake.adapter = {
      fbq: capture, gtag: capture, setConsent() {},
      flush: async () => structuredClone(state), getState: () => structuredClone(state),
      dispose: vi.fn(async () => {
        if (state.phase === "ready") { state.phase = "disposed"; state.terminalReason = "disposed"; }
      }),
    };
    vi.stubGlobal("document", { getElementById: () => ({ textContent: "" }) });
    vi.stubGlobal("location", new URL(`http://127.0.0.1:43111/${vendor}`));
    vi.stubGlobal("window", { addEventListener() {} });
    if (vendor === "meta") await import("../rig/local-browser-journeys-meta.js");
    else await import("../rig/local-browser-journeys-google.js");
    try {
      expect((await window.beginNegativeControls()).phase).toBe("negative-controls-complete");
      expect((await window.beginPositiveControls()).phase).toBe("page-transport-settled");
      if (lateFailure) { state.phase = "terminal"; state.terminalReason = "worker-error"; }
      const final = await window.finishJourney();
      expect(final.phase).toBe(lateFailure ? "failed" : "completed-page-checks");
      expect(final.captureAndTransport.phase).toBe(lateFailure ? "terminal" : "disposed");
      expect(final.fullCompatibility).toBe(false);
    } finally { await fake.adapter.dispose(); }
  });
});
