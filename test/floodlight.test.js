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
  FLOODLIGHT_ACTIVITY_ENDPOINT,
} from "../connectors/floodlight/connector.js";
import { sourceGoogleAdsCtx } from "../connectors/google-ads/cookies.js";
import { encodeGcs, encodeGcd, encodeNpa } from "../connectors/consent-mode.js";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));

const CONVERSION_ID = "DC-1234567890";
// The Floodlight-native activity identity (046-02) — src/type/cat, the config-provided triple the
// ccm/collect beacon does NOT carry.
const DC_SRC = "1234567";
const DC_TYPE = "grptag00";
const DC_CAT = "acttag00";
const GRANTED = {
  ad_storage: "granted",
  analytics_storage: "granted",
  ad_user_data: "granted",
  ad_personalization: "granted",
};

/** Build the ccm/collect beacon (requests[0]) for a granted page_view with the given ctx overrides,
 *  return its parsed query. handle() is now length-2 — this reads the FIRST (ccm) beacon. */
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

/** Parse the ;-delimited activity beacon PATH into a flat { field: value } map (the same job the
 *  oracle-side flattener does): split the pathname on `;`, drop the base path, decode each
 *  key=value segment. */
function parseActivityPath(url) {
  const { pathname } = new URL(url);
  /** @type {Record<string,string>} */
  const fields = {};
  const segments = pathname.split(";");
  for (let i = 1; i < segments.length; i++) {
    const seg = segments[i];
    if (!seg) continue;
    const eq = seg.indexOf("=");
    if (eq === -1) continue;
    fields[decodeURIComponent(seg.slice(0, eq))] = decodeURIComponent(seg.slice(eq + 1));
  }
  return fields;
}

/** Build the activity beacon (requests[1]) for a granted page_view with the given ctx overrides,
 *  return its flat path-segment field map. */
function activityFields(ctx = {}, config = {}) {
  const connector = createFloodlightConnector({
    conversionId: CONVERSION_ID,
    src: DC_SRC,
    type: DC_TYPE,
    cat: DC_CAT,
    ctx: { consent: GRANTED, ...ctx },
    ...config,
  });
  const requests = connector.handle({
    type: "page_view",
    params: { page_location: "https://spike.example/pricing", page_title: "Pricing" },
  });
  const activity = requests.find((r) => r.url.startsWith(FLOODLIGHT_ACTIVITY_ENDPOINT));
  return { request: activity, fields: parseActivityPath(activity.url) };
}

describe("createFloodlightConnector — AC1 ccm/collect DC page-load beacon", () => {
  it("handle() returns ONLY the ccm/collect beacon { url, method:'GET' } with tid=DC-id/en/dl/dt when no activity identity (src) is configured — length-1, byte-identical to 046-01 (046-02's src-guard)", () => {
    const connector = createFloodlightConnector({ conversionId: CONVERSION_ID, ctx: { consent: GRANTED } });
    const requests = connector.handle({
      type: "page_view",
      params: { page_location: "https://spike.example/pricing", page_title: "Pricing" },
    });

    expect(Array.isArray(requests)).toBe(true);
    // No `src` configured -> the activity beacon does NOT emit (046-02's identity-presence guard) ->
    // length-1, the ccm/collect beacon ONLY (no activity beacon at all).
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
    const { manifest } = createFloodlightConnector({ conversionId: CONVERSION_ID, src: DC_SRC });
    expect(manifest.name).toBe("airlock/floodlight");
    expect(manifest.capabilities.egress).toBe(true);
    expect(manifest.capabilities.cookies).toContain("_gcl_au");
    expect(manifest.purposes.egress).toContain("ad_storage");
    expect(manifest.purposes.cookies._gcl_au).toContain("ad_storage");
    expect(manifest.endpoints).toContain(FLOODLIGHT_CCM_COLLECT_ENDPOINT);
  });

  it("manifest declares ONLY the ccm/collect endpoint (no activity endpoint/purpose) when src is NOT configured — exactly like 046-01 (046-02's src-guard)", () => {
    const { manifest } = createFloodlightConnector({ conversionId: CONVERSION_ID });
    expect(manifest.endpoints).toEqual([FLOODLIGHT_CCM_COLLECT_ENDPOINT]);
    expect(Object.keys(manifest.purposes.endpoints)).toEqual([FLOODLIGHT_CCM_COLLECT_ENDPOINT]);
  });

  it("manifest ALSO declares the ;-matrix activity endpoint prefix under ad_storage (046-02 AC4 — the ceiling admits it)", () => {
    const { manifest } = createFloodlightConnector({ conversionId: CONVERSION_ID, src: DC_SRC });
    // The activity ceiling endpoint is the DECLARED ;-matrix PREFIX (/activity;src=<id>), NOT the
    // full per-request URL — the endpoint-ceiling's segment-anchored prefix match admits the beacon
    // despite the per-request num/ord cachebuster in the path.
    const activityCeiling = `${FLOODLIGHT_ACTIVITY_ENDPOINT};src=${DC_SRC}`;
    expect(manifest.endpoints).toContain(activityCeiling);
    expect(manifest.purposes.endpoints[activityCeiling]).toContain("ad_storage");
    // The emitted activity URL starts with the declared prefix at a ;-boundary (ceiling admission).
    const { request } = activityFields();
    expect(request.url.startsWith(`${activityCeiling};`)).toBe(true);
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

describe("createFloodlightConnector — AC1 ;-delimited activity DC page-load beacon (046-02)", () => {
  it("handle() returns TWO beacons — [ccm, activity]; the activity one is a GET to ad.doubleclick.net/activity, ;-delimited", () => {
    const connector = createFloodlightConnector({
      conversionId: CONVERSION_ID,
      src: DC_SRC,
      type: DC_TYPE,
      cat: DC_CAT,
      ctx: { consent: GRANTED },
    });
    const requests = connector.handle({ type: "page_view", params: {} });

    expect(requests).toHaveLength(2);
    const activity = requests[1];
    expect(activity.method).toBe("GET");
    expect(activity.body).toBeUndefined();
    // The wire is ;-delimited: params ride the PATH, there is NO query string.
    const url = new URL(activity.url);
    expect(url.origin + "/activity").toBe(FLOODLIGHT_ACTIVITY_ENDPOINT);
    expect(url.search).toBe("");
    expect(url.pathname.startsWith("/activity;")).toBe(true);
  });

  it("the activity beacon carries the Floodlight-native identity src/type/cat as PATH segments (the ccm/collect beacon does NOT)", () => {
    const { fields } = activityFields();
    expect(fields.src).toBe(DC_SRC);
    expect(fields.type).toBe(DC_TYPE);
    expect(fields.cat).toBe(DC_CAT);
    // src is the FIRST segment (the ceiling prefix anchor).
    const { request } = activityFields();
    expect(request.url.startsWith(`${FLOODLIGHT_ACTIVITY_ENDPOINT};src=${DC_SRC};`)).toBe(true);
  });

  it("a value containing a ; is percent-encoded so it can NEVER inject a stray path segment (no query builder reuse)", () => {
    const { fields, request } = activityFields({}, { cat: "a;src=evil;b" });
    // decoded back, the value is intact...
    expect(fields.cat).toBe("a;src=evil;b");
    // ...and the injected `src=evil` never became a real segment (the raw URL has no literal `;src=evil;`).
    expect(request.url).toContain("%3Bsrc%3Devil%3B");
    expect(request.url).not.toContain(";src=evil;");
  });

  it("an event this connector does not map (not page_view) replays to [] — neither beacon fires", () => {
    const connector = createFloodlightConnector({
      conversionId: CONVERSION_ID,
      src: DC_SRC,
      ctx: { consent: GRANTED },
    });
    expect(connector.handle({ type: "add_to_cart", params: {} })).toEqual([]);
  });
});

describe("createFloodlightConnector — AC2 activity Consent Mode v2 + auiddc (values identical to ccm; only the layout differs)", () => {
  it("gcs/gcd/npa on the activity path are byte-identical to the shared encoders AND to the ccm beacon", () => {
    const { fields } = activityFields();
    expect(fields.gcs).toBe("G111");
    expect(fields.gcd).toBe("13r3r3r3r5l1");
    expect(fields.npa).toBe("0");
    // Same values the shared encoders produce...
    expect(fields.gcs).toBe(encodeGcs(GRANTED));
    expect(fields.gcd).toBe(encodeGcd(GRANTED));
    expect(fields.npa).toBe(encodeNpa(GRANTED));
    // ...and byte-identical to the ccm beacon's own carriage (only the URL layout differs).
    const ccm = beaconParams();
    expect(fields.gcs).toBe(ccm.get("gcs"));
    expect(fields.gcd).toBe(ccm.get("gcd"));
    expect(fields.npa).toBe(ccm.get("npa"));
  });

  it("a pending consent vector omits gcs/gcd from the activity path entirely (inherited joint-string discipline)", () => {
    const { request } = activityFields({ consent: undefined }, {});
    // ctx.consent undefined -> encodeGcs/encodeGcd return undefined -> omitted.
    expect(request.url).not.toContain("gcs=");
    expect(request.url).not.toContain("gcd=");
  });

  it("auiddc reuses 046-01's _gcl_au read (ctx.auid) — emitted under the auiddc param name (§A4), same value as ccm's auid", () => {
    const auid = "9988776655.1610000000";
    const { fields } = activityFields({ auid });
    expect(fields.auiddc).toBe(auid);
    // §A4: auid == auiddc == the SAME _gcl_au-derived value — the ccm beacon carries it as `auid`.
    expect(beaconParams({ auid }).get("auid")).toBe(auid);
    // absent ctx.auid -> auiddc omitted entirely, never minted.
    const { request } = activityFields({ auid: undefined });
    expect(request.url).not.toContain("auiddc=");
  });
});

describe("createFloodlightConnector — AC5 the ccm/collect beacon is byte-unchanged (no 046-01 regression)", () => {
  it("requests[0] (ccm) is identical whether or not the activity identity (src/type/cat) is configured", () => {
    const base = {
      conversionId: CONVERSION_ID,
      ctx: { consent: GRANTED, auid: "9988776655.1610000000" },
    };
    const event = { type: "page_view", params: { page_location: "https://x.example/p", page_title: "P" } };
    const withActivity = createFloodlightConnector({ ...base, src: DC_SRC, type: DC_TYPE, cat: DC_CAT }).handle(event);
    const ccmRef = createFloodlightConnector(base).handle(event);
    // The ccm beacon is a pure function of conversionId/ctx/endpoint — adding the activity identity
    // config does not perturb requests[0] at all.
    expect(withActivity[0]).toEqual(ccmRef[0]);
    expect(withActivity[0].url).toBe(ccmRef[0].url);
    expect(withActivity[0].method).toBe("GET");
  });

  it("both beacons carry the source `event` (the 045-01 re-map channel — 046-03 will read it)", () => {
    const event = { type: "page_view", params: { page_title: "P" } };
    const requests = createFloodlightConnector({
      conversionId: CONVERSION_ID,
      src: DC_SRC,
      ctx: { consent: GRANTED },
    }).handle(event);
    expect(requests[0].event).toBe(event);
    expect(requests[1].event).toBe(event);
  });
});
