// GA4 `coalesce` strategy — spec 040-03 (revives 039-04's deferred batched-POST
// transport, now landing on the 040-02 core coalescing seam). `coalesceGa4`
// (connectors/ga4/coalesce.js) is a PURE function: given one origin+path group
// of built `{ url, method: "GET" }` /g/collect beacons (the SAME shape
// `connectors/ga4/gtag.js`'s `mapToGtagCollect` produces), it parses each
// URL's query by the fixed AC4 param-key TAXONOMY (PER-EVENT = {en, ep.*,
// epn.*, _et}; SHARED = everything else), sub-groups by the FULL shared-param
// set (AC2 — byte-identical, order-insensitive), and SYNTHESIZES gtag's own
// batch POST convention for any sub-group of >=2 (AC1) — `_et` RELOCATED from
// the query to each body line, `_ee=1` INJECTED per line (neither is a
// mechanical re-partition; see the slice's Assumptions). A lone request in its
// context group stays the unmodified 039-01 GET (AC3).
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

import { coalesceGa4 } from "../connectors/ga4/coalesce.js";
import { createGa4GtagConnector, GA4_GTAG_COLLECT_ENDPOINT } from "../connectors/ga4/gtag.js";
import { createAirlock } from "../core/airlock.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = join(HERE, "fixtures/parity-ga4-collect-batch.redacted.json");
const fixture = JSON.parse(readFileSync(FIXTURE_PATH, "utf8"));

/** Builds the SAME single-event GET the real 039-01 connector emits, given a
 *  fixture-shaped { measurementId, ctx } config and one { type, params }
 *  event — the exact `{ url, method: "GET" }` shape `coalesceGa4` consumes. */
function buildGet(config, event) {
  const connector = createGa4GtagConnector(config);
  const [req] = connector.handle(event);
  return req;
}

function buildFixtureGets() {
  return fixture.events.map((event) =>
    buildGet({ measurementId: fixture.measurementId, ctx: fixture.ctx }, event),
  );
}

describe("AC1/AC4 — a 2-event same-context cycle synthesizes ONE POST matching the redacted fixture byte-for-byte", () => {
  it("merges the two fixture GETs into the fixture's exact expected POST", () => {
    const gets = buildFixtureGets();
    const outputs = coalesceGa4(gets);

    expect(outputs).toHaveLength(1);
    expect(outputs[0]).toEqual({
      url: fixture.expected.url,
      method: "POST",
      body: fixture.expected.body,
    });

    // Load-bearing: 2 body lines, `\r\n`-separated, cycle order preserved.
    const lines = outputs[0].body.split("\r\n");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatch(/^en=page_view/);
    expect(lines[1]).toMatch(/^en=scroll/);
  });

  it("query-vs-body partition: every SHARED key (v/tid/cid/sid/dl/dr/dt) lands on the url, never in the body; every PER-EVENT key (en/ep.*/epn.*/_et) lands in the body, never on the url", () => {
    const outputs = coalesceGa4(buildFixtureGets());
    const [{ url, body }] = outputs;
    const urlParams = new URL(url).searchParams;

    for (const sharedKey of ["v", "tid", "cid", "sid", "dl", "dr", "dt"]) {
      expect(urlParams.has(sharedKey)).toBe(true);
      expect(body).not.toMatch(new RegExp(`(^|[&\r\n])${sharedKey}=`));
    }
    // Per-event keys must NOT reappear on the shared url — if the coalescer
    // failed to relocate them (a mechanical re-partition bug), they would
    // leak onto the query string instead of the body.
    for (const perEventKey of ["en", "ep.page_type", "epn.percent_scrolled", "_et"]) {
      expect(urlParams.has(perEventKey)).toBe(false);
      expect(body).toContain(`${perEventKey}=`);
    }
  });
});

describe("AC3 — a 1-event cycle stays the unmodified 039-01 GET", () => {
  it("a lone request in its own context group is returned UNCHANGED — no POST, no body", () => {
    const [onlyGet] = buildFixtureGets();
    const outputs = coalesceGa4([onlyGet]);

    expect(outputs).toHaveLength(1);
    // Load-bearing: strict equality to the ORIGINAL object's fields — if the
    // coalescer always synthesized a POST regardless of group size (removing
    // the n===1 branch), method would be "POST" and body would be defined here.
    expect(outputs[0]).toEqual(onlyGet);
    expect(outputs[0].method).toBe("GET");
    expect(outputs[0].body).toBeUndefined();
  });
});

describe("AC2 — coalesce only merges requests sharing the ENTIRE shared-context param set", () => {
  it("a mixed-`tid` cycle never merges — two GA4 streams stay two separate outputs (both unchanged GETs)", () => {
    const [event1, event2] = fixture.events;
    const reqA = buildGet({ measurementId: "G-STREAMA00", ctx: fixture.ctx }, event1);
    const reqB = buildGet({ measurementId: "G-STREAMB00", ctx: fixture.ctx }, event2);

    const outputs = coalesceGa4([reqA, reqB]);

    // If AC2 only checked `tid` loosely (or ignored it), this would collapse
    // to one POST carrying both streams' events under one measurement id —
    // silent cross-stream mis-attribution.
    expect(outputs).toHaveLength(2);
    expect(outputs.every((o) => o.method === "GET")).toBe(true);
    expect(outputs).toEqual(expect.arrayContaining([reqA, reqB]));
  });

  it("a mixed-`dl` cycle (SAME tid, different page) never merges — proves AC2 checks the FULL shared context, not just `tid` (039-04's cross-page mis-attribution risk)", () => {
    const [event1, event2] = fixture.events;
    const crossPageEvent2 = {
      ...event2,
      params: { ...event2.params, page_location: "https://example.test/other-page" },
    };
    const reqA = buildGet({ measurementId: fixture.measurementId, ctx: fixture.ctx }, event1);
    const reqB = buildGet({ measurementId: fixture.measurementId, ctx: fixture.ctx }, crossPageEvent2);

    const outputs = coalesceGa4([reqA, reqB]);

    // If the group key were "same tid" alone (the naive model 039-04 flagged
    // as a mis-attribution risk), this would merge into ONE POST whose shared
    // `dl` names only page1 while event2's hit actually happened on page2.
    expect(outputs).toHaveLength(2);
    expect(outputs.every((o) => o.method === "GET")).toBe(true);
  });

  it("a mixed-`gcs` cycle (SAME tid/page, different CONSENT state) never merges — `gcs` is a SHARED param, so events under different consent are never batched under one consent string (a governance invariant)", () => {
    const [event] = fixture.events;
    // Isolate `gcs` as the SOLE shared-param difference. A non-denied-all
    // declared `consentDefault` makes `encodeGcd` return undefined (039-05's
    // scope gate, gtag.js:191), so `gcd` is OMITTED for BOTH requests — else
    // `gcd` would co-vary with the consent vector and the split could not be
    // attributed to `gcs` alone (compliance-review correction). Everything
    // else (tid/cid/sid/dl/dr/dt, no session-state, no gcd) is identical.
    const grantedDefault = { ad_storage: "granted", analytics_storage: "granted", ad_user_data: "granted", ad_personalization: "granted" };
    const reqGranted = buildGet(
      { measurementId: fixture.measurementId, ctx: { ...fixture.ctx, consent: { ad_storage: "granted", analytics_storage: "granted" }, consentDefault: grantedDefault } },
      event,
    );
    const reqDenied = buildGet(
      { measurementId: fixture.measurementId, ctx: { ...fixture.ctx, consent: { ad_storage: "denied", analytics_storage: "denied" }, consentDefault: grantedDefault } },
      event,
    );
    // Sanity: `gcs` is the ONLY shared-param difference — it differs (G111 vs
    // G100) while `gcd` is absent from BOTH (so it cannot be the discriminator).
    expect(new URL(reqGranted.url).searchParams.get("gcs")).toBe("G111");
    expect(new URL(reqDenied.url).searchParams.get("gcs")).toBe("G100");
    expect(new URL(reqGranted.url).searchParams.has("gcd")).toBe(false);
    expect(new URL(reqDenied.url).searchParams.has("gcd")).toBe(false);

    const outputs = coalesceGa4([reqGranted, reqDenied]);

    // Load-bearing governance guard: with ONLY `gcs` differing, if `gcs` were
    // ever misclassified as PER-EVENT (moved into the body per line) instead of
    // SHARED, the two requests' shared signatures would become identical and
    // they would MERGE into ONE POST carrying a single shared `gcs` — silently
    // batching two events under ONE consent state, the second misrepresented.
    // Keeping `gcs` SHARED forces the split; this now fails on a gcs-only
    // misclassification regression.
    expect(outputs).toHaveLength(2);
    expect(outputs.every((o) => o.method === "GET")).toBe(true);
  });
});

describe("AC4 — `_et` is RELOCATED per body line, never stamped once on the shared url", () => {
  it("the merged url carries no `_et` at all; each body line carries its OWN `_et`", () => {
    const outputs = coalesceGa4(buildFixtureGets());
    const [{ url, body }] = outputs;

    // Load-bearing: the single-GET emitter puts `_et` on the QUERY
    // (gtag.js:286-288) — if the coalescer naively reused that GET's query
    // section as the merged url instead of relocating `_et`, this would fail.
    expect(new URL(url).searchParams.has("_et")).toBe(false);
    const lines = body.split("\r\n");
    expect(lines).toHaveLength(2);
    for (const line of lines) {
      expect(line).toMatch(/(^|&)_et=100(&|$)/);
    }
  });
});

describe("AC4 — `_ee=1` is INJECTED on every body line (absent from every single GET)", () => {
  it("neither source GET carries `_ee` at all, yet both merged body lines do", () => {
    const gets = buildFixtureGets();
    for (const { url } of gets) {
      // Ground truth: `_ee` is NEVER emitted by the single-GET mapper — this
      // is a synthesis, not a re-partition of an existing param.
      expect(new URL(url).searchParams.has("ee")).toBe(false);
      expect(url).not.toContain("_ee");
    }

    const [{ body }] = coalesceGa4(gets);
    const lines = body.split("\r\n");
    expect(lines).toHaveLength(2);
    for (const line of lines) {
      expect(line).toMatch(/(^|&)_ee=1(&|$)/);
    }
  });
});

describe("AC1/AC4 — shared consent (`gcs`/`gcd`) + session-state params ride the merged POST query ONCE", () => {
  it("two same-context events carrying identical gcs/gcd/session-state merge into ONE POST that carries each shared consent/session param exactly once on the query, never in the body", () => {
    // Rich shared context: all four consent purposes DECIDED (so `gcd` emits —
    // denied-all default via unset `consentDefault`) + a session-state snapshot.
    const richCtx = {
      ...fixture.ctx,
      consent: { ad_storage: "granted", analytics_storage: "granted", ad_user_data: "granted", ad_personalization: "granted" },
      sessionState: { sct: "5", seg: "1" },
    };
    const config = { measurementId: fixture.measurementId, ctx: richCtx };
    const reqA = buildGet(config, { type: "page_view", params: { page_location: "https://example.test/p" } });
    const reqB = buildGet(config, { type: "scroll", params: { page_location: "https://example.test/p", percent_scrolled: 90 } });

    // Sanity: the shared consent/session params are present + identical on both GETs.
    for (const req of [reqA, reqB]) {
      const p = new URL(req.url).searchParams;
      expect(p.get("gcs")).toBe("G111");
      expect(p.get("gcd")).toBe("13r3r3r3r5l1");
      expect(p.get("sct")).toBe("5");
      expect(p.get("seg")).toBe("1");
    }

    const outputs = coalesceGa4([reqA, reqB]);
    expect(outputs).toHaveLength(1);
    const { url, body } = outputs[0];
    const merged = new URL(url).searchParams;

    // Each shared consent/session param lands ONCE on the merged query, never in the body.
    for (const [k, v] of [["gcs", "G111"], ["gcd", "13r3r3r3r5l1"], ["sct", "5"], ["seg", "1"]]) {
      expect(merged.get(k)).toBe(v);
      expect(url.match(new RegExp(`(^|[?&])${k.replace(".", "\\.")}=`, "g")) || []).toHaveLength(1);
      expect(body).not.toMatch(new RegExp(`(^|[&\r\n])${k}=`));
    }
    // The per-event `en` still rides the body per line (partition holds).
    expect(body.split("\r\n").map((l) => l.match(/^en=([^&]+)/)[1])).toEqual(["page_view", "scroll"]);
  });
});

describe("040-02 integration — coalesceGa4 wired as the real `coalesce` hook through createAirlock's dispatch seam", () => {
  class FakeWorker {
    constructor(url, opts) {
      FakeWorker.last = this;
      this.url = String(url);
      this.opts = opts;
      this.onmessage = null;
      this.onerror = null;
    }
    postMessage() {}
    terminate() {}
  }

  beforeEach(() => {
    FakeWorker.last = null;
    vi.stubGlobal("Worker", FakeWorker);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("a 2-event ready cycle of same-context GA4 GETs dispatches as ONE POST fetch through the real seam", () => {
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);

    createAirlock({
      trackers: 1,
      workFactor: 0,
      endpoints: [GA4_GTAG_COLLECT_ENDPOINT],
      ctx: fixture.ctx,
      unloadCritical: [],
      coalesce: coalesceGa4,
    });

    const gets = buildFixtureGets();
    FakeWorker.last.onmessage({ data: { ready: gets, dropped: [] } });

    // Load-bearing: WITHOUT the coalesce hook wired (or with coalesceGa4
    // absent), the core's default path fetches one GET per survivor — this
    // count would be 2, not 1.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      fixture.expected.url,
      expect.objectContaining({ method: "POST", body: fixture.expected.body, keepalive: true }),
    );
  });
});
