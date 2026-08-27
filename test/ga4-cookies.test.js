import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020.js";
import {
  parseGaClientId,
  parseGaSessionId,
  findGaStreamCookie,
  formatGaCookieValue,
  sourceGa4Ctx,
  GA_COOKIE_MAX_AGE_S,
} from "../connectors/ga4/cookies.js";
import { mapToMp } from "../connectors/ga4/map.js";

// Slice 004-03 AC1/AC3: defensive `_ga` / `_ga_<stream>` parsing. The cookie
// grammar is community-derived, NOT part of the pinned contract (ga4-mp.md
// § Provenance) — these fixtures ARE the assumption, encoded as tests. Every
// malformed shape degrades to null; nothing here may throw.

describe("parseGaClientId (_ga → client_id, last two dotted segments)", () => {
  it("parses the standard GA1.1 shape", () => {
    expect(parseGaClientId("GA1.1.1234567890.1700000000")).toBe("1234567890.1700000000");
  });

  it("tolerates domain-depth variation (GA1.2.…)", () => {
    expect(parseGaClientId("GA1.2.1234567890.1700000000")).toBe("1234567890.1700000000");
  });

  it("accepts a bare two-segment value (prefix already stripped)", () => {
    expect(parseGaClientId("1234567890.1700000000")).toBe("1234567890.1700000000");
  });

  it("degrades to null on fewer than 2 segments", () => {
    expect(parseGaClientId("1234567890")).toBeNull();
  });

  it("degrades to null on junk / empty / undefined — never throws", () => {
    expect(parseGaClientId("i-am-not-a-ga-cookie")).toBeNull();
    expect(parseGaClientId("")).toBeNull();
    expect(parseGaClientId(undefined)).toBeNull();
    expect(parseGaClientId(null)).toBeNull();
  });

  it("degrades to null when the last two segments are not numeric", () => {
    expect(parseGaClientId("GA1.1.abc.def")).toBeNull();
    expect(parseGaClientId("GA1.1.1234567890.")).toBeNull();
  });
});

describe("parseGaSessionId (_ga_<stream> → session_id, GS1 and GS2 shapes)", () => {
  it("parses the GS1 dot-separated shape (third segment)", () => {
    expect(parseGaSessionId("GS1.1.1724668790.5.1.1724668795.60.0.0")).toBe("1724668790");
  });

  it("parses the GS2 $-separated shape (s-prefixed session field)", () => {
    expect(parseGaSessionId("GS2.1.s1724668790$o5$g1$t1724668795$j0$l0$h0")).toBe("1724668790");
  });

  it("degrades to null on junk / absent — never throws", () => {
    expect(parseGaSessionId("hello")).toBeNull();
    expect(parseGaSessionId("GS1.1")).toBeNull();
    expect(parseGaSessionId("")).toBeNull();
    expect(parseGaSessionId(undefined)).toBeNull();
    expect(parseGaSessionId(null)).toBeNull();
  });

  it("degrades to null on a GS2 body with no s-field", () => {
    expect(parseGaSessionId("GS2.1.o5$g1$t1724668795")).toBeNull();
  });
});

describe("findGaStreamCookie (locate _ga_<STREAM> in a document.cookie string)", () => {
  it("finds the _ga_<STREAM> cookie, skipping _ga itself and _gat/_gid", () => {
    const jar =
      "_ga=GA1.1.1234567890.1700000000; _gid=GA1.1.111.222; _gat=1; " +
      "_ga_ABC123XYZ=GS1.1.1724668790.5.1.1724668795.60.0.0";
    expect(findGaStreamCookie(jar)).toBe("GS1.1.1724668790.5.1.1724668795.60.0.0");
  });

  it("returns null when no _ga_* stream cookie is present", () => {
    expect(findGaStreamCookie("_ga=GA1.1.1.2; _gid=GA1.1.3.4")).toBeNull();
    expect(findGaStreamCookie("")).toBeNull();
    expect(findGaStreamCookie(undefined)).toBeNull();
  });

  it("picks the FIRST _ga_* cookie (document order) when several exist — deterministic", () => {
    const jar = "_ga_FIRST=GS1.1.1111111111.1.1.1.1.0.0; _ga_SECOND=GS1.1.2222222222.1.1.1.1.0.0";
    expect(findGaStreamCookie(jar)).toBe("GS1.1.1111111111.1.1.1.1.0.0");
  });
});

describe("formatGaCookieValue (the GA1 write format)", () => {
  it("wraps a client_id as GA1.1.<clientId>", () => {
    expect(formatGaCookieValue("1234567890.1700000000")).toBe("GA1.1.1234567890.1700000000");
  });
});

// AC2 + AC3: host-side ctx sourcing over the mediated (async, capability.d.ts-shaped)
// cookie accessor. now()/random() are injected so the generate path is deterministic.
const makeJar = (initial = {}) => {
  const store = new Map(Object.entries(initial));
  const sets = [];
  return {
    sets,
    get: async (name) => (store.has(name) ? store.get(name) : null),
    set: async (name, value, opts) => {
      sets.push({ name, value, opts });
      store.set(name, value);
    },
  };
};

describe("sourceGa4Ctx (host-side identity sourcing, ADR-0003 minimal snapshot)", () => {
  it("with an existing _ga: returns the parsed clientId and does NOT set", async () => {
    const jar = makeJar({ _ga: "GA1.1.1234567890.1700000000" });
    const ctx = await sourceGa4Ctx({ cookies: jar, now: () => 1800000000000 });
    expect(ctx.clientId).toBe("1234567890.1700000000");
    expect(jar.sets).toEqual([]);
  });

  it("with NO _ga: generates <10digits>.<unix-seconds> and persists it AS _ga in GA1 format", async () => {
    const jar = makeJar();
    const ctx = await sourceGa4Ctx({
      cookies: jar,
      now: () => 1700000123456, // → unix-seconds 1700000123
      random: () => 0.5, //          → 10-digit 5500000000
    });
    expect(ctx.clientId).toBe("5500000000.1700000123");
    expect(jar.sets).toEqual([
      {
        name: "_ga",
        value: "GA1.1.5500000000.1700000123",
        opts: { maxAge: GA_COOKIE_MAX_AGE_S, path: "/", sameSite: "lax" },
      },
    ]);
    expect(GA_COOKIE_MAX_AGE_S).toBe(63072000); // ≈ 2 years (browser caps shorten it)
  });

  it("with a MALFORMED existing _ga: generates for this page but NEVER overwrites the cookie", async () => {
    const jar = makeJar({ _ga: "!!corrupt!!" });
    const ctx = await sourceGa4Ctx({
      cookies: jar,
      now: () => 1700000123456,
      random: () => 0.5,
    });
    expect(ctx.clientId).toBe("5500000000.1700000123"); // usable identity for this page
    expect(jar.sets).toEqual([]); // the write is defensive — an existing _ga is never clobbered
  });

  it("with _ga_<stream> present: sessionId is parsed from it (GS1 and GS2)", async () => {
    const gs1 = await sourceGa4Ctx({
      cookies: makeJar({ _ga: "GA1.1.1.2" }),
      cookieString: "_ga=GA1.1.1.2; _ga_ABC=GS1.1.1724668790.5.1.1724668795.60.0.0",
      now: () => 1800000000000,
    });
    expect(gs1.sessionId).toBe("1724668790");

    const gs2 = await sourceGa4Ctx({
      cookies: makeJar({ _ga: "GA1.1.1.2" }),
      cookieString: "_ga_DEF=GS2.1.s1724668790$o5$g1$t1724668795$j0$l0$h0",
      now: () => 1800000000000,
    });
    expect(gs2.sessionId).toBe("1724668790");
  });

  it("with NO/unparseable _ga_<stream>: falls back to a per-page session id (unix-seconds at boot)", async () => {
    const ctx = await sourceGa4Ctx({
      cookies: makeJar({ _ga: "GA1.1.1.2" }),
      cookieString: "_ga=GA1.1.1.2; _ga_JUNK=not-a-session-cookie",
      now: () => 1724668795500, // → "1724668795"
    });
    expect(ctx.sessionId).toBe("1724668795");
  });

  it("returns EXACTLY the minimal { clientId, sessionId } snapshot — no raw cookie material", async () => {
    const ctx = await sourceGa4Ctx({
      cookies: makeJar({ _ga: "GA1.1.1234567890.1700000000" }),
      cookieString: "_ga=GA1.1.1234567890.1700000000; _ga_ABC=GS1.1.1724668790.1.1.1.1.0.0",
      now: () => 1800000000000,
    });
    expect(Object.keys(ctx).sort()).toEqual(["clientId", "sessionId"]);
    expect(typeof ctx.clientId).toBe("string");
    expect(typeof ctx.sessionId).toBe("string");
  });
});

// AC5: the ga4_mp_conformance link over a COOKIE-SOURCED ctx — schema-valid AND
// an exact match of the pinned golden fixture (the golden is what catches a
// typo'd event name; contracts/ga4-mp.md § oracle).
const schema = JSON.parse(
  readFileSync(new URL("../contracts/ga4-mp-request.schema.json", import.meta.url)),
);
const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema);
const golden = JSON.parse(
  readFileSync(new URL("../contracts/fixtures/ga4-mp-page_view.golden.json", import.meta.url)),
);

describe("ga4_mp_conformance with a cookie-sourced ctx (AC5)", () => {
  it("mapToMp over ctx sourced from fixture cookies validates AND matches the golden byte-values", async () => {
    // Fixture cookies chosen to yield the golden's exact client_id/session_id.
    const jar = makeJar({ _ga: "GA1.1.1234567890.1700000000" });
    const mustNotGenerate = vi.fn(() => {
      throw new Error("generate path must not run — _ga is present");
    });
    const ctx = await sourceGa4Ctx({
      cookies: jar,
      cookieString: "_ga=GA1.1.1234567890.1700000000; _ga_STREAM1=GS1.1.1724668790.5.1.1724668795.60.0.0",
      now: () => 1800000000000,
      random: mustNotGenerate,
    });

    const body = mapToMp(
      {
        type: "page_view",
        params: {
          page_location: "https://www.example.com/pricing",
          page_title: "Pricing",
          page_referrer: "https://www.example.com/",
        },
      },
      { ...ctx, consent: { ad_user_data: "GRANTED", ad_personalization: "DENIED" } },
    );

    expect(validate(body)).toBe(true); // schema half of the oracle
    expect(body).toEqual(golden); //      golden half — exact event name + params
    expect(jar.sets).toEqual([]); //      sourcing did not touch the jar
    expect(mustNotGenerate).not.toHaveBeenCalled();
  });
});

describe("decode-fallback branch (craft review pin): malformed %-escape never throws", () => {
  it("findGaStreamCookie surfaces the raw value when decodeURIComponent would throw", () => {
    // %zz is an invalid escape — decodeURIComponent throws; the fallback returns raw.
    expect(findGaStreamCookie("_ga_ABC123=GS2.1.s17%zz$o1")).toBe("GS2.1.s17%zz$o1");
  });
});

describe("existing-but-empty _ga (reconciliation review pin)", () => {
  it("an empty `_ga=` counts as existing: no persist over it, fresh per-page client_id", async () => {
    const set = vi.fn(async () => {});
    const ctx = await sourceGa4Ctx({
      cookies: { get: async (n) => (n === "_ga" ? "" : null), set },
      cookieString: "_ga=",
      now: () => 1_787_000_000_000,
      random: () => 0.5,
    });
    expect(set).not.toHaveBeenCalled(); // never overwrite, even an empty value
    expect(ctx.clientId).toMatch(/^\d+\.\d+$/); // fresh per-page id still minted
  });
});
