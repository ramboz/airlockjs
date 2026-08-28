// Validates the pinned data-shape contracts against their schemas: the hermetic
// half of the ga4_mp_conformance oracle (R-002). Golden fixtures and push
// examples must pass; negative controls must fail (proving the schema bites).
// The live GA4 /debug/mp/collect check is the complementary half — see
// contracts/ga4-mp.md. Run: `npm run validate` (from contracts/).
import Ajv2020 from "ajv/dist/2020.js";
import { readFileSync } from "node:fs";

const ajv = new Ajv2020({ allErrors: true, strict: false });
const load = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url)));

// Compile each schema exactly once (its $id may only be registered once).
const ga4 = ajv.compile(load("./ga4-mp-request.schema.json"));
const push = ajv.compile(load("./push-event.schema.json"));

let failures = 0;

function mustPass(validate, dataPath) {
  const data = load(dataPath);
  if (validate(data)) {
    console.log(`ok    ${dataPath}`);
  } else {
    failures++;
    console.error(`FAIL  ${dataPath}`);
    for (const e of validate.errors) console.error(`      ${e.instancePath || "/"} ${e.message}`);
  }
}

function mustFail(validate, data, label) {
  if (validate(data)) {
    failures++;
    console.error(`FAIL  negative control unexpectedly passed: ${label}`);
  } else {
    console.log(`ok    negative control rejected: ${label}`);
  }
}

// GA4 MP: golden fixtures must validate.
mustPass(ga4, "./fixtures/ga4-mp-page_view.golden.json");
mustPass(ga4, "./fixtures/ga4-mp-custom-event.golden.json");
mustPass(ga4, "./fixtures/ga4-mp-experiment-impression.golden.json"); // spec 005-01 exposure
mustPass(ga4, "./fixtures/ga4-mp-view-block.golden.json"); // spec 006-01 block view
mustPass(ga4, "./fixtures/ga4-mp-purchase.golden.json"); // spec 008/010-01 purchase ecommerce

// GA4 MP: negative controls the schema MUST reject.
mustFail(ga4, { client_id: "x", events: [{ name: "_bad", params: {} }] }, "event name starting with _");
mustFail(ga4, { client_id: "x", events: [{ name: "session_start", params: {} }] }, "reserved event name (session_start)");
mustFail(ga4, { client_id: "x", events: [{ name: "toolongtoolongtoolongtoolongtoolongtoolong", params: {} }] }, "event name > 40 chars");
mustFail(ga4, { events: [{ name: "page_view" }] }, "missing required client_id");
mustFail(ga4, { client_id: "x", events: [] }, "empty events array");
mustFail(ga4, { client_id: "x", events: [{ name: "page_view", params: { ga_reserved: 1 } }] }, "reserved param prefix ga_");
mustFail(ga4, { client_id: "x", events: [{ name: "page_view", params: {} }], bogus_top_level: 1 }, "unknown top-level field");

// GA4 MP: purchase items[] negative controls (010-01) — the item shape must bite.
mustFail(
  ga4,
  { client_id: "x", events: [{ name: "purchase", params: { transaction_id: "T-1", currency: "USD", value: 1, items: [{ price: 1, quantity: 1 }] } }] },
  "purchase item with neither item_id nor item_name",
);
mustFail(
  ga4,
  { client_id: "x", events: [{ name: "purchase", params: { transaction_id: "T-1", currency: "USD", value: 1, items: [] } }] },
  "purchase items as empty array",
);
mustFail(
  ga4,
  { client_id: "x", events: [{ name: "purchase", params: { transaction_id: "T-1", currency: "USD", value: 1, items: "SKU_12345" } }] },
  "purchase items as scalar",
);
mustFail(
  ga4,
  { client_id: "x", events: [{ name: "purchase", params: { transaction_id: "T-1", currency: "USD", value: 1, items: ["SKU_12345"] } }] },
  "purchase item ELEMENT is a scalar, not an object", // bites $defs.item type:object (010-01 craft review)
);
mustFail(
  ga4,
  { client_id: "x", events: [{ name: "purchase", params: { transaction_id: "T-1", currency: "USD", value: 1, items: [{ item_id: "SKU_1", price: "29.99" }] } }] },
  "purchase item price as a string", // bites $defs.item price type:number (010-01 craft review)
);

// push() envelope: the schema's own examples must validate; a nameless push must fail.
const pushSchema = load("./push-event.schema.json");
for (const ex of pushSchema.examples ?? []) {
  if (push(ex)) console.log(`ok    push example ${JSON.stringify(ex.event)}`);
  else { failures++; console.error(`FAIL  push example ${JSON.stringify(ex)}`); }
}
mustFail(push, { page_location: "x" }, "push without event name");

console.log(failures === 0 ? "\nAll contract checks passed." : `\n${failures} contract check(s) FAILED.`);
process.exit(failures ? 1 : 0);
