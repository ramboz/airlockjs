// Spec 013-01 AC2 — mint-recognizability against REAL Alloy, replayed creds-free.
//
// ADR-0008's kill-criterion: the broker must recognize the wrapped-SDK's opaque
// interact as a coalescable identity MINT, and extract the ECID from the Edge
// response. 012-02 proved this against the *stub*. This test proves it against a
// REAL Adobe Edge capture (rig/alloy-live-reprobe.mjs, one live round-trip) whose
// identifier VALUES are redacted and SHAPE preserved — so the kill-criterion
// evidence is a DURABLE regression that needs no standing credentials to re-run.
//
// The live rig emitted the CONFIRMED verdict against the real (unredacted) ECID;
// this test pins that the same pure recognizer/extractor navigates the real
// response SHAPE. A shape drift in a future alloy/Edge version breaks this test —
// which is exactly the signal ADR-0008 wants before the wrapped-SDK contract-freeze.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
import { recognizeInteract, extractEcidFromInteractResponse } from "../rig/alloy-xdm-mint.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(
  readFileSync(join(HERE, "fixtures/alloy-live-interact.redacted.json"), "utf8"),
);

describe("013-01 — live-Alloy mint-recognizability (redacted real capture, creds-free)", () => {
  it("the fixture is a real, redacted capture (no live identifiers, shape intact)", () => {
    const s = JSON.stringify(fixture);
    // the redaction placeholders are present; the SHAPE markers are intact
    expect(s).toContain("REDACTED");
    expect(fixture.request.body.query.identity.fetch).toEqual(["ECID", "CORE"]);
    expect(Array.isArray(fixture.response.handle)).toBe(true);
  });

  it("recognizes the REAL alloy interact request as a coalescable ECID first-mint", () => {
    const rec = recognizeInteract({
      url: fixture.request.url,
      body: JSON.stringify(fixture.request.body),
    });
    expect(rec.isMint).toBe(true);
    expect(rec.reason).toBe("ecid-first-mint");
    expect(rec.namespace).toBe("ECID");
  });

  it("extracts the ECID identity from the REAL Edge response via the ECID-namespace path", () => {
    // The id VALUE is redacted, but tagged BY namespace: the identity:result ECID
    // entry -> "REDACTED_ECID", its CORE sibling -> "REDACTED_CORE". Asserting the
    // exact tag proves the extractor selected the ECID entry (path-correctness), not
    // merely that it returned some truthy id.
    const ecid = extractEcidFromInteractResponse(fixture.response);
    expect(ecid).toBe("REDACTED_ECID");
  });

  it("the real response carries the identity:result / ECID-namespace handle shape", () => {
    const idHandle = (fixture.response.handle || []).find((h) => h && h.type === "identity:result");
    expect(idHandle).toBeTruthy();
    const hasEcid = (idHandle.payload || []).some((p) => p && p.namespace && p.namespace.code === "ECID");
    expect(hasEcid).toBe(true);
  });

  it("a non-mint interact is NOT misrecognized as a mint (negative control)", () => {
    const nonMint = recognizeInteract({
      url: fixture.request.url,
      body: JSON.stringify({ events: [{ xdm: { eventType: "commerce.purchases" } }] }),
    });
    expect(nonMint.isMint).toBe(false);
  });
});
