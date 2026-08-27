// Live complement to the hermetic ga4_mp_conformance oracle (contracts/ga4-mp.md
// § "The ga4_mp_conformance oracle — two parts", part 2 / R-002). Posts a golden
// payload to GA4's Measurement Protocol VALIDATION endpoint
// (`/debug/mp/collect`) and prints any `validationMessages`.
//
// NON-BLOCKING (slice 007-01 AC3): this script is NOT registered in
// oracle.sh's COMPONENTS — it never gates the servo-unattended verdict,
// whether it passes, fails, or is skipped. Run manually: `npm run mp-live-check`
// (from contracts/).
//
// CREDENTIAL-FREE BY DEFAULT (slice 007-01 AC4, security MUST): no real
// measurement_id/api_secret is committed here. Without GA4_MEASUREMENT_ID +
// GA4_API_SECRET set in the environment, the check self-skips and exits 0.
import { readFileSync } from "node:fs";

const measurementId = process.env.GA4_MEASUREMENT_ID;
const apiSecret = process.env.GA4_API_SECRET;

if (!measurementId || !apiSecret) {
  console.log("live check skipped (no endpoint configured)");
  process.exit(0);
}

const endpoint =
  `https://www.google-analytics.com/debug/mp/collect` +
  `?measurement_id=${encodeURIComponent(measurementId)}` +
  `&api_secret=${encodeURIComponent(apiSecret)}`;

const golden = JSON.parse(
  readFileSync(new URL("./fixtures/ga4-mp-page_view.golden.json", import.meta.url)),
);

try {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(golden),
  });
  const body = await res.json();
  const messages = body.validationMessages ?? [];

  if (messages.length === 0) {
    console.log("live check: no validationMessages (advisory pass — not proof of conformance)");
  } else {
    console.log(`live check: ${messages.length} validationMessage(s):`);
    for (const m of messages) {
      console.log(`  ${m.validationCode ?? "?"}  ${m.fieldPath ?? ""}  ${m.description ?? ""}`);
    }
  }
} catch (err) {
  console.log(`live check: request failed (${err.message}) — advisory only, non-blocking`);
}

// Always exit 0: this check is advisory (R-002) and MUST NOT gate the oracle,
// whatever GA4 reports.
process.exit(0);
