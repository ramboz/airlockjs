// Gate-able minting-Edge stub — spec 012-02, AC5 (pure piece).
//
// AC5's determinism comes from RESPONSE-TIMING CONTROL: the minting stub can HOLD
// the first mint's response until the second chamber's mint has arrived at the
// broker, so the in-flight coalescing window is CONSTRUCTED, not raced-for. These
// tests pin the park/release gate the browser rig drives end-to-end.
import { describe, it, expect } from "vitest";
import { createGatedMintStub } from "../rig/alloy-mint-stub.js";

describe("createGatedMintStub — response-timing control (spec 012-02 AC5)", () => {
  it("responds immediately when NOT held (the coalescing-off / non-mint path)", async () => {
    const stub = createGatedMintStub();
    const { response, ecid } = await stub.handle({ hold: false });
    expect(typeof ecid).toBe("string");
    expect(response.handle.some((h) => h.type === "identity:result")).toBe(true);
    expect(stub.parkedCount()).toBe(0);
  });

  it("PARKS a held response until releaseFirst() — the first mint waits for the second to arrive", async () => {
    const stub = createGatedMintStub();
    let settled = false;
    const p = stub.handle({ hold: true }).then((r) => { settled = true; return r; });

    // The held response is parked, NOT yet resolved (the in-flight window is open).
    await Promise.resolve();
    expect(stub.parkedCount()).toBe(1);
    expect(settled).toBe(false);

    // The broker releases it once the second mint has arrived at the broker.
    expect(stub.releaseFirst()).toBe(true);
    const { ecid } = await p;
    expect(settled).toBe(true);
    expect(typeof ecid).toBe("string");
    expect(stub.parkedCount()).toBe(0);
  });

  it("mints a UNIQUE ECID per non-coalesced call (two held mints yield distinct ECIDs)", async () => {
    const stub = createGatedMintStub();
    const p1 = stub.handle({ hold: true });
    const p2 = stub.handle({ hold: true });
    expect(stub.parkedCount()).toBe(2);
    expect(stub.releaseAll()).toBe(2);
    const [a, b] = await Promise.all([p1, p2]);
    expect(a.ecid).not.toBe(b.ecid); // the mint: each un-coalesced call is a distinct identity
  });

  it("releaseFirst() returns false when nothing is parked", () => {
    const stub = createGatedMintStub();
    expect(stub.releaseFirst()).toBe(false);
  });

  it("release-before-park: a release that arrives FIRST is consumed by the next held interact (no deadlock)", async () => {
    // In the browser rig the broker's release is a separate HTTP request that can
    // beat the parked interact to the server. The armed pending release must let
    // the subsequently-parked interact resolve immediately.
    const stub = createGatedMintStub();
    expect(stub.releaseFirst()).toBe(false); // arms a pending release
    expect(stub.pendingReleaseCount()).toBe(1);
    const { ecid } = await stub.handle({ hold: true }); // consumes the pending release
    expect(typeof ecid).toBe("string");
    expect(stub.parkedCount()).toBe(0);
    expect(stub.pendingReleaseCount()).toBe(0);
  });
});
