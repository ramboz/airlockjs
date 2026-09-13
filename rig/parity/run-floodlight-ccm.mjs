// npm run parity:floodlight-ccm — spec 046-01 AC4. One command: fixture -> ctx-source (auid from the
// fixture's _gcl_au cookie, REUSED from google-ads/cookies.js) -> replay (the real Floodlight
// connector) -> flatten -> oracle (the SAME diffParity engine, floodlight-ccm descriptor) -> report.
// Exits non-zero on any divergent field or any field dropped OUTSIDE the descriptor's gap map; green
// when the DC ccm/collect beacon matches. No browser, no network — the fixture is a committed,
// redacted, real-shaped capture (R5) and replay runs airlock's real connector in-process.
//
// Usage:
//   npm run parity:floodlight-ccm
//   PARITY_FLOODLIGHT_CCM_FIXTURE=/path/to/other-redacted-fixture.json npm run parity:floodlight-ccm
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { floodlightCcmParityDescriptor } from "./descriptors/floodlight-ccm.js";
import { replayFloodlightCcmEgress } from "./floodlight-ccm-replay.js";
import { buildParityReport, verdictExitCode } from "./report.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_FIXTURE = join(HERE, "../../test/fixtures/parity-floodlight-ccm.redacted.json");
const FIXTURE_PATH = process.env.PARITY_FLOODLIGHT_CCM_FIXTURE || DEFAULT_FIXTURE;

function main() {
  const fixture = JSON.parse(readFileSync(FIXTURE_PATH, "utf8"));
  const { emitted, fields: airlockFields } = replayFloodlightCcmEgress({ fixture });

  const report = buildParityReport({
    descriptor: floodlightCcmParityDescriptor,
    fixture: FIXTURE_PATH,
    containerFields: fixture.container_fields,
    airlockFields,
    emitted,
  });

  console.log(JSON.stringify(report, null, 2));
  process.exitCode = verdictExitCode(report);
}

main();
