import { defineConfig } from "vitest/config";

// Deliberately NOT discovered by the default suite or source config. Selecting
// this config is an actual process experiment, requiring separate reviewed GO.
export default defineConfig({
  test: {
    name: "pending-opt-in-fixed-host-controls",
    include: ["rig/sdk-absent-clock-host-actual.mjs"],
    retry: 0, fileParallelism: false, maxWorkers: 1, testTimeout: 55000, hookTimeout: 1000,
  },
});
