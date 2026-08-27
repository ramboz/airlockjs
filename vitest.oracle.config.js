// Dedicated config for `npm run test:oracle` — runs ONLY the oracle
// gate-flip meta-test (test/oracle-ga4.test.js), which the default
// vitest.config.js excludes from `npm test` / score_vitest (slice 007-01
// blocker fix; see vitest.config.js for the why). Overriding `include`
// (rather than relying on an explicit CLI path) means this file is the only
// one this config run will ever pick up, regardless of how it's invoked.
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/oracle-ga4.test.js"],
  },
});
