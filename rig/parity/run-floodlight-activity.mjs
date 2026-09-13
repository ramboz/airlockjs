// npm run parity:floodlight-activity — spec 046-02 AC3. One command: fixture -> ctx-source (auiddc
// from the fixture's _gcl_au cookie, REUSED from google-ads/cookies.js) -> replay (the real
// Floodlight connector, selecting the ;-delimited activity beacon) -> matrix-path flatten -> oracle
// (the SAME diffParity engine, floodlight-activity descriptor) -> report. Exits non-zero on any
// divergent field or any field dropped OUTSIDE the descriptor's gap map; green when the DC activity
// beacon matches. No browser, no network — the fixture is a committed, redacted, real-shaped capture
// (R5) and replay runs airlock's real connector in-process.
//
// Usage:
//   npm run parity:floodlight-activity
//   PARITY_FLOODLIGHT_ACTIVITY_FIXTURE=/path/to/other-redacted-fixture.json npm run parity:floodlight-activity
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { floodlightActivityParityDescriptor } from "./descriptors/floodlight-activity.js";
import { replayFloodlightActivityEgress } from "./floodlight-activity-replay.js";
import { buildParityReport, verdictExitCode } from "./report.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_FIXTURE = join(HERE, "../../test/fixtures/parity-floodlight-activity.redacted.json");
const FIXTURE_PATH = process.env.PARITY_FLOODLIGHT_ACTIVITY_FIXTURE || DEFAULT_FIXTURE;

function main() {
  const fixture = JSON.parse(readFileSync(FIXTURE_PATH, "utf8"));
  const { emitted, fields: airlockFields } = replayFloodlightActivityEgress({ fixture });

  const report = buildParityReport({
    descriptor: floodlightActivityParityDescriptor,
    fixture: FIXTURE_PATH,
    containerFields: fixture.container_fields,
    airlockFields,
    emitted,
  });

  console.log(JSON.stringify(report, null, 2));
  process.exitCode = verdictExitCode(report);
}

main();
