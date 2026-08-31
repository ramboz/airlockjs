// Broker-side async mint coalescing, IN CORE — spec 014-02 (port of spec
// 012-02's test/alloy-coalescing-broker.test.js against core/coalescing-broker.js
// directly; no Worker). Same decision core, same invariants, new home.
//
// ADR-0008's mechanism: the single-threaded main-thread broker holds a second
// concurrent identity-mint and returns the FIRST's server-assigned ECID, so two
// chambers that both read empty and both first-mint attach ONE ECID, not two.
// This pins the pure decision core the browser rig (rig/alloy-coalescing-core.mjs)
// drives end-to-end, through real core-hosted chambers:
//   - the LOAD-BEARING invariant (AC1): a mint is registered SYNCHRONOUSLY in the
//     in-flight table INSIDE handleInterceptedFetch, BEFORE awaiting the real
//     dispatch — main is single-threaded, so a second handler always sees the
//     first already registered;
//   - both suppression windows (AC1): (a) IN-FLIGHT hold → the held second mint
//     gets the first's ECID on the first's response; (b) LATE → after the first
//     completes but before the second chamber minted, suppressed via a retained
//     COMPLETED-mint association, not re-dispatched;
//   - AC4: a NON-mint interact is not coalesced (passes straight through);
//   - AC1/AC3: coalescing OFF → both mints egress → two distinct ECIDs (the
//     split-identity fault), the detector's red side — proving the fix is the
//     coalescing, not the harness;
//   - AC2 (load-bearing carry, 012-02's craft fix): a first-mint dispatch FAILURE
//     REJECTS the held awaiter within a BOUNDED timeout instead of hanging it
//     forever, self-heals (does NOT poison `completed`), and a subsequent mint
//     for the same identity succeeds fresh. A regression HANGS THIS TEST, not
//     the suite (bounded below).
import { describe, it, expect } from "vitest";
import { createCoalescingBroker } from "../core/coalescing-broker.js";
import { recognizeInteract, extractEcidFromInteractResponse } from "../connectors/alloy/xdm-mint.js";

// The broker is vendor-neutral (014-02 arch-review): the alloy recognizer is INJECTED.
const mkBroker = (opts) => createCoalescingBroker({ recognize: recognizeInteract, extractIdentity: extractEcidFromInteractResponse, ...opts });

const DS = "00000000-0000-0000-0000-000000000000";
const url = (req = "r") => `https://adobedc.demdex.net/ee/v1/interact?configId=${DS}&requestId=${req}`;

function mintReq(req = "r") {
  return {
    id: "af-" + req,
    url: url(req),
    method: "POST",
    body: JSON.stringify({
      events: [{ xdm: { eventType: "web.webpagedetails.pageViews" } }],
      query: { identity: { fetch: ["ECID", "CORE"] } },
    }),
  };
}
function nonMintReq(req = "n") {
  return {
    id: "af-" + req,
    url: url(req),
    method: "POST",
    body: JSON.stringify({ events: [{ xdm: { eventType: "commerce.purchases" } }] }),
  };
}

// A minting dispatch: each REAL egress server-assigns a fresh unique ECID, in the
// Edge interact response shape alloy persists from. Records every egress so the
// tests can assert exactly how many requests actually left the broker.
function makeMintingDispatch() {
  let n = 0;
  const egress = [];
  const dispatch = async (req) => {
    n += 1;
    const ecid = "ECID-" + n + "-" + Math.random().toString(36).slice(2);
    egress.push({ url: req.url, ecid });
    return {
      status: 200,
      statusText: "OK",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        requestId: "srv",
        handle: [{ type: "identity:result", payload: [{ id: ecid, namespace: { code: "ECID" } }] }],
      }),
    };
  };
  return { dispatch, egress };
}

describe("core/coalescing-broker.js — sync-register invariant (spec 012-02 AC2, carried by spec 014-02 AC1)", () => {
  it("registers the mint in the in-flight table SYNCHRONOUSLY, before the real dispatch resolves", async () => {
    // Gate the first dispatch so it stays in-flight; assert the table is populated
    // synchronously, before we ever release/await.
    let release;
    const gate = new Promise((r) => { release = r; });
    const egress = [];
    const dispatch = async (req) => {
      egress.push(req.url);
      await gate; // hold the first mint in-flight
      return { status: 200, body: JSON.stringify({ handle: [{ type: "identity:result", payload: [{ id: "ECID-A", namespace: { code: "ECID" } }] }] }) };
    };
    const broker = mkBroker({ dispatch, coalescing: true });

    const pA = broker.handleInterceptedFetch(mintReq("A")); // NOT awaited
    // The load-bearing invariant: registered synchronously, before any await settles.
    expect(broker.inFlightCount()).toBe(1);
    expect(egress.length).toBe(1); // dispatched, but held (unresolved)

    release();
    const rA = await pA;
    expect(rA.ecid).toBe("ECID-A");
    expect(broker.inFlightCount()).toBe(0); // cleared after completion
    expect(broker.completedCount()).toBe(1); // retained as a completed-mint association
  });
});

describe("core/coalescing-broker.js — window (a): in-flight hold (spec 012-02 AC2, carried by spec 014-02 AC1)", () => {
  it("holds a second concurrent mint while the first is in flight and returns the FIRST's ECID — ONE egress", async () => {
    let release;
    const gate = new Promise((r) => { release = r; });
    const { dispatch: mint, egress } = makeMintingDispatch();
    let heldSignals = 0;
    const dispatch = async (req) => {
      // hold ONLY the first mint until the second has arrived at the broker
      if (egress.length === 0) { const r = await mint(req); await gate; return r; }
      return mint(req);
    };
    const broker = mkBroker({
      dispatch,
      coalescing: true,
      onHeldInFlight: () => { heldSignals += 1; release(); }, // second arrived → let the first complete
    });

    const pA = broker.handleInterceptedFetch(mintReq("A")); // first mint, held in-flight
    const pB = broker.handleInterceptedFetch(mintReq("B")); // arrives while A in-flight → held
    const [rA, rB] = await Promise.all([pA, pB]);

    expect(heldSignals).toBe(1); // the in-flight window was actually exercised
    expect(rB.coalesced).toBe("held-in-flight");
    expect(rA.ecid).toBe(rB.ecid); // ONE ECID for both chambers
    expect(egress.length).toBe(1); // exactly ONE real Edge request egressed
  });
});

describe("core/coalescing-broker.js — window (b): late suppression (spec 012-02 AC2, carried by spec 014-02 AC1)", () => {
  it("suppresses a late second mint via the retained completed-mint association — no re-dispatch", async () => {
    const { dispatch, egress } = makeMintingDispatch();
    const broker = mkBroker({ dispatch, coalescing: true });

    const rA = await broker.handleInterceptedFetch(mintReq("A")); // completes first
    expect(broker.completedCount()).toBe(1);
    const rB = await broker.handleInterceptedFetch(mintReq("B")); // arrives LATE

    expect(rB.coalesced).toBe("late-suppressed");
    expect(rB.ecid).toBe(rA.ecid); // same ECID
    expect(egress.length).toBe(1); // still ONE egress — the late mint was not re-dispatched
  });
});

describe("core/coalescing-broker.js — AC4: non-mint passes through", () => {
  it("does NOT coalesce a non-mint interact — it dispatches every time", async () => {
    const { dispatch, egress } = makeMintingDispatch();
    const broker = mkBroker({ dispatch, coalescing: true });

    const r1 = await broker.handleInterceptedFetch(nonMintReq("n1"));
    const r2 = await broker.handleInterceptedFetch(nonMintReq("n2"));

    expect(r1.coalesced).toBe("passthrough");
    expect(r2.coalesced).toBe("passthrough");
    expect(egress.length).toBe(2); // both non-mints egressed (not suppressed)
  });

  it("coalesces mints but still lets an interleaved non-mint through (mixed traffic)", async () => {
    const { dispatch, egress } = makeMintingDispatch();
    const broker = mkBroker({ dispatch, coalescing: true });

    const rA = await broker.handleInterceptedFetch(mintReq("A"));   // mint → egress 1
    const rNon = await broker.handleInterceptedFetch(nonMintReq()); // non-mint → egress 2
    const rB = await broker.handleInterceptedFetch(mintReq("B"));   // late mint → suppressed

    expect(rA.ecid).toBe(rB.ecid);
    expect(rNon.coalesced).toBe("passthrough");
    expect(egress.length).toBe(2); // the two mints coalesced to 1; the non-mint added 1
  });
});

describe("core/coalescing-broker.js — liveness: first-mint dispatch failure settles held awaiters (spec 014-02 AC2, the load-bearing carry)", () => {
  it("rejects (does not hang) a held second mint when the first mint's dispatch REJECTS, then self-heals on retry", async () => {
    // Without the fix, `pB` below awaits an in-flight promise that is only ever
    // `resolve`d — a rejecting first-mint dispatch leaves it unsettled forever,
    // so this assertion would time out (bounded below) instead of the suite
    // hanging outright.
    let release;
    const gate = new Promise((r) => { release = r; });
    let firstCall = true;
    const dispatch = async (_req) => {
      if (firstCall) {
        firstCall = false;
        await gate; // hold the first mint in-flight until the second has arrived
        throw new Error("edge-5xx"); // the first mint's REAL dispatch fails
      }
      // a later call (the post-failure retry) succeeds normally
      return {
        status: 200,
        body: JSON.stringify({ handle: [{ type: "identity:result", payload: [{ id: "ECID-RETRY", namespace: { code: "ECID" } }] }] }),
      };
    };
    const broker = mkBroker({
      dispatch,
      coalescing: true,
      onHeldInFlight: () => release(), // second arrived → let the first's (failing) dispatch proceed
    });

    const pA = broker.handleInterceptedFetch(mintReq("A")); // first mint, will reject
    const pB = broker.handleInterceptedFetch(mintReq("B")); // arrives while A in-flight → held

    await expect(pA).rejects.toThrow("edge-5xx"); // the first-mint caller sees the real failure
    await expect(pB).rejects.toThrow("edge-5xx"); // the HELD awaiter is settled, not stranded

    expect(broker.inFlightCount()).toBe(0); // the failed mint's in-flight entry was cleared
    expect(broker.completedCount()).toBe(0); // NOT populated on failure — a retry mints fresh

    // Self-heal: a fresh mint for the same identity after the failure succeeds.
    const rC = await broker.handleInterceptedFetch(mintReq("C"));
    expect(rC.coalesced).toBe("first");
    expect(rC.ecid).toBe("ECID-RETRY");
  }, 2000); // bounded — a regression (the pre-fix hang) fails fast instead of hanging the suite
});

describe("core/coalescing-broker.js — AC1/AC3: coalescing OFF reproduces the fault", () => {
  it("with coalescing OFF, two concurrent mints BOTH egress and yield DISTINCT ECIDs (split identity)", async () => {
    const { dispatch, egress } = makeMintingDispatch();
    const broker = mkBroker({ dispatch, coalescing: false });

    const rA = await broker.handleInterceptedFetch(mintReq("A"));
    const rB = await broker.handleInterceptedFetch(mintReq("B"));

    expect(egress.length).toBe(2); // both minted — the fault the fix later prevents
    expect(rA.ecid).not.toBe(rB.ecid); // two distinct ECIDs → split identity
    expect(broker.inFlightCount()).toBe(0); // no coalescing tables engaged when off
    expect(broker.completedCount()).toBe(0);
  });

  it("the SAME two-mint sequence flips outcome purely on the coalescing flag (detector both ways)", async () => {
    const off = makeMintingDispatch();
    const brokerOff = mkBroker({ dispatch: off.dispatch, coalescing: false });
    const offA = await brokerOff.handleInterceptedFetch(mintReq("A"));
    const offB = await brokerOff.handleInterceptedFetch(mintReq("B"));

    const on = makeMintingDispatch();
    const brokerOn = mkBroker({ dispatch: on.dispatch, coalescing: true });
    const onA = await brokerOn.handleInterceptedFetch(mintReq("A"));
    const onB = await brokerOn.handleInterceptedFetch(mintReq("B")); // late → suppressed

    const offDistinct = new Set([offA.ecid, offB.ecid]).size;
    const onDistinct = new Set([onA.ecid, onB.ecid]).size;
    expect(offDistinct).toBe(2); // OFF → split identity
    expect(onDistinct).toBe(1); // ON → coherent single identity
    expect(off.egress.length).toBe(2);
    expect(on.egress.length).toBe(1);
  });
});
