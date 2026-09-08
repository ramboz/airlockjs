// npm run parity:meta — spec 038-01 AC6. One command: fixture -> replay -> oracle -> report.
// Exits non-zero on any divergent field or any field dropped OUTSIDE the descriptor's gap map;
// green when only owned gaps (ADR-0020) are dropped. No browser, no network — the fixture is a
// committed, redacted, real-shaped capture (R5) and replay runs airlock's real Meta connector
// in-process.
//
// Usage:
//   npm run parity:meta
//   PARITY_META_FIXTURE=/path/to/other-redacted-fixture.json npm run parity:meta
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { createMetaPixelConfig, SYNTHETIC_META_PIXEL_ID } from "../../connectors/pixel/vendors/meta.js";
import { metaParityDescriptor } from "./descriptors/meta.js";
import { replayPixelBeacon } from "./replay.js";
import { buildParityReport, verdictExitCode } from "./report.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_FIXTURE = join(HERE, "../../test/fixtures/parity-meta-tr.redacted.json");
const FIXTURE_PATH = process.env.PARITY_META_FIXTURE || DEFAULT_FIXTURE;

function main() {
  const fixture = JSON.parse(readFileSync(FIXTURE_PATH, "utf8"));
  const containerFields = fixture.container_fields;

  const logicalEvent = metaParityDescriptor.deriveLogicalEvent(containerFields);
  const config = createMetaPixelConfig({ pixelId: SYNTHETIC_META_PIXEL_ID });
  const { emitted, fields: airlockFields } = replayPixelBeacon(config, logicalEvent);

  const report = buildParityReport({
    descriptor: metaParityDescriptor,
    fixture: FIXTURE_PATH,
    containerFields,
    airlockFields,
    emitted,
  });

  console.log(JSON.stringify(report, null, 2));
  process.exitCode = verdictExitCode(report);
}

main();
