import process from "node:process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { observeClockObservation, parseClockObservationEntry } from "./sdk-absent-clock-observation-observer.mjs";

export function runClockObservationEntry(argv) {
  return observeClockObservation(parseClockObservationEntry(argv));
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  runClockObservationEntry(process.argv.slice(2)).then(result => {
    process.stdout.write(JSON.stringify({ disposition: result.status, errors: result.errors, observation_valid: false,
      qualified_clock: false, workload_admission: false, native_qualified: false }) + "\n");
    process.exitCode = result.status === "UNKNOWN" ? 2 : 0;
  }).catch(e => { process.stderr.write(e.message + "\n"); process.exitCode = 2; });
}
