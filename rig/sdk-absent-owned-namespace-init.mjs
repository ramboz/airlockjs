// Fixed first-party image entrypoint. Importing this module does nothing.
import process from "node:process";
import { performance } from "node:perf_hooks";
import { createInterface } from "node:readline";
import { spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { json } from "./inspected-meta-record.mjs";
import { fixedRead } from "./sdk-absent-owned-namespace-io.mjs";
import { requireOwnedNamespaceImageClockContract } from "./sdk-absent-owned-namespace-image-admission.mjs";
import { createNamespaceInitModel, namespaceInitArm, namespaceInitHello, namespaceInitWatchdogArmed,
  namespaceInitWork, PREPERMIT_MS } from "./sdk-absent-owned-namespace-time.mjs";

const PAYLOAD = fileURLToPath(new URL("sdk-absent-owned-namespace-payload.mjs", import.meta.url));
const OUTPUT_MAX = 16384;
export function startOwnedNamespaceInit() {
  if (process.platform !== "linux" || process.arch !== "arm64" || process.pid !== 1
    || process.version !== "v24.10.0") throw Error("namespace_fixed_linux_pid1_cohort");
  // This existing gate still always refuses production execution. Source tests
  // mock the boundary, never add a proof format or a positive runtime flag.
  requireOwnedNamespaceImageClockContract();
  const clock = json(fixedRead(fileURLToPath(new URL("sdk-absent-owned-namespace-clock.json", import.meta.url))).bytes);
  return sourceProtocolBody(clock);
}

// Reachable only after the unchanged, currently hard-NO-GO image admission.
function sourceProtocolBody(clock) {
  const tau0 = performance.now();
  const identity = { case_id: process.env.AIRLOCK_CASE, nonce: process.env.AIRLOCK_NONCE };
  const model = createNamespaceInitModel({ ...identity, tau0_ms: tau0, clock });
  let output = 0, child = null, closed = false, watchdog = null;
  const emit = value => {
    const bytes = JSON.stringify(value) + "\n"; output += Buffer.byteLength(bytes);
    if (output > OUTPUT_MAX) return finish(2);
    process.stdout.write(bytes);
  };
  const input = createInterface({ input: process.stdin, crlfDelay: Infinity });
  const prepermit = setTimeout(() => finish(2), Math.max(0, tau0 + PREPERMIT_MS - performance.now()));
  const finish = code => {
    if (closed) return;
    closed = true; clearTimeout(prepermit); if (watchdog) clearTimeout(watchdog);
    input.close();
    // This must be namespace PID1; exit is the proposed kernel boundary, NOT
    // proof of remote daemon cancellation or successful external settlement.
    process.exit(code);
  };
  emit(namespaceInitHello(model, performance.now()));
  input.on("line", line => {
    try {
      if (closed || Buffer.byteLength(line) > 4096) return finish(2);
      const message = json(Buffer.from(line));
      if (message.type === "ARM") {
        const requested = namespaceInitArm(model, message, performance.now());
        watchdog = setTimeout(() => finish(2), Math.max(0, requested.arm_watchdog_until_ms - performance.now()));
        clearTimeout(prepermit);
        // No ARMED can be sent until the kill watchdog has actually been set.
        emit(namespaceInitWatchdogArmed(model, performance.now()));
      } else {
        const work = namespaceInitWork(model, message, performance.now());
        child = spawn("/usr/local/bin/node", [PAYLOAD, work.control,
          String(Math.floor(work.work_deadline_ms - performance.now()))],
        { env: { PATH: "/usr/local/bin:/usr/bin:/bin", AIRLOCK_CASE: identity.case_id, AIRLOCK_NONCE: identity.nonce },
          stdio: ["ignore", "pipe", "pipe"], cwd: "/case" });
        for (const stream of [child.stdout, child.stderr]) stream.on("data", bytes => {
          output += bytes.length;
          if (output > OUTPUT_MAX) finish(2); else process.stdout.write(bytes);
        });
        child.on("error", () => finish(2));
        child.on("close", (code, signal) => {
          emit({ type: "PAYLOAD_CLOSE_CANDIDATE", code, signal, stream_close_observed: true });
          finish(code === 0 && signal === null ? 0 : 2);
        });
      }
    } catch { finish(2); }
  });
  input.on("close", () => { if (!closed) finish(2); });
  input.on("error", () => finish(2));
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try { startOwnedNamespaceInit(); } catch (error) {
    process.stderr.write(JSON.stringify({ status: "UNKNOWN", reason: error.message, qualified: false }) + "\n");
    process.exitCode = 2;
  }
}
