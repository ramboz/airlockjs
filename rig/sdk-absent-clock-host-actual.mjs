import { randomBytes } from "node:crypto";
import { closeSync, fsyncSync, mkdirSync, openSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";
import { observationDirectory, observationSnapshot } from "./sdk-absent-clock-observation-io.mjs";
import { publishClockHostOriginal as observationWrite } from "./sdk-absent-clock-host-io.mjs";
import { prepareClockHostPlan } from "./sdk-absent-clock-host-plan.mjs";
import { observeClockHostControl } from "./sdk-absent-clock-host-observer.mjs";
import { inspectClockHostControl } from "./sdk-absent-clock-host-reader.mjs";

// NOT EXECUTED during source implementation. No environment switch enables it.
// Parent must create the exclusive 0700 base after source review, current
// coordination and explicit GO. Keep every original; no cleanup/retry here.
const base = resolve("rig/out/PRIVATEA/059-18-clock-host-actual-v1");
it.each(["normal", "failed-child"])("pending opt-in actual fixed host control: %s", async control => {
  const uid = process.getuid(), nonce = randomBytes(32).toString("hex");
  const case_id = "host-" + control, root = base + "/" + case_id;
  observationDirectory(base, uid);
  // Parent issues the case/root/nonce before this first allocation. Existing
  // case directories fail instead of silently generating a replacement run.
  mkdirSync(root, { mode: 0o700 });
  const fd = openSync(base, "r");
  try { fsyncSync(fd); } finally { closeSync(fd); }
  const plan = prepareClockHostPlan({ root, case_id, nonce, control });
  const result = await observeClockHostControl(plan);
  expect(result.status).toBe("HOST_FIXTURE_CANDIDATE");
  const inspected = inspectClockHostControl(result.completion);
  expect(inspected).toMatchObject({ host_mechanics_candidate: true, host_qualified: false,
    outer_tool_close_required: true, observation_valid: false, qualified_clock: false,
    workload_admission: false, native_qualified: false });
  observationSnapshot(inspected.original, uid); observationSnapshot(inspected.fixture_original, uid);
  observationWrite(root, "pending-outer-tool-close.json", {
    schema: "airlock.clock-host-pending-tool-close.v1", ...inspected,
    actual_tool_close_observed: false, qualification_claimed: false,
  }, uid);
});
