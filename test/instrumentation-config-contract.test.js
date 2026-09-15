// The config contract — spec 032-02. AC1 (the pinned pre-1.0 JSON Schema + its
// golden/negative fixtures) is exercised by the contracts dev harness (`npm run
// validate`); this file owns the RUNTIME-side criteria:
//
//   AC2 — boot(config) validates at runtime, loud + actionable (unknown type/vendor,
//         missing required id, wrong-typed field), a hand-rolled SUBSET of the schema;
//         and NO ajv (a contracts/ dev-dep) reaches the emitted dist bundle.
//   AC3 — breadth: the golden multi-connector config (ga4 + pixel + helix-rum) validates
//         AND boots; alloy stays deferred (no {type:"alloy"} path).
//   AC4 — the README "Configure airlock" example validates against the pinned schema (no
//         drift) and its boot snippet matches boot(config)'s actual signature.
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from "vitest";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import { boot } from "../adapters/eds/index.js";
import { buildAirlock, ENTRY_OUT, WORKER_ENTRIES } from "../build.mjs";

const REPO = fileURLToPath(new URL("..", import.meta.url));
const CONTRACTS = join(REPO, "contracts");
const loadJson = (p) => JSON.parse(readFileSync(p, "utf8"));

// ajv here is a TEST dependency (root devDep) — it validates the README example against
// the pinned schema. It is NOT in the shipped bundle (the no-ajv-in-dist test below proves it).
const schema = loadJson(join(CONTRACTS, "instrumentation-config.schema.json"));
const validateSchema = new Ajv2020({ allErrors: true, strict: false }).compile(schema);

// --- the FakeWorker harness (mirrors test/eds-boot-config.test.js) ---
class FakeWorker {
  constructor(url, opts) {
    FakeWorker.instances.push(this);
    this.url = String(url);
    this.opts = opts;
    this.messages = [];
    this.onmessage = null;
    this.onerror = null;
    this.terminated = 0;
  }
  postMessage(m) { this.messages.push(m); }
  terminate() { this.terminated++; }
}
FakeWorker.instances = [];

const ga4Worker = () => FakeWorker.instances.find((w) => w.url.endsWith("/chamber.worker.js"));
const pixelWorker = () => FakeWorker.instances.find((w) => w.url.includes("pixel-chamber.worker.js"));
const helixWorker = () => FakeWorker.instances.find((w) => w.url.includes("helix-rum-chamber.worker.js"));

const gaCtx = { clientId: "1.1", sessionId: "2" }; // provided -> skips cookie sourcing (no document needed)
function stubWebVitals() {
  const cbs = {};
  return { onLCP: (cb) => { cbs.lcp = cb; }, onCLS: (cb) => { cbs.cls = cb; }, onINP: (cb) => { cbs.inp = cb; }, cbs };
}

function stubBrowser() {
  FakeWorker.instances = [];
  vi.stubGlobal("Worker", FakeWorker);
  vi.stubGlobal("fetch", vi.fn(() => Promise.resolve()));
  vi.stubGlobal("requestIdleCallback", (cb) => { cb({ didTimeout: false, timeRemaining: () => 0 }); return 1; });
  vi.stubGlobal("addEventListener", () => {});
  vi.stubGlobal("removeEventListener", () => {});
  vi.stubGlobal("window", {});
}

describe("AC2 — boot(config) rejects a malformed config, loud + actionable", () => {
  beforeEach(stubBrowser);
  afterEach(() => vi.unstubAllGlobals());

  it("unknown connector type: rejects naming the offending connector + type", async () => {
    await expect(boot({ connectors: [{ type: "tiktok" }] }))
      .rejects.toThrow(/connectors\[0\].*unknown connector type "tiktok"/);
  });

  it("unknown pixel vendor: rejects naming the vendor + the expected set", async () => {
    await expect(boot({ connectors: [{ type: "pixel", vendor: "snapchat", pixelId: "x" }] }))
      .rejects.toThrow(/connectors\[0\].*unknown .*vendor "snapchat".*meta.*linkedin.*bing/);
  });

  it("missing required id (pixel/meta): rejects naming pixelId", async () => {
    await expect(boot({ connectors: [{ type: "pixel", vendor: "meta" }] }))
      .rejects.toThrow(/connectors\[0\].*missing required.*"pixelId"/);
  });

  it("missing required id (pixel/linkedin): rejects naming partnerId", async () => {
    await expect(boot({ connectors: [{ type: "pixel", vendor: "linkedin" }] }))
      .rejects.toThrow(/partnerId/);
  });

  it("missing required id (pixel/bing): rejects naming tagId", async () => {
    await expect(boot({ connectors: [{ type: "pixel", vendor: "bing" }] }))
      .rejects.toThrow(/tagId/);
  });

  // Spec 041-04 AC1: a well-formed ga4-gtag entry is a NEW acceptance; a malformed one
  // (missing its required measurementId, or an unknown type) is rejected loud + actionable,
  // exactly like the other connector types.
  it("non-string measurementId (ga4-gtag): the runtime guard rejects a number, not only an absent field", async () => {
    // The `typeof entry.measurementId !== "string"` branch of validateConnectorEntry
    // (distinct from the missing-field case below) — a mistyped tid is rejected loud.
    await expect(boot({ connectors: [{ type: "ga4-gtag", ctx: gaCtx, measurementId: 12345 }] }))
      .rejects.toThrow(/connectors\[0\].*missing required.*"measurementId"/);
  });

  it("missing required id (ga4-gtag): rejects naming measurementId", async () => {
    await expect(boot({ connectors: [{ type: "ga4-gtag", ctx: gaCtx }] }))
      .rejects.toThrow(/connectors\[0\].*missing required.*"measurementId"/);
  });

  it("a well-formed ga4-gtag entry does NOT throw (the validator is not over-eager)", async () => {
    await expect(boot({ connectors: [{ type: "ga4-gtag", ctx: gaCtx, measurementId: "G-XXXX" }] })).resolves.toBeTruthy();
  });

  it("wrong-typed top-level field (consentStrict must be boolean): rejects naming it", async () => {
    await expect(boot({ connectors: [{ type: "ga4", ctx: gaCtx }], consentStrict: "yes" }))
      .rejects.toThrow(/consentStrict.*boolean/);
  });

  it("wrong-typed connectors (not an array): rejects before iterating it", async () => {
    await expect(boot({ connectors: { type: "ga4" } }))
      .rejects.toThrow(/connectors.*array/);
  });

  it("wrong-typed payloadDenylist (not an array): rejects naming it", async () => {
    await expect(boot({ connectors: [{ type: "ga4", ctx: gaCtx }], payloadDenylist: "email" }))
      .rejects.toThrow(/payloadDenylist.*array/);
  });

  // Spec 048-03 fix round (arch + compliance nit): `onetrust` was the ONE top-level
  // governance field with no shape check at all — unlike consent/consentStrict/
  // payloadDenylist above, a malformed config.onetrust spread straight into
  // `resolveOnetrustBootConsent` inside `boot()` with no loud rejection here.
  it("wrong-typed onetrust (a string, not an object): rejects naming it", async () => {
    await expect(boot({ connectors: [{ type: "ga4", ctx: gaCtx }], onetrust: "yes" }))
      .rejects.toThrow(/onetrust.*object/);
  });

  it("onetrust missing groupPurposeMap (an empty object): rejects naming groupPurposeMap", async () => {
    await expect(boot({ connectors: [{ type: "ga4", ctx: gaCtx }], onetrust: {} }))
      .rejects.toThrow(/onetrust\.groupPurposeMap.*object/);
  });

  it("onetrust.groupPurposeMap wrong-typed (an array, not an object): rejects naming it", async () => {
    await expect(boot({ connectors: [{ type: "ga4", ctx: gaCtx }], onetrust: { groupPurposeMap: [] } }))
      .rejects.toThrow(/onetrust\.groupPurposeMap.*object/);
  });

  // Governance-field cross-check made two-sided (refinement-todo § Spec 048-03): the runtime now OWNS
  // its top-level config-field enumeration and rejects any unknown key loud + actionable (matching the
  // pinned schema's `additionalProperties: false`), surfacing the closed set so a typo'd key or a
  // misplaced `opts`-arg field is caught, not silently ignored.
  it("unknown top-level config field (a typo like `connetcors`): rejects, naming the expected set", async () => {
    await expect(boot({ connetcors: [{ type: "ga4", ctx: gaCtx }] }))
      .rejects.toThrow(/unknown config field "connetcors".*expected one of:.*connectors/);
  });

  it("a valid single-connector config does NOT throw (the validator is not over-eager)", async () => {
    await expect(boot({ connectors: [{ type: "ga4", ctx: gaCtx }] })).resolves.toBeTruthy();
  });

  it("a malformed LATER connector still tears down the already-booted earlier one (no orphan, no window install)", async () => {
    await expect(boot({ connectors: [{ type: "ga4", ctx: gaCtx }, { type: "pixel", vendor: "meta" }] }))
      .rejects.toThrow(/connectors\[1\].*pixelId/);
    expect(ga4Worker().terminated).toBe(1); // earlier GA4 disposed on the reject path
    expect(typeof window.airlock).toBe("undefined"); // no broken composite installed
  });
});

describe("AC2 — no ajv (a contracts/ dev-dep) reaches the shipped bundle", () => {
  let distDir;
  beforeAll(async () => {
    distDir = mkdtempSync(join(tmpdir(), "airlock-032-noajv-"));
    await buildAirlock({ outdir: distDir });
  }, 60000);
  afterAll(() => rmSync(distDir, { recursive: true, force: true }));

  it("the emitted eds.js and every worker chunk contain no ajv import/reference", () => {
    const emittedBasenames = [`${ENTRY_OUT}.js`, ...WORKER_ENTRIES.map((p) => p.replace(/^core\//, ""))];
    for (const basename of emittedBasenames) {
      const chunk = readFileSync(join(distDir, basename), "utf8");
      expect(chunk, `${basename} must not bundle ajv`).not.toMatch(/ajv/i);
    }
  });
});

describe("AC3 — the golden multi-connector config (ga4 + pixel + helix-rum) validates AND boots", () => {
  beforeEach(stubBrowser);
  afterEach(() => vi.unstubAllGlobals());

  const golden = loadJson(join(CONTRACTS, "fixtures/instrumentation-config-multi.golden.json"));

  it("the pristine golden fixture validates against the pinned schema", () => {
    expect(validateSchema(golden)).toBe(true);
  });

  it("does NOT declare an alloy connector (alloy is deferred, not covered)", () => {
    expect(golden.connectors.some((c) => c.type === "alloy")).toBe(false);
    expect(golden.connectors.map((c) => c.type)).toEqual(["ga4", "pixel", "helix-rum"]);
  });

  it("boots every declared connector (one worker each) and installs the composite", async () => {
    // The fixture is pure production JSON; helix-rum needs non-serializable DI seams
    // (web-vitals subscribers) + deterministic sampling, and ga4 needs a pre-sourced
    // ctx to skip cookie I/O — the seams a browser would otherwise provide. Injected
    // here exactly as test/eds-boot-config.test.js does; the fixture stays untouched.
    const config = {
      ...golden,
      connectors: golden.connectors.map((c) => {
        if (c.type === "helix-rum") return { ...c, forceSelect: true, ...stubWebVitals() };
        if (c.type === "ga4") return { ...c, ctx: gaCtx };
        return c;
      }),
    };

    const handle = await boot(config);

    expect(ga4Worker()).toBeTruthy();
    expect(pixelWorker()).toBeTruthy();
    expect(helixWorker()).toBeTruthy();
    expect(handle).toBe(window.airlock);
  });
});

describe("033-02 AC5 — the {type:'alloy'} config branch (analytics vertical, ADR-0016)", () => {
  const alloyGolden = loadJson(join(CONTRACTS, "fixtures/instrumentation-config-alloy.golden.json"));
  const alloyMissingBundle = loadJson(join(CONTRACTS, "fixtures/instrumentation-config-alloy-missing-bundleUrl.negative.json"));
  const alloyMissingDatastream = loadJson(join(CONTRACTS, "fixtures/instrumentation-config-alloy-missing-datastream.negative.json"));

  it("the alloy golden fixture validates against the pinned schema (alloy is now a member)", () => {
    const ok = validateSchema(alloyGolden);
    if (!ok) console.error(validateSchema.errors);
    expect(ok).toBe(true);
  });

  it("declares { type: 'alloy' } with a bundleUrl — the analytics vertical", () => {
    const alloy = alloyGolden.connectors.find((c) => c.type === "alloy");
    expect(alloy).toBeTruthy();
    expect(typeof alloy.bundleUrl).toBe("string");
    expect(alloy.bundleUrl.length).toBeGreaterThan(0);
  });

  it("an alloy entry MISSING bundleUrl is REJECTED (the ADR-0016 adopter-supplied prerequisite bites)", () => {
    expect(validateSchema(alloyMissingBundle)).toBe(false);
  });

  it("an alloy entry MISSING a datastream id is REJECTED (the config-integrity tenant pin needs it — 015/ADR-0011)", () => {
    expect(validateSchema(alloyMissingDatastream)).toBe(false);
  });
});

// Spec 041-04 AC1 — the JSON Schema gains a "ga4-gtag" type const + config shape
// (measurementId REQUIRED; streamCookieName/consentDefault/endpoint optional), mirroring
// the "ga4" entry's shape. The schema-contract's existing describes above (AC2/AC3) still
// pass unchanged with the new type const added to the discriminated union.
describe("041-04 AC1 — the schema gains a 'ga4-gtag' type const + config shape", () => {
  it("a well-formed ga4-gtag entry (measurementId only) validates", () => {
    const config = { connectors: [{ type: "ga4-gtag", measurementId: "G-XXXX" }] };
    const ok = validateSchema(config);
    if (!ok) console.error(validateSchema.errors);
    expect(ok).toBe(true);
  });

  it("a ga4-gtag entry with the full optional field set (streamCookieName/consentDefault/endpoint) validates", () => {
    const config = {
      connectors: [
        {
          type: "ga4-gtag",
          measurementId: "G-XXXX",
          streamCookieName: "G-XXXX",
          consentDefault: { analytics_storage: "denied" },
          endpoint: "https://example.com/g/collect",
        },
      ],
    };
    const ok = validateSchema(config);
    if (!ok) console.error(validateSchema.errors);
    expect(ok).toBe(true);
  });

  it("a ga4-gtag entry MISSING measurementId is REJECTED by the schema", () => {
    expect(validateSchema({ connectors: [{ type: "ga4-gtag" }] })).toBe(false);
  });

  it("an unknown connector type is still rejected by the schema (the discriminated union is closed)", () => {
    expect(validateSchema({ connectors: [{ type: "tiktok" }] })).toBe(false);
  });
});

// Spec 048-01 AC3 (fix round, 2026-09-14) — the JSON Schema gains a "google-ads" type const
// + config shape (conversionId REQUIRED; consentDefault/endpoint/ctx optional), mirroring
// 041-04's "ga4-gtag" precedent above. Before this fix, the runtime `KNOWN_CONNECTOR_TYPES`
// accepted `{type:"google-ads", conversionId}` (adapters/eds/index.js's `validateConnectorEntry`)
// but the pinned schema's discriminated union did NOT — inverting the documented invariant
// ("the validator is a documented SUBSET of the JSON Schema; the schema stays the fuller
// pinned reference", adapters/eds/index.js's `validateConnectorEntry` doc comment) by REJECTING
// a config entry the runtime happily boots.
describe("048-01 AC3 — the schema gains a 'google-ads' type const + config shape", () => {
  it("a well-formed google-ads entry (conversionId only) validates", () => {
    const config = { connectors: [{ type: "google-ads", conversionId: "AW-1234567890" }] };
    const ok = validateSchema(config);
    if (!ok) console.error(validateSchema.errors);
    expect(ok).toBe(true);
  });

  it("a google-ads entry with the full optional field set (consentDefault/endpoint/ctx) validates", () => {
    const config = {
      connectors: [
        {
          type: "google-ads",
          conversionId: "AW-1234567890",
          consentDefault: { ad_storage: "denied" },
          endpoint: "https://example.com/ccm/collect",
          ctx: { auid: "1.1" },
        },
      ],
    };
    const ok = validateSchema(config);
    if (!ok) console.error(validateSchema.errors);
    expect(ok).toBe(true);
  });

  it("a google-ads entry MISSING conversionId is REJECTED by the schema", () => {
    expect(validateSchema({ connectors: [{ type: "google-ads" }] })).toBe(false);
  });
});

// Spec 048-02 AC3 — the JSON Schema gains a "floodlight" type const + config shape (conversionId
// REQUIRED; src/activityType/cat/consentDefault/endpoint/activityEndpoint/ctx optional), mirroring
// 048-01's "google-ads" precedent above — added in the SAME implementation pass this time (not a
// later fix round), so the cross-check below (which already covers 048-01's drift shape) holds for
// floodlight too from the start.
describe("048-02 AC3 — the schema gains a 'floodlight' type const + config shape", () => {
  it("a well-formed floodlight entry (conversionId only, no activity identity) validates — byte-identical shape to 046-01", () => {
    const config = { connectors: [{ type: "floodlight", conversionId: "DC-1234567890" }] };
    const ok = validateSchema(config);
    if (!ok) console.error(validateSchema.errors);
    expect(ok).toBe(true);
  });

  it("a floodlight entry with the full optional field set (src/activityType/cat/consentDefault/endpoint/activityEndpoint/ctx) validates", () => {
    const config = {
      connectors: [
        {
          type: "floodlight",
          conversionId: "DC-1234567890",
          src: "1234567",
          activityType: "grptag00",
          cat: "acttag00",
          consentDefault: { ad_storage: "denied" },
          endpoint: "https://example.com/ccm/collect",
          activityEndpoint: "https://example.com/activity",
          ctx: { auid: "1.1" },
        },
      ],
    };
    const ok = validateSchema(config);
    if (!ok) console.error(validateSchema.errors);
    expect(ok).toBe(true);
  });

  it("a floodlight entry MISSING conversionId is REJECTED by the schema", () => {
    expect(validateSchema({ connectors: [{ type: "floodlight" }] })).toBe(false);
  });

  it("a floodlight entry misspelling the activity tag field (e.g. `activityTag` instead of `activityType`) is REJECTED — additionalProperties:false catches it", () => {
    // Guards the 048-02 AC3 rename itself: `type` is reserved as this entry's own connector-kind
    // discriminant (`"floodlight"`), so the Floodlight-native activity tag MUST ride under a
    // DIFFERENT field name (`activityType`) — this proves the schema actually enforces that exact
    // name, not just any name, by rejecting a plausible near-miss.
    expect(validateSchema({ connectors: [{ type: "floodlight", conversionId: "DC-1", activityTag: "grptag00" }] })).toBe(false);
  });
});

// Spec 048-03 fix round (arch BLOCKER, 2026-09-14): the schema was top-level
// `additionalProperties:false` listing only {connectors,consent,consentStrict,payloadDenylist} —
// so it REJECTED a `{connectors, onetrust:{groupPurposeMap,…}}` config that `boot()` already
// ACCEPTS and consumes (adapters/eds/index.js's `boot()`/`validateConfig`), inverting the
// documented "schema is the fuller pinned reference" invariant. Adds a top-level "onetrust"
// property (`$defs/onetrustConfig`) describing the PRODUCTION-facing shape only
// ({groupPurposeMap REQUIRED, activeGroups? optional}) — `resolveOnetrustBootConsent`'s
// `win`/`onetrust` sub-fields are test-only DI seams (the live global + injected reader), so they
// are deliberately NOT pinned here (a real declarative JSON config never carries them).
describe("048-03 fix round — the schema gains a top-level 'onetrust' governance field", () => {
  it("a well-formed { groupPurposeMap, activeGroups } config.onetrust validates", () => {
    const config = {
      connectors: [{ type: "google-ads", conversionId: "AW-1234567890" }],
      onetrust: { groupPurposeMap: { 4: ["ad_storage", "analytics_storage"] }, activeGroups: ",1,4," },
    };
    const ok = validateSchema(config);
    if (!ok) console.error(validateSchema.errors);
    expect(ok).toBe(true);
  });

  it("config.onetrust with ONLY the required groupPurposeMap (activeGroups omitted) validates", () => {
    const config = {
      connectors: [{ type: "google-ads", conversionId: "AW-1234567890" }],
      onetrust: { groupPurposeMap: { 4: ["ad_storage"] } },
    };
    expect(validateSchema(config)).toBe(true);
  });

  it("config.onetrust missing groupPurposeMap is REJECTED by the schema", () => {
    const config = { connectors: [{ type: "google-ads", conversionId: "AW-1234567890" }], onetrust: {} };
    expect(validateSchema(config)).toBe(false);
  });

  it("an absent config.onetrust still validates (back-compat — the field stays optional)", () => {
    const config = { connectors: [{ type: "google-ads", conversionId: "AW-1234567890" }] };
    expect(validateSchema(config)).toBe(true);
  });
});

// CROSS-CHECK (fix round, 2026-09-14): the runtime `KNOWN_CONNECTOR_TYPES` set (adapters/
// eds/index.js — not exported, so read off the "unknown connector type" error's own "expected
// one of: ..." list, the SAME signal the AC2 "unknown connector type" test above asserts
// against) must equal the set of connector `type` consts the schema's discriminated union
// enumerates. This is exactly the drift BLOCKER 2 found (the schema silently lagged the
// runtime for "google-ads") — this test pins the two sets together so a FUTURE connector
// addition (048-02 floodlight, etc.) cannot silently widen one without the other.
describe("048-01 CROSS-CHECK — runtime KNOWN_CONNECTOR_TYPES == schema's enumerated connector type consts", () => {
  it("the two sets are identical", async () => {
    let thrown;
    try {
      await boot({ connectors: [{ type: "__cross_check_sentinel__" }] });
    } catch (e) {
      thrown = e;
    }
    expect(thrown, "boot() must reject an unknown connector type").toBeTruthy();
    const match = thrown.message.match(/expected one of: (.+)$/);
    expect(match, "the unknown-type error names the expected set").toBeTruthy();
    const runtimeTypes = new Set(match[1].split(",").map((s) => s.trim()));

    const refs = schema.$defs.connector.oneOf.map((r) => r.$ref.replace("#/$defs/", ""));
    const schemaTypes = new Set(refs.map((name) => schema.$defs[name].properties.type.const));

    expect(schemaTypes).toEqual(runtimeTypes);
  });
});

// CROSS-CHECK (048-03 fix round → made TWO-SIDED, refinement-todo § Spec 048-03): the CONNECTOR-TYPE
// cross-check above cannot catch a TOP-LEVEL governance-field drift (the "onetrust" gap the 048-03 fix
// round closed — the schema silently lagged `boot()`'s own top-level destructure). This SIBLING pins the
// schema's top-level `properties` against the runtime's OWN enumeration of the fields `boot()` reads —
// surfaced (exactly like `KNOWN_CONNECTOR_TYPES`) off the "unknown config field … expected one of: …"
// error `validateConfig` throws for an unknown top-level key. The original 048-03 guard compared the
// schema against a hand-maintained TEST-LOCAL list, so a field added to `boot()` but omitted from that
// list wouldn't self-detect (the "one-sided" residual). Now the set comes from the runtime itself, so
// it is TWO-SIDED, matching the connector-type cross-check: a field added to `boot()`'s destructure +
// the runtime const but forgotten in the schema goes red, AND a schema property with no runtime field
// goes red too.
describe("048-03 CROSS-CHECK (two-sided) — schema top-level properties == the config fields boot() reads", () => {
  it("the runtime's own top-level field set (off validateConfig's error) equals the schema's top-level properties", async () => {
    let thrown;
    try {
      await boot({ __cross_check_sentinel_field__: 1 });
    } catch (e) {
      thrown = e;
    }
    expect(thrown, "boot() must reject an unknown top-level config field").toBeTruthy();
    const match = thrown.message.match(/expected one of: (.+)$/);
    expect(match, "the unknown-field error names the expected set").toBeTruthy();
    const runtimeFields = new Set(match[1].split(",").map((s) => s.trim()));

    const schemaFields = new Set(Object.keys(schema.properties));

    expect(schemaFields).toEqual(runtimeFields);
  });
});

describe("AC4 — the README 'Configure airlock' story is drift-free + matches boot()'s signature", () => {
  const readme = readFileSync(join(REPO, "README.md"), "utf8");
  const sectionOf = (heading) => {
    const after = readme.split(new RegExp(`##\\s+${heading}`, "i"))[1] || "";
    // scope to just this section: stop at the next `## ` heading
    return after.split(/\n##\s/)[0];
  };
  const section = sectionOf("Configure airlock");

  it("has a 'Configure airlock' section", () => {
    expect(section.length).toBeGreaterThan(0);
  });

  it("its JSON config example validates against the pinned schema (no drift)", () => {
    const m = section.match(/```json\n([\s\S]*?)```/);
    expect(m, "a ```json config block under 'Configure airlock'").toBeTruthy();
    const config = JSON.parse(m[1]);
    const ok = validateSchema(config);
    if (!ok) console.error(validateSchema.errors);
    expect(ok).toBe(true);
  });

  it("shows the two boot lines matching boot(config)'s signature", () => {
    expect(section).toMatch(/import\s*\{\s*boot\s*\}/);
    expect(section).toMatch(/boot\(\s*config\s*\)/);
  });

  it("boot is actually exported from the adapter (so the snippet's import resolves)", async () => {
    const mod = await import("../adapters/eds/index.js");
    expect(typeof mod.boot).toBe("function");
  });

  it("states the pre-1.0 caveat AND the alloy coverage gap, pointing at the schema", () => {
    expect(section).toMatch(/pre-1\.0|not frozen/i);
    expect(section).toMatch(/alloy/i);
    expect(section).toMatch(/instrumentation-config\.schema\.json/);
  });
});
