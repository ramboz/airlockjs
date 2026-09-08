// Spec 038-02 — the semantic field-map oracle on GA4, extending the LANDED 038-01 harness
// (rig/parity/oracle.js, rig/parity/report.js — reused unmodified). Covers AC1 (the decisive
// ctx-sourcing rule: shared-cookie, never a beacon back-feed), AC2/AC3 (the GA4 descriptor +
// flatten adapter, fed to the SAME diffParity engine), AC4 (gap-map fields incl. Consent Mode
// named), AC5 (the session-continuity residual as a report note, not a bucket), AC6 (the
// airlock field-set stays substitutable — re-pointable at 039's future gtag connector), and AC7
// (the `npm run parity:ga4` entrypoint).
import { describe, it, expect } from "vitest";
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";

import { parseGaClientId, parseGaSessionId } from "../connectors/ga4/cookies.js";
import { ga4ParityDescriptor, SYNTHETIC_GA4_MEASUREMENT_ID } from "../rig/parity/descriptors/ga4.js";
import { diffParity } from "../rig/parity/oracle.js";
import { sourceGa4CtxFromFixture, cookieMapToString } from "../rig/parity/ga4-ctx.js";
import { replayGa4Egress } from "../rig/parity/ga4-replay.js";
import { buildGa4ParityReport } from "../rig/parity/report-ga4.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = join(HERE, "fixtures/parity-ga4-collect.redacted.json");
const CLI_PATH = join(HERE, "../rig/parity/run-ga4.mjs");
const fixture = JSON.parse(readFileSync(FIXTURE_PATH, "utf8"));

/** Runs the FULL replay pipeline via the SHARED `replayGa4Egress` helper `run-ga4.mjs` uses — so
 * the CLI and the tests exercise one code path and cannot drift (craft-review 2026-09-08). `cookies`
 * overrides the fixture's own cookie context (for the OQ13-2 fallback path). */
async function replayFixtureFields(cookies = fixture.cookies, now) {
  const { fields } = await replayGa4Egress({ fixture: { ...fixture, cookies }, now });
  return fields;
}

describe("AC1 — ctx comes from the shared cookie context, NEVER a beacon back-feed (the decisive rule)", () => {
  it("on the real fixture, ctx.clientId/sessionId equal the container's cid/sid BECAUSE both read the SAME _ga/_ga_<stream> cookie (the real R-009 coupling)", async () => {
    const ctx = await sourceGa4CtxFromFixture({ cookies: fixture.cookies });
    expect(ctx.clientId).toBe(parseGaClientId(fixture.cookies._ga));
    expect(ctx.clientId).toBe(fixture.container_fields.cid);
    expect(ctx.sessionId).toBe(parseGaSessionId(fixture.cookies["_ga_DEBUGTEST0"]));
    expect(ctx.sessionId).toBe(fixture.container_fields.sid);
  });

  it("ctx.clientId comes from the _ga COOKIE, not the beacon's own cid field — non-tautological proof: a cookie deliberately DIFFERENT from the captured cid wins", async () => {
    const differentCookies = { _ga: "GA1.1.9999999999.1690000000" }; // != fixture.container_fields.cid
    const ctx = await sourceGa4CtxFromFixture({ cookies: differentCookies });
    expect(ctx.clientId).toBe("9999999999.1690000000"); // the COOKIE's value
    expect(ctx.clientId).not.toBe(fixture.container_fields.cid); // NEVER the beacon's own cid
  });

  it("cid/sid classify `maps` end-to-end through diffParity, sourced via the shared cookie (not asserted by fiat)", async () => {
    const airlockFields = await replayFixtureFields();
    const { fields } = diffParity({
      descriptor: ga4ParityDescriptor,
      containerFields: fixture.container_fields,
      airlockFields,
    });
    expect(fields.find((f) => f.field === "cid").bucket).toBe("maps");
    expect(fields.find((f) => f.field === "sid").bucket).toBe("maps");
  });

  it("a fixture WITHOUT _ga_<stream> falls back to a per-page-minted session id (OQ13-2) — a DIFFERENT code path from the shared-cookie coupling above", async () => {
    const streamlessCookies = { _ga: fixture.cookies._ga }; // _ga_<stream> deliberately dropped
    const fixedNow = () => 1_700_000_000_000;
    const ctx = await sourceGa4CtxFromFixture({ cookies: streamlessCookies, now: fixedNow });
    expect(ctx.sessionId).toBe(String(Math.floor(1_700_000_000_000 / 1000))); // the per-page mint fallback
    expect(ctx.sessionId).not.toBe(fixture.container_fields.sid); // the OQ13-2 loss, made concrete
    // client_id is UNAFFECTED — only the session leg falls back.
    expect(ctx.clientId).toBe(fixture.container_fields.cid);
  });
});

describe("AC2/AC3 — the GA4 descriptor + flatten adapter, fed to the SAME 038-01 diffParity engine", () => {
  it("tid -> measurement_id maps, surfaced from the collect-URL query (never a false `dropped`)", async () => {
    const airlockFields = await replayFixtureFields();
    expect(airlockFields.measurement_id).toBe(SYNTHETIC_GA4_MEASUREMENT_ID);
    const { fields } = diffParity({
      descriptor: ga4ParityDescriptor,
      containerFields: fixture.container_fields,
      airlockFields,
    });
    expect(fields.find((f) => f.field === "tid").bucket).toBe("maps");
  });

  it("every wireNameMap RHS name is present in the flatten adapter's output (a name-lookup miss can never falsely `dropped` a present field)", async () => {
    const airlockFields = await replayFixtureFields();
    for (const airlockName of Object.values(ga4ParityDescriptor.wireNameMap)) {
      expect(Object.prototype.hasOwnProperty.call(airlockFields, airlockName)).toBe(true);
    }
  });

  it("the enumerated ep./epn. param rows map by their CONCRETE name, never a wildcard-strip", async () => {
    const airlockFields = await replayFixtureFields();
    const { fields } = diffParity({
      descriptor: ga4ParityDescriptor,
      containerFields: fixture.container_fields,
      airlockFields,
    });
    expect(fields.find((f) => f.field === "ep.page_type")).toMatchObject({ bucket: "maps", containerValue: "article" });
    expect(fields.find((f) => f.field === "epn.reading_time_sec")).toMatchObject({ bucket: "maps", containerValue: "42" });
  });

  it("_et normalises out — the field maps, but its VALUE is not a parity check (map.js defaults engagement_time_msec to 100; the fixture's _et is deliberately different, so this is not a coincidental pass)", async () => {
    expect(fixture.container_fields._et).not.toBe("100");
    const airlockFields = await replayFixtureFields();
    const { fields } = diffParity({
      descriptor: ga4ParityDescriptor,
      containerFields: fixture.container_fields,
      airlockFields,
    });
    const et = fields.find((f) => f.field === "_et");
    expect(et.bucket).toBe("normalised-out");
    expect(et.bucket).not.toBe("divergent");
  });
});

describe("AC2/AC4 — gap map: owned drops green, an un-owned drop red, a divergent value red, Consent Mode named", () => {
  it("sct (session count, no MP equivalent) classifies expected-dropped, owned 'spec 039'; overall verdict stays pass", async () => {
    const airlockFields = await replayFixtureFields();
    const { fields, verdict } = diffParity({
      descriptor: ga4ParityDescriptor,
      containerFields: fixture.container_fields,
      airlockFields,
    });
    const sct = fields.find((f) => f.field === "sct");
    expect(sct.bucket).toBe("expected-dropped");
    expect(sct.owner).toBe("spec 039");
    expect(verdict).toBe("pass");
  });

  it("gcs/gcd (Consent Mode) are named expected-dropped entries — the boundary loss is visible, not silent (AC4)", async () => {
    const airlockFields = await replayFixtureFields();
    const { fields } = diffParity({
      descriptor: ga4ParityDescriptor,
      containerFields: fixture.container_fields,
      airlockFields,
    });
    for (const name of ["gcs", "gcd"]) {
      const entry = fields.find((f) => f.field === name);
      expect(entry.bucket).toBe("expected-dropped");
      expect(entry.owner).toBe("spec 039");
    }
  });

  it("an UN-OWNED drop (en missing from airlock's output) is a REGRESSION — red, not drowned under the owned session/consent gaps", async () => {
    const airlockFields = await replayFixtureFields();
    const regressed = { ...airlockFields };
    delete regressed.event_name;
    const { verdict, fields } = diffParity({
      descriptor: ga4ParityDescriptor,
      containerFields: fixture.container_fields,
      airlockFields: regressed,
    });
    expect(verdict).toBe("fail");
    const en = fields.find((f) => f.field === "en");
    expect(en.bucket).toBe("dropped");
    expect(en.owner).toBeUndefined();
    // the guard did NOT drown the regression — owned gaps are still separately, correctly green.
    expect(fields.filter((f) => f.bucket === "expected-dropped").length).toBeGreaterThan(0);
  });

  it("a divergent value (client_id present but wrong) is red — never gap-closed, never silently accepted", async () => {
    const airlockFields = await replayFixtureFields();
    const diverged = { ...airlockFields, client_id: "0000000000.0000000000" };
    const { verdict, fields } = diffParity({
      descriptor: ga4ParityDescriptor,
      containerFields: fixture.container_fields,
      airlockFields: diverged,
    });
    expect(verdict).toBe("fail");
    expect(fields.find((f) => f.field === "cid").bucket).toBe("divergent");
  });
});

describe("oracle input contract — the airlock field-set stays substitutable (AC6: re-pointable at 039's future gtag connector)", () => {
  it("the REPLAY path: ctx-source -> mapToMp -> mpUrl -> flatten produces a valid airlock field-set", async () => {
    const airlockFields = await replayFixtureFields();
    expect(airlockFields.client_id).toBe(fixture.container_fields.cid);
    expect(airlockFields.event_name).toBe("page_view");
  });

  it("the SUPPLIED path: diffParity accepts a hand-built field-set with NO replay call at all", () => {
    const cf = fixture.container_fields;
    const { verdict } = diffParity({
      descriptor: ga4ParityDescriptor,
      containerFields: cf,
      airlockFields: {
        measurement_id: SYNTHETIC_GA4_MEASUREMENT_ID,
        client_id: cf.cid,
        event_name: cf.en,
        page_location: cf.dl,
        page_referrer: cf.dr,
        page_title: cf.dt,
        session_id: cf.sid,
        page_type: cf["ep.page_type"],
        reading_time_sec: cf["epn.reading_time_sec"],
      }, // hand-built, no mapToMp/mpUrl/flatten call anywhere
    });
    expect(verdict).toBe("pass"); // every other container field on this fixture is a gap-map member
  });
});

describe("AC5 — session continuity is a scope RESIDUAL, reported as a note, never a per-field bucket", () => {
  it("the GA4 report carries the session-continuity residual note, regardless of verdict", async () => {
    const airlockFields = await replayFixtureFields();
    const report = buildGa4ParityReport({
      descriptor: ga4ParityDescriptor,
      fixture: FIXTURE_PATH,
      containerFields: fixture.container_fields,
      airlockFields,
      emitted: true,
    });
    expect(report.verdict).toBe("pass");
    expect(typeof report.session_continuity_residual).toBe("string");
    expect(report.session_continuity_residual).toMatch(/session/i);
    expect(report.session_continuity_residual).toMatch(/OQ13-2|per-page|cross-page/i);
    // no live-shaped identifiers anywhere in the rendered report.
    expect(JSON.stringify(report)).not.toContain(fixture.cookies._ga);
  });
});

describe("cookieMapToString — the harness-only document.cookie-shaped builder", () => {
  it("joins a {name: value} map into a `name=value; name=value` string", () => {
    expect(cookieMapToString({ _ga: "A.1", _ga_X: "B.2" })).toBe("_ga=A.1; _ga_X=B.2");
  });
});

describe("AC7 — `npm run parity:ga4`: one command, exits non-zero only on a real regression", () => {
  it("running the CLI against the shipped fixture prints a passing JSON verdict and exits 0", () => {
    const out = execFileSync("node", [CLI_PATH], { encoding: "utf8" });
    const report = JSON.parse(out);
    expect(report.verdict).toBe("pass");
    expect(report.vendor).toBe("ga4");
    expect(typeof report.session_continuity_residual).toBe("string");
  });

  it("exits non-zero end-to-end when the fixture's _ga cookie cannot be parsed — ctx mints a FRESH client_id that genuinely diverges from the captured cid (a real regression, no code change)", () => {
    const dir = mkdtempSync(join(tmpdir(), "parity-ga4-"));
    const badFixturePath = join(dir, "bad.json");
    try {
      const bad = JSON.parse(JSON.stringify(fixture));
      bad.cookies._ga = "not-a-valid-ga-cookie"; // parseGaClientId -> null -> sourceGa4Ctx mints a NEW id
      writeFileSync(badFixturePath, JSON.stringify(bad));

      let threw = false;
      try {
        execFileSync("node", [CLI_PATH], { encoding: "utf8", env: { ...process.env, PARITY_GA4_FIXTURE: badFixturePath } });
      } catch (err) {
        threw = true;
        expect(err.status).toBe(1);
        const report = JSON.parse(err.stdout);
        expect(report.verdict).toBe("fail");
        const cidEntry = report.fields.find((f) => f.field === "cid");
        expect(cidEntry.bucket).toBe("divergent"); // present on both sides, but no longer equal
      }
      expect(threw).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
