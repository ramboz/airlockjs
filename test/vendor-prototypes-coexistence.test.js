import { describe, expect, it } from "vitest";
import { createGoogleAdsPrototype } from "../adapters/google-ads-prototype.js";
import { createMetaPixelPrototype } from "../adapters/meta-pixel-prototype.js";
import {
  closeConversionResources, createConversionReceiver, createNodeConversionChamber,
} from "../rig/google-ads-conversion-prototype.mjs";
import {
  closePrototypeResources, createNodePrototypeChamber, createPrototypeReceiver,
} from "../rig/meta-pageview-prototype.mjs";

const pageURL = "https://example.test/vendor-coexistence";
const conversion = {
  send_to: "AW-0000000000/SYNTHETIC_LABEL",
  value: 12.5,
  currency: "USD",
  transaction_id: "synthetic-coexistence",
};

describe("experimental vendor coexistence on independent local workers", () => {
  it("isolates routing, per-adapter consent, holds and disposal", async () => {
    let googleReceiver, googleChamber, google, metaReceiver, metaChamber, meta, cause;
    try {
      googleReceiver = await createConversionReceiver();
      metaReceiver = await createPrototypeReceiver();
      googleChamber = createNodeConversionChamber();
      metaChamber = createNodePrototypeChamber();
      google = createGoogleAdsPrototype({
        endpoint: googleReceiver.endpoint, chamber: googleChamber,
        consent: { ad_storage: "granted" },
        captureContext: () => ({ pageURL, referrer: "" }),
      });
      meta = createMetaPixelPrototype({
        endpoint: metaReceiver.endpoint, chamber: metaChamber,
        consent: { ad_storage: "granted" },
        captureContext: () => ({
          pageURL, referrer: "", inFrame: false, screenWidth: 412, screenHeight: 823, timezoneOffset: 0,
        }),
      });

      const [googleProbe, metaProbe] = await Promise.all([googleChamber.probe, metaChamber.probe]);
      expect(googleProbe).toMatchObject({ ambientFetchDenied: true });
      expect(metaProbe).toMatchObject({ ambientFetchDenied: true });
      expect(googleProbe.threadId).toBeGreaterThan(0);
      expect(metaProbe.threadId).toBeGreaterThan(0);
      expect(googleProbe.threadId).not.toBe(metaProbe.threadId);

      google.gtag("config", "AW-0000000000");
      meta.fbq("init", "000000000000000");
      const sendBoth = async () => {
        google.gtag("event", "conversion", conversion);
        meta.fbq("track", "PageView");
        return Promise.all([google.flush(), meta.flush()]);
      };
      let states = await sendBoth();
      expect(states.map((state) => state.outcomes.at(-1).disposition))
        .toEqual(["transport-settled", "transport-settled"]);
      expect([googleReceiver.arrivals.length, metaReceiver.arrivals.length]).toEqual([1, 1]);

      google.setConsent({ ad_storage: "denied" });
      states = await sendBoth();
      expect(states.map((state) => state.outcomes.at(-1).disposition)).toEqual(["held", "transport-settled"]);
      expect([googleReceiver.arrivals.length, metaReceiver.arrivals.length]).toEqual([1, 2]);

      google.setConsent({ ad_storage: "granted" });
      meta.setConsent({ ad_storage: "denied" });
      states = await sendBoth();
      expect(states.map((state) => state.outcomes.at(-1).disposition)).toEqual(["transport-settled", "held"]);
      expect([googleReceiver.arrivals.length, metaReceiver.arrivals.length]).toEqual([2, 2]);

      meta.setConsent({ ad_storage: "granted" });
      await Promise.all([google.flush(), meta.flush()]);
      expect([googleReceiver.arrivals.length, metaReceiver.arrivals.length]).toEqual([2, 2]);
      states = await sendBoth();
      expect(states.map((state) => state.outcomes.at(-1).disposition))
        .toEqual(["transport-settled", "transport-settled"]);
      expect([googleReceiver.arrivals.length, metaReceiver.arrivals.length]).toEqual([3, 3]);
      expect(states.map((state) => state.host.consentHeld)).toEqual([1, 1]);

      for (const { method, url } of googleReceiver.arrivals) {
        const request = new URL(url);
        expect(method).toBe("GET");
        expect(request.pathname).toBe("/pagead/conversion/0000000000/");
        expect(request.searchParams.get("oid")).toBe(conversion.transaction_id);
        expect(request.searchParams.has("ev")).toBe(false);
      }
      for (const { method, url } of metaReceiver.arrivals) {
        const request = new URL(url);
        expect(method).toBe("GET");
        expect(request.pathname).toBe("/tr/");
        expect(request.searchParams.get("id")).toBe("000000000000000");
        expect(request.searchParams.get("ev")).toBe("PageView");
        expect(request.searchParams.has("oid")).toBe(false);
      }

      await google.dispose();
      expect(googleChamber.getState().closed).toBe(true);
      google.gtag("event", "conversion", conversion);
      meta.fbq("track", "PageView");
      const [stoppedGoogle, liveMeta] = await Promise.all([google.flush(), meta.flush()]);
      expect(stoppedGoogle.outcomes.at(-1)).toMatchObject({ disposition: "rejected", reason: "disposed" });
      expect(liveMeta.outcomes.at(-1).disposition).toBe("transport-settled");
      expect([googleReceiver.arrivals.length, metaReceiver.arrivals.length]).toEqual([3, 4]);
    } catch (error) {
      cause = error;
      throw error;
    } finally {
      const cleanup = await Promise.allSettled([
        closeConversionResources({ adapter: google, chamber: googleChamber, receiver: googleReceiver, cause }),
        closePrototypeResources({ adapter: meta, chamber: metaChamber, receiver: metaReceiver, cause }),
      ]);
      expect(cleanup.map((result) => result.status)).toEqual(["fulfilled", "fulfilled"]);
      if (googleChamber) expect(googleChamber.getState().closed).toBe(true);
      if (metaChamber) expect(metaChamber.getState().closed).toBe(true);
      if (googleReceiver) expect(googleReceiver.getState()).toEqual({ listening: false, openSockets: 0 });
      if (metaReceiver) expect(metaReceiver.getState()).toEqual({ listening: false, openSockets: 0 });
    }
  }, 10000);
});
