import process from "node:process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { binding, clockState, domain, sample } from "./sdk-absent-clock-observation-protocol.mjs";
import { fail } from "./sdk-absent-clock-observation-io.mjs";
import { requireClockObservationImage } from "./sdk-absent-clock-observation-admission.mjs";

export async function runClockObservationInit() {
  const clock = clockState("I"), tau0 = sample(clock);
  if (process.platform !== "linux" || process.arch !== "arm64" || process.pid !== 1
    || process.version !== "v24.10.0" || process.argv.length !== 2
    || process.argv[1] !== "/airlock/sdk-absent-clock-observation-init.mjs") fail("observation_fixed_init_context");
  requireClockObservationImage();
  const e = process.env, b = binding({ case_id: e.AIRLOCK_OBSERVATION_CASE, run_id: e.AIRLOCK_OBSERVATION_RUN,
    nonce: e.AIRLOCK_OBSERVATION_NONCE, ticket: e.AIRLOCK_OBSERVATION_TICKET,
    source_sha256: e.AIRLOCK_OBSERVATION_SOURCE, cohort_sha256: e.AIRLOCK_OBSERVATION_COHORT });
  const allowed = ["PATH", "NODE_VERSION", "YARN_VERSION", "HOSTNAME", "HOME", "AIRLOCK_OBSERVATION_CASE", "AIRLOCK_OBSERVATION_RUN",
    "AIRLOCK_OBSERVATION_NONCE", "AIRLOCK_OBSERVATION_TICKET", "AIRLOCK_OBSERVATION_SOURCE",
    "AIRLOCK_OBSERVATION_COHORT", "AIRLOCK_OBSERVATION_IMAGE", "AIRLOCK_OBSERVATION_ENGINE"];
  if (Object.keys(e).length !== allowed.length || Object.keys(e).some(k => !allowed.includes(k))
    || e.PATH !== "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin" || e.NODE_VERSION !== "24.10.0"
    || e.YARN_VERSION !== "1.22.22"
    || e.HOSTNAME !== "airlock-clock-" + b.case_id || e.HOME !== "/case")
    fail("observation_fixed_init_environment");
  if (b.nonce === null || typeof e.AIRLOCK_OBSERVATION_IMAGE !== "string" || !/^sha256:[a-f0-9]{64}$/.test(e.AIRLOCK_OBSERVATION_IMAGE)
    || typeof e.AIRLOCK_OBSERVATION_ENGINE !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(e.AIRLOCK_OBSERVATION_ENGINE))
    fail("observation_init_binding");
  const common = { role: "I", binding: b, domain: domain("I"), unit: "ns", tau0_ns: tau0,
    image_id: e.AIRLOCK_OBSERVATION_IMAGE, engine_id: e.AIRLOCK_OBSERVATION_ENGINE };
  const emit = async value => {
    const bytes = JSON.stringify(value) + "\n";
    if (Buffer.byteLength(bytes) > 4096) fail("observation_init_frame_bound");
    await new Promise((resolveWrite, reject) => process.stdout.write(bytes, e => e ? reject(e) : resolveWrite()));
  };
  await emit({ schema: "airlock.clock-observation-init-hello.v1", ...common, hello_ns: sample(clock) });
  await emit({ schema: "airlock.clock-observation-init-clock.v1", ...common, sequence: 1, sample_ns: sample(clock) });
  // There is deliberately NO input reader, ARM/WORK handler, payload, fork,
  // listener, network client or child-process import in this program.
  process.exit(0);
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  runClockObservationInit().catch(e => { process.stderr.write(e.message + "\n"); process.exitCode = 2; });
}
