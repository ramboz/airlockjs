import { createHash, randomBytes, X509Certificate } from "node:crypto";
import { execFile } from "node:child_process";
import { chmodSync, closeSync, existsSync, fsyncSync, lstatSync, mkdirSync, openSync, unlinkSync } from "node:fs";
import { dirname, isAbsolute, join, parse, resolve } from "node:path";
import { createServer as httpServer } from "node:http";
import { createServer as h2Server, constants as H2 } from "node:http2";
import { connect as tcpConnect } from "node:net";
import { connect as tlsConnect, createServer as tlsServer } from "node:tls";
import { release } from "node:os";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { isProxy } from "node:util/types";
import { gzipSync, deflateSync, brotliCompressSync, constants as ZLIB } from "node:zlib";
import { readMetaPrivate, writeMetaPrivate } from "./native-stock-meta.mjs";
import { createInspectedHttpWire, createInspectedRequestFramer } from "./inspected-http-wire.mjs";
import { authenticateOwnedBrowserPeer, relayInspectedSockets } from "./inspected-transport.mjs";
import { inspectedMetaSourcePins } from "./inspected-meta-stock.mjs";
import { beginLocalGuardRegistration, localGuardSourceDigest } from "./local-guard-observation.mjs";

const execute = promisify(execFile), hash = bytes => createHash("sha256").update(bytes).digest("hex");
const AUTHORITY = "collector.test.invalid:443", COLLECTOR = "https://collector.test.invalid";
const DOCUMENT = "https://owned.example/inspection", WRONG = "https://unqualified.test.invalid";
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
const fixtureUrl = n => COLLECTOR + "/pixel?id=999999999999999&ev=PageView&dl=https%3A%2F%2Fowned.example%2Finspection&item=%2f&item=%2F&r=" + n;
const declaredMetaUrl = n => "https://www.facebook.com/tr/?id=999999999999999&ev=PageView&dl="
  + encodeURIComponent(DOCUMENT) + "&r=" + n;
const declaredMetaProfile = () => ({
  schema_version: 1, profile: "meta-pageview", case_name: "meta-stock", document_url: DOCUMENT,
  owned: { pixel_id: "999999999999999" }, companion_authorized: false,
  resources: [
    { role: "runtime", url: "https://connect.facebook.net/en_US/fbevents.js",
      sha256: "9e4b581a7483e88873ad835a840ffaaff1c85b3be28951e12e8207a318e7776b" },
    { role: "configuration",
      url: "https://connect.facebook.net/signals/config/999999999999999?v=2.9.0&r=stable&domain=owned.example&hme=synthetic&ex_m=one",
      sha256: "807a33e31707b75434ac6aeda5aa8fc9073d6795ca8a9671ff6535edc308d921" },
  ],
});
const COHORTS = ["physical", "request", "response", "compression", "aggregate",
  "deadline", "close-failure", "output-failure", "late-output", "transport", "declared-meta"];
const partHash = parts => {
  const digest = createHash("sha256");
  for (const part of parts) digest.update(part);
  return digest.digest("hex");
};

function diagnosticPlans(cohort, protocol) {
  if (cohort === "declared-meta") return [
    ["normal", 2, true],
    ...["marker", "field"].flatMap(kind => [[kind + "-enforced", 2, true], [kind + "-bypass", 2, false]]),
    ...["fetch", "missing-binding", "ambiguous-binding"].flatMap(kind =>
      [[kind + "-enforced", 1, true], [kind + "-bypass", 1, false]]),
    ["redirect", 1, true], ["retry-enforced", 8, true, "retry"], ["retry-bypass", 8, false, "retry"],
    ...(protocol === "h2" ? [["retry-positive", 2, true, "early-retry"]] : []),
    ...(protocol === "h1" ? [["wrong-authority", 1, true], ["no-authority", 1, true],
      ["untrusted-cert", 1, true], ["wrong-name", 1, true]] : []),
  ];
  if (cohort === "transport") return protocol === "h1"
    ? [["close-normal", 1, true], ["close-reset", 1, true], ["close-redirect-reset", 1, true]]
    : [["transport-normal", 1, true], ["transport-reset", 1, true]];
  if (["deadline", "close-failure", "output-failure", "late-output"].includes(cohort)) return [[cohort, 2, true]];
  if (cohort === "physical") return [
    ["normal", 2, true, null], ["retry-enforced", 8, true, "retry"], ["retry-bypass", 8, false, "retry"],
    ...(protocol === "h2" ? [["goaway-enforced", 8, true, "goaway"], ["goaway-bypass", 8, false, "goaway"]] : []),
    ...(protocol === "h1" ? [["wrong-authority", 1, true, null], ["no-authority", 1, true, null],
      ["untrusted-cert", 1, true, null], ["wrong-name", 1, true, null]] : []),
  ];
  if (cohort === "request") return [
    ["normal", 2, true], ["header-exact", 2, true], ["url-exact", 2, true],
    ...["marker", "path", "method", "header-over", "url-over"].flatMap(kind =>
      [[kind + "-enforced", 2, true], [kind + "-bypass", 2, false]]),
  ];
  if (cohort === "response") return [
    ...["length", "chunked", ...(protocol === "h1" ? ["close"] : [])].flatMap(kind =>
      [[kind + "-exact", 2, true], [kind + "-over-enforced", 2, true], [kind + "-over-bypass", 2, false]]),
    ["redirect", 1, true], ["truncated", 2, true], ["truncated-bypass", 2, false],
    ["truncated-redirect", 1, true], ["truncated-redirect-bypass", 1, false],
    ...["informational", "trailers"].flatMap(kind => [[kind + "-enforced", 2, true], [kind + "-bypass", 2, false]]),
  ];
  if (cohort === "compression") return ["gzip", "deflate", "br"].flatMap(kind =>
    [[kind + "-exact", 2, true], [kind + "-over-enforced", 2, true], [kind + "-over-bypass", 2, false]]);
  return [["aggregate-positive", 4, true], ["aggregate-enforced", 5, true], ["aggregate-bypass", 5, false]];
}

const expectedGuard = (kind, declaredMeta = false) => {
  if (kind.endsWith("bypass")) return null;
  if (declaredMeta) {
    if (kind === "marker-enforced") return "owned_input_mismatch";
    if (["field-enforced", "fetch-enforced"].includes(kind)) return "unqualified_route_or_field";
    if (["missing-binding-enforced", "ambiguous-binding-enforced"].includes(kind)) return "missing_or_ambiguous_logical_observation";
    if (kind === "retry-enforced") return "physical_request_limit";
  }
  if (kind === "marker-enforced") return "synthetic_marker_or_query";
  if (kind === "path-enforced") return "synthetic_url";
  if (kind === "method-enforced") return "synthetic_method";
  if (kind === "header-over-enforced") return "semantic_header_limit";
  if (kind === "url-over-enforced") return "url_limit";
  if (kind === "truncated" || kind === "truncated-redirect") return "truncated_response";
  if (kind === "informational-enforced") return "unsupported_informational_response";
  if (kind === "trailers-enforced") return "unsupported_response_trailers";
  if (kind === "aggregate-enforced") return "aggregate_overflow";
  if (kind === "deadline") return "diagnostic_deadline";
  if (kind.endsWith("-reset")) return "upstream_connection_reset";
  if (kind.includes("-over-enforced")) return "response_overflow";
  return null;
};
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const fail = category => { throw new Error(category); };

// Retained count-only diagnostic bypass. The composed path below uses the
// same physical framer, with semantic inspection and response observation.
export function createPhysicalRequestBudget(options = {}) {
  if (!options || Object.getPrototypeOf(options) !== Object.prototype
    || Reflect.ownKeys(options).some(key => !["limit", "enforce"].includes(key)
      || !Object.hasOwn(Object.getOwnPropertyDescriptor(options, key), "value"))
    || (options.limit !== undefined && (!Number.isSafeInteger(options.limit) || options.limit < 1 || options.limit > 8))
    || (options.enforce !== undefined && typeof options.enforce !== "boolean"))
    throw new Error("invalid_physical_budget");
  const limit = options.limit ?? 8, enforced = options.enforce ?? true;
  let observed = 0, forwarded = 0, stopped = false, reason = null;
  const stop = category => { if (!stopped) { stopped = true; reason = category; } };
  const reserve = () => {
    observed++;
    if (enforced && observed > limit) { stop("physical_request_limit"); return false; }
    return true;
  };
  return Object.freeze({
    snapshot: () => Object.freeze({ limit, enforced, observed, forwarded, stopped, reason }),
    connection(protocol) {
      return createInspectedRequestFramer(protocol, {
        rawHeaderLimit: enforced ? 65536 : 65536 + 2048 + 32,
        stopped: () => stopped, stop,
        begin: () => reserve() ? observed : false,
        header(entry) {
          if (enforced && protocol === "h1" && entry.method !== "GET") { stop("unsupported_h1_request"); return false; }
          forwarded++; return true;
        },
      });
    },
  });
}

/**
 * Closed, synthetic, literal-loopback diagnostics only. Each fixed cohort has
 * its own absolute case envelope, never above 60 s (including cleanup/output).
 * Late publication uses a fixed 15 s diagnostic binding. The four lifecycle
 * fault cohorts must exit blocked; neither successful guard controls nor these
 * synthetic PageView-shaped URLs authorize a native capture or a real event.
 * Each private case original is separately exclusive/fsynced, with an index
 * digest, so no receipt needs a larger private-file limit.
 */
export async function runLocalInspection(options) {
  if (!options || isProxy(options) || Object.getPrototypeOf(options) !== Object.prototype
                || Reflect.ownKeys(options).some(key => !["outputDir", "cohort"].includes(key)
                  || !Object.hasOwn(Object.getOwnPropertyDescriptor(options, key), "value"))
                || !Object.hasOwn(options, "outputDir")
                || typeof Object.getOwnPropertyDescriptor(options, "outputDir")?.value !== "string"
                || !isAbsolute(options.outputDir) || resolve(options.outputDir) !== options.outputDir
                || (Object.hasOwn(options, "cohort") && !COHORTS.includes(options.cohort)))
    fail("invalid_inspection_options");
  const output = options.outputDir, cohort = options.cohort ?? "physical", started = performance.now(), headerSizes = new Map();
  const duration = cohort === "late-output" ? 15000 : 60000, startedAt = Date.now();
  const window = { not_before_ms: startedAt, expires_at_ms: startedAt + duration };
  const remaining = () => Math.min(duration - (performance.now() - started), window.expires_at_ms - Date.now());
  const declaredMeta = cohort === "declared-meta", collector = declaredMeta ? "https://www.facebook.com" : COLLECTOR;
  const authority = declaredMeta ? "www.facebook.com:443" : AUTHORITY;
  const collectorName = declaredMeta ? "www.facebook.com" : "collector.test.invalid";
  const caseUrl = declaredMeta ? declaredMetaUrl : fixtureUrl;
  const require = createRequire(import.meta.url);
  if (process.version !== "v24.10.0" || process.platform !== "darwin" || release() !== "27.0.0"
    || require("playwright/package.json").version !== "1.62.1"
                || (await execute("/usr/bin/sw_vers", ["-productVersion"], { timeout: 2000 })).stdout.trim() !== "27.0.1")
    fail("cohort_mismatch");
  for (let path = dirname(output);;) {
    const stat = lstatSync(path);
    if (!stat.isDirectory() || stat.isSymbolicLink()) fail("unsafe_inspection_output");
    if (path === dirname(output) && (stat.uid !== process.getuid() || (stat.mode & 0o7777) !== 0o700))
      fail("unsafe_inspection_output");
    if (path === parse(path).root) break;
    path = dirname(path);
  }
  mkdirSync(output, { mode: 0o700 });
  const parentFd = openSync(dirname(output), "r");
  try { fsyncSync(parentFd); } finally { closeSync(parentFd); }
  const pins = inspectedMetaSourcePins;
  const sourceBefore = pins(), secrets = [], contexts = new Set(), sockets = new Set(), sessions = new Set();
  const servers = new Set(), closingServers = new Map(), observers = new Set();
  const tasks = new Set(), diagnosticTimers = new Set(), rows = [], captures = [], errors = [];
  const lifecycleControls = {};
  let browser, browserServer, browserCdp, proxy, active = null, expired = false, tlsBoundary = null, cleanupMode = false;
  const controls = { untrusted_local_peer_denied: false, wrong_authority_denied: false,
    missing_logical_authority_denied: false, upstream_untrusted_certificate_denied: false, upstream_wrong_name_denied: false };
  const own = socket => {
    sockets.add(socket); socket.on("error", () => {});
    socket.once("close", () => sockets.delete(socket));
    return socket;
  };
  const stopSockets = () => { for (const session of sessions) session.destroy(); for (const socket of sockets) socket.destroy(); };
  const retain = (row, parts, bytes) => {
    if (row.observer) {
      const original = row.observer.retain(bytes);
      if (!original) { stopSockets(); return false; }
      parts.push(original); return true;
    }
    if (row.retained_bytes + bytes.length > 8388608) {
      row.failure = "local_retention_limit"; stopSockets(); return false;
    }
    row.retained_bytes += bytes.length; parts.push(Buffer.from(bytes)); return true;
  };
  const retainEvidence = (row, value) => {
    const bytes = typeof value === "string" ? Buffer.byteLength(value) : Buffer.byteLength(JSON.stringify(value));
    if (row.observer) {
      if (row.observer.reserveObservation(bytes)) return true;
    } else if (row.retained_bytes + bytes <= 8388608) { row.retained_bytes += bytes; return true; }
    else row.failure = "local_retention_limit";
    stopSockets(); return false;
  };
  const bounded = async (promise, ms = 4000) => {
    const available = Math.min(ms, cleanupMode ? 60000 - (performance.now() - started) : remaining());
    if (available <= 0) fail("inspection_step_deadline");
    let timer;
    try { return await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error("inspection_step_deadline")), available);
    })]); } finally { clearTimeout(timer); }
  };
  const outputDeadline = () => { if (expired || remaining() <= 0) fail("inspection_output_deadline"); };
  const recordCase = (row, failureAfterCleanup = false, resourceCleanup = null) => {
    const { protocol, kind, count, fault, observer, enforce, fetchMode, browserReceipts } = row;
    const requestEqual = row.tunnels.every(tunnel => {
      const link = row.sink_links.find(link => link.tls_peer_port === tunnel.upstream_peer_port);
      return link && tunnel.forwarded_bytes === link.request_bytes
        && tunnel.forwarded_hash.copy().digest("hex") === link.request_hash.copy().digest("hex");
    });
    const responseEqual = row.tunnels.every(tunnel => {
      const link = row.sink_links.find(link => link.tls_peer_port === tunnel.upstream_peer_port);
      return link && tunnel.response_bytes === link.response_bytes
        && tunnel.response_hash.copy().digest("hex") === link.response_hash.copy().digest("hex");
    });
    const originals = observer?.originals();
    const responseOriginalsMatch = originals?.responses.every(response => response.state !== "complete"
      || partHash(response.body) === row.receiver[response.ordinal - 1]?.response_body_sha256);
    const browserResponseRows = originals?.responses.filter(response => response.state === "complete" && (response.status < 300 || response.status >= 400));
    const browserDecodedMatch = browserReceipts && browserResponseRows?.length === browserReceipts.length
      && browserReceipts.every((receipt, index) => receipt.status === browserResponseRows[index].status
        && receipt.bytes === browserResponseRows[index].decoded_body_bytes
        && receipt.sha256 === partHash(browserResponseRows[index].body));
    const summary = { protocol, kind, cross_origin: true, receiver_attempts: row.receiver.length,
      observed_header_starts: row.budget.snapshot().observed, forwarded: row.budget.snapshot().forwarded,
      reason: row.budget.snapshot().reason, original_bytes_equal: row.tunnels.length > 0 && requestEqual && responseEqual,
      request_wire_equal: row.tunnels.length > 0 && requestEqual, response_wire_equal: row.tunnels.length > 0 && responseEqual,
      cookie_attached: row.receiver.length > 1 && row.receiver[1].cookie.includes("partitioned_fixture=one")
        && row.receiver[1].cookie.includes("partitioned_second=two"),
      browser_originals_match: row.browser_bodies.length === count && row.browser_bodies.every(body => body === hash(PNG)),
      denials: row.denials, authenticated_peers: row.authenticated_peers, fault_injected: Boolean(row.fault_injected),
      certificate_error: row.certificate_error ?? null,
      retained_original_bytes: observer?.snapshot().retained_bytes ?? row.retained_bytes,
      semantic_requests: originals?.requests.length ?? 0,
      complete_original_responses: originals?.responses.filter(response => response.state === "complete").length ?? 0,
      logical_admissions: row.admissions.length, http_tunnels: row.tunnels.length,
      same_session_h2_retry: protocol === "h2" && fault === "retry" && row.tunnels.length === 1
        && row.admissions.length === 8 && row.budget.snapshot().observed === 9,
      sink_response_originals_match: Boolean(responseOriginalsMatch), browser_decoded_originals_match: Boolean(browserDecodedMatch),
      duplicate_set_cookie_observed: Boolean(originals?.responses.some(response =>
        response.headers.filter(([name]) => name.toLowerCase() === "set-cookie").length === 2)),
      browser_redirect_edges: row.browser_redirect_edges ?? 0,
      observed_redirect_edges: originals?.requests.filter(request => request.redirect_from !== null).length ?? 0,
      retention: observer?.snapshot() ?? { peak_retained_bytes: row.retained_bytes, peak_response_bytes: 0 },
      image_outcomes: row.outcomes, body_unavailable: Boolean(row.body_unavailable), failure: row.failure ?? null,
      reset_fixture_injected: Boolean(row.reset_fixture_injected), failure_after_cleanup: failureAfterCleanup };
    if (cohort !== "physical") {
      summary.bypass = !enforce;
      summary.expected_guard = expectedGuard(kind, declaredMeta);
      summary.expected_sink_attempts = cohort === "request" && enforce && summary.expected_guard ? 1
        : kind === "truncated-redirect" ? 1 : kind === "redirect" || kind === "truncated-redirect-bypass" ? 2 : count;
      summary.matched_positive = kind.startsWith("header-") ? "header-exact" : kind.startsWith("url-") ? "url-exact"
        : cohort === "request" ? "normal" : cohort === "aggregate" ? "aggregate-positive"
          : kind.includes("redirect") ? "redirect" : ["gzip", "deflate", "br", "length", "chunked", "close"].some(prefix => kind.startsWith(prefix))
            ? kind.split("-")[0] + "-exact" : "length-exact";
      if (cohort === "transport") summary.matched_positive = protocol === "h1" ? "close-normal" : "transport-normal";
      summary.case_qualified = !summary.failure && summary.reason === summary.expected_guard
        && summary.receiver_attempts === summary.expected_sink_attempts && summary.request_wire_equal
        && summary.retention.peak_retained_bytes <= 8388608 && summary.retention.peak_response_bytes <= 2097152
        && (!summary.retention.late_wire_overflow || summary.expected_guard === "aggregate_overflow")
        && (enforce && !summary.expected_guard
          ? summary.complete_original_responses === summary.receiver_attempts && summary.sink_response_originals_match && summary.response_wire_equal
            && (!fetchMode || summary.browser_decoded_originals_match)
            && (cohort !== "request" || summary.browser_originals_match)
          : true);
      if (kind === "redirect") summary.case_qualified &&= summary.observed_redirect_edges === 1 && summary.browser_redirect_edges === 1;
      if (cohort === "transport" && kind.endsWith("-reset")) summary.case_qualified &&= summary.reset_fixture_injected
        && summary.complete_original_responses === 0 && summary.observed_redirect_edges === 0
        && row.outcomes?.length === 1 && row.outcomes[0] === false
        && row.tunnels.some(tunnel => tunnel.upstream_termination === "upstream_connection_reset");
      if (declaredMeta) {
        summary.matched_positive = "normal";
        summary.declared_profile = observer?.snapshot().policy ?? null;
        summary.policy_bypassed = !enforce;
        summary.logical_selection_fault = kind === "missing-binding-enforced" ? "omit_actual_candidate"
          : kind === "ambiguous-binding-enforced" ? "duplicate_actual_candidate_not_additional_events" : null;
        summary.logical_binding_verified = Boolean(originals?.requests.every(request => row.logical_observations.filter(logical =>
          logical.network_id === request.logical_network_id && logical.fetch_id === request.logical_fetch_id
          && logical.url === request.url && logical.method === request.method
          && logical.resource_type === request.resource_type && logical.network_resource_type === request.resource_type).length === 1));
        summary.literal_upstream_verified = row.tunnels.length > 0 && row.tunnels.every(tunnel =>
          tunnel.upstream_address === "127.0.0.1" && tunnel.upstream_servername === collectorName
          && tunnel.upstream_authorized && tunnel.inspector_servername === collectorName);
        const broker = { "wrong-authority": "authority", "no-authority": "no_authority",
          "untrusted-cert": "upstream_certificate", "wrong-name": "upstream_certificate" }[kind];
        if (broker) {
          summary.expected_sink_attempts = 0;
          summary.case_qualified = !summary.failure && summary.receiver_attempts === 0 && summary.reason === null
            && summary.semantic_requests === 0 && row.denials[broker] > 0;
        } else {
          const early = ["fetch-", "missing-binding-", "ambiguous-binding-"].some(prefix => kind.startsWith(prefix));
          summary.expected_sink_attempts = kind === "redirect" ? 2 : kind === "retry-positive" ? 3
            : kind === "retry-bypass" ? 9 : summary.expected_guard ? early ? 0 : kind === "retry-enforced" ? 8 : 1 : count;
          summary.case_qualified = !summary.failure && summary.reason === summary.expected_guard
            && summary.receiver_attempts === summary.expected_sink_attempts && summary.request_wire_equal && summary.response_wire_equal
            && summary.literal_upstream_verified && summary.retention.peak_retained_bytes <= 8388608
            && summary.retention.peak_response_bytes <= 2097152 && !summary.retention.late_wire_overflow
            && (!enforce || summary.logical_binding_verified
              && summary.declared_profile.registered === summary.semantic_requests
              && summary.declared_profile.responses === summary.complete_original_responses
              && summary.semantic_requests === summary.expected_sink_attempts);
          if (!summary.expected_guard) summary.case_qualified &&= summary.browser_originals_match
            && (!enforce || summary.complete_original_responses === summary.receiver_attempts - (kind === "retry-positive" ? 1 : 0)
              && summary.sink_response_originals_match);
          if (kind === "redirect") summary.case_qualified &&= summary.observed_redirect_edges === 1 && summary.browser_redirect_edges === 1;
          if (kind.startsWith("marker-") || kind.startsWith("field-")) summary.case_qualified &&= row.tunnels.length === 1
            && row.outcomes?.length === 2 && row.outcomes[0] === true && row.outcomes[1] === !enforce;
          if (kind.startsWith("retry-")) summary.case_qualified &&= summary.fault_injected
            && summary.observed_header_starts === (kind === "retry-positive" ? 3 : 9)
            && summary.logical_admissions === count && row.outcomes?.at(-1) === (kind !== "retry-enforced")
            && (protocol !== "h2" || row.tunnels.length === 1);
          if (kind === "retry-positive") {
            const requests = originals.requests, aborted = originals.responses.find(response => response.ordinal === 2);
            summary.hidden_retry_mapping_verified = requests.length === 3 && row.logical_observations.length === 2
              && requests[1].logical_network_id === requests[2].logical_network_id
              && requests[1].logical_fetch_id === requests[2].logical_fetch_id
              && requests[1].policy_ordinal === 1 && requests[2].policy_ordinal === 2
              && requests[1].stream !== requests[2].stream && aborted?.state === "transport-aborted" && aborted.status === null;
            summary.case_qualified &&= summary.hidden_retry_mapping_verified;
          }
        }
      }
    }
    if (failureAfterCleanup) summary.case_qualified = false;
    const originalName = "case-" + protocol + "-" + kind + ".json";
    const originalsFile = failureAfterCleanup ? "failure-" + originalName : originalName;
    outputDeadline();
    if (cohort === "output-failure" && !failureAfterCleanup) {
      writeMetaPrivate(join(output, originalName), { synthetic_collision_not_originals: true });
      row.collided_output_sha256 = hash(readMetaPrivate(join(output, originalName)));
    }
    if (failureAfterCleanup && row.collided_output_sha256) {
      summary.collided_output_sha256 = row.collided_output_sha256;
      summary.collided_output_unchanged = row.collided_output_sha256 === hash(readMetaPrivate(join(output, originalName)));
      if (!summary.collided_output_unchanged) fail("collided_output_changed");
    }
    try {
      writeMetaPrivate(join(output, originalsFile), { ...summary, resource_cleanup: resourceCleanup,
        admissions: row.admissions, receiver: row.receiver,
        ...(declaredMeta ? { logical_observations: row.logical_observations,
          network_events: row.network_events, fetch_events: row.fetch_events } : {}),
        observations: originals ? { requests: originals.requests, responses: originals.responses.map(response => ({
          ...response, decoder: undefined, body: Buffer.concat(response.body).toString("base64"),
        })) } : null,
        tunnels: row.tunnels.map(tunnel => ({ upstream_peer_port: tunnel.upstream_peer_port,
          ...(declaredMeta ? { upstream_address: tunnel.upstream_address, upstream_servername: tunnel.upstream_servername,
            upstream_authorized: tunnel.upstream_authorized, inspector_servername: tunnel.inspector_servername } : {}),
          upstream_termination: tunnel.upstream_termination ?? null,
          request: Buffer.concat(tunnel.request).toString("base64"), response: Buffer.concat(tunnel.response).toString("base64"),
          forwarded_bytes: tunnel.forwarded_bytes, response_bytes: tunnel.response_bytes,
          forwarded_sha256: tunnel.forwarded_hash.copy().digest("hex"), response_sha256: tunnel.response_hash.copy().digest("hex") })),
        sink_links: row.sink_links.map(link => ({ tls_peer_port: link.tls_peer_port,
          application_peer_port: link.application_peer_port, request_bytes: link.request_bytes, response_bytes: link.response_bytes,
          request_sha256: link.request_hash.copy().digest("hex"), response_sha256: link.response_hash.copy().digest("hex") })) });
    } catch (error) {
      if (!failureAfterCleanup && cohort === "output-failure" && error.code === "EEXIST") {
        lifecycleControls.diagnostic_output_failure = true; fail("diagnostic_output_failure");
      }
      throw error;
    }
    const originalsSha256 = hash(readMetaPrivate(join(output, originalsFile)));
    rows.push(summary);
    captures.push({ ...summary, originals_file: originalsFile, originals_sha256: originalsSha256 });
    row.recorded = true;
  };
  const listen = async server => {
    servers.add(server);
    await bounded(new Promise((resolve, reject) => {
      server.once("error", reject); server.listen(0, "127.0.0.1", resolve);
    }));
    return server.address().port;
  };
  const closeServer = async server => {
    let closing = closingServers.get(server);
    if (!closing && server.listening) {
      closing = new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
      closingServers.set(server, closing);
    }
    if (closing) await bounded(closing, 2000);
    closingServers.delete(server); servers.delete(server);
  };
  const task = promise => {
    tasks.add(promise);
    promise.catch(error => {
      errors.push(["peer_unavailable", "inspection_step_deadline"].includes(error.message) ? error.message : "observer_failed");
      stopSockets();
    }).finally(() => tasks.delete(promise));
  };
  const timer = setTimeout(() => {
    expired = true; stopSockets();
    const child = browserServer?.process();
    if (child && child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
  }, Math.max(1, Math.min(50000, remaining() - 5000)));
  const makeCertificate = async role => {
    const keyPath = join(output, role + "-key.pem"), certPath = join(output, role + "-certificate.pem");
    secrets.push(keyPath);
    await execute("/usr/bin/openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes",
      "-keyout", keyPath, "-out", certPath, "-days", "1", "-subj", "/CN=" + collectorName,
      "-addext", "subjectAltName=DNS:" + collectorName], { timeout: 5000, maxBuffer: 8192 });
    chmodSync(keyPath, 0o600); chmodSync(certPath, 0o600);
    return { key: readMetaPrivate(keyPath, 16384), cert: readMetaPrivate(certPath, 16384) };
  };
  try {
    const inspector = await makeCertificate("inspector"), upstreamIdentity = await makeCertificate("upstream");
    const spki = createHash("sha256").update(new X509Certificate(inspector.cert).publicKey
      .export({ type: "spki", format: "der" })).digest("base64");
    if (declaredMeta) tlsBoundary = { collector_authority: authority, upstream_address: "127.0.0.1",
      upstream_sni: collectorName, inspector_spki_sha256_base64: spki,
      inspector_certificate_sha256: hash(inspector.cert), upstream_certificate_sha256: hash(upstreamIdentity.cert),
      upstream_reject_unauthorized: true, browser_exact_spki_exception: true, browser_system_trust_changed: false };
    const authenticatePeer = socket => authenticateOwnedBrowserPeer(browserCdp, socket, bounded);
    proxy = httpServer((_req, response) => response.writeHead(403).end());
    proxy.on("connection", own);
    proxy.on("connect", (request, client, head) => task((async () => {
      const row = active;
      const deny = reason => {
        if (row) row.denials[reason] = (row.denials[reason] ?? 0) + 1;
        client.end("HTTP/1.1 403 Denied\r\nContent-Length: 0\r\nConnection: close\r\n\r\n");
      };
      if (!row || request.url !== authority || head.length) return deny("authority");
      if (!await authenticatePeer(client)) return deny("peer");
      row.authenticated_peers++;
      if (!row.logical_authority || row.budget.snapshot().stopped) return deny("no_authority");
      const remote = own(tlsConnect({ host: "127.0.0.1", port: row.upstream_port,
        servername: row.kind === "wrong-name" ? "wrong.test.invalid" : collectorName,
        ca: row.kind === "untrusted-cert" ? inspector.cert : upstreamIdentity.cert,
        rejectUnauthorized: true, ALPNProtocols: [row.protocol === "h2" ? "h2" : "http/1.1"] }));
      let authorized;
      try {
        await bounded(new Promise((resolve, reject) => { remote.once("secureConnect", resolve); remote.once("error", reject); }));
        authorized = remote.authorized && remote.alpnProtocol === (row.protocol === "h2" ? "h2" : "http/1.1");
      } catch (error) {
        const certificateError = ["DEPTH_ZERO_SELF_SIGNED_CERT", "SELF_SIGNED_CERT_IN_CHAIN",
          "UNABLE_TO_VERIFY_LEAF_SIGNATURE", "ERR_TLS_CERT_ALTNAME_INVALID", "CERT_HAS_EXPIRED",
          "CERT_NOT_YET_VALID", "UNABLE_TO_GET_ISSUER_CERT_LOCALLY"].includes(error.code);
        if (certificateError) row.certificate_error = error.code;
        else row.failure = "upstream_tls_failure";
        remote.destroy(); return deny(certificateError ? "upstream_certificate" : "upstream_tls_failure");
      }
      if (!authorized) { remote.destroy(); return deny("upstream_certificate"); }
      const tunnel = { upstream_peer_port: remote.localPort, request: [], response: [], forwarded_hash: createHash("sha256"),
        response_hash: createHash("sha256"), forwarded_bytes: 0, response_bytes: 0,
        ...(declaredMeta ? { upstream_address: remote.remoteAddress, upstream_servername: remote.servername,
          upstream_authorized: remote.authorized, inspector_servername: null } : {}) };
      row.tunnels.push(tunnel);
      const gate = row.budget.connection(row.protocol);
      relayInspectedSockets({ client, remote, inspector, protocol: row.protocol, gate, observer: row.observer,
        own, task, bounded, stopped: () => row.budget.snapshot().stopped,
        requestBytes: bytes => retain(row, tunnel.request, bytes),
        acceptedRequest(bytes) { tunnel.forwarded_hash.update(bytes); tunnel.forwarded_bytes += bytes.length; },
        acceptedResponse() { return true; },
        responseBytes(bytes) {
          if (!retain(row, tunnel.response, bytes)) return false;
          tunnel.response_hash.update(bytes); tunnel.response_bytes += bytes.length; return true;
        },
        afterResponse() {
            if (cohort === "transport" && row.kind.endsWith("-reset") && !row.reset_fixture_injected
              && row.observer.originals().responses.some(response => response.state === "streaming" && response.decoded_body_bytes > 0)) {
              const link = row.sink_links.find(link => link.tls_peer_port === remote.localPort);
              if (!link?.reset_tcp_peer) fail("reset_fixture_peer_missing");
              row.reset_fixture_injected = true;
              link.reset_tcp_peer();
            }
        },
        upstreamClosed(termination) { tunnel.upstream_termination = termination; },
        inspectorReady(secure) { if (declaredMeta) tunnel.inspector_servername = secure.servername; },
        inspectorError() { row.failure = "inspector_tls_failure"; },
      });
    })()));
    const proxyPort = await listen(proxy);
    const { chromium } = await import("playwright");
    const localGuard = process.env.AIRLOCK_LOCAL_GUARD_REGISTRATION === "1"
      ? await bounded(beginLocalGuardRegistration({
        directory: output, source_sha256: localGuardSourceDigest(sourceBefore), window,
      })) : null;
    browserServer = await chromium.launchServer({
      executablePath: fileURLToPath(new URL("./qualification-loopback-chrome", import.meta.url)),
      headless: true, host: "127.0.0.1", timeout: 10000,
      proxy: { server: `http://127.0.0.1:${proxyPort}` },
      args: ["--disable-background-networking", "--dns-prefetch-disable", `--ignore-certificate-errors-spki-list=${spki}`],
    });
    if (localGuard) await bounded(localGuard.ready(browserServer));
    browser = await chromium.connect(browserServer.wsEndpoint());
    if (browser.version() !== "156.0.8078.49") fail("cohort_mismatch");
    browserCdp = await browser.newBrowserCDPSession();
    for (const protocol of ["h1", "h2"]) {
      // The receiver parser is deliberately not the guard. It must accept a
      // diagnostic bypass over the 64 KiB observation ceiling, not answer 431.
      const application = protocol === "h1" ? httpServer({ maxHeaderSize: 131072 })
        : h2Server({ maxHeaderListPairs: 8192, settings: { maxHeaderListSize: 131072 } });
      application.on("connection", own);
      application.on("session", session => {
        sessions.add(session); session.on("error", () => {});
        session.once("close", () => sessions.delete(session));
      });
      application.on("request", (request, response) => {
        request.on("error", () => {}); response.on("error", () => {});
        request.stream?.on("error", () => {});
        const row = active;
        if (!row) { response.writeHead(403).end(); return; }
        const receipt = { url: request.url, method: request.method, headers: request.rawHeaders,
          cookie: request.headers.cookie ?? "", application_peer_port: request.socket.remotePort,
          stream: request.stream?.id ?? null };
        if (!retainEvidence(row, receipt)) { request.destroy(); return; }
        row.receiver.push(receipt); request.resume();
        const index = Number(new URL(request.url, COLLECTOR).searchParams.get("r"));
        if (cohort === "deadline" && index === 1) {
          const deadline = setTimeout(() => {
            diagnosticTimers.delete(deadline);
            lifecycleControls.diagnostic_deadline = row.receiver.length === 2;
            row.observer.stop("diagnostic_deadline"); stopSockets();
          }, 100);
          diagnosticTimers.add(deadline);
          return;
        }
        if (row.fault && !row.fault_injected && index === (row.fault === "early-retry" ? 1 : 7)) {
          row.fault_injected = true;
          if (protocol === "h1") request.socket.destroy();
          else if (row.fault === "goaway") {
            request.stream.session.goaway(H2.NGHTTP2_NO_ERROR, 0);
            request.stream.close(H2.NGHTTP2_REFUSED_STREAM);
          } else request.stream.close(H2.NGHTTP2_REFUSED_STREAM);
          return;
        }
        response.sendDate = false;
        const responseHeaders = { "Content-Type": "image/png", "Cache-Control": "no-store",
          "Access-Control-Allow-Origin": "https://owned.example", "Access-Control-Allow-Credentials": "true" };
        if (!row.kind.startsWith("header-")) responseHeaders["Set-Cookie"] = [
            "partitioned_fixture=one; Secure; SameSite=None; Partitioned; Path=/",
            "partitioned_second=two; Secure; SameSite=None; Partitioned; Path=/",
        ];
        const coding = ["gzip", "deflate", "br"].find(coding => row.kind.startsWith(coding + "-"));
        const framing = cohort === "transport" ? (protocol === "h1" ? "close" : "chunked")
          : coding ? "chunked" : row.kind.startsWith("chunked") || row.kind.startsWith("trailers") ? "chunked"
          : row.kind.startsWith("close-") ? "close" : "length";
        if (coding) responseHeaders["Content-Encoding"] = coding;
        if (framing === "close") {
          response.useChunkedEncodingByDefault = false; response.shouldKeepAlive = false; responseHeaders.Connection = "close";
        }
        let body = PNG, status = 200;
        const redirect = row.kind.includes("redirect") && index === 0;
        if (redirect) {
          status = 302; responseHeaders.Location = caseUrl(1); body = Buffer.from("synthetic original redirect body");
        }
        const large = (row.kind.endsWith("-exact") || row.kind.includes("-over-")) && cohort !== "request" && index === 1;
        if (large) {
          const key = protocol + "/" + (coding ?? framing), prior = row.observer?.originals().responses[0];
          if (prior) headerSizes.set(key, { bytes: prior.header_bytes, contentLength: framing === "length" ? PNG.length : null });
          const base = headerSizes.get(key);
          if (!base) { row.failure = "missing_original_header_baseline"; response.destroy(); return; }
          let length = 2097152 - base.bytes + (row.kind.includes("-over-") ? 1 : 0);
          if (base.contentLength !== null) {
            const delta = String(length).length - String(base.contentLength).length;
            length -= delta;
          }
          body = Buffer.alloc(length, 65); PNG.copy(body);
        } else if (cohort === "aggregate") { body = Buffer.alloc(900000, 65); PNG.copy(body); }
        const encoded = coding === "gzip" ? gzipSync(body) : coding === "deflate" ? deflateSync(body)
          : coding === "br" ? brotliCompressSync(body, { params: { [ZLIB.BROTLI_PARAM_QUALITY]: 4 } }) : body;
        const truncated = row.kind.startsWith("truncated") && (redirect || index === 1);
        if (framing === "length") responseHeaders["Content-Length"] = String(encoded.length + (truncated ? 1 : 0));
        if (row.kind.startsWith("informational") && index === 1) {
          if (protocol === "h1") response.writeEarlyHints({ link: "</synthetic>; rel=preload" });
          else request.stream.additionalHeaders({ ":status": 103, link: "</synthetic>; rel=preload" });
        }
        receipt.response_status = status; receipt.response_body_sha256 = hash(body);
        receipt.response_decoded_bytes = body.length;
        response.writeHead(status, responseHeaders);
        if (cohort === "transport" && row.kind.endsWith("-reset")) {
          response.flushHeaders(); response.write(encoded.subarray(0, 20));
        } else if (row.kind.startsWith("trailers") && index === 1) {
          response.write(encoded); response.addTrailers({ "X-Synthetic-Trailer": "unsupported" }); response.end();
        } else if (truncated) {
          response.flushHeaders();
          response.write(encoded, () => {
            if (protocol === "h1") request.socket.destroy();
            else request.stream.close(H2.NGHTTP2_CANCEL);
          });
        } else {
          // No implicit Content-Length for the unknown-length fixtures.
          if (framing !== "length") response.write(encoded);
          response.end(framing === "length" ? encoded : undefined);
        }
      });
      const applicationPort = await listen(application);
      const receiverPeers = new Map();
      const receiver = tlsServer({ ...upstreamIdentity, ALPNProtocols: [protocol === "h2" ? "h2" : "http/1.1"] }, secure => {
        own(secure); secure.pause();
        const row = active, plain = own(tcpConnect({ host: "127.0.0.1", port: applicationPort }));
        const link = { tls_peer_port: secure.remotePort, application_peer_port: null,
          request_hash: createHash("sha256"), response_hash: createHash("sha256"), request_bytes: 0, response_bytes: 0 };
        link.reset_tcp_peer = () => receiverPeers.get(secure.remotePort).resetAndDestroy();
        row.sink_links.push(link);
        plain.once("connect", () => {
          link.application_peer_port = plain.localPort; secure.pipe(plain); plain.pipe(secure); secure.resume();
        });
        secure.on("data", bytes => { link.request_hash.update(bytes); link.request_bytes += bytes.length; });
        plain.on("data", bytes => { link.response_hash.update(bytes); link.response_bytes += bytes.length; });
        secure.once("close", () => plain.destroy()); plain.once("close", () => secure.destroy());
      });
      receiver.on("connection", socket => {
        own(socket); const port = socket.remotePort; receiverPeers.set(port, socket);
        socket.once("close", () => receiverPeers.delete(port));
      });
      receiver.on("tlsClientError", () => {});
      const upstreamPort = await listen(receiver);
      const plans = diagnosticPlans(cohort, protocol);
      for (const [kind, count, enforce, fault] of plans) {
        let row;
        const observer = enforce ? createInspectedHttpWire(declaredMeta ? {
          mode: "DECLARED-META-PROFILE", profile: declaredMetaProfile(),
          resolveObservation: actual => {
            const matches = row.logical_observations
              .filter(logical => logical.url === actual.url && logical.method === actual.method
                && logical.network_resource_type === logical.resource_type)
              .map(logical => ({ network_id: logical.network_id, url: logical.url, method: logical.method,
              resource_type: logical.resource_type, fetch_id: logical.fetch_id,
                ...(logical.redirect_from === undefined ? {} : { redirect_from: logical.redirect_from }) }));
            // Fixed LOCAL selection faults reuse only the actual CDP data.
            // Duplication means ambiguous resolver output, not invented events.
            if (kind === "missing-binding-enforced") return [];
            if (kind === "ambiguous-binding-enforced") return [...matches, ...matches];
            return matches;
          },
        } : undefined) : null;
        if (observer) observers.add(observer);
        row = { protocol, kind, count, fault, observer, enforce, browserReceipts: null,
          budget: observer ?? createPhysicalRequestBudget({ enforce }),
          logical_authority: false, upstream_port: upstreamPort, receiver: [], tunnels: [], sink_links: [],
          denials: {}, authenticated_peers: 0, admissions: [], browser_bodies: [], retained_bytes: 0,
          ...(declaredMeta ? { logical_observations: [], network_events: [], fetch_events: [] } : {}) };
        active = row;
        const fetchMode = declaredMeta ? kind.startsWith("fetch-")
          : cohort !== "physical" && cohort !== "request" || kind.startsWith("method-");
        row.fetchMode = fetchMode;
        const urls = Array.from({ length: count }, (_, index) => {
          let url = caseUrl(index);
          if (index === 1) {
            if (kind.startsWith("marker-")) url = declaredMeta ? url.replace("id=999999999999999&", "")
              : url.replace("999999999999999", "999999999999998");
            if (declaredMeta && kind.startsWith("field-")) url += "&unqualified=synthetic";
            if (kind.startsWith("path-")) url = url.replace("/pixel?", "/unqualified?");
            if (kind.startsWith("url-")) {
              url += "&p="; url += "a".repeat(2048 - Buffer.byteLength(url) + (kind.includes("over") ? 1 : 0));
            }
          }
          return kind === "wrong-authority" ? url.replace(collector, WRONG) : url;
        });
        const plannedUrls = new Set([...urls, ...(kind.includes("redirect") ? [caseUrl(1)] : [])]);
        const context = await browser.newContext({ serviceWorkers: "block" }); contexts.add(context);
        const page = await context.newPage(), cdp = await context.newCDPSession(page), pendingBodies = new Set();
        await cdp.send("Network.enable");
        const network = new Set();
        cdp.on("Network.requestWillBeSent", event => {
          if (plannedUrls.has(event.request.url)) network.add(event.requestId);
          if (declaredMeta && plannedUrls.has(event.request.url)) {
            const observed = { network_id: event.requestId, url: event.request.url, method: event.request.method,
              resource_type: event.type, redirect_from_url: event.redirectResponse?.url ?? null,
              redirect_status: event.redirectResponse?.status ?? null };
            if (retainEvidence(row, observed)) row.network_events.push(observed);
          }
          if (event.redirectResponse && plannedUrls.has(event.request.url)) row.browser_redirect_edges = (row.browser_redirect_edges ?? 0) + 1;
        });
        cdp.on("Network.loadingFinished", event => {
          if (!network.has(event.requestId) || !["physical", "request", "declared-meta"].includes(cohort)) return;
          const promise = cdp.send("Network.getResponseBody", { requestId: event.requestId })
            .then(result => row.browser_bodies.push(hash(Buffer.from(result.body, result.base64Encoded ? "base64" : "utf8"))))
            .catch(() => { row.body_unavailable = true; }).finally(() => pendingBodies.delete(promise));
          pendingBodies.add(promise);
        });
        cdp.on("Fetch.requestPaused", event => task((async () => {
          if (event.request.url === DOCUMENT) {
            const nonce = randomBytes(16).toString("hex");
            const script = fetchMode ? `window.run=async()=>{window.outcomes=[];window.bodyReceipts=[];for(const [n,url] of ${JSON.stringify(urls)}.entries()){
              try {const response=await fetch(url,{credentials:"include",method:${kind.startsWith("method-") ? '(n===1?"POST":"GET")' : '"GET"'}});
              const bytes=await response.arrayBuffer(),digest=await crypto.subtle.digest("SHA-256",bytes);
              bodyReceipts.push({status:response.status,bytes:bytes.byteLength,sha256:Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,"0")).join("")});
              outcomes.push(true);}catch{outcomes.push(false);}}return outcomes;};`
              : `window.run=async()=>{window.outcomes=[];for(const url of ${JSON.stringify(urls)})await new Promise(resolve=>{
            const image=new Image();image.onload=()=>{outcomes.push(true);resolve()};image.onerror=()=>{outcomes.push(false);resolve()};
            image.src=url;});return outcomes;};`;
            const fixture = `<!doctype html><title>Local inspection</title><link rel="icon" href="data:,"><script nonce="${nonce}">${script}</script>`;
            await cdp.send("Fetch.fulfillRequest", { requestId: event.requestId, responseCode: 200,
              responseHeaders: [{ name: "Content-Type", value: "text/html" },
                { name: "Content-Security-Policy", value: `default-src 'none'; script-src 'nonce-${nonce}'; img-src ${collector} ${WRONG} data:; connect-src ${collector}; base-uri 'none'; frame-src 'none'; worker-src 'none'` }],
              body: Buffer.from(fixture).toString("base64") });
          } else if ((event.resourceType === "Image" || fetchMode && ["XHR", "Fetch"].includes(event.resourceType))
                        && plannedUrls.has(event.request.url)
                        && ["GET", ...(kind.startsWith("method-") ? ["POST"] : [])].includes(event.request.method)
                        && !event.request.hasPostData) {
            if (!retainEvidence(row, event.request.url)) {
              await cdp.send("Fetch.failRequest", { requestId: event.requestId, errorReason: "BlockedByClient" }); return;
            }
            row.admissions.push(event.request.url);
            if (declaredMeta) {
              const observed = { fetch_id: event.requestId, network_id: event.networkId ?? null,
                url: event.request.url, method: event.request.method, resource_type: event.resourceType };
              if (!retainEvidence(row, observed)) return;
              row.fetch_events.push(observed);
              const matches = row.network_events.filter(network => network.network_id === event.networkId
                && network.url === event.request.url && network.method === event.request.method);
              if (matches.length === 1) {
                // Fetch's domain calls a real JS fetch "XHR" in this pinned
                // Chrome; Network calls it "Fetch". Preserve both originals,
                // and classify from the actual Network observation.
                const network = matches[0], logical = { ...observed, fetch_resource_type: observed.resource_type,
                  resource_type: network.resource_type, network_resource_type: network.resource_type };
                if (network.redirect_from_url) {
                  const originals = observer?.originals();
                  const parent = originals?.requests.findLast(request => request.logical_network_id === event.networkId
                    && request.url === network.redirect_from_url && originals.responses.some(response =>
                      response.ordinal === request.ordinal && response.state === "complete"
                      && response.status === network.redirect_status && response.redirect_url === event.request.url));
                  if (parent) logical.redirect_from = parent.ordinal;
                }
                if (retainEvidence(row, logical)) row.logical_observations.push(logical);
              }
            }
            row.logical_authority = kind !== "no-authority";
            const parameters = { requestId: event.requestId };
            if (kind.startsWith("header-") && event.request.url === urls[1]) {
              const baseline = row.observer?.originals().requests[0] ?? headerSizes.get(protocol + "/request");
              if (!baseline) fail("missing_final_header_baseline");
              headerSizes.set(protocol + "/request", baseline);
              const addition = Buffer.byteLength(JSON.stringify([...baseline.headers, ["X-Padding", ""]])) - baseline.header_bytes;
              parameters.headers = [...Object.entries(event.request.headers).map(([name, value]) => ({ name, value })),
                { name: "X-Padding", value: "a".repeat(65536 - baseline.header_bytes - addition + (kind.includes("over") ? 1 : 0)) }];
            }
            await cdp.send("Fetch.continueRequest", parameters);
          } else await cdp.send("Fetch.failRequest", { requestId: event.requestId, errorReason: "BlockedByClient" });
        })()));
        await cdp.send("Fetch.enable", { patterns: [{ urlPattern: "*", requestStage: "Request" }] });
        await page.goto(DOCUMENT, { waitUntil: "load", timeout: 4000 });
        row.outcomes = await bounded(page.evaluate(() => window.run()));
        const browserReceipts = fetchMode && !row.budget.snapshot().stopped ? await page.evaluate(() => window.bodyReceipts) : null;
        row.browserReceipts = browserReceipts;
        if (browserReceipts && !retainEvidence(row, browserReceipts)) fail("browser_receipt_retention_failed");
        await Promise.allSettled([...pendingBodies]);
        if (kind === "normal" && protocol === "h1") {
          const socket = own(tcpConnect({ host: "127.0.0.1", port: proxyPort }));
          const reply = await bounded(new Promise((resolve, reject) => {
            socket.once("connect", () => socket.write("CONNECT " + authority + " HTTP/1.1\r\nHost: " + authority + "\r\n\r\n"));
            socket.once("data", bytes => resolve(bytes.toString("ascii"))); socket.once("error", reject);
          }));
          controls.untrusted_local_peer_denied = reply.startsWith("HTTP/1.1 403") && row.denials.peer === 1;
          socket.destroy();
        }
        if (cohort === "close-failure") {
          // Fixed lost-acknowledgement injection after starting a REAL close,
          // not a claim that the OS itself failed. Ownership stays until the
          // finally retry has observed completion of that same context.
          const closing = context.close();
          lifecycleControls.diagnostic_context_close_failure = contexts.has(context);
          await Promise.race([Promise.reject(new Error("diagnostic_context_close_failure")), closing]);
        }
        await bounded(context.close()); contexts.delete(context);
        await Promise.allSettled([...tasks]); stopSockets(); await sleep(20);
        recordCase(row);
        if (kind === "wrong-authority") controls.wrong_authority_denied = row.receiver.length === 0 && row.denials.authority > 0;
        if (kind === "no-authority") controls.missing_logical_authority_denied = row.receiver.length === 0 && row.denials.no_authority > 0;
        if (kind === "untrusted-cert") controls.upstream_untrusted_certificate_denied = row.receiver.length === 0 && row.denials.upstream_certificate > 0;
        if (kind === "wrong-name") controls.upstream_wrong_name_denied = row.receiver.length === 0 && row.denials.upstream_certificate > 0;
        active = null;
        if (kind === "normal" && row.receiver.length !== 2) fail("cold_cross_origin_unqualified");
      }
      await closeServer(receiver); await closeServer(application);
    }
  } catch (error) {
    const category = ["cold_cross_origin_unqualified", "inspection_step_deadline", "cohort_mismatch",
      "diagnostic_context_close_failure", "diagnostic_output_failure"].includes(error.message)
      ? error.message : "local_inspection_failed";
    errors.push(category);
    if (active) active.failure ??= category;
  } finally {
    cleanupMode = true;
    for (const context of contexts) {
      try {
        await bounded(context.close(), 2000); contexts.delete(context);
        if (cohort === "close-failure") lifecycleControls.context_close_retry_observed = true;
      } catch { errors.push("context_close_failed"); }
    }
    for (const timer of diagnosticTimers) clearTimeout(timer);
    diagnosticTimers.clear();
    stopSockets();
    for (const observer of observers) if (observer.snapshot().decompressors) observer.stop("inspection_teardown");
    await Promise.allSettled([...tasks]);
    if (browser) try { await bounded(browser.close(), 3000); } catch { errors.push("browser_close_failed"); }
    if (browserServer) try { await bounded(browserServer.close(), 3000); } catch { errors.push("browser_server_close_failed"); }
    const child = browserServer?.process();
    if (child && child.exitCode === null && child.signalCode === null) {
      child.kill("SIGKILL");
      try { await bounded(new Promise(resolve => child.once("exit", resolve)), 2000); }
      catch { errors.push("browser_process_close_failed"); }
    }
    for (const context of [...contexts]) try { await bounded(context.close(), 1000); contexts.delete(context); }
    catch { errors.push("context_retry_failed"); }
    await sleep(20);
    for (const server of [...servers]) try { await closeServer(server); } catch { errors.push("server_close_failed"); }
    for (const server of [...servers]) try { await closeServer(server); } catch { errors.push("server_close_retry_failed"); }
    for (const path of secrets) if (existsSync(path)) unlinkSync(path);
    clearTimeout(timer);
  }
  const resourcesClosedAt = Date.now();
  const cleanup = { contexts_closed: contexts.size === 0, sockets_closed: sockets.size === 0,
    sessions_closed: sessions.size === 0, servers_closed: servers.size === 0, observers_settled: tasks.size === 0,
    server_close_observers_settled: closingServers.size === 0,
    decompressors_closed: [...observers].every(observer => observer.snapshot().decompressors === 0),
    diagnostic_timers_cleared: diagnosticTimers.size === 0,
    private_keys_removed: secrets.every(path => !existsSync(path)),
    browser_process_exited: !browserServer || browserServer.process().exitCode !== null || browserServer.process().signalCode !== null,
    deadline_met: !expired && remaining() > 0 };
  if (active && !active.recorded) {
    try { recordCase(active, true, cleanup); }
    catch { errors.push("failure_evidence_write_failed"); }
  }
  const caseEvidencePreserved = rows.length > 0 && rows.length === captures.length && (!active || active.recorded === true);
  const matrix = cohort !== "physical" ? rows.length === ["h1", "h2"].reduce((total, protocol) =>
    total + diagnosticPlans(cohort, protocol).length, 0) && rows.every(row => row.case_qualified) : ["h1", "h2"].every(protocol => {
    const find = kind => rows.find(row => row.protocol === protocol && row.kind === kind);
    const normal = find("normal"), enforced = find("retry-enforced"), bypass = find("retry-bypass");
    return normal?.receiver_attempts === 2 && normal.reason === null && normal.semantic_requests === 2
                  && normal.complete_original_responses === 2 && normal.sink_response_originals_match && normal.duplicate_set_cookie_observed
                  && normal.original_bytes_equal && normal.cookie_attached && normal.browser_originals_match
                  && enforced?.receiver_attempts === 8 && enforced.observed_header_starts === 9 && enforced.forwarded === 8
                  && enforced.reason === "physical_request_limit" && enforced.fault_injected
                  && enforced.semantic_requests === 8 && enforced.complete_original_responses === 7
                  && enforced.image_outcomes.at(-1) === false && enforced.original_bytes_equal
                  && bypass?.receiver_attempts === 9 && bypass.observed_header_starts === 9 && bypass.forwarded === 9
                  && bypass.fault_injected && bypass.image_outcomes.every(Boolean) && bypass.original_bytes_equal
                  && (protocol !== "h2" || enforced.same_session_h2_retry && bypass.same_session_h2_retry);
  }) && ["goaway-enforced", "goaway-bypass"].every(kind => {
    const row = rows.find(row => row.kind === kind);
    return row?.receiver_attempts === (kind.endsWith("enforced") ? 8 : 9) && row.fault_injected && row.original_bytes_equal;
  });
  const sourceAfter = pins();
  if (JSON.stringify(sourceBefore) !== JSON.stringify(sourceAfter)) errors.push("source_changed");
  const qualified = !Object.values(lifecycleControls).some(value => value === true)
    && caseEvidencePreserved && matrix && rows.every(row => !row.failure
    && (!row.retention.late_wire_overflow || row.expected_guard === "aggregate_overflow"))
    && (!["physical", "declared-meta"].includes(cohort) || Object.values(controls).every(Boolean))
    && Object.values(cleanup).every(Boolean) && !errors.length;
  const semanticsQualified = qualified && cohort === "physical" && rows.filter(row => row.kind === "normal").every(row =>
    row.semantic_requests === 2 && row.complete_original_responses === 2 && row.sink_response_originals_match && row.duplicate_set_cookie_observed);
  const report = { schema: "airlock.local-inspected-physical-count.v1", diagnostic_cohort: cohort, window,
    local_count_qualified: qualified && cohort === "physical", local_composition_qualified: qualified && !declaredMeta,
    ...(declaredMeta ? { local_declared_profile_qualified: qualified, source_bytes_verified: false,
      independent_ownership_authentication: false, matching_qualified: false, tls_boundary: tlsBoundary } : {}),
    local_semantic_response_qualified: semanticsQualified,
    full_native_guard_qualified: false, execution_authority: false,
    captured_reference_accepted: false,
    available_case_evidence_preserved: caseEvidencePreserved,
    inspected_network: true, native_tls_parity: false, native_execution_qualified: false,
    official_sdk_executed: false, public_upstream_requests: 0, owner_slots_reserved: 0,
    cohort: { node: process.version, chrome: browser?.version() ?? null, darwin: release(),
      macos: "27.0.1", playwright: require("playwright/package.json").version, headless: true },
    cohort_sha256: hash(Buffer.from(JSON.stringify({ diagnostic: cohort, node: process.version,
      chrome: browser?.version() ?? null, darwin: release(), source: sourceBefore }))),
    synthetic_policy: declaredMeta
      ? "fixed declared Meta-shaped profile, fake 999999999999999 selector and owned.example document; literal 127.0.0.1 upstream only; no provider traffic/source bytes"
      : "fixed first-party collector.test.invalid and fake 999999999999999 marker; literal-loopback upstream only; not provider traffic",
    retention_contract: "Per case: every retained plaintext wire copy, logical URL, receiver request evidence, ordered semantic header observation and decoded original body shares 8388608 bytes. Headers plus decoded body share 2097152 per response. Sink equality uses incremental digests, not duplicate retained wire. Original raw octets remain unchanged; semantic H1 pairs remove protocol OWS only. Serialization encodings are not additional observation channels. This is not an RSS/Chrome-internal-buffer claim.",
    residuals: [declaredMeta
      ? "fixed synthetic declared Meta profile and actual CDP/physical correlation only; not source consumption, authenticated ownership, SDK/controller execution or a complete native guard"
      : "fixed generated first-party GET policy only; not complete native Meta policy, authenticated ownership, SDK/source or dispatch proof",
      "exact aggregate boundary is a ledger test; real Chrome aggregate controls use a below/over pair",
      "same-TLS authority, malformed frames and server push include parser controls; actual browser authority control is at the broker",
      "no default-browser TLS, ordinary vendor-network, performance, matching, attribution or downstream product qualification",
      "native guard/review/source/setup/window authority remains open; no SDK, actual owner records, case reservation or real event"],
    ...(declaredMeta ? { logical_binding_contract: "Network.requestWillBeSent requestId/type/url/method correlated with Fetch.requestPaused networkId/requestId/url/method. Both resource types and distinct IDs retained. Pinned Chrome calls JS fetch Network Fetch / interception XHR; policy uses observed Network type, never profile-expected Image. Redirect legs reuse Network IDs only with a distinct actual Fetch ID and completed exact physical parent. Hidden retries bind the earlier unchanged logical observation to fresh physical/policy ordinals. Missing/duplicate candidate controls deliberately alter selection of actual observations, not CDP events." } : {}),
    unsupported: ["request bodies, informational responses, trailers, chunk extensions, HTTP3 and server push",
      "raw response headers above 65536 bytes and semantic HPACK blocks above 65536 bytes",
      "raw deflate, unknown/stacked content encodings, nondefault H2 frame-size settings and header tables above 65536",
      "native stock/controller qualification and vendor outcomes"],
    source_before: sourceBefore, source_after: sourceAfter, controls, lifecycle_controls: lifecycleControls, cases: rows, errors, cleanup,
    producer_exit_code: qualified ? 0 : 2, elapsed_ms: Math.ceil(performance.now() - started) };
  const capture = { schema: "airlock.local-inspected-originals.v1", inspected_network: true, cases: captures };
  const publication = { resources_closed_at_ms: resourcesClosedAt, capture_written_at_ms: null,
    report_write_started_at_ms: null, attempted_at_ms: null };
  try {
    outputDeadline();
    writeMetaPrivate(join(output, "capture.json"), capture);
    publication.capture_written_at_ms = Date.now();
    outputDeadline();
    publication.report_write_started_at_ms = Date.now();
    writeMetaPrivate(join(output, "report.json"), report);
    // Delay alone is the fixed fault. The very same absolute publication
    // guard above and below decides whether this case has actually expired.
    if (cohort === "late-output") await sleep(Math.max(1, remaining() + 25));
    publication.attempted_at_ms = Date.now();
    outputDeadline();
    writeMetaPrivate(join(output, "completion.json"), { schema: "airlock.local-inspected-completion.v1",
      producer_exit_code: report.producer_exit_code, command_exit_observed: false, window, publication,
      report_sha256: hash(readMetaPrivate(join(output, "report.json"))),
      capture_sha256: hash(readMetaPrivate(join(output, "capture.json"))) });
    outputDeadline();
  } catch (error) {
    if (error.message !== "inspection_output_deadline") throw error;
    writeMetaPrivate(join(output, existsSync(join(output, "completion.json")) ? "completion-invalidated.json" : "failure-finalization.json"), {
      schema: "airlock.local-inspected-finalization-failure.v1", captured_reference_accepted: false,
      producer_exit_code: 2, command_exit_observed: false, failure_category: error.message, errors: [error.message],
      window, publication, elapsed_ms: Math.ceil(performance.now() - started),
      cleanup: { ...cleanup, deadline_met: !expired && remaining() > 0 },
      report_sha256: existsSync(join(output, "report.json")) ? hash(readMetaPrivate(join(output, "report.json"))) : null,
      capture_sha256: existsSync(join(output, "capture.json")) ? hash(readMetaPrivate(join(output, "capture.json"))) : null,
    });
    throw error;
  }
  return report;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  try {
    const args = process.argv.slice(2);
    const cohort = new Map([["--qualify", "physical"],
      ...COHORTS.filter(name => name !== "physical").map(name => ["--qualify-" + name, name])]).get(args[0]);
    if (args.length !== 3 || !COHORTS.includes(cohort) || args[1] !== "--output-dir") fail("invalid_inspection_options");
    const report = await runLocalInspection({ outputDir: args[2], cohort });
    console.log(JSON.stringify({ category: report.local_declared_profile_qualified ? "local_declared_profile_qualified"
      : report.local_composition_qualified ? "local_composition_qualified" : "local_inspection_blocked",
      cases: report.cases.length, sdk_executed: false, native_tls_parity: false }));
    process.exitCode = report.producer_exit_code;
  } catch (error) {
    console.error(["invalid_inspection_options", "unsafe_inspection_output", "cohort_mismatch"].includes(error.message)
      ? error.message : "inspection_failed");
    process.exitCode = 3;
  }
}
