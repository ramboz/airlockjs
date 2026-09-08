// npm run parity:ga4 — spec 038-02 AC7. One command: fixture -> ctx-source (AC1) -> replay
// (mapToMp/mpUrl) -> flatten (AC3) -> oracle (SAME diffParity engine, GA4 descriptor) -> report.
// Exits non-zero on any divergent field or any field dropped OUTSIDE the descriptor's gap map;
// green when only owned gaps (ADR-0020, owner spec 039) are dropped. No browser, no network — the
// fixture is a committed, redacted, real-shaped capture (R5) and replay runs airlock's real GA4
// `mapToMp`/`mpUrl` in-process.
//
// Usage:
//   npm run parity:ga4
//   PARITY_GA4_FIXTURE=/path/to/other-redacted-fixture.json npm run parity:ga4
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { ga4ParityDescriptor } from "./descriptors/ga4.js";
import { replayGa4Egress } from "./ga4-replay.js";
import { buildGa4ParityReport } from "./report-ga4.js";
import { verdictExitCode } from "./report.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_FIXTURE = join(HERE, "../../test/fixtures/parity-ga4-collect.redacted.json");
const FIXTURE_PATH = process.env.PARITY_GA4_FIXTURE || DEFAULT_FIXTURE;

async function main() {
  const fixture = JSON.parse(readFileSync(FIXTURE_PATH, "utf8"));
  // AC1/AC3 replay is factored into ga4-replay.js so the CLI + tests share ONE pipeline and
  // `emitted` is derived (ctx from the fixture's cookies, never the beacon's cid/sid).
  const { emitted, fields: airlockFields } = await replayGa4Egress({ fixture });

  const report = buildGa4ParityReport({
    descriptor: ga4ParityDescriptor,
    fixture: FIXTURE_PATH,
    containerFields: fixture.container_fields,
    airlockFields,
    emitted,
  });

  console.log(JSON.stringify(report, null, 2));
  process.exitCode = verdictExitCode(report);
}

main();
