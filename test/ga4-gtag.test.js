// GA4 gtag-protocol connector — spec 039-01 (ADR-0019). `createGa4GtagConnector`
// is a NEW module, sibling to `connectors/ga4/map.js` (the MP mapper) — NOT a
// modification of it. It maps a captured event into a container-shaped
// `/g/collect` GET beacon, returned as the `EgressRequest[]` array shape
// `contracts/connector.d.ts` declares and `core/connector-host.js` consumes:
// `[{ url, method: "GET" }]`, no `api_secret` (the ADR-0019 adoption fix —
// GA4's own auth is `tid` + request origin).
//
// AC1: core attribution set (v/tid/cid/en/dl/dr/dt/ep./epn./_et) on a single
//      GET beacon.
// AC2: cid/sid sourced exactly as the MP path does (connectors/ga4/cookies.js
//      `sourceGa4Ctx`, reused unmodified) — this slice takes the resulting
//      `ctx` via config, it does not re-source cookies itself.
// AC3: no `api_secret` / secret param anywhere on the URL.
// AC4: additive — `connectors/ga4/map.js` + `contracts/ga4-mp*` are BYTE-
//      IDENTICAL to before this slice (golden-hash test below).
// AC5: the beacon passes the 038 same-protocol oracle on the core field set,
//      against a redacted `/g/collect` page_view fixture (038 is DONE, so this
//      wires into the REAL oracle, not a stand-in unit assertion).
import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

import { createGa4GtagConnector, GA4_GTAG_COLLECT_ENDPOINT } from "../connectors/ga4/gtag.js";
import { sourceGa4Ctx } from "../connectors/ga4/cookies.js";
import { diffParity } from "../rig/parity/oracle.js";
import { ga4GtagParityDescriptor } from "../rig/parity/descriptors/ga4-gtag.js";
import { SYNTHETIC_GA4_MEASUREMENT_ID } from "../rig/parity/descriptors/ga4.js";
import { sourceGa4CtxFromFixture } from "../rig/parity/ga4-ctx.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ctx = { clientId: "1234567890.1700000000", sessionId: "1724668790" };

describe("createGa4GtagConnector — AC1 core /g/collect page_view beacon", () => {
  it("handle() returns a length-1 EgressRequest[] carrying { url, method: 'GET' } to /g/collect with the core attribution set", () => {
    const connector = createGa4GtagConnector({ measurementId: "G-XXXX", ctx });
    const requests = connector.handle({
      type: "page_view",
      params: {
        page_location: "https://spike.example/pricing",
        page_referrer: "https://spike.example/",
        page_title: "Pricing",
      },
    });

    expect(Array.isArray(requests)).toBe(true);
    expect(requests).toHaveLength(1);
    const [result] = requests;

    expect(result.method).toBe("GET");
    expect(result.body).toBeUndefined();
    const url = new URL(result.url);
    expect(url.origin + url.pathname).toBe(GA4_GTAG_COLLECT_ENDPOINT);
    expect(url.searchParams.get("v")).toBe("2");
    expect(url.searchParams.get("tid")).toBe("G-XXXX");
    expect(url.searchParams.get("cid")).toBe(ctx.clientId);
    expect(url.searchParams.get("sid")).toBe(ctx.sessionId);
    expect(url.searchParams.get("en")).toBe("page_view");
    expect(url.searchParams.get("dl")).toBe("https://spike.example/pricing");
    expect(url.searchParams.get("dr")).toBe("https://spike.example/");
    expect(url.searchParams.get("dt")).toBe("Pricing");
    expect(url.searchParams.get("_et")).not.toBeNull(); // engagement time is on every beacon
  });

  it("defaults _et to 100ms (mirrors mapToMp's own default) when ctx carries no engagementTimeMsec", () => {
    const connector = createGa4GtagConnector({ measurementId: "G-XXXX", ctx });
    const [{ url }] = connector.handle({ type: "page_view", params: {} });
    expect(new URL(url).searchParams.get("_et")).toBe("100");
  });

  it("honors an explicit ctx.engagementTimeMsec", () => {
    const connector = createGa4GtagConnector({ measurementId: "G-XXXX", ctx: { ...ctx, engagementTimeMsec: 4200 } });
    const [{ url }] = connector.handle({ type: "page_view", params: {} });
    expect(new URL(url).searchParams.get("_et")).toBe("4200");
  });

  it("bridges event.payload the same as event.params (contract-shaped AirlockEvent form)", () => {
    const connector = createGa4GtagConnector({ measurementId: "G-XXXX", ctx });
    const [{ url }] = connector.handle({ type: "page_view", payload: { page_title: "Via payload" } });
    expect(new URL(url).searchParams.get("dt")).toBe("Via payload");
  });
});

describe("createGa4GtagConnector — numeric-vs-string custom param split (ep./epn.)", () => {
  it("a string custom param lands under ep.<k>; a number lands under epn.<k>", () => {
    const connector = createGa4GtagConnector({ measurementId: "G-XXXX", ctx });
    const [{ url }] = connector.handle({
      type: "page_view",
      params: { page_type: "article", reading_time_sec: 42 },
    });
    const params = new URL(url).searchParams;
    expect(params.get("ep.page_type")).toBe("article");
    expect(params.get("epn.reading_time_sec")).toBe("42");
    expect(params.get("ep.reading_time_sec")).toBeNull(); // never BOTH spellings for one param
    expect(params.get("epn.page_type")).toBeNull();
  });

  it("page_location/page_referrer/page_title never leak into ep./epn. (they are dl/dr/dt, not custom params)", () => {
    const connector = createGa4GtagConnector({ measurementId: "G-XXXX", ctx });
    const [{ url }] = connector.handle({
      type: "page_view",
      params: { page_location: "https://x.test/", page_referrer: "https://y.test/", page_title: "X" },
    });
    const params = new URL(url).searchParams;
    expect(params.get("ep.page_location")).toBeNull();
    expect(params.get("ep.page_referrer")).toBeNull();
    expect(params.get("ep.page_title")).toBeNull();
  });
});

describe("createGa4GtagConnector — AC3 no api_secret / secret param (ADR-0019 adoption fix)", () => {
  it("the URL never carries api_secret or any *secret* query key", () => {
    const connector = createGa4GtagConnector({ measurementId: "G-XXXX", ctx });
    const [{ url }] = connector.handle({ type: "page_view", params: {} });
    expect(url).not.toContain("api_secret");
    for (const key of new URL(url).searchParams.keys()) {
      expect(key.toLowerCase()).not.toContain("secret");
    }
  });

  it("auth is tid + origin only — the endpoint is the public collect host, no credential in the URL", () => {
    const connector = createGa4GtagConnector({ measurementId: "G-XXXX", ctx });
    const [{ url }] = connector.handle({ type: "page_view", params: {} });
    expect(new URL(url).origin).toBe("https://www.google-analytics.com");
  });
});

describe("createGa4GtagConnector — AC2 cid/sid sourced exactly as the MP path (sourceGa4Ctx reuse)", () => {
  it("ctx built by the SAME sourceGa4Ctx the MP path uses lands unmodified on cid/sid", async () => {
    const cookies = {
      async get(name) {
        return name === "_ga" ? "GA1.1.555.1690000000" : null;
      },
      async set() {},
    };
    const sourcedCtx = await sourceGa4Ctx({
      cookies,
      cookieString: "_ga_STREAM1=GS2.1.s999$o1$g0$t100$j60$l0$h0",
    });
    const connector = createGa4GtagConnector({ measurementId: "G-XXXX", ctx: sourcedCtx });
    const [{ url }] = connector.handle({ type: "page_view", params: {} });
    const params = new URL(url).searchParams;
    expect(params.get("cid")).toBe("555.1690000000");
    expect(params.get("sid")).toBe("999");
  });
});

describe("AC4 — additive: the frozen MP surface is BYTE-IDENTICAL to before this slice", () => {
  // Golden hashes captured from the tree BEFORE connectors/ga4/gtag.js existed
  // (2026-09-08) — a hash mismatch means map.js or the pinned MP contract was
  // touched by this (additive-only) slice.
  const GOLDEN_SHA256 = {
    "connectors/ga4/map.js": "e40df6b78e958426289c3ab4714437e3d62803fc8a238e446d7d6fc0f5476246",
    "contracts/ga4-mp-request.schema.json": "10f2fc0775f49ac0e86466176e06e8e55af6dd96884211a35ae0b105897b387d",
    "contracts/ga4-mp.md": "e7e6d2384b2c9572c52b536300bdfb44219e5d61f8816184111d7245fd298eda",
  };
  const repoRoot = fileURLToPath(new URL("..", import.meta.url));

  for (const [relPath, expectedHash] of Object.entries(GOLDEN_SHA256)) {
    it(`${relPath} is unchanged (sha256 matches the pre-039-01 golden)`, () => {
      const contents = readFileSync(join(repoRoot, relPath));
      const actualHash = createHash("sha256").update(contents).digest("hex");
      expect(actualHash).toBe(expectedHash);
    });
  }

  it("gtag.js is a NEW, standalone module — it does not import from or re-export map.js", () => {
    const gtagSource = readFileSync(join(repoRoot, "connectors/ga4/gtag.js"), "utf8");
    expect(gtagSource).not.toMatch(/from ["']\.\/map\.js["']/);
  });
});

describe("AC5 — same-protocol oracle (038, DONE): the emitted beacon passes on the core field set", () => {
  const FIXTURE_PATH = join(HERE, "fixtures/parity-ga4-collect.redacted.json");
  const fixture = JSON.parse(readFileSync(FIXTURE_PATH, "utf8"));

  /** Same replay shape as rig/parity/ga4-replay.js's `replayGa4Egress`, for the
   * gtag connector: ctx from the fixture's OWN cookies (never the captured
   * beacon's cid/sid — the decisive AC1 rule 038-02 established), event derived
   * from the container's fields via the descriptor's `deriveLogicalEvent`. */
  async function replayGtagFields() {
    const ctxFromFixture = await sourceGa4CtxFromFixture({ cookies: fixture.cookies });
    const logicalEvent = ga4GtagParityDescriptor.deriveLogicalEvent(fixture.container_fields);
    const connector = createGa4GtagConnector({ measurementId: SYNTHETIC_GA4_MEASUREMENT_ID, ctx: ctxFromFixture });
    const [{ url }] = connector.handle({ type: logicalEvent.type, params: logicalEvent.params });
    return Object.fromEntries(new URL(url).searchParams.entries());
  }

  it("cid/sid classify `maps` — sourced via the SAME shared cookie the container read, not a beacon back-feed", async () => {
    const airlockFields = await replayGtagFields();
    const { fields } = diffParity({
      descriptor: ga4GtagParityDescriptor,
      containerFields: fixture.container_fields,
      airlockFields,
    });
    expect(fields.find((f) => f.field === "cid")).toMatchObject({ bucket: "maps", containerValue: fixture.container_fields.cid });
    expect(fields.find((f) => f.field === "sid")).toMatchObject({ bucket: "maps", containerValue: fixture.container_fields.sid });
  });

  it("the core field set (tid/en/dl/dr/dt/ep.page_type/epn.reading_time_sec) all classify `maps`", async () => {
    const airlockFields = await replayGtagFields();
    const { fields } = diffParity({
      descriptor: ga4GtagParityDescriptor,
      containerFields: fixture.container_fields,
      airlockFields,
    });
    for (const name of ["tid", "en", "dl", "dr", "dt", "ep.page_type", "epn.reading_time_sec"]) {
      expect(fields.find((f) => f.field === name).bucket).toBe("maps");
    }
  });

  it("overall verdict is `pass` — the not-yet-emitted session/consent fields are OWNED gaps, not regressions", async () => {
    const airlockFields = await replayGtagFields();
    const { verdict, fields } = diffParity({
      descriptor: ga4GtagParityDescriptor,
      containerFields: fixture.container_fields,
      airlockFields,
    });
    expect(verdict).toBe("pass");
    for (const name of ["sct", "seg", "_fv", "_ss", "_nsi", "gcs", "gcd"]) {
      expect(fields.find((f) => f.field === name).bucket).toBe("expected-dropped");
    }
  });

  it("an UN-OWNED drop (en missing) is a real regression — the gap map does not swallow it", async () => {
    const airlockFields = await replayGtagFields();
    delete airlockFields.en;
    const { verdict, fields } = diffParity({
      descriptor: ga4GtagParityDescriptor,
      containerFields: fixture.container_fields,
      airlockFields,
    });
    expect(verdict).toBe("fail");
    expect(fields.find((f) => f.field === "en").bucket).toBe("dropped");
  });
});
