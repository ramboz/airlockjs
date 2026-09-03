// PixelVendorConfig contract conformance + rejection — spec 026-03
// AC3/AC4/AC5/AC6. `validatePixelVendorConfig` (connectors/pixel/validate.js)
// is the authoring-time guard for contracts/pixel-connector.d.ts's
// PixelVendorConfig shape; this file proves:
//   (a) all THREE shipped vendor configs conform (AC3 — the guard describes
//       the REAL archetype, not a divergent ideal), including LinkedIn's
//       `eventMap: { page_view: null }` string|null proof case;
//   (b) a table of malformed configs is rejected with a SPECIFIC, actionable
//       error naming the offending field (AC4 — the guard is non-vacuous);
//   (c) connector.js (the interpreter) and core/ stay byte-for-byte
//       unchanged — descriptive, not new behavior (AC5);
//   (d) the three vendor configs' stale "deferred to 026-03" forward-refs
//       are corrected to 026-04, the slice the re-decomposition actually
//       moved identity/advanced-matching to (AC6).
//
// All configs under test come from the shipped vendor factories (their own
// SYNTHETIC_* constants) or clearly-fake ad-hoc literals — no live
// identifiers (AC7).
import { describe, it, expect } from "vitest";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { validatePixelVendorConfig } from "../connectors/pixel/validate.js";
import { createMetaPixelConfig } from "../connectors/pixel/vendors/meta.js";
import { createLinkedInInsightConfig } from "../connectors/pixel/vendors/linkedin.js";
import { createBingUetConfig } from "../connectors/pixel/vendors/bing.js";

describe("AC3 — the three shipped configs conform (the guard describes the REAL archetype)", () => {
  const table = [
    { vendor: "meta", config: createMetaPixelConfig() },
    { vendor: "linkedin", config: createLinkedInInsightConfig() }, // eventMap.page_view: null — the string|null proof case
    { vendor: "bing", config: createBingUetConfig() },
  ];

  it.each(table)("$vendor's shipped config validates clean: { valid: true, errors: [] }", ({ config }) => {
    expect(validatePixelVendorConfig(config)).toEqual({ valid: true, errors: [] });
  });

  it("the LinkedIn config really does carry a null eventMap value (the case AC3 asserts against)", () => {
    expect(createLinkedInInsightConfig().eventMap.page_view).toBeNull();
  });
});

describe("AC4 — malformed configs are rejected with a specific, actionable error (table-driven, non-vacuous)", () => {
  const base = () => createMetaPixelConfig();

  const table = [
    { name: "missing endpoint", config: { ...base(), endpoint: undefined }, expectField: "endpoint" },
    { name: "empty-string endpoint", config: { ...base(), endpoint: "" }, expectField: "endpoint" },
    {
      name: "eventMap value that is neither a string nor null",
      config: { ...base(), eventMap: { page_view: 42 } },
      expectField: "eventMap.page_view",
    },
    {
      name: "eventMap that is not an object at all",
      config: { ...base(), eventMap: "PageView" },
      expectField: "eventMap",
    },
    {
      name: 'paramMap entry with an unknown "from"',
      config: { ...base(), paramMap: { id: { from: "ctx", key: "clientId" } } },
      expectField: "paramMap.id",
    },
    {
      name: 'paramMap entry with a missing "from"',
      config: { ...base(), paramMap: { id: { value: "x" } } },
      expectField: "paramMap.id",
    },
    {
      name: 'paramMap entry with from:"static" but no "value"',
      config: { ...base(), paramMap: { id: { from: "static" } } },
      expectField: "paramMap.id",
    },
    {
      // 026-03 review hardening: a non-string|number static value passes a
      // presence-only check yet String()s to "[object Object]" in a live URL.
      name: 'paramMap entry with from:"static" and a non-string|number value',
      config: { ...base(), paramMap: { id: { from: "static", value: {} } } },
      expectField: "paramMap.id",
    },
    {
      name: 'paramMap entry with from:"params" but no "key"',
      config: { ...base(), paramMap: { id: { from: "params" } } },
      expectField: "paramMap.id",
    },
    {
      name: "paramMap that is not an object at all",
      config: { ...base(), paramMap: null },
      expectField: "paramMap",
    },
    {
      name: "egressPurposes that is not an array",
      config: { ...base(), egressPurposes: "ad_storage" },
      expectField: "egressPurposes",
    },
    { name: "the config itself is not an object", config: null, expectField: "config" },
  ];

  it.each(table)("$name -> valid:false, an error naming the offending field", ({ config, expectField }) => {
    const result = validatePixelVendorConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some((e) => e.includes(expectField))).toBe(true);
  });

  it("a well-formed config is the positive control the table above contrasts against — zero errors", () => {
    expect(validatePixelVendorConfig(createMetaPixelConfig())).toEqual({ valid: true, errors: [] });
  });
});

describe("AC5 — descriptive, not new behavior: connector.js + core/ stay byte-for-byte unchanged", () => {
  it("ENUMERABLE — `git diff -- connectors/pixel/connector.js` is empty", () => {
    const diff = execSync("git diff -- connectors/pixel/connector.js", { encoding: "utf8", cwd: process.cwd() });
    expect(diff.trim()).toBe("");
  });

  it("ENUMERABLE — `git diff -- core/` is empty", () => {
    const diff = execSync("git diff -- core/", { encoding: "utf8", cwd: process.cwd() });
    expect(diff.trim()).toBe("");
  });
});

describe("AC6 — the 3 vendor configs' stale 'deferred to 026-03' forward-refs are corrected to 026-04", () => {
  it.each(["meta.js", "linkedin.js", "bing.js"])(
    "connectors/pixel/vendors/%s no longer forward-refs 026-03 for the identity/advanced-matching deferral",
    (file) => {
      const src = readFileSync(new URL(`../connectors/pixel/vendors/${file}`, import.meta.url), "utf8");
      expect(src).not.toContain("026-03");
      expect(src).toContain("026-04");
    },
  );
});
