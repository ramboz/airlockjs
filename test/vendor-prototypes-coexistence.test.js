import { describe, expect, it } from "vitest";
import { createGoogleAdsPrototype } from "../adapters/google-ads-prototype.js";
import { createMetaPixelPrototype } from "../adapters/meta-pixel-prototype.js";
import { createMetaPixelBootstrapPrototype } from "../adapters/meta-pixel-bootstrap-prototype.js";
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
  it("keeps local purchase cart and Meta custom data in their own workers", async () => {
    let googleReceiver, googleChamber, google, metaReceiver, metaChamber, meta, cause;
    try {
      googleReceiver = await createConversionReceiver();
      metaReceiver = await createPrototypeReceiver();
      googleChamber = createNodeConversionChamber();
      metaChamber = createNodePrototypeChamber();
      google = createGoogleAdsPrototype({
        endpoint: googleReceiver.endpoint, chamber: googleChamber,
        experimentalPurchase: true, experimentalPurchaseCart: true, experimentalPurchaseDiscount: true, experimentalPurchaseFeed: true,
        experimentalCustomVariables: true,
        experimentalRetailViewItem: true,
        experimentalEducationViewItem: true,
        experimentalLocalViewItem: true,
        experimentalRealEstateViewItem: true,
        experimentalTravelViewItem: true,
        consent: { ad_storage: "denied" }, captureContext: () => ({ pageURL, referrer: "" }),
      });
      meta = createMetaPixelPrototype({
        endpoint: metaReceiver.endpoint, chamber: metaChamber,
        experimentalPageViewData: true, experimentalCustomProperties: true, experimentalNumericOrderId: true,
        experimentalEvents: true, experimentalEventIds: true, experimentalContentIds: true,
        experimentalContents: true, experimentalContentsItemPrice: true,
        experimentalScalarEventData: true, experimentalContentNameArray: true,
        experimentalSetAgent: true, experimentalInitAgent: true,
        experimentalNullPurchaseValue: true,
        experimentalViewContentJsonStrings: true,
        consent: { ad_storage: "granted" },
        captureContext: () => ({
          pageURL, referrer: "", inFrame: false, screenWidth: 412, screenHeight: 823, timezoneOffset: 0,
        }),
      });
      google.gtag("config", "AW-0000000000");
      const initOptions = { agent: "adobe_commerce-0.0.0-4.5.6" };
      meta.fbq("init", "000000000000000", {}, initOptions);
      initOptions.agent = "magento_opensource-0.0.0-9.9.9";
      google.gtag("event", "purchase", {
        ...conversion, new_customer: true, items: [{ id: "held-sku", price: 4, quantity: 1 }], discount: 1,
      });
      meta.fbq("trackCustom", "Purchase", { placement: "synthetic", order_id: 1 }, { eventID: "first" });
      let states = await Promise.all([google.flush(), meta.flush()]);
      expect(states.map((state) => state.outcomes.at(-1).disposition)).toEqual(["held", "transport-settled"]);
      expect([googleReceiver.arrivals.length, metaReceiver.arrivals.length]).toEqual([0, 1]);
      const firstMetaQuery = new URL(metaReceiver.arrivals[0].url).searchParams;
      expect(firstMetaQuery.getAll("a")).toEqual(["adobe_commerce-0.0.0-4.5.6"]);
      expect(firstMetaQuery.has("airlock_items")).toBe(false);

      google.setConsent({ ad_storage: "granted" });
      meta.fbq("set", "agent", "magento_opensource-0.0.0-1.2.3", "000000000000000");
      await Promise.all([google.flush(), meta.flush()]);
      expect([googleReceiver.arrivals.length, metaReceiver.arrivals.length]).toEqual([0, 1]);
      const items = [{ id: "local-sku", price: 5, quantity: 2 }];
      google.gtag("event", "purchase", {
        ...conversion, new_customer: false, items, discount: 2,
        aw_merchant_id: 98765, aw_feed_country: "US", aw_feed_language: "en",
      });
      items[0].id = "changed";
      const contentNames = ["meta-product"];
      meta.fbq("trackCustom", "Purchase", {
        placement: "second", order_id: 2, content_name: contentNames, value: null,
        contents: [{ id: "meta-sku", quantity: 1, item_price: 7 }],
      }, { eventID: "second-event" });
      contentNames[0] = "changed";
      states = await Promise.all([google.flush(), meta.flush()]);
      expect(states.map((state) => state.outcomes.at(-1).disposition))
        .toEqual(["transport-settled", "transport-settled"]);
      expect([googleReceiver.arrivals.length, metaReceiver.arrivals.length]).toEqual([1, 2]);
      const googleQuery = new URL(googleReceiver.arrivals[0].url).searchParams;
      const metaQuery = new URL(metaReceiver.arrivals[1].url).searchParams;
      expect(googleQuery.get("airlock_new_customer")).toBe("false");
      expect(googleQuery.get("airlock_discount")).toBe("2");
      expect(googleQuery.get("airlock_merchant_id")).toBe("98765");
      expect(googleQuery.get("airlock_feed_country")).toBe("US");
      expect(googleQuery.get("airlock_feed_language")).toBe("en");
      expect(JSON.parse(googleQuery.get("airlock_items"))).toEqual([{ id: "local-sku", price: 5, quantity: 2 }]);
      expect(googleQuery.has("cd[placement]")).toBe(false);
      expect(googleQuery.has("cd[order_id]")).toBe(false);
      expect(googleQuery.has("cd[contents]")).toBe(false);
      expect(googleQuery.has("cd[content_name]")).toBe(false);
      expect(googleQuery.has("cd[value]")).toBe(false);
      expect(googleQuery.has("eid")).toBe(false);
      expect(googleQuery.has("a")).toBe(false);
      expect(metaQuery.get("ev")).toBe("Purchase");
      expect(metaQuery.get("eid")).toBe("second-event");
      expect(metaQuery.get("a")).toBe("magento_opensource-0.0.0-1.2.3");
      expect(metaQuery.get("cd[placement]")).toBe("second");
      expect(metaQuery.get("cd[order_id]")).toBe("2");
      expect(metaQuery.getAll("cd[value]")).toEqual(["null"]);
      expect(JSON.parse(metaQuery.get("cd[content_name]"))).toEqual(["meta-product"]);
      expect(JSON.parse(metaQuery.get("cd[contents]"))).toEqual([{ id: "meta-sku", quantity: 1, item_price: 7 }]);
      expect(metaQuery.has("airlock_new_customer")).toBe(false);
      expect(metaQuery.has("airlock_items")).toBe(false);
      expect(metaQuery.has("airlock_discount")).toBe(false);
      expect(metaQuery.has("airlock_merchant_id")).toBe(false);
      expect(metaQuery.has("airlock_feed_country")).toBe(false);
      expect(metaQuery.has("airlock_feed_language")).toBe(false);

      const custom = { ...conversion, color: "synthetic-blue", product_name: "google-product" };
      google.gtag("event", "conversion", custom);
      custom.product_name = "changed";
      states = await Promise.all([google.flush(), meta.flush()]);
      expect(states[0].outcomes.at(-1).disposition).toBe("transport-settled");
      expect([googleReceiver.arrivals.length, metaReceiver.arrivals.length]).toEqual([2, 2]);
      const customQuery = new URL(googleReceiver.arrivals[1].url).searchParams;
      expect(customQuery.get("airlock_custom_color")).toBe("synthetic-blue");
      expect(customQuery.get("airlock_custom_product_name")).toBe("google-product");
      expect(customQuery.has("cd[content_name]")).toBe(false);
      expect(customQuery.has("a")).toBe(false);
      expect(metaQuery.has("airlock_custom_color")).toBe(false);
      expect(metaQuery.has("airlock_custom_product_name")).toBe(false);

      const retailItems = [{ id: 1234, google_business_vertical: "retail" }];
      google.gtag("event", "view_item", { value: 99, items: retailItems });
      retailItems[0].id = 5678;
      states = await Promise.all([google.flush(), meta.flush()]);
      expect(states[0].outcomes.at(-1).disposition).toBe("transport-settled");
      expect([googleReceiver.arrivals.length, metaReceiver.arrivals.length]).toEqual([3, 2]);
      const retailQuery = new URL(googleReceiver.arrivals[2].url).searchParams;
      expect(retailQuery.get("airlock_event")).toBe("view_item");
      expect(JSON.parse(retailQuery.get("airlock_items"))).toEqual([{ id: 1234, google_business_vertical: "retail" }]);
      expect(retailQuery.get("airlock_value")).toBe("99");
      expect(retailQuery.has("label")).toBe(false);
      expect(retailQuery.has("cd[content_name]")).toBe(false);
      expect(metaQuery.has("airlock_event")).toBe(false);
      expect(metaQuery.has("airlock_value")).toBe(false);

      const metaView = { content_ids: '[ "meta-view" ]', contents: '[{"id":"meta-view","quantity":1}]' };
      meta.fbq("track", "ViewContent", metaView);
      metaView.content_ids = '["changed"]';
      states = await Promise.all([google.flush(), meta.flush()]);
      expect(states[1].outcomes.at(-1).disposition).toBe("transport-settled");
      expect([googleReceiver.arrivals.length, metaReceiver.arrivals.length]).toEqual([3, 3]);
      const viewQuery = new URL(metaReceiver.arrivals[2].url).searchParams;
      expect(viewQuery.get("cd[content_ids]")).toBe('[ "meta-view" ]');
      expect(viewQuery.get("cd[contents]")).toBe('[{"id":"meta-view","quantity":1}]');
      expect(viewQuery.has("airlock_event")).toBe(false);
      expect(retailQuery.has("cd[content_ids]")).toBe(false);

      const educationItems = [{ id: "COURSE1", location_id: "PLACE1", google_business_vertical: "education" }];
      google.gtag("event", "view_item", { value: undefined, items: educationItems });
      educationItems[0].location_id = "changed";
      states = await Promise.all([google.flush(), meta.flush()]);
      expect(states[0].outcomes.at(-1).disposition).toBe("transport-settled");
      expect([googleReceiver.arrivals.length, metaReceiver.arrivals.length]).toEqual([4, 3]);
      const educationQuery = new URL(googleReceiver.arrivals[3].url).searchParams;
      expect(JSON.parse(educationQuery.get("airlock_items"))).toEqual([
        { id: "COURSE1", google_business_vertical: "education", location_id: "PLACE1" },
      ]);
      expect(educationQuery.has("airlock_value")).toBe(false);
      expect(educationQuery.has("label")).toBe(false);
      expect(educationQuery.has("cd[content_ids]")).toBe(false);
      expect(viewQuery.has("airlock_items")).toBe(false);

      for (const [id, vertical] of [["DEAL1", "local"], ["HOME1", "real_estate"]]) {
        google.gtag("event", "view_item", { value: 30, items: [{ id, google_business_vertical: vertical }] });
      }
      meta.fbq("track", "AddToCart", {
        content_name: "meta-cart", content_ids: ["meta-cart"],
        contents: [{ id: "meta-cart", quantity: 1 }],
      });
      states = await Promise.all([google.flush(), meta.flush()]);
      expect(states.map((state) => state.outcomes.at(-1).disposition))
        .toEqual(["transport-settled", "transport-settled"]);
      expect([googleReceiver.arrivals.length, metaReceiver.arrivals.length]).toEqual([6, 4]);
      for (const [index, id, vertical] of [[4, "DEAL1", "local"], [5, "HOME1", "real_estate"]]) {
        const query = new URL(googleReceiver.arrivals[index].url).searchParams;
        expect(JSON.parse(query.get("airlock_items"))).toEqual([{ id, google_business_vertical: vertical }]);
        expect(query.has("cd[content_ids]")).toBe(false);
      }
      const cartQuery = new URL(metaReceiver.arrivals[3].url).searchParams;
      expect(cartQuery.get("ev")).toBe("AddToCart");
      expect(JSON.parse(cartQuery.get("cd[content_ids]"))).toEqual(["meta-cart"]);
      expect(cartQuery.has("airlock_items")).toBe(false);

      const itinerary = { origin: "ORIGIN1", destination: "DEST1", start_date: "2030-01-02", google_business_vertical: "travel" };
      google.gtag("event", "view_item", { value: 40, items: [itinerary] });
      itinerary.destination = "changed";
      states = await Promise.all([google.flush(), meta.flush()]);
      expect(states[0].outcomes.at(-1).disposition).toBe("transport-settled");
      expect([googleReceiver.arrivals.length, metaReceiver.arrivals.length]).toEqual([7, 4]);
      const travelUrl = new URL(googleReceiver.arrivals[6].url);
      expect(travelUrl.origin).toBe(new URL(googleReceiver.endpoint).origin);
      expect(JSON.parse(travelUrl.searchParams.get("airlock_items"))).toEqual([{
        destination: "DEST1", google_business_vertical: "travel", origin: "ORIGIN1", start_date: "2030-01-02",
      }]);
      expect(travelUrl.searchParams.has("cd[content_ids]")).toBe(false);
      expect(cartQuery.has("airlock_items")).toBe(false);

      google.setConsent({ ad_storage: "denied" });
      google.gtag("event", "view_item", {
        value: 41, items: [{ destination: "HELD1", google_business_vertical: "travel" }],
      });
      meta.fbq("track", "ViewContent", { content_ids: ["meta-still-live"] });
      states = await Promise.all([google.flush(), meta.flush()]);
      expect(states.map((state) => state.outcomes.at(-1).disposition)).toEqual(["held", "transport-settled"]);
      expect([googleReceiver.arrivals.length, metaReceiver.arrivals.length]).toEqual([7, 5]);
      expect(JSON.parse(new URL(metaReceiver.arrivals[4].url).searchParams.get("cd[content_ids]")))
        .toEqual(["meta-still-live"]);

      google.setConsent({ ad_storage: "granted" });
      await Promise.all([google.flush(), meta.flush()]);
      expect([googleReceiver.arrivals.length, metaReceiver.arrivals.length]).toEqual([7, 5]);
      meta.setConsent({ ad_storage: "denied" });
      google.gtag("event", "view_item", {
        value: 42, items: [{ destination: "NEXT1", google_business_vertical: "travel" }],
      });
      meta.fbq("track", "ViewContent", { content_ids: ["meta-held"] });
      states = await Promise.all([google.flush(), meta.flush()]);
      expect(states.map((state) => state.outcomes.at(-1).disposition)).toEqual(["transport-settled", "held"]);
      expect([googleReceiver.arrivals.length, metaReceiver.arrivals.length]).toEqual([8, 5]);
      expect(JSON.parse(new URL(googleReceiver.arrivals[7].url).searchParams.get("airlock_items")))
        .toEqual([{ destination: "NEXT1", google_business_vertical: "travel" }]);
      meta.setConsent({ ad_storage: "granted" });
      await Promise.all([google.flush(), meta.flush()]);
      expect([googleReceiver.arrivals.length, metaReceiver.arrivals.length]).toEqual([8, 5]);

      google.gtag("event", "view_item", {
        items: [{ destination: "NO-VALUE", google_business_vertical: "travel" }],
      });
      meta.fbq("track", "ViewContent", { content_ids: ["meta-after-grant"] });
      states = await Promise.all([google.flush(), meta.flush()]);
      expect(states.map((state) => state.outcomes.at(-1).disposition))
        .toEqual(["transport-settled", "transport-settled"]);
      expect([googleReceiver.arrivals.length, metaReceiver.arrivals.length]).toEqual([9, 6]);
      const noValueQuery = new URL(googleReceiver.arrivals[8].url).searchParams;
      expect(noValueQuery.has("airlock_value")).toBe(false);
      expect(JSON.parse(noValueQuery.get("airlock_items")))
        .toEqual([{ destination: "NO-VALUE", google_business_vertical: "travel" }]);
      const metaAfterGrant = new URL(metaReceiver.arrivals[5].url).searchParams;
      expect(JSON.parse(metaAfterGrant.get("cd[content_ids]"))).toEqual(["meta-after-grant"]);
      expect(metaAfterGrant.has("airlock_items")).toBe(false);
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

  it("drains both bootstrap shapes, including startup appends, without duplicate sends", async () => {
    let googleReceiver, googleChamber, google, metaReceiver, metaChamber, meta, cause;
    try {
      googleReceiver = await createConversionReceiver();
      metaReceiver = await createPrototypeReceiver();
      googleChamber = createNodeConversionChamber();
      metaChamber = createNodePrototypeChamber();
      const dataLayer = [];
      function gtag() { dataLayer.push(arguments); }
      function fbq() {
        fbq.callMethod ? fbq.callMethod.apply(fbq, arguments) : fbq.queue.push(arguments);
      }
      fbq.queue = [];
      gtag("config", "AW-0000000000");
      gtag("event", "conversion", conversion);
      fbq("init", "000000000000000");
      fbq("track", "PageView");

      google = createGoogleAdsPrototype({
        endpoint: googleReceiver.endpoint, chamber: googleChamber, experimentalDataLayer: true,
        consent: { ad_storage: "granted" }, captureContext: () => ({ pageURL, referrer: "" }),
      });
      const metaAttachment = createMetaPixelBootstrapPrototype({
        bootstrap: fbq, endpoint: metaReceiver.endpoint, chamber: metaChamber,
        consent: { ad_storage: "granted" },
        captureContext: () => ({
          pageURL, referrer: "", inFrame: false, screenWidth: 412, screenHeight: 823, timezoneOffset: 0,
        }),
      });
      gtag("event", "conversion", conversion);
      fbq("track", "PageView");
      meta = await metaAttachment;
      google.drainDataLayer(dataLayer);
      let states = await Promise.all([google.flush(), meta.flush()]);
      expect(states.map((state) => state.outcomes.map((item) => item.disposition))).toEqual([
        ["configured", "transport-settled", "transport-settled"],
        ["initialized", "transport-settled", "transport-settled"],
      ]);
      expect([googleReceiver.arrivals.length, metaReceiver.arrivals.length]).toEqual([2, 2]);

      gtag("event", "conversion", conversion);
      fbq("track", "PageView");
      google.drainDataLayer(dataLayer);
      google.drainDataLayer(dataLayer);
      states = await Promise.all([google.flush(), meta.flush()]);
      expect(states.map((state) => state.outcomes.at(-1).disposition))
        .toEqual(["transport-settled", "transport-settled"]);
      expect([googleReceiver.arrivals.length, metaReceiver.arrivals.length]).toEqual([3, 3]);
      expect(new URL(googleReceiver.arrivals[2].url).searchParams.get("oid")).toBe(conversion.transaction_id);
      expect(new URL(metaReceiver.arrivals[2].url).searchParams.get("ev")).toBe("PageView");
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
