import { fileURLToPath, pathToFileURL } from "node:url";
import { prepareInspectedMetaStock, prepareLocalInspectedMeta, runAttendedInspectedMeta } from "./inspected-meta-stock.mjs";
import { data } from "./inspected-meta-record.mjs";

/** Fixed entry only; native preparation still enforces every existing case gate. */
export async function runMetaAttendedEntry(argv) {
  argv = data(argv);
  if (!Array.isArray(argv) || argv.length !== 3 ||
    !["--native", "--local-h1", "--local-h2", "--local-owner-stop"].includes(argv[0]) ||
    typeof argv[1] !== "string" || !argv[1].startsWith("/") ||
    !/^[a-f0-9]{64}$/.test(argv[2])) throw new Error("fixed_attended_reference_arguments");
  const options = { manifest_path: argv[1], manifest_sha256: argv[2] };
  const plan = argv[0] === "--native" ? prepareInspectedMetaStock(options) : prepareLocalInspectedMeta(options);
  return runAttendedInspectedMeta(plan);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv[1] !== fileURLToPath(import.meta.url)) throw new Error("fixed_attended_reference_entry");
  const result = await runMetaAttendedEntry(process.argv.slice(2));
  process.stdout.write(JSON.stringify({
    producer_exit_code: result.producer_exit_code, command_exit_observed: false,
    native_qualification: false,
  }) + "\n");
  process.exitCode = result.producer_exit_code;
}
