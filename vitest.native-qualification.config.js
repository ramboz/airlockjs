import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["rig/native-tag-qualification.test.mjs", "rig/native-tag-reference.test.mjs"],
    testTimeout: 120000,
    hookTimeout: 30000,
  },
});
