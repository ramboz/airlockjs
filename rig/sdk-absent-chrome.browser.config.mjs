import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["rig/sdk-absent-chrome.browser.test.mjs"],
    maxWorkers: 1, fileParallelism: false, sequence: { concurrent: false, shuffle: false }, bail: 1,
    testTimeout: 45000, hookTimeout: 45000,
  },
});
