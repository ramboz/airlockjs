// Fixed first-party SOURCE bytes, not a runtime grant or a selectable payload.
// This module is a host dependency; the bare base receives only COMMAND.
export const CLOCK_OBSERVATION_PROGRAM = String.raw`(async () => {
  try {
    if (process.platform !== "linux" || process.arch !== "arm64" || process.version !== "v24.10.0"
      || process.pid !== 1 || process.getuid() !== 65532 || process.getgid() !== 65532
      || process.execPath !== "/usr/local/bin/node" || process.cwd() !== "/"
      || process.argv.length !== 1 || process.argv[0] !== "/usr/local/bin/node"
      || process.execArgv.length !== 3 || process.execArgv[0] !== "--input-type=module"
      || process.execArgv[1] !== "--eval" || typeof process.execArgv[2] !== "string" || !process.execArgv[2].length) {
      process.exit(2); return;
    }
    const e = process.env;
    const allowed = ["PATH", "NODE_VERSION", "YARN_VERSION", "HOSTNAME", "HOME",
      "AIRLOCK_OBSERVATION_CASE", "AIRLOCK_OBSERVATION_RUN", "AIRLOCK_OBSERVATION_NONCE",
      "AIRLOCK_OBSERVATION_TICKET", "AIRLOCK_OBSERVATION_SOURCE", "AIRLOCK_OBSERVATION_COHORT",
      "AIRLOCK_OBSERVATION_IMAGE", "AIRLOCK_OBSERVATION_ENGINE"];
    const digest = v => typeof v === "string" && /^[a-f0-9]{64}$/.test(v);
    const b = { case_id: e.AIRLOCK_OBSERVATION_CASE, run_id: e.AIRLOCK_OBSERVATION_RUN,
      nonce: e.AIRLOCK_OBSERVATION_NONCE, ticket: e.AIRLOCK_OBSERVATION_TICKET,
      source_sha256: e.AIRLOCK_OBSERVATION_SOURCE, cohort_sha256: e.AIRLOCK_OBSERVATION_COHORT };
    if (Object.keys(e).length !== allowed.length || Object.keys(e).some(k => !allowed.includes(k))
      || e.PATH !== "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
      || e.NODE_VERSION !== "24.10.0" || e.YARN_VERSION !== "1.22.22"
      || typeof b.case_id !== "string" || !/^[a-z0-9-]{1,48}$/.test(b.case_id)
      || ![b.run_id, b.nonce, b.ticket, b.source_sha256, b.cohort_sha256].every(digest)
      || e.HOSTNAME !== "airlock-clock-" + b.case_id || e.HOME !== "/"
      || e.AIRLOCK_OBSERVATION_IMAGE !== "sha256:5f6d18c1dffb526f36bc30b85e468daf017dfa9531ef9ab3c57bb0d2c64da5cb"
      || typeof e.AIRLOCK_OBSERVATION_ENGINE !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(e.AIRLOCK_OBSERVATION_ENGINE)) {
      process.exit(2); return;
    }
    let last = null;
    const sample = () => {
      const n = process.hrtime.bigint();
      if (typeof n !== "bigint" || n < 0n || (last !== null && n < last)
        || !/^(0|[1-9][0-9]{0,23})$/.test(n.toString())) throw Error("clock");
      last = n; return n.toString();
    };
    const common = { role: "I", binding: b, domain: "NODE_I_HRTIME_MONOTONIC_NS", unit: "ns",
      tau0_ns: sample(), image_id: e.AIRLOCK_OBSERVATION_IMAGE, engine_id: e.AIRLOCK_OBSERVATION_ENGINE };
    const hello = { schema: "airlock.clock-observation-init-hello.v1", ...common, hello_ns: sample() };
    const clock = { schema: "airlock.clock-observation-init-clock.v1", ...common, sequence: 1, sample_ns: sample() };
    const emit = async value => {
      const line = JSON.stringify(value) + "\n";
      if (line.length > 4096 || /[^\x00-\x7f]/.test(line)) throw Error("frame");
      await new Promise((resolve, reject) => process.stdout.write(line, error => error ? reject(error) : resolve()));
    };
    await emit(hello);
    await emit(clock);
    process.exit(0);
  } catch {
    process.exit(70);
  }
})();`;

export const CLOCK_OBSERVATION_COMMAND = Object.freeze(["--input-type=module", "--eval", CLOCK_OBSERVATION_PROGRAM]);
