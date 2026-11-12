// Portable synthetic consumer/seam units. These mocks are NOT native, worker,
// browser, source-qualification or whole-CLI evidence.
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import { chmod, link, mkdir, mkdtemp, readFile, realpath, rm, stat, symlink, writeFile } from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { afterEach, describe, expect, it, vi } from "vitest";

const seams = vi.hoisted(() => ({ native: vi.fn(), chamber: vi.fn() }));
vi.mock("./native-tag-comparison.mjs", () => ({ inspectNativeAttempt: seams.native }));
vi.mock("./chamber-capture.mjs", () => ({ inspectCapture: seams.chamber }));
import { compareObservedAttempts, parseArgs, runChamberComparison } from "./chamber-comparison.mjs";
import { evidenceSession } from "./attempt-evidence-io.mjs";

const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const execute = promisify(execFile);
const entry = fileURLToPath(new URL("./chamber-comparison.mjs", import.meta.url));
const root = dirname(dirname(entry));
const temporary = [];
afterEach(async () => {
  vi.restoreAllMocks();
  syncBuiltinESMExports();
  seams.native.mockReset(); seams.chamber.mockReset();
  for (const path of temporary.splice(0)) await rm(path, { recursive: true, force: true });
});
const request = (url = "https://example.invalid/path?a=one&a=two&b=%2f") => ({
  url, query_pairs: [...new URL(url).searchParams], method: "GET",
  resource_type: "Image", body_state: "absent", body_base64: null, kind: "measurement",
});
const pins = profile => ({ profile, node_version: "unit-node", browser_version: "unit-browser",
  os_release: "unit-os", macos_version: "unit-macos", runtime_sha256: "a".repeat(64),
  configuration_sha256: profile === "meta-pageview" ? "b".repeat(64) : null,
  network_policy_sha256: "c".repeat(64) });

async function fixture(profile = "meta-pageview") {
  const parent = await mkdtemp(join(await realpath(tmpdir()), "059-17-unit-"));
  temporary.push(parent);
  const output = join(parent, "chamber"); await mkdir(output, { mode: 0o700 });
  const put = async (path, value) => {
    const bytes = typeof value === "string" ? value : JSON.stringify(value);
    await writeFile(path, bytes, { mode: 0o600 });
    return { path, sha256: hash(bytes) };
  };
  const reference = {};
  for (const kind of ["report", "capture", "completion"])
    reference[kind] = await put(join(parent, `native-${kind}.json`), { unit_only: kind });
  const sourcePaths = ["rig/chamber-capture.mjs", "rig/chamber-capture.test.mjs"].map(p => join(root, p));
  const source = Object.fromEntries(await Promise.all(sourcePaths.map(async p => [p, hash(await readFile(p))])));
  const rawRequest = { id: "unit-observer", url: "http://127.0.0.1:1234/sink/meta?a=one&a=two",
    method: "GET", resource: "Fetch", request: {}, body: { state: "absent", base64: null },
    extra: {}, response: {}, failed: null };
  const cases = ["meta", "google"].map(vendor => ({
    vendor, control: "positive", positive: `${vendor}-positive`, workers: [], targets: [], sources: [],
    worker_traffic: [], traffic: [], input: ["unit-input"], worker_options: { type: "module" },
    http: [{ ...rawRequest, url: rawRequest.url.replace("/meta?", `/${vendor}?`) }],
    sinks: [], marker: null, blocked: [], observations: { installed_before_navigation: true },
    errors: [], receiver: [],
  }));
  const raw = { schema: "airlock.sdk-absent-chamber-capture.v1", run_id: "unit-chamber",
    identity: { sources: [], node: { version: "unit-chamber-node" }, os: { release: "unit-chamber-os" } },
    caps: {}, claims: {}, origin: "http://127.0.0.1:1234", assets: [], fixture_sha256: "d".repeat(64),
    forbidden_sha256: "e".repeat(64), browser_version: "unit-other-browser", browser_process: {},
    acquisitions: [], cases, errors: [], lifecycle: { started_ms: 1001 }, cleanup: {} };
  const files = {};
  for (const name of ["start.json", "capture.json", "report.json", "publication.json", "witness.json"]) {
    const value = name === "capture.json" ? raw : name === "start.json"
      ? { control: "none", started_ms: 1001 } : name === "witness.json"
        ? { child: { closed_ms: 1500 }, observed_ms: 1501 } : {};
    files[name] = (await put(join(output, name), value)).sha256;
  }
  const command = { schema: "airlock.chamber-whole-cli-witness.v1", output, pid: 42,
    started_ms: 1000, closed_ms: 2000, duration_ms: 1000, exit_code: 0,
    signal: null, timeout: false, source_before: source, source_after: source, files, stdout: "", stderr: "" };
  const commandPath = join(parent, "command.json");
  const manifest = { schema: "airlock.attempt-chamber-comparison.v1", profile, case: "baseline",
    expected_pins: pins(profile), reference, chamber: { output, command: await put(commandPath, command) } };
  const inputs = join(parent, "inputs.json"), outputDir = join(parent, "comparison");
  const native = { report: { profile, mode: "headed", ...pins(profile), provenance: {} },
    capture: { source: { unit_only: true }, cases: [{ name: "baseline", consent: "native_default_not_overridden" }],
      requests: [{ ...request(), ordinal: 0, case: "baseline", category: "native_measurement",
        headers_state: "available_cdp_request_stage_headers" },
      { ...request("https://example.invalid/companion?x=1"), ordinal: 1, case: "baseline",
        category: "native_auxiliary", headers_state: "available_cdp_request_stage_headers" },
      { ...request("https://example.invalid/fixture"), ordinal: 2, case: "baseline", category: "fixture_document" }] },
    completion: { completed: true } };
  const qualify = () => ({ schema: "airlock.sdk-absent-chamber-capture.v1.qualification",
    guard_qualification: "PASS", case_conclusive: true, legacy_subset_source: true,
    local_only: true, native_qualified: false, whole_wire: false,
    whole_cli_completion_observed: false, child_exit_code: 0, capture_sha256: files["capture.json"] });
  seams.native.mockImplementation(async () => native);
  seams.chamber.mockImplementation(async () => qualify());
  const f = { parent, inputs, outputDir, manifest, native, raw, command, put, qualify };
  f.save = async () => {
    files["capture.json"] = (await put(join(output, "capture.json"), raw)).sha256;
    manifest.chamber.command = await put(commandPath, command);
    await put(inputs, manifest);
  };
  f.run = async () => { await f.save(); return runChamberComparison({ inputs, outputDir }); };
  return f;
}

// Observe real local directory handles, not simulated producer/browser evidence.
function observeDirectories() {
  const open = fs.opendirSync, enumerate = fs.readdirSync;
  const seen = { names: 0, materialized: 0, handles: [] };
  vi.spyOn(fs, "readdirSync").mockImplementation((...args) => {
    const names = enumerate(...args); seen.materialized += names.length; return names;
  });
  vi.spyOn(fs, "opendirSync").mockImplementation((...args) => {
    const directory = open(...args), read = directory.readSync.bind(directory);
    const close = vi.spyOn(directory, "closeSync");
    vi.spyOn(directory, "readSync").mockImplementation(() => {
      const entry = read(); if (entry) seen.names++; return entry;
    });
    seen.handles.push({ close, options: args[1] });
    return directory;
  });
  syncBuiltinESMExports();
  return seen;
}

describe("059-17 incremental private tree enumeration corrections", () => {
  it("AC6 correction: ordinary small tree remains valid and rechecks stably", async () => {
    const f = await fixture(), tree = f.manifest.chamber.output;
    await mkdir(join(tree, "nested"), { mode: 0o700 });
    await f.put(join(tree, "nested", "small"), "unit-only");
    const seen = observeDirectories(), session = evidenceSession();
    expect(() => { session.tree(tree); session.recheck(); }).not.toThrow();
    expect(session.snapshots()).toHaveLength(6);
    for (const h of seen.handles) expect(h.close).toHaveBeenCalledTimes(1);
  });
  it.each(["width", "deadline"])(
    "AC6 correction: %s stops consuming wide names incrementally and closes all handles", async kind => {
      const f = await fixture(), tree = f.manifest.chamber.output;
      await mkdir(join(tree, "wide"), { mode: 0o700 });
      await Promise.all(Array.from({ length: 160 }, (_, i) =>
        f.put(join(tree, "wide", `entry-${i}`), "unit-only")));
      const seen = observeDirectories(), started = performance.now(), session = evidenceSession(started);
      if (kind === "deadline")
        vi.spyOn(performance, "now").mockImplementation(() => seen.names >= 3 ? started + 10000 : started);
      expect(() => session.tree(tree)).toThrow(kind === "width" ? "tree_limit" : "deadline_exceeded");
      expect(seen.materialized).toBe(0);
      expect(seen.names).toBeGreaterThan(0);
      expect(seen.names).toBeLessThanOrEqual(kind === "width" ? 80 : 3);
      expect(seen.handles.length).toBeGreaterThan(0);
      for (const h of seen.handles) {
        expect(h.options.bufferSize).toBe(1);
        expect(h.close).toHaveBeenCalledTimes(1);
      }
    });
});

describe("059-17 exact request primitive (synthetic controls only)", () => {
  it("AC4/7: nonempty exact control has zero differences, with companion order retained", () => {
    const rows = [request(), { ...request("https://example.invalid/aux"), kind: "companion" }];
    const result = compareObservedAttempts(rows, structuredClone(rows));
    expect(result.counts.equal_requests).toBe(2);
    expect(result.differences).toEqual([]);
    expect(result).not.toHaveProperty("qualified");
  });
  it.each([
    ["url", r => { r.url = r.url.replace("/path", "/other"); }],
    ["url", r => { r.url = r.url.replace("%2f", "%2F"); }],
    ["url", r => { r.url = r.url.replace("one", "%6fne"); }],
    ["query", r => { r.url = r.url.replace("a=one&a=two", "a=two&a=one"); }],
    ["query", r => { r.url = r.url.replace("a=two", "a=three"); }],
    ["query", r => { r.url += "&a=two"; }],
    ["method", r => { r.method = "POST"; }],
    ["resource_type", r => { r.resource_type = "Fetch"; }],
    ["body", r => { r.body_state = "captured"; r.body_base64 = ""; }],
    ["body", r => { r.body_state = "captured"; r.body_base64 = "AP8="; }],
    ["kind", r => { r.kind = "companion"; }],
  ])("AC4: detects literal %s differences without normalization", (category, mutate) => {
    const a = request(), b = structuredClone(a); mutate(b);
    b.query_pairs = [...new URL(b.url).searchParams];
    expect(compareObservedAttempts([a], [b]).differences.map(d => d.category)).toContain(category);
  });
  it("AC4: dropped/extra requests and reordered companions remain visible", () => {
    const a = [request(), { ...request("https://example.invalid/aux"), kind: "companion" }];
    expect(compareObservedAttempts(a, a.slice(0, 1)).differences.map(d => d.category)).toContain("missing_request");
    expect(compareObservedAttempts(a.slice(0, 1), a).differences.map(d => d.category)).toContain("extra_request");
    expect(compareObservedAttempts(a, [...a].reverse()).counts.equal_requests).toBe(0);
  });
  it.each(["empty", "redaction", "encoded-redaction", "body-redaction", "unknown", "redundancy", "invalid-body", "limit"])(
    "AC4/6: rejects %s rather than silently equalizing", kind => {
      const a = request(), b = request();
      if (kind === "redaction") b.url += "&private=[REDACTED]";
      if (kind === "encoded-redaction") b.url += "&private=%5BREDACTED%5D";
      if (kind === "body-redaction") { b.body_state = "captured"; b.body_base64 = Buffer.from("[MASKED]").toString("base64"); }
      if (kind === "unknown") b.unknown = "silent exclusion";
      if (kind === "invalid-body") b.body_base64 = "";
      b.query_pairs = kind === "redundancy" ? [] : [...new URL(b.url).searchParams];
      expect(() => compareObservedAttempts(kind === "empty" ? [] : [a],
        kind === "limit" ? Array(65).fill(b) : [b])).toThrow();
    });
  it("AC6: refuses a 129th difference rather than publishing a truncated diagnostic", () => {
    const a = Array.from({ length: 64 }, () => request());
    const b = a.map(r => ({ ...r, method: "POST", resource_type: "Fetch",
      body_state: "captured", body_base64: "" }));
    expect(() => compareObservedAttempts(a, b)).toThrow("difference_limit");
  });
});

describe("059-17 closed offline consumer (mocked source seams, not qualification)", () => {
  it.each(["meta-pageview", "google-ads-conversion"])(
    "AC1/3/4/5: %s uses BOTH readers and publishes an honest private diagnostic", async profile => {
      const f = await fixture(profile);
      const result = await f.run();
      expect(result.overall).toBe("nonconformant");
      expect(result.exit_code).toBe(1);
      expect(result.counts.reference_requests).toBe(2);
      expect(result.counts.chamber_requests).toBe(1);
      expect(result.counts.source_validations).toBe(2);
      expect(result.counts.excluded_reference_requests).toBe(1);
      expect(Object.values(result.claims).every(v => v === false)).toBe(true);
      const publicText = JSON.stringify(result);
      for (const secret of [f.parent, "example.invalid", "unit-browser", "native_default_not_overridden", f.manifest.reference.report.sha256])
        expect(publicText).not.toContain(secret);
      const privateData = JSON.parse(await readFile(join(f.outputDir, "comparison.json")));
      expect(privateData.reference.capture).toEqual(f.native.capture);
      expect(privateData.chamber.capture).toEqual(f.raw);
      expect(privateData.context.reference_consent).toBe("native_default_not_overridden");
      expect(privateData.context.chamber_consent).toBe("explicit_host_grant");
      expect(privateData.context.equivalent_inputs).toBe(false);
      expect(privateData.context.reference_identity.browser_version).toBe("unit-browser");
      expect(seams.native).toHaveBeenCalledWith({
        reference: f.manifest.reference, expected_pins: f.manifest.expected_pins,
      });
      expect(seams.chamber).toHaveBeenCalledWith(f.manifest.chamber.output);
      const completion = JSON.parse(await readFile(join(f.outputDir, "completion.json")));
      expect(completion.command_exit_observed).toBe(false);
      for (const name of ["comparison.json", "report.json"])
        expect(completion.files[name]).toBe(hash(await readFile(join(f.outputDir, name))));
      expect((await stat(f.outputDir)).mode & 0o777).toBe(0o700);
      expect((await stat(join(f.outputDir, "comparison.json"))).mode & 0o777).toBe(0o600);
    });

  it("AC5: zero request differences still cannot establish equivalence or acceptance", async () => {
    const f = await fixture();
    const c = f.raw.cases[0].http[0], r = f.native.capture.requests[0];
    r.url = c.url; r.query_pairs = [...new URL(c.url).searchParams]; r.resource_type = c.resource;
    f.native.capture.requests.splice(1, 1);
    const result = await f.run();
    expect(result.counts.differences).toBe(0);
    expect(result.overall).toBe("inconclusive");
    expect(result.exit_code).toBe(2);
  });
  it("AC4: known non-worker control snapshots may have null worker_options", async () => {
    const f = await fixture();
    f.raw.cases.push({ ...structuredClone(f.raw.cases[0]), control: "main-only", worker_options: null });
    const result = await f.run();
    expect(result.exit_code).toBe(1);
    expect(result.exclusions.chamber_other_cases).toBe(2);
  });
  it.each(["native", "chamber", "nonconclusive", "digest", "unknown-native-category", "unknown-chamber-field",
    "empty-native", "empty-chamber", "duplicate-positive", "redaction", "observations"])(
    "AC2/3/4: fails closed on %s", async kind => {
      const f = await fixture();
      if (kind === "native") seams.native.mockRejectedValue(new Error("private-sensitive-error"));
      if (kind === "chamber") seams.chamber.mockRejectedValue(new Error("private-sensitive-error"));
      if (kind === "nonconclusive") seams.chamber.mockImplementation(async () => ({ ...f.qualify(), case_conclusive: false }));
      if (kind === "digest") seams.chamber.mockImplementation(async () => ({ ...f.qualify(), capture_sha256: "0".repeat(64) }));
      if (kind === "unknown-native-category") f.native.capture.requests[0].category = "unknown";
      if (kind === "unknown-chamber-field") f.raw.cases[0].http[0].unknown = true;
      if (kind === "empty-native") f.native.capture.requests = [];
      if (kind === "empty-chamber") f.raw.cases[0].http = [];
      if (kind === "duplicate-positive") f.raw.cases.push(structuredClone(f.raw.cases[0]));
      if (kind === "redaction") f.raw.cases[0].http[0].url += "&private=%5BREDACTED%5D";
      if (kind === "observations") f.raw.cases[0].http = Array(65).fill(f.raw.cases[0].http[0]);
      const result = await f.run();
      expect(result.exit_code).toBeGreaterThanOrEqual(2);
      expect(result.counts.differences).toBe(0);
      expect(JSON.stringify(result)).not.toContain("private-sensitive-error");
    });
  it.each(["body-state", "worker", "target", "traffic", "observation", "response", "source", "native-case", "native-profile"])(
    "AC1/4: rejects unsupported source shape %s instead of excluding it", async kind => {
      const f = await fixture(), c = f.raw.cases[0], r = c.http[0];
      if (kind === "body-state") { r.body.state = "invented"; r.body.base64 = ""; }
      if (kind === "worker") c.workers.push({ url: "/worker", execution: {}, source: {}, unknown: true });
      if (kind === "target") c.targets.push({ target_id: "unit", type: "worker", url: "/worker", source: {}, unknown: true });
      if (kind === "traffic") c.traffic.push({ direction: "host-post", url: "/worker", value: [], unknown: true });
      if (kind === "observation") c.observations.unknown = true;
      if (kind === "response") r.response.unknown = true;
      if (kind === "source") c.sources.push({ url: "/source", script_id: "unit", body: "", sha256: "a".repeat(64), unknown: true });
      if (kind === "native-case") f.native.capture.requests[0].case = "unrecognized";
      if (kind === "native-profile") f.native.report.profile = "google-ads-conversion";
      expect((await f.run()).exit_code).toBeGreaterThanOrEqual(2);
    });
  it.each(["missing", "exit", "signal", "timeout", "duration", "chronology", "inner-close", "source", "files",
    "output", "schema", "unknown", "pin"])("AC3: rejects outer command %s", async kind => {
    const f = await fixture(), c = f.command;
    if (kind === "exit") c.exit_code = 2;
    if (kind === "signal") c.signal = "SIGTERM";
    if (kind === "timeout") c.timeout = true;
    if (kind === "duration") c.duration_ms = 60001;
    if (kind === "chronology") c.closed_ms = c.started_ms - 1;
    if (kind === "inner-close") c.closed_ms = 1200;
    if (kind === "source") c.source_after = { ...c.source_before, [Object.keys(c.source_before)[0]]: "0".repeat(64) };
    if (kind === "pin") c.source_before = c.source_after = {};
    if (kind === "files") c.files["report.json"] = "0".repeat(64);
    if (kind === "output") c.output += "-wrong";
    if (kind === "schema") c.schema = "inner-child-only";
    if (kind === "unknown") c.unknown = true;
    await f.save();
    if (kind === "missing") await rm(f.manifest.chamber.command.path);
    const result = await runChamberComparison({ inputs: f.inputs, outputDir: f.outputDir });
    expect(result.exit_code).toBeGreaterThanOrEqual(2);
  });
  it.each(["profile", "case", "schema", "pins", "unknown", "driver"])("AC1: rejects manifest %s", async kind => {
    const f = await fixture();
    if (kind === "profile") f.manifest.profile = "meta-live";
    if (kind === "case") f.manifest.case = "value1";
    if (kind === "schema") f.manifest.schema = 1;
    if (kind === "pins") f.manifest.expected_pins.profile = "google-ads-conversion";
    if (kind === "unknown") f.manifest.unknown = true;
    if (kind === "driver") f.manifest.program = "/bin/true";
    expect((await f.run()).exit_code).toBe(3);
  });
  it.each(["relative", "noncanonical", "symlink", "ancestor-symlink", "permissions", "directory",
    "manifest-limit", "resource-limit", "duplicate", "escaped-duplicate", "malformed", "depth", "collision", "tree",
    "hardlink", "fifo", "parent-permissions", "chamber-aggregate", "command-duplicate"])(
    "AC6: bounded private IO refuses %s", async kind => {
      const f = await fixture(); await f.save();
      let inputs = f.inputs;
      if (kind === "relative") inputs = "relative.json";
      if (kind === "noncanonical") inputs = f.parent + "/./inputs.json";
      if (kind === "symlink") { inputs = join(f.parent, "link"); await symlink(f.inputs, inputs); }
      if (kind === "ancestor-symlink") {
        const alias = join(f.parent, "alias"); await symlink(f.parent, alias); inputs = join(alias, "inputs.json");
      }
      if (kind === "permissions") await chmod(f.inputs, 0o644);
      if (kind === "directory") inputs = f.parent;
      if (kind === "manifest-limit") await writeFile(inputs, " ".repeat(65537));
      if (kind === "resource-limit") await writeFile(f.manifest.reference.capture.path, " ".repeat(2097153));
      if (["duplicate", "escaped-duplicate"].includes(kind)) {
        const duplicate = kind === "duplicate" ? '"profile":"ignored",' : '"pro\\u0066ile":"ignored",';
        await writeFile(inputs, (await readFile(inputs, "utf8")).replace("{", "{" + duplicate));
      }
      if (kind === "malformed") await writeFile(inputs, "{");
      if (kind === "depth") await writeFile(inputs, "[".repeat(30) + "0" + "]".repeat(30));
      if (kind === "collision") await mkdir(f.outputDir, { mode: 0o700 });
      if (kind === "tree") await symlink(f.inputs, join(f.manifest.chamber.output, "unsafe"));
      if (kind === "hardlink") await link(f.inputs, join(f.parent, "other-input.json"));
      if (kind === "fifo") { await rm(f.inputs); await execute("/usr/bin/mkfifo", [f.inputs]); }
      if (kind === "parent-permissions") await chmod(f.parent, 0o755);
      if (kind === "chamber-aggregate") await f.put(join(f.manifest.chamber.output, "large"), " ".repeat(8388609));
      if (kind === "command-duplicate") {
        const h = f.manifest.chamber.command;
        const bytes = (await readFile(h.path, "utf8")).replace("{", '{"exit_\\u0063ode":9,');
        await writeFile(h.path, bytes); h.sha256 = hash(bytes);
        await f.put(f.inputs, f.manifest);
      }
      expect((await runChamberComparison({ inputs, outputDir: f.outputDir })).exit_code).toBeGreaterThanOrEqual(2);
    });
  it.each(["input", "tree", "deadline"])("AC3/6: rechecks %s through publication", async kind => {
    const f = await fixture();
    seams.chamber.mockImplementation(async () => {
      if (kind === "input") await writeFile(f.manifest.reference.capture.path, "{}");
      if (kind === "tree") await f.put(join(f.manifest.chamber.output, "late.json"), {});
      if (kind === "deadline") vi.spyOn(performance, "now").mockReturnValue(1e12);
      return f.qualify();
    });
    const result = await f.run();
    expect(result.exit_code).toBeGreaterThanOrEqual(2);
    await expect(stat(join(f.outputDir, "completion.json"))).rejects.toMatchObject({ code: "ENOENT" });
  });
  it("AC6: refusing an output inside the supplied chamber does not mutate that input tree", async () => {
    const f = await fixture(); await f.save();
    const inside = join(f.manifest.chamber.output, "forbidden");
    expect((await runChamberComparison({ inputs: f.inputs, outputDir: inside })).exit_code).toBe(3);
    await expect(stat(inside)).rejects.toMatchObject({ code: "ENOENT" });
  });
  it.each(["original", "output", "qualification"])(
    "AC3/6: post-publication %s mutation leaves no successful completion", async kind => {
      const f = await fixture();
      let calls = 0;
      seams.chamber.mockImplementation(async () => {
        if (++calls === 2) {
          if (kind === "original") await writeFile(join(f.manifest.chamber.output, "report.json"), "{}");
          if (kind === "output") await writeFile(join(f.outputDir, "report.json"), "{}");
          if (kind === "qualification") return { ...f.qualify(), case_conclusive: false };
        }
        return f.qualify();
      });
      const result = await f.run();
      expect(result.exit_code).toBe(2);
      expect(result.errors).toContain("publication_failed");
      await expect(stat(join(f.outputDir, "completion.json"))).rejects.toMatchObject({ code: "ENOENT" });
      expect(JSON.parse(await readFile(join(f.outputDir, "failure.json"))).command_exit_observed).toBe(false);
    });
  it("AC6: CLI startup keeps deadline failure distinct from invalid options", async () => {
    for (const [now, code, category] of [
      [10000, 2, "deadline_exceeded"], [10001, 2, "deadline_exceeded"],
      [9999, 3, "invalid_options"],
    ]) {
      const script = `
        import { performance } from "node:perf_hooks";
        Object.defineProperty(performance, "now", { value: () => ${now} });
        process.argv = [process.execPath, ${JSON.stringify(entry)}, "--live", "true"];
        await import(${JSON.stringify(new URL("./chamber-comparison.mjs", import.meta.url).href)});
      `;
      const result = await execute(process.execPath, ["--input-type=module", "-e", script],
        { timeout: 5000 }).catch(error => error);
      expect(result.code).toBe(code);
      expect(result.signal).toBeNull();
      expect(JSON.parse(result.stdout)).toMatchObject({ exit_code: code, errors: [category] });
    }
  });
  it("AC1/8: CLI is closed, offline and never has a qualification exit0", async () => {
    expect(parseArgs(["--inputs", "/private/input", "--output-dir", "/private/output"]))
      .toEqual({ inputs: "/private/input", outputDir: "/private/output" });
    for (const args of [
      ["--inputs", "relative", "--output-dir", "/new"], ["--inputs", "/one", "--inputs", "/two"],
      ["--driver", "/bin/true"], ["--live", "true"], ["--inputs", "/one", "--output-dir", "/new", "--control", "none"],
    ]) expect(() => parseArgs(args)).toThrow();
    try { await execute(process.execPath, [entry, "--live", "true"], { timeout: 10000 }); }
    catch (error) {
      expect(error.code).toBe(3);
      expect(JSON.parse(error.stdout).exit_code).toBe(3);
      return;
    }
    throw Error("unexpected CLI success");
  });
});
