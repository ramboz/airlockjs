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
    // full `vitest run` over the default suite. On a slow/loaded CI runner one
    // oracle.sh run is 16-32s, and the gate-flip test does TWO back-to-back
    // (break fixture → run → restore → run), so a single test can approach a
    // minute. 120s keeps a comfortable margin as the suite grows while staying
    // far under the job's 15-min budget, so a genuine hang is still caught.
    // NOTE: the test awaits execFile (not execFileSync) precisely so this
    // per-test timeout — not vitest's fixed 60s worker-RPC ceiling — is the
    // only clock that governs it; see the runOracle() comment in the test.
    testTimeout: 120000,
  },
});
