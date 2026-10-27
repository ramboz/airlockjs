import { pathToFileURL } from "node:url";
import { stopMetaAttendedCase, stopMetaAttendedManifest } from "./meta-attended-control.mjs";
import { data } from "./inspected-meta-record.mjs";

export async function runMetaAttendedStopEntry(argv) {
  argv = data(argv);
  if (!Array.isArray(argv) || argv.length !== 3 || !["--stop", "--stop-manifest"].includes(argv[0]) ||
    typeof argv[1] !== "string" || !argv[1].startsWith("/") ||
    !/^[a-f0-9]{64}$/.test(argv[2])) throw new Error("fixed_attended_stop_arguments");
  return argv[0] === "--stop"
    ? stopMetaAttendedCase({ control_path: argv[1], control_sha256: argv[2] })
    : stopMetaAttendedManifest({ manifest_path: argv[1], manifest_sha256: argv[2] });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await runMetaAttendedStopEntry(process.argv.slice(2));
  process.stdout.write(JSON.stringify({ status: result.status, native_qualification: false }) + "\n");
  process.exitCode = result.status === "stopped" ? 0 : 2;
}
