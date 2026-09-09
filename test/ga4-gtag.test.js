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
import { describe, it, expect, vi } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

import { createGa4GtagConnector, GA4_GTAG_COLLECT_ENDPOINT } from "../connectors/ga4/gtag.js";
import { sourceGa4Ctx, writeGa4SessionState } from "../connectors/ga4/cookies.js";
import { resolveConsent } from "../core/consent.js";
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

// Spec 039-02 — Consent Mode STATE carriage (gcs), ADR-0019. `gcs` is a PURE
// function of the resolved host consent vector (core/consent.js's
// `resolveConsent`), threaded via `config.ctx.consent` — the SAME `ctx`
// object 039-01 already uses to carry host context, mirroring the existing
// single-sourcing-path convention rather than inventing a second one. Both
// anchors below (`G111`/`G100`) are LIVE-OBSERVED (slice-02-consent-mode.md's
// Grounding note + fixtures/parity-ga4-collect.redacted.json's own `gcs:
// "G111"` value) — not author-invented synthetic strings.
describe("createGa4GtagConnector — AC1/AC3 gcs Consent Mode STATE (039-02)", () => {
  it("all-granted vector encodes gcs=G111 (live-observed anchor)", () => {
    const connector = createGa4GtagConnector({
      measurementId: "G-XXXX",
      ctx: { ...ctx, consent: { ad_storage: "granted", analytics_storage: "granted" } },
    });
    const [{ url }] = connector.handle({ type: "page_view", params: {} });
    expect(new URL(url).searchParams.get("gcs")).toBe("G111");
  });

  it("all-denied vector encodes gcs=G100 (live-observed anchor)", () => {
    const connector = createGa4GtagConnector({
      measurementId: "G-XXXX",
      ctx: { ...ctx, consent: { ad_storage: "denied", analytics_storage: "denied" } },
    });
    const [{ url }] = connector.handle({ type: "page_view", params: {} });
    expect(new URL(url).searchParams.get("gcs")).toBe("G100");
  });

  it("asymmetric vector (ad_storage denied, analytics_storage granted) encodes gcs=G101 — LIVE-CONFIRMED 2026-09-08 on the reference page, and guards digit ORDER (G111/G100 are symmetric under swapping the two purposes and would stay green even if GCS_PURPOSES were reversed; this vector is not)", () => {
    const connector = createGa4GtagConnector({
      measurementId: "G-XXXX",
      ctx: { ...ctx, consent: { ad_storage: "denied", analytics_storage: "granted" } },
    });
    const [{ url }] = connector.handle({ type: "page_view", params: {} });
    expect(new URL(url).searchParams.get("gcs")).toBe("G101");
  });

  it("the complementary asymmetric vector (ad_storage granted, analytics_storage denied) encodes gcs=G110 — same confirmed digit-order rule, reversed", () => {
    const connector = createGa4GtagConnector({
      measurementId: "G-XXXX",
      ctx: { ...ctx, consent: { ad_storage: "granted", analytics_storage: "denied" } },
    });
    const [{ url }] = connector.handle({ type: "page_view", params: {} });
    expect(new URL(url).searchParams.get("gcs")).toBe("G110");
  });

  it("all-pending (no consent vector at all) omits gcs entirely — never a fail-safe-denied guess", () => {
    const connector = createGa4GtagConnector({ measurementId: "G-XXXX", ctx });
    const [{ url }] = connector.handle({ type: "page_view", params: {} });
    expect(new URL(url).searchParams.get("gcs")).toBeNull();
    expect(url).not.toContain("gcs=");
  });

  it("mixed-pending (ad_storage decided, analytics_storage pending) omits gcs entirely — no partial G1XY guess", () => {
    const connector = createGa4GtagConnector({
      measurementId: "G-XXXX",
      ctx: { ...ctx, consent: { ad_storage: "granted" } }, // analytics_storage has no signal
    });
    const [{ url }] = connector.handle({ type: "page_view", params: {} });
    expect(new URL(url).searchParams.get("gcs")).toBeNull();
    expect(url).not.toContain("gcs=");
  });

  it("gcs depends ONLY on ad_storage/analytics_storage — a denied data-use purpose does not flip it", () => {
    const connector = createGa4GtagConnector({
      measurementId: "G-XXXX",
      ctx: {
        ...ctx,
        consent: {
          ad_storage: "granted",
          analytics_storage: "granted",
          ad_user_data: "denied",
          ad_personalization: "denied",
        },
      },
    });
    const [{ url }] = connector.handle({ type: "page_view", params: {} });
    expect(new URL(url).searchParams.get("gcs")).toBe("G111");
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
   * from the container's fields via the descriptor's `deriveLogicalEvent`.
   *
   * 039-02: `consent` is NOT cookie-derived (unlike cid/sid), so it has no
   * `sourceGa4CtxFromFixture` equivalent — the fixture's `container_fields.gcs`
   * is the ALREADY-ENCODED live-observed all-granted anchor (`"G111"`), so the
   * host consent vector a real page would have resolved to produce it is
   * `{ ad_storage: "granted", analytics_storage: "granted" }`; threading that
   * here (rather than leaving `ctx.consent` unset) is what lets `gcs` classify
   * `maps` instead of a false `dropped` regression.
   *
   * 039-03: `sessionState` gets the SAME "thread the already-encoded value"
   * treatment, for a DIFFERENT reason than `consent` above. This fixture
   * predates the GS2 state-machine grounding (038-02, before 039-03's live
   * observation) — its `container_fields` carry a combination (`_fv`/`_ss`/
   * `_nsi` all set together with `seg="1"`) that no single observed transition
   * regime (first-visit / continuation / new-session, slice-03's Assumptions)
   * produces, and its `cookies` (`_ga`, `_ga_DEBUGTEST0`) are PINNED by
   * `test/parity-ga4.test.js`'s own MP-path assertions (exact `sid`/`cid`
   * parity, the streamless-fallback contrast) so they cannot be edited to fit
   * a consistent history without breaking that unrelated, already-passing
   * suite. Threading the fixture's OWN sct/seg/_fv/_ss/_nsi values here (the
   * known target this replay must reproduce) is the honest choice given that
   * constraint — the REAL writer's transition math is exercised end-to-end
   * against the dedicated multi-page fixture instead
   * (`parity-ga4-collect-multipage.redacted.json`, see the "039-03 —
   * `_ga_<stream>` read-modify-write session writer" describe block below). */
  async function replayGtagFields() {
    const ctxFromFixture = await sourceGa4CtxFromFixture({ cookies: fixture.cookies });
    const logicalEvent = ga4GtagParityDescriptor.deriveLogicalEvent(fixture.container_fields);
    const connector = createGa4GtagConnector({
      measurementId: SYNTHETIC_GA4_MEASUREMENT_ID,
      ctx: {
        ...ctxFromFixture,
        consent: { ad_storage: "granted", analytics_storage: "granted" },
        sessionState: {
          sct: fixture.container_fields.sct,
          seg: fixture.container_fields.seg,
          _fv: fixture.container_fields._fv,
          _ss: fixture.container_fields._ss,
          _nsi: fixture.container_fields._nsi,
        },
      },
    });
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

  it("039-02: gcs now classifies `maps` (gap CLOSED, removed from the descriptor's gapMap) — not expected-dropped", async () => {
    const airlockFields = await replayGtagFields();
    const { fields } = diffParity({
      descriptor: ga4GtagParityDescriptor,
      containerFields: fixture.container_fields,
      airlockFields,
    });
    expect(fields.find((f) => f.field === "gcs")).toMatchObject({
      bucket: "maps",
      containerValue: "G111",
      airlockValue: "G111",
    });
  });

  it("039-03: session state (sct/seg/_fv/_ss/_nsi) now classifies `maps` (gap CLOSED, removed from the descriptor's gapMap) — not expected-dropped", async () => {
    const airlockFields = await replayGtagFields();
    const { fields } = diffParity({
      descriptor: ga4GtagParityDescriptor,
      containerFields: fixture.container_fields,
      airlockFields,
    });
    for (const name of ["sct", "seg", "_fv", "_ss", "_nsi"]) {
      expect(fields.find((f) => f.field === name)).toMatchObject({
        bucket: "maps",
        containerValue: fixture.container_fields[name],
        airlockValue: fixture.container_fields[name],
      });
    }
  });

  it("overall verdict is `pass` — the not-yet-emitted gcd DEFAULTS string is the sole remaining OWNED gap, not a regression", async () => {
    const airlockFields = await replayGtagFields();
    const { verdict, fields } = diffParity({
      descriptor: ga4GtagParityDescriptor,
      containerFields: fixture.container_fields,
      airlockFields,
    });
    expect(verdict).toBe("pass");
    expect(fields.find((f) => f.field === "gcd").bucket).toBe("expected-dropped");
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

// Spec 039-03 — the `_ga_<stream>` session-state READ-MODIFY-WRITE writer that closes OQ13-2.
// `writeGa4SessionState` (connectors/ga4/cookies.js) is the genuinely NEW write discipline (in
// contrast to sourceGa4Ctx's create-if-absent `_ga` write, cookies.js:171): it reads the EXISTING
// `_ga_<stream>` cookie, advances its GS2 fields per the OBSERVED transition rules, and writes it
// back every cycle. Values below are asserted field-for-field against
// test/fixtures/parity-ga4-collect-multipage.redacted.json — the LIVE-OBSERVED (2026-09-08)
// three-regime capture (first visit / continuation / new session) the slice's Assumptions ground.
describe("writeGa4SessionState + createGa4GtagConnector — 039-03 session-state writer (closes OQ13-2)", () => {
  const FIXTURE_PATH = join(HERE, "fixtures/parity-ga4-collect-multipage.redacted.json");
  const multipageFixture = JSON.parse(readFileSync(FIXTURE_PATH, "utf8"));
  const STREAM_COOKIE = "_ga_DEBUGTEST0";

  /** A minimal in-memory cookie jar (capability.d.ts-shaped async get/set), mirroring
   *  ga4-cookies.test.js's own `makeJar` helper. */
  function makeJar(initial = {}) {
    const store = new Map(Object.entries(initial));
    return {
      async get(name) {
        return store.has(name) ? store.get(name) : null;
      },
      async set(name, value) {
        store.set(name, value);
      },
    };
  }

  /** Assembles ONE page's beacon via the REAL connector, given the writer's session state for
   *  that page — cid/tid/en/dl/dr/dt come straight from the fixture's own beacon (never inferred),
   *  mirroring how a real host's identity ctx and this writer's session ctx are two independently-
   *  sourced inputs merged onto the SAME `ctx` object (039-01/039-02's single-sourcing-path
   *  convention, extended here). */
  async function beaconParamsFor(pageIndex, sessionState) {
    const page = multipageFixture.pages[pageIndex];
    const params = { page_location: page.beacon.dl, page_title: page.beacon.dt };
    if (page.beacon.dr !== undefined) params.page_referrer = page.beacon.dr;
    const connector = createGa4GtagConnector({
      measurementId: page.beacon.tid,
      ctx: {
        clientId: page.beacon.cid,
        sessionId: sessionState.sessionId,
        sessionState,
        consent: { ad_storage: "granted", analytics_storage: "granted" }, // reproduces the fixture's gcs=G111
      },
    });
    const [{ url }] = connector.handle({ type: page.beacon.en, params });
    return Object.fromEntries(new URL(url).searchParams.entries());
  }

  /** Asserts every fixture-declared beacon field matches, except `skip`-listed ones (`gcd` stays a
   *  039-05 gap — this connector does not emit it yet). */
  function assertBeaconMatches(params, expectedBeacon, { skip = [] } = {}) {
    for (const [key, value] of Object.entries(expectedBeacon)) {
      if (skip.includes(key)) continue;
      expect(params[key]).toBe(value);
    }
  }

  it("page 1 — first visit (no existing _ga_<stream>): mints sid=now, sct=1, seg=0, beacon carries _fv/_ss/_nsi — matches the fixture field-for-field", async () => {
    const jar = makeJar();
    const sessionState = await writeGa4SessionState({
      cookies: jar,
      streamCookieName: STREAM_COOKIE,
      now: () => 1700000000 * 1000,
    });
    expect(sessionState).toEqual({ sessionId: "1700000000", sct: "1", seg: "0", _fv: "1", _ss: "1", _nsi: "1" });
    expect(await jar.get(STREAM_COOKIE)).toBe(multipageFixture.pages[0].ga_stream_after);

    const params = await beaconParamsFor(0, sessionState);
    assertBeaconMatches(params, multipageFixture.pages[0].beacon, { skip: ["gcd"] });
  });

  it("page 2 — continuation, same session (<=30min gap): sid+sct REUSED (not a fresh mint), seg flips 0->1, t advances, NO _fv/_ss/_nsi — matches the fixture", async () => {
    const jar = makeJar({ [STREAM_COOKIE]: multipageFixture.pages[1].cookie_before });
    const sessionState = await writeGa4SessionState({
      cookies: jar,
      streamCookieName: STREAM_COOKIE,
      now: () => 1700000300 * 1000,
    });
    expect(sessionState).toEqual({ sessionId: "1700000000", sct: "1", seg: "1" }); // exactly 3 keys — no _fv/_ss/_nsi at all
    expect(sessionState.sessionId).toBe(multipageFixture.pages[0].beacon.sid); // AC3's decisive check: REUSE, not a fresh per-page mint
    expect(await jar.get(STREAM_COOKIE)).toBe(multipageFixture.pages[1].ga_stream_after);

    const params = await beaconParamsFor(1, sessionState);
    assertBeaconMatches(params, multipageFixture.pages[1].beacon, { skip: ["gcd"] });
    expect(params._fv).toBeUndefined();
    expect(params._ss).toBeUndefined();
    expect(params._nsi).toBeUndefined();
  });

  it("page 3 — new session after a >30min inactivity gap: sct increments, FRESH sid (not reused), seg resets to 0, _ss/_nsi set, NO _fv — matches the fixture", async () => {
    const jar = makeJar({ [STREAM_COOKIE]: multipageFixture.pages[2].cookie_before });
    const sessionState = await writeGa4SessionState({
      cookies: jar,
      streamCookieName: STREAM_COOKIE,
      now: () => 1700002400 * 1000,
    });
    expect(sessionState).toEqual({ sessionId: "1700002400", sct: "2", seg: "0", _ss: "1", _nsi: "1" }); // no _fv key
    expect(sessionState.sessionId).not.toBe(multipageFixture.pages[1].beacon.sid); // FRESH sid, never a first-ever visit
    expect(await jar.get(STREAM_COOKIE)).toBe(multipageFixture.pages[2].ga_stream_after);

    const params = await beaconParamsFor(2, sessionState);
    assertBeaconMatches(params, multipageFixture.pages[2].beacon, { skip: ["gcd"] });
    expect(params._fv).toBeUndefined();
  });

  it("consent DENIED — gated on the RAW ADR-0007 analytics_storage vector (core/consent.js's resolveConsent), NEVER the MP-shaped consent object: no _ga_<stream> read or write; per-page sid fallback stays the caller's (sourceGa4Ctx's) job", async () => {
    const jar = makeJar({ [STREAM_COOKIE]: multipageFixture.pages[0].ga_stream_after });
    const getSpy = vi.spyOn(jar, "get");
    const setSpy = vi.spyOn(jar, "set");
    const rawVector = { analytics_storage: "denied" }; // the RAW ADR-0007 vector, resolved via resolveConsent below —
    // NEVER connectors/ga4/consent.js's shaped { ad_user_data, ad_personalization } MP object,
    // which carries no storage-purpose signal to gate on at all (the 039-02 hazard).
    const storageGranted = resolveConsent(rawVector, "analytics_storage") === "granted";
    expect(storageGranted).toBe(false);

    const sessionState = await writeGa4SessionState({
      cookies: jar,
      streamCookieName: STREAM_COOKIE,
      now: () => 1700000000 * 1000,
      storageGranted,
    });
    expect(sessionState).toBeNull();
    expect(getSpy).not.toHaveBeenCalled(); // never even read — mirrors sourceGa4Ctx's own leak-prevention gate
    expect(setSpy).not.toHaveBeenCalled();
  });

  it("sessionTimeoutMinutes is CONFIGURABLE (GA4's session timeout is a per-property Admin setting, not hardcoded) — the SAME 11-min gap classifies differently under a shorter configured timeout", async () => {
    const gapSeconds = 11 * 60; // <= the 30min default, but > a 10min configured timeout
    const now = () => (1700000000 + gapSeconds) * 1000;

    const underDefault = await writeGa4SessionState({
      cookies: makeJar({ [STREAM_COOKIE]: multipageFixture.pages[0].ga_stream_after }),
      streamCookieName: STREAM_COOKIE,
      now,
    });
    expect(underDefault._ss).toBeUndefined(); // 11min <= the 30min default -> continuation
    expect(underDefault.sct).toBe("1");

    const underShortTimeout = await writeGa4SessionState({
      cookies: makeJar({ [STREAM_COOKIE]: multipageFixture.pages[0].ga_stream_after }),
      streamCookieName: STREAM_COOKIE,
      now,
      sessionTimeoutMinutes: 10,
    });
    expect(underShortTimeout._ss).toBe("1"); // the SAME gap -> a new session under the shorter config
    expect(underShortTimeout.sct).toBe("2");
  });

  it("a gap EXACTLY equal to the timeout boundary is a continuation (<=), not a new session", async () => {
    const jar = makeJar({ [STREAM_COOKIE]: multipageFixture.pages[0].ga_stream_after });
    const sessionState = await writeGa4SessionState({
      cookies: jar,
      streamCookieName: STREAM_COOKIE,
      now: () => (1700000000 + 30 * 60) * 1000, // exactly 30 minutes later
    });
    expect(sessionState._ss).toBeUndefined();
    expect(sessionState.sct).toBe("1");
  });

  it("the GS2 opaque j/l/h tail is carried VERBATIM, never authored — a non-default tail from an existing cookie survives the rewrite untouched", async () => {
    const jar = makeJar({ [STREAM_COOKIE]: "GS2.1.s1700000000$o1$g0$t1700000000$j999$l7$h3$xNEW" });
    await writeGa4SessionState({ cookies: jar, streamCookieName: STREAM_COOKIE, now: () => 1700000300 * 1000 });
    expect(await jar.get(STREAM_COOKIE)).toBe("GS2.1.s1700000000$o1$g1$t1700000300$j999$l7$h3$xNEW");
  });

  it("wired into the 038 same-protocol oracle: page 1's session-state fields classify `maps`; gcd (039-05) is the sole remaining owned gap; overall verdict is `pass`", async () => {
    const jar = makeJar();
    const sessionState = await writeGa4SessionState({
      cookies: jar,
      streamCookieName: STREAM_COOKIE,
      now: () => 1700000000 * 1000,
    });
    const airlockFields = await beaconParamsFor(0, sessionState);
    const { verdict, fields } = diffParity({
      descriptor: ga4GtagParityDescriptor,
      containerFields: multipageFixture.pages[0].beacon,
      airlockFields,
    });
    expect(verdict).toBe("pass");
    for (const name of ["sct", "seg", "_fv", "_ss", "_nsi"]) {
      expect(fields.find((f) => f.field === name)).toMatchObject({ bucket: "maps" });
    }
    expect(fields.find((f) => f.field === "gcd")).toMatchObject({ bucket: "expected-dropped", owner: "039-05" });
  });
});
