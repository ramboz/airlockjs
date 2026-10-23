import process from "node:process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { data } from "./inspected-meta-record.mjs";
import { digest, fail, observationRead, observationSnapshot } from "./sdk-absent-clock-observation-io.mjs";
import { publishClockHostOriginal as observationWrite } from "./sdk-absent-clock-host-io.mjs";
import { clockState, ns, sample } from "./sdk-absent-clock-observation-protocol.mjs";
import { hostBinding, hostFixturePid, hostMessage, hostOriginalRequest } from "./sdk-absent-clock-host-protocol.mjs";
import { HOST_TARGET } from "./sdk-absent-clock-host-plan.mjs";

// Fixed first-party publisher only: no process creation, network, SDK, browser,
// selectable callbacks, ARM, WORK or signal operation exists in this fixture.
export async function runClockHostFixture(value) {
  const clock = clockState("HOST_FIXTURE"), tau0 = sample(clock), parent = process.ppid;
  const fixturePid = hostFixturePid(process.pid);
  let lost = false, finished = false, acknowledged = false, violation = null, rejectAck;
  const stop = () => {
    lost = true;
    if (!finished) {
      rejectAck?.(Error("host_fixture_parent_lost"));
      process.exit(70);
    }
  };
  const watchdog = setTimeout(() => {
    lost = true; rejectAck?.(Error("host_fixture_self_watchdog")); process.exit(70);
  }, 5000);
  process.on("disconnect", stop);
  const alive = () => {
    if (lost || !process.connected || process.ppid !== parent || process.pid !== fixturePid || parent <= 1 || violation
      || ns(sample(clock)) - ns(tau0) >= 5000000000n) fail(violation ?? "host_fixture_lifetime_not_owned");
  };
  let onMessage;
  try {
    const argv = data(value);
    if (!Array.isArray(argv) || argv.length !== 3 || argv[0] !== "--fixed-host-fixture"
      || typeof argv[1] !== "string" || !digest(argv[2]) || typeof process.send !== "function")
      fail("host_fixture_direct_call_refused");
    alive();
    const request = observationRead(argv[1], { maximum: 65536 }).handle;
    if (request.sha256 !== argv[2]) fail("host_fixture_request_hash_changed");
    const r = hostOriginalRequest(request);
    const hello = { schema: "airlock.clock-host-hello.v1", target: HOST_TARGET,
      binding: hostBinding(r), request, fixture_pid: fixturePid, tau0_ns: tau0, hello_ns: sample(clock) };
    let ackAt;
    await new Promise((resolveAck, reject) => {
      rejectAck = reject;
      onMessage = raw => {
        try {
          if (acknowledged) fail("host_fixture_duplicate_ACK");
          const m = hostMessage(raw, "airlock.clock-host-ack.v1", r, request, ["type", "fixture_pid"]);
          if (m.type !== "NO_WORK_ACK" || hostFixturePid(m.fixture_pid) !== fixturePid)
            fail("host_fixture_only_owned_pid_no_work_ACK");
          alive(); hostOriginalRequest(request); alive();
          acknowledged = true; ackAt = sample(clock); resolveAck();
        } catch (e) { violation = e.message; reject(e); }
      };
      process.on("message", onMessage);
      alive();
      process.send(hello, e => {
        if (e) { violation = "host_fixture_HELLO_failed"; reject(Error(violation)); }
      });
    });
    alive(); hostOriginalRequest(request);
    alive(); // Blocking validation can outlast the watchdog or parent lifetime.
    const output = observationWrite(r.root, "fixture-output.json", {
      schema: "airlock.clock-host-output.v1", target: HOST_TARGET, binding: hostBinding(r), request,
      fixture_pid: fixturePid,
      outcome: r.control === "normal" ? "normal" : "explicit_failed_child_control",
      tau0_ns: tau0, ack_received_ns: ackAt, before_publication_ns: sample(clock),
    }, r.uid);
    const published = sample(clock);
    alive(); hostOriginalRequest(request); observationSnapshot(output, r.uid);
    alive();
    await new Promise((resolveSend, reject) => {
      process.send({ schema: "airlock.clock-host-result.v1", target: HOST_TARGET, binding: hostBinding(r),
        request, file: output, fixture_pid: fixturePid, published_ns: published }, e => {
        if (e) reject(Error("host_fixture_RESULT_failed")); else resolveSend();
      });
    });
    alive(); hostOriginalRequest(request); observationSnapshot(output, r.uid);
    alive();
    // This witnesses completed validation, not the child's future exit.
    await new Promise((resolveSend, reject) => {
      const completed = sample(clock);
      alive();
      process.send({ schema: "airlock.clock-host-complete.v1", target: HOST_TARGET, binding: hostBinding(r),
        request, file: output, fixture_pid: fixturePid, completed_ns: completed }, e => {
        if (e) reject(Error("host_fixture_COMPLETE_failed")); else resolveSend();
      });
    });
    alive();
    process.exitCode = r.control === "normal" ? 0 : 2;
    finished = true;
    process.disconnect();
    return output;
  } finally {
    clearTimeout(watchdog);
    process.removeListener("disconnect", stop);
    if (onMessage) process.removeListener("message", onMessage);
  }
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  runClockHostFixture(process.argv.slice(2)).catch(() => {
    process.exitCode = 70;
    if (process.connected) process.disconnect();
  });
}
