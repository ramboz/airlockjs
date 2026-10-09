#!/usr/bin/env node
import { pathToFileURL } from "node:url";
import {
  PROFILE, LIMITS, Failure, fail, parseArgs, readJson, parseJson, validateInput, validateRouting,
  validateCredentials, validateWorkspace, evaluateScope, evaluateRouting, evaluateWorkspace, equal,
} from "./contract.mjs";
import { validateResponse } from "./responses.mjs";

const USAGE = `Adobe initial-preparation preflight (Node ESM)
Usage: node probes/adobe-compatibility/preflight.mjs --input <path> [--routing-evidence <path>] [--workspace-evidence <path>] [--credential-secret-index <integer>]
Credentials: ADOBE_CREDENTIAL_FILE environment path handle; uppercase Adobe export.
No SDK traffic, mutation, deployment or product-outcome verification. See README.md.
`;
const IDS = Object.freeze([
  "input.scope", "auth.oauth", "analytics.org_company", "analytics.suite", "analytics.reporting",
  "target.tenant_binding", "target.environment", "target.property_workspace", "target.workspace_snapshot",
  "target.activity_offers", "datastream.routing", "site.scope_readability", "datastream.configuration_api",
  "target.write_authority", "site.deployment_authority", "products.deferred",
]);
const ACTIONS = Object.freeze({
  verified: "none", invalid_configuration: "correct_input", credentials_unavailable: "supply_credentials",
  authentication_rejected: "verify_credential_profile", access_denied: "verify_credential_profile",
  resource_not_found: "verify_resource_selector", scope_mismatch: "verify_resource_selector", unsafe_configuration: "verify_resource_selector",
  missing_evidence: "renew_scoped_evidence", stale_evidence: "renew_scoped_evidence", schema_error: "review_api_contract",
  partial_response: "review_api_contract", request_contract_error: "review_api_contract", endpoint_refused: "review_api_contract",
  partial_enumeration: "review_read_limits", limit_exceeded: "review_read_limits", rate_limited: "retry_later",
  transport_failure: "retry_later", timeout: "retry_later", dependency_unverified: "resolve_parent_check",
  unavailable_automation: "retain_manual_routing", not_exercised: "complete_051_02_plan",
  deferred_scope: "defer_later_products", internal_failure: "report_internal_failure",
});
function frozen(value) {
  if (value && typeof value === "object") {
    for (const item of Object.values(value)) frozen(item);
    Object.freeze(value);
  }
  return value;
}
function disposition(error) {
  // Never read arbitrary thrown-object messages, reason fields, causes or stacks.
  return error instanceof Failure ? error : new Failure("internal_failure");
}
function check(id, reason = "dependency_unverified", state = "unverified", basis = "none", status = null, action = null) {
  const freshness = reason === "stale_evidence" ? "stale" :
    state === "ready" ? (basis === "api_read" ? "current_run" : "accepted_owner_window") :
      status !== null ? "current_run" : "not_observed";
  return { id, required: IDS.indexOf(id) < 12, state, evidence_basis: basis, reason,
    next_action: action ?? (id === "datastream.routing" && ["missing_evidence", "stale_evidence"].includes(reason) ? "inspect_datastream_ui" : ACTIONS[reason]),
    http_status: Number.isSafeInteger(status) && status >= 100 && status <= 599 ? status : null, freshness };
}
function report(rows, start, requests, exceptional) {
  const required = rows.filter(item => item.required);
  const summary = {
    required_ready: required.filter(item => item.state === "ready").length,
    required_blocked: required.filter(item => item.state === "blocked").length,
    required_unverified: required.filter(item => item.state === "unverified").length,
    optional_unverified: rows.filter(item => !item.required && item.state === "unverified").length,
    api_requests: requests,
  };
  const overall = exceptional ? "unverified" : summary.required_blocked ? "blocked" : summary.required_unverified ? "unverified" : "ready";
  return frozen({
    kind: "airlock.adobe-preflight.report", schema_version: 2, profile: PROFILE,
    generated_at: new Date(start).toISOString(), overall, exit_code: exceptional ?? (overall === "ready" ? 0 : 1),
    checks: rows, summary,
    claims: { scope: "initial-preparation-only", deployment_verified: false, product_outcomes_verified: false, mutation_authority_verified: false },
  });
}

function request(url, method = "GET", headers = {}, body) {
  return frozen({ url, method, headers, ...(body === undefined ? {} : { body }), redirect: "manual" });
}
function inventory(input, credentials, token, secretIndex) {
  const s = input.selectors, t = s.target, enc = encodeURIComponent;
  const analytics = "https://analytics.adobe.io", target = `https://mc.adobe.io/${enc(t.tenant)}/target`;
  const api = { Authorization: `Bearer ${token}`, "x-api-key": credentials?.CLIENT_ID };
  const ah = { Accept: "application/json", ...api };
  const th = version => ({ Accept: `application/vnd.adobe.target.v${version}+json`, ...api });
  const reporting = {
    rsid: s.report_suite_id, globalFilters: [{ type: "dateRange", dateRange: `${input.report_window.start}/${input.report_window.end}` }],
    metricContainer: { metrics: [{ columnId: "0", id: "metrics/pageviews" }] },
    settings: { limit: 1, page: 0, reflectRequest: false },
  };
  return frozen({
    "ims.token": credentials ? request("https://ims-na1.adobelogin.com/ims/token/v3", "POST", { "Content-Type": "application/x-www-form-urlencoded" },
      new URLSearchParams({ client_id: credentials.CLIENT_ID, client_secret: credentials.CLIENT_SECRETS[secretIndex],
        grant_type: "client_credentials", scope: credentials.SCOPES.join(",") }).toString()) : null,
    "analytics.discovery": request(`${analytics}/discovery/me`, "GET", ah),
    "analytics.suite": request(`${analytics}/api/${enc(s.global_company_id)}/reportsuites/collections/suites/${enc(s.report_suite_id)}?expansion=currency,timezoneZoneinfo`, "GET", ah),
    "analytics.reporting": request(`${analytics}/api/${enc(s.global_company_id)}/reports`, "POST", { ...ah, "Content-Type": "application/json" }, JSON.stringify(reporting)),
    "target.environment": request(`${target}/environments/${enc(t.environment_id)}`, "GET", th(1)),
    "target.property": request(`${target}/properties/${enc(t.property_id)}`, "GET", th(1)),
    "target.properties": request(`${target}/properties`, "GET", th(1)),
    "target.activity": request(`${target}/activities/ab/${enc(t.activity_id)}`, "GET", th(3)),
    "target.offer": t.offers.map(offer => request(`${target}/offers/content/${enc(offer.id)}`, "GET", th(2))),
    "site.status": request(`https://admin.hlx.page/status/${enc(s.site.github_owner)}/${enc(s.site.github_repo)}/${enc(s.site.ref)}/`),
    "site.preview": request(s.site.preview_origin + "/"),
  });
}
// The expected template is owned by the runner, never operator/configuration supplied.
// Exported for refusal tests; the injected fetch still receives only a validated frozen template.
export function assertRequest(candidate, expected) {
  if (!expected || !equal(candidate, expected)) fail("endpoint_refused");
  let url;
  try { url = new URL(candidate.url); } catch { fail("endpoint_refused"); }
  if (url.protocol !== "https:" || url.username || url.password || url.port || url.hash || candidate.redirect !== "manual") fail("endpoint_refused");
  const path = url.pathname;
  let method = "GET", allowed, query = "";
  switch (url.origin) {
    case "https://ims-na1.adobelogin.com":
      allowed = path === "/ims/token/v3"; method = "POST";
      break;
    case "https://analytics.adobe.io":
      if (/^\/api\/[^/]+\/reports$/.test(path)) { allowed = true; method = "POST"; }
      else if (/^\/api\/[^/]+\/reportsuites\/collections\/suites\/[^/]+$/.test(path)) {
        allowed = true; query = "?expansion=currency,timezoneZoneinfo";
      } else allowed = path === "/discovery/me";
      break;
    case "https://mc.adobe.io":
      allowed = /^\/[A-Za-z0-9_-]+\/target\/(?:environments\/[1-9]\d*|properties(?:\/[1-9]\d*)?|activities\/ab\/[1-9]\d*|offers\/content\/[1-9]\d*)$/.test(path);
      break;
    case "https://admin.hlx.page":
      allowed = /^\/status\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\/$/.test(path);
      break;
    default:
      allowed = /^[A-Za-z0-9_-]+--[A-Za-z0-9_-]+--[A-Za-z0-9_-]+\.aem\.page$/.test(url.hostname) && path === "/";
  }
  if (!allowed || candidate.method !== method || url.search !== query ||
      (method === "GET" && candidate.body !== undefined)) fail("endpoint_refused");
}
function httpFailure(status, exact) {
  if (status >= 300 && status < 400) fail("endpoint_refused");
  if (status === 401) fail("authentication_rejected", "blocked");
  if (status === 403) fail("access_denied", "blocked");
  if (status === 404) fail(exact ? "resource_not_found" : "dependency_unverified", exact ? "blocked" : "unverified");
  if ([400, 406, 407].includes(status)) fail("request_contract_error");
  if (status === 429) fail("rate_limited");
  if (status >= 500) fail("transport_failure");
  if (status === 206) fail("partial_response");
  if (status !== 200) fail("request_contract_error");
}

function boundedTransport(transport, limits, started, clock) {
  let requests = 0, totalBytes = 0;
  const elapsed = () => Math.max(performance.now() - started.monotonic, clock() - started.utc);
  return {
    count: () => requests,
    async read(operation, expected, exact = false) {
      let timer, reader, status = null;
      const controller = new AbortController();
      const cancel = () => {
        if (reader) { try { void reader.cancel().catch(() => {}); } catch { /* already closed */ } }
      };
      try {
        assertRequest(expected, expected);
        if (requests >= limits.max_requests || totalBytes >= limits.max_total_response_bytes) fail("limit_exceeded");
        const remaining = limits.run_timeout_ms - elapsed();
        if (remaining <= 0) fail("timeout");
        const ms = Math.min(limits.request_timeout_ms, remaining);
        const timeout = new Promise((_, reject) => {
          timer = setTimeout(() => { controller.abort(); reject(new Failure("timeout")); }, ms);
        });
        const work = async () => {
          requests++;
          const { url, ...init } = expected;
          const response = await transport(url, Object.freeze({ ...init, signal: controller.signal }));
          if (response.body && typeof response.body.getReader === "function") reader = response.body.getReader();
          if (controller.signal.aborted) { cancel(); fail("timeout"); }
          const receivedStatus = response.status;
          if (!Number.isSafeInteger(receivedStatus) || receivedStatus < 100 || receivedStatus > 599) fail("schema_error");
          status = receivedStatus;
          httpFailure(status, exact);
          if (response.redirected) fail("endpoint_refused");
          const contentType = response.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
          const wanted = operation === "site.preview" ? "text/html" :
            operation.startsWith("target.") ? expected.headers.Accept.toLowerCase() : "application/json";
          if (contentType !== wanted) fail("schema_error");
          if (operation === "target.properties" && response.headers.get("link")) fail("partial_enumeration");
          if (!reader) fail("schema_error");
          const chunks = [];
          let bytes = 0;
          while (true) {
            // Exhaustion is invocation-wide: never read another chunk or send another request.
            if (totalBytes >= limits.max_total_response_bytes) fail("limit_exceeded");
            const chunk = await reader.read();
            if (controller.signal.aborted || elapsed() >= limits.run_timeout_ms) fail("timeout");
            if (chunk.done) break;
            if (!(chunk.value instanceof Uint8Array)) fail("schema_error");
            bytes += chunk.value.byteLength; totalBytes += chunk.value.byteLength;
            if (bytes > limits.max_response_bytes || totalBytes > limits.max_total_response_bytes) fail("limit_exceeded");
            chunks.push(chunk.value);
          }
          if (operation === "site.preview") return null;
          let text;
          try { text = new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks)); }
          catch { fail("schema_error"); }
          return parseJson(text, 32, "schema_error");
        };
        const body = await Promise.race([work(), timeout]);
        return { body, status };
      } catch (error) {
        controller.abort();
        let failure;
        if (error instanceof Failure) failure = error;
        else {
          let aborted = false;
          try { aborted = error?.name === "AbortError"; } catch { /* untrusted thrown object */ }
          failure = new Failure(aborted ? "timeout" : "transport_failure");
        }
        return { error: failure, status };
      } finally {
        clearTimeout(timer);
        // Do not await cancellation: a hostile or stalled source may never acknowledge it.
        cancel();
      }
    },
  };
}
function chooseFailure(results) {
  const first = results.find(result => result.error);
  if (first?.error.state !== "unverified") return first;
  return results.find(result => result.error?.state === "blocked" &&
    ["unsafe_configuration", "scope_mismatch"].includes(result.error.reason)) ?? first;
}

// No production flags/environment hooks expose these test-only transport/clock/stream seams.
export async function runCli({ argv = process.argv.slice(2), env = process.env, stdout = process.stdout,
  stderr = process.stderr, transport = globalThis.fetch, now = Date.now } = {}) {
  let start = Date.now(), exceptional = null, network;
  const monotonic = performance.now();
  let runLimit = LIMITS.run_timeout_ms;
  const remaining = () => runLimit - Math.max(performance.now() - monotonic, now() - start);
  const readPrivate = async (path, credential = false) => {
    const budget = remaining();
    if (budget <= 0) fail("timeout");
    let timer;
    try {
      return await Promise.race([
        readJson(path, credential),
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Failure("timeout")), budget); }),
      ]);
    } finally { clearTimeout(timer); }
  };
  const rows = IDS.map(id => check(id));
  rows[12] = check(IDS[12], "unavailable_automation");
  rows[13] = check(IDS[13], "not_exercised");
  rows[14] = check(IDS[14], "not_exercised");
  rows[15] = check(IDS[15], "deferred_scope");
  const put = (id, result, basis, composite = false) => {
    const failure = result.error;
    rows[IDS.indexOf(id)] = failure ?
      check(id, failure.reason, failure.state, basis, composite ? null : result.status ?? null, failure.action) :
      check(id, "verified", "ready", basis, composite ? null : result.status ?? null);
  };
  try {
    const args = parseArgs(argv);
    if (args.help) { stdout.write(USAGE); return null; }
    const observedStart = now();
    if (!Number.isFinite(observedStart) || !Number.isFinite(new Date(observedStart).getTime())) fail("internal_failure");
    start = observedStart;
    let input;
    try { input = await readPrivate(args.input); }
    catch (error) { if (error instanceof Failure && error.reason === "timeout") throw error; fail("invalid_configuration"); }
    const limits = validateInput(input);
    runLimit = limits.run_timeout_ms;
    const deadline = start + limits.run_timeout_ms;
    let routing, workspace, workspaceError, credentials, secretIndex;
    if (args.routing) {
      try { routing = await readPrivate(args.routing); }
      catch (error) { if (!(error instanceof Failure && error.reason === "missing_evidence")) throw error; }
      if (routing) validateRouting(routing);
    }
    if (args.workspace) {
      try { workspace = await readPrivate(args.workspace); }
      catch (error) { if (!(error instanceof Failure && error.reason === "missing_evidence")) throw error; }
      if (workspace) validateWorkspace(workspace);
    }
    if (env.ADOBE_CREDENTIAL_FILE) {
      try { credentials = await readPrivate(env.ADOBE_CREDENTIAL_FILE, true); }
      catch (error) { if (!(error instanceof Failure && error.reason === "credentials_unavailable")) throw error; }
      if (credentials) secretIndex = validateCredentials(credentials, args.index);
    }
    // Supplied evidence is evaluated even when API data is complete or prerequisites fail.
    // It never establishes readiness until the current, complete collection permits it.
    if (workspace) {
      try { evaluateWorkspace(workspace, input, credentials, start, deadline); }
      catch (error) { workspaceError = disposition(error); }
      if (workspaceError) put("target.workspace_snapshot", { error: workspaceError }, "owner_ui_confirmation", true);
    }
    // Validate approval, full designation and identity before *any* network operation.
    if (remaining() <= 0) fail("timeout");
    let scoped = true;
    try { evaluateScope(input, credentials, start, deadline); }
    catch (error) { put("input.scope", { error: disposition(error) }, input.scope_evidence ? "owner_scoped_configuration" : "none"); scoped = false; }
    if (scoped) {
      if (credentials) put("input.scope", {}, "owner_scoped_configuration");
      else put("input.scope", { error: new Failure("credentials_unavailable") }, "owner_scoped_configuration");
      network = boundedTransport(transport, limits, { utc: start, monotonic }, now);
      let templates = inventory(input, credentials, "", secretIndex);
      const context = { input, limits, start, deadline };
      const perform = async (operation, exact = false, offerIndex) => {
        const expected = offerIndex === undefined ? templates[operation] : templates[operation][offerIndex];
        const result = await network.read(operation, expected, exact);
        if (!result.error && operation !== "site.preview") {
          try { result.value = validateResponse(operation, result.body, { ...context, offer: input.selectors.target.offers[offerIndex] }); }
          catch (error) { result.error = disposition(error); }
        }
        return result;
      };
      if (!credentials) put("auth.oauth", { error: new Failure("credentials_unavailable") }, "none");
      else {
        const auth = await perform("ims.token");
        put("auth.oauth", auth, "api_read");
        if (!auth.error) {
          templates = inventory(input, credentials, auth.value, secretIndex);
          const discovery = await perform("analytics.discovery");
          put("analytics.org_company", discovery, "api_read");
          if (!discovery.error) {
            const suite = await perform("analytics.suite", true);
            put("analytics.suite", suite, "api_read");
            if (suite.error?.reason === "invalid_configuration") throw suite.error;
            if (!suite.error) put("analytics.reporting", await perform("analytics.reporting"), "api_read");
            // Neither exact lookup establishes its parent tenant scope by itself.
            const environment = await perform("target.environment");
            const property = await perform("target.property");
            put("target.property_workspace", property, "api_read");
            if (!property.error) {
              put("target.tenant_binding", {}, "owner_scoped_configuration", true);
              if (environment.status === 404) environment.error = new Failure("resource_not_found", "blocked");
            }
            put("target.environment", environment, "api_read");
            if (!property.error) {
              const snapshot = await perform("target.properties");
              const ownerResult = { error: workspaceError };
              const failure = chooseFailure([snapshot, ownerResult]);
              if (failure) put("target.workspace_snapshot", failure,
                failure === snapshot ? "api_read" : "owner_ui_confirmation", failure !== snapshot);
              else if (snapshot.value.assignmentsComplete) put("target.workspace_snapshot", snapshot, "api_read");
              else if (workspace) put("target.workspace_snapshot", {}, "owner_ui_confirmation", true);
              else put("target.workspace_snapshot", { error: new Failure("schema_error"), status: snapshot.status }, "api_read");
              const parts = [await perform("target.activity", true), await perform("target.offer", true, 0), await perform("target.offer", true, 1)];
              put("target.activity_offers", chooseFailure(parts) ?? {}, "api_read", true);
            }
            // Explicit unsafe/mismatched attestations outrank unknown current readbacks.
            let routingError;
            try { evaluateRouting(routing, input, start, deadline, property.error ? undefined : property.value); }
            catch (error) { routingError = disposition(error); }
            const routingBasis = routing ? "owner_ui_confirmation" : "none";
            if (routingError) put("datastream.routing", { error: routingError }, routingBasis, true);
            else if (property.error || environment.error) put("datastream.routing", { error: new Failure("dependency_unverified") }, routingBasis, true);
            else put("datastream.routing", {}, routingBasis, true);
          }
        }
      }
      // Public site never receives Adobe credentials; it is independent of product auth/query.
      const status = await perform("site.status", true);
      const preview = status.error ? null : await perform("site.preview", true);
      put("site.scope_readability", status.error ? status : preview, "api_read", true);
      if (rows[10].reason === "dependency_unverified" && !routing) {
        put("datastream.routing", { error: new Failure("missing_evidence") }, "none", true);
      }
    }
  } catch (error) {
    const failure = disposition(error);
    if (failure.reason === "timeout") put("input.scope", { error: failure }, "none");
    else {
      exceptional = failure.reason === "internal_failure" ? 3 : 2;
      put("input.scope", { error: new Failure(exceptional === 3 ? "internal_failure" : "invalid_configuration") }, "none");
    }
  }
  const result = report(rows, start, network?.count() ?? 0, exceptional);
  stdout.write(JSON.stringify(result) + "\n");
  stderr.write(`overall=${result.overall} exit=${result.exit_code} ` +
    Object.entries(result.summary).map(([key, value]) => `${key}=${value}`).join(" ") + "\n");
  return result;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await runCli();
  process.exitCode = result?.exit_code ?? 0;
}
