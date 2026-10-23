import { equal, record } from "./inspected-meta-record.mjs";
import { fail, observationSnapshot } from "./sdk-absent-clock-observation-io.mjs";
import { ns } from "./sdk-absent-clock-observation-protocol.mjs";
import { takeClockHostCompletion } from "./sdk-absent-clock-host-observer.mjs";
import { HOST_TARGET } from "./sdk-absent-clock-host-plan.mjs";
import { hostBeforeDeadline, hostBinding, hostFixturePid, hostMessage } from "./sdk-absent-clock-host-protocol.mjs";

// Independent of the fixture publisher. Only the actual observer's private,
// one-use close capability can enter; recorded JSON is never a capability.
export function inspectClockHostControl(receipt) {
  const { p, original, value: v, fixture_pid: fixturePid, issuance } = takeClockHostCompletion(receipt);
  if (v.schema !== "airlock.clock-host-close.v1" || v.target !== HOST_TARGET
    || !equal(v.binding, hostBinding(p)) || !v.outer_tool_close_required
    || v.fixture_pid !== hostFixturePid(fixturePid) || !equal(v.issuance, issuance)) fail("host_completion_binding_changed");
  const issued = record(observationSnapshot(issuance, p.uid).value,
    ["schema", "target", "binding", "registration", "request", "fixture_pid", "issued_ns", "handle_observed_ns"]);
  if (issued.schema !== "airlock.clock-host-issued.v1" || issued.target !== HOST_TARGET
    || !equal(issued.binding, hostBinding(p)) || issued.fixture_pid !== fixturePid || issued.issued_ns !== v.issued_ns
    || !equal(issued.registration, v.registration) || !equal(issued.request, v.request)
    || ns(issued.handle_observed_ns) < ns(issued.issued_ns)) fail("host_reader_owned_pid_issuance_changed");
  const valid = v.errors.length === 0;
  if (valid) {
    const registration = observationSnapshot(v.registration, p.uid).value;
    const start = registration.original_start_ns, close = v.close, code = p.control === "normal" ? 0 : 2;
    if (!v.exit || v.exit.code !== code || v.exit.signal !== null || close.code !== code || close.signal !== null
      || !close.ipc_settled || close.pending_sends || !v.candidate || !v.completion || close.messages.length !== 3
      || v.exit.fixture_pid !== fixturePid || v.hello.fixture_pid !== fixturePid || v.candidate.fixture_pid !== fixturePid
      || !equal(close.messages.map(m => m.value), [v.hello, v.candidate, v.completion])
      || !close.eof.stdout || !close.eof.stderr
      || !close.closed.stdout || !close.closed.stderr || !close.closed.stdin)
      fail("host_complete_command_originals_required");
    hostBeforeDeadline(start, close.actual_close_ns); hostBeforeDeadline(start, close.streams_settled_ns);
    const completed = hostMessage(v.completion, "airlock.clock-host-complete.v1", p, v.request,
      ["file", "fixture_pid", "completed_ns"]);
    if (hostFixturePid(completed.fixture_pid) !== fixturePid || !equal(completed.file, v.candidate.file)
      || ns(completed.completed_ns) < ns(v.candidate.published_ns)
      || ns(completed.completed_ns) - ns(v.hello.tau0_ns) >= 5000000000n) fail("host_reader_validation_completion_required");
    const out = record(observationSnapshot(v.candidate.file, p.uid).value,
      ["schema", "target", "binding", "request", "fixture_pid", "outcome", "tau0_ns", "ack_received_ns", "before_publication_ns"]);
    if (out.schema !== "airlock.clock-host-output.v1" || out.target !== HOST_TARGET
      || !equal(out.binding, hostBinding(p)) || !equal(out.request, v.request) || hostFixturePid(out.fixture_pid) !== fixturePid
      || out.outcome !== (p.control === "normal" ? "normal" : "explicit_failed_child_control")
      || out.tau0_ns !== v.hello.tau0_ns || ns(out.ack_received_ns) < ns(v.hello.hello_ns)
      || ns(out.before_publication_ns) < ns(out.ack_received_ns)
      || ns(v.candidate.published_ns) < ns(out.before_publication_ns)) fail("host_exact_fixture_output_required");
  }
  return {
    target: HOST_TARGET, control: p.control, fixture_pid: fixturePid, issuance, host_mechanics_candidate: valid,
    original: original.handle, fixture_original: v.candidate?.file ?? null,
    outer_tool_close_required: true, host_qualified: false,
    observation_valid: false, qualified_clock: false, workload_admission: false, native_qualified: false,
    errors: [...v.errors],
  };
}
