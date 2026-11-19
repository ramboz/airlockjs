import { createHash } from "node:crypto";

// Spec 064 §4.1 capture recorder. Passive observer on a caller-owned Playwright
// BrowserContext: it records every third-party request the tag makes (Edge
// interact/collect, identity sync, Analytics receipt) with headers, body, status
// and response body, and hashes the Alloy bundle that was actually loaded. It
// never routes, modifies or fulfils a request. Unlike the 051-08 recorder it is
// not limited to edge.adobedc.net or 8 requests; it is bounded by the limits below.

export const ALLOY_SHA256 = "7dd09409bb07d47b1b2289eec4ca15d67084a85a3d832bef6c73180889da32e8";
export const LIMITS = Object.freeze({ maxRequests: 200, maxBodyBytes: 1048576, maxHeaderBytes: 65536 });
const ALLOY_PATH = /\/alloy(?:\.min)?\.js$/i;

export class AlloyPinError extends Error {
  constructor(message) { super(message); this.name = "AlloyPinError"; }
}

const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");

function clipBody(buffer, max) {
  if (!buffer) return { body: null, body_bytes: 0, body_truncated: false };
  const bytes = Buffer.from(buffer);
  const kept = bytes.length > max ? bytes.subarray(0, max) : bytes;
  return { body: kept.toString("utf8"), body_bytes: bytes.length, body_truncated: bytes.length > max };
}

export function attachCaptureRecorder(context, { pageOrigin, alloySha256 = ALLOY_SHA256, limits = {} } = {}) {
  if (!context || typeof context.on !== "function") throw new TypeError("a Playwright BrowserContext is required");
  const max = { ...LIMITS, ...limits };
  const entries = new Map();
  const alloyLoads = [];
  const pending = new Set();
  let dropped = 0;
  let stopped = false;
  let order = 0;

  const track = promise => {
    const task = promise.catch(() => {}).finally(() => pending.delete(task));
    pending.add(task);
  };
  const external = url => {
    try { return new URL(url).origin !== pageOrigin; } catch { return false; }
  };
  const isAlloy = url => {
    try { return ALLOY_PATH.test(new URL(url).pathname); } catch { return false; }
  };

  const onRequest = request => {
    if (stopped) return;
    const url = request.url();
    if (!external(url) && !isAlloy(url)) return;
    if (entries.size >= max.maxRequests) { dropped += 1; return; }
    const entry = {
      seq: ++order,
      url,
      method: request.method(),
      resource_type: request.resourceType(),
      started_at: new Date().toISOString(),
      request_headers: null,
      request_body: null,
      request_body_bytes: 0,
      request_body_truncated: false,
      status: null,
      response_headers: null,
      response_body: null,
      response_body_bytes: 0,
      response_body_truncated: false,
      failure: null,
    };
    entries.set(request, entry);
    const post = request.postDataBuffer ? request.postDataBuffer() : null;
    const clipped = clipBody(post, max.maxBodyBytes);
    entry.request_body = clipped.body;
    entry.request_body_bytes = clipped.body_bytes;
    entry.request_body_truncated = clipped.body_truncated;
    track((async () => { entry.request_headers = await request.allHeaders(); })());
  };

  const onResponse = response => {
    const request = response.request();
    const entry = entries.get(request);
    if (!entry) return;
    entry.status = response.status();
    track((async () => {
      entry.response_headers = await response.allHeaders();
      let bytes = null;
      try { bytes = await response.body(); } catch { /* redirects and aborted bodies have none */ }
      if (isAlloy(entry.url) && entry.status === 200 && bytes) {
        alloyLoads.push({ url: entry.url, bytes: bytes.length, sha256: sha256(bytes) });
        entry.response_body = null;
        entry.response_body_bytes = bytes.length;
        return;
      }
      const clipped = clipBody(bytes, max.maxBodyBytes);
      entry.response_body = clipped.body;
      entry.response_body_bytes = clipped.body_bytes;
      entry.response_body_truncated = clipped.body_truncated;
    })());
  };

  const onFailed = request => {
    const entry = entries.get(request);
    if (entry) entry.failure = request.failure()?.errorText ?? "failed";
  };

  context.on("request", onRequest);
  context.on("response", onResponse);
  context.on("requestfailed", onFailed);

  return {
    async settle() { while (pending.size) await Promise.all([...pending]); },
    async stop() {
      await this.settle();
      stopped = true;
      context.off?.("request", onRequest);
      context.off?.("response", onResponse);
      context.off?.("requestfailed", onFailed);
    },
    // Throws AlloyPinError unless exactly the pinned bundle was loaded.
    async verifyAlloy() {
      await this.settle();
      if (!alloyLoads.length) throw new AlloyPinError("no Alloy bundle was loaded");
      const bad = alloyLoads.find(load => load.sha256 !== alloySha256);
      if (bad) throw new AlloyPinError(`loaded Alloy bundle SHA-256 ${bad.sha256} does not match the pin`);
      return { sha256: alloySha256, loads: alloyLoads.map(load => ({ ...load })) };
    },
    async records() {
      await this.settle();
      return { requests: [...entries.values()].sort((a, b) => a.seq - b.seq), dropped };
    },
  };
}
