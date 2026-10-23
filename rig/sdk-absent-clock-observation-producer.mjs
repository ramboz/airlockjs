import process from "node:process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { clockState, finishActor, loadActor, receiveBudget, sample, writeActorRequest } from "./sdk-absent-clock-observation-protocol.mjs";
import { observeFixedClockActor } from "./sdk-absent-clock-observation-streams.mjs";

export async function runClockObservationProducer(argv) {
  const clock = clockState("P"), tau0 = sample(clock);
  const state = await receiveBudget(loadActor(argv, "P", clock, tau0));
  const request = writeActorRequest(state.plan, "S", state.binding, state.request_file);
  const child = await observeFixedClockActor(state, "S", state.binding, request);
  return finishActor(state, { supervisor_close: child.file });
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  runClockObservationProducer(process.argv.slice(2)).catch(e => { process.stderr.write(e.message + "\n"); process.exitCode = 2; });
}
