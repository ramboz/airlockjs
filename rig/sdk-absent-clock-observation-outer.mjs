import process from "node:process";
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { fail, observationSnapshot, observationWrite } from "./sdk-absent-clock-observation-io.mjs";
import { clockObservationPlanEvidence } from "./sdk-absent-clock-observation-plan.mjs";
import { clockState, finishActor, loadActor, receiveBudget, revalidateObservationRequest, sample, writeActorRequest } from "./sdk-absent-clock-observation-protocol.mjs";
import { observeFixedClockActor } from "./sdk-absent-clock-observation-streams.mjs";

const tickets = new WeakMap();
function issueTicket(state) {
  const p = clockObservationPlanEvidence(state.plan);
  revalidateObservationRequest(state.plan, "O", state.binding, state.request_file);
  const b = { ...state.binding, nonce: randomBytes(32).toString("hex"), ticket: randomBytes(32).toString("hex") };
  const original = observationWrite(p.root, "o-ticket.json", {
    schema: "airlock.clock-observation-O-ticket.v1", issuer: "O", binding: b,
    request_file: state.request_file, handshake: state.handshake, issued_ns: sample(state.clock),
    source_facts: p.facts, node: p.node, client: p.client, image_id: p.image_id, engine: p.engine,
    source_leases: p.sources,
  }, p.uid);
  revalidateObservationRequest(state.plan, "O", state.binding, state.request_file);
  observationSnapshot(original, p.uid);
  const cap = Object.freeze(Object.create(null));
  tickets.set(cap, { state, binding: b, original, used: false }); return cap;
}
async function runProducer(state, cap) {
  const ticket = tickets.get(cap);
  if (!ticket || ticket.state !== state || ticket.used) fail("observation_private_one_use_O_ticket_required");
  observationSnapshot(ticket.original, state.p.uid); ticket.used = true;
  const request = writeActorRequest(state.plan, "P", ticket.binding, ticket.original);
  const child = await observeFixedClockActor(state, "P", ticket.binding, request);
  return { ticket: ticket.original, producer_close: child.file };
}
export async function runClockObservationOuter(argv) {
  const clock = clockState("O"), tau0 = sample(clock);
  const state = await receiveBudget(loadActor(argv, "O", clock, tau0));
  const result = await runProducer(state, issueTicket(state));
  return finishActor(state, result);
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  runClockObservationOuter(process.argv.slice(2)).catch(e => { process.stderr.write(e.message + "\n"); process.exitCode = 2; });
}
