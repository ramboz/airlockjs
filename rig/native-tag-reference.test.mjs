import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { runInNewContext } from "node:vm";
import { afterEach, describe, expect, it } from "vitest";
import { runNativeReference } from "./native-tag-reference.mjs";

const execute = promisify(execFile);
const digest = bytes => createHash("sha256").update(bytes).digest("hex");
const entry = fileURLToPath(new URL("./native-tag-reference.mjs", import.meta.url));
const privateInputs = process.env.AIRLOCK_META_REFERENCE_INPUTS;
const googleInputs = process.env.AIRLOCK_GOOGLE_REFERENCE_INPUTS;
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

async function syntheticGoogle() {
  const fixture = await synthetic();
  const { runtime, owned_origin, document_url, authorization } = fixture.manifest;
  fixture.manifest = {
    schema_version: 1, profile: "google-ads-conversion", owned_origin, document_url,
    conversion_id: "AW-123456789", conversion_label: "Synthetic_Label-1",
    runtime: { ...runtime, request_url: "https://www.googletagmanager.com/gtag/js?id=AW-123456789" },
    dependencies: [], source_capture_sha256: "a".repeat(64),
    source_acquisition_sha256: "b".repeat(64), authorization,
  };
  fixture.save = () => writeFile(fixture.inputs, JSON.stringify(fixture.manifest), { mode: 0o600 });
  await fixture.save();
  return fixture;
}

// Exercise the actual pure parser/fixture/grader functions without exporting a
// second production API or executing any browser/SDK. Synthetic rows below are
// unit controls, NEVER evidence that a native Google reference qualified.
async function referenceInternals() {
  const source = await readFile(entry, "utf8");
  return import(`data:text/javascript;base64,${Buffer.from(source.replaceAll(
    "import.meta.url", JSON.stringify(new URL("./native-tag-reference.mjs", import.meta.url).href),
  ) + "\nexport { fixture, classification, gradeCases, googleInputRelationship, googleAuxiliaryRelationship };").toString("base64")}`);
}

describe("bounded offline Google conversion reference — synthetic unit controls, not native proof", () => {
  it.each([
    ["bad_id", m => { m.conversion_id = "G-123"; }, "invalid_conversion_selector"],
    ["bad_label", m => { m.conversion_label = "label/other"; }, "invalid_conversion_selector"],
    ["missing_label", m => { delete m.conversion_label; }, "missing_manifest_field"],
    ["bad_acquisition", m => { m.source_acquisition_sha256 = "private-marker"; }, "invalid_source_digest"],
    ["bad_origin", m => { m.document_url = "https://other.invalid"; }, "owned_origin_mismatch"],
    ["bad_runtime", m => { m.runtime.request_url = "https://other.invalid/gtag/js?id=AW-123456789"; }, "invalid_runtime_url"],
    ["wrong_id", m => { m.runtime.request_url += "0"; }, "invalid_runtime_url"],
    ["duplicate_id", m => { m.runtime.request_url += "&id=AW-123456789"; }, "invalid_runtime_url"],
    ["bad_path", m => { m.runtime.request_url = m.runtime.request_url.replace("/gtag/js", "/gtag/js/other"); }, "invalid_runtime_url"],
    ["measurement_resource", m => { m.runtime.request_url = "https://www.google.com/pagead/1p-conversion/123456789/"; }, "invalid_runtime_url"],
    ["bad_status", m => { m.runtime.response_status = 302; }, "invalid_source_status"],
    ["bad_dependencies", m => { m.dependencies = {}; }, "invalid_dependencies"],
    ["bad_dependency_selector", m => { m.dependencies = [{ ...m.runtime,
      request_url: "https://www.googletagmanager.com/gtag/destination?id=AW-987654321" }]; }, "invalid_dependency_url"],
    ["missing_bytes", m => { m.runtime.path += ".missing"; }, "resource_unavailable"],
    ["changed_bytes", m => { m.runtime.sha256 = "c".repeat(64); }, "resource_hash_mismatch"],
    ["claimed_official_pin", m => {
      m.runtime.sha256 = "318a26b825f07b60faec698d5e771434c36e3f7f248640988c1c0be5220c3e50";
    }, "resource_hash_mismatch"],
  ])("AC2/4/6: refuses %s before browser acquisition", async (_name, mutate, category) => {
    const f = await syntheticGoogle();
    mutate(f.manifest);
    await f.save();
    const report = await runNativeReference({ inputs: f.inputs, outputDir: f.outputDir });
    expect(report.errors).toContain(category);
    expect(report.exit_code).toBe(category.startsWith("resource_") ? 2 : 3);
    expect(report.browser_version).toBe(null);
    expect(report.counts.attempts).toBe(0);
    expect(JSON.stringify(report)).not.toContain(f.parent);
    expect(JSON.stringify(report)).not.toContain(f.manifest.conversion_id);
    expect(JSON.stringify(report)).not.toContain("private-marker");
  });

  it("AC2/6/7: a self-hashed wrong/no-op Google SDK never impersonates the fixed native pin", async () => {
    const f = await syntheticGoogle();
    const report = await runNativeReference({ inputs: f.inputs, outputDir: f.outputDir });
    expect(report.profile).toBe("google-ads-conversion");
    expect(report.errors).toContain("unqualified_native_resource");
    expect(report.overall).toBe("inconclusive");
    expect(report.browser_version).toBe(null);
    expect(report.cases).toEqual([]);
    expect(report.counts).toEqual({
      attempts: 0, recorded_requests: 0, native_auxiliaries: 0, total_native_attempts: 0,
    });
    expect(report.evidence_layer).toBe("native_attempt");
    expect(report.controls.consent_negative_linked).toBe(false);
    expect(report.not_proved).toContain("google_consent_states_and_transitions");
    expect(report.not_proved).toContain("auxiliary_auid_correlation_not_independent_ownership_authentication");
    expect(report.not_proved).toContain("auxiliary_complete_initiator_proof");
    expect(Object.values(report.claims).every(value => value === false)).toBe(true);
    expect(JSON.stringify(report)).not.toContain(f.manifest.conversion_label);
    expect(JSON.stringify(report)).not.toContain("https://");
  });

  it("AC2: CLI selects Google only through the fixed private manifest, without a script/profile override", async () => {
    const f = await syntheticGoogle();
    const failure = await execute(process.execPath, [entry, "--inputs", f.inputs,
      "--output-dir", f.outputDir]).catch(error => error);
    expect(failure.code).toBe(2);
    expect(JSON.parse(failure.stdout).profile).toBe("google-ads-conversion");
    expect(JSON.parse(failure.stdout).errors).toContain("unqualified_native_resource");
    expect(failure.stdout + failure.stderr).not.toContain(f.manifest.conversion_id);
  });

  it("AC3: refuses an unqualified Google headless cohort before any browser/native code", async () => {
    const f = await syntheticGoogle();
    const report = await runNativeReference({ inputs: f.inputs, outputDir: f.outputDir,
      mode: "headless-diagnostic" });
    expect(report.overall).toBe("inconclusive");
    expect(report.errors).toContain("google_headed_cohort_required");
    expect(report.profile).toBe("google-ads-conversion");
    expect(report.browser_version).toBe(null);
    expect(report.counts.attempts).toBe(0);
  });

  it("AC4/5: generates standard js/config/event conversion commands and a genuine query-disabled fixture", async () => {
    const f = await syntheticGoogle();
    const { fixture } = await referenceInternals();
    const commands = [];
    const scripts = [];
    const window = { dataLayer: [] };
    const sandbox = { window, URLSearchParams, Date,
      trustedTypes: { createPolicy: (_name, policy) => policy },
      location: { search: "?case=value1" },
      document: {
        createElement: () => ({}),
        getElementsByTagName: () => [{ parentNode: { insertBefore: script => scripts.push(script) } }],
      },
    };
    // Standard gtag reads the global dataLayer, just like a browser global.
    Object.defineProperty(sandbox, "dataLayer", { get: () => window.dataLayer });
    const html = fixture(f.manifest, "value1", "synthetic-nonce").toString();
    expect(html).toContain("Generated offline fixture");
    expect(html).not.toContain("fbq(");
    runInNewContext(html.match(/<script nonce="[^"]+">([\s\S]*)<\/script>/)[1], sandbox);
    commands.push(...window.dataLayer.map(args => [...args]));
    expect(commands.map(args => args[0])).toEqual(["js", "config", "event"]);
    expect(commands[1][1]).toBe(f.manifest.conversion_id);
    expect(commands[2]).toEqual(["event", "conversion", {
      send_to: `${f.manifest.conversion_id}/${f.manifest.conversion_label}`,
      value: 13.25, currency: "USD", transaction_id: "airlock-native-reference-value1",
    }]);
    expect(scripts.map(script => script.src)).toEqual([f.manifest.runtime.request_url]);
    window.dataLayer = [];
    scripts.length = 0;
    sandbox.location.search = "?case=query-disabled&native=disabled";
    const off = fixture(f.manifest, "query-disabled", "synthetic-nonce").toString();
    runInNewContext(`{${off.match(/<script nonce="[^"]+">([\s\S]*)<\/script>/)[1]}}`, sandbox);
    expect(window.dataLayer).toEqual([]);
    expect(scripts).toEqual([]);
  });

  it("AC3/4/5: fulfills only exact resources; unknown auxiliaries and foreign destinations remain blocked", async () => {
    const f = await syntheticGoogle();
    const { classification } = await referenceInternals();
    const classify = (url, type = "Image") => classification(url, type, f.manifest,
      f.manifest.document_url, null, "GET", "absent");
    expect(classify(f.manifest.runtime.request_url, "Script")).toBe("runtime");
    expect(classify(f.manifest.runtime.request_url + "&other=1", "Script")).toBe("missing_dependency");
    for (const url of [
      "https://www.googleadservices.com/pagead/conversion/123456789/?label=Synthetic_Label-1",
      "https://www.google.com/pagead/1p-conversion/123456789/?label=Synthetic_Label-1",
    ]) expect(classify(url)).toBe("native_measurement");
    for (const url of [
      "https://www.google.com/pagead/1p-conversion/987654321/",
      "https://www.google.com/unknown?tid=AW-123456789",
      "https://other.invalid/pagead/conversion/123456789/",
      "https://www.google.com/ccm/collect?tid=AW-123456789",
    ]) expect(classify(url)).toBe("unknown_auxiliary");
    const source = await readFile(entry, "utf8");
    expect(source).not.toContain("Fetch.continueRequest");
  });

  it("AC6: checks actual native input commands exactly, privately, with deliberately distinct value1/value2 inputs", async () => {
    const f = await syntheticGoogle();
    const { googleInputRelationship } = await referenceInternals();
    const first = { send_to: `${f.manifest.conversion_id}/${f.manifest.conversion_label}`,
      value: 13.25, currency: "USD", transaction_id: "airlock-native-reference-value1" };
    const second = { ...first, value: 29.75, transaction_id: "airlock-native-reference-value2" };
    expect(googleInputRelationship(first, f.manifest, "value1")).toBe(true);
    expect(googleInputRelationship(second, f.manifest, "value2")).toBe(true);
    for (const input of [null, {}, first, { ...second, value: "29.75" },
      { ...second, value: undefined }, { ...second, currency: "EUR" },
      { ...second, send_to: "AW-987654321/wrong" },
      { ...second, transaction_id: first.transaction_id }]) {
      expect(googleInputRelationship(input, f.manifest, "value2")).toBe(false);
    }
  });

  async function auxiliaryFixture() {
    const f = await syntheticGoogle();
    const { classification, googleAuxiliaryRelationship } = await referenceInternals();
    const doc = `${f.manifest.owned_origin}/__airlock_native_reference_fixture__?case=baseline`;
    const make = (base, method, resource_type, parameters) => {
      const url = new URL(base);
      Object.entries(parameters).forEach(([key, value]) => url.searchParams.set(key, value));
      return { url: url.href, query_pairs: [...url.searchParams], method, resource_type,
        case: "baseline", category: "native_auxiliary", body_state: "absent", headers: {},
        aborted: true, locally_fulfilled: false };
    };
    const primary = make("https://www.googleadservices.com/pagead/conversion/123456789/", "POST", "XHR",
      { label: f.manifest.conversion_label, value: "13.25", currency_code: "USD",
        oid: "airlock-native-reference-baseline", url: doc, auid: "synthetic-owned-auid" });
    primary.category = "native_measurement";
    const pairs = [
      ["https://googleads.g.doubleclick.net/pagead/viewthroughconversion/123456789/", "GET", "Script",
        { url: doc, auid: "synthetic-owned-auid", en: "gtag.config" }],
      ["https://googleads.g.doubleclick.net/pagead/viewthroughconversion/123456789/", "GET", "Image",
        { url: doc, auid: "synthetic-owned-auid", en: "gtag.config" }],
      ["https://www.google.com/rmkt/collect/123456789/", "POST", "XHR",
        { url: doc, auid: "synthetic-owned-auid", en: "gtag.config" }],
      ["https://www.google.com/rmkt/collect/123456789/", "GET", "Image",
        { url: doc, auid: "synthetic-owned-auid", en: "gtag.config" }],
      ["https://www.google.com/ccm/collect", "POST", "XHR",
        { dl: doc, tid: f.manifest.conversion_id, tids: f.manifest.conversion_id,
          auid: "synthetic-owned-auid", en: "page_view" }],
      ["https://www.google.com/ccm/collect", "GET", "Image",
        { dl: doc, tid: f.manifest.conversion_id, tids: f.manifest.conversion_id,
          auid: "synthetic-owned-auid", en: "page_view" }],
      ["https://ad.doubleclick.net/ccm/s/collect", "POST", "XHR", { auid: "synthetic-owned-auid" }],
      ["https://ad.doubleclick.net/ccm/s/collect", "GET", "Image", { auid: "synthetic-owned-auid" }],
    ];
    return { f, primary, rows: pairs.map(args => make(...args)),
      classify: row => classification(row.url, row.resource_type, f.manifest, doc,
        null, row.method, row.body_state),
      linked: (row, primaries = [primary]) => googleAuxiliaryRelationship(row, f.manifest, primaries) };
  }

  it("AC3/5: catalogs only observed auxiliary shapes; Script measurement is aborted, not a fulfilled dependency", async () => {
    const { rows, classify, linked, primary } = await auxiliaryFixture();
    for (const row of rows) {
      expect(classify(row)).toBe("native_auxiliary");
      // Two owned primaries sharing ONE identity do not create ambiguity.
      expect(linked(row, [primary, { ...primary }])).toBe(true);
      expect(row.aborted && !row.locally_fulfilled).toBe(true);
      expect(classify({ ...row, method: "PUT" })).not.toBe("native_auxiliary");
      expect(classify({ ...row, resource_type: "Document" })).not.toBe("native_auxiliary");
      expect(classify({ ...row, body_state: "captured" })).not.toBe("native_auxiliary");
    }
    expect(linked(rows[6], [...rows, primary])).toBe(true);
  });

  it.each(["wrong_owned_path", "foreign_origin", "unlinked_auid", "duplicate_auid", "empty_auid",
    "foreign_primary", "ambiguous_primary", "duplicate_primary_auid", "other_case", "missing_tid",
    "missing_tids", "duplicate_tid", "foreign_tids", "wrong_document", "duplicate_document", "fulfilled_auxiliary"])(
    "AC5: %s cannot qualify auxiliary ownership/correlation", async mutation => {
      const { rows, linked, primary } = await auxiliaryFixture();
      let row = { ...rows[mutation.includes("tid") ? 4 : mutation.includes("path") ? 0 : 6] };
      const data = new URLSearchParams(row.query_pairs);
      let primaries = [primary];
      if (mutation === "wrong_owned_path") row.url = row.url.replace("123456789/", "987654321/");
      if (mutation === "foreign_origin") row.url = row.url.replace("ad.doubleclick.net", "other.invalid");
      if (mutation === "unlinked_auid") data.set("auid", "unlinked");
      if (mutation === "duplicate_auid") data.append("auid", "synthetic-owned-auid");
      if (mutation === "empty_auid") data.set("auid", "");
      if (mutation === "foreign_primary") primaries = [{ ...primary,
        url: primary.url.replace("123456789/", "987654321/") }];
      if (mutation === "ambiguous_primary") primaries.push({ ...primary,
        query_pairs: [...primary.query_pairs.filter(([key]) => key !== "auid"), ["auid", "different"]] });
      if (mutation === "duplicate_primary_auid") primaries = [{ ...primary,
        query_pairs: [...primary.query_pairs, ["auid", "synthetic-owned-auid"]] }];
      if (mutation === "other_case") primaries = [{ ...primary, case: "value1" }];
      if (mutation === "missing_tid") data.delete("tid");
      if (mutation === "missing_tids") data.delete("tids");
      if (mutation === "duplicate_tid") data.append("tid", "AW-123456789");
      if (mutation === "foreign_tids") data.set("tids", "AW-987654321");
      if (mutation === "wrong_document") data.set("dl", "https://other.invalid");
      if (mutation === "duplicate_document") { data.set("dl", "https://fixture.invalid"); data.append("dl", "other"); }
      if (mutation === "fulfilled_auxiliary") row.locally_fulfilled = true;
      row.query_pairs = [...data];
      expect(linked(row, primaries)).toBe(false);
    });

  async function graded(mutate = () => {}) {
    const f = await syntheticGoogle();
    const { gradeCases } = await referenceInternals();
    const names = ["baseline", "query-disabled", "value1", "value2"];
    const errors = new Set();
    const state = {
      result: { run_id: "synthetic-unit-only", cases: names.map(name => ({
        name, attempts: name === "query-disabled" ? 0 : 2, auxiliary_attempts: 0,
        dependency_closed: true, qualified_positive_reference: name !== "query-disabled",
      })), controls: { consent_negative_linked: false } },
      requests: [], fail: category => errors.add(category),
    };
    for (const name of ["baseline", "value1", "value2"]) {
      for (const host of ["www.googleadservices.com/pagead/conversion", "www.google.com/pagead/1p-conversion"]) {
        const url = new URL(`https://${host}/123456789/`);
        const query = { label: f.manifest.conversion_label, value: name === "value2" ? "29.75" : "13.25",
          currency_code: "USD", oid: `airlock-native-reference-${name}`,
          url: `${f.manifest.owned_origin}/__airlock_native_reference_fixture__?case=${name}` };
        Object.entries(query).forEach(([key, value]) => url.searchParams.set(key, value));
        state.requests.push({ case: name, category: "native_measurement", url: url.href,
          query_pairs: [...url.searchParams], body_state: "absent", headers: {}, aborted: true });
      }
    }
    mutate(state);
    gradeCases(state, f.manifest);
    return { state, errors };
  }

  it("AC5/6: exact private value/action/currency/transaction relationships accept multiple primary attempts, not a fixed host/count", async () => {
    const { state, errors } = await graded();
    expect([...errors]).toEqual([]);
    expect(state.result.controls).toMatchObject({
      disabled_linked: true, consent_negative_linked: false, value_contrast: true,
    });
    expect(state.result.cases.every(row => row.qualified_positive_run_id === "synthetic-unit-only")).toBe(true);
  });

  it("AC6: wire-shaped values cannot qualify contrast when native input/execution evidence failed", async () => {
    const { state, errors } = await graded(state => {
      state.result.cases.find(row => row.name === "value2").qualified_positive_reference = false;
    });

    expect(errors.has("missing_or_ambiguous_positive")).toBe(true);
    expect(state.result.controls.value_contrast).toBe(false);
  });

  it("AC5: query-disabled cannot hide native auxiliaries behind zero primary attempts", async () => {
    const { state, errors } = await graded(state => {
      state.requests.push({ case: "query-disabled", category: "native_auxiliary" });
      state.result.cases[1].auxiliary_attempts = 1;
    });
    expect(errors.has("disabled_control_unqualified")).toBe(true);
    expect(state.result.controls.disabled_linked).toBe(false);
  });

  it.each(["changed_value", "missing_value", "collapsed_values", "wrong_label", "wrong_currency",
    "wrong_transaction", "wrong_document", "duplicate_value", "empty_positive", "disabled_attempt"])(
    "AC5/6: %s cannot qualify synthetic relationship controls", async mutation => {
      const { state, errors } = await graded(state => {
        const row = state.requests.find(row => row.case === "value2");
        const data = new URLSearchParams(row.query_pairs);
        if (mutation === "changed_value") data.set("value", "99");
        if (mutation === "missing_value") data.delete("value");
        if (mutation === "collapsed_values") data.set("value", "13.25");
        if (mutation === "wrong_label") data.set("label", "wrong");
        if (mutation === "wrong_currency") data.set("currency_code", "EUR");
        if (mutation === "wrong_transaction") data.set("oid", "airlock-native-reference-value1");
        if (mutation === "wrong_document") data.set("url", "https://other.invalid");
        if (mutation === "duplicate_value") data.append("value", "29.75");
        row.query_pairs = [...data];
        if (mutation === "empty_positive") {
          state.requests = state.requests.filter(row => row.case !== "baseline");
          Object.assign(state.result.cases[0], { attempts: 0, qualified_positive_reference: false });
        }
        if (mutation === "disabled_attempt") state.result.cases[1].attempts = 1;
      });
      expect(errors.size).toBeGreaterThan(0);
      if (mutation !== "disabled_attempt") {
        expect(state.result.controls.value_contrast).toBe(false);
      } else expect(state.result.controls.disabled_linked).toBe(false);
    });

});

describe("actual Google native qualification — explicit private inputs required", () => {
  it.runIf(googleInputs)("AC2–8: actual pinned Google native matrix (explicit opt-in, never synthetic proof)", async () => {
    const parent = await directory();
    const outputDir = join(parent, "google-native");
    const report = await runNativeReference({ inputs: googleInputs, outputDir });
    if (report.overall !== "qualified") temporary.splice(temporary.indexOf(parent), 1);
    expect(report.overall, `${report.errors.join(",")}; retained diagnostic: ${outputDir}`).toBe("qualified");
    expect(report.profile).toBe("google-ads-conversion");
    expect(report.evidence_layer).toBe("native_attempt");
    expect(report.cases.map(row => row.name)).toEqual(["baseline", "query-disabled", "value1", "value2"]);
    expect(report.cases.filter(row => row.name !== "query-disabled")
      .every(row => row.attempts > 0 && row.qualified_positive_reference)).toBe(true);
    expect(report.controls).toEqual({
      disabled_linked: true, consent_negative_linked: false, value_contrast: true,
    });
    expect(report.guard.qualified).toBe(true);
    expect(report.capture_complete).toBe(true);
    expect(report.not_proved).toContain("google_consent_states_and_transitions");
    expect(Object.values(report.claims).every(value => value === false)).toBe(true);
    const capture = JSON.parse(await readFile(join(outputDir, "capture.json"), "utf8"));
    expect(capture.requests.every(row => row.locally_fulfilled || row.aborted)).toBe(true);
    expect(capture.requests.filter(row => row.category === "native_measurement")
      .every(row => row.aborted && !row.actual_vendor_response)).toBe(true);
    const auxiliaries = capture.requests.filter(row => row.category === "native_auxiliary");
    expect(auxiliaries.length).toBeGreaterThan(0);
    expect(auxiliaries.every(row => row.aborted && !row.locally_fulfilled && !row.actual_vendor_response)).toBe(true);
    expect(auxiliaries.every(row => row.native_relationship.same_case_owned_primary_correlated
      && !row.native_relationship.independent_ownership_authentication
      && !row.native_relationship.complete_initiator_proof
      && !row.native_relationship.authorizes_dispatch
      && !row.native_relationship.authorizes_fulfillment)).toBe(true);
    expect(report.counts.native_auxiliaries).toBe(auxiliaries.length);
    expect(report.counts.total_native_attempts).toBe(report.counts.attempts + auxiliaries.length);
    expect(report.cases.every(row => row.total_native_attempts === row.attempts + row.auxiliary_attempts)).toBe(true);
    expect(report.cases.find(row => row.name === "query-disabled").auxiliary_attempts).toBe(0);
    expect(capture.cases.filter(row => ["baseline", "value1", "value2"].includes(row.name))
      .every(row => row.native_state.destination_initialized && row.native_state.conversion_input)).toBe(true);
    // Booleans avoid assertion printers ever echoing private owned selectors.
    const manifest = JSON.parse(await readFile(googleInputs, "utf8"));
    const publicText = JSON.stringify(report);
    expect([manifest.conversion_id, manifest.conversion_label, manifest.owned_origin, parent]
      .every(value => !publicText.includes(value))).toBe(true);
  }, 90000);

  for (const mutation of ["changed", "missing"]) {
    it.runIf(googleInputs)(`AC6: actual native ${mutation}-value fixture cannot qualify (native bytes unchanged)`, async () => {
      const parent = await directory();
      const outputDir = join(parent, `google-native-${mutation}`);
      let stdout;
      try {
        ({ stdout } = await execute(process.execPath, ["--input-type=module", "-e", `
          import {chromium} from "playwright";
          let mutated=0;
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
                    .some(h=>h.name==="Content-Type"&&h.value.startsWith("text/html"))){
                    const html=Buffer.from(parameters.body,"base64").toString("utf8");
                    if(html.includes('airlock-native-reference-value2') && html.includes('"value":29.75,')){
                      mutated++;
                      parameters={...parameters,body:Buffer.from(html.replace('"value":29.75,',
                        ${JSON.stringify(mutation === "changed" ? '"value":13.25,' : "")})).toString("base64")};
                    }
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
          const report=await runNativeReference(${JSON.stringify({ inputs: googleInputs, outputDir })});
          console.log(JSON.stringify({report,mutated}));
        `], { timeout: 65000, maxBuffer: 32768 }));
      } catch {
        throw new Error("google_native_mutation_process_failed");
      }
      const { report, mutated } = JSON.parse(stdout);
      expect(mutated).toBe(1); // An earlier blocked baseline is NOT passing mutation evidence.
      expect(report.overall).toBe("inconclusive");
      expect(report.errors).toContain("native_input_relationship_mismatch");
      expect(report.controls.value_contrast).toBe(false);
      expect(report.cleanup.owned_processes_exited).toBe(true);
    }, 90000);
  }
});

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
