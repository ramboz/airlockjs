import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compareMetaPageViewPrototype } from "../rig/meta-pageview-prototype-report.mjs";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/meta-tr-pageview.redacted.json", import.meta.url), "utf8"));
const request = (query = {}) => {
  const params = new URLSearchParams({
    id: "000000000000000", ev: "PageView", dl: "https://erp.intuit.com/", rl: "",
    if: "false", sw: "412", sh: "823", tz: "-420", ...query,
  });
  return { method: "GET", url: `http://127.0.0.1:43210/tr/?${params}` };
};
const byName = (report, name) => report.fields.find((field) => field.name === name);

describe("full union of limited historical fixture and actual generated query", () => {
  it("lists every non-annotation field, redactions and structured evidence without leaking values or claiming parity", () => {
    const report = compareMetaPageViewPrototype({ generatedRequest: request(), fixture });
    const annotations = ["_variant", "_id_note", "_cd_note", "_ud_note", "_fbp_note", "_experiments_note", "_dl_note"];
    expect(report.fields.map((field) => field.name).sort()).toEqual(
      Object.keys(fixture.beacons[0]).filter((key) => !annotations.includes(key)).sort(),
    );
    expect(byName(report, "dl").disposition).toBe("literal-match");
    expect(byName(report, "id").disposition).toBe("redacted-unverifiable");
    expect(byName(report, "fbp")).toMatchObject({
      disposition: "missing-generated", reference: { state: "redacted", type: "string" },
    });
    expect(byName(report, "client_hints")).toMatchObject({
      disposition: "missing-generated", reference: {
        state: "structured", type: "object",
        members: [
          { name: "chmd", state: "redacted", type: "string" },
          { name: "chpv", state: "redacted", type: "string" },
          { name: "chfv", state: "redacted", type: "string" },
        ],
      },
    });
    expect(report).toMatchObject({
      overall: "inconclusive", fullCompatibility: false,
      transport: { endpoint: "different", method: "literal-match" },
    });
    expect(report.gaps).toContainEqual({ name: "omitted-experiment-flags", state: "unavailable", count: 38 });
    for (const value of ["erp.intuit.com", "127.0.0.1", "000000000000000", "REDACTED_FBP", "REDACTED_SHA256"]) {
      expect(JSON.stringify(report)).not.toContain(value);
    }
  });

  it("exposes changed, missing, extra, multimap, array, typed and unavailable states without renaming fbp", () => {
    const expanded = structuredClone(fixture);
    Object.assign(expanded.beacons[0], {
      _unrecognized: "real-field", arrayField: ["one", "two"], numberField: 1,
      missingValue: null, redactionField: "REDACTED_TOKEN",
    });
    const generatedRequest = request({ dl: "https://example.test/changed", _fbp: "REDACTED_FBP", numberField: "1", redactionField: "REDACTED_TOKEN" });
    const url = new URL(generatedRequest.url);
    url.searchParams.delete("sw");
    url.searchParams.append("ev", "SecondOccurrence");
    url.searchParams.append("arrayField", "one");
    url.searchParams.append("arrayField", "two");
    generatedRequest.url = url.href;
    const report = compareMetaPageViewPrototype({ generatedRequest, fixture: expanded });
    expect(byName(report, "dl").disposition).toBe("different");
    expect(byName(report, "sw").disposition).toBe("missing-generated");
    expect(byName(report, "_fbp").disposition).toBe("extra-generated");
    expect(byName(report, "fbp").disposition).toBe("missing-generated");
    expect(byName(report, "_unrecognized").disposition).toBe("missing-generated");
    expect(byName(report, "ev")).toMatchObject({
      disposition: "representation-different", generated: { state: "multimap", count: 2 },
    });
    expect(byName(report, "arrayField")).toMatchObject({
      disposition: "representation-different",
      generated: { state: "multimap", count: 2 },
      reference: { state: "structured", type: "array", count: 2 },
    });
    expect(byName(report, "numberField").disposition).toBe("type-different");
    expect(byName(report, "missingValue").reference.state).toBe("unavailable");
    expect(byName(report, "redactionField").disposition).toBe("redacted-unverifiable");
    expect(report.fullCompatibility).toBe(false);
    expect(JSON.stringify(report)).not.toContain("SecondOccurrence");
  });

  it("does not turn absent generated traffic or the sparse second beacon into a complete reference", () => {
    const missing = compareMetaPageViewPrototype({ fixture });
    expect(missing.generatedRequest).toBe("unavailable");
    expect(missing.fields.every((field) => field.disposition === "missing-generated")).toBe(true);
    const report = compareMetaPageViewPrototype({ fixture, beaconIndex: 1, generatedRequest: request() });
    expect(byName(report, "dl").disposition).toBe("different");
    expect(byName(report, "sw").disposition).toBe("extra-generated");
    expect(report.fields.map((field) => field.name)).toContain("aud[external_id]");
    expect(report.overall).toBe("inconclusive");
  });
});
