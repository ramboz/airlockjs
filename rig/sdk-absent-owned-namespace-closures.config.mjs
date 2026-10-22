import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["rig/inspected-meta-stock.test.mjs", "rig/native-stock-capture.test.mjs"],
    setupFiles: ["rig/sdk-absent-owned-namespace-closures.setup.mjs"],
    testNamePattern: /binds the installed twelve-package decoder closure|pins the new journal's entire additional dependency and test closure/,
  },
});
