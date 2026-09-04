// Config-driven boot — spec 032-01, the createAirlock-INPUT equivalence proofs.
//
// AC2 (pixel collapse), AC3 (governance parity + the helix-rum carve-out) are
// claims about the ARGUMENT OBJECT passed to `createAirlock` — not observable from
// the FakeWorker init message (which never carries egressPurposes/consent/
// payloadDenylist; those stay main-thread). So this file mocks `core/airlock.js`'s
// `createAirlock` with a spy and asserts the config-driven path produces the SAME
// inputs the per-function boots produce. (The observable runtime behavior is proven
// in test/eds-boot-config.test.js against the REAL createAirlock.)
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// A minimal handle stand-in — the boots wrap these methods and (helix) call push()
// at boot; none of that matters to the input-capture assertions.
vi.mock("../core/airlock.js", () => ({
  createAirlock: vi.fn(() => ({
    push() {},
    pushCritical() {},
    setConsent() {},
    getState() {},
    flushNow() {},
    stats() { return {}; },
    dispose() {},
  })),
}));

import { createAirlock } from "../core/airlock.js";
import {
  boot,
  bootEdsAnalytics,
  bootMetaPixel,
  bootLinkedInInsight,
  bootBingUet,
  bootHelixRum,
} from "../adapters/eds/index.js";

const gaCtx = { clientId: "1.1", sessionId: "2" }; // provided -> skips cookie sourcing
function stubWebVitals() {
  const cbs = {};
  return { onLCP: (cb) => { cbs.lcp = cb; }, onCLS: (cb) => { cbs.cls = cb; }, onINP: (cb) => { cbs.inp = cb; }, cbs };
}
const argsOf = (i) => createAirlock.mock.calls[i][0];

beforeEach(() => { createAirlock.mockClear(); });
afterEach(() => vi.unstubAllGlobals());

describe("AC2 — the pixel-vendor boot duplication is collapsed into ONE config dispatch", () => {
  const cases = [
    { vendor: "meta", ids: { pixelId: "111111111111111" }, standalone: bootMetaPixel },
    { vendor: "linkedin", ids: { partnerId: "7654321", conversionId: "12345678" }, standalone: bootLinkedInInsight },
    { vendor: "bing", ids: { tagId: "87654321" }, standalone: bootBingUet },
  ];

  for (const { vendor, ids, standalone } of cases) {
    it(`{type:"pixel",vendor:"${vendor}"} produces the SAME createAirlock inputs as boot${vendor} (all fields, incl. the egress-purpose gate)`, async () => {
      await standalone({ ...ids });
      await boot({ connectors: [{ type: "pixel", vendor, ...ids }] });

      const perFn = argsOf(0);
      const config = argsOf(1);
      expect(config).toEqual(perFn); // connector, connectorConfig, endpoints, egressPurposes gate, ctx, ...
      expect(config.connector).toBe("pixel");
      expect(config.egressPurposes).toEqual([]); // no consent wired -> gate closed on both paths
    });
  }
});

describe("AC3 — governance threads to consent-governed connectors (GA4, pixels)", () => {
  it("GA4: an absent consent vector yields egressPurposes:[] on BOTH paths (legacy always-dispatch)", async () => {
    await bootEdsAnalytics({ ctx: gaCtx });
    await boot({ connectors: [{ type: "ga4", ctx: gaCtx }] });

    expect(argsOf(1)).toEqual(argsOf(0));
    expect(argsOf(1).egressPurposes).toEqual([]);
  });

  it("GA4: a top-level consent vector threads through identically to bootEdsAnalytics({consent})", async () => {
    const consent = { analytics_storage: "granted" };
    await bootEdsAnalytics({ ctx: gaCtx, consent, consentStrict: true, payloadDenylist: ["email"] });
    await boot({
      connectors: [{ type: "ga4", ctx: gaCtx }],
      consent,
      consentStrict: true,
      payloadDenylist: ["email"],
    });

    expect(argsOf(1)).toEqual(argsOf(0));
    expect(argsOf(1).egressPurposes).toEqual(["analytics_storage"]); // gate engaged
    expect(argsOf(1).consentStrict).toBe(true);
    expect(argsOf(1).payloadDenylist).toEqual(["email"]);
  });

  it("Pixel: a top-level consent vector threads through identically to bootMetaPixel({consent})", async () => {
    const consent = { ad_storage: "granted" };
    await bootMetaPixel({ pixelId: "111111111111111", consent, consentStrict: true, payloadDenylist: ["email"] });
    await boot({
      connectors: [{ type: "pixel", vendor: "meta", pixelId: "111111111111111" }],
      consent,
      consentStrict: true,
      payloadDenylist: ["email"],
    });

    expect(argsOf(1)).toEqual(argsOf(0));
    expect(argsOf(1).egressPurposes).toEqual(["ad_storage"]);
    expect(argsOf(1).payloadDenylist).toEqual(["email"]);
  });
});

describe("AC3 — helix-rum keeps its spec-022 governance class (EXEMPT from config governance)", () => {
  beforeEach(() => {
    // deterministic per-page id so the two connectorConfigs are byte-comparable
    vi.stubGlobal("crypto", { randomUUID: () => "abcdef-0123456789" });
  });

  it("a helix-rum entry under top-level consent/denylist boots byte-identical to bootHelixRum (no gate, no strip, no async)", async () => {
    await bootHelixRum({ weight: 100, forceSelect: true, ...stubWebVitals() });
    await boot({
      connectors: [{ type: "helix-rum", weight: 100, forceSelect: true, ...stubWebVitals() }],
      consent: { ad_storage: "denied" }, // would GATE a consent-governed connector
      consentStrict: true,
      payloadDenylist: ["email"], // would STRIP a consent-governed connector
    });

    const standalone = argsOf(0);
    const fromConfig = argsOf(1);
    // byte-identical createAirlock inputs (id fixed above) — the config path did not
    // fork or re-parameterize the helix boot
    expect(fromConfig).toEqual(standalone);
    // and specifically: NONE of the top-level governance leaked in
    expect(fromConfig.connector).toBe("helix-rum");
    expect(fromConfig.egressPurposes).toEqual([]); // NOT consent-gated
    expect(fromConfig.consent).toBeUndefined();
    expect(fromConfig.consentStrict).toBeUndefined();
    expect(fromConfig.payloadDenylist).toBeUndefined();
  });
});
