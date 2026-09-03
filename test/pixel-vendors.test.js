// LinkedIn Insight + Bing UET as flat GET pixel configs — spec 026-02
// AC1/AC2/AC3. Connector-level (no FakeWorker/adapter needed): every
// assertion runs createPixelConnector(config).handle(event) directly, the
// SAME pure entry point test/pixel-connector.test.js already exercises for
// Meta (026-01) — proving LinkedIn + Bing generalize the SAME interpreter
// with ZERO new code in connectors/pixel/connector.js.
//
// AC3's "one connector, N configs" claim is TABLE-DRIVEN across all three
// vendors (Meta + LinkedIn + Bing) and made ENUMERABLE: an empty
// `git diff -- connectors/pixel/connector.js`, an empty `git diff -- core/`
// (026-02 touches configs/adapters/tests only), and a grep that connector.js's
// CODE (block/line comments stripped — the file's own header prose
// legitimately narrates "Meta"/"LinkedIn Insight"/"Bing UET" as illustrative
// examples, per 026-01's ALREADY-COMMITTED docstring; the invariant this AC
// actually cares about is no vendor-specific LOGIC, so the grep is scoped to
// interpreted code) never names a vendor.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { createPixelConnector } from "../connectors/pixel/connector.js";
import { createMetaPixelConfig, META_TR_ENDPOINT, SYNTHETIC_META_PIXEL_ID } from "../connectors/pixel/vendors/meta.js";
import {
  createLinkedInInsightConfig,
  LINKEDIN_COLLECT_ENDPOINT,
  SYNTHETIC_LINKEDIN_PARTNER_ID,
  SYNTHETIC_LINKEDIN_CONVERSION_ID,
  LINKEDIN_EGRESS_PURPOSES,
} from "../connectors/pixel/vendors/linkedin.js";
import {
  createBingUetConfig,
  BING_UET_ENDPOINT,
  SYNTHETIC_BING_TAG_ID,
  BING_EGRESS_PURPOSES,
} from "../connectors/pixel/vendors/bing.js";

describe("LinkedIn Insight config (AC1) — a flat GET config, ZERO connector code", () => {
  const partnerId = SYNTHETIC_LINKEDIN_PARTNER_ID;
  const conversionId = SYNTHETIC_LINKEDIN_CONVERSION_ID;
  const connector = createPixelConnector(createLinkedInInsightConfig({ partnerId, conversionId }));

  it("declares name/events/no-cookie-capability/purposes derived from the config", () => {
    const { manifest } = connector;
    expect(manifest.name).toBe("airlock/pixel/linkedin");
    expect(manifest.events.sort()).toEqual(["lead", "page_view"]);
    expect(manifest.reads).toEqual([]);
    expect(manifest.capabilities.egress).toBe(true);
    expect(manifest.capabilities.cookies).toBeUndefined(); // identity-honest — no li_fat_id cookie identity
    expect(manifest.endpoints).toEqual([LINKEDIN_COLLECT_ENDPOINT]);
    expect(manifest.purposes.egress).toEqual(["ad_storage"]);
    expect(LINKEDIN_EGRESS_PURPOSES).toEqual(["ad_storage"]);
  });

  const table = [
    {
      name: "the base tag (page_view) fires on load — pid + fmt only, NO conversionId (no universal ev-style key)",
      event: { type: "page_view", params: {} },
      expectParams: { pid: partnerId, fmt: "gif" },
      absentParams: ["conversionId"],
    },
    {
      name: "a conversion (lead) — pid + fmt + the scalar conversionId",
      event: { type: "lead", params: {} },
      expectParams: { pid: partnerId, fmt: "gif", conversionId },
      absentParams: [],
    },
  ];

  it.each(table)("$name", ({ event, expectParams, absentParams }) => {
    const requests = connector.handle(event);
    expect(requests).toHaveLength(1);
    const [req] = requests;

    expect(req.method).toBe("GET");
    expect(req.body).toBeUndefined(); // GET — no body

    const url = new URL(req.url);
    expect(url.origin + url.pathname).toBe(LINKEDIN_COLLECT_ENDPOINT);
    for (const [key, value] of Object.entries(expectParams)) {
      expect(url.searchParams.get(key)).toBe(value);
    }
    for (const key of absentParams) {
      expect(url.searchParams.has(key)).toBe(false);
    }
  });

  it("an event type absent from eventMap maps to ZERO requests (never throws, never a partial beacon)", () => {
    expect(connector.handle({ type: "add_to_cart", params: {} })).toEqual([]);
  });

  it("AC5 structural half — a `ctx` key placed on the config cannot leak: createPixelConnector never reads it", () => {
    const configWithCtx = {
      ...createLinkedInInsightConfig({ partnerId }),
      ctx: { clientId: "SHOULD-NEVER-CROSS-INTO-A-URL" },
    };
    const [req] = createPixelConnector(configWithCtx).handle({ type: "page_view", params: {} });
    expect(req.url).not.toContain("SHOULD-NEVER-CROSS-INTO-A-URL");
  });
});

describe("Bing UET config (AC2) — a flat GET config, ZERO connector code", () => {
  const tagId = SYNTHETIC_BING_TAG_ID;
  const connector = createPixelConnector(createBingUetConfig({ tagId }));

  it("declares name/events/no-cookie-capability/purposes derived from the config", () => {
    const { manifest } = connector;
    expect(manifest.name).toBe("airlock/pixel/bing");
    expect(manifest.events.sort()).toEqual(["lead", "page_view"]);
    expect(manifest.reads).toEqual([]);
    expect(manifest.capabilities.egress).toBe(true);
    expect(manifest.capabilities.cookies).toBeUndefined(); // identity-honest — no _uetsid/_uetvid cookie identity
    expect(manifest.endpoints).toEqual([BING_UET_ENDPOINT]);
    expect(manifest.purposes.egress).toEqual(["ad_storage"]);
    expect(BING_EGRESS_PURPOSES).toEqual(["ad_storage"]);
  });

  const table = [
    {
      name: "the base tag's own auto-fired page-load event — ti + evt=pageLoad, no goal params",
      event: { type: "page_view", params: {} },
      expectParams: { ti: tagId, evt: "pageLoad" },
      absentParams: ["gv", "ec"],
    },
    {
      name: "a custom Event goal (lead) with a value + category",
      event: { type: "lead", params: { value: 25, event_category: "signup" } },
      expectParams: { ti: tagId, evt: "custom", gv: "25", ec: "signup" },
      absentParams: [],
    },
  ];

  it.each(table)("$name", ({ event, expectParams, absentParams }) => {
    const requests = connector.handle(event);
    expect(requests).toHaveLength(1);
    const [req] = requests;

    expect(req.method).toBe("GET");
    expect(req.body).toBeUndefined();

    const url = new URL(req.url);
    expect(url.origin + url.pathname).toBe(BING_UET_ENDPOINT);
    for (const [key, value] of Object.entries(expectParams)) {
      expect(url.searchParams.get(key)).toBe(value);
    }
    for (const key of absentParams) {
      expect(url.searchParams.has(key)).toBe(false);
    }
  });

  it("an event type absent from eventMap maps to ZERO requests", () => {
    expect(connector.handle({ type: "add_to_cart", params: {} })).toEqual([]);
  });

  it("AC5 structural half — a `ctx` key placed on the config cannot leak: createPixelConnector never reads it", () => {
    const configWithCtx = { ...createBingUetConfig({ tagId }), ctx: { clientId: "SHOULD-NEVER-CROSS-INTO-A-URL" } };
    const [req] = createPixelConnector(configWithCtx).handle({ type: "page_view", params: {} });
    expect(req.url).not.toContain("SHOULD-NEVER-CROSS-INTO-A-URL");
  });
});

describe("AC3 — the archetype generalises: ONE connector, N configs (Meta + LinkedIn + Bing), ZERO connector code", () => {
  const vendorTable = [
    {
      vendor: "meta",
      config: createMetaPixelConfig(),
      endpoint: META_TR_ENDPOINT,
      expectKey: "id",
      expectValue: SYNTHETIC_META_PIXEL_ID,
    },
    {
      vendor: "linkedin",
      config: createLinkedInInsightConfig(),
      endpoint: LINKEDIN_COLLECT_ENDPOINT,
      expectKey: "pid",
      expectValue: SYNTHETIC_LINKEDIN_PARTNER_ID,
    },
    {
      vendor: "bing",
      config: createBingUetConfig(),
      endpoint: BING_UET_ENDPOINT,
      expectKey: "ti",
      expectValue: SYNTHETIC_BING_TAG_ID,
    },
  ];

  it.each(vendorTable)(
    "$vendor's page_view dispatches a governed GET via the SAME createPixelConnector, config-driven only",
    ({ config, endpoint, expectKey, expectValue }) => {
      const connector = createPixelConnector(config);
      const requests = connector.handle({ type: "page_view", params: {} });

      expect(requests).toHaveLength(1);
      const [req] = requests;
      expect(req.method).toBe("GET");
      expect(req.body).toBeUndefined();

      const url = new URL(req.url);
      expect(url.origin + url.pathname).toBe(endpoint);
      expect(url.searchParams.get(expectKey)).toBe(expectValue);
    },
  );

  // The two `git diff -- connectors/pixel/connector.js` / `-- core/` canaries were REMOVED in the
  // 025-03 reconciliation: a bare `git diff` (working-tree-vs-index) is green-by-construction after
  // commit and spuriously fails on any LATER slice legitimately touching core/ (025-03 does) — the
  // fragility 026-02's + 026-03's own reviews flagged. The no-vendor-string grep below is the DURABLE
  // guard for the real "zero vendor logic in the interpreter" invariant (it inspects current content).
  it("ENUMERABLE — connector.js's CODE (comments stripped) names no vendor: meta/facebook/linkedin/bing//tr/collect/action live in the config fixtures only", () => {
    const src = readFileSync(new URL("../connectors/pixel/connector.js", import.meta.url), "utf8");
    // Strip block comments + FULL-LINE `//` comments before checking — the file's
    // own header prose legitimately narrates vendor names as illustrative examples;
    // the invariant under test is "no vendor-specific CODE", not "no vendor word in
    // an English sentence".
    // 026-02 COMPLIANCE-REVIEW FIX: strip only full-line `//` comments, NOT inline
    // `//` — an inline strip also eats string-literal URLs (`"https://vendor…"`),
    // so a hardcoded vendor endpoint in connector.js CODE (the likeliest AC3
    // violation) would evade the grep by hiding behind its own `//`. Full-line-only
    // stripping keeps such a string in the grepped code, closing that hole.
    const code = src
      .replace(/\/\*[\s\S]*?\*\//g, "") // block comments (the vendor-narrating JSDoc header)
      .replace(/^\s*\/\/.*$/gm, "");    // FULL-LINE line comments only (never inline — preserves string URLs)
    const lower = code.toLowerCase();
    for (const term of ["meta", "facebook", "linkedin", "bing", "/tr", "collect", "action"]) {
      expect(lower).not.toContain(term);
    }
  });
});
