// W requests only START/WORK. All Docker clients and permits stay owned by S.
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { data, equal, json, record } from "./inspected-meta-record.mjs";
import { atomicPrivateWrite, digest, fail, fixedRead } from "./sdk-absent-owned-namespace-io.mjs";
import { namespacePlanEvidence } from "./sdk-absent-owned-namespace.mjs";
import { readOwnedNamespaceLaunchRequest } from "./sdk-absent-owned-namespace-actors.mjs";
import { requireOwnedNamespaceRuntimeAdmission } from "./sdk-absent-owned-namespace-admission.mjs";

export function startOwnedNamespaceWorker(value) {
  if (typeof process.send !== "function" || !process.connected || process.env.AIRLOCK_ROLE !== "W")
    fail("namespace_direct_worker_refused");
  const v = record(data(value), ["authority_path", "authority_sha256"]);
  if (!digest(v.authority_sha256)) fail("namespace_worker_authority_locator");
  const file = fixedRead(v.authority_path, { maximum: 32768 }), a = record(json(file.bytes),
    ["schema", "request", "request_file", "source_sha256", "owner", "cid", "custody"]);
  if (file.handle.sha256 !== v.authority_sha256 || a.schema !== "airlock.owned-namespace-worker-authority.v2"
    || a.owner !== "S" || !digest(a.cid) || a.custody?.cid !== a.cid
    || v.authority_path !== a.request.root + "/worker-authority.json") fail("namespace_worker_authority_changed");
  const loaded = readOwnedNamespaceLaunchRequest({ request_path: a.request_file.path, request_sha256: a.request_file.sha256 });
  const p = namespacePlanEvidence(loaded.plan);
  if (!equal(a.request, loaded.request) || a.source_sha256 !== p.source_sha256
    || !equal(fixedRead(v.authority_path, { maximum: 32768, privateUid: p.prepared_identity.root.uid }).handle, file.handle))
    fail("namespace_worker_request_changed");
  requireOwnedNamespaceRuntimeAdmission(loaded.plan);
  atomicPrivateWrite(a.request.root, "worker-claimed.json", { schema: "airlock.owned-namespace-worker-claim.v2",
    authority: file.handle, source_sha256: p.source_sha256, request: loaded.request, owner: "S" }, p.prepared_identity.root.uid);
  let closed = false, armed = false, startIssued = false;
  const finish = code => {
    if (closed) return;
    closed = true; process.exitCode = code; process.removeListener("message", receive);
    if (process.connected) process.disconnect();
  };
  const send = (type, callback = () => {}) => {
    if (closed || !process.connected) return finish(2);
    process.send({ type, case_id: a.request.case_id, nonce: a.request.nonce, source_sha256: p.source_sha256 }, e => {
      if (e) finish(2); else callback();
    });
  };
  const receive = raw => {
    try {
      const m = record(data(raw), ["type", "case_id", "nonce", "source_sha256"]);
      if (m.case_id !== a.request.case_id || m.nonce !== a.request.nonce || m.source_sha256 !== p.source_sha256)
        fail("namespace_worker_foreign_message");
      if (m.type === "FINISH") { finish(0); return; }
      if (m.type === "START_ISSUED" && a.request.control === "worker-loss-before-init" && !startIssued) {
        startIssued = true; finish(2); return;
      }
      if (m.type !== "ARMED" || armed) fail("namespace_worker_protocol");
      armed = true;
      if (a.request.control === "worker-loss-after-arm") finish(2);
      else if (["normal", "late-detached-orphan"].includes(a.request.control)) send("REQUEST_WORK");
      else fail("namespace_worker_wrong_loss_phase");
    } catch { finish(2); }
  };
  process.on("message", receive);
  send("READY", () => send("REQUEST_START"));
  return Object.freeze({ owner: "S", worker_claimed: true, sdk_absent: true, qualified: false });
}
export const OWNED_NAMESPACE_WORKER_FILE = fileURLToPath(import.meta.url);
export function runOwnedNamespaceWorkerEntry(argv) {
  const [mode, authority_path, authority_sha256, ...extra] = data(argv);
  if (mode !== "--namespace-worker" || extra.length) fail("namespace_fixed_worker_arguments");
  return startOwnedNamespaceWorker({ authority_path, authority_sha256 });
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    runOwnedNamespaceWorkerEntry(process.argv.slice(2));
  } catch (e) {
    process.stderr.write(e.message + "\n"); process.exitCode = 2;
    if (process.connected) process.disconnect();
  }
}
