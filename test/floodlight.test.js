// Floodlight (DC) page-load connector — spec 046-01 (ADR-0019 gtag-family model, mirroring 044).
// `createFloodlightConnector` is a near-verbatim mirror of `createGoogleAdsConnector`: it reproduces
// the DC ccm/collect page-load beacon off-thread as a governed GET, granted-consent, carrying
// Consent Mode v2 (gcs/gcd/npa via the REUSED connectors/consent-mode.js encoders) + the
// host-sourced first-party linker id (_gcl_au -> auid, REUSED from connectors/google-ads/cookies.js
// verbatim — spec 046 §A4: auid==auiddc==_gcl_au-derived), read-when-present / omit-when-absent —
// NEVER minted (§A5).
//
// AC1: connector emits the ccm/collect DC beacon as a length-1 EgressRequest[] { url, method:GET },
//      no secret; non-page_view -> [] (the zero-or-one gate).
// AC2: gcs/gcd/npa carried via the REUSED connectors/consent-mode.js encoders (this slice EXTRACTS
//      encodeNpa there out of connectors/google-ads/connector.js — Floodlight is its 2nd caller).
// AC3: auid (from _gcl_au) read-when-present / omit-when-absent / NEVER minted, via the REUSED
//      sourceGoogleAdsCtx (connectors/google-ads/cookies.js) — no separate floodlight cookies.js.
// AC5: manifest declares egress + the _gcl_au cookie capability under ad_storage.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

import {
  createFloodlightConnector,
  FLOODLIGHT_CCM_COLLECT_ENDPOINT,
} from "../connectors/floodlight/connector.js";
import { sourceGoogleAdsCtx } from "../connectors/google-ads/cookies.js";
import { encodeGcs, encodeGcd, encodeNpa } from "../connectors/consent-mode.js";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));

const CONVERSION_ID = "DC-1234567890";
const GRANTED = {
  ad_storage: "granted",
  analytics_storage: "granted",
  ad_user_data: "granted",
  ad_personalization: "granted",
};

/** Build the beacon for a granted page_view with the given ctx overrides, return its parsed query. */
function beaconParams(ctx = {}) {
  const connector = createFloodlightConnector({
    conversionId: CONVERSION_ID,
    ctx: { consent: GRANTED, ...ctx },
  });
  const [{ url }] = connector.handle({
    type: "page_view",
    params: { page_location: "https://spike.example/pricing", page_title: "Pricing" },
  });
  return new URL(url).searchParams;
}

describe("createFloodlightConnector — AC1 ccm/collect DC page-load beacon", () => {
  it("handle() returns a length-1 EgressRequest[] carrying { url, method:'GET' } to ccm/collect with tid=DC-id/en/dl/dt", () => {
    const connector = createFloodlightConnector({ conversionId: CONVERSION_ID, ctx: { consent: GRANTED } });
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
    expect(url.origin + url.pathname).toBe(FLOODLIGHT_CCM_COLLECT_ENDPOINT);
    expect(url.searchParams.get("tid")).toBe(CONVERSION_ID);
    expect(url.searchParams.get("en")).toBe("page_view");
    expect(url.searchParams.get("dl")).toBe("https://spike.example/pricing");
    expect(url.searchParams.get("dt")).toBe("Pricing");
  });

  it("bridges event.payload the same as event.params (contract-shaped AirlockEvent form)", () => {
    const connector = createFloodlightConnector({ conversionId: CONVERSION_ID, ctx: { consent: GRANTED } });
    const [{ url }] = connector.handle({ type: "page_view", payload: { page_title: "Via payload" } });
    expect(new URL(url).searchParams.get("dt")).toBe("Via payload");
  });

  it("no secret anywhere in the query — auth is tid + origin, like AW (ADR-0019)", () => {
    const params = beaconParams();
    for (const key of params.keys()) expect(key.toLowerCase()).not.toContain("secret");
  });

  it("the endpoint origin is the public www.google.com collect host — no credential in the URL", () => {
    const [{ url }] = createFloodlightConnector({ conversionId: CONVERSION_ID, ctx: { consent: GRANTED } }).handle({
      type: "page_view",
      params: {},
    });
    expect(new URL(url).origin).toBe("https://www.google.com");
  });

  it("an event this connector does not map (not page_view) replays to [] — the zero-or-one gate, never a partial beacon", () => {
    const connector = createFloodlightConnector({ conversionId: CONVERSION_ID, ctx: { consent: GRANTED } });
    expect(connector.handle({ type: "add_to_cart", params: {} })).toEqual([]);
  });

  it("manifest declares egress under ad_storage so the seal CAN gate it (046-03), and the _gcl_au cookie capability", () => {
    const { manifest } = createFloodlightConnector({ conversionId: CONVERSION_ID });
    expect(manifest.name).toBe("airlock/floodlight");
    expect(manifest.capabilities.egress).toBe(true);
    expect(manifest.capabilities.cookies).toContain("_gcl_au");
    expect(manifest.purposes.egress).toContain("ad_storage");
    expect(manifest.purposes.cookies._gcl_au).toContain("ad_storage");
    expect(manifest.endpoints).toContain(FLOODLIGHT_CCM_COLLECT_ENDPOINT);
  });
});

describe("createFloodlightConnector — AC2 Consent Mode v2 carriage via the REUSED consent-mode.js encoders", () => {
  it("granted-all vector encodes gcs=G111, gcd=13r3r3r3r5l1, npa=0 (byte-equal to the captured granted-state carriage, R-010)", () => {
    const params = beaconParams();
    expect(params.get("gcs")).toBe("G111");
    expect(params.get("gcd")).toBe("13r3r3r3r5l1");
    expect(params.get("npa")).toBe("0");
  });

  it("gcs/gcd/npa on the beacon are byte-identical to connectors/consent-mode.js's encoders — REUSED, not re-authored", () => {
    const params = beaconParams();
    expect(params.get("gcs")).toBe(encodeGcs(GRANTED));
    expect(params.get("gcd")).toBe(encodeGcd(GRANTED));
    expect(params.get("npa")).toBe(encodeNpa(GRANTED));
  });

  it("a pending consent vector omits gcs/gcd entirely (039's joint-string discipline, inherited via the shared encoder)", () => {
    const connector = createFloodlightConnector({ conversionId: CONVERSION_ID, ctx: {} }); // no consent signal
    const [{ url }] = connector.handle({ type: "page_view", params: {} });
    expect(new URL(url).searchParams.get("gcs")).toBeNull();
    expect(new URL(url).searchParams.get("gcd")).toBeNull();
    expect(url).not.toContain("gcs=");
    expect(url).not.toContain("gcd=");
  });

  it("encodeNpa now lives in connectors/consent-mode.js, not connectors/google-ads/connector.js (this slice's extraction, AC2)", () => {
    const consentModeSrc = readFileSync(join(repoRoot, "connectors/consent-mode.js"), "utf8");
    const awSrc = readFileSync(join(repoRoot, "connectors/google-ads/connector.js"), "utf8");
    const floodlightSrc = readFileSync(join(repoRoot, "connectors/floodlight/connector.js"), "utf8");

    expect(consentModeSrc).toMatch(/export function encodeNpa\b/);
    expect(awSrc).not.toMatch(/function encodeNpa\b/); // no longer re-declared — imported instead
    expect(awSrc).toMatch(/\bencodeNpa\b/); // still referenced (imported + used in mapToAwCollect)
    expect(awSrc).toMatch(/import\s*\{[^}]*\}\s*from ["']\.\.\/consent-mode\.js["']/);
    expect(floodlightSrc).toMatch(/import\s*\{[^}]*encodeNpa[^}]*\}\s*from ["']\.\.\/consent-mode\.js["']/);
  });
});

describe("createFloodlightConnector — AC3 auid read-when-present / omit-when-absent / NEVER minted (via the REUSED sourceGoogleAdsCtx)", () => {
  it("ctx.auid present -> auid forwarded on the beacon", () => {
    expect(beaconParams({ auid: "9988776655.1610000000" }).get("auid")).toBe("9988776655.1610000000");
  });

  it("ctx.auid absent -> auid OMITTED entirely (never minted — no auid= on the URL)", () => {
    const connector = createFloodlightConnector({ conversionId: CONVERSION_ID, ctx: { consent: GRANTED } });
    const [{ url }] = connector.handle({ type: "page_view", params: {} });
    expect(new URL(url).searchParams.has("auid")).toBe(false);
    expect(url).not.toContain("auid=");
  });

  it("wires directly to the SAME sourceGoogleAdsCtx AW uses — _gcl_au -> auid, ad_storage-gated", () => {
    const granted = sourceGoogleAdsCtx({ cookieString: "_gcl_au=1.1.9988776655.1610000000" });
    expect(granted.auid).toBe("9988776655.1610000000");
    expect(beaconParams({ auid: granted.auid }).get("auid")).toBe("9988776655.1610000000");

    const denied = sourceGoogleAdsCtx({
      cookieString: "_gcl_au=1.1.9988776655.1610000000",
      adStorageGranted: false,
    });
    expect("auid" in denied).toBe(false); // the read itself is ad_storage-gated — never reaches ctx
  });

  it("the floodlight parity replay sources auid via the REUSED sourceGoogleAdsCtx (google-ads/cookies.js) — no separate floodlight cookies.js exists", () => {
    const replaySrc = readFileSync(join(repoRoot, "rig/parity/floodlight-ccm-replay.js"), "utf8");
    expect(replaySrc).toMatch(/sourceGoogleAdsCtx/);
    expect(replaySrc).toMatch(/from ["']\.\.\/\.\.\/connectors\/google-ads\/cookies\.js["']/);
  });
});
