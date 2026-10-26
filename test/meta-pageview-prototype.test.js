import { describe, expect, it } from "vitest";
import { createConnectorHost } from "../core/connector-host.js";
import { createMetaPageViewPrototype } from "../connectors/meta-pixel/pageview-prototype.js";

const endpoint = "http://127.0.0.1:43210/tr/";
const pixelId = "000000000000000";
const context = {
  pageURL: "https://example.test/first?from=local#one",
  referrer: "https://example.test/previous",
  inFrame: false,
  screenWidth: 412,
  screenHeight: 823,
  timezoneOffset: -420,
};
const command = (args, page = context) => ({
  type: "meta-pixel-command", seq: 1, ts: 0, snapshot: {}, payload: { args, context: page },
});

describe("offline first-party PageView connector", () => {
  it("retains init state without a beacon and constructs only eight explicit PageView fields", async () => {
    const host = createConnectorHost(createMetaPageViewPrototype, { endpoint });
    await host.init({});
    expect(await host.routeBatch([command(["init", pixelId])])).toEqual({ ready: [], dropped: [] });
    const result = await host.routeBatch([command(["track", "PageView"])]);
    expect(result.dropped).toEqual([]);
    expect(result.ready).toHaveLength(1);
    expect(result.ready[0].method).toBe("GET");
    expect(result.ready[0].body).toBeUndefined();
    expect(Object.fromEntries(new URL(result.ready[0].url).searchParams)).toEqual({
      id: pixelId, ev: "PageView", dl: context.pageURL, rl: context.referrer,
      if: "false", sw: "412", sh: "823", tz: "-420",
    });
    expect(host.manifest).toMatchObject({
      reads: [], capabilities: { egress: true }, endpoints: [endpoint],
      purposes: { egress: ["ad_storage"] },
    });
  });

  it("rejects bad state, unsupported commands, non-synthetic IDs and malformed context without partial requests", async () => {
    const host = createConnectorHost(createMetaPageViewPrototype, { endpoint });
    await host.init({});
    const rejected = async (args, reason, page = context) => {
      const result = await host.routeBatch([command(args, page)]);
      expect(result.ready).toEqual([]);
      expect(result.dropped).toEqual([{ index: 0, type: "meta-pixel-command", reason }]);
    };
    await rejected(["track", "PageView"], "pageview-before-init");
    await rejected(["init", "123"], "synthetic-pixel-required");
    await host.routeBatch([command(["init", pixelId])]);
    await rejected(["init", pixelId], "duplicate-init");
    await rejected(["track", "Purchase"], "unsupported-command");
    await rejected(["track", "PageView", "extra"], "unsupported-command");
    await rejected(["track", "PageView"], "invalid-context", { ...context, inFrame: "false" });
    for (const changed of [
      { pageURL: "javascript:alert(1)" }, { pageURL: "https://user:pass@example.test/" },
      { pageURL: "x".repeat(2049) }, { referrer: undefined }, { screenWidth: -1 },
      { screenHeight: 1.5 }, { timezoneOffset: 1441 }, { fbp: "not-an-approved-field" },
    ]) await rejected(["track", "PageView"], "invalid-context", { ...context, ...changed });
    expect((await host.routeBatch([command(["track", "PageView"])])).ready).toHaveLength(1);
    for (const badEndpoint of [
      undefined, "https://www.facebook.com/tr", "http://localhost:43210/tr/",
      "http://127.0.0.1:43210/tr/?x=1", "http://127.0.0.1:43210/tr",
    ]) expect(() => createMetaPageViewPrototype({ endpoint: badEndpoint })).toThrow("literal-loopback-endpoint-required");
  });

  it("bounds the encoded GET, not just input string lengths, before requesting any transport", async () => {
    const host = createConnectorHost(createMetaPageViewPrototype, { endpoint });
    await host.init({});
    await host.routeBatch([command(["init", pixelId])]);
    const result = await host.routeBatch([command(["track", "PageView"], {
      ...context, pageURL: `https://example.test/${"é".repeat(1500)}`,
    })]);
    expect(result.ready).toEqual([]);
    expect(result.dropped).toEqual([{ index: 0, type: "meta-pixel-command", reason: "encoded-context-limit" }]);
  });
});
