import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "clock-observation-pure-pipeline",
          include: [
            "rig/sdk-absent-clock-observation-admission.test.mjs",
            "rig/sdk-absent-clock-observation-pipeline.test.mjs",
            "rig/sdk-absent-owned-namespace-admission.test.mjs",
            "rig/sdk-absent-owned-namespace.test.mjs",
            "rig/sdk-absent-owned-namespace-actors.test.mjs",
            "rig/sdk-absent-owned-namespace-pipeline.test.mjs",
          ],
        },
      },
      {
        test: {
          name: "clock-observation-source-pins",
          include: ["rig/inspected-meta-stock.test.mjs", "rig/native-stock-capture.test.mjs"],
          setupFiles: ["rig/sdk-absent-clock-observation-integration.setup.mjs"],
          testNamePattern: /binds the installed twelve-package decoder closure, not only its entry point|pins the new journal's entire additional dependency and test closure/,
        },
      },
    ],
  },
});
