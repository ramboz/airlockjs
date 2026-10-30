import { request as httpRequest } from "node:http";
import { pathToFileURL } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { createGoogleAdsPrototype } from "../adapters/google-ads-prototype.js";
import { evidenceSession, keys } from "./attempt-evidence-io.mjs";
import { inspectNativeAttempt } from "./native-tag-comparison.mjs";
import { closeConversionResources, createConversionReceiver, createNodeConversionChamber } from "./google-ads-conversion-prototype.mjs";

const SCHEMA = "airlock.google-ads-prototype-attempt-comparison.v1";
const CASES = ["baseline", "value1", "value2"];
const FIELDS = ["label", "value", "currency_code", "oid", "url"];

class CleanupFailure extends Error {}

function result() {
  return {
    schema: SCHEMA, overall: "inconclusive", comparison: "not-completed", exit_code: 2,
    stage: "manifest", reference_rechecked: false,
    counts: { cases: 0, native_primary_attempts: 0, native_auxiliary_attempts: 0,
      local_arrivals: 0, local_dispatches: 0, cleaned_cases: 0, field_comparisons: 0, differences: 0 },
    claims: { native_dispatch: false, native_response: false, native_consent_equivalence: false,
      auxiliary_coverage: false, complete_wire: false, vendor_receipt: false, full_compatibility: false },
  };
}

function preflight(capture) {
  const { source, cases, requests } = capture;
  if (!/^AW-\d{1,32}$/.test(source?.conversion_id) ||
      !/^[A-Za-z0-9_-]{1,128}$/.test(source?.conversion_label) ||
      !Array.isArray(cases) || !Array.isArray(requests)) throw new Error("unsupported-reference");
  return CASES.map((name) => {
    const matches = cases.filter((row) => row.name === name);
    if (matches.length !== 1) throw new Error("unsupported-reference");
    const row = matches[0], input = row.synthetic_inputs;
    if (!input || !isDeepStrictEqual(input, row.native_state?.conversion_input) ||
        !isDeepStrictEqual(Object.keys(input).sort(), ["currency", "send_to", "transaction_id", "value"]) ||
        input.send_to !== `${source.conversion_id}/${source.conversion_label}` ||
        typeof input.value !== "number" || !Number.isFinite(input.value) ||
        typeof input.currency !== "string" || input.currency.length > 64 || !input.currency.isWellFormed() ||
        typeof input.transaction_id !== "string" || input.transaction_id.length > 128 || !input.transaction_id.isWellFormed() ||
        typeof row.document_url !== "string" || row.document_url.length > 2048 || !row.document_url.isWellFormed() ||
        !/^https?:\/\//.test(row.document_url) ||
        // eslint-disable-next-line no-control-regex -- reject URL control characters before dispatch.
        /[\s\u0000-\u001f\u007f]/u.test(row.document_url)) throw new Error("unsupported-reference");
    const document = new URL(row.document_url);
    if (document.username || document.password) throw new Error("unsupported-reference");
    const attempts = requests.filter((item) => item.case === name && item.category === "native_measurement");
    const auxiliaries = requests.filter((item) => item.case === name && item.category === "native_auxiliary");
    if (!attempts.length || ![...attempts, ...auxiliaries].every((item) =>
      item.aborted === true && item.actual_vendor_response === false)) throw new Error("unsupported-reference");
    return { row, attempts, auxiliaries };
  });
}

function nativeFields(row) {
  const pairs = [...row.query_pairs];
  if (row.body_state === "captured" && row.body_base64 && Object.entries(row.headers).some(([key, value]) =>
    key.toLowerCase() === "content-type" && value.startsWith("application/x-www-form-urlencoded"))) {
    pairs.push(...new URLSearchParams(Buffer.from(row.body_base64, "base64").toString("utf8")));
  }
  return new URLSearchParams(pairs);
}

function compare(localUrl, nativeRow, row, source, endpoint) {
  const local = new URL(localUrl), native = new URL(nativeRow.url), localBase = new URL(endpoint);
  const id = source.conversion_id.slice(3);
  const nativeRoute = !native.username && !native.password && !native.hash &&
    ((native.origin === "https://www.googleadservices.com" && native.pathname === `/pagead/conversion/${id}/`) ||
     (native.origin === "https://www.google.com" && native.pathname === `/pagead/1p-conversion/${id}/`));
  const localRoute = local.origin === localBase.origin && local.pathname === `/pagead/conversion/${id}/` &&
    !local.username && !local.password && !local.hash;
  const nativeParams = nativeFields(nativeRow), localParams = local.searchParams;
  const expected = { label: source.conversion_label, value: String(row.synthetic_inputs.value),
    currency_code: row.synthetic_inputs.currency, oid: row.synthetic_inputs.transaction_id, url: row.document_url };
  let differences = Number(!nativeRoute || !localRoute || [...localParams.keys()].length !== FIELDS.length);
  for (const field of FIELDS) {
    if (nativeParams.getAll(field).length !== 1 || localParams.getAll(field).length !== 1 ||
        nativeParams.get(field) !== expected[field] || localParams.get(field) !== nativeParams.get(field)) differences += 1;
  }
  return differences;
}

// Use direct Node HTTP rather than a proxy-aware fetch implementation.
function loopbackTransport(endpoint) {
  const expected = new URL(endpoint);
  if (expected.protocol !== "http:" || expected.hostname !== "127.0.0.1" ||
      !expected.port || expected.username || expected.password || expected.search || expected.hash) {
    throw new Error("loopback-policy");
  }
  return (raw, options) => new Promise((resolve, reject) => {
    let target;
    try { target = new URL(raw); } catch { reject(new Error("loopback-policy")); return; }
    if (target.origin !== expected.origin || target.pathname !== expected.pathname || target.username ||
        target.password || target.hash || options.method !== "GET" || options.credentials !== "omit" ||
        options.redirect !== "error") { reject(new Error("loopback-policy")); return; }
    const request = httpRequest({ hostname: "127.0.0.1", port: Number(expected.port),
      path: target.pathname + target.search, method: "GET", agent: false, signal: options.signal }, (response) => {
      response.resume();
      response.on("end", () => resolve({ status: response.statusCode, body: null }));
      response.on("error", reject);
    });
    request.on("error", reject);
    request.end();
  });
}

async function localCase(capture, item, counts) {
  let receiver, chamber, adapter, cause, observed;
  try {
    receiver = await createConversionReceiver({ conversionId: capture.source.conversion_id.slice(3) });
    chamber = createNodeConversionChamber();
    const probe = await chamber.probe;
    if (!probe?.ambientFetchDenied || !(probe.threadId > 0)) throw new Error("worker-probe");
    adapter = createGoogleAdsPrototype({
      endpoint: receiver.endpoint, chamber, experimentalRouting: true, consent: { ad_storage: "granted" },
      captureContext: () => ({ pageURL: item.row.document_url, referrer: "" }),
      fetchImpl: loopbackTransport(receiver.endpoint),
    });
    adapter.gtag("config", capture.source.conversion_id);
    const configured = await adapter.flush();
    if (configured.outcomes.length !== 1 || configured.outcomes[0].disposition !== "configured" ||
        receiver.arrivals.length !== 0 || configured.host.dispatchAttempts !== 0) throw new Error("config-control");
    adapter.gtag("event", "conversion", item.row.synthetic_inputs);
    const settled = await adapter.flush();
    if (settled.outcomes.length !== 2 || settled.outcomes[1].disposition !== "transport-settled" ||
        settled.outcomes[1].status !== 204 || settled.host.dispatchAttempts !== 1 ||
        receiver.arrivals.length !== 1 || receiver.arrivals[0].method !== "GET") throw new Error("local-dispatch");
    let differences = 0;
    for (const attempt of item.attempts) {
      differences += compare(receiver.arrivals[0].url, attempt, item.row, capture.source, receiver.endpoint);
    }
    observed = { differences, arrivals: receiver.arrivals.length, dispatches: settled.host.dispatchAttempts };
  } catch (error) { cause = error; }
  try {
    await closeConversionResources({ adapter, chamber, receiver, cause });
    if ((chamber && !chamber.getState().closed) ||
        (receiver && (receiver.getState().listening || receiver.getState().openSockets !== 0))) {
      throw new CleanupFailure();
    }
  } catch { throw new CleanupFailure(); }
  if (receiver && chamber && adapter) counts.cleaned_cases += 1;
  if (cause) throw cause;
  return observed;
}

/** Explicit private reference only. Returns fixed counts and claims, never values or URLs. */
export async function runGoogleAdsAttemptComparison(options) {
  const output = result();
  let evidence, reference;
  try {
    keys(options, ["inputs"]);
    evidence = evidenceSession();
    const manifest = evidence.json(options.inputs, 65536);
    keys(manifest, ["schema", "reference", "expected_pins"]);
    if (manifest.schema !== SCHEMA || manifest.expected_pins?.profile !== "google-ads-conversion") {
      throw new Error("invalid-manifest");
    }
    output.stage = "reference";
    reference = await inspectNativeAttempt({ reference: manifest.reference, expected_pins: manifest.expected_pins });
    output.stage = "reference-inputs";
    const cases = preflight(reference.capture);
    output.stage = "local";
    for (const item of cases) {
      const observed = await localCase(reference.capture, item, output.counts);
      output.counts.cases += 1;
      output.counts.native_primary_attempts += item.attempts.length;
      output.counts.native_auxiliary_attempts += item.auxiliaries.length;
      output.counts.local_arrivals += observed.arrivals;
      output.counts.local_dispatches += observed.dispatches;
      output.counts.field_comparisons += item.attempts.length * FIELDS.length;
      output.counts.differences += observed.differences;
    }
    output.stage = "reference-recheck";
    const after = await inspectNativeAttempt({ reference: manifest.reference, expected_pins: manifest.expected_pins });
    if (!isDeepStrictEqual(reference.originals, after.originals)) throw new Error("reference-changed");
    evidence.recheck();
    output.reference_rechecked = true;
    output.stage = "complete";
    output.comparison = output.counts.differences ? "different" : "matched";
    output.overall = output.counts.differences ? "nonconformant" : "inconclusive";
    output.exit_code = output.counts.differences ? 1 : 0;
  } catch (error) {
    if (output.stage === "manifest") { output.overall = "invalid_input"; output.exit_code = 3; }
    if (error instanceof CleanupFailure) output.stage = "cleanup";
  }
  return output;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const output = await runGoogleAdsAttemptComparison(
    args.length === 2 && args[0] === "--inputs" ? { inputs: args[1] } : {},
  );
  process.stdout.write(`${JSON.stringify(output)}\n`);
  process.exitCode = output.exit_code;
}
