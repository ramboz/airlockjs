import process from "node:process";
import { realpathSync } from "node:fs";
import { data, equal, record } from "./inspected-meta-record.mjs";
import { fail, hash, observationDirectory, observationRead, observationSnapshot } from "./sdk-absent-clock-observation-io.mjs";
import { ns, TOTAL_NS } from "./sdk-absent-clock-observation-protocol.mjs";
import { CLOCK_HOST_SOURCES, HOST_TARGET, hostRequest } from "./sdk-absent-clock-host-plan.mjs";

export const hostBinding = p => ({ target: HOST_TARGET, case_id: p.case_id, nonce: p.nonce,
  control: p.control, source_sha256: p.source_sha256 });
export function hostFixturePid(value) {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0)
    fail("host_owned_fixture_pid_required");
  return value;
}
export function hostBeforeDeadline(start, at) {
  const elapsed = ns(at) - ns(start);
  if (elapsed < 0n || elapsed >= TOTAL_NS) fail("host_original_deadline_expired");
  return TOTAL_NS - elapsed;
}
export function hostOriginalRequest(handle) {
  const r = record(observationSnapshot(handle).value, ["schema", "target", "root", "case_id", "nonce", "control",
    "uid", "node", "node_version", "sources", "source_sha256", "directory", "start_ns", "deadline_ns"]);
  hostRequest({ root: r.root, case_id: r.case_id, nonce: r.nonce, control: r.control });
  if (r.schema !== "airlock.clock-host-request.v1" || r.target !== HOST_TARGET
    || handle.path !== r.root + "/host-request.json" || r.uid !== process.getuid()
    || r.node_version !== process.version || realpathSync(process.execPath) !== r.node.path
    || ns(r.deadline_ns) !== ns(r.start_ns) + TOTAL_NS
    || !Array.isArray(r.sources) || r.sources.length !== CLOCK_HOST_SOURCES.length)
    fail("host_request_target_or_original_changed");
  observationSnapshot(handle, r.uid);
  const d = observationDirectory(r.root, r.uid);
  if (d.dev !== r.directory.dev || d.ino !== r.directory.ino || r.directory.path !== r.root)
    fail("host_request_root_changed");
  const currentNode = observationRead(r.node.path, { executable: true, maximum: 134217728 }).handle;
  if (!equal(currentNode, r.node)) fail("host_request_executable_changed");
  for (let i = 0; i < CLOCK_HOST_SOURCES.length; i++) {
    const h = r.sources[i];
    if (h.path !== CLOCK_HOST_SOURCES[i] || !equal(observationRead(h.path).handle, h))
      fail("host_request_source_changed");
  }
  if (r.source_sha256 !== hash(JSON.stringify(data(r.sources)))) fail("host_request_source_digest_changed");
  return r;
}
export function hostMessage(raw, schema, r, request, fields) {
  const m = record(data(raw), ["schema", "target", "binding", "request", ...fields]);
  if (m.schema !== schema || m.target !== HOST_TARGET || !equal(m.binding, hostBinding(r))
    || !equal(m.request, request)) fail("host_IPC_target_or_binding_changed");
  return m;
}
