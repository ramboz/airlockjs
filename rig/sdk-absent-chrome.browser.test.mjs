import { mkdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { expect, it } from "vitest";
import { runSdkAbsentChromePreexec } from "./sdk-absent-chrome-runtime.mjs";
import { sdkAbsentChromeReadiness } from "./sdk-absent-chrome-preexec.mjs";
import { inspectSdkAbsentChromeCompletion } from "./sdk-absent-chrome-completion.mjs";

// These controls are deliberately NOT executed by pure validation. Separate
// parent GO, current source closure and resource coordination precede opt-in.
const enabled = process.env.AIRLOCK_RUN_SDK_ABSENT_CHROME === "explicit-sdk-absent-only";
for (const control of ["normal", "pre-return-abort"]) {
  it.runIf(enabled)("ACTUAL SDK-ABSENT real Chrome " + control, async () => {
    // Fail BEFORE allocation, even on accidental opt-in. The current source
    // has no supported exhaustive owned-descendant termination boundary.
    const readiness = sdkAbsentChromeReadiness();
    expect(readiness.ready, readiness.blocked_predicate).toBe(true);
    const parent = resolve("rig/out/sdk-absent-chrome-actual");
    mkdirSync(parent, { recursive: true, mode: 0o700 });
    const outputDir = join(parent, control + "-" + Date.now());
    const start = performance.now();
    const result = await runSdkAbsentChromePreexec({ outputDir, control });
    expect(performance.now() - start).toBeLessThan(45000);
    expect(result.errors).toEqual([]);
    expect(result.qualified).toBe(false);
    expect(result.control_witnessed).toBe(false);
    expect(result.acquisition_control_observed).toBe(true);
    expect(inspectSdkAbsentChromeCompletion({ outputDir, completion: null }))
      .toMatchObject({ qualified: false, reason: "external_completion_missing" });
    expect(result.resource_complete).toBe(true);
    expect(result.native_qualified).toBe(false);
    expect(result.sdk_executions).toBe(0);
    expect(result.explicit_provider_operations).toBe(0);
    expect(JSON.parse(readFileSync(join(outputDir, "result.json")))).toEqual(result);
    if (control === "normal") {
      expect(result.normal_cdp).toBe(true);
      expect(result.browser_server_returned).toBe(true);
    } else {
      expect(result.normal_cdp).toBe(false);
      expect(result.browser_server_returned).toBe(false);
      expect(result.pre_return_abort).toMatchObject({ engine_stopped_before_exec_ready: true,
        actual_chrome_while_engine_stopped: true, post_stop_descriptor_query: false });
    }
  }, 45000);
}
