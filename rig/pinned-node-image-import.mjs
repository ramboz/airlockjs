import process from "node:process";
import { request } from "node:http";
import { readdirSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { data, equal, json, record } from "./inspected-meta-record.mjs";
import { encodeImageTar, imageConfig, imageEntryNames, imageHash, verifyImageEntries, verifyImageTar } from "./pinned-node-image-archive.mjs";
import {
  imageCanonical, imageDirectory, imageHostSpace, imageOriginal, imageSocket, publishImageArchive, publishImageRecord, reserveImageImport,
} from "./pinned-node-image-io.mjs";
import { P } from "./pinned-node-image-pins.mjs";

export const IMAGE_WORKSPACE = fileURLToPath(new URL("../", import.meta.url)).replace(/\/$/, "");
export const IMAGE_SOURCES = Object.freeze([
  "rig/pinned-node-image-pins.mjs", "rig/pinned-node-image-archive.mjs", "rig/pinned-node-image-io.mjs",
  "rig/pinned-node-image-import.mjs", "rig/pinned-node-image-cli.mjs",
  "rig/pinned-node-image-source.mjs", "rig/pinned-node-image-source.config.mjs",
  "rig/private-original-file.mjs", "rig/inspected-meta-record.mjs",
]);
const plans = new WeakMap();
const fail = reason => { throw Error(reason); };
const digest = value => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const now = () => process.hrtime.bigint();
const bindingKeys = ["schema", "binding_path", "decision_id", "decision_path", "decision_sha256", "decision_device", "decision_inode",
  "uid", "case_root", "canonical_reservation_path", "oci_root", "oci_index_sha256", "capacity_receipt_path", "capacity_receipt_sha256",
  "capacity_projection_path", "capacity_projection_sha256", "endpoint", "engine_version", "engine_api", "manifest_digest", "config_digest",
  "maximum_archive_bytes", "minimum_host_free_bytes", "maximum_capacity_age_ms", "minimum_reported_guest_available_g",
  "maximum_expanded_layer_stream_bytes", "maximum_response_bytes", "maximum_load_response_bytes", "whole_controller_acceptance_ns",
  "single_importer_coordination", "effect_scope", "runtime_qualified"];
const proofKeys = ["schema", "case_root", "directory", "nonce", "binding", "decision", "node", "caller", "caller_test", "sources"];
const jobKeys = ["schema", "case_root", "directory", "nonce", "binding", "decision", "proof", "caller", "caller_test", "node", "sources", "coordination"];

export function imageEnvironment(root) {
  return { PATH: dirname(P.node) + ":/usr/bin:/bin", HOME: root + "/empty-home", TMPDIR: root + "/tmp",
    LANG: "C", LC_ALL: "C", CI: "1", NO_COLOR: "1" };
}
function runtime(s) {
  if (process.getuid() !== P.uid || process.getuid() !== s.b.uid || process.execPath !== P.node
    || process.version !== "v24.10.0" || process.cwd() !== s.b.case_root
    || !equal(process.env, imageEnvironment(s.b.case_root))) fail("image_fixed_runtime_or_environment");
}
function time(s) {
  const n = now();
  if (n < s.started || n >= s.deadline) fail("image_original_budget");
}
function bindingGrammar(b, path) {
  record(b, bindingKeys);
  const fixed = {
    schema: "airlock.pinned-image-import-operator-binding.v1", binding_path: path,
    decision_id: "pinned-node-image-preparation-20261023", uid: P.uid,
    decision_sha256: P.decisionSha, decision_device: P.decisionDev, decision_inode: P.decisionIno,
    oci_index_sha256: P.indexSha, engine_version: "28.5.1", engine_api: "1.51",
    manifest_digest: P.manifest, config_digest: P.config, maximum_archive_bytes: P.archiveMax,
    minimum_host_free_bytes: P.hostReserve, maximum_capacity_age_ms: P.capacityAge,
    minimum_reported_guest_available_g: P.guestG, maximum_expanded_layer_stream_bytes: P.expandedMax,
    maximum_response_bytes: P.responseMax, maximum_load_response_bytes: P.loadMax,
    whole_controller_acceptance_ns: String(P.budgetNs), runtime_qualified: false,
  };
  for (const key of Object.keys(fixed)) if (!equal(b[key], fixed[key])) fail("image_immutable_binding");
  for (const key of ["binding_path", "decision_path", "case_root", "oci_root", "capacity_receipt_path", "capacity_projection_path"])
    imageCanonical(b[key]);
  if (b.canonical_reservation_path !== dirname(b.case_root) + "/image-load.reserved"
    || !b.endpoint.startsWith("unix:///") || b.endpoint.slice(7).includes("\0")
    || !digest(b.capacity_receipt_sha256) || !digest(b.capacity_projection_sha256)) fail("image_binding_locator");
}
export function validateImageCapacity(b, receiptBytes, projectionBytes, wall = Date.now()) {
  if (imageHash(receiptBytes) !== b.capacity_receipt_sha256 || imageHash(projectionBytes) !== b.capacity_projection_sha256)
    fail("image_capacity_original_hash");
  const r = record(json(receiptBytes), ["kind", "schema_version", "assessed_at", "collection_interval_utc", "source_method",
    "archive_sha256", "storage_projection", "storage_root", "image_store", "backing_device", "backing_filesystem", "guest_backing_mount",
    "docker_root_same_device_mount_confirmed", "containerd_snapshot_paths_observed_under_same_var_lib", "reported_capacity",
    "reported_used", "reported_available", "reporting_command", "exact_free_bytes_claimed", "capacity_snapshot_established",
    "capacity_reserved", "future_import_or_allocation_admission", "host_available_bytes_at_assessment", "host_reserve_bytes_required",
    "actual_collection_exit_code", "actual_collection_elapsed_seconds", "archive_bytes", "diagnostics_uploaded",
    "unrelated_log_contents_inspected", "image_imports_or_containers_started", "limits", "runtime_qualified", "clock_qualified",
    "containment_qualified", "live_authority"]);
  const p = record(json(projectionBytes), ["kind", "schema_version", "collection_started_utc", "collection_finished_utc",
    "archive_sha256", "selected_storage_entries", "only_storage_fields_or_capacity_lines_retained", "unrelated_log_members_opened",
    "guest_capacity_snapshot_not_reservation", "image_import_or_container_start", "runtime_qualified"]);
  if (r.kind !== "airlock.private.supported-docker-guest-capacity-observation" || r.schema_version !== 1
    || p.kind !== "airlock.private.docker-guest-capacity-mount-projection" || p.schema_version !== 1
    || !digest(r.archive_sha256) || r.archive_sha256 !== p.archive_sha256
    || !equal(r.collection_interval_utc, [p.collection_started_utc, p.collection_finished_utc])
    || !equal(r.storage_projection, { path: b.capacity_projection_path, sha256: b.capacity_projection_sha256 })
    || r.storage_root !== "/var/lib/docker" || r.image_store !== "io.containerd.snapshotter.v1"
    || r.backing_device !== "/dev/vda1" || r.backing_filesystem !== "ext4" || r.guest_backing_mount !== "/var/lib"
    || r.reporting_command !== "df -h" || !/^[1-9][0-9]*G$/.test(r.reported_available)
    || Number(r.reported_available.slice(0, -1)) < P.guestG || r.host_reserve_bytes_required !== P.hostReserve
    || r.actual_collection_exit_code !== 0 || r.image_imports_or_containers_started !== 0) fail("image_capacity_projection");
  for (const key of ["docker_root_same_device_mount_confirmed", "containerd_snapshot_paths_observed_under_same_var_lib",
    "capacity_snapshot_established"]) if (r[key] !== true) fail("image_capacity_projection");
  for (const key of ["exact_free_bytes_claimed", "capacity_reserved", "future_import_or_allocation_admission", "diagnostics_uploaded",
    "unrelated_log_contents_inspected", "runtime_qualified", "clock_qualified", "containment_qualified", "live_authority"])
    if (r[key] !== false) fail("image_capacity_projection");
  if (p.only_storage_fields_or_capacity_lines_retained !== true || p.unrelated_log_members_opened !== false
    || p.guest_capacity_snapshot_not_reservation !== true || p.image_import_or_container_start !== false
    || p.runtime_qualified !== false) fail("image_capacity_projection");
  const times = [p.collection_started_utc, p.collection_finished_utc, r.assessed_at].map(t => Date.parse(t));
  if (!Number.isFinite(wall) || times.some(t => !Number.isFinite(t) || t > wall)
    || times[0] > times[1] || times[1] > times[2] || wall - times[0] > P.capacityAge) fail("image_capacity_age");
  const e = record(p.selected_storage_entries, ["vm/docker/info.json", "vm/system/mount.txt", "vm/system/df.cmd.txt", "vm/system/df.txt"]);
  for (const [name, entry] of Object.entries(e)) {
    record(entry, ["member", "sha256", "bytes", name.endsWith("info.json") ? "storage_fields"
      : name.endsWith("mount.txt") ? "capacity_mount_lines" : "capacity_text"]);
    if (entry.member !== name || !digest(entry.sha256) || !Number.isSafeInteger(entry.bytes) || entry.bytes < 1)
      fail("image_capacity_entry");
  }
  if (!equal(e["vm/docker/info.json"].storage_fields, { DockerRootDir: "/var/lib/docker", Driver: "overlayfs",
    DriverStatus: [["driver-type", "io.containerd.snapshotter.v1"]] })
    || e["vm/system/df.cmd.txt"].capacity_text !== "df -h") fail("image_capacity_mount");
  const lines = e["vm/system/mount.txt"].capacity_mount_lines;
  if (!Array.isArray(lines) || lines.length !== 3
    || lines[0] !== "/dev/vda1 on /var/lib type ext4 (rw,relatime,discard)"
    || lines[1] !== "/dev/vda1 on /var/lib/docker type ext4 (rw,relatime,discard)"
    || !lines[2].startsWith("overlay on /var/lib/docker/rootfs/overlayfs/")
    || !lines[2].includes("/var/lib/desktop-containerd/daemon/io.containerd.snapshotter.v1.overlayfs/snapshots/"))
    fail("image_capacity_mount");
  const row = e["vm/system/df.txt"].capacity_text.split("\n").map(l => l.trim().split(/\s+/)).filter(v => v[0] === "/dev/vda1");
  if (row.length !== 1 || !equal(row[0], ["/dev/vda1", r.reported_capacity, r.reported_used, r.reported_available, "11%", "/var/lib"]))
    fail("image_capacity_mount");
  return { age_ms: wall - times[0], reported_available: r.reported_available, snapshot_not_reservation: true,
    exact_free_bytes_claimed: false, storage_root: r.storage_root, backing_device: r.backing_device };
}
function frontier(s) {
  time(s); runtime(s);
  for (const h of s.directories) h.check();
  for (const h of s.originals) h.check();
  s.socket.check();
  s.capacity = validateImageCapacity(s.b, s.receipt.bytes, s.projection.bytes);
  const checked = Date.parse(s.job.coordination.checked_at), wall = Date.now();
  if (!Number.isFinite(checked) || checked > wall || wall - checked > 60000) fail("image_coordination_age");
  imageHostSpace(s.b.case_root); time(s);
}
export function preparePinnedImage(value) {
  const started = now();
  const input = record(data(value), ["binding_path", "job_path"]);
  const s = { started, deadline: started + P.budgetNs, originals: [], directories: [], active: [], used: false,
    dispatched: false, postComplete: false, b: null };
  const read = (path, options = {}) => {
    const held = imageOriginal(path, { uid: P.uid, ...options }); s.originals.push(held); return held;
  };
  try {
    s.binding = read(input.binding_path, { privateFile: true, maximum: 65536 });
    if (s.binding.handle.sha256 !== P.bindingSha) fail("image_binding_hash");
    s.b = json(s.binding.bytes); bindingGrammar(s.b, input.binding_path); runtime(s);
    if (input.job_path !== s.b.case_root + "/job.json") fail("image_exact_job_path");
    for (const path of [s.b.case_root, dirname(s.b.case_root), s.b.case_root + "/empty-home", s.b.case_root + "/tmp"])
      s.directories.push(imageDirectory(path, P.uid));
    if (!equal(readdirSync(s.b.case_root).sort(), ["empty-home", "job.json", "outer-intent.json", "source-reviewed.json", "tmp"])
      || readdirSync(s.b.case_root + "/empty-home").length || readdirSync(s.b.case_root + "/tmp").length)
      fail("image_fresh_job_root");
    s.decision = read(s.b.decision_path, { privateFile: true, maximum: 65536 });
    if (s.decision.handle.sha256 !== P.decisionSha || s.decision.handle.dev !== String(P.decisionDev)
      || s.decision.handle.ino !== String(P.decisionIno)) fail("image_genuine_decision_original");
    const decision = json(s.decision.bytes);
    if (decision.schema !== "airlock.pinned-image-preparation-owner-decision.v1"
      || decision.owner_response !== "you got my approval" || decision.decision_id !== s.b.decision_id
      || decision.pinned_manifest !== P.manifest || decision.pinned_config !== P.config || decision.operation_issued !== false)
      fail("image_decision_scope");
    s.jobFile = read(input.job_path, { privateFile: true, maximum: 65536 });
    s.job = record(json(s.jobFile.bytes), jobKeys);
    s.proofFile = read(s.b.case_root + "/source-reviewed.json", { privateFile: true, maximum: 65536 });
    const proof = record(json(s.proofFile.bytes), proofKeys);
    if (s.job.schema !== "airlock.pinned-image-job.v1" || proof.schema !== "airlock.pinned-image-reviewed-source.v1"
      || s.job.case_root !== s.b.case_root || proof.case_root !== s.b.case_root || !digest(s.job.nonce)
      || s.job.nonce !== proof.nonce || !equal(s.job.proof, s.proofFile.handle)) fail("image_original_job_proof");
    if (!equal(s.job.directory, s.directories[0].handle) || !equal(proof.directory, s.directories[0].handle))
      fail("image_original_case_directory");
    for (const [key, held] of [["binding", s.binding], ["decision", s.decision]])
      if (!equal(s.job[key], held.handle) || !equal(proof[key], held.handle)) fail("image_original_job_proof");
    record(s.job.coordination, ["checked_at", "peer", "scope"]);
    if (typeof s.job.coordination.peer !== "string" || !s.job.coordination.peer.length
      || s.job.coordination.scope !== "exact image store operation only") fail("image_coordination_record");
    s.node = read(P.node, { executable: true, maximum: 134217728 });
    s.caller = read(dirname(s.b.case_root) + "/source/image_outer.py", { privateFile: true });
    s.callerTest = read(dirname(s.b.case_root) + "/source/test_image_outer.py", { privateFile: true });
    for (const [key, held] of [["node", s.node], ["caller", s.caller], ["caller_test", s.callerTest]])
      if (!equal(s.job[key], held.handle) || !equal(proof[key], held.handle)) fail("image_reviewed_executable_or_caller");
    s.sources = IMAGE_SOURCES.map(name => ({ name, original: read(IMAGE_WORKSPACE + "/" + name).handle }));
    if (!equal(s.sources, s.job.sources) || !equal(s.sources, proof.sources)) fail("image_complete_reviewed_source_closure");
    s.outerIntent = read(s.b.case_root + "/outer-intent.json", { privateFile: true, maximum: 65536 });
    const outer = record(json(s.outerIntent.bytes), ["schema", "nonce", "job_sha256", "proof_sha256", "command", "environment",
      "sources", "node", "caller", "caller_test", "binding", "decision", "original_started_ns", "budget_ns"]);
    const expected = { schema: "airlock.pinned-image-outer-intent.v1", nonce: s.job.nonce,
      job_sha256: s.jobFile.handle.sha256, proof_sha256: s.proofFile.handle.sha256,
      command: [P.node, IMAGE_WORKSPACE + "/rig/pinned-node-image-cli.mjs", "--binding", input.binding_path, "--job", input.job_path],
      environment: imageEnvironment(s.b.case_root), sources: s.sources, node: s.node.handle, caller: s.caller.handle,
      caller_test: s.callerTest.handle, binding: s.binding.handle, decision: s.decision.handle, budget_ns: String(P.budgetNs) };
    if (typeof outer.original_started_ns !== "string" || !/^[0-9]{1,30}$/.test(outer.original_started_ns)
      || Object.keys(expected).some(k => !equal(expected[k], outer[k]))) fail("image_outer_intent_binding");
    s.receipt = read(s.b.capacity_receipt_path, { privateFile: true });
    s.projection = read(s.b.capacity_projection_path, { privateFile: true });
    s.socket = imageSocket(s.b.endpoint.slice(7), P.uid);
    s.oci = imageEntryNames().map((name, i) => read(s.b.oci_root + "/" + name, { maximum: i < 4 ? 65536 : P.archiveMax }));
    s.entries = s.oci.map((h, i) => [imageEntryNames()[i], h.bytes]);
    // Config, compressed hashes, streamed diff IDs and the independent tar oracle
    // are checked again in run, before any mutating route can be constructed.
    imageConfig(s.oci[3].bytes);
    frontier(s);
    const plan = Object.freeze(Object.create(null)); plans.set(plan, s); return plan;
  } catch (error) {
    for (const h of [...s.originals, ...s.directories].reverse()) h.close();
    throw error;
  }
}
async function hello(s) {
  const sent = now(), message = { schema: "airlock.pinned-image-hello.v1", pid: process.pid, nonce: s.job.nonce,
    job_sha256: s.jobFile.handle.sha256, proof_sha256: s.proofFile.handle.sha256,
    source_sha256: imageHash(Buffer.from(JSON.stringify(data(s.sources)))) };
  const line = await new Promise((resolve, reject) => {
    let bytes = Buffer.alloc(0), ended = false;
    const timer = setTimeout(() => finish(Error("image_hello_deadline")), Number((s.deadline - now()) / 1000000n));
    const finish = (error, value) => {
      if (ended) return; ended = true; clearTimeout(timer);
      process.stdin.off("data", onData); process.stdin.off("end", onEnd); process.stdin.off("error", onError);
      if (error) reject(error); else resolve(value);
    };
    const onData = chunk => {
      bytes = Buffer.concat([bytes, Buffer.from(chunk)]);
      if (bytes.length > 4096) return finish(Error("image_ack_bound"));
      const end = bytes.indexOf(10);
      if (end !== -1 && end !== bytes.length - 1) finish(Error("image_ack_frame"));
    };
    const onEnd = () => {
      if (bytes.length < 2 || bytes.indexOf(10) !== bytes.length - 1) finish(Error("image_ack_frame"));
      else finish(null, bytes.subarray(0, -1));
    };
    const onError = () => finish(Error("image_ack_stream"));
    process.stdin.on("data", onData); process.stdin.once("end", onEnd); process.stdin.once("error", onError);
    try { process.stdout.write(JSON.stringify(message) + "\n", error => { if (error) finish(Error("image_hello_output")); }); }
    catch (error) { finish(Error("image_hello_output", { cause: error })); }
  });
  const a = record(json(line), ["schema", "pid", "nonce", "job_sha256", "proof_sha256", "issued_sha256", "remaining_ns"]);
  if (a.schema !== "airlock.pinned-image-ack.v1" || a.pid !== process.pid || a.nonce !== s.job.nonce
    || a.job_sha256 !== s.jobFile.handle.sha256 || a.proof_sha256 !== s.proofFile.handle.sha256
    || !digest(a.issued_sha256) || typeof a.remaining_ns !== "string" || !/^[1-9][0-9]{0,10}$/.test(a.remaining_ns))
    fail("image_ack_binding");
  const offered = BigInt(a.remaining_ns), accepted = offered - (now() - sent);
  if (offered > P.budgetNs || accepted <= 0n) fail("image_ack_original_budget");
  s.deadline = s.deadline < now() + accepted ? s.deadline : now() + accepted;
  const issued = imageOriginal(s.b.case_root + "/outer-issued.json", { uid: P.uid, privateFile: true, maximum: 65536 });
  s.originals.push(issued);
  if (issued.handle.sha256 !== a.issued_sha256) fail("image_outer_issued_original");
  const issuedValue = json(issued.bytes);
  if (issuedValue.schema !== "airlock.pinned-image-outer-issued.v1" || issuedValue.pid !== process.pid
    || issuedValue.nonce !== s.job.nonce || issuedValue.job_sha256 !== s.jobFile.handle.sha256
    || !equal(issuedValue.outer_intent, s.outerIntent.handle)) fail("image_outer_issued_binding");
  frontier(s);
}
const imagePath = "/v1.51/images/" + P.manifest + "/json";
const routes = Object.freeze({
  version: ["GET", "/v1.51/version"], info: ["GET", "/v1.51/info"], inspect: ["GET", imagePath],
  load: ["POST", "/v1.51/images/load?quiet=true&platform="
    + encodeURIComponent(JSON.stringify({ os: "linux", architecture: "arm64", variant: "v8" }))],
});
async function management(s, kind, body = null) {
  const [method, path] = routes[kind];
  frontier(s);
  if (kind === "load" && (!s.intent || !s.reservation || !body || s.dispatched)) fail("image_single_dispatch");
  const maximum = kind === "load" ? P.loadMax : P.responseMax;
  const operation = { kind, request: null, response: null, socket: null, error: null,
    request_closed: false, response_closed: false, socket_closed: false, request_finished: false, response_ended: false };
  s.active.push(operation);
  // This flag is set BEFORE request construction. Construction/ACK ambiguity
  // never refunds the canonical reservation or allows another POST.
  if (kind === "load") s.dispatched = true;
  return new Promise((resolve, reject) => {
    let complete = false, chunks = [], length = 0, responseSeen = false;
    const bad = reason => { operation.error ??= reason; };
    const settle = () => {
      if (complete || !operation.request_closed || (operation.socket && !operation.socket_closed)
        || (responseSeen && !operation.response_closed)) return;
      complete = true; clearTimeout(timer);
      try {
        s.socket.check();
        const req = operation.request, res = operation.response, socket = operation.socket;
        if (!res || !responseSeen || !operation.request_finished || !operation.response_ended || !res.complete || !res.readableEnded
          || !req.writableFinished || req.writableLength !== 0 || !socket || socket.writableLength !== 0)
          bad("image_http_incomplete");
        if (res?.httpVersion !== "1.1") bad("image_http_version");
        if (res) {
          const cl = res.headers["content-length"], te = res.headers["transfer-encoding"];
          if ((cl !== undefined && (te !== undefined || !/^(0|[1-9][0-9]*)$/.test(cl) || Number(cl) !== length))
            || (te !== undefined && te !== "chunked") || (cl === undefined && te === undefined)) bad("image_http_framing");
        }
        time(s);
        if (operation.error) fail(operation.error);
        const bytes = Buffer.concat(chunks, length), parsed = kind === "load" ? validateImageLoadResponse(bytes) : json(bytes);
        const status = res.statusCode;
        if (!(status === 200 || (kind === "inspect" && status === 404))) fail("image_http_status");
        resolve({ status, value: parsed, raw_sha256: imageHash(bytes), raw_bytes: bytes.length,
          framing_complete: true, request_finished: true, owned_client_handles_closed: true });
      } catch (error) { reject(error); }
    };
    const timer = setTimeout(() => {
      bad("image_http_deadline");
      // Closing our client does NOT cancel/settle an accepted daemon operation.
      operation.request?.destroy(Error("image_http_deadline"));
    }, Math.max(1, Number((s.deadline - now()) / 1000000n)));
    try {
      const headers = { Host: "localhost", Connection: "close" };
      if (body) { headers["Content-Length"] = String(body.length); headers["Content-Type"] = "application/x-tar"; }
      const req = request({ socketPath: s.socket.handle.path, method, path, agent: false, headers }, res => {
        responseSeen = true; operation.response = res;
        if (res.headers["content-type"]?.split(";")[0] !== "application/json") bad("image_http_content_type");
        res.on("data", chunk => {
          length += chunk.length;
          if (length > maximum) { bad("image_http_response_bound"); req.destroy(Error("image_http_response_bound")); }
          else chunks.push(Buffer.from(chunk));
        });
        res.once("aborted", () => bad("image_http_aborted"));
        res.once("error", () => bad("image_http_response_error"));
        res.once("end", () => { operation.response_ended = true; });
        res.once("close", () => { operation.response_closed = true; settle(); });
      });
      operation.request = req;
      req.once("socket", socket => {
        operation.socket = socket;
        socket.once("error", () => bad("image_http_socket_error"));
        socket.once("close", () => { operation.socket_closed = true; settle(); });
      });
      req.once("finish", () => { operation.request_finished = true; });
      req.once("error", () => bad("image_http_request_error"));
      req.once("close", () => { operation.request_closed = true; settle(); });
      req.end(body ?? undefined);
    } catch (error) {
      clearTimeout(timer);
      // No constructed request exists to retain. A constructed one remains in
      // custody and must emit its close events before we return.
      if (operation.request) { bad("image_http_dispatch_error"); operation.request.destroy(error); }
      else { complete = true; reject(error); }
    }
  });
}
export function validateImageLoadResponse(bytes) {
  if (!Buffer.isBuffer(bytes) || !bytes.length || bytes.length > P.loadMax) fail("image_load_response_bound");
  const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  // Moby's WriteJSON makes CRLF-delimited objects. Accept LF as well, but
  // never an incomplete last object, progress noise or a hidden JSON error.
  if (!text.endsWith("\n")) fail("image_load_response_frame");
  const lines = text.split(/\r?\n/); lines.pop();
  if (lines.length !== 1 || !lines[0]) fail("image_load_response_frame");
  const v = json(Buffer.from(lines[0]));
  if (Object.hasOwn(v, "error") || Object.hasOwn(v, "errorDetail") || /error unpacking/i.test(v.stream ?? ""))
    fail("image_load_application_error");
  record(v, ["stream"]);
  if (v.stream !== "Loaded image ID: " + P.manifest + "\n") fail("image_load_unexpected_stream");
  return { loaded_manifest: P.manifest, application_error_observed: false };
}
export function validateImageInspect(v) {
  const d = record(v.Descriptor, ["mediaType", "digest", "size"], ["platform", "annotations"]);
  const descriptor = { mediaType: d.mediaType, digest: d.digest, size: d.size };
  const platformMatches = d.platform === undefined
    || equal(d.platform, { os: "linux", architecture: "arm64" })
    || equal(d.platform, { os: "linux", architecture: "arm64", variant: "v8" });
  const annotationsMatch = d.annotations === undefined || (d.annotations !== null && typeof d.annotations === "object"
    && !Array.isArray(d.annotations) && Object.values(d.annotations).every(value => typeof value === "string"));
  if (!platformMatches || !annotationsMatch || v.Id !== P.manifest || !equal(descriptor, {
    mediaType: "application/vnd.oci.image.manifest.v1+json", digest: P.manifest, size: P.manifestSize,
  }) || v.Os !== "linux" || v.Architecture !== "arm64" || v.Variant !== "v8"
    || !equal(v.RootFS, { Type: "layers", Layers: P.layers.map(l => l.diff) })
    || !equal({ Env: v.Config?.Env, Entrypoint: v.Config?.Entrypoint, Cmd: v.Config?.Cmd },
      { Env: P.env, Entrypoint: ["docker-entrypoint.sh"], Cmd: ["node"] })
    || !Array.isArray(v.RepoDigests) || !v.RepoDigests.every(d => typeof d === "string")
    || (v.RepoTags !== null && (!Array.isArray(v.RepoTags) || !v.RepoTags.every(d => typeof d === "string"))))
    fail("image_exact_manifest_inspection");
  return { manifest: v.Id, config_blob: P.config, descriptor, os: v.Os, architecture: v.Architecture,
    variant: v.Variant, rootfs: v.RootFS, config: { Env: v.Config.Env, Entrypoint: v.Config.Entrypoint, Cmd: v.Config.Cmd },
    repo_digests: v.RepoDigests, independently_unpack_verified: false };
}
async function engine(s) {
  const version = await management(s, "version"), info = await management(s, "info");
  const v = version.value, i = info.value;
  if (v.Version !== "28.5.1" || v.ApiVersion !== "1.51" || v.Os !== "linux" || v.Arch !== "arm64"
    || typeof i.ID !== "string" || !/^[A-Za-z0-9:-]{8,128}$/.test(i.ID) || i.ServerVersion !== "28.5.1"
    || i.DockerRootDir !== "/var/lib/docker" || i.Driver !== "overlayfs" || i.OSType !== "linux"
    || !["arm64", "aarch64"].includes(i.Architecture)
    || !equal(i.DriverStatus, [["driver-type", "io.containerd.snapshotter.v1"]])) fail("image_exact_engine");
  const selected = { ID: i.ID, ServerVersion: i.ServerVersion, DockerRootDir: i.DockerRootDir,
    Driver: i.Driver, DriverStatus: i.DriverStatus, OSType: i.OSType, Architecture: i.Architecture };
  if (s.engine && !equal(selected, s.engine)) fail("image_engine_changed");
  s.engine = selected;
  s.http.push({ kind: "version", ...version, value: { Version: v.Version, ApiVersion: v.ApiVersion, Os: v.Os, Arch: v.Arch } },
    { kind: "info", ...info, value: selected });
}
export async function runPinnedImage(plan) {
  const s = plans.get(plan);
  if (!s) fail("image_private_plan");
  if (s.used) fail("image_plan_used");
  s.used = true; // Burn before even the first fallible effect-boundary recheck.
  s.http = [];
  try {
    frontier(s); await hello(s);
    await verifyImageEntries(s.entries); frontier(s);
    await engine(s);
    const initial = await management(s, "inspect"); s.http.push({ kind: "initial-inspect", ...initial });
    let image;
    if (initial.status === 200) image = validateImageInspect(initial.value);
    else {
      if (initial.value.message !== "No such image: " + P.manifest) fail("image_missing_response");
      frontier(s);
      const bytes = encodeImageTar(s.entries);
      await verifyImageTar(bytes); frontier(s);
      s.archive = publishImageArchive(s.b.case_root, bytes, P.uid); s.originals.push(s.archive);
      await verifyImageTar(s.archive.bytes); frontier(s);
      const intent = { schema: "airlock.pinned-image-intent.v1", case_root: s.b.case_root, nonce: s.job.nonce,
        decision: s.decision.handle, binding: s.binding.handle, job: s.jobFile.handle, proof: s.proofFile.handle,
        node: s.node.handle, caller: s.caller.handle, sources: s.sources, engine: s.engine, socket: s.socket.handle,
        archive: s.archive.handle, capacity: s.capacity, started_monotonic_ns: String(s.started),
        deadline_monotonic_ns: String(s.deadline), no_retry_or_refund: true };
      s.intentAttempted = true;
      s.intent = publishImageRecord(s.b.case_root, "operation-intent.json", intent, P.uid);
      s.reservationAttempted = true;
      s.reservation = reserveImageImport(s.b.canonical_reservation_path, intent, P.uid);
      for (const [path, expected] of [[s.intent.path, s.intent], [s.b.canonical_reservation_path, null]]) {
        const held = imageOriginal(path, { uid: P.uid, privateFile: true });
        if (expected && !equal(held.legacy, expected)) { held.close(); fail("image_intent_changed"); }
        if (!expected && !equal(held.handle, s.reservation)) { held.close(); fail("image_reservation_changed"); }
        s.originals.push(held);
      }
      frontier(s); await engine(s); frontier(s);
      const loaded = await management(s, "load", s.archive.bytes);
      s.postComplete = true; s.http.push({ kind: "load", ...loaded });
      const final = await management(s, "inspect"); s.http.push({ kind: "final-inspect", ...final });
      if (final.status !== 200) fail("image_absent_after_load");
      image = validateImageInspect(final.value);
      await engine(s);
    }
    frontier(s);
    const result = { schema: "airlock.pinned-image-controller-result.v1", status: "IMAGE_AVAILABLE_PENDING_OUTER_CLOSE",
      nonce: s.job.nonce, pid: process.pid, job: s.jobFile.handle, proof: s.proofFile.handle,
      import_dispatched: s.dispatched, read_only_already_present: !s.dispatched, handler_response_complete: s.postComplete,
      image, engine: s.engine, socket: s.socket.handle, capacity: s.capacity, http: s.http,
      no_ownership_claim_over_preexisting_image: true, independently_unpack_verified: false,
      daemon_cancellation_or_generic_settlement_claimed: false, runtime_qualified: false, native_qualified: false,
      clock_qualified: false, mac_qualified: false, namespace_qualified: false, h_qualified: false,
      s_durability_qualified: false, meta_slots_changed: false };
    const published = publishImageRecord(s.b.case_root, "image-result.json", result, P.uid);
    s.result = imageOriginal(published.path, { uid: P.uid, privateFile: true });
    s.originals.push(s.result);
    if (!equal(s.result.legacy, published)) fail("image_result_changed");
    frontier(s);
    // The attestation is outside the persisted body: it cannot hash itself.
    return data({ ...result, result_original: s.result.handle });
  } catch (error) {
    const report = { schema: "airlock.pinned-image-controller-unknown.v1", status: s.dispatched ? "UNKNOWN" : "REFUSED",
      reason: error.message, import_dispatched: s.dispatched, intent_persisted: s.intent ? true : s.intentAttempted ? null : false,
      reservation_burned: s.reservation ? true : s.reservationAttempted ? null : false,
      reservation_outcome: s.reservation ? "ACKNOWLEDGED" : s.reservationAttempted ? "UNKNOWN_OR_PREEXISTING" : "NOT_ATTEMPTED",
      no_retry_or_cleanup: true, daemon_cancellation_or_generic_settlement_claimed: false, runtime_qualified: false, native_qualified: false };
    // Failure to file diagnostics is itself an error, never a successful fallback.
    try { publishImageRecord(s.b.case_root, "image-unknown.json", report, P.uid); }
    catch (publicationError) {
      throw new AggregateError([error, publicationError], "image_failure_and_diagnostic_failure", { cause: publicationError });
    }
    throw error;
  } finally {
    for (const h of [...s.originals, ...s.directories].reverse()) h.close();
  }
}
