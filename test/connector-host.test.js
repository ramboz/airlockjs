// Connector host — spec 012-01 (wrapped-SDK host + alloy boots), AC1 ONLY.
//
// core/chamber.worker.js hardcodes GA4's mapToMp import. This tests a NEW,
// PARALLEL module (core/connector-host.js) that generalizes the runtime side
// of contracts/connector.d.ts (manifest -> factory -> init -> handle) so a
// wrapped-SDK connector (alloy, AC2-6 of this slice) can be hosted the same
// way a wire-protocol connector (GA4, MVP1) is mapped -- WITHOUT touching
// GA4's existing path. core/chamber.worker.js, core/airlock.js, and
// connectors/ga4/ are untouched by this slice; GA4 stays green (asserted by
// the full suite, not here).
//
// Containment mirrors chamber.worker.js's mapBatch: a per-event throw
// (malformed event, or handle() throwing) is recorded in dropped[] as
// { index, type, reason } and the batch continues (ADR-0001) -- the throw
// never escapes the host.
//
// Every fake connector below is deliberately synchronous OR async at
// different points to prove the host handles both, per Connector.handle's
// `EgressRequest[] | Promise<EgressRequest[]>` contract shape.
import { describe, it, expect, vi } from "vitest";
import { createConnectorHost } from "../core/connector-host.js";

const manifest = Object.freeze({
  name: "fake/connector",
  events: ["custom"],
  reads: [],
  capabilities: {},
});

const makeEvent = (seq, overrides = {}) => ({
  seq,
  type: "custom",
  ts: seq * 10,
  payload: {},
  snapshot: {},
  ...overrides,
});

describe("connector host (spec 012-01 AC1)", () => {
  it("init(caps) runs exactly once no matter how many times it is invoked", async () => {
    const initSpy = vi.fn();
    const factory = vi.fn(() => ({ manifest, init: initSpy, handle: () => [] }));
    const host = createConnectorHost(factory, {});
    const caps = {};

    expect(factory).toHaveBeenCalledTimes(1); // instantiated once, up front

    // simulate the host being asked to init on each of several cycles --
    // e.g. a caller that (wrongly) re-sends init per cycle.
    await host.init(caps);
    await host.init(caps);
    await host.init(caps);

    expect(initSpy).toHaveBeenCalledTimes(1);
  });

  it("routes every event through ONE persisted instance — state accumulates across events", async () => {
    // counter is scoped INSIDE the factory call (instance-private state), so
    // a fresh factory() per event would reset it, while a single retained
    // instance keeps incrementing -- proving persistence, not re-construction.
    const factory = vi.fn(() => {
      let counter = 0;
      return {
        manifest,
        init: () => {},
        handle: (event) => {
          counter += 1;
          return [{ url: `https://example.com/${event.type}`, body: String(counter) }];
        },
      };
    });
    const host = createConnectorHost(factory, {});
    await host.init({});

    const { ready } = await host.routeBatch([makeEvent(1), makeEvent(2), makeEvent(3)]);

    expect(factory).toHaveBeenCalledTimes(1); // one instance for the whole batch
    expect(ready.map((r) => r.body)).toEqual(["1", "2", "3"]); // counter carried across events
  });

  it("a throwing handle() for one event is contained: dropped[], batch continues, others still yield requests, no throw escapes", async () => {
    const factory = () => ({
      manifest,
      init: () => {},
      handle: (event) => {
        if (event.type === "boom") throw new Error("handle blew up on purpose");
        return [{ url: "https://example.com/ok", body: event.type }];
      },
    });
    const host = createConnectorHost(factory, {});
    await host.init({});

    // if the throw escaped, this await would reject and fail the test --
    // resolving proves containment (no throw escapes the host).
    const { ready, dropped } = await host.routeBatch([
      makeEvent(1),
      makeEvent(2, { type: "boom" }),
      makeEvent(3),
    ]);

    expect(dropped).toEqual([{ index: 1, type: "boom", reason: "handle blew up on purpose" }]);
    expect(ready).toHaveLength(2); // events 0 and 2 still yield EgressRequests
  });

  it("a malformed event (no `type`, or null) is defensively contained by the host itself", async () => {
    // deliberately naive/permissive connector -- does NOT itself validate
    // input, to prove the containment is the HOST's own defensive check,
    // not something the connector happens to do.
    const factory = () => ({
      manifest,
      init: () => {},
      handle: () => [{ url: "https://example.com/ok", body: "fine" }],
    });
    const host = createConnectorHost(factory, {});
    await host.init({});

    const { ready, dropped } = await host.routeBatch([null, makeEvent(2), { seq: 3, ts: 0, payload: {}, snapshot: {} }]);

    expect(dropped).toHaveLength(2);
    // index 0 was the `null` event itself -- `event && event.type` short-
    // circuits to `null` (not `undefined`) for a null left operand.
    expect(dropped[0]).toMatchObject({ index: 0, type: null });
    expect(dropped[0].reason).toMatch(/malformed|type/i);
    expect(dropped[1]).toMatchObject({ index: 2, type: undefined }); // missing `type` field
    expect(dropped[1].reason).toMatch(/malformed|type/i);
    expect(ready).toHaveLength(1); // the one well-formed event still succeeds
  });

  it("reason is defensively stringified when handle() throws a non-Error value (never vanished as `undefined`)", async () => {
    const factory = () => ({
      manifest,
      init: () => {},
      handle: (event) => {
        if (event.type === "boom") throw "not an Error instance"; // eslint-disable-line no-throw-literal
        return [];
      },
    });
    const host = createConnectorHost(factory, {});
    await host.init({});

    const { dropped } = await host.routeBatch([makeEvent(1, { type: "boom" })]);

    expect(dropped).toEqual([{ index: 0, type: "boom", reason: "not an Error instance" }]);
  });

  it("the chamber survives a throw — a following batch on the SAME host maps normally (ADR-0001)", async () => {
    const factory = () => ({
      manifest,
      init: () => {},
      handle: (event) => {
        if (event.type === "boom") throw new Error("boom");
        return [{ url: "https://example.com/ok", body: event.type }];
      },
    });
    const host = createConnectorHost(factory, {});
    await host.init({});

    await host.routeBatch([makeEvent(1, { type: "boom" })]);
    const second = await host.routeBatch([makeEvent(2)]);

    expect(second.dropped).toEqual([]);
    expect(second.ready).toHaveLength(1);
  });

  it("returned EgressRequests conform to the contract shape (url, method?, headers?, body?, unloadCritical?)", async () => {
    const egress = {
      url: "https://example.com/collect",
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
      unloadCritical: true,
    };
    const factory = () => ({ manifest, init: () => {}, handle: () => [egress] });
    const host = createConnectorHost(factory, {});
    await host.init({});

    const { ready } = await host.routeBatch([makeEvent(1)]);

    expect(ready).toEqual([egress]);
  });

  it("supports an async handle() (the wrapped-SDK archetype) transparently", async () => {
    const factory = () => ({
      manifest,
      init: () => {},
      handle: async (event) => {
        await Promise.resolve();
        return [{ url: "https://example.com/async", body: event.type }];
      },
    });
    const host = createConnectorHost(factory, {});
    await host.init({});

    const { ready, dropped } = await host.routeBatch([makeEvent(1)]);

    expect(dropped).toEqual([]);
    expect(ready).toEqual([{ url: "https://example.com/async", body: "custom" }]);
  });
});
