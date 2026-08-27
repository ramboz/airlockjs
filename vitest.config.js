// Default vitest config for `npm test` / `vitest run` (no --config flag) —
// this is exactly what oracle.sh's score_vitest invokes.
//
// Slice 007-01 blocker fix: test/oracle-ga4.test.js is the oracle's own
// gate-flip meta-test. It mutates a committed golden fixture and shells out
// to `bash oracle.sh` to prove the gate can fail. If that file ran INSIDE
// this default suite, then `bash oracle.sh` -> score_vitest -> `vitest run`
// would re-discover it, causing the gate to mutate the very tree it is
// judging (a kill between the fixture write and its `finally` restore would
// leave the golden corrupted) and to multiply one gate run into ~5x suite
// executions. Excluding it here keeps the default suite (and thus
// score_vitest) free of any test that shells out to oracle.sh. Run the
// meta-test on its own via `npm run test:oracle`
// (see vitest.oracle.config.js).
import { defineConfig, configDefaults } from "vitest/config";

export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, "test/oracle-ga4.test.js"],
  },
});
