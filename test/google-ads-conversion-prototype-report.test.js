import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { reportGoogleAdsConversionPrototype } from "../rig/google-ads-conversion-prototype-report.mjs";

const projection = JSON.parse(await readFile(new URL("./fixtures/google-ads-conversion-native-shape.json", import.meta.url), "utf8"));
const endpoint = "http://127.0.0.1:43210/pagead/conversion/0000000000/";
const snapshot = {
  args: ["event", "conversion", { send_to: "AW-0000000000/SYNTHETIC_LABEL", value: 26.5, currency: "EUR", transaction_id: "report-synthetic-26" }],
  context: { pageURL: "https://example.test/report-only", referrer: "" },
};
const request = {
  method: "GET",
  url: `${endpoint}?label=SYNTHETIC_LABEL&value=26.5&currency_code=EUR&oid=report-synthetic-26&url=https%3A%2F%2Fexample.test%2Freport-only`,
};

describe("synthetic relationships versus partial retained native field shape", () => {
  it("covers every row, ordered field occurrence, duplicate and limitation without promoting five fields to native parity", () => {
    const report = reportGoogleAdsConversionPrototype({ observedRequests: [request], commandSnapshots: [snapshot], endpoint, projection });
    expect(report).toMatchObject({ overall: "INCONCLUSIVE", fullCompatibility: false });
    expect(report.local[0]).toMatchObject({ routingPreserved: true, relationshipsPreserved: true, uniqueQueryNames: true, onlyExpectedFields: true });
    expect(report.nativeShape).toMatchObject({ disposition: "partial-retained-native-shape-only", rowCount: 12, uniqueFieldCount: 62, nativeValueEquality: "unavailable", nativeEndpointEquality: "unavailable" });
    expect(report.nativeShape.rows.map((row) => row.ordinal)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    for (const [index, row] of report.nativeShape.rows.entries()) {
      expect(row.queryNamesInOrder).toEqual(projection.request_rows[index].query_names_in_order);
      expect(row.pairCount).toBe(projection.request_rows[index].query_pair_count);
      expect(row.guardBlocked).toBe(projection.request_rows[index].guard_blocked);
      expect(row.responseObserved).toBe(projection.request_rows[index].response_observed);
    }
    expect(report.nativeShape.rows[9].duplicateFields).toEqual([{ field: "random", occurrences: 2 }]);
    expect(report.nativeShape.rows[10]).toMatchObject({ pairCount: 39, mappedFieldNameCount: 5, missingFieldNameCount: 34 });
    expect(report.nativeShape.rows[11]).toMatchObject({ pairCount: 44, responseObserved: false, responseLinked: true, transactionFieldPresent: false, disposition: "not-implemented" });
    expect(report.nativeShape.fields.map((field) => field.name)).toEqual(projection.unique_query_names);
    expect(report.gaps).toContain("identity-cookies-click-ids");
    expect(report.gaps).toContain("response-linked-fetch-fallback-redirect-cookie");
    expect(JSON.stringify(report)).not.toContain("report-synthetic-26");
    expect(JSON.stringify(report)).not.toContain("https://example.test");
    expect(JSON.stringify(report)).not.toContain("127.0.0.1");
  });

  it("fails local relationships on route/value/type/duplicate/extra-field mutations instead of normalizing them away", () => {
    for (const changed of [
      { ...request, method: "POST" },
      { ...request, url: request.url.replace("/0000000000/", "/123/") },
      { ...request, url: request.url.replace("value=26.5", "value=26") },
      { ...request, url: request.url.replace("currency_code=EUR", "currency_code=USD") },
      { ...request, url: request.url.replace("oid=report-synthetic-26", "oid=wrong-transaction") },
      { ...request, url: request.url.replace("report-only", "wrong-page") },
      { ...request, url: `${request.url}&value=26.5` },
      { ...request, url: `${request.url}&extra=private-data-never-output` },
    ]) {
      const report = reportGoogleAdsConversionPrototype({ observedRequests: [changed], commandSnapshots: [snapshot], endpoint, projection });
      expect(report.local[0].relationshipsPreserved).toBe(false);
      expect(report.overall).toBe("INCONCLUSIVE");
      expect(JSON.stringify(report)).not.toContain("private-data-never-output");
    }
    const typed = structuredClone(snapshot);
    typed.args[2].value = "26.5";
    expect(reportGoogleAdsConversionPrototype({ observedRequests: [request], commandSnapshots: [typed], endpoint }).local[0].relationshipsPreserved).toBe(false);
    expect(reportGoogleAdsConversionPrototype({ observedRequests: [request], commandSnapshots: [], endpoint }).cardinalityPreserved).toBe(false);
  });

  it("makes omission, explicit undefined, empty and zero visible as different synthetic expectations", () => {
    for (const [params, query, expectation] of [
      [{ value: 0, currency: "", transaction_id: "" }, "&value=0&currency_code=&oid=", ["zero-preserved", "empty-preserved", "empty-preserved"]],
      [{}, "", ["omitted", "omitted", "omitted"]],
      [{ value: undefined, currency: undefined, transaction_id: undefined }, "", ["explicit-undefined-omitted", "explicit-undefined-omitted", "explicit-undefined-omitted"]],
    ]) {
      const command = { ...snapshot, args: ["event", "conversion", { send_to: "AW-0000000000/SYNTHETIC_LABEL", ...params }] };
      const observed = { method: "GET", url: `${endpoint}?label=SYNTHETIC_LABEL${query}&url=https%3A%2F%2Fexample.test%2Freport-only` };
      const report = reportGoogleAdsConversionPrototype({ observedRequests: [observed], commandSnapshots: [command], endpoint });
      expect(report.local[0].relationshipsPreserved).toBe(true);
      expect(report.local[0].fields.slice(1, 4).map((field) => field.expectation)).toEqual(expectation);
    }
  });

  it("does not use missing or page-load data as conversion evidence, and handles malformed local targets without throwing", () => {
    const missing = reportGoogleAdsConversionPrototype();
    expect(missing.nativeShape.disposition).toBe("missing-explicit-projection");
    const wrongReference = reportGoogleAdsConversionPrototype({ projection: { kind: "synthetic-page-load", beacons: [] } });
    expect(wrongReference.nativeShape.disposition).toBe("invalid-or-nonconversion-projection");
    const invalid = reportGoogleAdsConversionPrototype({
      observedRequests: [request], commandSnapshots: [snapshot],
      endpoint: "http://127.0.0.1:99999/pagead/conversion/0000000000/",
    });
    expect(invalid.local[0].relationshipsPreserved).toBe(false);
    expect(invalid.fullCompatibility).toBe(false);
  });

  it("only evaluates explicitly enabled experimental local routing and detects destination or label mutations", () => {
    const experimentalEndpoint = "http://127.0.0.1:43210/pagead/conversion/0000000001/";
    const command = structuredClone(snapshot);
    command.args[2].send_to = "AW-0000000001/LOCAL_ACTION";
    const observed = { ...request, url: request.url.replace(endpoint, experimentalEndpoint).replace("SYNTHETIC_LABEL", "LOCAL_ACTION") };
    const evaluate = (options = {}) => reportGoogleAdsConversionPrototype({
      observedRequests: [observed], commandSnapshots: [command], endpoint: experimentalEndpoint, ...options,
    });
    expect(evaluate().local[0].relationshipsPreserved).toBe(false);
    expect(evaluate({ experimentalRouting: true }).local[0].relationshipsPreserved).toBe(true);
    for (const mutated of [
      { ...observed, url: observed.url.replace("LOCAL_ACTION", "OTHER_ACTION") },
      { ...observed, url: observed.url.replace("/0000000001/", "/0000000002/") },
    ]) {
      expect(evaluate({ observedRequests: [mutated], experimentalRouting: true }).local[0].relationshipsPreserved).toBe(false);
    }
    command.args[2].send_to = "AW-0000000002/LOCAL_ACTION";
    expect(evaluate({ experimentalRouting: true }).local[0].relationshipsPreserved).toBe(false);
    expect(() => evaluate({ experimentalRouting: "true" })).toThrow("invalid-experimental-option");
  });

  it("evaluates explicitly supplied scope snapshots using event, config and global precedence", () => {
    const command = {
      ...snapshot,
      args: ["event", "conversion", { send_to: "AW-0000000000/SYNTHETIC_LABEL", value: 0, transaction_id: undefined }],
    };
    const scopes = { global: { value: 12, currency: "USD", transaction_id: "global-private" }, config: { value: 24, currency: "CAD" } };
    const observed = { method: "GET", url: `${endpoint}?label=SYNTHETIC_LABEL&value=0&currency_code=CAD&url=https%3A%2F%2Fexample.test%2Freport-only` };
    const evaluate = (options = {}) => reportGoogleAdsConversionPrototype({
      observedRequests: [observed], commandSnapshots: [command], scopeSnapshots: [scopes],
      endpoint, experimentalParameterScopes: true, ...options,
    });
    const report = evaluate();
    expect(report.local[0]).toMatchObject({
      relationshipsPreserved: true, scopeDisposition: "explicit-snapshots-only",
    });
    expect(report.local[0].fields.slice(1, 4).map(({ sourceScope, expectation }) => [sourceScope, expectation]))
      .toEqual([["event", "zero-preserved"], ["config", "provided-value-preserved"], ["event", "explicit-undefined-omitted"]]);
    expect(report).toMatchObject({ overall: "INCONCLUSIVE", fullCompatibility: false, cardinalityPreserved: true });
    expect(JSON.stringify(report)).not.toContain("global-private");
    for (const mutated of [
      observed.url.replace("value=0", "value=24"),
      observed.url.replace("currency_code=CAD", "currency_code=USD"),
      `${observed.url}&oid=global-private`,
      observed.url.replace("&value=0", ""),
      `${observed.url}&currency_code=CAD`,
    ]) expect(evaluate({ observedRequests: [{ ...observed, url: mutated }] }).local[0].relationshipsPreserved).toBe(false);
    expect(reportGoogleAdsConversionPrototype({
      observedRequests: [observed], commandSnapshots: [command], scopeSnapshots: [scopes], endpoint,
    }).local[0].relationshipsPreserved).toBe(false);
    const wrongScopes = { global: { value: 12, currency: "USD" }, config: { value: 24, currency: "EUR" } };
    expect(evaluate({ scopeSnapshots: [wrongScopes] }).local[0].relationshipsPreserved).toBe(false);
  });

  it("fails closed for missing, misaligned, invalid or accessor-bearing scopes without exposing data", () => {
    let reads = 0;
    const getter = { get value() { reads += 1; return 3; } };
    const valid = { global: { value: 26.5, currency: "EUR", transaction_id: "report-synthetic-26" }, config: {} };
    const event = { ...snapshot, args: ["event", "conversion", { send_to: "AW-0000000000/SYNTHETIC_LABEL" }] };
    const evaluate = (scopeSnapshots) => reportGoogleAdsConversionPrototype({
      observedRequests: [request], commandSnapshots: [event], endpoint, experimentalParameterScopes: true, scopeSnapshots,
    });
    expect(evaluate([valid]).local[0].relationshipsPreserved).toBe(true);
    for (const scopes of [
      undefined, [], [null], [{ global: getter, config: {} }], [{ global: {}, config: { currency: 9 } }],
      [{ global: { send_to: "private" }, config: {} }], [{ global: {}, config: {}, extra: "private" }],
      [{ global: {}, config: { transaction_id: "\ud800" } }], [valid, valid],
    ]) {
      const report = evaluate(scopes);
      expect(report.local[0].relationshipsPreserved).toBe(false);
      expect(JSON.stringify(report)).not.toContain("report-synthetic-26");
      expect(JSON.stringify(report)).not.toContain("private");
    }
    expect(reads).toBe(0);
    const accessorArray = [valid];
    Object.defineProperty(accessorArray, 0, { get() { reads += 1; return valid; } });
    expect(evaluate(accessorArray).local[0].relationshipsPreserved).toBe(false);
    expect(reads).toBe(0);
    expect(() => reportGoogleAdsConversionPrototype({ experimentalParameterScopes: "true" })).toThrow("invalid-experimental-option");
  });
});
