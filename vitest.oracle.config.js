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
    // Every test here shells out to `bash oracle.sh`, which itself spawns a
    // full `vitest run` over the default suite (~3s each). The gate-flip test
    // does TWO oracle runs back-to-back (break fixture → run → restore → run),
    // so on a slow/loaded CI runner it blows vitest's 5s default (observed
    // 6.2s on ubuntu-latest → CI red). 60s gives ~10x headroom over a real run
    // while staying far under the job's 15-min budget, so a genuine hang is
    // still caught.
    testTimeout: 60000,
  },
});
