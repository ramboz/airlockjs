import { describe, it, expect } from "vitest";
import { createCookieCapability } from "../adapters/eds/cookies.js";

// Slice 004-03 AC2: the HOST side of the mediated cookie capability — the
// capability.d.ts async get/set shape implemented over document.cookie, backed
// by the orchestrator/adapter on the main thread. Unit-tested over a stubbed
// document (the real-page write is proven by rig/bundle-smoke.mjs).

const fakeDoc = (initialCookie = "") => {
  const writes = [];
  return {
    writes,
    get cookie() {
      return initialCookie;
    },
    set cookie(v) {
      writes.push(v);
    },
  };
};

describe("createCookieCapability(document).get", () => {
  it("returns a Promise (the pinned capability shape is async)", () => {
    const cap = createCookieCapability(fakeDoc());
    expect(cap.get("_ga")).toBeInstanceOf(Promise);
  });

  it("finds a cookie by exact name among several, trimming whitespace", async () => {
    const cap = createCookieCapability(
      fakeDoc("_gid=GA1.1.3.4; _ga=GA1.1.1234567890.1700000000; other=x"),
    );
    expect(await cap.get("_ga")).toBe("GA1.1.1234567890.1700000000");
  });

  it("does NOT confuse name prefixes (_ga vs _ga_<stream>)", async () => {
    const cap = createCookieCapability(
      fakeDoc("_ga_S1=GS1.1.1724668790.1.1.1.1.0.0; _ga=GA1.1.1.2"),
    );
    expect(await cap.get("_ga")).toBe("GA1.1.1.2");
    expect(await cap.get("_ga_S1")).toBe("GS1.1.1724668790.1.1.1.1.0.0");
  });

  it("decodes a percent-encoded value", async () => {
    const cap = createCookieCapability(fakeDoc("enc=a%3Bb%20c"));
    expect(await cap.get("enc")).toBe("a;b c");
  });

  it("returns null for an absent cookie or an empty jar", async () => {
    expect(await createCookieCapability(fakeDoc("")).get("_ga")).toBeNull();
    expect(await createCookieCapability(fakeDoc("other=x")).get("_ga")).toBeNull();
  });
});

describe("createCookieCapability(document).set", () => {
  it("writes name=value with max-age, path, and samesite attributes", async () => {
    const doc = fakeDoc();
    await createCookieCapability(doc).set("_ga", "GA1.1.5500000000.1700000123", {
      maxAge: 63072000,
      path: "/",
      sameSite: "lax",
    });
    expect(doc.writes).toEqual([
      "_ga=GA1.1.5500000000.1700000123; max-age=63072000; path=/; samesite=lax",
    ]);
  });

  it("encodes the value (attribute-breaking characters cannot smuggle attributes)", async () => {
    const doc = fakeDoc();
    await createCookieCapability(doc).set("k", "v; secure", { path: "/" });
    expect(doc.writes).toEqual(["k=v%3B%20secure; path=/"]);
  });

  it("writes a bare name=value when no options are given", async () => {
    const doc = fakeDoc();
    await createCookieCapability(doc).set("k", "v");
    expect(doc.writes).toEqual(["k=v"]);
  });

  it("appends domain and the secure flag when requested", async () => {
    const doc = fakeDoc();
    await createCookieCapability(doc).set("k", "v", {
      domain: "example.test",
      secure: true,
      sameSite: "none",
    });
    expect(doc.writes).toEqual(["k=v; domain=example.test; samesite=none; secure"]);
  });
});

describe("accessor hardening (craft review pins)", () => {
  it("get() surfaces the raw value on a malformed %-escape instead of throwing", async () => {
    const cookies = createCookieCapability({ cookie: "enc=%zz-not-an-escape" });
    await expect(cookies.get("enc")).resolves.toBe("%zz-not-an-escape");
  });

  it("set() is a no-op (never a throw) when there is no document", async () => {
    const cookies = createCookieCapability(undefined);
    await expect(cookies.set("_ga", "GA1.1.1.1", { path: "/" })).resolves.toBeUndefined();
  });
});
