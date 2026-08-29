// Pure-logic tests for the MVP2 coherency probe (spec 011-01).
//
// The rig itself is a real-two-Worker browser instrument (rig/coherency.mjs) —
// that is where AC1's cross-thread topology is proven. But the coherency
// comparison, the identity RMW (mint-vs-attach), and the fault classifier are
// deterministic PURE functions factored into rig/coherency-model.mjs so they can
// be exercised hermetically here (and shared, unmodified, by the in-browser
// chamber worker). These tests pin the discriminating logic the go/no-go rests
// on: a stale identity read must classify as a *correctness* fault, not merely a
// window width (AC5 / the spec's Assumption 3).
import { describe, it, expect } from "vitest";
import {
  parseAmcv,
  amcvValue,
  mintEcid,
  identityRmw,
  chamberIdentityStep,
  coherence,
  classifyIdentity,
  stalenessWindow,
  createInMemoryChamber,
  runBroker,
  SCENARIOS,
} from "../rig/coherency-model.mjs";

describe("AMCV cookie shape (R-004: AMCV_*=MCMID|<ECID>)", () => {
  it("parseAmcv extracts the ECID after the MCMID| marker", () => {
    expect(parseAmcv("MCMID|12345").ecid).toBe("12345");
  });
  it("parseAmcv treats a bare marker / empty value as a new visitor (no ECID)", () => {
    expect(parseAmcv("MCMID|").ecid).toBe("");
    expect(parseAmcv("").ecid).toBe("");
  });
  it("amcvValue round-trips an ECID into the MCMID| shape", () => {
    expect(amcvValue("ECID-c1")).toBe("MCMID|ECID-c1");
    expect(parseAmcv(amcvValue("ECID-c1")).ecid).toBe("ECID-c1");
  });
});

describe("identity RMW — mint on empty, attach on present (the identity-consuming op, AC5)", () => {
  it("mints a deterministic, chamber-scoped ECID when the cached identity is empty", () => {
    const r = identityRmw(amcvValue(""), "c1");
    expect(r.action).toBe("mint");
    expect(r.minted).toBe(mintEcid("c1"));
    expect(r.newValue).toBe(amcvValue(mintEcid("c1")));
  });
  it("two chambers minting off an empty basis mint DISTINCT ECIDs (the split-identity fault)", () => {
    expect(identityRmw(amcvValue(""), "c1").minted).not.toBe(identityRmw(amcvValue(""), "c2").minted);
  });
  it("attaches the existing ECID (mints nothing) when the cached identity is present", () => {
    const r = identityRmw(amcvValue("ECID-c1"), "c2");
    expect(r.action).toBe("attach");
    expect(r.minted).toBeNull();
    expect(r.newValue).toBe(amcvValue("ECID-c1"));
  });
  it("mintEcid is deterministic across calls (reproducible runs, DoD)", () => {
    expect(mintEcid("c1")).toBe(mintEcid("c1"));
  });
});

describe("chamberIdentityStep — the pure worker-side transition (shared by the real Worker)", () => {
  it("seed then read returns the seeded cache synchronously", () => {
    let s = { id: "c1", cache: "" };
    ({ state: s } = chamberIdentityStep(s, { op: "seed", value: amcvValue("X") }));
    const { reply } = chamberIdentityStep(s, { op: "read" });
    expect(reply.value).toBe(amcvValue("X"));
  });
  it("commit off an empty cache mints and advances the cache; invalidate reconciles it", () => {
    let s = { id: "c2", cache: amcvValue("") };
    let reply;
    ({ state: s, reply } = chamberIdentityStep(s, { op: "commit" }));
    expect(reply.minted).toBe(mintEcid("c2"));
    expect(s.cache).toBe(amcvValue(mintEcid("c2")));
    ({ state: s } = chamberIdentityStep(s, { op: "invalidate", value: amcvValue("ECID-c1") }));
    expect(s.cache).toBe(amcvValue("ECID-c1"));
  });
});

describe("coherence — caches vs the authoritative jar (AC3)", () => {
  it("reports coherent when both caches agree with each other and the jar", () => {
    const c = coherence({ c1: "MCMID|A", c2: "MCMID|A" }, "MCMID|A");
    expect(c).toMatchObject({ coherent: true, cachesAgree: true, agreeWithJar: true });
  });
  it("reports incoherent when the caches diverge from each other", () => {
    const c = coherence({ c1: "MCMID|A", c2: "MCMID|B" }, "MCMID|B");
    expect(c.coherent).toBe(false);
    expect(c.cachesAgree).toBe(false);
  });
  it("reports incoherent when a cache holds a value superseded in the jar (lost update)", () => {
    const c = coherence({ c1: "MCMID|A", c2: "MCMID|B" }, "MCMID|B");
    expect(c.agreeWithJar).toBe(false); // c1 still holds A, jar moved to B
  });
  it("a single cache equal to the jar is coherent (single-chamber control)", () => {
    expect(coherence({ c1: "MCMID|A" }, "MCMID|A").coherent).toBe(true);
  });
});

describe("classifyIdentity — correctness verdict, not just a window (AC5)", () => {
  it("two distinct mints => FAULT (split / duplicate identity)", () => {
    const v = classifyIdentity({ mints: ["ECID-c1", "ECID-c2"], staleReadOccurred: true });
    expect(v.verdict).toBe("fault");
    expect(v.kind).toBe("split-identity");
    expect(v.distinctEcids).toEqual(["ECID-c1", "ECID-c2"]);
  });
  it("one mint after a stale read that reconciled => SELF-HEAL (benign)", () => {
    const v = classifyIdentity({ mints: ["ECID-c1"], staleReadOccurred: true });
    expect(v.verdict).toBe("self-heal");
  });
  it("one mint with no stale read => COHERENT (no divergence)", () => {
    const v = classifyIdentity({ mints: ["ECID-c1"], staleReadOccurred: false });
    expect(v.verdict).toBe("coherent");
  });
});

describe("stalenessWindow — op-count a sync read returned a superseded value (AC3)", () => {
  const log = [
    { op: 0, label: "seed", jar: "MCMID|", caches: { c1: "MCMID|", c2: "MCMID|" } },
    { op: 1, label: "commit c1", jar: "MCMID|A", caches: { c1: "MCMID|A", c2: "MCMID|" } }, // c2 stale
    { op: 2, label: "commit c2", jar: "MCMID|B", caches: { c1: "MCMID|A", c2: "MCMID|B" } }, // c1 stale (open)
  ];
  it("detects that a stale read occurred and reports it never reconciled (open at end)", () => {
    const s = stalenessWindow(log, ["c1", "c2"]);
    expect(s.staleReadOccurred).toBe(true);
    expect(s.reconciledWithinRun).toBe(false); // c1 holds superseded A at the last op
    expect(s.maxStalenessOps).toBeGreaterThanOrEqual(1);
  });
  it("reports reconciled when a later op brings the lagging cache back to the jar", () => {
    const healed = [
      { op: 0, label: "seed", jar: "MCMID|", caches: { c1: "MCMID|", c2: "MCMID|" } },
      { op: 1, label: "commit c1", jar: "MCMID|A", caches: { c1: "MCMID|A", c2: "MCMID|" } }, // c2 stale
      { op: 2, label: "push c2", jar: "MCMID|A", caches: { c1: "MCMID|A", c2: "MCMID|A" } }, // reconciled
    ];
    const s = stalenessWindow(healed, ["c1", "c2"]);
    expect(s.staleReadOccurred).toBe(true);
    expect(s.reconciledWithinRun).toBe(true);
  });
});

// End-to-end: the same broker orchestration the browser rig runs, driven here
// against in-memory chambers (identical chamberIdentityStep logic). This is the
// hermetic mirror of the rig's fails-both-ways self-check.
async function runInMemory(scenario) {
  const chambers = {};
  for (const id of scenario.chambers) chambers[id] = createInMemoryChamber(id);
  const send = (id, msg) => Promise.resolve(chambers[id].handle(msg));
  return runBroker({ ...scenario, send });
}

describe("fails-both-ways (DoD) — the detector discriminates divergence from coherence", () => {
  it("concurrent async write-back => INCOHERENT + split-identity FAULT + unreconciled window", async () => {
    const r = await runInMemory(SCENARIOS["concurrent-async-writeback"]);
    expect(r.coherence.coherent).toBe(false);
    expect(r.identity.verdict).toBe("fault");
    expect(r.identity.distinctEcids.length).toBe(2);
    expect(r.staleness.reconciledWithinRun).toBe(false);
    expect(r.mints.length).toBe(2); // the lost update: both chambers minted
  });
  it("single-chamber control => COHERENT, one identity, no fault", async () => {
    const r = await runInMemory(SCENARIOS["single-chamber"]);
    expect(r.coherence.coherent).toBe(true);
    expect(r.identity.verdict).toBe("coherent");
    expect(r.mints.length).toBe(1);
  });
  it("broker-push control => COHERENT + SELF-HEAL (stale read reconciled before consumption)", async () => {
    const r = await runInMemory(SCENARIOS["broker-push"]);
    expect(r.coherence.coherent).toBe(true);
    expect(r.identity.verdict).toBe("self-heal");
    expect(r.staleness.staleReadOccurred).toBe(true);
    expect(r.staleness.reconciledWithinRun).toBe(true);
    expect(r.mints.length).toBe(1); // c2 attached the existing ECID rather than minting a duplicate
  });
  it("is reproducible: two runs of the concurrent scenario are byte-identical (deterministic, DoD)", async () => {
    const a = await runInMemory(SCENARIOS["concurrent-async-writeback"]);
    const b = await runInMemory(SCENARIOS["concurrent-async-writeback"]);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
