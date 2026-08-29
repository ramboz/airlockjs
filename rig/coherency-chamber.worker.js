// A worker "chamber" for the MVP2 coherency rig (spec 011-01).
//
// This is a REAL dedicated Web Worker — a separate agent with its own realm and
// its own memory. It has NO cookie API (R-006 F1: no `document`, no `cookieStore`
// on DedicatedWorkerGlobalScope), so it cannot reach the authoritative jar; it
// holds only a synchronous CACHE of the shared identity cookie, seeded at boot
// from the main-thread broker and written back asynchronously. Two of these,
// each with its own cache, are the worst-case Option-B coherency topology (AC1):
// every cross-chamber propagation is forced through the async postMessage hop.
//
// The cache and the identity RMW logic live in the shared pure model
// (coherency-model.mjs) so the behaviour here is byte-identical to the in-memory
// chamber the vitest suite exercises — the browser run proves the cross-thread
// topology; the unit test pins the same logic hermetically.
import { chamberIdentityStep } from "./coherency-model.mjs";

// The sync-cache lives in module scope — a synchronous read (`op:"read"`) returns
// it with no cross-thread round trip, which is exactly why it can go stale.
let state = { id: null, cache: "" };

self.onmessage = (e) => {
  const msg = e.data || {};
  const { state: next, reply } = chamberIdentityStep(state, msg);
  state = next;
  // Echo the correlation id so the broker can match this reply to its request.
  self.postMessage({ rid: msg.rid, ...reply });
};
