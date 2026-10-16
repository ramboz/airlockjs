import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";
import { runNativeReference } from "./native-tag-reference.mjs";

const execute = promisify(execFile);
const digest = bytes => createHash("sha256").update(bytes).digest("hex");
const entry = fileURLToPath(new URL("./native-tag-reference.mjs", import.meta.url));
const privateInputs = process.env.AIRLOCK_META_REFERENCE_INPUTS;
const temporary = [];
afterEach(async () => {
  for (const path of temporary.splice(0)) await rm(path, { recursive: true, force: true });
});
async function directory() {
  const path = await mkdtemp(join(tmpdir(), "airlock-reference-test-"));
  temporary.push(path);
  return path;
}
async function synthetic() {
  const parent = await directory();
  // Deliberately NOT vendor code: proves refusal of an empty positive only.
  const bytes = Buffer.from("/* synthetic no-op, not a native reference */");
  const resource = join(parent, "synthetic.js");
  await writeFile(resource, bytes, { mode: 0o600 });
  const manifest = {
    schema_version: 1, profile: "meta-pageview",
    owned_origin: "https://fixture.invalid",
    document_url: "https://fixture.invalid/source-document",
    pixel_id: "123456789",
    runtime: { path: resource, sha256: digest(bytes),
      request_url: "https://connect.facebook.net/en_US/fbevents.js", response_status: 200 },
    configuration: { path: resource, sha256: digest(bytes),
      request_url: "https://connect.facebook.net/signals/config/123456789", response_status: 200 },
    source_capture_sha256: "a".repeat(64),
    authorization: "synthetic parser/control test only; no native qualification",
  };
  const inputs = join(parent, "inputs.json");
  const save = () => writeFile(inputs, JSON.stringify(manifest), { mode: 0o600 });
  await save();
  return { parent, inputs, manifest, save, outputDir: join(parent, "output") };
}

describe("bounded offline Meta reference", () => {
  it("requires an explicit bounded API and refuses unknown controls/inputs", async () => {
    for (const options of [undefined, null, [], {}, { inputs: "/private-marker" },
      { inputs: "/private-marker", outputDir: "/private-marker", script: "private-marker" },
      { inputs: "/private-marker", outputDir: "/private-marker", control: "private-marker" },
      { inputs: "/private-marker", outputDir: "/private-marker", mode: "spoofed" }]) {
      const report = await runNativeReference(options);
      expect(report.overall).toBe("invalid_input");
      expect(report.exit_code).toBe(3);
      expect(JSON.stringify(report)).not.toContain("private-marker");
      expect(Object.values(report.claims).every(value => value === false)).toBe(true);
    }
  });

  it.each([
    ["unknown_input", m => { m.extra = "private-marker"; }, "unknown_manifest_field"],
    ["missing_input", m => { delete m.source_capture_sha256; }, "missing_manifest_field"],
    ["bad_schema", m => { m.schema_version = 2; }, "unsupported_schema"],
    ["non_object", m => { m.runtime = []; }, "invalid_manifest_object"],
    ["non_string_digest", m => { m.source_capture_sha256 = ["a".repeat(64)]; }, "invalid_source_digest"],
    ["bad_vendor", m => { m.profile = "google-conversion"; }, "unsupported_profile"],
    ["bad_runtime", m => { m.runtime.request_url += "?alternate"; }, "invalid_runtime_url"],
    ["bad_owner", m => { m.document_url = "https://other.invalid/"; }, "owned_origin_mismatch"],
    ["bad_config", m => { m.configuration.request_url += "/other"; }, "invalid_configuration_url"],
    ["bad_status", m => { m.runtime.response_status = 404; }, "invalid_source_status"],
    ["long_url", m => { m.document_url += "x".repeat(2048); }, "invalid_source_url"],
    ["credentials", m => { m.document_url = "https://user:private-marker@fixture.invalid/"; }, "invalid_source_url"],
    ["missing_resource", m => { m.runtime.path += ".missing"; }, "resource_unavailable"],
    ["hash_mismatch", m => { m.runtime.sha256 = "b".repeat(64); }, "resource_hash_mismatch"],
  ])("rejects %s before a browser and sanitizes errors", async (_name, mutate, category) => {
    const fixture = await synthetic();
    mutate(fixture.manifest);
    await fixture.save();
    const report = await runNativeReference({ inputs: fixture.inputs, outputDir: fixture.outputDir });
    expect(report.overall).toBe(category.startsWith("resource_") ? "inconclusive" : "invalid_input");
    expect(report.errors).toContain(category);
    expect(report.counts.attempts).toBe(0);
    expect(report.browser_version).toBe(null);
    expect(JSON.stringify(report)).not.toContain(fixture.parent);
    expect(JSON.stringify(report)).not.toContain("private-marker");
    expect(JSON.stringify(report)).not.toContain(fixture.manifest.pixel_id);
  });

  it("rejects oversized resources instead of truncating them", async () => {
    const fixture = await synthetic();
    await writeFile(fixture.manifest.runtime.path, Buffer.alloc(2097153));
    const report = await runNativeReference({ inputs: fixture.inputs, outputDir: fixture.outputDir });
    expect(report.overall).toBe("inconclusive");
    expect(report.errors).toContain("resource_byte_limit");
  });

  it.each(["malformed", "oversized", "missing"])("refuses a %s manifest without launching", async kind => {
    const fixture = await synthetic();
    if (kind === "missing") await rm(fixture.inputs);
    else await writeFile(fixture.inputs, kind === "oversized" ? "x".repeat(32769) : "{");
    const report = await runNativeReference({ inputs: fixture.inputs, outputDir: fixture.outputDir });
    expect(report.exit_code).not.toBe(0);
    expect(report.errors).toContain({ malformed: "invalid_manifest_json",
      oversized: "manifest_byte_limit", missing: "manifest_unavailable" }[kind]);
    expect(report.browser_version).toBe(null);
  });

  it("AC1: a self-consistent placeholder hash cannot impersonate the qualified official runtime", async () => {
    const fixture = await synthetic();
    const report = await runNativeReference({ inputs: fixture.inputs, outputDir: fixture.outputDir });
    expect(report.overall).toBe("inconclusive");
    expect(report.errors).toContain("unqualified_native_resource");
    expect(report.browser_version).toBe(null);
    expect(report.cases).toHaveLength(0);
  });

  it("does not overwrite existing output", async () => {
    const fixture = await synthetic();
    const report = await runNativeReference({ inputs: fixture.inputs, outputDir: fixture.parent });
    expect(report.overall).toBe("invalid_input");
    expect(report.errors).toContain("output_directory_unavailable");
    expect(await readdir(fixture.parent)).toEqual(["inputs.json", "synthetic.js"]);
  });

  it("rejects a FIFO input without retaining a blocked filesystem open", async () => {
    const parent = await directory();
    const fifo = join(parent, "input.fifo");
    await execute("/usr/bin/mkfifo", [fifo]);
    const failure = await execute(process.execPath, [
      entry, "--inputs", fifo, "--output-dir", join(parent, "output"),
    ], { timeout: 2000, killSignal: "SIGKILL" }).catch(error => error);
    expect(failure.killed).not.toBe(true);
    expect(failure.code).toBe(2);
    expect(JSON.parse(failure.stdout).errors).toContain("manifest_unavailable");
  });

  it("imports inertly and never echoes private CLI arguments", async () => {
    const imported = await execute(process.execPath, ["--input-type=module", "-e",
      `await import(${JSON.stringify(new URL("./native-tag-reference.mjs", import.meta.url).href)}); console.log(JSON.stringify(process.getActiveResourcesInfo().filter(x => /ProcessWrap|TCPServerWrap/.test(x))));`]);
    expect(JSON.parse(imported.stdout)).toEqual([]);
    for (const args of [["--url", "private-marker"], ["--inputs", "--output-dir"]]) {
      const failure = await execute(process.execPath, [entry, ...args]).catch(error => error);
      expect(failure.code).toBe(3);
      expect(JSON.parse(failure.stdout).overall).toBe("invalid_input");
      expect(failure.stdout + failure.stderr).not.toContain("private-marker");
    }
  });

  it.each(["mkdir", "open"])("AC3/6: quarantines late %s completion after the absolute deadline", async operation => {
    const fixture = await synthetic();
    const { stdout } = await execute(process.execPath, ["--input-type=module", "-e", `
      import fs from "node:fs";
      import {syncBuiltinESMExports} from "node:module";
      const realTimer=globalThis.setTimeout;
      const original=fs.promises[${JSON.stringify(operation)}];
      fs.promises[${JSON.stringify(operation)}]=async(...args)=>{
        await new Promise(resolve=>realTimer(resolve,100));
        return original(...args);
      };
      syncBuiltinESMExports();
      // Synthetic deadline fault only: accelerate the actual watchdog/wait
      // timers; do not assert any real-browser timing qualification here.
      globalThis.setTimeout=(fn,ms,...args)=>realTimer(fn,ms>=1000?20:ms,...args);
      const {runNativeReference}=await import(${JSON.stringify(new URL("./native-tag-reference.mjs", import.meta.url).href)});
      const report=await runNativeReference(${JSON.stringify({
        inputs: fixture.inputs, outputDir: fixture.outputDir, control: "boundary-only",
      })});
      await new Promise(resolve=>realTimer(resolve,200));
      const names=await fs.promises.readdir(${JSON.stringify(fixture.outputDir)}).catch(()=>[]);
      console.log(JSON.stringify({report,names}));
    `], { timeout: 5000 });
    const { report, names } = JSON.parse(stdout);
    expect(report.overall).toBe("inconclusive");
    expect(report.errors).toContain("run_deadline_exceeded");
    expect(report.browser_version).toBe(null);
    expect(report.provenance).toBe(null);
    expect(report.counts.attempts).toBe(0);
    expect(names).not.toContain("report.json");
    if (operation === "mkdir") expect(names).toEqual([]);
  });

  it("AC3/6: a failed asynchronous HTTP abort cannot qualify even behind process denial", async () => {
    const fixture = await synthetic();
    const { stdout } = await execute(process.execPath, ["--input-type=module", "-e", `
      import {chromium} from "playwright";
      const connect=chromium.connect.bind(chromium);
      chromium.connect=async(...args)=>{
        const browser=await connect(...args);
        const create=browser.newContext.bind(browser);
        browser.newContext=async(...contextArgs)=>{
          const context=await create(...contextArgs);
          const cdp=context.newCDPSession.bind(context);
          context.newCDPSession=async(...pageArgs)=>{
            const session=await cdp(...pageArgs);
            const send=session.send.bind(session);
            session.send=(method,...parameters)=>method==="Fetch.failRequest"
              ?Promise.reject(new Error("private-marker")):send(method,...parameters);
            return session;
          };
          return context;
        };
        return browser;
      };
      const {runNativeReference}=await import(${JSON.stringify(new URL("./native-tag-reference.mjs", import.meta.url).href)});
      console.log(JSON.stringify(await runNativeReference(${JSON.stringify({
        inputs: fixture.inputs, outputDir: fixture.outputDir, control: "boundary-only",
      })})));
    `], { timeout: 15000 });
    const report = JSON.parse(stdout);
    expect(report.overall).toBe("inconclusive");
    expect(report.errors).toContain("capture_or_interception_failed");
    expect(report.cases).toHaveLength(0);
    expect(report.guard.process_control.qualified).toBe(true);
    expect(report.capture_complete).toBe(false);
    expect(stdout).not.toContain("private-marker");
    expect(report.cleanup.owned_processes_exited).toBe(true);
  }, 20000);

  it.each([
    ["an unobserved popup", '<script nonce="__NONCE__">window.open("about:blank");</script>', "unsupported_page_target"],
    ["a favicon-shaped script", '<script nonce="__NONCE__" src="/favicon.ico"></script>', "missing_dependency"],
    ["a query-bearing favicon fetch", '<script nonce="__NONCE__">fetch("/favicon.ico?unexpected=1").catch(()=>{});</script>', "unknown_auxiliary"],
    ["a body-bearing favicon POST", '<script nonce="__NONCE__">fetch("/favicon.ico",{method:"POST",body:"private-marker"}).catch(()=>{});</script>', "unknown_auxiliary"],
  ])("AC3/6: refuses %s rather than claiming capture closure", async (_label, markup, expected) => {
    const fixture = await synthetic();
    const { stdout } = await execute(process.execPath, ["--input-type=module", "-e", `
      import {chromium} from "playwright";
      const connect=chromium.connect.bind(chromium);
      chromium.connect=async(...args)=>{
        const browser=await connect(...args);
        const create=browser.newContext.bind(browser);
        browser.newContext=async(...contextArgs)=>{
          const context=await create(...contextArgs);
          const cdp=context.newCDPSession.bind(context);
          context.newCDPSession=async(...pageArgs)=>{
            const session=await cdp(...pageArgs);
            const send=session.send.bind(session);
            session.send=(method,parameters)=>{
              if(method==="Fetch.fulfillRequest"){
                const policy=parameters.responseHeaders.find(h=>h.name==="Content-Security-Policy")?.value;
                const nonce=policy?.match(/'nonce-([^']+)'/)?.[1];
                if(nonce)parameters={...parameters,body:Buffer.from(
                  Buffer.from(parameters.body,"base64").toString("utf8")
                  +${JSON.stringify(markup)}.replaceAll("__NONCE__",nonce)
                ).toString("base64")};
              }
              return send(method,parameters);
            };
            return session;
          };
          return context;
        };
        return browser;
      };
      const {runNativeReference}=await import(${JSON.stringify(new URL("./native-tag-reference.mjs", import.meta.url).href)});
      console.log(JSON.stringify(await runNativeReference(${JSON.stringify({
        inputs: fixture.inputs, outputDir: fixture.outputDir, control: "boundary-only",
      })})));
    `], { timeout: 15000 });
    const report = JSON.parse(stdout);
    expect(report.overall).toBe("inconclusive");
    expect(report.errors).toContain(expected);
    expect(report.cases).toHaveLength(0);
    expect(report.capture_complete).toBe(false);
    expect(report.cleanup.owned_processes_exited).toBe(true);
  }, 20000);

  it("AC3/6: witnesses actual process and HTTP tripwires without executing synthetic native bytes", async () => {
    const fixture = await synthetic();
    const report = await runNativeReference({ inputs: fixture.inputs, outputDir: fixture.outputDir,
      control: "boundary-only" });
    expect(report.guard.process_control).toMatchObject({
      positive_arrivals: 1, positive_status: 200, confined_arrivals: 0, qualified: true,
    });
    expect(report.guard.http_control).toMatchObject({ attempts: 1, arrivals: 0, aborted: 1, qualified: true });
    expect(report.guard.resolver_control).toMatchObject({
      positive_connections: 2, confined_denials: 2, qualified: true,
      query_payload_sent: false,
    });
    expect(report.provenance.network_policy_sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(report.platform).toBe("darwin");
    expect(report.macos_version).toBe("27.0.1");
    expect(report.os_release).toBe("27.0.0");
    expect(report.overall).toBe("inconclusive");
    expect(report.errors).toContain("native_execution_not_requested");
    expect(report.provenance.native_resources).toBe("supplied_resources_not_executed_or_fulfilled");
    expect(report.cases).toHaveLength(0);
    expect(report.capture_complete).toBe(false);
    expect(report.cleanup.owned_processes_exited).toBe(true);
    expect((await stat(fixture.outputDir)).mode & 0o777).toBe(0o700);
    expect((await stat(join(fixture.outputDir, "capture.json"))).mode & 0o777).toBe(0o600);
    const capture = JSON.parse(await readFile(join(fixture.outputDir, "capture.json"), "utf8"));
    expect(capture.receiver_requests).toHaveLength(1);
    expect(capture.receiver_requests[0].method).toBe("GET");
    expect(capture.requests.every(row => !["runtime", "configuration"].includes(row.category))).toBe(true);
    expect(Object.isFrozen(report)).toBe(true);
  }, 90000);

  it.runIf(privateInputs)("AC1/2/4/5/6: executes exact retained native bytes with linked off/value controls", async () => {
    const parent = await directory();
    const outputDir = join(parent, "native");
    const report = await runNativeReference({ inputs: privateInputs, outputDir });
    expect(report.overall, report.errors.join(",")).toBe("qualified");
    expect(report.evidence_layer).toBe("native_attempt");
    expect(report.mode).toBe("headed");
    expect(report.runtime_sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(report.configuration_sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(report.provenance.fixture).toBe("generated_synthetic_not_source_document");
    expect(report.cases.map(row => row.name)).toEqual([
      "baseline", "query-disabled", "consent-revoked", "value1", "value2",
    ]);
    expect(report.cases.map(row => row.attempts)).toEqual([1, 0, 0, 1, 1]);
    expect(report.controls).toMatchObject({
      disabled_linked: true, consent_negative_linked: true, value_contrast: true,
    });
    expect(report.capture_complete).toBe(true);
    expect(report.cases[0].qualified_positive_reference).toBe(true);
    expect(report.cases.every(row => Date.parse(row.stopped_at) - Date.parse(row.started_at) >= 5000)).toBe(true);
    expect(Object.values(report.claims).every(value => value === false)).toBe(true);
    const capture = JSON.parse(await readFile(join(outputDir, "capture.json"), "utf8"));
    const attempts = capture.requests.filter(row => row.category === "native_measurement");
    const revoked = capture.cases.find(row => row.name === "consent-revoked");
    expect(revoked).toMatchObject({
      attempts: 0, runtime_fulfilled: 1, configuration_fulfilled: 0, dependency_closed: true,
      fixture_state: { executed: true, disabled: false, consent: "explicit_revoke_before_init" },
      native_state: { callable: true, queue_length: 2, owned_pixel_count: 0, event_count: null },
    });
    expect(attempts).toHaveLength(3);
    expect(attempts.every(row => row.aborted && row.headers && row.query_pairs && row.body_state)).toBe(true);
    expect(attempts[1].query_pairs).toContainEqual(["cd[value]", "13.25"]);
    expect(attempts[2].query_pairs).toContainEqual(["cd[value]", "29.75"]);
    expect(attempts.every(row => row.local_response === null && !row.actual_vendor_response)).toBe(true);
    expect(attempts.every(row => new URLSearchParams(row.query_pairs).getAll("id").length === 1)).toBe(true);
    const publicText = JSON.stringify(report);
    expect(publicText).not.toContain("https://");
    expect(publicText).not.toContain(parent);
  }, 90000);

  it.runIf(privateInputs && process.env.AIRLOCK_META_HEADLESS_DIAGNOSTIC === "1")(
    "AC3: retains the genuine headless no-beacon cohort as inconclusive", async () => {
      const parent = await directory();
      const report = await runNativeReference({ inputs: privateInputs,
        outputDir: join(parent, "headless"), mode: "headless-diagnostic" });
      expect(report.overall).toBe("inconclusive");
      expect(report.errors).toContain("missing_positive_reference");
      expect(report.mode).toBe("headless-diagnostic");
      const outputDir = join(parent, "headless");
      const capture = JSON.parse(await readFile(join(outputDir, "capture.json"), "utf8"));
      const baseline = report.cases.find(row => row.name === "baseline");
      expect(baseline).toMatchObject({
        runtime_fulfilled: 1, configuration_fulfilled: 1,
        dependency_closed: true, attempts: 0,
      });
      expect(capture.cases.find(row => row.name === "baseline").fixture_state)
        .toMatchObject({ executed: true, disabled: false });
      expect(capture.cases.find(row => row.name === "baseline").native_state)
        .toMatchObject({ callable: true, queue_length: 0, owned_pixel_count: 1, event_count: 1 });
      expect(capture.requests.filter(row => row.category === "native_measurement")).toHaveLength(0);
    }, 90000);

  it.runIf(privateInputs)("AC4: omitting the native revoke call cannot qualify its negative marker", async () => {
    const parent = await directory();
    const outputDir = join(parent, "removed-revoke");
    const { stdout } = await execute(process.execPath, ["--input-type=module", "-e", `
      import {chromium} from "playwright";
      const connect=chromium.connect.bind(chromium);
      chromium.connect=async(...args)=>{
        const browser=await connect(...args);
        const create=browser.newContext.bind(browser);
        browser.newContext=async(...contextArgs)=>{
          const context=await create(...contextArgs);
          const cdp=context.newCDPSession.bind(context);
          context.newCDPSession=async(...pageArgs)=>{
            const session=await cdp(...pageArgs);
            const send=session.send.bind(session);
            session.send=(method,parameters)=>{
              if(method==="Fetch.fulfillRequest" && parameters.responseHeaders
                .some(header=>header.name==="Content-Type"&&header.value.startsWith("text/html"))){
                parameters={...parameters,body:Buffer.from(Buffer.from(parameters.body,"base64")
                  .toString("utf8").replace('fbq("consent","revoke");',"")).toString("base64")};
              }
              return send(method,parameters);
            };
            return session;
          };
          return context;
        };
        return browser;
      };
      const {runNativeReference}=await import(${JSON.stringify(new URL("./native-tag-reference.mjs", import.meta.url).href)});
      console.log(JSON.stringify(await runNativeReference(${JSON.stringify({
        inputs: privateInputs, outputDir,
      })})));
    `], { timeout: 60000 });
    const report = JSON.parse(stdout);
    expect(report.overall).toBe("inconclusive");
    expect(report.controls.consent_negative_linked).toBe(false);
    const revoked = report.cases.find(row => row.name === "consent-revoked");
    expect(revoked.attempts).toBe(1);
    expect(revoked.configuration_fulfilled).toBe(1);
    expect(revoked.dependency_closed).toBe(false);
  }, 90000);

  it.runIf(privateInputs)("AC2/3: refuses a whole-URL configuration mismatch, with no path fallback", async () => {
    const parent = await directory();
    const manifest = JSON.parse(await readFile(privateInputs, "utf8"));
    const url = new URL(manifest.configuration.request_url);
    url.searchParams.set("airlock_test_mismatch", "1");
    manifest.configuration.request_url = url.href;
    const inputs = join(parent, "deliberately-invalid-provenance.json");
    await writeFile(inputs, JSON.stringify(manifest), { mode: 0o600 });
    const outputDir = join(parent, "mismatched");
    const report = await runNativeReference({ inputs, outputDir });
    expect(report.overall).toBe("inconclusive");
    expect(report.errors).toContain("missing_dependency");
    expect(report.capture_complete).toBe(false);
    const capture = JSON.parse(await readFile(join(outputDir, "capture.json"), "utf8"));
    expect(capture.requests.filter(row => row.category === "configuration" && row.locally_fulfilled)).toHaveLength(0);
  }, 90000);
});
