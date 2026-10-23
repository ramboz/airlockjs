import process from "node:process";
import { data, equal, json, record } from "./inspected-meta-record.mjs";
import { digest, fail, observationRead, observationSnapshot, observationWrite } from "./sdk-absent-clock-observation-io.mjs";
import { clockObservationPlanEvidence, prepareClockObservationPlan } from "./sdk-absent-clock-observation-plan.mjs";

export const TOTAL_NS = 45000000000n;
export function ns(value) {
  if (typeof value !== "string" || !/^(0|[1-9][0-9]{0,23})$/.test(value)) fail("observation_canonical_ns");
  return BigInt(value);
}
export const domain = role => "NODE_" + role + "_HRTIME_MONOTONIC_NS";
export function clockState(role) { return { role, last: null }; }
export function sample(clock) {
  const n = process.hrtime.bigint();
  if (typeof n !== "bigint" || n < 0n || (clock.last !== null && n < clock.last)) fail("observation_clock_reversal");
  ns(n.toString()); clock.last = n; return n.toString();
}
export function binding(value) {
  const b = record(data(value), ["case_id", "run_id", "nonce", "ticket", "source_sha256", "cohort_sha256"]);
  if (!/^[a-z0-9-]{1,48}$/.test(b.case_id) || !digest(b.run_id) || !digest(b.source_sha256) || !digest(b.cohort_sha256)
    || !((b.nonce === null && b.ticket === null) || (digest(b.nonce) && digest(b.ticket)))) fail("observation_actor_binding");
  return b;
}
export function hello(value, role, expected) {
  const h = record(data(value), ["schema", "role", "binding", "domain", "unit", "tau0_ns", "hello_ns"]);
  if (h.schema !== "airlock.clock-observation-hello.v1" || h.role !== role || !equal(binding(h.binding), expected)
    || h.domain !== domain(role) || h.unit !== "ns" || ns(h.hello_ns) < ns(h.tau0_ns)) fail("observation_preHELLO_anchor");
  return h;
}
export function makeBudget(parent, childHello, preSpawn, sent, budget) {
  const elapsed = ns(sent) - ns(budget.anchor_ns), remaining = ns(budget.remaining_ns) - elapsed;
  if (ns(preSpawn) < ns(budget.anchor_ns) || ns(sent) < ns(preSpawn) || remaining <= 0n) fail("observation_original_budget_expired");
  return { schema: "airlock.clock-observation-budget.v1", type: "OBSERVE_ONLY", parent, role: childHello.role,
    binding: childHello.binding, parent_domain: domain(parent), unit: "ns",
    parent_anchor_ns: budget.anchor_ns, parent_remaining_ns: budget.remaining_ns,
    pre_spawn_ns: preSpawn, sent_ns: sent, offered_remaining_ns: remaining.toString(),
    child_tau0_ns: childHello.tau0_ns, child_hello_ns: childHello.hello_ns };
}
export function validateBudget(value, role, expectedHello) {
  const b = record(data(value), ["schema", "type", "parent", "role", "binding", "parent_domain", "unit",
    "parent_anchor_ns", "parent_remaining_ns", "pre_spawn_ns", "sent_ns", "offered_remaining_ns",
    "child_tau0_ns", "child_hello_ns"]);
  const parent = { O: "H", P: "O", S: "P" }[role];
  if (b.schema !== "airlock.clock-observation-budget.v1" || b.type !== "OBSERVE_ONLY" || b.parent !== parent
    || b.role !== role || b.parent_domain !== domain(parent) || b.unit !== "ns"
    || !equal(binding(b.binding), expectedHello.binding)
    || b.child_tau0_ns !== expectedHello.tau0_ns || b.child_hello_ns !== expectedHello.hello_ns
    || ns(b.parent_remaining_ns) > TOTAL_NS || ns(b.parent_remaining_ns) <= 0n
    || ns(b.pre_spawn_ns) < ns(b.parent_anchor_ns) || ns(b.sent_ns) < ns(b.pre_spawn_ns)
    || ns(b.offered_remaining_ns) !== ns(b.parent_remaining_ns) - (ns(b.sent_ns) - ns(b.parent_anchor_ns))
    || ns(b.offered_remaining_ns) <= 0n) fail("observation_original_budget_transfer");
  return b;
}
export function remaining(state, stamp) {
  const elapsed = ns(stamp) - ns(state.budget.anchor_ns);
  if (elapsed < 0n || elapsed >= ns(state.budget.remaining_ns)) fail("observation_local_original_budget_expired");
  return ns(state.budget.remaining_ns) - elapsed;
}
export function actorRequest(value) {
  const r = record(data(value), ["schema", "role", "root", "binding", "parent_original"]);
  if (r.schema !== "airlock.clock-observation-request.v1" || !["O", "P", "S"].includes(r.role)) fail("observation_actor_request");
  binding(r.binding); return r;
}
// This is only the fixed O/P/S ancestry, not a selectable issuer/launcher or
// runtime grant. Re-read retained originals at each owned effect frontier.
export function revalidateObservationRequest(plan, role, expectedBinding, original) {
  const p = clockObservationPlanEvidence(plan);
  const read = (handle, name) => {
    if (handle?.path !== p.root + "/" + name) fail("observation_owned_original_path");
    return observationSnapshot(handle, p.uid).value;
  };
  const fixed = (actor, expected, file) => {
    if (!["O", "P", "S"].includes(actor)) fail("observation_fixed_actor_request");
    const r = actorRequest(read(file, actor.toLowerCase() + "-request.json"));
    if (r.role !== actor || r.root !== p.root || !equal(r.binding, expected)
      || expected.case_id !== p.case_id || expected.source_sha256 !== p.source_sha256
      || expected.cohort_sha256 !== p.cohort_sha256) fail("observation_owned_request_binding");
    if (actor === "S") fixed("P", expected, r.parent_original);
    else if (actor === "P") {
      const t = record(read(r.parent_original, "o-ticket.json"), ["schema", "issuer", "binding", "request_file",
        "handshake", "issued_ns", "source_facts", "node", "client", "image_id", "engine", "source_leases"]);
      if (t.schema !== "airlock.clock-observation-O-ticket.v1" || t.issuer !== "O"
        || expected.nonce === null || expected.ticket === null || !equal(t.binding, expected)
        || !equal(t.source_facts, p.facts) || !equal(t.source_leases, p.sources)
        || ["node", "client", "image_id", "engine"].some(key => !equal(t[key], p[key])))
        fail("observation_owned_O_ticket_changed");
      fixed("O", { ...expected, nonce: null, ticket: null }, t.request_file);
    } else {
      const h = record(read(r.parent_original, "h-start.json"), ["schema", "owner", "binding", "domain", "unit",
        "original_start_ns", "original_remaining_ns", "provenance"]);
      if (h.schema !== "airlock.clock-observation-H-start.v1" || h.owner !== "H"
        || h.domain !== domain("H") || h.unit !== "ns" || ns(h.original_remaining_ns) !== TOTAL_NS
        || expected.nonce !== null || expected.ticket !== null || !equal(h.binding, expected)
        || h.provenance !== "SOURCE_IMPLEMENTATION_NOT_ACTUAL_H_PROVENANCE")
        fail("observation_owned_H_start_changed");
      ns(h.original_start_ns);
    }
    return r;
  };
  return fixed(role, binding(expectedBinding), original);
}
export function writeActorRequest(plan, role, b, parentOriginal) {
  const p = clockObservationPlanEvidence(plan);
  return observationWrite(p.root, role.toLowerCase() + "-request.json", {
    schema: "airlock.clock-observation-request.v1", role, root: p.root, binding: b, parent_original: parentOriginal,
  }, p.uid);
}
export function loadActor(argv, role, clock, tau0) {
  const a = data(argv);
  if (!Array.isArray(a) || a.length !== 3 || a[0] !== "--clock-observation-" + role.toLowerCase()
    || typeof a[1] !== "string" || !digest(a[2]) || !process.connected || typeof process.send !== "function")
    fail("observation_direct_actor_refused");
  const original = observationRead(a[1], { maximum: 16384 }), r = actorRequest(json(original.bytes));
  const plan = prepareClockObservationPlan({ case_id: r.binding.case_id, root: r.root });
  const p = clockObservationPlanEvidence(plan);
  if (r.role !== role || a[1] !== p.root + "/" + role.toLowerCase() + "-request.json"
    || a[2] !== original.handle.sha256 || !equal(observationRead(a[1], { uid: p.uid }).handle, original.handle)
    || r.binding.source_sha256 !== p.source_sha256 || r.binding.cohort_sha256 !== p.cohort_sha256)
    fail("observation_actor_request_original_changed");
  revalidateObservationRequest(plan, role, r.binding, original.handle);
  return { role, clock, tau0, plan, p, request: r, request_file: original.handle, binding: r.binding, errors: [],
    budget: null, handshake: null };
}
export function receiveBudget(state) {
  const h = { schema: "airlock.clock-observation-hello.v1", role: state.role, binding: state.binding,
    domain: domain(state.role), unit: "ns", tau0_ns: state.tau0, hello_ns: sample(state.clock) };
  let received = false;
  return new Promise((resolve, reject) => {
    process.on("message", raw => {
      try {
        if (received) fail("observation_duplicate_or_unexpected_IPC");
        const b = validateBudget(raw, state.role, h), at = sample(state.clock);
        received = true;
        state.budget = { anchor_ns: state.tau0, remaining_ns: b.offered_remaining_ns };
        remaining(state, at); // Time spent before receipt is NOT restarted.
        state.handshake = { hello: h, budget: b, received_ns: at };
        resolve(state);
      } catch (e) { state.errors.push(e.message); reject(e); }
    });
    process.on("disconnect", () => { if (!state.finishing) state.errors.push("observation_parent_lost_NOT_cleanup"); });
    process.send(h, e => { if (e) { state.errors.push("observation_HELLO_send_failed"); reject(e); } });
  });
}
export async function finishActor(state, value) {
  const p = clockObservationPlanEvidence(state.plan);
  revalidateObservationRequest(state.plan, state.role, state.binding, state.request_file);
  remaining(state, sample(state.clock));
  const file = observationWrite(p.root, state.role.toLowerCase() + "-result.json", {
    schema: "airlock.clock-observation-actor-result.v1", role: state.role, binding: state.binding,
    request_file: state.request_file, handshake: state.handshake, errors: state.errors, ...value,
  }, p.uid);
  const after = sample(state.clock);
  remaining(state, after);
  clockObservationPlanEvidence(state.plan);
  revalidateObservationRequest(state.plan, state.role, state.binding, state.request_file);
  observationSnapshot(file, p.uid);
  const owned = state.role === "O" ? [value.ticket, value.producer_close]
    : state.role === "P" ? [value.supervisor_close]
      : [value.custody, ...value.operations.flatMap(op => [op.registration, op.closed])];
  for (const handle of owned) if (handle !== null) observationSnapshot(handle, p.uid);
  await new Promise((resolve, reject) => {
    process.send({ schema: "airlock.clock-observation-result-message.v1", type: "RESULT",
      role: state.role, binding: state.binding, file, publication_sample_ns: after }, e => e ? reject(e) : resolve());
  });
  state.finishing = true; process.exitCode = state.errors.length ? 2 : 0;
  process.disconnect(); return file;
}
