// npm run parity:transport — spec 038-03. Prints the per-vendor x per-cohort transport-parity
// ledger (JSON + a readable Markdown table) that feeds ADR-0018 E10. A REPORT, not a gate: unlike
// parity:meta / parity:ga4 there is no pass/fail verdict here (whether to close a gap is E10's
// call, ADR-0020 commitment 3, "made visible, never absorbed") — so this CLI always exits 0. No
// browser, no network, no fixture: the ledger is reasoned entirely off each descriptor's own
// declarative `transport` field + `gapMap`.
//
// Usage:
//   npm run parity:transport
import { metaParityDescriptor } from "./descriptors/meta.js";
import { ga4ParityDescriptor } from "./descriptors/ga4.js";
import { buildTransportLedger, renderTransportMarkdown } from "./transport-report.js";

function main() {
  const ledger = buildTransportLedger({ descriptors: [metaParityDescriptor, ga4ParityDescriptor] });
  console.log(JSON.stringify(ledger, null, 2));
  console.log("");
  console.log(renderTransportMarkdown(ledger));
}

main();
