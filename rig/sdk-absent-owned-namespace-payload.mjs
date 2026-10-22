// Fixed first-party control only; no SDK, arbitrary command or host PID API.
import process from "node:process";
import { spawn } from "node:child_process";
import { performance } from "node:perf_hooks";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { record } from "./inspected-meta-record.mjs";
import { assertOwnedNamespacePayloadContext } from "./sdk-absent-owned-namespace-image-admission.mjs";

const SELF = fileURLToPath(import.meta.url);
export function runOwnedNamespacePayload(value) {
  if (!Array.isArray(value) || value.length !== 2
    || !["normal", "late-detached-orphan", "late-parent", "orphan"].includes(value[0])
    || !/^[1-9][0-9]{0,4}$/.test(value[1]) || Number(value[1]) > 35000) throw Error("namespace_fixed_payload_arguments");
  const context = record(assertOwnedNamespacePayloadContext(), ["case_id", "nonce"]);
  const childEnv = { PATH: "/usr/local/bin:/usr/bin:/bin", AIRLOCK_CASE: context.case_id, AIRLOCK_NONCE: context.nonce };
  const [control, duration] = value, started = performance.now(), remaining = Number(duration);
  if (control === "normal") {
    process.stdout.write('{"type":"FIRST_PARTY_NORMAL_CANDIDATE","qualified":false}\n');
    return;
  }
  if (control === "late-detached-orphan") {
    setTimeout(() => {
      const left = Math.floor(remaining - (performance.now() - started));
      if (left <= 1) { process.exitCode = 2; return; }
      const parent = spawn("/usr/local/bin/node", [SELF, "late-parent", String(left)], {
        env: childEnv, stdio: ["ignore", "ignore", "ignore"], cwd: "/case",
      });
      parent.on("error", () => { process.exitCode = 2; });
    }, 1);
    return;
  }
  if (control === "late-parent") {
    const orphan = spawn("/usr/local/bin/node", [SELF, "orphan", duration], {
      detached: true, env: childEnv, stdio: "ignore", cwd: "/case",
    });
    orphan.on("error", () => { process.exitCode = 2; });
    orphan.unref();
    return;
  }
  setTimeout(() => {}, remaining);
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try { runOwnedNamespacePayload(process.argv.slice(2)); } catch (error) {
    process.stderr.write(error.message + "\n"); process.exitCode = 2;
  }
}
