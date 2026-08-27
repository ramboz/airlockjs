import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Slice 007-01 AC1/AC2 (ga4_mp_conformance, servo-unattended gate): oracle.sh's
// score_ga4_mp_conformance() wraps contracts/validate.mjs as a BINARY 1.0/0.0
// score, registered in COMPONENTS with THRESHOLD=1.0 (AND-gate, spec.md
// Overview) — so a single broken golden fixture flips the composite verdict
// red (`bash oracle.sh` exits non-zero), not just dilutes a weighted mean.
//
// This file is excluded from the default `npm test` / score_vitest suite
// (see vitest.config.js) and instead run standalone via `npm run test:oracle`
// (vitest.oracle.config.js). It shells out to `bash oracle.sh`, which itself
// runs score_vitest -> `vitest run` over the DEFAULT suite — since that
// default suite excludes this file, there is no self-recursion, and this
// test never mutates the golden fixture it's judging on the primary
// (`bash oracle.sh`) path.
const repoRoot = fileURLToPath(new URL("..", import.meta.url));
// custom-event golden: exercised ONLY by contracts/validate.mjs (no vitest
// conformance test reads it), so breaking it isolates the demonstration to
// score_ga4_mp_conformance — it must NOT be a golden any vitest test also
// checks, or a break there would confound which component actually caught it.
const goldenPath = fileURLToPath(
  new URL("../contracts/fixtures/ga4-mp-custom-event.golden.json", import.meta.url),
);

const runOracle = () => {
  try {
    execFileSync("bash", ["oracle.sh"], {
      cwd: repoRoot,
      stdio: "pipe",
    });
    return 0;
  } catch (err) {
    return err.status;
  }
};

describe("oracle.sh — ga4_mp_conformance gate (007-01)", () => {
  it("exits 0 (composite==1.0) on a clean tree", () => {
    expect(runOracle()).toBe(0);
  });

  it("exits non-zero when a golden fixture is broken, and is restorable", () => {
    const original = readFileSync(goldenPath, "utf8");
    try {
      const broken = JSON.parse(original);
      delete broken.client_id; // required field — schema MUST reject this
      writeFileSync(goldenPath, JSON.stringify(broken, null, 2));

      const rc = runOracle();
      expect(rc).toBe(1); // score_ga4_mp_conformance -> 0.0 -> composite < THRESHOLD=1.0
    } finally {
      writeFileSync(goldenPath, original);
    }

    // restored: the gate is green again
    expect(runOracle()).toBe(0);
  });
});

describe("contracts/mp-live-check.mjs — non-blocking live complement (007-01 AC3)", () => {
  it("self-skips with exit 0 when no endpoint is configured, and does not affect oracle.sh", () => {
    // Explicitly unset the live-check env vars so a developer with real
    // GA4_MEASUREMENT_ID/GA4_API_SECRET exported doesn't cause this to POST
    // to the real GA4 endpoint (007-01 review nit — hermeticity).
    const env = { ...process.env };
    delete env.GA4_MEASUREMENT_ID;
    delete env.GA4_API_SECRET;

    const out = execFileSync("node", ["mp-live-check.mjs"], {
      cwd: fileURLToPath(new URL("../contracts", import.meta.url)),
      stdio: "pipe",
      env,
    }).toString();

    expect(out).toMatch(/live check skipped \(no endpoint configured\)/);
    expect(runOracle()).toBe(0); // oracle verdict unchanged
  });
});
