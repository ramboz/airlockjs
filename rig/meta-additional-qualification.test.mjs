import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import hpack from "hpack.js";

const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const unitRoots = [];
afterEach(() => { for (const root of unitRoots.splice(0)) rmSync(root, { recursive: true, force: true }); });
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
const chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const launcher = new URL("./qualification-loopback-chrome", import.meta.url).pathname;
function birth(ms) {
  const date = new Date(ms), [day, month, number, year] = date.toDateString().split(" ");
  return `${day} ${month} ${Number(number)} ${date.toTimeString().slice(0, 8)} ${year}`;
}
function frame(type, flags, stream, bytes = Buffer.alloc(0)) {
  const header = Buffer.alloc(9);
  header.writeUIntBE(bytes.length, 0, 3); header[3] = type; header[4] = flags; header.writeUInt32BE(stream, 5);
  return Buffer.concat([header, bytes]);
}
function encoded(pairs) {
  const encoder = hpack.compressor.create({ table: { maxSize: 4096 } }), chunks = [];
  encoder.write(pairs.map(([name, value]) => ({ name, value })));
  for (let chunk; (chunk = encoder.read()) !== null;) chunks.push(chunk);
  return Buffer.concat(chunks);
}
// Unit bytes are produced and decoded by the REAL shared wire observer, not
// empty records or asserted success flags. Real browser positives run below.
async function originalProof(protocol, inputs) {
  const { createInspectedHttpWire } = await import("./inspected-http-wire.mjs");
  const target = "/tr/?id=" + inputs.pixel_id + "&ev=PageView&dl=" + encodeURIComponent(inputs.document_url) + "&r=0";
  const url = "https://www.facebook.com" + target;
  const logical = { network_id: "fixture-image", fetch_id: "fixture-fetch", url, method: "GET", resource_type: "Image" };
  const { localInspectedMetaDefinition } = await import("./inspected-meta-stock.mjs");
  const pins = localInspectedMetaDefinition();
  const { META_REFERENCE_COHORTS } = await import("./native-stock-policy.mjs");
  const profile = { schema_version: 1, profile: "meta-pageview", case_name: "meta-stock",
    document_url: inputs.document_url, owned: { pixel_id: inputs.pixel_id }, companion_authorized: false,
    resources: ["runtime", "configuration"].map(role => ({ role, url: inputs[role].request_url,
      sha256: META_REFERENCE_COHORTS["retained-2026-10-15"][role] })) };
  expect(pins.runtime).toContain("SDK-ABSENT");
  const observer = createInspectedHttpWire({ mode: "DECLARED-META-PROFILE", profile, resolveObservation: () => [logical] });
  const connection = observer.connection(protocol);
  const common = [["content-type", "image/png"], ["cache-control", "no-store"],
    ["set-cookie", "local_one=one; Secure; SameSite=None; Partitioned; Path=/"],
    ["set-cookie", "local_two=two; Secure; SameSite=None; Partitioned; Path=/"], ["content-length", String(png.length)]];
  if (protocol === "h1") {
    connection.request(Buffer.from(`GET ${target} HTTP/1.1\r\nHost: www.facebook.com\r\nSec-Fetch-Dest: image\r\nReferer: https://owned.example/\r\n\r\n`));
    await connection.response(Buffer.concat([Buffer.from("HTTP/1.1 200 OK\r\n"
      + common.map(([k, v]) => k + ": " + v).join("\r\n") + "\r\n\r\n"), png]));
  } else {
    connection.request(Buffer.concat([Buffer.from("PRI * HTTP/2.0\r\n\r\nSM\r\n\r\n"),
      frame(4, 0, 0, Buffer.from("000100010000000200000000000400600000000600040000", "hex")),
      frame(1, 5, 1, encoded([[":method", "GET"], [":authority", "www.facebook.com"], [":scheme", "https"],
        [":path", target], ["sec-fetch-dest", "image"], ["referer", "https://owned.example/"]]))]));
    await connection.response(Buffer.concat([frame(4, 0, 0, Buffer.from("000600020000", "hex")), frame(4, 1, 0)]));
    connection.request(frame(4, 1, 0));
    await connection.response(Buffer.concat([frame(1, 4, 1, encoded([[":status", "200"], ...common])), frame(0, 1, 1, png)]));
  }
  connection.endRequest(); await connection.endResponse();
  expect(observer.snapshot()).toMatchObject({ stopped: false, forwarded: 1 });
  const observed = observer.originals(), request = observed.requests[0];
  const wire = observed.wire.map(w => ({ ...w, request: Buffer.concat(w.request).toString("base64"),
    response: Buffer.concat(w.response).toString("base64") }));
  const wireDigests = { request_sha256: hash(Buffer.from(wire[0].request, "base64")),
    response_sha256: hash(Buffer.from(wire[0].response, "base64")),
    request_bytes: Buffer.from(wire[0].request, "base64").length,
    response_bytes: Buffer.from(wire[0].response, "base64").length };
  const urls = [inputs.document_url, inputs.runtime.request_url, inputs.configuration.request_url, url];
  const types = ["Document", "Script", "Script", "Image"];
  const network = urls.map((url, n) => ({ url, method: "GET", resource_type: types[n],
    network_id: n === 3 ? logical.network_id : "fixture-network-" + n, redirect_url: null, redirect_status: null }));
  return { originals: { requests: observed.requests,
    responses: observed.responses.map(({ decoder: _decoder, ...row }) => ({ ...row,
      body: Buffer.concat(row.body).toString("base64") })), wire },
    logical_observations: [{ ...logical, fetch_resource_type: "Image" }], network_events: network,
    fetch_events: network.map((row, n) => ({ network_id: row.network_id,
      fetch_id: n === 3 ? logical.fetch_id : "fixture-fetch-" + n, resource_type: row.resource_type,
      request: { url: row.url, method: "GET", headers: n === 3 ? { Referer: "https://owned.example/" } : {} } })),
    receiver: [{ url: target, method: "GET", headers: request.headers.flat(), status: 200,
      body_sha256: hash(png), body_bytes: png.length }],
    receiver_wire: [{ peer_port: 10001, ...wireDigests }],
    local_broker: { mode: "sdk-absent", authenticated_peers: 1, errors: [], public_upstream_requests: 0,
      sockets_closed: true, tasks_settled: true, server_closed: true,
      tunnels: [{ upstream_peer_port: 10001, protocol, upstream_authorized: true,
        upstream_validation: "generated-local-ca-and-hostname", ...wireDigests }] } };
}
// Unit-shaped records only. These are not a real-child qualification or native
// receipts. Genuine browser/exit originals are separately required below.
async function unitProof() {
  const { createAdditionalMetaFixture } = await import("./meta-additional-qualification.mjs");
  const api = await import("./inspected-meta-stock.mjs");
  const definition = api.localInspectedMetaDefinition();
  const { reserveStockSlot } = await import("./native-stock-capture.mjs");
  const fixtures = [createAdditionalMetaFixture(), createAdditionalMetaFixture()];
  unitRoots.push(...fixtures.map(f => f.root));
  const save = (path, value) => {
    writeFileSync(path, JSON.stringify(value), { mode: 0o600 });
    return { path, sha256: hash(readFileSync(path)) };
  };
  const cases = await Promise.all(fixtures.map(async (f, n) => {
    const protocol = ["h1", "h2"][n], root = f.root, run = join(root, "run");
    const slot = reserveStockSlot(f.reservationOptions());
    mkdirSync(run, { mode: 0o700 });
    const reservation = { path: slot.canonical_record_path, sha256: hash(readFileSync(slot.canonical_record_path)) };
    const cleanup = Object.fromEntries(["contexts_closed", "sockets_closed", "sessions_closed", "servers_closed",
      "observers_settled", "context_close_observers_settled", "server_close_observers_settled", "script_observers_settled",
      "network_waiters_settled", "decompressors_closed", "private_keys_removed", "browser_process_exited",
      "transport_closed", "transport_sockets_closed", "transport_tasks_settled", "deadline_met"].map(key => [key, true]));
    const reservedAt = JSON.parse(readFileSync(reservation.path)).reserved_at_ms;
    const now = Math.max(Date.now(), reservedAt + 1);
    const manifest = { path: f.options().manifest_path, sha256: f.options().manifest_sha256 };
    const reportValue = { schema: "airlock.sdk-absent-inspected-meta-controller.v1",
      authority_variant: "additional-meta-2026-10-21", protocol, program: "normal",
      local_controller_qualified: true, local_slot_reserved: true, native_sdk_executed: false, execution_authority: false,
      full_native_guard_qualified: false, actual_owner_slots_reserved: 0, public_upstream_requests: 0, errors: [],
      producer_exit_code: 0, binding_sha256: api.inspectedMetaBindingDigest(f.binding), response_originals_match: true,
      original_wire_bytes_equal: true, receiver_attempts: 1, responses_complete: 1, fixture_sources_consumed: 2,
      cohort: f.binding.cohort, negotiated_protocols: [protocol], window: f.binding.window, cleanup, reservation,
      lineage_baseline: f.binding.additional.lineage_baseline, source_before: f.binding.source_pins, source_after: f.binding.source_pins };
    const captureValue = { schema: "airlock.sdk-absent-inspected-meta-originals.v1",
      authority_variant: reportValue.authority_variant, lineage_baseline: reportValue.lineage_baseline,
      reservation, cleanup, local_result: { init: 1, pageview: 1, outcomes: [true] },
      order: ["durable_reservation", "fixture_execution", "logical_dispatch", "receiver", "context_closed"],
      source_execution: ["runtime", "configuration"].map(role => ({ role, sha256: hash(definition[role]),
        evidence: "validated_before_script_execution_and_resumed" })),
      script_evidence: ["runtime", "configuration"].map(role => ({ role, sha256: hash(definition[role]),
        evidence: "actual_script_parsed_source" })),
      verified_source_originals: Object.fromEntries(["runtime", "configuration"].map(role => [role,
        { sha256: hash(definition[role]), bytes_base64: Buffer.from(definition[role]).toString("base64") }])),
      ...structuredClone(await originalProof(protocol, JSON.parse(readFileSync(f.binding.inputs.path)))) };
    const capture = save(join(run, "capture.json"), captureValue);
    const report = save(join(run, "report.json"), reportValue);
    const completionValue = { schema: "airlock.sdk-absent-inspected-meta-completion.v1",
      binding_sha256: reportValue.binding_sha256, command_exit_observed: false, producer_exit_code: 0,
      report_sha256: report.sha256, capture_sha256: capture.sha256, window: f.binding.window,
      publication: { resources_closed_at_ms: now, capture_written_at_ms: now, report_write_started_at_ms: now, attempted_at_ms: now } };
    const completion = save(join(run, "completion.json"), completionValue);
    const childValue = { command_exit_observed: true, actual_exit_code: 0, signal: null, elapsed_external_ms: 1000,
      command: [process.execPath, new URL("./meta-additional-qualification.mjs", import.meta.url).pathname,
        "--supervised-child", protocol, "normal", manifest.path, manifest.sha256] };
    const node = { pid: 1001, ppid: 1000, pgid: 1001, uid: process.getuid(), started: birth(now - 900),
      state: "S", command_sha256: hash(childValue.command.join(" ")) };
    const profile = { path: join(realpathSync(tmpdir()), "playwright_chromiumdev_profile-unitfixture"),
      argument_path: join(realpathSync(tmpdir()), "playwright_chromiumdev_profile-unitfixture"),
      dev: 1, ino: 2, birthtime_ms: now - 400, uid: process.getuid() };
    const rootCommand = chrome + " --user-data-dir=" + profile.argument_path + " --proxy-server=http://127.0.0.1:10003";
    const browserRoot = { ...node, pid: 1002, ppid: node.pid, pgid: 1002, started: birth(now - 350),
      command_sha256: hash(rootCommand) };
    const helper = { ...browserRoot, pid: 1003, ppid: 1002, started: birth(now - 200), command_sha256: hash("unit-only-helper") };
    const keys = ["inspector-key.pem", "receiver-key.pem"].map((name, n) =>
      ({ path: join(run, name), dev: 1, ino: 11 + n, birthtime_ms: now - 700, uid: process.getuid(), size: 1704 }));
    const discoveredRoot = { ...browserRoot };
    const registrationValues = [
      { phase: "node", at_ms: now - 800, node, ports: [], private_keys: [], browsers: [] },
      { phase: "ports", at_ms: now - 650, node, ports: [10001, 10002, 10003], private_keys: keys, browsers: [] },
      { phase: "browser-pending", at_ms: now - 600, node, ports: [10001, 10002, 10003], private_keys: keys, browsers: [] },
      { phase: "browser-discovered", at_ms: now - 250, node, ports: [10001, 10002, 10003], private_keys: keys,
        browsers: [{ root: discoveredRoot, root_command: rootCommand, profile, members: [discoveredRoot] }] },
      { phase: "browser-ready", at_ms: now - 100, node, ports: [10001, 10002, 10003, 10004], private_keys: keys,
        browsers: [{ root: browserRoot, root_command: rootCommand, profile, members: [browserRoot, helper] }] },
      { phase: "resources-final", at_ms: now + 20, node, ports: [10001, 10002, 10003, 10004], private_keys: keys,
        browsers: [{ root: browserRoot, root_command: rootCommand, profile, members: [browserRoot, helper] }] },
    ].map(value => structuredClone(value));
    const supervisionValue = { schema: "airlock.additional-meta-supervision.v1", command: childValue.command,
      control: "normal", started_ms: now - 900, elapsed_ms: 950, node_processes: [],
      source_before: f.binding.source_pins, source_after: f.binding.source_pins, node, node_signals: [],
      node_close_observed: true, child_exit_observed: true, pipes_closed: true,
      actual_exit: save(join(root, "unit-actual-exit.json"), { command: childValue.command, command_exit_observed: true,
        actual_exit_code: 0, signal: null, elapsed_ms: 910, exited_at_ms: now + 10 }),
      registrations: registrationValues.map(value => save(join(root, "unit-registration-" + value.phase + ".json"), value)),
      browsers: [{ root: browserRoot, root_command: rootCommand, profile,
        processes: [browserRoot, helper].map(value => ({ ...value, final: "absent" })),
        status: "closed", profile_removed: true, errors: [], signals: [], initially_left_behind: false }],
      ports: [10001, 10002, 10003, 10004].map(port => ({ port, closed: true })),
      private_keys: keys.map(value => ({ ...value, removed: true })),
      timed_out: false, node_term_observed: false, stuck_after_allocation_observed: false,
      resource_disposition: "closed", qualified: true, errors: [] };
    childValue.supervision = save(join(root, "unit-supervision.json"), supervisionValue);
    const actual_child = save(join(root, "actual-child.json"), childValue);
    return { row: { protocol, manifest, report, capture, completion, actual_child },
      reportValue, captureValue, completionValue, childValue, supervisionValue, registrationValues };
  }));
  const indexValue = { schema: "airlock.sdk-absent-additional-meta-validation.v1",
    source_pins: fixtures[0].binding.source_pins, official_sdk_executed: false, public_upstream_requests: 0,
    actual_owner_slots_reserved: 0, cases: cases.map(c => c.row) };
  const index = () => save(join(fixtures[0].root, "unit-index.json"), indexValue);
  const rebind = entry => {
    Object.assign(entry.row.report, save(entry.row.report.path, entry.reportValue));
    Object.assign(entry.row.capture, save(entry.row.capture.path, entry.captureValue));
    entry.completionValue.report_sha256 = entry.row.report.sha256;
    entry.completionValue.capture_sha256 = entry.row.capture.sha256;
    Object.assign(entry.row.completion, save(entry.row.completion.path, entry.completionValue));
    for (const [n, value] of entry.registrationValues.entries())
      Object.assign(entry.supervisionValue.registrations[n], save(entry.supervisionValue.registrations[n].path, value));
    if (entry.childValue.supervision)
      Object.assign(entry.childValue.supervision, save(entry.childValue.supervision.path, entry.supervisionValue));
    Object.assign(entry.row.actual_child, save(entry.row.actual_child.path, entry.childValue));
  };
  return { api, cases, indexValue, index, rebind };
}
const originalFaults = [
    "missing-url", "url", "method", "resource", "ownership", "headers", "body", "logical-id", "logical-missing",
    "network-id", "network-url", "fetch-method", "fetch-id", "fetch-type", "fetch-headers", "fetch-body",
    "response-status", "response-headers", "response-header-bytes", "response-length", "response-body",
    "empty-body", "noncanonical-body", "receiver-status", "receiver-headers", "receiver-method", "receiver-url",
    "wire-missing", "wire-request", "wire-response", "wire-noncanonical", "wire-protocol", "broker-protocol",
    "receiver-wire-bytes", "receiver-wire-hash", "broker-wire-hash", "negotiated-protocol",
];
const reservationFaults = [
  "at-expiry", "beyond-expiry", "before-window", "at-cleanup", "after-cleanup", "after-publication",
  "noninteger-time", "boolean-time", "missing-time", "wrong-schema", "missing-schema",
  "true-prerequisite", "numeric-prerequisite", "missing-prerequisite", "unknown-key",
  "wrong-state", "wrong-case", "wrong-authority", "wrong-authority-digest", "wrong-source", "wrong-input",
  "wrong-window", "wrong-variant", "wrong-lineage", "wrong-binding",
];
const supervisionFaults = [
  "inventory-live", "inventory-unknown", "inventory-missing", "inventory-malformed", "inventory-wrong-node",
  "inventory-wrong-group", "inventory-wrong-uid", "inventory-wrong-birth", "inventory-wrong-parent",
  "inventory-wrong-state", "inventory-wrong-final", "inventory-duplicate",
  "phase-only", "registration-node-pid", "registration-node-group", "registration-node-birth", "registration-node-uid",
  "registration-node-image", "registration-profile-inode", "registration-profile-path", "registration-profile-birth",
  "registration-browser-pid", "registration-browser-image", "registration-discovered-image",
  "registration-member-missing", "registration-member-birth", "registration-member-group", "registration-member-image",
  "registration-ports", "registration-key-inode", "registration-key-size", "registration-key-uid",
  "registration-key-after-snapshot", "registration-extra", "registration-time-order",
  "registration-before-start", "registration-after-end", "registration-ready-after-exit",
  "registration-final-before-exit", "registration-missing-final", "registration-final-members",
];
function contradictSupervision(entry, fault) {
  const proof = entry.supervisionValue, registrations = entry.registrationValues;
  const ready = registrations.find(value => value.phase === "browser-ready");
  const discovered = registrations.find(value => value.phase === "browser-discovered");
  const last = registrations.find(value => value.phase === "resources-final");
  if (fault.startsWith("inventory-")) {
    proof.node_processes = [{ ...proof.node, state: "Z", final: "zombie", command_sha256: hash("<defunct>") }];
    const row = proof.node_processes[0];
    if (fault === "inventory-live") { row.state = "S"; row.final = "live"; }
    if (fault === "inventory-unknown") row.final = "unknown";
    if (fault === "inventory-missing") delete proof.node_processes;
    if (fault === "inventory-malformed") proof.node_processes = [{}];
    if (fault === "inventory-wrong-node") row.pid++;
    if (fault === "inventory-wrong-group") row.pgid++;
    if (fault === "inventory-wrong-uid") row.uid++;
    if (fault === "inventory-wrong-birth") row.started = birth(proof.started_ms - 60000);
    if (fault === "inventory-wrong-parent") row.ppid++;
    if (fault === "inventory-wrong-state") row.state = "R";
    if (fault === "inventory-wrong-final") row.final = "absent";
    if (fault === "inventory-duplicate") proof.node_processes.push({ ...row });
  }
  if (fault === "phase-only") entry.registrationValues = registrations.map(({ phase, at_ms }) => ({ phase, at_ms }));
  if (fault === "registration-node-pid") ready.node.pid++;
  if (fault === "registration-node-group") ready.node.pgid++;
  if (fault === "registration-node-birth") ready.node.started = birth(proof.started_ms - 60000);
  if (fault === "registration-node-uid") ready.node.uid++;
  if (fault === "registration-node-image") ready.node.command_sha256 = "f".repeat(64);
  if (fault === "registration-profile-inode") ready.browsers[0].profile.ino++;
  if (fault === "registration-profile-path") ready.browsers[0].profile.path += "-changed";
  if (fault === "registration-profile-birth") ready.browsers[0].profile.birthtime_ms++;
  if (fault === "registration-browser-pid") ready.browsers[0].root.pid++;
  if (fault === "registration-browser-image") {
    ready.browsers[0].root_command += " --changed";
    ready.browsers[0].root.command_sha256 = hash(ready.browsers[0].root_command);
  }
  if (fault === "registration-discovered-image") {
    discovered.browsers[0].root_command = "/unqualified/launcher";
    discovered.browsers[0].root.command_sha256 = hash("/unqualified/launcher");
    discovered.browsers[0].members[0].command_sha256 = hash("/unqualified/launcher");
  }
  if (fault === "registration-member-missing") ready.browsers[0].members.shift();
  if (fault === "registration-member-birth") ready.browsers[0].members.at(-1).started = birth(proof.started_ms - 60000);
  if (fault === "registration-member-group") ready.browsers[0].members.at(-1).pgid++;
  if (fault === "registration-member-image") ready.browsers[0].members.at(-1).command_sha256 = "f".repeat(64);
  if (fault === "registration-ports") ready.ports[0]++;
  if (fault === "registration-key-inode") ready.private_keys[0].ino++;
  if (fault === "registration-key-size") ready.private_keys[0].size++;
  if (fault === "registration-key-uid") ready.private_keys[0].uid++;
  if (fault === "registration-key-after-snapshot") ready.private_keys[0].birthtime_ms = ready.at_ms + 1;
  if (fault === "registration-extra") ready.extra = true;
  if (fault === "registration-time-order") ready.at_ms = discovered.at_ms - 1;
  if (fault === "registration-before-start") registrations[0].at_ms = proof.started_ms - 1;
  if (fault === "registration-after-end") ready.at_ms = proof.started_ms + proof.elapsed_ms + 1000;
  const exit = JSON.parse(readFileSync(proof.actual_exit.path));
  if (fault === "registration-ready-after-exit") ready.at_ms = exit.exited_at_ms + 1;
  if (fault === "registration-final-before-exit") last.at_ms = exit.exited_at_ms - 1;
  if (fault === "registration-missing-final") { registrations.pop(); proof.registrations.pop(); }
  if (fault === "registration-final-members") last.browsers[0].members.pop();
}
function contradictReservation(entry, fault) {
  const handle = entry.reportValue.reservation, record = JSON.parse(readFileSync(handle.path));
  const publication = entry.completionValue.publication;
  if (fault === "at-expiry") record.reserved_at_ms = record.window.expires_at_ms;
  if (fault === "beyond-expiry") record.reserved_at_ms = record.window.expires_at_ms + 1;
  if (fault === "before-window") record.reserved_at_ms = record.window.not_before_ms - 1;
  if (fault === "at-cleanup") record.reserved_at_ms = publication.resources_closed_at_ms;
  if (fault === "after-cleanup") record.reserved_at_ms = publication.resources_closed_at_ms + 1;
  if (fault === "after-publication") record.reserved_at_ms = publication.attempted_at_ms + 1;
  if (fault === "noninteger-time") record.reserved_at_ms += 0.5;
  if (fault === "boolean-time") record.reserved_at_ms = false;
  if (fault === "missing-time") delete record.reserved_at_ms;
  if (fault === "wrong-schema") record.schema_version = 2;
  if (fault === "missing-schema") delete record.schema_version;
  if (fault === "true-prerequisite") record.execution_prerequisites_proved_by_reservation = true;
  if (fault === "numeric-prerequisite") record.execution_prerequisites_proved_by_reservation = 0;
  if (fault === "missing-prerequisite") delete record.execution_prerequisites_proved_by_reservation;
  if (fault === "unknown-key") record.extra = false;
  if (fault === "wrong-state") record.state = "unspent";
  if (fault === "wrong-case") record.case_name = "google-stock";
  if (fault === "wrong-authority") record.authority_id = "unrelated";
  if (fault === "wrong-authority-digest") record.authority_sha256 = "f".repeat(64);
  if (fault === "wrong-source") record.source_sha256 = "f".repeat(64);
  if (fault === "wrong-input") record.input_sha256 = "f".repeat(64);
  if (fault === "wrong-window") record.window.expires_at_ms++;
  if (fault === "wrong-variant") record.authority_variant = "unrelated";
  if (fault === "wrong-lineage") record.lineage_baseline_sha256 = "f".repeat(64);
  if (fault === "wrong-binding") record.binding_sha256 = "f".repeat(64);
  writeFileSync(handle.path, JSON.stringify(record), { mode: 0o600 });
  // Refresh the entire reservation -> report/capture -> completion -> index
  // chain, so neither stale hashes nor an unrelated guard can supply rejection.
  handle.sha256 = hash(readFileSync(handle.path));
  entry.captureValue.reservation = { ...handle };
}
function contradictOriginal(entry, fault) {
    const c = entry.captureValue, protocol = entry.row.protocol;
    const request = c.originals.requests[0], response = c.originals.responses[0], logical = c.logical_observations[0];
    const network = c.network_events.at(-1), fetch = c.fetch_events.at(-1);
    if (fault === "missing-url") delete request.url;
    if (fault === "url") request.url += "&extra=one";
    if (fault === "method") request.method = "POST";
    if (fault === "resource") request.resource_type = "Fetch";
    if (fault === "ownership") request.url = request.url.replace("999999999999999", "999999999999998");
    if (fault === "headers") request.headers = [];
    if (fault === "body") request.body_bytes = 1;
    if (fault === "logical-id") request.logical_network_id = "other";
    if (fault === "logical-missing") c.logical_observations = [];
    if (fault === "network-id") network.network_id = "other";
    if (fault === "network-url") network.url += "&other=one";
    if (fault === "fetch-method") fetch.request.method = "POST";
    if (fault === "fetch-id") fetch.fetch_id = "other";
    if (fault === "fetch-type") fetch.resource_type = "Fetch";
    if (fault === "fetch-headers") fetch.request.headers.Referer = "https://unowned.example/";
    if (fault === "fetch-body") fetch.request.hasPostData = true;
    if (fault === "response-status") response.status = 500;
    if (fault === "response-headers") response.headers[0][1] = "contradiction";
    if (fault === "response-header-bytes") response.header_bytes++;
    if (fault === "response-length") response.encoded_body_bytes++;
    if (fault === "response-body") {
      response.body = Buffer.from("changed").toString("base64");
      c.receiver[0].body_sha256 = hash(Buffer.from("changed"));
    }
    if (fault === "empty-body") { response.body = ""; c.receiver[0].body_sha256 = hash(""); }
    if (fault === "noncanonical-body") response.body += "\n";
    if (fault === "receiver-status") c.receiver[0].status = 500;
    if (fault === "receiver-headers") c.receiver[0].headers = [];
    if (fault === "receiver-method") c.receiver[0].method = "POST";
    if (fault === "receiver-url") c.receiver[0].url = "/unrelated";
    if (fault === "wire-missing") c.originals.wire = [];
    if (fault === "wire-request") c.originals.wire[0].request = "";
    if (fault === "wire-response") c.originals.wire[0].response = Buffer.from("not-http").toString("base64");
    if (fault === "wire-noncanonical") c.originals.wire[0].request += "\n";
    if (fault === "wire-protocol") c.originals.wire[0].protocol = protocol === "h1" ? "h2" : "h1";
    if (fault === "broker-protocol") c.local_broker.tunnels[0].protocol = protocol === "h1" ? "h2" : "h1";
    if (fault === "receiver-wire-bytes") c.receiver_wire[0].request_bytes++;
    if (fault === "receiver-wire-hash") c.receiver_wire[0].response_sha256 = "f".repeat(64);
    if (fault === "broker-wire-hash") c.local_broker.tunnels[0].request_sha256 = "f".repeat(64);
    if (fault === "negotiated-protocol") entry.reportValue.negotiated_protocols = [];
    expect(logical.resource_type).toBe("Image");
}
describe("fixed additional-path qualification surface", () => {
  for (const protocol of ["h1", "h2"]) it.each(supervisionFaults)(
    `AC6/7 ${protocol}: rejects refreshed-hash supervision relationship %s`, async fault => {
      const f = await unitProof(), entry = f.cases[protocol === "h1" ? 0 : 1];
      expect(f.api.inspectAdditionalMetaQualification(f.index()).sdk_absent_evidence_verified).toBe(true);
      contradictSupervision(entry, fault); f.rebind(entry);
      expect(() => f.api.inspectAdditionalMetaQualification(f.index())).toThrow();
    });
  it("accepts complete empty or matching zombie Node inventories with a stable browser image", async () => {
    const f = await unitProof();
    expect(f.api.inspectAdditionalMetaQualification(f.index()).sdk_absent_evidence_verified).toBe(true);
    for (const entry of f.cases) {
      entry.supervisionValue.node_processes = [{ ...entry.supervisionValue.node, state: "Z", final: "zombie",
        command_sha256: hash("<defunct>") }];
      f.rebind(entry);
    }
    expect(f.api.inspectAdditionalMetaQualification(f.index()).sdk_absent_evidence_verified).toBe(true);
  });
  it("rejects a launcher-to-browser transition based only on second-resolution identity", async () => {
    const f = await unitProof(), entry = f.cases[0];
    expect(f.api.inspectAdditionalMetaQualification(f.index()).sdk_absent_evidence_verified).toBe(true);
    const discovered = entry.registrationValues.find(value => value.phase === "browser-discovered");
    const browser = discovered.browsers[0];
    browser.root = { ...browser.root };
    browser.members = browser.members.map(member => ({ ...member }));
    browser.root_command = "/bin/sh " + launcher + " --user-data-dir=" + browser.profile.argument_path;
    browser.root.command_sha256 = hash(browser.root_command);
    browser.members[0].command_sha256 = hash(browser.root_command);
    f.rebind(entry);
    expect(() => f.api.inspectAdditionalMetaQualification(f.index())).toThrow("additional_supervision_relationship_invalid");
  });
  it.each(["missing", "timeout", "unknown-disposition", "open-profile", "live-process", "open-port",
    "open-private-key", "stale-source"])(
    "requires mandatory source-bound actual supervision (%s)", async fault => {
      const f = await unitProof(), entry = f.cases[0], proof = entry.supervisionValue;
      expect(f.api.inspectAdditionalMetaQualification(f.index()).sdk_absent_evidence_verified).toBe(true);
      if (fault === "missing") delete entry.childValue.supervision;
      if (fault === "timeout") proof.timed_out = true;
      if (fault === "unknown-disposition") proof.resource_disposition = "unknown";
      if (fault === "open-profile") proof.browsers[0].profile_removed = false;
      if (fault === "live-process") proof.browsers[0].processes[0].final = "live";
      if (fault === "open-port") proof.ports[0].closed = false;
      if (fault === "open-private-key") proof.private_keys[0].removed = false;
      if (fault === "stale-source") proof.source_after = {};
      f.rebind(entry);
      expect(() => f.api.inspectAdditionalMetaQualification(f.index())).toThrow();
    });
  for (const protocol of ["h1", "h2"]) it.each(reservationFaults)(
    `AC6/7 ${protocol}: rejects refreshed-hash reservation %s`, async fault => {
      const f = await unitProof(), entry = f.cases[protocol === "h1" ? 0 : 1];
      expect(f.api.inspectAdditionalMetaQualification(f.index()).sdk_absent_evidence_verified).toBe(true);
      contradictReservation(entry, fault); f.rebind(entry);
      expect(() => f.api.inspectAdditionalMetaQualification(f.index())).toThrow();
    });
  it("persists a failed startup child before classifying it, without reading absent originals", async () => {
    const { createAdditionalMetaFixture, runAdditionalMetaQualification } = await import("./meta-additional-qualification.mjs");
    const f = createAdditionalMetaFixture(), outputDir = join(f.root, "startup-failure");
    unitRoots.push(f.root);
    const previous = process.env.NODE_OPTIONS;
    // Real finite Node startup failure, BEFORE the unchanged fixed child
    // program can load. No new URL, driver, program mode or injection seam.
    process.env.NODE_OPTIONS = "--require=" + join(f.root, "deliberately-absent.cjs");
    try {
      await expect(runAdditionalMetaQualification({ outputDir })).rejects.toThrow("additional_qualification_child_failed");
    } finally {
      if (previous === undefined) delete process.env.NODE_OPTIONS;
      else process.env.NODE_OPTIONS = previous;
    }
    const actualPath = join(outputDir, "h1-actual-child.json");
    const actual = JSON.parse(readFileSync(actualPath)), childRoot = dirname(actual.command[5]);
    unitRoots.push(childRoot);
    expect(actual).toMatchObject({ actual_exit_code: 1, signal: null, command_exit_observed: true });
    expect(actual.stderr).toContain("MODULE_NOT_FOUND");
    expect(existsSync(join(childRoot, "run/report.json"))).toBe(false);
    expect(existsSync(join(childRoot, "run/capture.json"))).toBe(false);
    expect(existsSync(join(outputDir, "additional-index.json"))).toBe(false);
    if (process.env.AIRLOCK_ADDITIONAL_META_QUALIFICATION === "1") {
      const { writeMetaPrivate } = await import("./native-stock-meta.mjs");
      writeMetaPrivate(process.env.AIRLOCK_ADDITIONAL_META_OUTPUT + "-startup-failure.json", {
        schema: "airlock.additional-meta-startup-failure-control.v1",
        actual_child: { path: actualPath, sha256: hash(readFileSync(actualPath)) },
        originals_absent: true, category: "additional_qualification_child_failed",
        native_sdk_executed: false, public_upstream_requests: 0, actual_owner_slots_reserved: 0 });
      for (const root of [f.root, childRoot]) unitRoots.splice(unitRoots.indexOf(root), 1);
    }
  });
  it("AC6/7: rejects the former empty placeholder-original proof even with all hashes refreshed", async () => {
    const f = await unitProof(), entry = f.cases[0];
    entry.captureValue.originals = { requests: [{}], responses: [{ state: "complete", body: "" }] };
    entry.captureValue.receiver = [{ body_sha256: hash("") }];
    f.rebind(entry);
    expect(() => f.api.inspectAdditionalMetaQualification(f.index())).toThrow();
  });
  for (const protocol of ["h1", "h2"]) it.each(originalFaults)(
    `AC6/7 ${protocol}: rejects refreshed-hash %s original contradiction`, async fault => {
    const f = await unitProof(), entry = f.cases[protocol === "h1" ? 0 : 1];
    expect(f.api.inspectAdditionalMetaQualification(f.index()).sdk_absent_evidence_verified).toBe(true);
    contradictOriginal(entry, fault);
    f.rebind(entry);
    expect(() => f.api.inspectAdditionalMetaQualification(f.index())).toThrow();
  });
  it("checks unit-shaped complete proof without returning a native plan or lease", async () => {
    const f = await unitProof();
    expect(f.api.inspectAdditionalMetaQualification(f.index())).toMatchObject({
      sdk_absent_evidence_verified: true, execution_authority: false, native_sdk_executed: false });
  });
  it.each(["counter", "boolean", "extra-evidence", "stale-source", "false-exit", "signal", "empty-cleanup",
    "open-resource", "wrong-lineage", "wrong-reservation", "wrong-command", "wrong-protocol", "late-publication",
    "source-original", "script-sha", "unresumed-source", "missing-publication-time", "missing-dispatch"])(
    "refuses refreshed-hash %s in additional proof", async fault => {
      const f = await unitProof(), entry = f.cases[0];
      if (fault === "counter") f.indexValue.public_upstream_requests = false;
      if (fault === "boolean") f.indexValue.official_sdk_executed = 0;
      if (fault === "extra-evidence") f.indexValue.force = true;
      if (fault === "stale-source") entry.reportValue.source_after = {};
      if (fault === "false-exit") entry.childValue.command_exit_observed = false;
      if (fault === "signal") entry.childValue.signal = "SIGKILL";
      if (fault === "empty-cleanup") entry.reportValue.cleanup = {};
      if (fault === "open-resource") entry.reportValue.cleanup.sockets_closed = false;
      if (fault === "wrong-lineage") entry.reportValue.lineage_baseline = {};
      if (fault === "wrong-reservation") entry.reportValue.reservation = entry.captureValue.reservation = entry.row.capture;
      if (fault === "wrong-command") entry.childValue.command[2] = "--execute";
      if (fault === "wrong-protocol") entry.row.protocol = "h2";
      if (fault === "late-publication") entry.completionValue.publication.attempted_at_ms = entry.reportValue.window.expires_at_ms;
      if (fault === "source-original") entry.captureValue.verified_source_originals.runtime.bytes_base64 = "";
      if (fault === "script-sha") entry.captureValue.script_evidence[0].sha256 = "f".repeat(64);
      if (fault === "unresumed-source") entry.captureValue.source_execution[0].evidence = "not-resumed";
      if (fault === "missing-publication-time") delete entry.completionValue.publication.resources_closed_at_ms;
      if (fault === "missing-dispatch") entry.captureValue.order = ["durable_reservation", "context_closed"];
      f.rebind(entry);
      expect(() => f.api.inspectAdditionalMetaQualification(f.index())).toThrow();
    });
  it("refuses arbitrary programs, URLs, native modes, proxies and accessor options", async () => {
    const { runAdditionalMetaQualification } = await import("./meta-additional-qualification.mjs");
    let invoked = 0;
    for (const input of [{}, { outputDir: "/unused", url: "https://example.invalid" },
      { outputDir: "/unused", program: "native" }, { get outputDir() { invoked++; return "/unused"; } },
      new Proxy({}, { ownKeys() { invoked++; return []; } })])
      await expect(runAdditionalMetaQualification(input)).rejects.toThrow();
    expect(invoked).toBe(0);
  });
  it("does not accept old normal cohorts or a declaration as additional proof", async () => {
    const { inspectAdditionalMetaQualification } = await import("./inspected-meta-stock.mjs");
    expect(() => inspectAdditionalMetaQualification({ path: "/unused", sha256: "a".repeat(64), force: true })).toThrow();
  });
  it.runIf(process.env.AIRLOCK_ADDITIONAL_META_QUALIFICATION === "1")(
    "AC6: actually traverses additional lineage, one-shot reservation, H1/H2 and post-exit closure", async () => {
      const { runAdditionalMetaQualification } = await import("./meta-additional-qualification.mjs");
      const outputDir = process.env.AIRLOCK_ADDITIONAL_META_OUTPUT;
      const result = await runAdditionalMetaQualification({ outputDir });
      expect(result.sdk_absent_evidence_verified).toBe(true);
      expect(result.execution_authority).toBe(false);
      const index = JSON.parse(readFileSync(join(outputDir, "additional-index.json")));
      expect(index.cases.map(row => row.protocol)).toEqual(["h1", "h2"]);
      for (const row of index.cases) {
        const report = JSON.parse(readFileSync(row.report.path));
        const child = JSON.parse(readFileSync(row.actual_child.path));
        expect(child).toMatchObject({ actual_exit_code: 0, signal: null, command_exit_observed: true });
        expect(report).toMatchObject({ authority_variant: "additional-meta-2026-10-21",
          local_controller_qualified: true, local_slot_reserved: true, public_upstream_requests: 0,
          actual_owner_slots_reserved: 0, original_wire_bytes_equal: true, responses_complete: 1 });
        expect(Object.values(report.cleanup).every(x => x === true)).toBe(true);
        expect(existsSync(report.reservation.path)).toBe(true);
        expect(JSON.parse(readFileSync(report.reservation.path)).state).toBe("spent");
      }
      // Copy ONLY first-party packet/causal evidence into independent synthetic
      // control archives. Never rewrite a genuine capture, its lineage or its
      // failed-proof history. Every negative begins by verifying the full
      // genuine H1/H2 packet evidence, then refreshes all outer hashes.
      const { writeMetaPrivate } = await import("./native-stock-meta.mjs");
      const genuine = index.cases.map(row => JSON.parse(readFileSync(row.capture.path)));
      const negatives = { original: [], reservation: [] };
      for (const [family, faults, contradict] of [["original", originalFaults, contradictOriginal],
        ["reservation", reservationFaults, contradictReservation]])
      for (const protocol of ["h1", "h2"]) for (const fault of faults) {
        const f = await unitProof();
        for (const [n, entry] of f.cases.entries()) {
          for (const key of ["originals", "logical_observations", "network_events", "fetch_events",
            "receiver", "receiver_wire", "local_broker"]) entry.captureValue[key] = structuredClone(genuine[n][key]);
          f.rebind(entry);
        }
        expect(f.api.inspectAdditionalMetaQualification(f.index()).sdk_absent_evidence_verified).toBe(true);
        const entry = f.cases[protocol === "h1" ? 0 : 1];
        contradict(entry, fault); f.rebind(entry);
        const handle = f.index();
        expect(() => f.api.inspectAdditionalMetaQualification(handle)).toThrow();
        const roots = new Set(f.cases.map(entry => dirname(entry.row.manifest.path)));
        // Preserve these new failed-proof archives, unlike disposable units.
        for (let n = unitRoots.length - 1; n >= 0; n--)
          if (roots.has(unitRoots[n])) unitRoots.splice(n, 1);
        negatives[family].push({ protocol, fault, index: handle, rows: f.cases.map(entry => entry.row),
          source: index.cases.map(row => ({ capture: row.capture, actual_child: row.actual_child })),
          refreshed_hash_contradiction_rejected: true, native_authority: false });
      }
      writeMetaPrivate(join(outputDir, "genuine-original-negative-controls.json"), {
        schema: "airlock.additional-meta-original-controls.v1", controls: negatives.original,
        original_captures_unchanged: index.cases.every(row => hash(readFileSync(row.capture.path)) === row.capture.sha256),
        public_upstream_requests: 0, actual_owner_slots_reserved: 0 });
      writeMetaPrivate(join(outputDir, "genuine-reservation-negative-controls.json"), {
        schema: "airlock.additional-meta-reservation-controls.v1", controls: negatives.reservation,
        original_captures_unchanged: index.cases.every(row => hash(readFileSync(row.capture.path)) === row.capture.sha256),
        public_upstream_requests: 0, actual_owner_slots_reserved: 0 });
      // These controls keep the actual completed manifest/journal/HTTP proof
      // and actual lifetimes/times unchanged. Only copied supervision/child/
      // index receipts are edited; neither real source proof nor failed
      // archives are ever overwritten, and no grant or slot is copied/reset.
      const { inspectAdditionalMetaQualification } = await import("./inspected-meta-stock.mjs");
      const supervisionControls = [];
      const controlRoot = join(outputDir, "supervision-reader-controls");
      mkdirSync(controlRoot, { mode: 0o700 });
      for (const [n, protocol] of ["h1", "h2"].entries()) for (const fault of supervisionFaults) {
        const directory = join(controlRoot, protocol + "-" + fault);
        mkdirSync(directory, { mode: 0o700 });
        const save = (name, value) => {
          const path = join(directory, name);
          writeMetaPrivate(path, value); return { path, sha256: hash(readFileSync(path)) };
        };
        const sourceChild = JSON.parse(readFileSync(index.cases[n].actual_child.path));
        const sourceProof = JSON.parse(readFileSync(sourceChild.supervision.path));
        const entry = { supervisionValue: structuredClone(sourceProof),
          registrationValues: sourceProof.registrations.map(h => JSON.parse(readFileSync(h.path))) };
        entry.supervisionValue.registrations = entry.registrationValues.map((value, at) => save("baseline-reg-" + at + ".json", value));
        const baselineProof = save("baseline-supervision.json", entry.supervisionValue);
        const baselineChild = save("baseline-child.json", { ...sourceChild, supervision: baselineProof });
        const baselineValue = structuredClone(index);
        baselineValue.cases[n].actual_child = baselineChild;
        const baselineIndex = save("baseline-index.json", baselineValue);
        expect(inspectAdditionalMetaQualification(baselineIndex).sdk_absent_evidence_verified).toBe(true);
        contradictSupervision(entry, fault);
        entry.supervisionValue.registrations = entry.registrationValues.map((value, at) => save("bad-reg-" + at + ".json", value));
        const badProof = save("bad-supervision.json", entry.supervisionValue);
        const badChild = save("bad-child.json", { ...sourceChild, supervision: badProof });
        const badValue = structuredClone(index);
        badValue.cases[n].actual_child = badChild;
        const badIndex = save("bad-index.json", badValue);
        expect(() => inspectAdditionalMetaQualification(badIndex)).toThrow();
        supervisionControls.push({ protocol, fault, source: index.cases[n], baseline_index: baselineIndex,
          bad_index: badIndex, bad_supervision: badProof, bad_child: badChild,
          baseline_verified: true, refreshed_hash_contradiction_rejected: true, native_authority: false });
      }
      writeMetaPrivate(join(outputDir, "genuine-supervision-reader-controls.json"), {
        schema: "airlock.additional-meta-supervision-reader-controls.v1", controls: supervisionControls,
        source_index_sha256: hash(readFileSync(join(outputDir, "additional-index.json"))),
        original_proofs_unchanged: index.cases.every(row => hash(readFileSync(row.actual_child.path)) === row.actual_child.sha256),
        public_upstream_requests: 0, actual_owner_slots_reserved: 0 });
    }, 125000);

  for (const target of ["original", "authority", "reservation"])
    it.runIf(process.env.AIRLOCK_ADDITIONAL_META_QUALIFICATION === "1")(
      `AC2/3/6: real additional child stops on ${target} replacement after durable reservation`, async () => {
        const { createAdditionalMetaFixture } = await import("./meta-additional-qualification.mjs");
        const { writeMetaPrivate } = await import("./native-stock-meta.mjs");
        const f = createAdditionalMetaFixture(), options = f.options();
        const { superviseAdditionalMetaChild } = await import("./meta-additional-supervision.mjs");
        let modified = false;
        const mutator = setInterval(() => {
          if (modified || !existsSync(f.slot) || !existsSync(join(f.root, "run"))) return;
          modified = true;
          const path = target === "reservation" ? f.slot : f[target].path;
          const bytes = readFileSync(path);
          // Identical bytes on a DIFFERENT inode are still a changed original.
          rmSync(path); writeFileSync(path, bytes, { mode: 0o600 });
        }, 1);
        let child;
        try {
          child = await superviseAdditionalMetaChild({ ...options, protocol: "h2",
            output_dir: process.env.AIRLOCK_ADDITIONAL_META_OUTPUT + "-" + target + "-race-supervision" });
        } finally { clearInterval(mutator); }
        const path = join(process.env.AIRLOCK_ADDITIONAL_META_OUTPUT, target + "-race-postexit.json");
        // Observe exit BEFORE opening any possibly absent originals.
        writeMetaPrivate(path, { ...child,
          modified, root: f.root });
        const report = JSON.parse(readFileSync(join(f.root, "run/report.json")));
        writeMetaPrivate(path.replace(".json", "-originals.json"), {
          report_sha256: hash(readFileSync(join(f.root, "run/report.json"))),
          capture_sha256: hash(readFileSync(join(f.root, "run/capture.json"))), cleanup: report.cleanup });
        expect(modified).toBe(true);
        expect(child.actual_exit_code).toBe(2);
        expect(report.local_controller_qualified).toBe(false);
        expect(Object.values(report.cleanup).every(value => value === true)).toBe(true);
        expect(existsSync(f.slot)).toBe(true);
        if (target !== "reservation") expect(report.errors).toContain("case_source_changed");
        else {
          const failure = JSON.parse(readFileSync(join(f.root, "run/failure-finalization.json")));
          expect(failure.failure_category).toBe("canonical_reservation_changed");
        }
      }, 65000);
});
