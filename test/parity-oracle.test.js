// The vendor-generic classified-diff + gap-map oracle — spec 038-01 AC3/AC7, ADR-0020.
//
// Exercised here against a MINIMAL synthetic descriptor (NOT Meta's) to prove the engine's
// bucket logic is descriptor-DATA-driven, not vendor-hardcoded — the "one classified-diff
// engine, two descriptor kinds" design (spec 038 § "The oracle"). test/parity-meta.test.js
// proves the SAME engine against the real Meta descriptor + a real-shaped fixture; AC7's own
// proof (a second, unrelated GET-pixel vendor, zero pipeline change) lives in this file.
import { describe, it, expect } from "vitest";
import { diffParity } from "../rig/parity/oracle.js";

// A trivial synthetic GET-pixel descriptor — not any real vendor, just enough shape (attribution
// fields + a normalise-denylist field + one gap-map entry) to exercise every bucket.
const descriptor = {
  vendor: "acme",
  protocol: "same-protocol",
  attributionFields: ["pid", "evt", "amt"],
  normaliseDenylist: ["cb"],
  wireNameMap: {},
  gapMap: { amt: { owner: "acme-followup" } },
};

describe("diffParity — classified-diff engine buckets (AC3)", () => {
  it("a present + equal field classifies as maps", () => {
    const { fields, verdict } = diffParity({
      descriptor,
      containerFields: { pid: "P1", evt: "conv" },
      airlockFields: { pid: "P1", evt: "conv" },
    });
    expect(fields).toContainEqual({ field: "pid", bucket: "maps", containerValue: "P1", airlockValue: "P1" });
    expect(fields).toContainEqual({ field: "evt", bucket: "maps", containerValue: "conv", airlockValue: "conv" });
    expect(verdict).toBe("pass");
  });

  it("a normalise-denylist field is normalised-out, regardless of its value or airlock-side presence", () => {
    const { fields } = diffParity({
      descriptor,
      containerFields: { pid: "P1", evt: "conv", cb: "928374" },
      airlockFields: { pid: "P1", evt: "conv" }, // cb absent on the airlock side too — still not judged
    });
    expect(fields).toContainEqual({ field: "cb", bucket: "normalised-out" });
  });

  it("a gap-map field the airlock side omits is expected-dropped (green), never a plain dropped", () => {
    const { fields, verdict } = diffParity({
      descriptor,
      containerFields: { pid: "P1", evt: "conv", amt: "42" },
      airlockFields: { pid: "P1", evt: "conv" },
    });
    expect(fields).toContainEqual({ field: "amt", bucket: "expected-dropped", containerValue: "42", owner: "acme-followup" });
    expect(verdict).toBe("pass");
  });

  it("a NON-gap-map field the airlock side omits is a REGRESSION — dropped, and the verdict fails", () => {
    const { fields, verdict } = diffParity({
      descriptor,
      containerFields: { pid: "P1", evt: "conv" },
      airlockFields: { evt: "conv" }, // pid missing — un-owned
    });
    expect(fields).toContainEqual({ field: "pid", bucket: "dropped", containerValue: "P1" });
    expect(verdict).toBe("fail");
  });

  it("a gap-map field the airlock side NOW emits, equal, is gap-closed (green + an owner-landed flag)", () => {
    const { fields, verdict } = diffParity({
      descriptor,
      containerFields: { pid: "P1", evt: "conv", amt: "42" },
      airlockFields: { pid: "P1", evt: "conv", amt: "42" },
    });
    expect(fields).toContainEqual({
      field: "amt",
      bucket: "gap-closed",
      containerValue: "42",
      airlockValue: "42",
      owner: "acme-followup",
      flag: "owner landed — remove from gap map",
    });
    expect(verdict).toBe("pass");
  });

  it("a present-but-UNEQUAL field is divergent (red) regardless of gap-map membership", () => {
    const { fields, verdict } = diffParity({
      descriptor,
      containerFields: { pid: "P1", evt: "conv" },
      airlockFields: { pid: "P1", evt: "purchase" },
    });
    expect(fields).toContainEqual({ field: "evt", bucket: "divergent", containerValue: "conv", airlockValue: "purchase" });
    expect(verdict).toBe("fail");
  });

  it("a divergent gap-map field is STILL divergent (red) — landing a WRONG value never counts as gap-closed", () => {
    const { fields, verdict } = diffParity({
      descriptor,
      containerFields: { pid: "P1", evt: "conv", amt: "42" },
      airlockFields: { pid: "P1", evt: "conv", amt: "99" },
    });
    expect(fields).toContainEqual({ field: "amt", bucket: "divergent", containerValue: "42", airlockValue: "99" });
    expect(verdict).toBe("fail");
  });

  it("counts tally exactly one entry per classified field", () => {
    const { counts } = diffParity({
      descriptor,
      containerFields: { pid: "P1", evt: "conv", amt: "42", cb: "1" },
      airlockFields: { pid: "P1", evt: "conv" },
    });
    expect(counts).toEqual({ maps: 2, "expected-dropped": 1, "normalised-out": 1 });
  });

  it("a container field the capture never sent is not classified at all (no false entry either way)", () => {
    const { fields } = diffParity({
      descriptor,
      containerFields: { pid: "P1", evt: "conv" }, // amt never sent by this capture
      airlockFields: { pid: "P1", evt: "conv" },
    });
    expect(fields.find((f) => f.field === "amt")).toBeUndefined();
  });
});

describe("AC7 — vendor-generic by construction: a SECOND, unrelated GET-pixel descriptor through the SAME engine", () => {
  const otherVendorDescriptor = {
    vendor: "widgetco",
    protocol: "same-protocol",
    attributionFields: ["wid", "act", "uid"],
    normaliseDenylist: ["nonce"],
    wireNameMap: {},
    gapMap: { uid: { owner: "widgetco-followup" } },
  };

  it("classifies correctly with ZERO pipeline change — same diffParity import, only the descriptor DATA differs", () => {
    const { verdict, fields } = diffParity({
      descriptor: otherVendorDescriptor,
      containerFields: { wid: "W1", act: "click", uid: "U1", nonce: "xyz" },
      airlockFields: { wid: "W1", act: "click" },
    });
    expect(verdict).toBe("pass"); // uid is owned, nonce is normalised-out
    expect(fields).toContainEqual({ field: "uid", bucket: "expected-dropped", containerValue: "U1", owner: "widgetco-followup" });
    expect(fields).toContainEqual({ field: "nonce", bucket: "normalised-out" });
  });

  it("still flags an un-owned drop red for this UNRELATED vendor too — the guard generalizes, not a Meta special case", () => {
    const { verdict } = diffParity({
      descriptor: otherVendorDescriptor,
      containerFields: { wid: "W1", act: "click" },
      airlockFields: {}, // wid dropped, un-owned
    });
    expect(verdict).toBe("fail");
  });
});
