// Contract stability guard — spec 012-01, AC6 ONLY.
//
// AC6: "Contract signatures unchanged (additive-only) + GA4 green." Every
// existing PINNED signature in contracts/capability.d.ts and
// contracts/connector.d.ts must stay byte-identical across this slice; new
// surface (e.g. AC3's `cookies.sync { readSync, writeSync }`) is additive and
// must NOT trip this guard.
//
// This file pins each load-bearing signature as a literal substring of the
// live .d.ts source text (read from disk, not re-typed from memory of the
// contract). A signature that is CHANGED or REMOVED makes the matching
// `toContain` fail; a signature that is merely ADDED elsewhere in the file
// never touches these assertions, so additions are free. This is a read-only
// guard — it never writes to contracts/**.
//
// The other half of AC6 ("GA4 green") is NOT re-implemented here: it is
// covered by the existing test/ga4-map.test.js, test/ga4-cookies.test.js, and
// test/ga4-purchase.test.js suites, which run unchanged as part of the same
// `vitest run` this guard is part of.
import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";

const capabilityDts = readFileSync(
  new URL("../contracts/capability.d.ts", import.meta.url),
  "utf8",
);
const connectorDts = readFileSync(
  new URL("../contracts/connector.d.ts", import.meta.url),
  "utf8",
);

describe("contract stability guard (spec 012-01 AC6 — additive-only)", () => {
  describe("contracts/capability.d.ts — async cookie surface (pre-AC3, must stay byte-identical)", () => {
    it("pins the async get(name) signature", () => {
      expect(capabilityDts).toContain("get(name: string): Promise<string | null>;");
    });

    it("pins the async set(name, value, opts?) signature", () => {
      expect(capabilityDts).toContain(
        "set(name: string, value: string, opts?: CookieOptions): Promise<void>;",
      );
    });
  });

  describe("contracts/connector.d.ts — Connector.handle signature", () => {
    it("pins handle(event) returning EgressRequest[] | Promise<EgressRequest[]>", () => {
      expect(connectorDts).toContain(
        "handle(event: AirlockEvent): EgressRequest[] | Promise<EgressRequest[]>;",
      );
    });
  });

  describe("contracts/connector.d.ts — ConnectorManifest fields", () => {
    it("pins name: string", () => {
      expect(connectorDts).toContain("readonly name: string;");
    });

    it("pins events: readonly string[]", () => {
      expect(connectorDts).toContain("readonly events: readonly string[];");
    });

    it("pins reads: readonly string[]", () => {
      expect(connectorDts).toContain("readonly reads: readonly string[];");
    });

    it("pins capabilities: CapabilityRequest", () => {
      expect(connectorDts).toContain("readonly capabilities: CapabilityRequest;");
    });

    it("pins endpoints?: readonly string[]", () => {
      expect(connectorDts).toContain("readonly endpoints?: readonly string[];");
    });
  });

  describe("contracts/connector.d.ts — EgressRequest fields", () => {
    it("pins url: string", () => {
      expect(connectorDts).toContain("readonly url: string;");
    });

    it('pins method?: "POST" | "GET"', () => {
      expect(connectorDts).toContain('readonly method?: "POST" | "GET";');
    });

    it("pins headers?: Readonly<Record<string, string>>", () => {
      expect(connectorDts).toContain("readonly headers?: Readonly<Record<string, string>>;");
    });

    it("pins body?: string | ArrayBufferView", () => {
      expect(connectorDts).toContain("readonly body?: string | ArrayBufferView;");
    });

    it("pins unloadCritical?: boolean", () => {
      expect(connectorDts).toContain("readonly unloadCritical?: boolean;");
    });
  });

  describe("contracts/connector.d.ts — ConnectorFactory signature", () => {
    it("pins the ConnectorFactory type alias", () => {
      expect(connectorDts).toContain(
        "export type ConnectorFactory = (config: Readonly<Record<string, unknown>>) => Connector;",
      );
    });
  });

  describe("additive-only: AC3's new sync surface does not break this guard", () => {
    it("the sync cookie surface added by AC3 is present alongside the pinned async get/set, not in place of them", () => {
      // This guard's job is to fail on CHANGE/REMOVAL of a pinned signature,
      // never on an addition. The sync surface below is exercised by its own
      // dedicated suite (alloy-sync-cookie-cache.test.js); it is asserted here
      // only to document that its presence is compatible with the guard, not
      // to duplicate its coverage.
      expect(capabilityDts).toContain("readSync(): string;");
      expect(capabilityDts).toContain("writeSync(setCookie: string): void;");
    });
  });
});
