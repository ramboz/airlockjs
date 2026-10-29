import { mkdtemp, readdir, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./native-tag-comparison.mjs", async (original) => {
  const actual = await original();
  return { ...actual, inspectNativeAttempt: vi.fn(actual.inspectNativeAttempt) };
});

import { inspectNativeAttempt } from "./native-tag-comparison.mjs";
import * as adapters from "../adapters/google-ads-prototype.js";
import * as local from "./google-ads-conversion-prototype.mjs";
import { runGoogleAdsAttemptComparison } from "./google-ads-attempt-comparison.mjs";

const temporary = [];
const secret = "PRIVATE_SYNTHETIC_MARKER";
const pins = {
  profile: "google-ads-conversion", node_version: "test-node", browser_version: "test-browser",
  os_release: "test-os", macos_version: "test-macos", runtime_sha256: "a".repeat(64),
  configuration_sha256: null, network_policy_sha256: "b".repeat(64),
};

async function manifest() {
  const parent = await mkdtemp(join(await realpath(tmpdir()), "airlock-ads-attempt-"));
  temporary.push(parent);
  const inputs = join(parent, "inputs.json");
  const reference = Object.fromEntries(["report", "capture", "completion"].map((key) => [
    key, { path: join(parent, `${key}.json`), sha256: "a".repeat(64) },
  ]));
  const data = { schema: "airlock.google-ads-prototype-attempt-comparison.v1", reference, expected_pins: pins };
  await writeFile(inputs, JSON.stringify(data), { mode: 0o600 });
  return { inputs, data };
}

// Local, synthetic recorder-shaped input. The strict reader is mocked only in
// these integration controls; these values are never native-reference evidence.
function syntheticReference() {
  const source = { conversion_id: "AW-12345", conversion_label: secret };
  const cases = [];
  const requests = [];
  for (const [index, name] of ["baseline", "value1", "value2"].entries()) {
    const document_url = `https://fixture.invalid/${secret}?case=${name}`;
    const input = {
      send_to: `${source.conversion_id}/${source.conversion_label}`,
      value: index + 10, currency: "USD", transaction_id: `${secret}-${name}`,
    };
    cases.push({ name, document_url, synthetic_inputs: input,
      native_state: { conversion_input: structuredClone(input) } });
    const params = new URLSearchParams({
      label: source.conversion_label, value: String(input.value), currency_code: input.currency,
      oid: input.transaction_id, url: document_url,
    });
    for (let n = 0; n < 2; n += 1) {
      const url = `https://www.google.com/pagead/1p-conversion/12345/?${params}`;
      requests.push({ case: name, category: "native_measurement", url, query_pairs: [...params],
        headers: {}, body_state: "absent", body_base64: null, aborted: true, actual_vendor_response: false });
    }
    requests.push({ case: name, category: "native_auxiliary", aborted: true, actual_vendor_response: false });
  }
  return { capture: { source, cases, requests }, originals: [{ identity: "synthetic" }] };
}

afterEach(async () => {
  vi.restoreAllMocks();
  vi.mocked(inspectNativeAttempt).mockReset();
  for (const path of temporary.splice(0)) await rm(path, { recursive: true, force: true });
});

describe("offline Google prototype attempt comparison", () => {
  it("compares synthetic same-input attempts through real workers and closes all resources", async () => {
    const { inputs } = await manifest();
    const reference = syntheticReference();
    vi.mocked(inspectNativeAttempt).mockResolvedValue(reference);
    const result = await runGoogleAdsAttemptComparison({ inputs });
    expect(result).toMatchObject({
      overall: "inconclusive", comparison: "matched", exit_code: 0,
      counts: { cases: 3, native_primary_attempts: 6, native_auxiliary_attempts: 3,
        local_arrivals: 3, local_dispatches: 3, cleaned_cases: 3, field_comparisons: 30 },
      reference_rechecked: true,
    });
    expect(Object.values(result.claims).every((claim) => claim === false)).toBe(true);
    expect(JSON.stringify(result)).not.toContain(secret);
    expect(JSON.stringify(result)).not.toContain(inputs);
    expect(JSON.stringify(result)).not.toContain("://");
    expect(inspectNativeAttempt).toHaveBeenCalledTimes(2);
  }, 15000);

  it.each(["label", "value", "currency_code", "oid", "url"])(
    "reports a changed %s without leaking it and still closes the worker and receiver", async (field) => {
    const { inputs } = await manifest();
    const reference = syntheticReference();
    reference.capture.requests[0].query_pairs.find(([key]) => key === field)[1] = "999";
    vi.mocked(inspectNativeAttempt).mockResolvedValue(reference);
    const result = await runGoogleAdsAttemptComparison({ inputs });
    expect(result).toMatchObject({ overall: "nonconformant", comparison: "different", exit_code: 1,
      counts: { differences: 1, cleaned_cases: 3, local_arrivals: 3 } });
    expect(JSON.stringify(result)).not.toContain(secret);
    expect(JSON.stringify(result)).not.toContain("999");
  }, 15000);

  it("detects altered routing and duplicate native fields without exposing them", async () => {
    const { inputs } = await manifest();
    const reference = syntheticReference();
    reference.capture.requests[0].url = "https://fixture.invalid/unrelated";
    reference.capture.requests[1].query_pairs.push(["oid", secret]);
    vi.mocked(inspectNativeAttempt).mockResolvedValue(reference);
    const result = await runGoogleAdsAttemptComparison({ inputs });
    expect(result).toMatchObject({ overall: "nonconformant", comparison: "different",
      counts: { differences: 2, cleaned_cases: 3 } });
    expect(JSON.stringify(result)).not.toContain(secret);
    expect(JSON.stringify(result)).not.toContain("://");
  }, 15000);

  it("fails closed when the strict reader rejects a reference, without leaking the error", async () => {
    const { inputs } = await manifest();
    vi.mocked(inspectNativeAttempt).mockRejectedValue(new Error(secret));
    const result = await runGoogleAdsAttemptComparison({ inputs });
    expect(result).toMatchObject({ overall: "inconclusive", comparison: "not-completed", exit_code: 2,
      stage: "reference", counts: { local_arrivals: 0, cleaned_cases: 0 } });
    expect(JSON.stringify(result)).not.toContain(secret);
  });

  it("rejects prototype-ineligible reference inputs before opening a receiver", async () => {
    const { inputs } = await manifest();
    const reference = syntheticReference();
    reference.capture.source.conversion_id = `AW-${"1".repeat(21)}`;
    vi.mocked(inspectNativeAttempt).mockResolvedValue(reference);
    const receiver = vi.spyOn(local, "createConversionReceiver");
    const result = await runGoogleAdsAttemptComparison({ inputs });
    expect(result).toMatchObject({ overall: "inconclusive", stage: "reference-inputs", exit_code: 2,
      counts: { local_arrivals: 0, local_dispatches: 0 } });
    expect(receiver).not.toHaveBeenCalled();
  });

  it("rejects a changed reference after local runs, despite matching relationships", async () => {
    const { inputs } = await manifest();
    const first = syntheticReference();
    const changed = structuredClone(first);
    changed.originals[0].identity = "changed";
    vi.mocked(inspectNativeAttempt).mockResolvedValueOnce(first).mockResolvedValueOnce(changed);
    const result = await runGoogleAdsAttemptComparison({ inputs });
    expect(result).toMatchObject({ overall: "inconclusive", comparison: "not-completed", exit_code: 2,
      stage: "reference-recheck", reference_rechecked: false, counts: { cleaned_cases: 3 } });
  }, 15000);

  it("rejects unexpected manifest fields without examining reference handles", async () => {
    const { inputs, data } = await manifest();
    await writeFile(inputs, JSON.stringify({ ...data, extra: secret }), { mode: 0o600 });
    const result = await runGoogleAdsAttemptComparison({ inputs });
    expect(result).toMatchObject({ overall: "invalid_input", exit_code: 3, stage: "manifest" });
    expect(inspectNativeAttempt).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain(secret);
  });

  it("closes resources when the adapter fails after creation", async () => {
    const { inputs } = await manifest();
    vi.mocked(inspectNativeAttempt).mockResolvedValue(syntheticReference());
    const make = adapters.createGoogleAdsPrototype;
    vi.spyOn(adapters, "createGoogleAdsPrototype").mockImplementationOnce((options) => {
      const instance = make(options);
      return { ...instance, gtag() { throw new Error(secret); } };
    });
    const result = await runGoogleAdsAttemptComparison({ inputs });
    expect(result).toMatchObject({ overall: "inconclusive", comparison: "not-completed",
      stage: "local", counts: { cleaned_cases: 1 } });
    expect(JSON.stringify(result)).not.toContain(secret);
  }, 15000);

  it("fails rather than reporting a match if a conversion produces no receiver arrival", async () => {
    const { inputs } = await manifest();
    vi.mocked(inspectNativeAttempt).mockResolvedValue(syntheticReference());
    const make = adapters.createGoogleAdsPrototype;
    vi.spyOn(adapters, "createGoogleAdsPrototype").mockImplementationOnce((options) => {
      const instance = make(options);
      return { ...instance, gtag(...args) { if (args[0] !== "event") instance.gtag(...args); } };
    });
    const result = await runGoogleAdsAttemptComparison({ inputs });
    expect(result).toMatchObject({ overall: "inconclusive", comparison: "not-completed",
      stage: "local", counts: { local_arrivals: 0, cleaned_cases: 1 } });
  }, 15000);

  it("rejects a foreign receiver endpoint and closes the partially created resources", async () => {
    const { inputs } = await manifest();
    vi.mocked(inspectNativeAttempt).mockResolvedValue(syntheticReference());
    const close = vi.fn(async () => {});
    vi.spyOn(local, "createConversionReceiver").mockResolvedValueOnce({
      endpoint: "https://fixture.invalid/private", arrivals: [], close,
      getState: () => ({ listening: false, openSockets: 0 }),
    });
    const makeChamber = local.createNodeConversionChamber;
    let chamber;
    vi.spyOn(local, "createNodeConversionChamber").mockImplementationOnce(() => {
      chamber = makeChamber();
      return chamber;
    });
    const result = await runGoogleAdsAttemptComparison({ inputs });
    expect(result).toMatchObject({ overall: "inconclusive", stage: "local",
      counts: { local_arrivals: 0, local_dispatches: 0 } });
    expect(close).toHaveBeenCalledOnce();
    expect(chamber.getState().closed).toBe(true);
    expect(JSON.stringify(result)).not.toContain("fixture.invalid");
  }, 15000);

  it("reports cleanup failures rather than returning a successful comparison", async () => {
    const { inputs } = await manifest();
    vi.mocked(inspectNativeAttempt).mockResolvedValue(syntheticReference());
    const close = local.closeConversionResources;
    vi.spyOn(local, "closeConversionResources").mockImplementationOnce(async (resources) => {
      await close(resources);
      throw new Error(secret);
    });
    const result = await runGoogleAdsAttemptComparison({ inputs });
    expect(result).toMatchObject({ overall: "inconclusive", comparison: "not-completed",
      stage: "cleanup", exit_code: 2 });
    expect(JSON.stringify(result)).not.toContain(secret);
  }, 15000);

  it("uses the actual strict reader in the CLI and emits no input paths on rejection", async () => {
    const { inputs } = await manifest();
    const entry = fileURLToPath(new URL("./google-ads-attempt-comparison.mjs", import.meta.url));
    const failure = await promisify(execFile)(process.execPath, [entry, "--inputs", inputs]).catch((error) => error);
    expect(failure.code).toBe(2);
    expect(JSON.parse(failure.stdout)).toMatchObject({ overall: "inconclusive",
      comparison: "not-completed", stage: "reference" });
    expect(failure.stdout + failure.stderr).not.toContain(inputs);
    expect(failure.stdout + failure.stderr).not.toContain("://");
  });

  it("does not persist results or modify the caller's manifest", async () => {
    const { inputs } = await manifest();
    const before = await readFile(inputs);
    const names = await readdir(join(inputs, ".."));
    vi.mocked(inspectNativeAttempt).mockResolvedValue(syntheticReference());
    await runGoogleAdsAttemptComparison({ inputs });
    expect(await readFile(inputs)).toEqual(before);
    expect(await readdir(join(inputs, ".."))).toEqual(names);
  }, 15000);
});
