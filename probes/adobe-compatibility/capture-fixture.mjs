import { checkFixtureManifest } from "../../rig/fixture-manifest.mjs";
import { scanFixtureText } from "../../rig/fixture-credentials.mjs";

// Pure fixture assembly for the 064-04 capture session: scrub withheld IDs to
// their labels (D9), build the manifest block, run the manifest and credential
// checks, and return the JSON text to store. No browser and no file access.

export const LABELS = Object.freeze({
  analyticsReportSuite: "owned test report suite",
  targetPropertyToken: "owned Target property",
  targetEnvironmentId: "owned Target environment",
});
export const SCHEMA = "airlock.adobe-capture";

export function scrubText(text, withheld = {}) {
  let out = text;
  const counts = {};
  for (const [key, label] of Object.entries(LABELS)) {
    const value = withheld[key];
    if (typeof value !== "string" || value.length < 4) continue;
    const parts = out.split(value);
    counts[key] = parts.length - 1;
    out = parts.join(label);
  }
  return { text: out, counts };
}

export function toStorage({ cookies = [], localStorage = {}, sessionStorage = {} }) {
  return {
    cookies: cookies.map(c => ({ name: c.name, value: c.value, domain: c.domain, path: c.path })),
    local_storage: { ...localStorage },
    session_storage: { ...sessionStorage },
  };
}

export function buildManifest({ capturedAt, input, alloySha256, before, after }) {
  return {
    schema_version: 1,
    vendor: "adobe",
    captured_at: capturedAt,
    input_state: {
      url: input.url,
      referrer: input.referrer ?? null,
      viewport: input.viewport,
      locale: input.locale,
      timezone: input.timezone,
      egress: input.egress,
      browser: input.browser,
      mode: input.mode,
      profile_kind: input.profileKind,
      loaded_digests: { script_sha256: alloySha256 },
      storage_before: toStorage(before),
      storage_after: toStorage(after),
    },
  };
}

// Returns { text } or throws with stable codes only, never a secret value.
export function finishFixture({ manifest, capture, requests, withheld }) {
  const fixture = { schema: SCHEMA, manifest, capture, requests };
  const { text, counts } = scrubText(`${JSON.stringify(fixture, null, 2)}\n`, withheld);
  const parsed = JSON.parse(text);
  const manifestCheck = checkFixtureManifest(parsed.manifest);
  if (!manifestCheck.ok) throw new Error(`manifest_invalid: ${manifestCheck.errors.join(",")}`);
  const findings = scanFixtureText(text);
  if (findings.length) throw new Error(`credential_findings: ${findings.map(f => f.rule).join(",")}`);
  return { text, scrubbed: counts };
}
