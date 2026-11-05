import { createHash } from "node:crypto";
import { closeSync, constants, fsyncSync, lstatSync, mkdirSync, openSync, realpathSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { isProxy } from "node:util/types";
import { createInspectedHttpWire } from "./inspected-http-wire.mjs";
import { writeGoogleOriginals } from "./inspected-google-originals.mjs";
import { data, record } from "./inspected-meta-record.mjs";
import { startLocalGoogleInspectedTransport } from "./inspected-transport.mjs";
import { reserveStockSlot } from "./native-stock-capture.mjs";
import { writeMetaPrivate } from "./native-stock-meta.mjs";
import { LIMITS } from "./native-stock-policy.mjs";
export { prepareNativeGoogleStock } from "./inspected-google-admission.mjs";

const COMMANDS = Object.freeze(["initialize", "configure", "conversion"]);
const PROFILE = Object.freeze({
  schema_version: 1, profile: "google-ads-conversion", case_name: "google-stock",
  document_url: "https://owned.example/inspection",
  owned: { conversion_id: "AW-000000000", conversion_label: "synthetic",
    value: 1, currency: "USD", transaction_id: "synthetic-transaction" },
  resources: [{ role: "runtime", url: "https://www.googletagmanager.com/gtag/js?id=AW-000000000",
    sha256: "318a26b825f07b60faec698d5e771434c36e3f7f248640988c1c0be5220c3e50" }],
  companion_authorized: true,
});

function localDirectory(directory, prefix) {
  const parent = resolve("rig/out");
  if (typeof directory !== "string" || dirname(directory) !== parent || resolve(directory) !== directory
    || !new RegExp(`^${prefix}-[a-f0-9]{16}$`).test(directory.slice(parent.length + 1)))
    throw Error("nonlocal_google_fixture");
  const stat = lstatSync(parent);
  if (!stat.isDirectory() || stat.isSymbolicLink() || realpathSync(parent) !== parent
    || stat.uid !== process.getuid() || (stat.mode & 0o7777) !== 0o700)
    throw Error("unsafe_google_fixture_parent");
  mkdirSync(directory, { mode: 0o700 });
  for (const path of [directory, parent]) {
    const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    try { fsyncSync(fd); } finally { closeSync(fd); }
  }
}

function failureReceipt(directory, reason) {
  const parent = resolve("rig/out");
  if (typeof directory !== "string" || dirname(directory) !== parent || resolve(directory) !== directory
    || !/^google-result-[a-f0-9]{16}$/.test(directory.slice(parent.length + 1))) return;
  const stat = lstatSync(parent);
  if (!stat.isDirectory() || stat.isSymbolicLink() || realpathSync(parent) !== parent
    || stat.uid !== process.getuid() || (stat.mode & 0o7777) !== 0o700) return;
  writeMetaPrivate(join(parent, `google-failure-${directory.slice(-16)}.json`), {
    schema: "airlock.sdk-absent-google-controller-failure.v1", complete: false,
    reason, native_execution_qualified: false,
  });
}

// A freshly created fixture never reads or selects the owner's authority.
export function reserveLocalGoogleSlot(directory) {
  localDirectory(directory, "google-slot");
  const authority = {
    schema_version: 1, kind: "owner_conversation_authority", status: "approved_conditional",
    authority_id: "synthetic-only-grant",
    cases: { "google-stock": { reserved: false, admitted: false, spent: false } },
    limits: { google_purchase_commands_total: 2, google_value_per_command: 1, google_currency: "USD",
      google_action: "owned_secondary_purchase", meta_pageview_commands_total: 2,
      google_vendor_https_requests_per_case: LIMITS.google_requests,
      meta_vendor_https_requests_per_case: LIMITS.meta_requests,
      observed_requests_per_case: LIMITS.observations, absolute_seconds_per_case: 60,
      url_bytes: LIMITS.url_bytes, request_headers_and_body_bytes: LIMITS.request_bytes,
      response_bytes: LIMITS.response_bytes, retained_aggregate_bytes: LIMITS.aggregate_bytes },
  };
  const path = join(directory, "synthetic-authority.json"), now = Date.now();
  writeMetaPrivate(path, authority);
  const hash = value => createHash("sha256").update(value).digest("hex");
  // writeMetaPrivate appends exactly one newline.
  const authoritySha = hash(JSON.stringify(authority) + "\n");
  return reserveStockSlot({ authority_path: path, authority_sha256: authoritySha,
    case_name: "google-stock", input_sha256: hash("synthetic-google-input"),
    source_sha256: hash("synthetic-only-no-sdk"),
    window: { not_before_ms: now, expires_at_ms: now + LIMITS.duration_ms } });
}

export function createLocalGoogleController(options = {}) {
  const input = record(options, [], ["clock", "durationMs", "settlementMs"]);
  const clock = input.clock ?? (() => performance.now());
  const duration = input.durationMs ?? LIMITS.duration_ms;
  const settlement = input.settlementMs ?? 5000;
  if (typeof clock !== "function" || isProxy(clock) || !Number.isSafeInteger(duration)
    || duration < 2 || duration > LIMITS.duration_ms || !Number.isSafeInteger(settlement)
    || settlement < 1 || settlement >= duration) throw Error("invalid_google_local_window");
  const realStart = performance.now();
  let start, last;
  try { start = last = clock(); } catch { throw Error("invalid_google_local_clock"); }
  if (!Number.isFinite(start)) throw Error("invalid_google_local_clock");
  const commands = [], logical = [];
  let transportStarted = false, transport = null, timer = null, finished = false;
  const observer = createInspectedHttpWire({
    mode: "DECLARED-GOOGLE-PROFILE", profile: PROFILE,
    resolveObservation: ({ url, method }) => logical.filter(row => row.url === url && row.method === method),
  });
  const stop = reason => { observer.stop(reason); throw Error(reason); };
  const check = () => {
    if (finished) throw Error("google_fixture_already_finished");
    let now;
    try { now = clock(); } catch { return stop("case_window_inactive"); }
    if (!Number.isFinite(now) || now < last || now - start >= duration - settlement)
      return stop("case_window_inactive");
    last = now;
    if (observer.snapshot().stopped) throw Error(observer.snapshot().reason);
    if (commands.length !== COMMANDS.length) return stop("google_command_sequence");
  };
  return Object.freeze({
    command(name) {
      if (finished) throw Error("google_fixture_already_finished");
      if (observer.snapshot().stopped) throw Error(observer.snapshot().reason);
      if (commands.length >= COMMANDS.length || name !== COMMANDS[commands.length])
        return stop("google_command_sequence");
      let now;
      try { now = clock(); } catch { return stop("case_window_inactive"); }
      if (!Number.isFinite(now) || now < last || now - start >= duration - settlement)
        return stop("case_window_inactive");
      last = now;
      commands.push(name);
    },
    observe(value) {
      check();
      let row;
      try {
        row = data(value);
        record(row, ["network_id", "url", "method", "resource_type"], ["fetch_id", "redirect_from", "response_parent"]);
        if (typeof row.url !== "string" || Buffer.byteLength(row.url) > LIMITS.url_bytes
          || typeof row.method !== "string" || typeof row.network_id !== "string"
          || typeof row.resource_type !== "string") throw Error("invalid_google_observation");
      } catch {
        return stop("invalid_google_observation");
      }
      if (logical.length >= LIMITS.observations) return stop("google_observation_limit");
      if (!observer.reserveObservation(Buffer.byteLength(JSON.stringify(row)))) return stop("aggregate_overflow");
      logical.push(row);
    },
    connection(protocol, authority = null) {
      check();
      const wire = observer.connection(protocol, authority);
      return Object.freeze({
        request(bytes) { check(); return wire.request(bytes); },
        async response(bytes) { check(); return wire.response(bytes); },
        endRequest() { return wire.endRequest(); },
        async endResponse(termination) { return wire.endResponse(termination); },
      });
    },
    async startLocalTransport(options) {
      check();
      if (transportStarted) return stop("google_transport_already_started");
      transportStarted = true;
      const { inspector, receiver, protocol } = record(options, ["inspector", "receiver", "protocol"]);
      const keys = record(inspector, ["key", "cert"]);
      const target = record(receiver, ["port", "certificate"]);
      if (!Buffer.isBuffer(keys.key) || !Buffer.isBuffer(keys.cert) || !Buffer.isBuffer(target.certificate))
        return stop("invalid_google_local_transport");
      const wait = async (promise, maximum = 5000) => {
        let timer;
        try {
          return await Promise.race([promise, new Promise((_, reject) => {
            timer = setTimeout(() => reject(Error("google_local_transport_timeout")), Math.min(maximum, 5000));
          })]);
        } finally { clearTimeout(timer); }
      };
      const broker = await startLocalGoogleInspectedTransport({
        inspector: { key: Buffer.from(keys.key), cert: Buffer.from(keys.cert) },
        receiver: { port: target.port, certificate: Buffer.from(target.certificate),
          logicalAuthority: authority => logical.some(row => {
            try { return new URL(row.url).host + ":443" === authority; } catch { return false; }
          }) },
        protocol, observer, check, wait,
      });
      try {
        check();
        // This is a Node fixture peer, not browser ownership or qualification.
        broker.attachOwnedBrowser({ send: async () => ({ processInfo: [{ id: process.pid }] }) });
      } catch (error) { await broker.close(); throw error; }
      const close = async () => {
        clearTimeout(timer);
        broker.closeAdmission();
        await broker.close();
      };
      transport = Object.freeze({ port: broker.port, close, closeAdmission: () => broker.closeAdmission(),
        snapshot: () => broker.snapshot() });
      timer = setTimeout(() => {
        observer.stop("case_window_inactive");
        broker.closeAdmission();
        close().catch(() => observer.stop("google_local_cleanup_failed"));
      }, Math.max(1, duration - settlement - (performance.now() - realStart)));
      timer.unref();
      return transport;
    },
    async finish(directory) {
      if (finished) throw Error("google_fixture_already_finished");
      finished = true;
      const errors = [];
      if (transport) {
        try { await transport.close(); } catch { errors.push("google_local_cleanup_failed"); }
      }
      try { localDirectory(directory, "google-result"); }
      catch (error) {
        try { failureReceipt(directory, errors.length ? "google_local_cleanup_failed" : "google_output_unavailable"); }
        catch (receiptError) { throw new AggregateError([error, receiptError], "google_failure_receipt_failed", { cause: receiptError }); }
        throw Error("google_output_unavailable", { cause: error });
      }
      const snapshot = observer.snapshot(), source = observer.originals();
      if (commands.length !== COMMANDS.length) errors.push("google_command_sequence");
      if (snapshot.stopped) errors.push(snapshot.reason);
      if (performance.now() - realStart >= duration) errors.push("google_output_deadline");
      if (source.requests.length === 0 || source.requests.some(row => row.response_state !== "complete"))
        errors.push("google_capture_incomplete");
      let originals = null;
      try { originals = writeGoogleOriginals(directory, source); }
      catch { errors.push("google_originals_write_failed"); }
      if (performance.now() - realStart >= duration && !errors.includes("google_output_deadline"))
        errors.push("google_output_deadline");
      const report = { schema: "airlock.sdk-absent-google-controller.v1",
        outcome: "inconclusive", capture_complete: errors.length === 0, errors,
        commands: [...commands], physical: snapshot, originals,
        native_sdk_executed: false, native_execution_qualified: false, public_upstream_requests: 0,
        independent_completion_observed: false, deadline_qualified: false };
      try { writeMetaPrivate(join(directory, "result.json"), report); }
      catch (error) {
        try { failureReceipt(directory, "google_result_write_failed"); }
        catch (receiptError) { throw new AggregateError([error, receiptError], "google_failure_receipt_failed", { cause: receiptError }); }
        throw Error("google_result_write_failed", { cause: error });
      }
      if (performance.now() - realStart >= duration) {
        try {
          writeMetaPrivate(join(directory, "publication-failure.json"), {
            schema: "airlock.sdk-absent-google-controller-failure.v1", complete: false,
            reason: "google_output_deadline", native_execution_qualified: false,
          });
        } catch (error) { throw Error("google_deadline_receipt_failed", { cause: error }); }
        throw Error("google_output_deadline");
      }
      return report;
    },
    snapshot() {
      return { commands: [...commands], native_sdk_executed: false,
        native_execution_qualified: false, public_upstream_requests: 0,
        logical_observations: logical.length, physical: observer.snapshot() };
    },
  });
}
