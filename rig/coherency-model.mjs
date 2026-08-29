// Pure model for the MVP2 coherency probe (spec 011-01).
//
// This file is the DETERMINISTIC, side-effect-free core the coherency rig is
// built from, and it is shared THREE ways so the logic under test is the same
// everywhere:
//   1. rig/coherency-chamber.worker.js  — the real in-browser Worker chamber
//      imports `chamberIdentityStep` and holds one `cache` in its module scope.
//   2. rig/coherency.mjs                — the Node rig drives two REAL Workers
//      through `runBroker` (AC1's cross-thread topology).
//   3. test/coherency-model.test.js     — vitest drives `runBroker` against
//      `createInMemoryChamber` (same step logic, no browser) to pin the
//      classifier hermetically.
//
// Grounding (R-006): a dedicated Worker has NO cookie API, so the main thread is
// the sole cookie authority and each chamber holds a *cache*. No AD-4-compatible
// channel gives synchronous cross-agent reads, so a synchronous read is served
// from that cache and a non-zero staleness window is unavoidable. The probe does
// NOT hunt for zero staleness (impossible without SharedArrayBuffer); it measures
// whether the unavoidable staleness is a *correctness* fault for shared identity.
//
// Modelled cookie: one shared first-party identity cookie `AMCV_<ORG>` whose
// value is `MCMID|<ECID>` (R-004). An empty ECID marks a new visitor; the
// identity-consuming op mints one. Two concurrent mints => two distinct ECIDs =>
// a split / duplicate identity, the canonical Adobe identity fault.

/** The AMCV value shape is `MCMID|<ecid>`; extract the ECID (empty = new visitor). */
export function parseAmcv(value) {
  const s = String(value ?? "");
  const bar = s.indexOf("|");
  return { ecid: bar >= 0 ? s.slice(bar + 1) : "" };
}

/** Build the `MCMID|<ecid>` value from an ECID (empty ECID => `MCMID|`). */
export function amcvValue(ecid) {
  return "MCMID|" + (ecid || "");
}

/**
 * Deterministic, chamber-scoped ECID. Real ECIDs are 38-digit server-issued
 * strings; live issuance is out of scope (R-004), so this is shape-only. It is
 * deterministic per chamber so runs are reproducible (DoD) AND so two chambers
 * minting concurrently produce DISTINCT ids — exactly the split-identity fault.
 */
export function mintEcid(chamberId) {
  return "ECID-" + chamberId;
}

/**
 * The identity-consuming RMW a chamber performs off its cached value (AC5): read
 * the cached identity; if there is no ECID, MINT one (new visitor); otherwise
 * ATTACH the existing one (no mint). A *stale* empty read here is what causes a
 * duplicate mint.
 */
export function identityRmw(cachedValue, chamberId) {
  const { ecid } = parseAmcv(cachedValue);
  if (ecid) {
    return { newValue: amcvValue(ecid), minted: null, action: "attach", ecid };
  }
  const fresh = mintEcid(chamberId);
  return { newValue: amcvValue(fresh), minted: fresh, action: "mint", ecid: fresh };
}

/**
 * The pure worker-side transition. `state` = { id, cache }. Returns the next
 * state and the reply the chamber posts back to the broker. The real Worker and
 * the in-memory chamber both delegate here so their behaviour is identical.
 *   init      — set the chamber id (for minting)
 *   seed      — seed the sync-cache at boot from the broker's authoritative value
 *   read      — a synchronous cache read (does not mutate the cache)
 *   commit    — the identity RMW: read cache, mint/attach, write cache, write back
 *   invalidate— broker-push invalidation: overwrite the cache with the pushed value
 */
export function chamberIdentityStep(state, msg) {
  switch (msg.op) {
    case "init":
      return { state: { ...state, id: msg.id }, reply: { op: "init-ack", id: msg.id } };
    case "seed":
      return { state: { ...state, cache: msg.value }, reply: { op: "seeded", value: msg.value } };
    case "read":
      return { state, reply: { op: "read-result", value: state.cache } };
    case "commit": {
      const basis = state.cache;
      const { newValue, minted, action } = identityRmw(basis, state.id);
      return {
        state: { ...state, cache: newValue },
        reply: { op: "writeback", value: newValue, minted, action, basis },
      };
    }
    case "invalidate":
      return { state: { ...state, cache: msg.value }, reply: { op: "invalidated", value: msg.value } };
    default:
      return { state, reply: { op: "noop" } };
  }
}

/** An in-memory chamber (test transport). Same step logic as the real Worker. */
export function createInMemoryChamber(id) {
  let state = { id, cache: "" };
  return {
    handle(msg) {
      const { state: next, reply } = chamberIdentityStep(state, msg);
      state = next;
      return reply;
    },
    peek() { return state.cache; },
  };
}

/**
 * Coherence verdict (AC3): do the live caches agree with each other AND with the
 * authoritative jar? A cache that holds a value already superseded in the jar
 * (a lost update) makes `agreeWithJar` false.
 */
export function coherence(caches, jar) {
  const values = Object.values(caches).filter((v) => v !== undefined);
  const cachesAgree = values.every((v) => v === values[0]);
  const agreeWithJar = values.every((v) => v === jar);
  return { coherent: cachesAgree && agreeWithJar, cachesAgree, agreeWithJar, caches: { ...caches }, jar };
}

/**
 * Correctness classification (AC5) — the instrument the go/no-go turns on. Not a
 * window width: the number of DISTINCT identities minted for one visitor.
 *   > 1 distinct mint          => fault  (split / duplicate identity)
 *   1 mint, a stale read seen  => self-heal (the stale value reconciled before it
 *                                 was consumed by the identity op)
 *   1 mint, no stale read      => coherent (no divergence at all)
 */
export function classifyIdentity({ mints, staleReadOccurred }) {
  const distinctEcids = [...new Set((mints || []).filter(Boolean))];
  if (distinctEcids.length > 1) {
    return { verdict: "fault", kind: "split-identity", distinctEcids };
  }
  if (staleReadOccurred) {
    return { verdict: "self-heal", kind: "reconciled-before-consumption", distinctEcids };
  }
  return { verdict: "coherent", kind: "no-divergence", distinctEcids };
}

/**
 * Staleness window (AC3), measured in broker OPS (deterministic; time is flaky).
 * Each op-log entry snapshots the jar and every chamber's cache after one broker
 * op. Because a chamber's cache only ever changes via its own commit (which moves
 * the jar in the same op) or a push (which sets it to the jar), any snapshot where
 * `cache !== jar` means the chamber is BEHIND — holding a value already superseded
 * in the jar. That is precisely AC3's "synchronous read returned a value already
 * superseded in the jar." A span that is still open at the last op never
 * reconciled within the page (the seed+async-write-back lost-update signature).
 */
export function stalenessWindow(opLog, chamberIds) {
  const lastOp = opLog.length ? opLog[opLog.length - 1].op : 0;
  const perChamber = {};
  let staleReadOccurred = false;
  let maxStalenessOps = 0;
  let anyOpenAtEnd = false;

  for (const ch of chamberIds) {
    const spans = [];
    let open = null;
    for (const entry of opLog) {
      const val = entry.caches[ch];
      const stale = val !== undefined && val !== entry.jar;
      if (stale && !open) {
        open = { from: entry.op, fromLabel: entry.label, staleValue: val, jarValue: entry.jar, ops: 1 };
      } else if (stale && open) {
        open.ops += 1;
      } else if (!stale && open) {
        open.to = entry.op;
        open.reconciled = true;
        spans.push(open);
        open = null;
      }
    }
    let openAtEnd = false;
    if (open) {
      open.to = lastOp;
      open.reconciled = false;
      openAtEnd = true;
      spans.push(open);
    }
    const everStale = spans.length > 0;
    const maxOps = spans.reduce((m, s) => Math.max(m, s.ops), 0);
    perChamber[ch] = { everStale, spans, maxOps, openAtEnd };
    staleReadOccurred = staleReadOccurred || everStale;
    maxStalenessOps = Math.max(maxStalenessOps, maxOps);
    anyOpenAtEnd = anyOpenAtEnd || openAtEnd;
  }

  return {
    staleReadOccurred,
    maxStalenessOps,
    // Every stale span closed before the run ended => the divergence reconciled
    // without SAB; an open span => a lost update that never reconciled in-page.
    reconciledWithinRun: staleReadOccurred && !anyOpenAtEnd,
    perChamber,
  };
}

/**
 * The broker: main-thread authority owning the jar, driving a scripted, fully
 * SEQUENCED interleaving of the chambers (each step awaits its reply before the
 * next is sent — so the race is reproduced by construction, not by scheduler
 * luck). `send(chamberId, msg) => Promise<reply>` is the transport (real
 * postMessage in the browser; in-memory in the test). `onJarChange(value)` is an
 * optional effect so the browser can mirror the authoritative value into the
 * REAL `document.cookie` (AC1: the jar is the real cookie).
 *
 * Returns the full, programmatically-retrievable scoreboard for one scenario.
 */
export async function runBroker({ name, mechanism, chambers, steps, jarSeed = amcvValue(""), send, onJarChange }) {
  let jar = jarSeed;
  const applyJar = (v) => { jar = v; if (onJarChange) onJarChange(v); };
  applyJar(jarSeed);

  // Boot each chamber: set its id, then seed its sync-cache from the authority.
  for (const id of chambers) {
    await send(id, { op: "init", id });
    await send(id, { op: "seed", value: jarSeed });
  }

  const opLog = [];
  const mints = [];
  const readTrace = [];
  let op = 0;

  // Snapshot the jar + every chamber's cache via a synchronous read on each.
  // These reads ARE the synchronous reads AC3 measures for staleness.
  const snapshot = async (label) => {
    const caches = {};
    for (const id of chambers) {
      const r = await send(id, { op: "read" });
      caches[id] = r.value;
    }
    opLog.push({ op: op++, label, jar, caches });
  };

  await snapshot("seed");

  for (const step of steps) {
    if (step.op === "read" || step.op === "observe") {
      const r = await send(step.chamber, { op: "read" });
      // A read is stale if the value it returned is already superseded in the jar.
      readTrace.push({ chamber: step.chamber, kind: step.op, value: r.value, jar, stale: r.value !== jar });
      await snapshot(`${step.op} ${step.chamber}`);
    } else if (step.op === "commit") {
      const r = await send(step.chamber, { op: "commit" });
      if (r.minted) mints.push(r.minted);
      applyJar(r.value); // async write-back lands at the authority
      await snapshot(`commit ${step.chamber}`);
    } else if (step.op === "push") {
      // Broker-push invalidation: push the current authoritative value into a cache.
      await send(step.target, { op: "invalidate", value: jar });
      await snapshot(`push ${step.target}`);
    }
  }

  const finalCaches = opLog.length ? opLog[opLog.length - 1].caches : {};
  const coh = coherence(finalCaches, jar);
  const staleness = stalenessWindow(opLog, chambers);
  const identity = classifyIdentity({ mints, staleReadOccurred: staleness.staleReadOccurred });

  return {
    scenario: name,
    mechanism,
    chambers,
    jarSeed,
    jarFinal: jar,
    finalCaches,
    mints,
    coherence: coh,
    identity,
    staleness,
    readTrace,
    opLog,
  };
}

/**
 * The three scenarios that make the detector fail BOTH ways (DoD). They share the
 * same primitive ops (read / observe / commit / push); only the interleaving and
 * the presence of broker-push differ — that is the controllable knob (AC2).
 */
export const SCENARIOS = {
  // Mechanism A (R-006): seed + async write-back, NO invalidation. Both chambers
  // read the shared cookie before either writes back -> both see the empty seed ->
  // both mint -> lost update + split identity. The divergent run.
  "concurrent-async-writeback": {
    name: "concurrent-async-writeback",
    mechanism: "seed + async write-back (no invalidation) — R-006 option A",
    chambers: ["c1", "c2"],
    steps: [
      { op: "read", chamber: "c1" },
      { op: "read", chamber: "c2" },
      { op: "commit", chamber: "c1" }, // jar -> MCMID|ECID-c1 ; c2 now stale
      { op: "commit", chamber: "c2" }, // c2 mints off its stale empty cache -> jar -> MCMID|ECID-c2 (clobbers)
    ],
  },

  // Control: one chamber, one cache — divergence is structurally impossible.
  "single-chamber": {
    name: "single-chamber",
    mechanism: "single chamber (one cache) — trivially coherent control",
    chambers: ["c1"],
    steps: [
      { op: "read", chamber: "c1" },
      { op: "commit", chamber: "c1" }, // jar -> MCMID|ECID-c1
    ],
  },

  // Control: mechanism B (R-006), broker-push invalidation. c2 DOES momentarily
  // read the stale (empty) value, but the broker pushes the authoritative value
  // before c2's identity op consumes it -> c2 attaches the existing ECID rather
  // than minting a duplicate. A stale read that self-heals before consumption.
  "broker-push": {
    name: "broker-push",
    mechanism: "broker-push invalidation on change — R-006 option B",
    chambers: ["c1", "c2"],
    steps: [
      { op: "read", chamber: "c1" },
      { op: "commit", chamber: "c1" }, // jar -> MCMID|ECID-c1 ; c2 now stale
      { op: "observe", chamber: "c2" }, // c2 sync-reads the stale empty value (recorded)
      { op: "push", target: "c2" }, // broker-push invalidation reconciles c2 -> MCMID|ECID-c1
      { op: "read", chamber: "c2" }, // c2 now reads the fresh value
      { op: "commit", chamber: "c2" }, // attaches ECID-c1, mints NOTHING -> jar stays MCMID|ECID-c1
    ],
  },
};
