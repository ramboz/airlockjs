import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BOILERPLATE_CSP, MIME, NOOP_EDS, EDS_ENTRY, serveStaticFile } from "../rig/lh-server.mjs";

// spec 036-01 follow-on (docs/inbox.md 2026-09-05): rig/lh-server.mjs factors the CSP/MIME/
// no-op + static-serve tail that rig/lh-eds.mjs, rig/lh-live.mjs, and rig/subtree-install.mjs
// each carried as byte-identical copies. Those rigs launch real browsers and so are not
// CI-tested; the SHARED plumbing is pure node (http/fs) and IS testable here — so this
// extraction adds the coverage the inline copies never had.

// A minimal ServerResponse stand-in capturing what the rigs' handlers observe.
function fakeRes() {
  return {
    statusCode: null,
    headers: null,
    body: null,
    ended: false,
    writeHead(status, headers) {
      this.statusCode = status;
      this.headers = headers || null;
    },
    end(body) {
      this.body = body ?? null;
      this.ended = true;
    },
  };
}

describe("rig/lh-server.mjs — shared CWV-rig server plumbing (constants)", () => {
  it("MIME maps the extensions the rigs serve (html/js/mjs/json/css/svg/png/ico)", () => {
    expect(MIME[".html"]).toBe("text/html");
    expect(MIME[".js"]).toBe("text/javascript");
    expect(MIME[".mjs"]).toBe("text/javascript");
    expect(MIME[".json"]).toBe("application/json");
    expect(MIME[".css"]).toBe("text/css");
    expect(MIME[".svg"]).toBe("image/svg+xml");
  });

  it("BOILERPLATE_CSP is the exact EDS envelope (nonce-aem strict-dynamic + require-trusted-types-for)", () => {
    expect(BOILERPLATE_CSP).toContain("script-src 'nonce-aem' 'strict-dynamic'");
    expect(BOILERPLATE_CSP).toContain("require-trusted-types-for 'script'");
    expect(BOILERPLATE_CSP).not.toContain("worker-src"); // the 004-01 envelope has none
  });

  it("NOOP_EDS is a real no-op boot module and EDS_ENTRY is the airlock entry path", () => {
    expect(NOOP_EDS).toContain("export function bootEdsAnalytics(){}");
    expect(NOOP_EDS).toContain("export default bootEdsAnalytics");
    expect(EDS_ENTRY).toBe("/scripts/airlock/eds.js");
  });
});

describe("rig/lh-server.mjs — serveStaticFile", () => {
  let root;
  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), "lh-server-test-"));
    writeFileSync(join(root, "index.html"), "<!doctype html><title>ok</title>");
    writeFileSync(join(root, "data.bin"), "raw-bytes"); // unknown extension -> octet-stream
  });
  afterAll(() => rmSync(root, { recursive: true, force: true }));

  it("serves an existing file as 200 with the extension MIME type + the boilerplate CSP", async () => {
    const res = fakeRes();
    await serveStaticFile(res, root, "/index.html");

    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toBe("text/html");
    expect(res.headers["content-security-policy"]).toBe(BOILERPLATE_CSP);
    expect(String(res.body)).toContain("<title>ok</title>");
  });

  it("falls back to application/octet-stream for an unknown extension", async () => {
    const res = fakeRes();
    await serveStaticFile(res, root, "/data.bin");

    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toBe("application/octet-stream");
  });

  it("writes 403 (no body) when the resolved path escapes root — the path-traversal guard", async () => {
    const res = fakeRes();
    await serveStaticFile(res, root, "../escapes-root.txt");

    expect(res.statusCode).toBe(403);
    expect(res.ended).toBe(true);
    expect(res.body).toBeNull(); // end() called with no argument
  });

  it("PROPAGATES a read error (missing file) so the caller's own catch emits the 404 (byte-identical to the inline tails)", async () => {
    const res = fakeRes();
    await expect(serveStaticFile(res, root, "/does-not-exist.html")).rejects.toThrow();
    expect(res.statusCode).not.toBe(200); // never wrote a spurious 200 for a missing file
  });
});
