// npm run parity:google-ads — spec 044-01 AC4. One command: fixture -> ctx-source (auid from the
// fixture's _gcl_au cookie) -> replay (the real Google Ads connector) -> flatten -> oracle (the
// SAME diffParity engine, AW descriptor) -> report. Exits non-zero on any divergent field or any
// field dropped OUTSIDE the descriptor's gap map; green when the AW ccm/collect beacon matches. No
// browser, no network — the fixture is a committed, redacted, real-shaped capture (R5) and replay
// runs airlock's real connector in-process.
//
// Usage:
//   npm run parity:google-ads
//   PARITY_GOOGLE_ADS_FIXTURE=/path/to/other-redacted-fixture.json npm run parity:google-ads
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { googleAdsParityDescriptor } from "./descriptors/google-ads.js";
import { replayGoogleAdsEgress } from "./google-ads-replay.js";
import { buildParityReport, verdictExitCode } from "./report.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_FIXTURE = join(HERE, "../../test/fixtures/parity-google-ads-ccm.redacted.json");
const FIXTURE_PATH = process.env.PARITY_GOOGLE_ADS_FIXTURE || DEFAULT_FIXTURE;

function main() {
  const fixture = JSON.parse(readFileSync(FIXTURE_PATH, "utf8"));
  const { emitted, fields: airlockFields } = replayGoogleAdsEgress({ fixture });

  const report = buildParityReport({
    descriptor: googleAdsParityDescriptor,
    fixture: FIXTURE_PATH,
    containerFields: fixture.container_fields,
    airlockFields,
    emitted,
  });

  console.log(JSON.stringify(report, null, 2));
  process.exitCode = verdictExitCode(report);
}

main();
