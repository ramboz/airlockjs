// The pixel chamber's 026-04 ADVANCED-MATCHING glue — spec 026-04 AC1/AC2/AC4 +
// the SECURITY invariant. Exercises the REAL core/pixel-chamber.worker.js file
// via the fakeSelf + vi.resetModules() technique test/ga4-gtag-chamber-worker.js
// established (vitest's node env has no `self`, so a fake one is supplied BEFORE a
// fresh dynamic import to drive the real onmessage logic — not a re-implementation).
//
// The expected hashes are computed INDEPENDENTLY via node:crypto (this test runs
// in Node, never bundled) over the by-hand normalized value — proving BOTH the
// digest AND the normalization at the chamber boundary.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createHash } from "node:crypto";
import { createMetaPixelConfig } from "../connectors/pixel/vendors/meta.js";

const sha256hex = (s) => createHash("sha256").update(String(s), "utf8").digest("hex");
// crypto.subtle.digest resolves on a threadpool (not a single microtask), so poll
// a predicate rather than counting fixed ticks (mirrors the ga4-gtag worker test's
// macrotask-boundary note, generalized to "wait until the async hash lands").
async function waitFor(pred, tries = 200) {
  for (let i = 0; i < tries; i += 1) {
    if (pred()) return;
    await new Promise((r) => setTimeout(r, 1));
  }
}
const flush = () => new Promise((r) => setTimeout(r, 5));

// A clearly-synthetic external_id (AC7 — never a live identifier).
const RAW_XID = "11111111-1111-4111-8111-111111111111";
const RAW_EMAIL = " User@Example.COM ";
const RAW_PHONE = "(415) 555-0100";

describe("core/pixel-chamber.worker.js — advanced matching (spec 026-04)", () => {
  let fakeSelf;
  const idMessages = () => fakeSelf.postMessage.mock.calls.map((c) => c[0]).filter((m) => m && m.type === "identity");
  const readyMessages = () => fakeSelf.postMessage.mock.calls.map((c) => c[0]).filter((m) => m && m.ready);

  beforeEach(() => {
    fakeSelf = { postMessage: vi.fn() };
    globalThis.self = fakeSelf;
    vi.resetModules();
  });
  afterEach(() => {
    delete globalThis.self;
  });

  it("AC4 EAGER — external_id on `init` is hashed WITHOUT any events push, and posted back on the identity channel", async () => {
    await import("../core/pixel-chamber.worker.js");
    fakeSelf.onmessage({ data: { type: "init", ...createMetaPixelConfig({ externalId: RAW_XID }) } });
    await waitFor(() => idMessages().length >= 1);

    const ids = idMessages();
    expect(ids).toHaveLength(1);
    expect(ids[0]).toEqual({ type: "identity", ud: { external_id: sha256hex(RAW_XID) } });
    expect(ids[0].ud.external_id).toMatch(/^[0-9a-f]{64}$/);
  });

  it("AC1 steady-state MERGE — a page_view after the eager hash carries ud[external_id]=<hex> on the ready /tr GET", async () => {
    await import("../core/pixel-chamber.worker.js");
    fakeSelf.onmessage({ data: { type: "init", ...createMetaPixelConfig({ externalId: RAW_XID }) } });
    await waitFor(() => idMessages().length >= 1); // the eager hash landed in the worker-side map

    fakeSelf.onmessage({ data: { type: "events", batch: [{ type: "page_view", params: {} }] } });
    await waitFor(() => readyMessages().length >= 1);

    const ready = readyMessages();
    expect(ready).toHaveLength(1);
    expect(ready[0].ready).toHaveLength(1);
    const url = new URL(ready[0].ready[0].url);
    expect(url.searchParams.get("ud[external_id]")).toBe(sha256hex(RAW_XID));
    expect(url.searchParams.get("ev")).toBe("PageView"); // the base beacon is intact
  });

  it("AC1/AC2 setIdentity — raw PII on the dedicated `identity` channel is normalized+hashed and posted per field", async () => {
    await import("../core/pixel-chamber.worker.js");
    fakeSelf.onmessage({ data: { type: "init", ...createMetaPixelConfig() } }); // no boot external_id
    fakeSelf.onmessage({ data: { type: "identity", raw: { em: RAW_EMAIL, ph: RAW_PHONE } } });
    await waitFor(() => idMessages().length >= 2);

    const ud = Object.assign({}, ...idMessages().map((m) => m.ud));
    expect(ud.em).toBe(sha256hex("user@example.com")); // trim+lowercase witness
    expect(ud.ph).toBe(sha256hex("4155550100")); // digits + strip-leading-zeros witness
  });

  it("SECURITY — no posted message (identity OR ready) ever contains a RAW identity value; only hashes cross", async () => {
    await import("../core/pixel-chamber.worker.js");
    fakeSelf.onmessage({ data: { type: "init", ...createMetaPixelConfig({ externalId: RAW_XID }) } });
    fakeSelf.onmessage({ data: { type: "identity", raw: { em: RAW_EMAIL, ph: RAW_PHONE } } });
    await waitFor(() => idMessages().length >= 3); // external_id + em + ph
    fakeSelf.onmessage({ data: { type: "events", batch: [{ type: "page_view", params: {} }] } });
    await waitFor(() => readyMessages().length >= 1);

    const wire = JSON.stringify(fakeSelf.postMessage.mock.calls);
    expect(wire).not.toContain(RAW_XID);
    expect(wire).not.toContain("User@Example.COM");
    expect(wire).not.toContain("user@example.com"); // not even the normalized-but-unhashed email
    expect(wire).not.toContain("4155550100"); // not even the normalized-but-unhashed phone
  });

  it("back-compat — a config with NO advancedMatching posts NO identity message and a ready with NO ud[...]", async () => {
    await import("../core/pixel-chamber.worker.js");
    fakeSelf.onmessage({ data: { type: "init", ...createMetaPixelConfig() } });
    fakeSelf.onmessage({ data: { type: "events", batch: [{ type: "page_view", params: {} }] } });
    await waitFor(() => readyMessages().length >= 1);
    await flush(); // give any (erroneous) identity post a chance to appear before asserting none did
    expect(idMessages()).toHaveLength(0);
    const ready = readyMessages();
    expect(ready).toHaveLength(1);
    expect(ready[0].ready[0].url.toLowerCase()).not.toContain("ud%5b");
    // byte-identical to the connector's own identity-agnostic output
    expect(ready[0].ready[0].url).toContain("ev=PageView");
  });

  it("defensive — an UNKNOWN field fed on the identity channel is never hashed or posted (only documented ud[...] fields)", async () => {
    await import("../core/pixel-chamber.worker.js");
    fakeSelf.onmessage({ data: { type: "init", ...createMetaPixelConfig() } });
    fakeSelf.onmessage({ data: { type: "identity", raw: { evil: "x", em: RAW_EMAIL } } });
    await waitFor(() => idMessages().length >= 1);
    await flush(); // let any (erroneous) `evil` post surface before asserting it never did

    const ud = Object.assign({}, ...idMessages().map((m) => m.ud));
    expect(ud.evil).toBeUndefined(); // dropped
    expect(ud.em).toBe(sha256hex("user@example.com")); // the known field still hashed
  });
});
