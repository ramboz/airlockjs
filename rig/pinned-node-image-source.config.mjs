import { defineConfig } from "vitest/config";

// Deliberately not a *.test.mjs file: only this explicit SOURCE suite collects it.
export default defineConfig({
  test: {
    include: ["rig/pinned-node-image-source.mjs"],
    fileParallelism: false,
    maxWorkers: 1,
  },
});
