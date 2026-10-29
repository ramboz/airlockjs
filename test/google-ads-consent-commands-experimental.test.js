import { describe, expect, it, vi } from "vitest";
import { createGoogleAdsPrototype } from "../adapters/google-ads-prototype.js";
import { createGoogleAdsConversionPrototype } from "../connectors/google-ads/conversion-prototype.js";
import { closeConversionResources, createConversionReceiver, createNodeConversionChamber } from "../rig/google-ads-conversion-prototype.mjs";

const conversion = { send_to: "AW-0000000000/SYNTHETIC_LABEL" };
const context = { pageURL: "https://example.test/consent", referrer: "" };

async function local(options, run) {
  let receiver, chamber, adapter, cause;
  try {
    receiver = await createConversionReceiver();
    chamber = createNodeConversionChamber();
    adapter = createGoogleAdsPrototype({
      endpoint: receiver.endpoint, chamber, captureContext: () => context,
      consent: { ad_storage: "granted" }, experimentalConsentCommands: true, ...options,
    });
    await run({ adapter, receiver });
  } catch (error) { cause = error; throw error; }
  finally { await closeConversionResources({ adapter, chamber, receiver, cause }); }
}

describe("experimental Google consent commands", () => {
  it("applies queued tag consent without overriding host consent or replaying held conversions", async () => {
    await local({}, async ({ adapter, receiver }) => {
      adapter.gtag("config", "AW-0000000000");
      adapter.gtag("event", "conversion", conversion);
      adapter.gtag("consent", "default", { ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied", analytics_storage: "denied" });
      adapter.gtag("event", "conversion", conversion);
      const update = { ad_storage: "granted", ad_user_data: "granted", ad_personalization: "granted", analytics_storage: "granted" };
      adapter.gtag("consent", "update", update);
      update.ad_storage = "denied";
      adapter.gtag("event", "conversion", conversion);
      let state = await adapter.flush();
      expect(state.outcomes.map(({ disposition }) => disposition)).toEqual([
        "configured", "held", "consent-updated", "held", "consent-updated", "transport-settled",
      ]);
      expect(receiver.arrivals).toHaveLength(1);
      expect(state.host).toMatchObject({ dispatchAttempts: 1, consentHeld: 2 });
      expect([...new URL(receiver.arrivals[0].url).searchParams.keys()]).toEqual(["label", "url"]);
      expect(state.fullCompatibility).toBe(false);
      expect(state.outcomes[2].unmodeledPurposes).toEqual(["ad_user_data", "ad_personalization", "analytics_storage"]);
      state.outcomes[2].unmodeledPurposes.pop();
      expect(adapter.getState().outcomes[2].unmodeledPurposes).toHaveLength(3);
      await adapter.flush();
      expect(receiver.arrivals).toHaveLength(1);

      adapter.setConsent({ ad_storage: "denied" });
      adapter.gtag("consent", "update", { ad_storage: "granted" });
      adapter.gtag("event", "conversion", conversion);
      state = await adapter.flush();
      expect(state.outcomes.slice(-2).map(({ disposition }) => disposition)).toEqual(["consent-updated", "held"]);
      expect(receiver.arrivals).toHaveLength(1);

      adapter.setConsent({ ad_storage: "granted" });
      adapter.gtag("consent", "update", { ad_storage: "denied" });
      adapter.gtag("event", "conversion", conversion);
      state = await adapter.flush();
      expect(state.outcomes.slice(-2).map(({ disposition }) => disposition)).toEqual(["consent-updated", "held"]);
      expect(receiver.arrivals).toHaveLength(1);
    });
  }, 8000);

  it("merges partial defaults and updates without a later default replacing an explicit update", async () => {
    await local({}, async ({ adapter, receiver }) => {
      adapter.gtag("consent", "default", { ad_storage: "granted" });
      adapter.gtag("consent", "default", { analytics_storage: "granted" });
      adapter.gtag("config", "AW-0000000000");
      adapter.gtag("event", "conversion", conversion);
      await adapter.flush();
      adapter.gtag("consent", "update", { ad_storage: "denied" });
      adapter.gtag("consent", "default", { ad_storage: "granted" });
      adapter.gtag("event", "conversion", conversion);
      adapter.gtag("consent", "update", { ad_user_data: "granted" });
      adapter.gtag("event", "conversion", conversion);
      adapter.gtag("consent", "update", { ad_storage: "granted" });
      adapter.gtag("event", "conversion", conversion);
      const state = await adapter.flush();
      expect(state.outcomes.filter(({ disposition }) => ["held", "transport-settled"].includes(disposition))
        .map(({ disposition }) => disposition)).toEqual(["transport-settled", "held", "held", "transport-settled"]);
      expect(receiver.arrivals).toHaveLength(2);
      expect(state.host).toMatchObject({ dispatchAttempts: 2, consentHeld: 2 });
    });
  }, 8000);

  it("does not turn a missing host signal into a grant or replay after a host update", async () => {
    await local({ consent: null }, async ({ adapter, receiver }) => {
      adapter.gtag("consent", "default", { ad_storage: "granted" });
      adapter.gtag("config", "AW-0000000000");
      adapter.gtag("event", "conversion", conversion);
      expect((await adapter.flush()).outcomes.at(-1).disposition).toBe("held");
      expect(receiver.arrivals).toEqual([]);
      adapter.setConsent({ ad_storage: "granted" });
      await adapter.flush();
      expect(receiver.arrivals).toEqual([]);
      adapter.gtag("event", "conversion", conversion);
      expect((await adapter.flush()).outcomes.at(-1).disposition).toBe("transport-settled");
      expect(receiver.arrivals).toHaveLength(1);
    });
  }, 8000);

  it.each(["analytics_storage", "ad_user_data", "ad_personalization"])(
    "holds an outstanding %s denial through unrelated updates and host changes", async (purpose) => {
      await local({}, async ({ adapter, receiver }) => {
        const other = purpose === "analytics_storage" ? "ad_user_data" : "analytics_storage";
        adapter.gtag("consent", "default", { ad_storage: "granted" });
        adapter.gtag("consent", "update", { [purpose]: "denied" });
        adapter.gtag("config", "AW-0000000000");
        adapter.gtag("event", "conversion", conversion);
        adapter.gtag("consent", "update", { ad_storage: "granted", [other]: "granted" });
        adapter.gtag("consent", "default", { [purpose]: "granted" });
        adapter.gtag("event", "conversion", conversion);
        let state = await adapter.flush();
        expect(state.outcomes.filter(({ disposition }) => ["held", "transport-settled"].includes(disposition))
          .map(({ disposition }) => disposition)).toEqual(["held", "held"]);
        expect(receiver.arrivals).toEqual([]);
        adapter.setConsent({ ad_storage: "denied" });
        adapter.gtag("event", "conversion", conversion);
        await adapter.flush();
        adapter.setConsent({ ad_storage: "granted" });
        adapter.gtag("event", "conversion", conversion);
        expect((await adapter.flush()).outcomes.at(-1).disposition).toBe("held");
        expect(receiver.arrivals).toEqual([]);
        adapter.gtag("consent", "update", { [purpose]: "granted" });
        await adapter.flush();
        expect(receiver.arrivals).toEqual([]);
        adapter.gtag("event", "conversion", conversion);
        state = await adapter.flush();
        expect(state.outcomes.at(-1).disposition).toBe("transport-settled");
        expect(state.host).toMatchObject({ dispatchAttempts: 1, consentHeld: 4 });
        expect(receiver.arrivals).toHaveLength(1);
      });
    }, 8000,
  );

  it("keeps each denied default held until that purpose is explicitly updated", async () => {
    await local({}, async ({ adapter, receiver }) => {
      adapter.gtag("consent", "default", {
        ad_storage: "denied", analytics_storage: "denied", ad_user_data: "denied", ad_personalization: "denied",
      });
      adapter.gtag("config", "AW-0000000000");
      for (const purpose of ["ad_storage", "ad_user_data", "analytics_storage"]) {
        adapter.gtag("consent", "update", { [purpose]: "granted" });
        adapter.gtag("event", "conversion", conversion);
      }
      let state = await adapter.flush();
      expect(state.outcomes.filter(({ disposition }) => ["held", "transport-settled"].includes(disposition))
        .map(({ disposition }) => disposition)).toEqual(["held", "held", "held"]);
      expect(receiver.arrivals).toEqual([]);
      adapter.gtag("consent", "update", { ad_personalization: "granted" });
      await adapter.flush();
      expect(receiver.arrivals).toEqual([]);
      adapter.gtag("event", "conversion", conversion);
      state = await adapter.flush();
      expect(state.outcomes.at(-1).disposition).toBe("transport-settled");
      expect(receiver.arrivals).toHaveLength(1);
    });
  }, 8000);

  it("rejects malformed or unsupported consent inputs atomically without executing accessors", async () => {
    await local({}, async ({ adapter, receiver }) => {
      const getter = vi.fn(() => "granted");
      const accessor = {};
      Object.defineProperty(accessor, "ad_storage", { get: getter, enumerable: true });
      const invalid = [
        ["default", {}], ["other", { ad_storage: "granted" }], ["update", { ad_storage: "GRANTED" }],
        ["update", { ad_storage: true }], ["update", { ad_storage: "granted", wait_for_update: 500 }],
        ["default", { ad_storage: "granted", region: ["US"] }], ["update", accessor],
        ["update", { ad_storage: "granted", extra: "unsupported" }],
      ];
      adapter.gtag("consent", "default", { ad_storage: "denied" });
      adapter.gtag("config", "AW-0000000000");
      for (const [command, values] of invalid) adapter.gtag("consent", command, values);
      adapter.gtag("event", "conversion", conversion);
      const state = await adapter.flush();
      expect(state.outcomes.slice(2, -1)).toHaveLength(invalid.length);
      expect(state.outcomes.slice(2, -1).every(({ disposition }) => disposition === "rejected")).toBe(true);
      expect(state.outcomes.at(-1).disposition).toBe("held");
      expect(getter).not.toHaveBeenCalled();
      expect(receiver.arrivals).toEqual([]);
    });
  }, 8000);

  it("independently validates consent commands inside the connector", () => {
    const connector = createGoogleAdsConversionPrototype({
      endpoint: "http://127.0.0.1:41234/pagead/conversion/0000000000/", experimentalConsentCommands: true,
    });
    connector.init();
    const command = (args) => connector.handle({ type: "google-ads-command", payload: { args, context } });
    expect(command(["consent", "default", { ad_storage: "denied" }])).toEqual([]);
    expect(command(["consent", "update", { ad_storage: "granted", analytics_storage: "denied" }])).toEqual([]);
    expect(() => command(["consent", "update", { ad_storage: "granted", wait_for_update: 500 }])).toThrow("unsupported-consent");
    const getter = vi.fn(() => "granted");
    const values = {};
    Object.defineProperty(values, "ad_storage", { get: getter });
    expect(() => command(["consent", "update", values])).toThrow("unsupported-consent");
    expect(getter).not.toHaveBeenCalled();
    expect(() => createGoogleAdsConversionPrototype({
      endpoint: "http://127.0.0.1:41234/pagead/conversion/0000000000/", experimentalConsentCommands: "yes",
    })).toThrow("invalid-experimental-option");
  });

  it("enforces tag and host consent independently on each multi-destination branch", async () => {
    let first, second, chamber, adapter, cause;
    try {
      first = await createConversionReceiver({ conversionId: "111" });
      second = await createConversionReceiver({ conversionId: "222" });
      chamber = createNodeConversionChamber();
      adapter = createGoogleAdsPrototype({
        endpoint: first.endpoint, additionalEndpoint: second.endpoint, chamber, captureContext: () => context,
        experimentalRouting: true, experimentalMultiDestination: true, experimentalConsentCommands: true,
        consent: { ad_storage: "granted" },
      });
      adapter.gtag("consent", "default", { ad_storage: "denied" });
      adapter.gtag("config", "AW-111");
      adapter.gtag("config", "AW-222");
      const event = { send_to: ["AW-111/ONE", "AW-222/TWO"] };
      adapter.gtag("event", "conversion", event);
      adapter.gtag("consent", "update", { ad_storage: "granted" });
      adapter.gtag("event", "conversion", event);
      await adapter.flush();
      adapter.gtag("consent", "update", { ad_user_data: "denied" });
      adapter.gtag("event", "conversion", event);
      adapter.gtag("consent", "update", { ad_storage: "granted" });
      adapter.gtag("event", "conversion", event);
      adapter.gtag("consent", "update", { ad_user_data: "granted" });
      adapter.gtag("event", "conversion", event);
      const state = await adapter.flush();
      expect(state.outcomes.filter(({ branches }) => branches).map(({ disposition, branches }) => ({
        disposition, branches: branches.map(({ disposition: branch }) => branch),
      }))).toEqual([
        { disposition: "held", branches: ["held", "held"] },
        { disposition: "transport-settled", branches: ["transport-settled", "transport-settled"] },
        { disposition: "held", branches: ["held", "held"] },
        { disposition: "held", branches: ["held", "held"] },
        { disposition: "transport-settled", branches: ["transport-settled", "transport-settled"] },
      ]);
      expect(state.host).toMatchObject({ dispatchAttempts: 4, consentHeld: 6 });
      expect(first.arrivals).toHaveLength(2);
      expect(second.arrivals).toHaveLength(2);
    } catch (error) { cause = error; throw error; }
    finally {
      try { await closeConversionResources({ adapter, chamber, receiver: first, cause }); }
      finally { await closeConversionResources({ receiver: second, cause }); }
    }
  }, 8000);

  it("observes host revocation between branches even after tag consent grants", async () => {
    let first, second, chamber, adapter, cause, release;
    let notifyArrival;
    let arrivalTimer;
    const arrival = new Promise((resolve, reject) => {
      arrivalTimer = setTimeout(() => reject(new Error("first-arrival-timeout")), 2000);
      notifyArrival = () => { clearTimeout(arrivalTimer); resolve(); };
    });
    try {
      first = await createConversionReceiver({
        conversionId: "111",
        respond(_request, response) { release = () => response.writeHead(204).end(); notifyArrival(); },
      });
      second = await createConversionReceiver({ conversionId: "222" });
      chamber = createNodeConversionChamber();
      adapter = createGoogleAdsPrototype({
        endpoint: first.endpoint, additionalEndpoint: second.endpoint, chamber, captureContext: () => context,
        experimentalRouting: true, experimentalMultiDestination: true, experimentalConsentCommands: true,
        consent: { ad_storage: "granted" },
      });
      adapter.gtag("consent", "default", { ad_storage: "granted" });
      adapter.gtag("config", "AW-111");
      adapter.gtag("config", "AW-222");
      adapter.gtag("event", "conversion", { send_to: ["AW-111/ONE", "AW-222/TWO"] });
      const done = adapter.flush();
      await arrival;
      adapter.setConsent({ ad_storage: "denied" });
      release();
      const state = await done;
      expect(state.outcomes.at(-1)).toMatchObject({
        disposition: "partial",
        branches: [
          { index: 0, disposition: "transport-settled", status: 204 },
          { index: 1, disposition: "held", status: 0, reason: "held-at-seal" },
        ],
      });
      expect(first.arrivals).toHaveLength(1);
      expect(second.arrivals).toEqual([]);
    } catch (error) { cause = error; throw error; }
    finally {
      clearTimeout(arrivalTimer);
      try { await closeConversionResources({ adapter, chamber, receiver: first, cause }); }
      finally { await closeConversionResources({ receiver: second, cause }); }
    }
  }, 8000);

  it.each(["ad_storage", "analytics_storage", "ad_user_data", "ad_personalization"])(
    "immediately enforces each pending %s denial between branches", async (purpose) => {
      let first, second, chamber, adapter, cause, release;
      let notifyArrival;
      let arrivalTimer;
      const arrival = new Promise((resolve, reject) => {
        arrivalTimer = setTimeout(() => reject(new Error("first-arrival-timeout")), 2000);
        notifyArrival = () => { clearTimeout(arrivalTimer); resolve(); };
      });
      let count = 0;
      try {
        first = await createConversionReceiver({
          conversionId: "111",
          respond(_request, response) {
            if (++count === 1) { release = () => response.writeHead(204).end(); notifyArrival(); }
            else response.writeHead(204).end();
          },
        });
        second = await createConversionReceiver({ conversionId: "222" });
        chamber = createNodeConversionChamber();
        adapter = createGoogleAdsPrototype({
          endpoint: first.endpoint, additionalEndpoint: second.endpoint, chamber, captureContext: () => context,
          experimentalRouting: true, experimentalMultiDestination: true, experimentalConsentCommands: true,
          consent: { ad_storage: "granted" },
        });
        adapter.gtag("consent", "update", { ad_storage: "granted", [purpose]: "granted" });
        adapter.gtag("config", "AW-111");
        adapter.gtag("config", "AW-222");
        await adapter.flush();
        const event = { send_to: ["AW-111/ONE", "AW-222/TWO"] };
        adapter.gtag("event", "conversion", event);
        await arrival;
        adapter.gtag("consent", "default", { [purpose]: "denied" });
        adapter.gtag("consent", "update", { [purpose]: "granted" });
        adapter.gtag("consent", "default", { [purpose]: "denied" });
        adapter.gtag("event", "conversion", event);
        release();
        const state = await adapter.flush();
        const conversions = state.outcomes.filter(({ branches }) => branches);
        expect(conversions.map(({ disposition, branches }) => ({
          disposition, branches: branches.map(({ disposition: branch }) => branch),
        }))).toEqual([
          { disposition: "partial", branches: ["transport-settled", "held"] },
          { disposition: "held", branches: ["held", "held"] },
        ]);
        expect(first.arrivals).toHaveLength(1);
        expect(second.arrivals).toEqual([]);
        adapter.gtag("consent", "update", { [purpose]: "granted" });
        await adapter.flush();
        expect(first.arrivals).toHaveLength(1);
        expect(second.arrivals).toEqual([]);
        adapter.gtag("event", "conversion", event);
        expect((await adapter.flush()).outcomes.at(-1).disposition).toBe("transport-settled");
        expect(first.arrivals).toHaveLength(2);
        expect(second.arrivals).toHaveLength(1);
      } catch (error) { cause = error; throw error; }
      finally {
        clearTimeout(arrivalTimer);
        try { await closeConversionResources({ adapter, chamber, receiver: first, cause }); }
        finally { await closeConversionResources({ receiver: second, cause }); }
      }
    }, 8000,
  );

  it("does not enforce invalid or queue-overflow denials that were never admitted", async () => {
    let first, second, chamber, adapter, cause, release;
    let notifyArrival;
    let arrivalTimer;
    const arrival = new Promise((resolve, reject) => {
      arrivalTimer = setTimeout(() => reject(new Error("first-arrival-timeout")), 2000);
      notifyArrival = () => { clearTimeout(arrivalTimer); resolve(); };
    });
    try {
      first = await createConversionReceiver({
        conversionId: "111",
        respond(_request, response) { release = () => response.writeHead(204).end(); notifyArrival(); },
      });
      second = await createConversionReceiver({ conversionId: "222" });
      chamber = createNodeConversionChamber();
      adapter = createGoogleAdsPrototype({
        endpoint: first.endpoint, additionalEndpoint: second.endpoint, chamber, captureContext: () => context,
        experimentalRouting: true, experimentalMultiDestination: true, experimentalConsentCommands: true,
        consent: { ad_storage: "granted" }, queueLimit: 1,
      });
      adapter.gtag("consent", "update", { ad_storage: "granted" });
      await adapter.flush();
      adapter.gtag("config", "AW-111");
      await adapter.flush();
      adapter.gtag("config", "AW-222");
      await adapter.flush();
      adapter.gtag("event", "conversion", { send_to: ["AW-111/ONE", "AW-222/TWO"] });
      await arrival;
      adapter.gtag("consent", "update", { ad_user_data: "denied", wait_for_update: 500 });
      adapter.gtag("consent", "update", { ad_storage: "granted" });
      adapter.gtag("consent", "update", { ad_user_data: "denied" });
      release();
      const state = await adapter.flush();
      expect(state.outcomes.filter(({ disposition }) => disposition === "rejected").map(({ reason }) => reason))
        .toEqual(["unsupported-parameters", "queue-overflow"]);
      expect(state.outcomes.find(({ branches }) => branches).disposition).toBe("transport-settled");
      expect(first.arrivals).toHaveLength(1);
      expect(second.arrivals).toHaveLength(1);
    } catch (error) { cause = error; throw error; }
    finally {
      clearTimeout(arrivalTimer);
      try { await closeConversionResources({ adapter, chamber, receiver: first, cause }); }
      finally { await closeConversionResources({ receiver: second, cause }); }
    }
  }, 8000);
});

describe("consent command worker correlation", () => {
  function fakeChamber() {
    let listener;
    return {
      sent: [],
      postMessage(message) {
        this.sent.push(message);
        if (message.type === "init") queueMicrotask(() => listener?.({ type: "phase", name: "configured" }));
      },
      onMessage(callback) { listener = callback; return () => { listener = undefined; }; },
      onError() { return () => {}; },
      emit(message) { listener?.(message); },
      dispose() {},
    };
  }
  const endpoint = "http://127.0.0.1:41234/pagead/conversion/0000000000/";

  it("does not trust a worker claiming settlement after a non-storage denial", async () => {
    const chamber = fakeChamber();
    const fetchImpl = vi.fn(async () => new Response(null, { status: 204 }));
    const adapter = createGoogleAdsPrototype({
      endpoint, chamber, fetchImpl, captureContext: () => context, consent: { ad_storage: "granted" },
      experimentalConsentCommands: true,
    });
    try {
      adapter.gtag("consent", "update", { ad_storage: "granted", ad_user_data: "denied" });
      adapter.gtag("event", "conversion", conversion);
      await vi.waitFor(() => expect(chamber.sent.filter((item) => item.type === "event")).toHaveLength(1));
      chamber.emit({ type: "result", summary: { seq: 1, disposition: "consent-updated", requests: 0 }, ready: [] });
      await vi.waitFor(() => expect(chamber.sent.filter((item) => item.type === "event")).toHaveLength(2));
      chamber.emit({ type: "intercepted-fetch", id: 1, method: "GET", url: `${endpoint}?label=SYNTHETIC_LABEL` });
      await vi.waitFor(() => expect(chamber.sent.some((item) => item.type === "intercepted-fetch-response" && item.status === 0)).toBe(true));
      expect(fetchImpl).not.toHaveBeenCalled();
      chamber.emit({ type: "result", summary: { seq: 2, disposition: "transport-settled", requests: 1, status: 204 }, ready: [] });
      expect(await adapter.flush()).toMatchObject({ phase: "terminal", terminalReason: "result-transport-mismatch", host: { consentHeld: 1 } });
    } finally { await adapter.dispose(); }
  });

  it.each(["false-rejection", "wrong-command", "contradictory-ack", "dispatch-during-consent"])("fails closed on %s", async (scenario) => {
    const chamber = fakeChamber();
    const fetchImpl = vi.fn(async () => new Response(null, { status: 204 }));
    const adapter = createGoogleAdsPrototype({
      endpoint, chamber, fetchImpl, captureContext: () => context, consent: { ad_storage: "granted" },
      experimentalConsentCommands: true,
    });
    try {
      if (scenario === "wrong-command") adapter.gtag("config", "AW-0000000000");
      else adapter.gtag("consent", "update", { ad_storage: "denied" });
      adapter.gtag("event", "conversion", conversion);
      await vi.waitFor(() => expect(chamber.sent.some((item) => item.type === "event")).toBe(true));
      if (scenario === "dispatch-during-consent") {
        chamber.emit({ type: "intercepted-fetch", id: 1, method: "GET", url: `${endpoint}?label=SYNTHETIC_LABEL` });
      } else {
        chamber.emit({ type: "result", summary: {
          seq: 1, disposition: ["wrong-command", "contradictory-ack"].includes(scenario) ? "consent-updated" : "rejected",
          requests: 0, ...(scenario === "contradictory-ack" ? { reason: "contradiction" } : {}),
        }, ready: [] });
      }
      const state = await adapter.flush();
      expect(state.phase).toBe("terminal");
      expect(state.terminalReason).toBe(scenario === "dispatch-during-consent" ? "request-correlation-failed" : "result-transport-mismatch");
      expect(state.outcomes.at(-1).disposition).toBe("rejected");
      expect(state.outcomes).toHaveLength(2);
      expect(fetchImpl).not.toHaveBeenCalled();
    } finally { await adapter.dispose(); }
  });
});
