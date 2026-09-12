// Google Ads (AW) page-load connector — spec 044-01 (ADR-0019 gtag-family model).
// `createGoogleAdsConnector` is a NEW module reproducing the reference site's AW page-load
// remarketing/conversion-linker beacon off-thread as a governed GET, granted-consent, carrying
// Consent Mode v2 (gcs/gcd via the REUSED spec-039 encoders, now homed in connectors/consent-mode.js)
// + npa + the host-sourced first-party linker id (_gcl_au -> auid) + inbound click ids
// (gclid/wbraid/gbraid), forwarding each read-when-present / omit-when-absent — NEVER minted (A5).
//
// AC1: connector emits the ccm/collect AW beacon as a length-1 EgressRequest[] { url, method:GET },
//      no api_secret (auth = tid/AW-id + origin, ADR-0019).
// AC2: gcs/gcd carried via the REUSED 039 encoders (connectors/consent-mode.js — extracted, not
//      re-authored) + npa; byte-equal to the captured granted-state carriage (G111/13r3r3r3r5l1/0).
// AC3: auid (from _gcl_au) + click ids read-when-present / omit-when-absent / NEVER minted;
//      the _gcl_au READ is ad_storage-gated (mirrors sourceGa4Ctx's storage gate).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

import {
  createGoogleAdsConnector,
  encodeNpa,
  GOOGLE_ADS_CCM_COLLECT_ENDPOINT,
} from "../connectors/google-ads/connector.js";
import {
  parseGclAuId,
  readClickIds,
  sourceGoogleAdsCtx,
} from "../connectors/google-ads/cookies.js";
import { encodeGcs, encodeGcd } from "../connectors/consent-mode.js";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));

const CONVERSION_ID = "AW-1234567890";
const GRANTED = {
  ad_storage: "granted",
  analytics_storage: "granted",
  ad_user_data: "granted",
  ad_personalization: "granted",
};

/** Build the beacon for a granted page_view with the given ctx overrides, return its parsed query. */
function beaconParams(ctx = {}) {
  const connector = createGoogleAdsConnector({
    conversionId: CONVERSION_ID,
    ctx: { consent: GRANTED, ...ctx },
  });
  const [{ url }] = connector.handle({
    type: "page_view",
    params: { page_location: "https://spike.example/pricing", page_title: "Pricing" },
  });
  return new URL(url).searchParams;
}

describe("createGoogleAdsConnector — AC1 ccm/collect AW page-load beacon", () => {
  it("handle() returns a length-1 EgressRequest[] carrying { url, method:'GET' } to ccm/collect with tid=AW-id/en/dl/dt", () => {
    const connector = createGoogleAdsConnector({ conversionId: CONVERSION_ID, ctx: { consent: GRANTED } });
    const requests = connector.handle({
      type: "page_view",
      params: { page_location: "https://spike.example/pricing", page_title: "Pricing" },
    });

    expect(Array.isArray(requests)).toBe(true);
    expect(requests).toHaveLength(1);
    const [result] = requests;
    expect(result.method).toBe("GET");
    expect(result.body).toBeUndefined();

    const url = new URL(result.url);
    expect(url.origin + url.pathname).toBe(GOOGLE_ADS_CCM_COLLECT_ENDPOINT);
    expect(url.searchParams.get("tid")).toBe(CONVERSION_ID);
    expect(url.searchParams.get("en")).toBe("page_view");
    expect(url.searchParams.get("dl")).toBe("https://spike.example/pricing");
    expect(url.searchParams.get("dt")).toBe("Pricing");
  });

  it("bridges event.payload the same as event.params (contract-shaped AirlockEvent form)", () => {
    const connector = createGoogleAdsConnector({ conversionId: CONVERSION_ID, ctx: { consent: GRANTED } });
    const [{ url }] = connector.handle({ type: "page_view", payload: { page_title: "Via payload" } });
    expect(new URL(url).searchParams.get("dt")).toBe("Via payload");
  });

  it("no api_secret / no *secret* query key anywhere — auth is tid + origin (ADR-0019 adoption fix)", () => {
    const params = beaconParams();
    expect(params.has("api_secret")).toBe(false);
    for (const key of params.keys()) expect(key.toLowerCase()).not.toContain("secret");
  });

  it("the endpoint origin is the public www.google.com collect host — no credential in the URL", () => {
    const [{ url }] = createGoogleAdsConnector({ conversionId: CONVERSION_ID, ctx: { consent: GRANTED } }).handle({
      type: "page_view",
      params: {},
    });
    expect(new URL(url).origin).toBe("https://www.google.com");
  });

  it("an event this connector does not map (not page_view) replays to [] — the zero-or-one gate, never a partial beacon", () => {
    const connector = createGoogleAdsConnector({ conversionId: CONVERSION_ID, ctx: { consent: GRANTED } });
    expect(connector.handle({ type: "add_to_cart", params: {} })).toEqual([]);
  });

  it("manifest declares egress under ad_storage so the seal CAN gate it (044-02), and the _gcl_au cookie capability", () => {
    const { manifest } = createGoogleAdsConnector({ conversionId: CONVERSION_ID });
    expect(manifest.name).toBe("airlock/google-ads");
    expect(manifest.capabilities.egress).toBe(true);
    expect(manifest.capabilities.cookies).toContain("_gcl_au");
    expect(manifest.purposes.egress).toContain("ad_storage");
    expect(manifest.purposes.cookies._gcl_au).toContain("ad_storage");
    expect(manifest.endpoints).toContain(GOOGLE_ADS_CCM_COLLECT_ENDPOINT);
  });
});

describe("createGoogleAdsConnector — AC2 Consent Mode v2 carriage via the REUSED 039 encoders + npa", () => {
  it("granted-all vector encodes gcs=G111, gcd=13r3r3r3r5l1, npa=0 (byte-equal to the captured granted-state carriage, R-009 §(b))", () => {
    const params = beaconParams();
    expect(params.get("gcs")).toBe("G111");
    expect(params.get("gcd")).toBe("13r3r3r3r5l1");
    expect(params.get("npa")).toBe("0");
  });

  it("gcs/gcd on the beacon are byte-identical to connectors/consent-mode.js's encoders — REUSED, not re-authored (AC2 / extract-on-third-caller convention)", () => {
    const params = beaconParams();
    expect(params.get("gcs")).toBe(encodeGcs(GRANTED));
    expect(params.get("gcd")).toBe(encodeGcd(GRANTED));
  });

  it("encodeNpa: both ad_user_data + ad_personalization granted -> '0'; otherwise -> '1'", () => {
    expect(encodeNpa(GRANTED)).toBe("0");
    expect(encodeNpa({ ...GRANTED, ad_personalization: "denied" })).toBe("1");
    expect(encodeNpa({ ...GRANTED, ad_user_data: "denied" })).toBe("1");
  });

  it("a pending consent vector omits gcs/gcd entirely (039's joint-string discipline, inherited via the shared encoder)", () => {
    const connector = createGoogleAdsConnector({ conversionId: CONVERSION_ID, ctx: {} }); // no consent signal
    const [{ url }] = connector.handle({ type: "page_view", params: {} });
    expect(new URL(url).searchParams.get("gcs")).toBeNull();
    expect(new URL(url).searchParams.get("gcd")).toBeNull();
    expect(url).not.toContain("gcs=");
    expect(url).not.toContain("gcd=");
  });

  it("the encoders share ONE home: both connectors/google-ads/connector.js and connectors/ga4/gtag.js import them from connectors/consent-mode.js (extracted, not duplicated)", () => {
    const awSrc = readFileSync(join(repoRoot, "connectors/google-ads/connector.js"), "utf8");
    const gtagSrc = readFileSync(join(repoRoot, "connectors/ga4/gtag.js"), "utf8");
    expect(awSrc).toMatch(/from ["']\.\.\/consent-mode\.js["']/);
    expect(gtagSrc).toMatch(/from ["']\.\.\/consent-mode\.js["']/);
    // the extraction moved the definitions OUT of gtag.js — it no longer re-declares them.
    expect(gtagSrc).not.toMatch(/function encodeGcs\b/);
    expect(gtagSrc).not.toMatch(/function encodeGcd\b/);
  });
});

describe("connectors/google-ads/cookies.js — AC3 _gcl_au -> auid, read-when-present / NEVER minted", () => {
  it("parseGclAuId extracts the last two dotted segments <random>.<seconds> (auid), tolerant of the 1.1. prefix", () => {
    expect(parseGclAuId("1.1.9988776655.1610000000")).toBe("9988776655.1610000000");
    expect(parseGclAuId("GCL.1610000000.9988776655")).toBe("1610000000.9988776655"); // last-two-segments rule
  });

  it("parseGclAuId returns null on any malformed/absent shape (never throws, never guesses)", () => {
    expect(parseGclAuId(undefined)).toBeNull();
    expect(parseGclAuId("")).toBeNull();
    expect(parseGclAuId("notanumber")).toBeNull();
    expect(parseGclAuId("1.1.abc.def")).toBeNull();
  });

  it("sourceGoogleAdsCtx reads _gcl_au from the cookie string -> ctx.auid when present", () => {
    const ctx = sourceGoogleAdsCtx({ cookieString: "foo=bar; _gcl_au=1.1.9988776655.1610000000; x=y" });
    expect(ctx.auid).toBe("9988776655.1610000000");
  });

  it("sourceGoogleAdsCtx OMITS auid when _gcl_au is absent — airlock does NOT mint a _gcl_au (A5)", () => {
    const ctx = sourceGoogleAdsCtx({ cookieString: "foo=bar; other=1" });
    expect("auid" in ctx).toBe(false);
  });

  it("the _gcl_au READ is ad_storage-gated: adStorageGranted:false skips the read entirely — no auid even when the cookie exists (mirrors sourceGa4Ctx's leak-prevention gate)", () => {
    const ctx = sourceGoogleAdsCtx({
      cookieString: "_gcl_au=1.1.9988776655.1610000000",
      adStorageGranted: false,
    });
    expect("auid" in ctx).toBe(false);
  });

  it("readClickIds forwards gclid/wbraid/gbraid present in the landing URL, omits those absent", () => {
    expect(readClickIds("https://x.test/?gclid=ABC123&foo=1")).toEqual({ gclid: "ABC123" });
    expect(readClickIds("https://x.test/?wbraid=WB1&gbraid=GB2")).toEqual({ wbraid: "WB1", gbraid: "GB2" });
    expect(readClickIds("https://x.test/?utm_source=news")).toEqual({}); // a direct load carries none (R-009 §(c))
    expect(readClickIds("")).toEqual({});
  });

  it("sourceGoogleAdsCtx merges the auid read + the landing-URL click ids", () => {
    const ctx = sourceGoogleAdsCtx({
      cookieString: "_gcl_au=1.1.9988776655.1610000000",
      landingUrl: "https://x.test/?gclid=ABC123",
    });
    expect(ctx).toEqual({ auid: "9988776655.1610000000", gclid: "ABC123" });
  });
});

describe("createGoogleAdsConnector — AC3 the beacon forwards auid + click ids present, omits absent, NEVER mints", () => {
  it("ctx.auid present -> auid forwarded on the beacon", () => {
    expect(beaconParams({ auid: "9988776655.1610000000" }).get("auid")).toBe("9988776655.1610000000");
  });

  it("ctx.auid absent -> auid OMITTED entirely (never minted — no auid= on the URL)", () => {
    const connector = createGoogleAdsConnector({ conversionId: CONVERSION_ID, ctx: { consent: GRANTED } });
    const [{ url }] = connector.handle({ type: "page_view", params: {} });
    expect(new URL(url).searchParams.has("auid")).toBe(false);
    expect(url).not.toContain("auid=");
  });

  it("inbound click ids present in ctx -> forwarded; absent -> omitted", () => {
    const present = beaconParams({ gclid: "ABC123", wbraid: "WB1", gbraid: "GB2" });
    expect(present.get("gclid")).toBe("ABC123");
    expect(present.get("wbraid")).toBe("WB1");
    expect(present.get("gbraid")).toBe("GB2");

    const absent = beaconParams();
    expect(absent.has("gclid")).toBe(false);
    expect(absent.has("wbraid")).toBe(false);
    expect(absent.has("gbraid")).toBe(false);
  });
});
