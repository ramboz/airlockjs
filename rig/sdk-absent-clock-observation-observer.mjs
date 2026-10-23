import { randomBytes } from "node:crypto";
import { data, record } from "./inspected-meta-record.mjs";
import { fail, observationSnapshot, observationWrite } from "./sdk-absent-clock-observation-io.mjs";
import { observationArguments, clockObservationPlanEvidence, prepareClockObservationPlan } from "./sdk-absent-clock-observation-plan.mjs";
import { clockState, domain, revalidateObservationRequest, sample, TOTAL_NS, writeActorRequest } from "./sdk-absent-clock-observation-protocol.mjs";
import { observeFixedClockActor } from "./sdk-absent-clock-observation-streams.mjs";
import { requireClockObservationH } from "./sdk-absent-clock-observation-admission.mjs";

const completions = new WeakMap();
export async function observeClockObservation(value) {
  const clock = clockState("H"), originalStart = sample(clock);
  const v = observationArguments(value);
  requireClockObservationH();
  const plan = prepareClockObservationPlan(v), p = clockObservationPlanEvidence(plan);
  const b = { case_id: p.case_id, run_id: randomBytes(32).toString("hex"), nonce: null, ticket: null,
    source_sha256: p.source_sha256, cohort_sha256: p.cohort_sha256 };
  const start = observationWrite(p.root, "h-start.json", {
    schema: "airlock.clock-observation-H-start.v1", owner: "H", binding: b,
    domain: domain("H"), unit: "ns", original_start_ns: originalStart, original_remaining_ns: TOTAL_NS.toString(),
    provenance: "SOURCE_IMPLEMENTATION_NOT_ACTUAL_H_PROVENANCE",
  }, p.uid);
  const state = { role: "H", clock, plan, errors: [], budget: { anchor_ns: originalStart, remaining_ns: TOTAL_NS.toString() } };
  const request = writeActorRequest(plan, "O", b, start);
  const observed = await observeFixedClockActor(state, "O", b, request);
  observationSnapshot(start, p.uid); observationSnapshot(observed.file, p.uid);
  const original = observationWrite(p.root, "h-completion.json", {
    schema: "airlock.clock-observation-H-completion.v1", owner: "H", start, binding: b,
    observed_O_close: observed.file, disposition: state.errors.length ? "UNKNOWN" : "SOURCE_CANDIDATE",
    errors: state.errors, provenance: "SOURCE_IMPLEMENTATION_NOT_ACTUAL_H_PROVENANCE",
  }, p.uid);
  clockObservationPlanEvidence(plan);
  revalidateObservationRequest(plan, "O", b, request);
  observationSnapshot(start, p.uid);
  const observedOriginal = observationSnapshot(observed.file, p.uid).value;
  observationSnapshot(observedOriginal.registration, p.uid);
  if (observed.candidate) observationSnapshot(observed.candidate.file, p.uid);
  observationSnapshot(original, p.uid);
  // Only this running H operation, after its own child-close callback and
  // queried-stream settlement, can mint this SOURCE receipt. JSON cannot.
  const receipt = Object.freeze(Object.create(null));
  completions.set(receipt, { plan, original });
  return { completion: receipt, status: state.errors.length ? "UNKNOWN" : "SOURCE_CANDIDATE",
    errors: [...state.errors], observation_valid: false, runtime_provenance: false,
    qualified_clock: false, workload_admission: false, native_qualified: false };
}
export function clockObservationCompletionOriginal(receipt) {
  const c = completions.get(receipt);
  if (!c) fail("observation_genuine_H_receipt_UNAVAILABLE");
  const p = clockObservationPlanEvidence(c.plan);
  return { plan: c.plan, p, original: c.original, completion: observationSnapshot(c.original, p.uid).value };
}
export function parseClockObservationEntry(value) {
  const a = data(value);
  if (!Array.isArray(a) || a.length !== 3 || a[0] !== "--clock-observation") fail("observation_fixed_public_arguments");
  return observationArguments(record({ case_id: a[1], root: a[2] }, ["case_id", "root"]));
}
