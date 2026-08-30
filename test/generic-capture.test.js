// Generic push → ring → beacon capture — spec 012-03, AC5 (pure piece).
//
// A minimal, connector-agnostic capture runtime that mirrors core/airlock.js's
// push (append to ring) + drain (flush) + dispatch (beacon) shape WITHOUT editing
// core (parallel-and-minimal, per the slice). The proposition→exposure reporter
// pushes into it, so an exposure rides the SAME generic capture path any event
// takes — the alloy rig then proves the beacon actually fires on the real page.
import { describe, it, expect, vi } from "vitest";
import { createGenericCapture } from "../rig/generic-capture.js";

describe("createGenericCapture — push enqueues, flush drains + beacons in order", () => {
  it("push appends to the ring (O(1), no beacon yet); flush drains it", () => {
    const beacon = vi.fn();
    const cap = createGenericCapture({ beacon });
    cap.push({ event: "a" });
    cap.push({ event: "b" });
    expect(cap.ringLength()).toBe(2);
    expect(beacon).not.toHaveBeenCalled(); // nothing sent until flush

    cap.flush();
    expect(cap.ringLength()).toBe(0);
    expect(beacon).toHaveBeenCalledTimes(2);
    expect(beacon.mock.calls.map((c) => c[0].event)).toEqual(["a", "b"]); // FIFO order
    expect(cap.sent.map((e) => e.event)).toEqual(["a", "b"]);
  });

  it("flush on an empty ring is a no-op (never throws, no beacon)", () => {
    const beacon = vi.fn();
    const cap = createGenericCapture({ beacon });
    expect(() => cap.flush()).not.toThrow();
    expect(beacon).not.toHaveBeenCalled();
  });

  it("tolerates a missing beacon (records sent, never throws)", () => {
    const cap = createGenericCapture({});
    cap.push({ event: "x" });
    expect(() => cap.flush()).not.toThrow();
    expect(cap.sent).toHaveLength(1);
  });
});
