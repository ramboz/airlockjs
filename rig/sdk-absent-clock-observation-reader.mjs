// Retrospective only. In particular, a SOURCE H receipt is NOT supported
// actual-host provenance and cannot become an observation/runtime capability.
import { fileURLToPath } from "node:url";
import { equal, json, record } from "./inspected-meta-record.mjs";
import { digest, fail, hash, observationSnapshot } from "./sdk-absent-clock-observation-io.mjs";
import { clockObservationPlanEvidence } from "./sdk-absent-clock-observation-plan.mjs";
import { clockObservationCompletionOriginal } from "./sdk-absent-clock-observation-observer.mjs";
import { actorRequest, binding, domain, hello, makeBudget, ns, TOTAL_NS, validateBudget } from "./sdk-absent-clock-observation-protocol.mjs";
import { clockObservationDockerArgv, normalizeObservationEngine, normalizeObservationInspection, observationText } from "./sdk-absent-clock-observation-wire.mjs";

const denied = reason => ({
  status: "UNKNOWN", reason, source_observation_evidence_valid: false, observation_valid: false,
  qualified_clock: false, workload_admission: false, native_qualified: false, runtime_provenance: false,
});
const same = (a, b, reason) => { if (!equal(a, b)) fail(reason); };
function originalBytes(value) {
  const b = record(value, ["branch", "base64", "sha256", "chunks"]);
  if (typeof b.base64 !== "string" || !digest(b.sha256) || !Array.isArray(b.chunks) || b.chunks.length > 64)
    fail("observation_raw_stream");
  const bytes = Buffer.from(b.base64, "base64");
  if (bytes.length > 16384 || bytes.toString("base64") !== b.base64 || hash(bytes) !== b.sha256
    || b.branch !== (bytes.length ? "BYTES" : "EXPLICIT_EMPTY_NO_FRAMES")) fail("observation_raw_stream");
  let previous = null;
  const originals = b.chunks.map(value => {
    const c = record(value, ["received_ns", "base64", "sha256"]), at = ns(c.received_ns);
    if (previous !== null && at < previous) fail("observation_stream_receipt_clock_reversal");
    previous = at;
    if (typeof c.base64 !== "string" || !digest(c.sha256)) fail("observation_raw_chunk");
    const raw = Buffer.from(c.base64, "base64");
    if (!raw.length || raw.toString("base64") !== c.base64 || hash(raw) !== c.sha256) fail("observation_raw_chunk");
    return raw;
  });
  if (!Buffer.concat(originals).equals(bytes) || (!bytes.length && b.chunks.length)) fail("observation_raw_chunk_chain");
  return bytes;
}
function closeRecord(value, issued, { ipc = false, empty = false } = {}) {
  const c = record(value, ["schema", "code", "signal", "actual_close_ns", "streams_settled_ns",
    "eof", "closed", "ipc_settled", "pending_sends", "output", "messages", "errors"]);
  if (c.schema !== "airlock.clock-observation-stream-close.v1" || c.code !== 0 || c.signal !== null
    || c.ipc_settled !== true || c.pending_sends !== 0 || !equal(c.errors, [])
    || !equal(c.eof, { stdout: true, stderr: true }) || !equal(c.closed, { stdin: true, stdout: true, stderr: true })
    || ns(c.actual_close_ns) < ns(issued) || ns(c.streams_settled_ns) < ns(c.actual_close_ns)
    || !Array.isArray(c.messages) || c.messages.length > 8) fail("observation_actual_exit_or_stream_settlement_UNKNOWN");
  const out = record(c.output, ["stdout", "stderr"]);
  const stdout = originalBytes(out.stdout), stderr = originalBytes(out.stderr);
  if (stderr.length || (empty && stdout.length) || (!ipc && c.messages.length)) fail("observation_unexpected_output");
  for (const stream of Object.values(out)) for (const chunk of stream.chunks) {
    if (ns(chunk.received_ns) < ns(issued) || ns(chunk.received_ns) > ns(c.streams_settled_ns))
      fail("observation_stream_receipt_order");
  }
  let last = ns(issued);
  for (const value of c.messages) {
    const m = record(value, ["received_ns", "value"]), at = ns(m.received_ns);
    if (at < last || at > ns(c.streams_settled_ns)) fail("observation_IPC_order");
    last = at;
  }
  return { c, stdout };
}
function within(budget, stamp) {
  if (ns(stamp) < ns(budget.anchor_ns) || ns(stamp) - ns(budget.anchor_ns) >= ns(budget.remaining_ns))
    fail("observation_original_45_or_transferred_fence");
}
function inspectInit(bytes, p, b) {
  const text = observationText(bytes);
  if (!text.length || !text.endsWith("\n") || text.includes("\r") || Buffer.byteLength(text) > 8192)
    fail("observation_nonempty_complete_init_frames");
  const lines = text.slice(0, -1).split("\n");
  if (lines.length !== 2 || lines.some(line => !line.length || Buffer.byteLength(line) > 4096))
    fail("observation_fixed_init_frame_sequence");
  const a = record(json(Buffer.from(lines[0])), ["schema", "role", "binding", "domain", "unit", "tau0_ns", "image_id", "engine_id", "hello_ns"]);
  const c = record(json(Buffer.from(lines[1])), ["schema", "role", "binding", "domain", "unit", "tau0_ns", "image_id", "engine_id", "sequence", "sample_ns"]);
  if (a.schema !== "airlock.clock-observation-init-hello.v1" || c.schema !== "airlock.clock-observation-init-clock.v1"
    || c.sequence !== 1 || ns(a.hello_ns) < ns(a.tau0_ns) || ns(c.sample_ns) < ns(a.hello_ns)
    || c.tau0_ns !== a.tau0_ns) fail("observation_init_clock_sequence_or_reversal");
  for (const frame of [a, c]) {
    if (frame.role !== "I" || frame.domain !== domain("I") || frame.unit !== "ns"
      || frame.image_id !== p.image_id || frame.engine_id !== p.engine.ID || !equal(binding(frame.binding), b))
      fail("observation_init_identity_domain_or_unit");
  }
  return { guest_domain: domain("I"), observed_guest_interval_ns: (ns(c.sample_ns) - ns(a.tau0_ns)).toString() };
}
export function inspectClockObservation(receipt) {
  try {
    const { plan, p, original, completion } = clockObservationCompletionOriginal(receipt);
    const originals = new Map(), inodes = new Map();
    const read = (handle, suffix) => {
      if (handle?.path !== p.root + "/" + suffix) fail("observation_original_actor_path");
      const r = observationSnapshot(handle, p.uid), inode = handle.dev + ":" + handle.ino;
      if (inodes.has(inode) && inodes.get(inode) !== handle.path) fail("observation_original_alias");
      inodes.set(inode, handle.path); originals.set(handle.path, handle);
      return r.value;
    };
    const h = record(completion, ["schema", "owner", "start", "binding", "observed_O_close", "disposition", "errors", "provenance"]);
    if (h.schema !== "airlock.clock-observation-H-completion.v1" || h.owner !== "H" || h.disposition !== "SOURCE_CANDIDATE"
      || h.provenance !== "SOURCE_IMPLEMENTATION_NOT_ACTUAL_H_PROVENANCE" || !equal(h.errors, []))
      fail("observation_external_H_incomplete");
    const hb = binding(h.binding);
    if (hb.nonce !== null || hb.ticket !== null || hb.case_id !== p.case_id || hb.source_sha256 !== p.source_sha256
      || hb.cohort_sha256 !== p.cohort_sha256) fail("observation_H_source_or_binding");
    const hs = record(read(h.start, "h-start.json"), ["schema", "owner", "binding", "domain", "unit",
      "original_start_ns", "original_remaining_ns", "provenance"]);
    if (hs.schema !== "airlock.clock-observation-H-start.v1" || hs.owner !== "H" || hs.domain !== domain("H")
      || hs.unit !== "ns" || ns(hs.original_remaining_ns) !== TOTAL_NS || !equal(hs.binding, hb)
      || hs.provenance !== h.provenance) fail("observation_original_H_start_UNAVAILABLE");
    const rootBudget = { anchor_ns: hs.original_start_ns, remaining_ns: hs.original_remaining_ns };
    const inspectEdge = (handle, owner, role, expectedBinding, parentOriginal, budget, parentPublication = null) => {
      const suffix = owner.toLowerCase() + "-child-close.json";
      const e = record(read(handle, suffix), ["schema", "registration", "issued_ns", "hello", "transfer", "candidate", "close"]);
      const r = record(read(e.registration, owner.toLowerCase() + "-child-registered.json"), [
        "schema", "owner", "role", "binding", "request", "command", "domain", "unit", "pre_spawn_ns", "budget"]);
      if (e.schema !== "airlock.clock-observation-child-close.v1" || r.schema !== "airlock.clock-observation-child-registration.v1"
        || r.owner !== owner || r.role !== role || r.domain !== domain(owner) || r.unit !== "ns"
        || ns(e.issued_ns) < ns(r.pre_spawn_ns)) fail("observation_fixed_actor_registration");
      same(r.binding, expectedBinding, "observation_actor_binding_substitution");
      same(r.budget, budget, "observation_budget_renewal");
      within(budget, r.pre_spawn_ns); within(budget, e.issued_ns);
      const request = actorRequest(read(r.request, role.toLowerCase() + "-request.json"));
      same(request, { schema: "airlock.clock-observation-request.v1", role, root: p.root,
        binding: expectedBinding, parent_original: parentOriginal }, "observation_request_parent_chain");
      const file = { O: "outer", P: "producer", S: "supervisor" }[role];
      same(r.command, { executable: p.node.path, argv: [
        fileURLToPath(new URL("sdk-absent-clock-observation-" + file + ".mjs", import.meta.url)),
        "--clock-observation-" + role.toLowerCase(), r.request.path, r.request.sha256],
      env: { HOME: p.root + "/empty-home", PATH: "/usr/local/bin:/usr/bin:/bin" },
      cwd: p.root + "/empty-home", shell: false, stdio: ["pipe", "pipe", "pipe", "ipc"] }, "observation_fixed_command_substitution");
      const hh = hello(e.hello, role, expectedBinding), transfer = validateBudget(e.transfer, role, hh);
      same(transfer, makeBudget(owner, hh, r.pre_spawn_ns, transfer.sent_ns, budget), "observation_preHELLO_budget_chain");
      if (ns(transfer.sent_ns) < ns(e.issued_ns)) fail("observation_budget_before_child_issue");
      const { c } = closeRecord(e.close, e.issued_ns, { ipc: true, empty: true });
      within(budget, c.actual_close_ns); within(budget, c.streams_settled_ns);
      // Both stamps belong to owner (O for P, P for S). Child clock epochs
      // are unrelated and are never compared to the parent's publication.
      if (parentPublication !== null && ns(c.streams_settled_ns) > ns(parentPublication))
        fail("observation_child_settlement_after_parent_publication");
      const candidate = record(e.candidate, ["schema", "type", "role", "binding", "file", "publication_sample_ns"]);
      if (candidate.schema !== "airlock.clock-observation-result-message.v1" || candidate.type !== "RESULT" || candidate.role !== role)
        fail("observation_missing_actual_child_result");
      same(candidate.binding, expectedBinding, "observation_result_binding_substitution");
      if (c.messages.length !== 2) fail("observation_duplicate_or_missing_actor_IPC");
      same(c.messages[0].value, hh, "observation_HELLO_original_missing");
      same(c.messages[1].value, candidate, "observation_result_original_missing");
      if (ns(transfer.sent_ns) < ns(c.messages[0].received_ns) || ns(transfer.sent_ns) > ns(c.messages[1].received_ns))
        fail("observation_original_budget_send_order");
      const childBudget = { anchor_ns: hh.tau0_ns, remaining_ns: transfer.offered_remaining_ns };
      within(childBudget, candidate.publication_sample_ns);
      const value = read(candidate.file, role.toLowerCase() + "-result.json");
      const fields = role === "O" ? ["ticket", "producer_close"] : role === "P" ? ["supervisor_close"]
        : ["owner", "cid", "custody", "operations", "disposition"];
      const actor = record(value, ["schema", "role", "binding", "request_file", "handshake", "errors", ...fields]);
      if (actor.schema !== "airlock.clock-observation-actor-result.v1" || actor.role !== role || !equal(actor.errors, []))
        fail("observation_actor_failed_or_unsettled");
      same(actor.binding, expectedBinding, "observation_actor_result_identity");
      same(actor.request_file, r.request, "observation_actor_original_request");
      const handshake = record(actor.handshake, ["hello", "budget", "received_ns"]);
      same(handshake.hello, hh, "observation_retained_preHELLO_missing");
      same(handshake.budget, transfer, "observation_transferred_original_budget_changed");
      if (ns(handshake.received_ns) < ns(hh.hello_ns) || ns(candidate.publication_sample_ns) < ns(handshake.received_ns))
        fail("observation_handshake_clock_reversal");
      within(childBudget, handshake.received_ns);
      return { actor, budget: childBudget, request: r.request, registered: r.pre_spawn_ns,
        published: candidate.publication_sample_ns, c };
    };
    const o = inspectEdge(h.observed_O_close, "H", "O", hb, h.start, rootBudget);
    const ticket = record(read(o.actor.ticket, "o-ticket.json"), ["schema", "issuer", "binding", "request_file",
      "handshake", "issued_ns", "source_facts", "node", "client", "image_id", "engine", "source_leases"]);
    const b = binding(ticket.binding);
    if (ticket.schema !== "airlock.clock-observation-O-ticket.v1" || ticket.issuer !== "O"
      || b.nonce === null || b.ticket === null || b.run_id !== hb.run_id || b.case_id !== hb.case_id
      || b.source_sha256 !== hb.source_sha256 || b.cohort_sha256 !== hb.cohort_sha256
      || ns(ticket.issued_ns) < ns(o.actor.handshake.received_ns) || ns(ticket.issued_ns) > ns(o.published))
      fail("observation_independent_O_ticket_missing");
    same(ticket.request_file, o.request, "observation_ticket_original_request");
    same(ticket.handshake, o.actor.handshake, "observation_ticket_original_budget");
    for (const key of ["node", "client", "image_id", "engine"]) same(ticket[key], p[key], "observation_ticket_cohort_substitution");
    same(ticket.source_facts, p.facts, "observation_ticket_source_facts_changed");
    same(ticket.source_leases, p.sources, "observation_ticket_source_lease_changed");
    const pr = inspectEdge(o.actor.producer_close, "O", "P", b, o.actor.ticket, o.budget, o.published);
    if (ns(pr.registered) < ns(ticket.issued_ns)) fail("observation_ticket_after_producer");
    const s = inspectEdge(pr.actor.supervisor_close, "P", "S", b, pr.request, pr.budget, pr.published);
    const ledger = s.actor;
    if (ledger.owner !== "S" || !digest(ledger.cid) || ledger.disposition !== "SOURCE_SETTLED_CANDIDATE"
      || !Array.isArray(ledger.operations) || ledger.operations.length < 6 || ledger.operations.length > 32)
      fail("observation_S_pending_or_unknown");
    const custody = record(read(ledger.custody, "s-custody.json"), ["schema", "owner", "binding", "cid", "engine",
      "image_id", "endpoint", "create_registration", "inspection", "request_file", "acquired_ns"]);
    if (custody.schema !== "airlock.clock-observation-S-custody.v1" || custody.owner !== "S" || custody.cid !== ledger.cid
      || custody.image_id !== p.image_id || custody.endpoint !== p.endpoint || !equal(custody.engine, p.engine)
      || !equal(custody.binding, b) || !equal(custody.request_file, s.request)) fail("observation_exact_S_custody");
    const ops = [];
    let guest = null;
    for (const [i, item] of ledger.operations.entries()) {
      const op = record(item, ["id", "kind", "registration", "closed"]);
      if (op.id !== i + 1 || !["engine", "create", "inspect", "start", "stop", "wait", "remove"].includes(op.kind))
        fail("observation_fixed_S_operation_DAG");
      const reg = record(read(op.registration, "s-op-" + op.id + "-registered.json"), ["schema", "owner", "id", "kind", "binding",
        "cid", "custody", "domain", "unit", "registered_ns", "command", "request_file", "depends_on"]);
      const closed = record(read(op.closed, "s-op-" + op.id + "-closed.json"), ["schema", "registration", "issued_ns", "daemon", "close"]);
      if (reg.schema !== "airlock.clock-observation-S-registration.v1" || reg.owner !== "S" || reg.id !== op.id
        || reg.kind !== op.kind || reg.domain !== domain("S") || reg.unit !== "ns"
        || closed.schema !== "airlock.clock-observation-S-close.v1" || closed.daemon !== "SETTLED"
        || ns(closed.issued_ns) < ns(reg.registered_ns)) fail("observation_S_registration_or_settlement");
      same(closed.registration, op.registration, "observation_S_original_registration");
      same(reg.binding, b, "observation_S_operation_identity");
      same(reg.request_file, s.request, "observation_S_request_original");
      if (reg.cid !== (["engine", "create"].includes(op.kind) && i < 2 ? null : ledger.cid))
        fail("observation_S_CID_substitution");
      if (ns(reg.registered_ns) >= ns(custody.acquired_ns)) {
        same(reg.custody, ledger.custody, "observation_operation_without_durable_custody");
      } else if (reg.custody !== null) fail("observation_premature_custody_claim");
      if (ops.length && ns(ops.at(-1).issued_ns) > ns(reg.registered_ns))
        fail("observation_operation_issue_order");
      if (!Array.isArray(reg.depends_on) || reg.depends_on.length > 32) fail("observation_operation_dependencies");
      const seen = new Set();
      for (const value of reg.depends_on) {
        const dep = record(value, ["id", "receipt"]), previous = ops.find(o => o.id === dep.id);
        if (!previous || seen.has(dep.id) || !equal(dep.receipt, previous.closed)
          || ns(previous.streams_settled_ns) > ns(reg.registered_ns)) fail("observation_operation_dependency_edge");
        seen.add(dep.id);
      }
      const { c, stdout } = closeRecord(closed.close, closed.issued_ns);
      within(s.budget, reg.registered_ns); within(s.budget, closed.issued_ns); within(s.budget, c.streams_settled_ns);
      if (ns(c.streams_settled_ns) > ns(s.published)) fail("observation_operation_after_publication");
      same(reg.command, { executable: p.client.path, executable_sha256: p.client.sha256,
        argv: clockObservationDockerArgv(p, b, op.kind, reg.cid),
        env: { HOME: p.root + "/empty-home", DOCKER_CONFIG: p.root + "/docker-config", DOCKER_HOST: p.endpoint,
          PATH: "/usr/local/bin:/usr/bin:/bin" }, cwd: p.root + "/empty-home", shell: false, stdio: ["pipe", "pipe", "pipe"] },
      "observation_S_command_substitution");
      let projection = null;
      if (op.kind === "engine") normalizeObservationEngine(p, stdout);
      else if (op.kind === "inspect") projection = normalizeObservationInspection(p, b, stdout, ledger.cid);
      else if (op.kind === "start") guest = inspectInit(stdout, p, b);
      else if (observationText(stdout) !== (op.kind === "wait" ? "0" : ledger.cid) + "\n") fail("observation_exact_reply_bytes");
      ops.push({ ...op, registered_ns: reg.registered_ns, issued_ns: closed.issued_ns,
        streams_settled_ns: c.streams_settled_ns, depends_on: seen, projection, custody: reg.custody });
    }
    const actions = ops.filter(o => o.kind !== "engine");
    same(actions.map(o => o.kind), ["create", "inspect", "start", "stop", "inspect", "wait", "remove"], "observation_fixed_S_path");
    const [create, boot, start, stop, final, wait, remove] = actions;
    const before = (a, z) => {
      if (ns(a.streams_settled_ns) > ns(z.registered_ns) || !z.depends_on.has(a.id))
        fail("observation_cross_operation_settlement_DAG");
    };
    before(create, boot); before(boot, start); before(stop, final); before(start, final); before(final, wait); before(wait, remove);
    for (const op of ops.filter(op => op.id < start.id)) before(op, start);
    if (ns(start.issued_ns) > ns(stop.registered_ns) || boot.projection.State.Status !== "created"
      || final.projection.State.Status !== "exited" || !guest) fail("observation_start_cleanup_DAG");
    same(custody.create_registration, create.registration, "observation_preissued_create_custody");
    same(custody.inspection, boot.closed, "observation_original_inspection_custody");
    if (ns(custody.acquired_ns) < ns(boot.streams_settled_ns) || ns(custody.acquired_ns) > ns(start.registered_ns))
      fail("observation_custody_before_start");
    same(start.custody, ledger.custody, "observation_start_without_durable_custody");
    for (const op of ops.filter(op => op.id < remove.id)) before(op, remove);
    for (const action of actions) {
      const previous = ops[action.id - 2];
      if (!previous || previous.kind !== "engine") fail("observation_engine_dependency_missing");
      before(previous, action);
    }
    const tail = ops.filter(op => op.id > remove.id);
    if (tail.length !== 1 || tail[0].kind !== "engine") fail("observation_final_engine_settlement");
    before(remove, tail[0]);
    read(original, "h-completion.json");
    for (const handle of originals.values()) observationSnapshot(handle, p.uid);
    clockObservationPlanEvidence(plan);
    return { ...denied("actual_H_provenance_UNAVAILABLE; SOURCE observations are not future clock bounds"),
      status: "SOURCE_OBSERVATION_EVIDENCE_VALID", source_observation_evidence_valid: true, simulation_only: true,
      diagnostics: { host_domain: domain("H"), target: p.target,
        image_manifest_sha256: p.image_manifest_sha256, image_config_sha256: p.image_config_sha256,
        program_source_sha256: p.source_sha256, program_sha256: p.program_sha256, command_sha256: p.command_sha256,
        observed_whole_O_interval_ns: (ns(o.c.actual_close_ns) - ns(hs.original_start_ns)).toString(), ...guest } };
  } catch (e) { return denied(e.message); }
}
