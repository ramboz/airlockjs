// Pure model for the MVP2 coherency probe (spec 011-01 in-band + 011-02 out-of-band).
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
 *
 * An ABSENT cache (undefined, or an empty caches map) is INCOHERENT, not
 * vacuously coherent (011-01 craft-review nit #1, forward-logged here): an
 * out-of-band writer (011-02) can legitimately leave a chamber's cache
 * unseeded/cleared, and a broker that cannot see a chamber's view cannot claim
 * that view agrees. The old `filter(undefined)` + `[].every()` reported an
 * all-absent set as coherent:true — a latent trap this slice closes.
 */
export function coherence(caches, jar) {
  const values = Object.values(caches);
  const anyAbsent = values.length === 0 || values.some((v) => v === undefined);
  const present = values.filter((v) => v !== undefined);
  const cachesAgree = !anyAbsent && present.every((v) => v === present[0]);
  const agreeWithJar = !anyAbsent && present.every((v) => v === jar);
  return { coherent: cachesAgree && agreeWithJar, cachesAgree, agreeWithJar, anyAbsent, caches: { ...caches }, jar };
}

/**
 * Distinct non-empty ECIDs that were ever asserted as this visitor's identity in
 * the authoritative jar, in first-seen order (011-02). This is the identity set
 * the fault classifier judges over: it includes an OUT-OF-BAND write (a foreign
 * script / second tab writing the real cookie), not only the chambers' own mints —
 * so a chamber minting a duplicate ALONGSIDE a pre-existing foreign identity reads
 * as a split, which a chamber-mint count alone would miss.
 */
export function jarIdentityHistory(opLog) {
  const seen = [];
  for (const entry of opLog) {
    const { ecid } = parseAmcv(entry.jar);
    if (ecid && !seen.includes(ecid)) seen.push(ecid);
  }
  return seen;
}

/**
 * Correctness classification (AC5) — the instrument the go/no-go turns on. Not a
 * window width: the number of DISTINCT identities asserted for one visitor.
 *   > 1 distinct identity        => fault  (split / duplicate identity)
 *   1 identity, a stale read seen => self-heal (the stale value reconciled before
 *                                    it was consumed by the identity op)
 *   1 identity, no stale read     => coherent (no divergence at all)
 *
 * `identities` (the full jar identity history, incl. out-of-band writes — 011-02)
 * is preferred when supplied; otherwise it falls back to the chambers' `mints`
 * (the in-band-only callers and the direct unit tests). Both count DISTINCT ids.
 */
export function classifyIdentity({ mints, identities, staleReadOccurred }) {
  const source = identities !== undefined ? identities : mints;
  const distinctEcids = [...new Set((source || []).filter(Boolean))];
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
 * Out-of-band staleness decomposition (011-02, grounding R-006 F4). When a
 * scenario contains an `oob` op (a foreign write to the jar, from outside any
 * chamber), the chamber-visible staleness has TWO components: the broker's
 * DETECTION lag (from the foreign write until the broker learns of it — a
 * cookieStore `change` / poll, modelled by the `detect` op) and the PROPAGATION
 * lag (detection until the broker's push reconciles the cache). `reconcileOp` is
 * the first op after the write at which every present cache is back to the jar;
 * `reconciledToOobValue` distinguishes a genuine heal to the foreign identity
 * (option B) from a chamber clobbering the jar with its OWN duplicate mint
 * (option A — the cache re-equals the jar, but at the wrong, split value).
 */
export function oobDecomposition(opLog, chamberIds) {
  const oobEntry = opLog.find((e) => typeof e.label === "string" && e.label.startsWith("oob"));
  if (!oobEntry) return null;
  const detectEntry = opLog.find((e) => e.op > oobEntry.op && e.label === "detect");
  const reconcileEntry = opLog.find((e) =>
    e.op > oobEntry.op && chamberIds.every((ch) => e.caches[ch] === undefined || e.caches[ch] === e.jar));
  const oobOp = oobEntry.op;
  const oobValue = oobEntry.jar; // the foreign write landed here (jar := value)
  const detectOp = detectEntry ? detectEntry.op : null;
  const reconcileOp = reconcileEntry ? reconcileEntry.op : null;
  return {
    oobValue,
    oobOp,
    detectOp,
    reconcileOp,
    detectionLagOps: detectOp != null ? detectOp - oobOp : null,
    propagationLagOps: detectOp != null && reconcileOp != null ? reconcileOp - detectOp : null,
    totalStalenessOps: reconcileOp != null ? reconcileOp - oobOp : null,
    // Did a chamber's cache adopt the FOREIGN identity (a real heal), vs re-equal
    // the jar only because the chamber clobbered it with its own duplicate mint?
    reconciledToOobValue: !!reconcileEntry && reconcileEntry.jar === oobValue,
  };
}

/**
 * The broker: main-thread authority owning the jar, driving a scripted, fully
 * SEQUENCED interleaving of the chambers (each step awaits its reply before the
 * next is sent — so the race is reproduced by construction, not by scheduler
 * luck). `send(chamberId, msg) => Promise<reply>` is the transport (real
 * postMessage in the browser; in-memory in the test). `onJarChange(value)` is an
 * optional effect so the browser can mirror the authoritative value into the
 * REAL `document.cookie` (AC1: the jar is the real cookie). `onOobWrite(value,
 * writer)` is the out-of-band effect (011-02): a FOREIGN actor (not the broker)
 * writes the real cookie directly, so the browser routes an `oob` op through a
 * different writer to keep its provenance genuinely out-of-band.
 *
 * Returns the full, programmatically-retrievable scoreboard for one scenario.
 */
export async function runBroker({ name, mechanism, source, chambers, steps, jarSeed = amcvValue(""), send, onJarChange, onOobWrite }) {
  let jar = jarSeed;
  const applyJar = (v) => { jar = v; if (onJarChange) onJarChange(v); };
  // A foreign, out-of-band write: the jar (real cookie) moves, but the broker is
  // NOT notified and no chamber cache is touched — the write came from outside.
  const applyOobJar = (v, writer) => { jar = v; if (onOobWrite) onOobWrite(v, writer); };
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
    } else if (step.op === "oob") {
      // Out-of-band write (011-02): a FOREIGN actor writes the real cookie. The
      // jar moves; no chamber cache is touched and the broker is not yet notified,
      // so every chamber cache is now silently stale until a detect+push.
      applyOobJar(step.value, step.writer);
      await snapshot(`oob ${step.writer || "foreign"}`);
    } else if (step.op === "detect") {
      // The broker LEARNS of the out-of-band write (cookieStore `change` fired, or
      // a document.cookie poll hit) — the boundary between detection lag and
      // propagation lag (R-006 F4). A read-only marker; the jar already moved.
      await snapshot("detect");
    }
  }

  const finalCaches = opLog.length ? opLog[opLog.length - 1].caches : {};
  const coh = coherence(finalCaches, jar);
  const staleness = stalenessWindow(opLog, chambers);
  // Judge the fault over EVERY distinct identity asserted for the visitor —
  // including an out-of-band write — not just the chambers' own mints (011-02).
  const identity = classifyIdentity({
    mints,
    identities: jarIdentityHistory(opLog),
    staleReadOccurred: staleness.staleReadOccurred,
  });
  const oob = oobDecomposition(opLog, chambers);

  return {
    scenario: name,
    mechanism,
    source: source || null,
    chambers,
    jarSeed,
    jarFinal: jar,
    finalCaches,
    mints,
    coherence: coh,
    identity,
    staleness,
    oob,
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

  // 011-02 OUT-OF-BAND, option A (seed + async write-back, NO invalidation — the
  // MVP1 shim generalized). A FOREIGN actor (a co-resident legacy Adobe
  // Visitor/ECID lib on the main thread, or a second tab) writes the real cookie
  // with an ALREADY-VALID identity (ECID-foreign). The chamber, never told, reads
  // its stale empty seed and MINTS a second ECID -> a duplicate/split identity and
  // a lost update (the foreign identity is clobbered). The out-of-band analogue of
  // concurrent-async-writeback: same fault, a foreign writer instead of a chamber.
  "oob-foreign-writeback": {
    name: "oob-foreign-writeback",
    mechanism: "foreign out-of-band write + seed/async-write-back (no invalidation) — R-006 option A",
    source: "foreign-actor (main-thread script / second tab)",
    chambers: ["c1"],
    steps: [
      { op: "oob", writer: "legacy-visitor-lib", value: amcvValue("ECID-foreign") }, // real cookie -> ECID-foreign; c1 silently stale
      { op: "observe", chamber: "c1" }, // c1 sync-reads its stale empty seed (recorded — the vulnerable window)
      { op: "commit", chamber: "c1" }, // c1 mints ECID-c1 off the stale seed -> jar clobbered; {ECID-foreign, ECID-c1} = split
    ],
  },

  // 011-02 OUT-OF-BAND, option B (broker-push invalidation on cookieStore
  // `change`). Same foreign write, but the broker DETECTS it and PUSHES the
  // foreign value into the chamber BEFORE the chamber's identity op consumes its
  // stale read -> the chamber ATTACHES ECID-foreign and mints nothing. The stale
  // read self-heals; the staleness window decomposes into detection + propagation
  // lag (R-006 F4). The out-of-band analogue of broker-push.
  "oob-broker-push": {
    name: "oob-broker-push",
    mechanism: "foreign out-of-band write + broker-push invalidation on change — R-006 option B",
    source: "foreign-actor (main-thread script / second tab)",
    chambers: ["c1"],
    steps: [
      { op: "oob", writer: "legacy-visitor-lib", value: amcvValue("ECID-foreign") }, // real cookie -> ECID-foreign; c1 silently stale
      { op: "observe", chamber: "c1" }, // c1 sync-reads the stale empty seed (recorded — the vulnerable window)
      { op: "detect" }, // broker learns of the foreign write (cookieStore `change` / poll)
      { op: "push", target: "c1" }, // broker-push reconciles c1 -> MCMID|ECID-foreign
      { op: "read", chamber: "c1" }, // c1 now reads the foreign identity
      { op: "commit", chamber: "c1" }, // ATTACHES ECID-foreign, mints NOTHING -> jar stays MCMID|ECID-foreign
    ],
  },
};
