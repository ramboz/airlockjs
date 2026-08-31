// Synchronous cookie cache — spec 012-01, AC3 (additive sync-read cookie surface).
//
// alloy reads document.cookie SYNCHRONOUSLY (R-004: the getApexDomain/getTld
// apex-domain probe at the very first command, then identity reads). A worker
// has no document.cookie, so the chamber serves those reads from a synchronous
// in-worker string cache seeded at boot from the main thread, every write
// mirrored ASYNCHRONOUSLY back to the broker's authoritative jar. This cache
// backs the ADDITIVE `GrantedCapabilities.cookies.sync` surface
// (readSync/writeSync) — the pinned async get/set are untouched (AC3 additive).
//
// These tests pin the cache mechanics (the R-004 shape); the browser rig proves
// the real bundle's first sync cookie access is served from it.
import { describe, it, expect } from "vitest";
import { createSyncCookieCache } from "../connectors/alloy/sync-cookie-cache.js";

describe("sync cookie cache (spec 012-01 AC3)", () => {
  it("readSync() returns the boot seed synchronously", () => {
    const cache = createSyncCookieCache("AMCV_ORG=MCMID|123; kndctr_ORG_identity=abc");
    expect(cache.readSync()).toBe("AMCV_ORG=MCMID|123; kndctr_ORG_identity=abc");
  });

  it("readSync() is empty (never throws) when no cookie was seeded — the first access still succeeds", () => {
    const cache = createSyncCookieCache();
    // alloy's very first access is a READ (getApexDomain) — it must not throw
    // even on a cold, unseeded jar.
    expect(() => cache.readSync()).not.toThrow();
    expect(cache.readSync()).toBe("");
  });

  it("writeSync() then readSync() round-trips a cookie synchronously (the getTld apex probe)", () => {
    const cache = createSyncCookieCache("");
    // getApexDomain writes a probe cookie, reads it back to confirm the apex.
    cache.writeSync("com.adobe.alloy.getTld=cookie; domain=airlock.example; path=/");
    expect(cache.readSync()).toContain("com.adobe.alloy.getTld=cookie");
  });

  it("writeSync() replaces an existing same-named cookie (no duplicate) and keeps others", () => {
    const cache = createSyncCookieCache("AMCV_ORG=MCMID|OLD; other=keep");
    cache.writeSync("AMCV_ORG=MCMID|NEW; path=/");
    const jar = cache.readSync();
    expect(jar).toContain("AMCV_ORG=MCMID|NEW");
    expect(jar).not.toContain("MCMID|OLD");
    expect(jar).toContain("other=keep"); // untouched neighbour survives
    // exactly one AMCV_ORG entry — replaced, not appended.
    expect(jar.match(/AMCV_ORG=/g)).toHaveLength(1);
  });

  it("writeSync() fires the async write-back with the raw set-cookie string (reconcile to the broker jar)", () => {
    const writeBacks = [];
    const cache = createSyncCookieCache("", (raw) => writeBacks.push(raw));
    cache.writeSync("kndctr_ORG_identity=ECID-xyz; max-age=34128000; path=/");
    // the cache updated synchronously...
    expect(cache.readSync()).toContain("kndctr_ORG_identity=ECID-xyz");
    // ...AND the raw string was handed to the async write-back (broker reconcile).
    expect(writeBacks).toEqual(["kndctr_ORG_identity=ECID-xyz; max-age=34128000; path=/"]);
  });

  it("the write-back callback is optional — writeSync never throws without one", () => {
    const cache = createSyncCookieCache("");
    expect(() => cache.writeSync("a=1")).not.toThrow();
    expect(cache.readSync()).toContain("a=1");
  });

  it("tolerates a non-string seed by treating the jar as empty (defensive)", () => {
    const cache = createSyncCookieCache(undefined);
    expect(cache.readSync()).toBe("");
    const cache2 = createSyncCookieCache(null);
    expect(cache2.readSync()).toBe("");
  });
});
