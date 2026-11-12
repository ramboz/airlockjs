import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { analyzeGoogleManualCapture, decodeGoogleManualResponse } from "./google-manual-response.mjs";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/google-manual-conversion.json", import.meta.url), "utf8"));
const owned = structuredClone(fixture.owned);
const fresh = () => structuredClone(fixture.entries);
const frame = (value) => `event: message\ndata: ${JSON.stringify(value)}\n\n`;
const payload = (entries) => JSON.parse(entries[0].response.body.slice(21, -2));
const reject = (entries) => {
  const result = analyzeGoogleManualCapture(entries, owned);
  expect(result).toMatchObject({ overall: "rejected", claims: { dispatch_authorized: false } });
  expect(result.error).toMatch(/^[a-z0-9-]+$/);
};
const mutateUrl = (raw, fn) => {
  const url = new URL(raw);
  fn(url);
  return url.href;
};
const frameJson = (json) => `event: message\ndata: ${json}\n\n`;
const mutateNonownershipPairs = (raw, mutation) => {
  const url = new URL(raw);
  const pairs = [...url.searchParams.entries()];
  const cv = pairs.findIndex(([key]) => key === "cv");
  const fst = pairs.findIndex(([key]) => key === "fst");
  if (cv < 0 || fst < 0) throw new Error("fixture missing nonownership pairs");
  if (mutation === "change") pairs[cv][1] = "changed";
  if (mutation === "reorder") [pairs[cv], pairs[fst]] = [pairs[fst], pairs[cv]];
  // Keep the pair count fixed so only the prefix check can detect the dropped pair.
  if (mutation === "drop") pairs.splice(cv, 1, ["replacement", "unowned"]);
  url.search = new URLSearchParams(pairs).toString();
  return url.href;
};
const expectSameOwnership = (before, after) => {
  const first = new URL(before).searchParams, second = new URL(after).searchParams;
  for (const key of ["label", "value", "currency_code", "oid", "url", "auid", "en"]) {
    expect(second.getAll(key)).toEqual(first.getAll(key));
  }
};
const cliWithFixtureFault = (kind) => spawnSync(process.execPath, ["--input-type=module", "-e", `
  import fs from "node:fs";
  import { syncBuiltinESMExports } from "node:module";
  import { pathToFileURL } from "node:url";
  const kind = process.argv[1];
  const fixtures = {
    malformed: Buffer.from('{"private":"DO_NOT_PRINT"'),
    duplicate: Buffer.from('{"owned":{},"owned":{},"entries":[]}'),
    invalidUtf8: Buffer.from([255]),
    oversized: Buffer.alloc(262145, 65),
    unexpected: Buffer.from('null'),
    readError: Buffer.from('{}'),
    closeError: Buffer.from('{}'),
  };
  const bytes = fixtures[kind];
  let at = 0;
  const { openSync, readSync, closeSync } = fs;
  const isFixture = (path) => String(path).endsWith("google-manual-conversion.json");
  fs.openSync = (path, ...rest) => {
    if (!isFixture(path)) return openSync(path, ...rest);
    if (kind === "readFailure") throw new Error("DO_NOT_PRINT");
    return 42;
  };
  fs.readSync = (fd, target, offset, length, ...rest) => {
    if (fd !== 42) return readSync(fd, target, offset, length, ...rest);
    if (kind === "readError") throw new Error("DO_NOT_PRINT");
    const count = bytes.copy(target, offset, at, at + length);
    at += count;
    return count;
  };
  fs.closeSync = (fd) => {
    if (fd !== 42) return closeSync(fd);
    if (kind === "closeError") throw new Error("DO_NOT_PRINT");
  };
  syncBuiltinESMExports();
  process.argv[1] = process.cwd() + "/rig/google-manual-response.mjs";
  await import(pathToFileURL(process.argv[1]).href);
`, kind], { encoding: "utf8" });

describe("offline manual Google response", () => {
  it("reports the observed chain as partial without leaking captured data or asserting authority", () => {
    const result = analyzeGoogleManualCapture(fresh(), owned, { dispatch_authorized: true });
    expect(result).toMatchObject({
      overall: "inconclusive",
      sequence: "matched",
      counts: { requests: 3, frames: 1, fetch_offers: 1, fallback_offers: 1 },
      evidence: {
        fallback: "offered-not-separately-observed", secondary_body: "unavailable",
        final_headers: "unavailable", final_body: "unavailable", resource_binding: "unqualified",
      },
      claims: { dispatch_authorized: false, native_execution_qualified: false, complete_reference: false,
        chamber_execution: false, product_receipt: false },
    });
    const output = JSON.stringify(result);
    for (const value of Object.values(owned).filter((value) => typeof value === "string")) {
      expect(output).not.toContain(value);
    }
    expect(output).not.toContain("://");
    expect(new URL(fixture.entries[2].request.url).searchParams.getAll("random")).toHaveLength(2);
    expect(decodeGoogleManualResponse(fixture.entries[0].response.body)).toMatchObject({
      status: "decoded", fetch_offers: 1, fallback: "offered", dispatch_authorized: false,
      native_execution_qualified: false, complete_reference: false, chamber_execution: false, product_receipt: false,
    });
  });

  it.each([
    ["wrong primary method", (e) => { e[0].request.method = "POST"; }],
    ["wrong secondary method", (e) => { e[1].request.method = "GET"; }],
    ["wrong final method", (e) => { e[2].request.method = "POST"; }],
    ["wrong primary status", (e) => { e[0].response.status = 302; }],
    ["wrong secondary status", (e) => { e[1].response.status = 200; }],
    ["wrong final status", (e) => { e[2].response.status = 204; }],
    ["wrong order", (e) => { [e[1], e[2]] = [e[2], e[1]]; }],
    ["dropped", (e) => { e.pop(); }],
    ["duplicated", (e) => { e.push(structuredClone(e[1])); }],
    ["foreign fetch parent", (e) => { e[1].request.url += "&foreign=1"; }],
    ["foreign redirect parent", (e) => { e[2].request.url += "&foreign=1"; }],
    ["missing location", (e) => { e[1].response.headers = e[1].response.headers.filter(([k]) => k !== "location"); }],
    ["duplicate location", (e) => { e[1].response.headers.push(e[1].response.headers[2]); }],
    ["wrong label", (e) => { e[0].request.url = mutateUrl(e[0].request.url, (u) => u.searchParams.set("label", "bad")); }],
    ["wrong value", (e) => { e[0].request.url = mutateUrl(e[0].request.url, (u) => u.searchParams.set("value", "2")); }],
    ["wrong currency", (e) => { e[0].request.url = mutateUrl(e[0].request.url, (u) => u.searchParams.set("currency_code", "EUR")); }],
    ["wrong oid", (e) => { e[0].request.url = mutateUrl(e[0].request.url, (u) => u.searchParams.set("oid", "bad")); }],
    ["wrong document", (e) => { e[0].request.url = mutateUrl(e[0].request.url, (u) => u.searchParams.set("url", "https://other.invalid/")); }],
    ["wrong auid", (e) => { e[0].request.url = mutateUrl(e[0].request.url, (u) => u.searchParams.set("auid", "bad")); }],
    ["duplicate economic key", (e) => { e[0].request.url += "&value=1"; }],
    ["duplicate identity key", (e) => { e[0].request.url += "&oid=bad"; }],
    ["foreign primary host", (e) => { e[0].request.url = e[0].request.url.replace("www.googleadservices.com", "example.invalid"); }],
    ["response host changed", (e) => { const p = payload(e); p.fetch[0] = p.fetch[0].replace("googleads.g.doubleclick.net", "example.invalid"); e[0].response.body = frame(p); }],
    ["foreign fallback", (e) => { const p = payload(e); p.options.fallback_url = p.options.fallback_url.replace("www.google.com", "example.invalid"); e[0].response.body = frame(p); }],
    ["wrong fetch value", (e) => { const p = payload(e); p.fetch[0] = mutateUrl(p.fetch[0], (u) => u.searchParams.set("value", "2")); e[0].response.body = frame(p); e[1].request.url = p.fetch[0]; }],
    ["wrong redirect identity", (e) => { const location = e[1].response.headers[2]; location[1] = mutateUrl(location[1], (u) => u.searchParams.set("auid", "bad")); e[2].request.url = location[1]; }],
    ["duplicate fetch marker", (e) => { const p = payload(e); p.fetch[0] += `&label=${owned.conversion_label}`; e[0].response.body = frame(p); e[1].request.url = p.fetch[0]; }],
    ["duplicate fallback marker", (e) => { const p = payload(e); p.options.fallback_url += "&currency_code=USD"; e[0].response.body = frame(p); }],
    ["duplicate redirect marker", (e) => { const location = e[1].response.headers[2]; location[1] += "&value=1"; e[2].request.url = location[1]; }],
    ["missing first random", (e) => { const p = payload(e); p.fetch[0] = mutateUrl(p.fetch[0], (u) => u.searchParams.delete("random")); e[0].response.body = frame(p); }],
    ["secondary oid wrong", (e) => { const p = payload(e); p.fetch[0] += "&oid=wrong"; e[0].response.body = frame(p); e[1].request.url = p.fetch[0]; }],
    ["credentials", (e) => { e[0].request.url = e[0].request.url.replace("https://", "https://u@"); }],
    ["explicit port", (e) => { e[0].request.url = e[0].request.url.replace(".com/", ".com:443/"); }],
    ["fragment", (e) => { e[0].request.url += "#frag"; }],
    ["normalized path", (e) => { e[0].request.url = e[0].request.url.replace("/pagead/", "/bad/../pagead/"); }],
    ["bad escape", (e) => { e[0].request.url += "&x=%ZZ"; }],
    ["oversized URL", (e) => { e[0].request.url += `&x=${"x".repeat(9000)}`; }],
    ["too many headers", (e) => { e[0].response.headers = Array.from({ length: 33 }, () => ["x", "y"]); }],
    ["invalid header control", (e) => { e[1].response.headers.push(["x", "\u0000"]); }],
    ["nonempty request body", (e) => { e[1].request.body_size = 1; }],
    ["oversized unexported-body replacement", (e) => { e[2].response.body = "x".repeat(65537); }],
  ])("rejects %s", (_name, change) => {
    const entries = fresh();
    change(entries);
    reject(entries);
  });

  it.each([
    ["wrong frame", (s) => s.replace("event: message", "event: other")],
    ["plain JSON", () => "{}"],
    ["extra frame", (s) => `${s}event: message\ndata: {}\n\n`],
    ["trailing data", (s) => `${s}x`],
    ["bad JSON", () => "event: message\ndata: {\n\n"],
    ["duplicate members", () => 'event: message\ndata: {"fetch":[],"fetch":[],"options":{}}\n\n'],
    ["escaped duplicate members", () => 'event: message\ndata: {"fetch":[],"fet\\u0063h":[],"options":{}}\n\n'],
    ["duplicate nested members", () => 'event: message\ndata: {"fetch":[],"options":{"x":1,"x":2}}\n\n'],
    ["wrong kind", () => frame({ image: [], options: {} })],
    ["wrong fetch count", () => frame({ fetch: [], options: {} })],
    ["wrong option", (s) => s.replace('"fallback_url_method":"fetch"', '"fallback_url_method":"GET"')],
    ["extra option", (s) => s.replace('"fallback_url_method":"fetch"', '"fallback_url_method":"fetch","extra":1')],
    ["excess depth", () => `event: message\ndata: ${"[".repeat(40)}0${"]".repeat(40)}\n\n`],
    ["excess nodes", () => `event: message\ndata: [${Array(5000).fill("0").join(",")}]\n\n`],
    ["excess bytes", () => `event: message\ndata: "${"x".repeat(65536)}"\n\n`],
    ["invalid UTF8", () => Uint8Array.from([0xff])],
    ["byte order mark", (s) => Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(s)])],
    ["lone surrogate", (s) => s.replace("fixture-token-24", "\ud800")],
  ])("rejects %s safely", (_name, change) => {
    const result = decodeGoogleManualResponse(change(fixture.entries[0].response.body));
    expect(result).toMatchObject({ status: "rejected", dispatch_authorized: false });
    expect(result.error).toMatch(/^[a-z0-9-]+$/);
    const entries = fresh();
    entries[0].response.body = change(entries[0].response.body);
    reject(entries);
  });

  it("fetch-count enforcement rejects an otherwise-valid two-offer message", () => {
    const entries = fresh(), data = payload(entries);
    data.fetch.push(data.fetch[0]);
    entries[0].response.body = frame(data);
    expect(decodeGoogleManualResponse(entries[0].response.body)).toMatchObject({
      status: "rejected", error: "invalid-fetch-count",
    });
    expect(analyzeGoogleManualCapture(entries, owned)).toMatchObject({
      overall: "rejected", error: "invalid-fetch-count",
    });
  });

  it.each([
    ["fetch", (p) => `{"fetch":${JSON.stringify(p.fetch)},"fetch":${JSON.stringify(p.fetch)},"options":${JSON.stringify(p.options)}}`],
    ["escaped fetch", (p) => `{"fetch":${JSON.stringify(p.fetch)},"fet\\u0063h":${JSON.stringify(p.fetch)},"options":${JSON.stringify(p.options)}}`],
    ["options", (p) => `{"fetch":${JSON.stringify(p.fetch)},"options":${JSON.stringify(p.options)},"options":${JSON.stringify(p.options)}}`],
    ["fallback URL", (p) => `{"fetch":${JSON.stringify(p.fetch)},"options":{"fallback_url":${JSON.stringify(p.options.fallback_url)},"fallback_url":${JSON.stringify(p.options.fallback_url)},"fallback_url_method":"fetch"}}`],
    ["escaped fallback URL", (p) => `{"fetch":${JSON.stringify(p.fetch)},"options":{"fallback_url":${JSON.stringify(p.options.fallback_url)},"fallback_\\u0075rl":${JSON.stringify(p.options.fallback_url)},"fallback_url_method":"fetch"}}`],
    ["escaped fallback method", (p) => `{"fetch":${JSON.stringify(p.fetch)},"options":{"fallback_url":${JSON.stringify(p.options.fallback_url)},"fallback_url_method":"fetch","fallback_url_meth\\u006fd":"fetch"}}`],
  ])("duplicate enforcement rejects otherwise-valid %s members", (_name, makeJson) => {
    const entries = fresh(), original = payload(entries);
    const json = makeJson(original);
    expect(JSON.parse(json)).toEqual(original);
    entries[0].response.body = frameJson(json);
    expect(decodeGoogleManualResponse(entries[0].response.body)).toMatchObject({
      status: "rejected", error: "duplicate-json",
    });
    expect(analyzeGoogleManualCapture(entries, owned)).toMatchObject({
      overall: "rejected", error: "duplicate-json",
    });
  });

  it.each([
    ["depth", () => { let nested = 0; for (let i = 0; i < 17; i += 1) nested = [nested]; return nested; }],
    ["nodes", () => Array(1025).fill(0)],
  ])("structure enforcement reports the %s limit before schema validation", (_name, makeProbe) => {
    const entries = fresh(), data = payload(entries);
    data.probe = makeProbe();
    entries[0].response.body = frame(data);
    expect(decodeGoogleManualResponse(entries[0].response.body)).toMatchObject({
      status: "rejected", error: "structure-limit",
    });
    expect(analyzeGoogleManualCapture(entries, owned)).toMatchObject({
      overall: "rejected", error: "structure-limit",
    });
  });

  it.each(["change", "reorder", "drop"])("fallback prefix rejects nonownership %s with other links intact", (mutation) => {
    const entries = fresh(), data = payload(entries);
    const original = data.options.fallback_url;
    data.options.fallback_url = mutateNonownershipPairs(data.options.fallback_url, mutation);
    expectSameOwnership(original, data.options.fallback_url);
    entries[0].response.body = frame(data);
    expect(entries[1].request.url).toBe(data.fetch[0]);
    expect(entries[2].request.url).toBe(entries[1].response.headers[2][1]);
    expect(decodeGoogleManualResponse(entries[0].response.body).status).toBe("decoded");
    expect(analyzeGoogleManualCapture(entries, owned)).toMatchObject({ overall: "rejected", error: "invalid-parent" });
  });

  it.each(["change", "reorder", "drop"])("redirect prefix rejects nonownership %s with exact Location link", (mutation) => {
    const entries = fresh(), data = payload(entries), location = entries[1].response.headers[2];
    const original = location[1];
    const random = new URL(location[1]).searchParams.getAll("random");
    location[1] = mutateNonownershipPairs(location[1], mutation);
    expectSameOwnership(original, location[1]);
    entries[2].request.url = location[1];
    expect(entries[1].request.url).toBe(data.fetch[0]);
    expect(entries[2].request.url).toBe(location[1]);
    expect(new URL(location[1]).searchParams.getAll("random")).toEqual(random);
    expect(random).toHaveLength(2);
    expect(random[0]).not.toBe(random[1]);
    expect(analyzeGoogleManualCapture(entries, owned)).toMatchObject({ overall: "rejected", error: "invalid-parent" });
  });

  it("does not decode unsafe or oversized offered URLs", () => {
    const data = payload(fresh());
    data.fetch[0] = "https://user@example.invalid/path";
    expect(decodeGoogleManualResponse(frame(data)).status).toBe("rejected");
    data.fetch[0] = fixture.entries[1].request.url;
    data.options.fallback_url = data.options.fallback_url.replace("www.google.com", "example.invalid");
    expect(decodeGoogleManualResponse(frame(data)).status).toBe("rejected");
    data.options.fallback_url = payload(fresh()).options.fallback_url;
    data.fetch[0] = `https://example.invalid/${"x".repeat(9000)}`;
    expect(decodeGoogleManualResponse(frame(data)).status).toBe("rejected");
  });

  it("validates owned expectations independently and never invents response data", () => {
    const entries = fresh();
    expect(analyzeGoogleManualCapture(entries, { ...owned, value: 2 }).overall).toBe("rejected");
    expect(analyzeGoogleManualCapture(entries, { ...owned, transaction_id: "different" }).overall).toBe("rejected");
    entries[1].response.body = "";
    entries[2].response.body = "";
    entries[2].response.headers = [];
    const result = analyzeGoogleManualCapture(entries, owned);
    expect(result.evidence).toMatchObject({ secondary_body: "available", final_headers: "available", final_body: "available" });
    expect(result.claims.complete_reference).toBe(false);
  });

  it("replays only the local fixture through the offline CLI", () => {
    const output = execFileSync(process.execPath, ["rig/google-manual-response.mjs"], { encoding: "utf8" });
    expect(JSON.parse(output)).toMatchObject({ overall: "inconclusive", sequence: "matched" });
    expect(output).not.toContain("://");
    const invalid = spawnSync(process.execPath, ["rig/google-manual-response.mjs", "--live"], { encoding: "utf8" });
    expect(invalid.status).not.toBe(0);
    expect(invalid.stdout).not.toContain("://");
    expect(invalid.stderr).not.toContain("://");
  });

  it.each([
    ["readFailure", "fixture-unavailable"],
    ["readError", "fixture-unavailable"],
    ["closeError", "fixture-unavailable"],
    ["malformed", "invalid-json"],
    ["duplicate", "duplicate-json"],
    ["invalidUtf8", "invalid-utf8"],
    ["oversized", "body-limit"],
    ["unexpected", "invalid-input"],
  ])("offline CLI safely distinguishes %s", (kind, code) => {
    const result = cliWithFixtureFault(kind);
    expect(result.status).toBe(2);
    expect(result.stdout).toBe("");
    expect(result.stderr.trim()).toBe(code);
    expect(result.stderr).not.toContain("DO_NOT_PRINT");
    expect(result.stderr).not.toContain("://");
    expect(result.stderr).not.toContain(process.cwd());
  });
});
