// Shared local-server plumbing for the before/after CWV rigs — spec 036-01 follow-on
// (docs/inbox.md, 2026-09-05). rig/lh-eds.mjs, rig/lh-live.mjs, and rig/subtree-install.mjs
// each carried BYTE-IDENTICAL copies of the EDS boilerplate CSP header, the MIME map, the
// no-op OFF-arm module, and the static-serve tail (path-traversal guard + MIME/CSP write).
// Factored here so there is exactly ONE copy. Uses only node built-ins — no browser /
// lighthouse / playwright import and no I/O at module load — so it is safe to unit-test in
// vitest (test/lh-server.test.js), unlike the browser-launching rigs that consume it.

import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

// Extension -> content-type for the static serve. Shared verbatim by all three CWV rigs.
export const MIME = {
  ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript",
  ".json": "application/json", ".css": "text/css", ".svg": "image/svg+xml",
  ".png": "image/png", ".ico": "image/x-icon",
};

// The exact EDS boilerplate CSP (no worker-src; require-trusted-types-for 'script') — the
// rigs serve it on every response so airlock boots under the retired-risk 004-01 envelope,
// exactly as `aem up`'s CDN would.
export const BOILERPLATE_CSP =
  "script-src 'nonce-aem' 'strict-dynamic' 'unsafe-inline' http: https:; " +
  "base-uri 'self'; object-src 'none'; frame-src 'self' https:; " +
  "require-trusted-types-for 'script';";

// The no-airlock control module served for the OFF arm — a real no-op boot entry.
export const NOOP_EDS = "export function bootEdsAnalytics(){}\nexport default bootEdsAnalytics;\n";

// The airlock boot entry lh-eds.mjs / lh-live.mjs swap the no-op in for (OFF arm).
// (subtree-install.mjs computes its own entry from SERVED_PATH, so it does not use this.)
export const EDS_ENTRY = "/scripts/airlock/eds.js";

/**
 * Serve a static file from `root` for a decoded request `pathname`, with the boilerplate CSP
 * on the response — the shared tail of all three CWV rigs' request handlers. On a
 * path-traversal attempt (a file resolving OUTSIDE `root`) it writes 403 and ends the
 * response. Otherwise it writes 200 with the extension's MIME type (octet-stream fallback)
 * plus the CSP, and ends with the file body. A read error (ENOENT, …) is NOT caught here — it
 * PROPAGATES so the caller's own try/catch turns it into the 404 the rigs already emit
 * (`res.writeHead(404); res.end("404 " + e.message)`). This is byte-identical to the former
 * inline tails, so the extraction changes nothing observable.
 *
 * @param {import('node:http').ServerResponse} res the response to write.
 * @param {string} root the absolute directory the serve is rooted at.
 * @param {string} pathname the decoded request pathname (already stripped of any query).
 * @returns {Promise<void>}
 */
export async function serveStaticFile(res, root, pathname) {
  const file = join(root, normalize(pathname));
  if (!file.startsWith(root)) {
    res.writeHead(403);
    res.end();
    return;
  }
  const body = await readFile(file); // read error propagates -> caller's catch -> 404
  res.writeHead(200, {
    "content-type": MIME[extname(file)] || "application/octet-stream",
    "content-security-policy": BOILERPLATE_CSP,
  });
  res.end(body);
}
