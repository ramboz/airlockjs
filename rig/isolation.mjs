// isolation_invariant real-Worker assert (spec 007-02). Proves the chamber's
// no-DOM isolation is a browser-Worker REALM property — not a Node artifact
// (a Node test would throw on `document` regardless of the chamber, which is
// vacuous; see the slice's 07-02 frame-critique).
//
// Mechanism: a small wrapper entry module (rig/isolation-probe.worker.js),
// loaded as the `{type:"module"}` Worker, `import`s the UNMODIFIED
// core/chamber.worker.js (registering its real self.onmessage) and then makes
// a bare `document` reference in the shared WorkerGlobalScope. Because all
// modules loaded into one Worker share one realm, the throw runs in the exact
// realm that later runs mapToMp — with no edit to the shipped chamber.
//
// AC1: the wrapper's bare `document` reference throws ReferenceError, posted
//      back as {type:"isolation", domThrew:true, errName:"ReferenceError"}.
// AC2 (positive control, SAME worker/realm): the chamber's real message path
//      (init -> events -> {ready}) is driven afterward and must produce its
//      expected MP-shaped mapping output — proving the rig isn't vacuously
//      failing on all worker code, and that it exercises the shipped chamber
//      in the same realm AC1 probes.
// AC3: this is a gating browser-CI check (non-zero exit on failure), not a
//      hermetic oracle.COMPONENTS entry — oracle.sh is untouched by this slice.
//
// Usage: node rig/isolation.mjs   (exits non-zero if any assertion fails)
import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

// Serve the repo SOURCE TREE as-is (core/, connectors/, rig/) — no build
// step: the chamber has one import (connectors/ga4/map.js, a pure ES
// module), so it is loadable unbundled (07-02 DoR).
const ROOT = fileURLToPath(new URL("..", import.meta.url));
const MIME = {
  ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript",
  ".json": "application/json",
};

const server = http.createServer(async (req, res) => {
  try {
    const p = decodeURIComponent((req.url || "/").split("?")[0]);
    const file = join(ROOT, normalize(p));
    if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
    const body = await readFile(file);
    res.writeHead(200, { "content-type": MIME[extname(file)] || "application/octet-stream" });
    res.end(body);
  } catch (e) { res.writeHead(404); res.end("404 " + e.message); }
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

const browser = await chromium.launch();
const page = await browser.newPage();
// Any same-origin document establishes the origin the module Worker fetches
// against; package.json is an existing file served at this root.
await page.goto(`http://localhost:${port}/package.json`);

let isolation = null, mapping = null, evalError = null;
try {
  const _r = await page.evaluate(
  ({ workerUrl, sampleCtx, endpoint }) =>
    new Promise((resolve, reject) => {
      const worker = new Worker(workerUrl, { type: "module" });
      let isolation = null;
      const timeout = setTimeout(() => {
        worker.terminate();
        reject(new Error("timeout waiting for worker messages (isolation=" + JSON.stringify(isolation) + ")"));
      }, 10000);

      worker.onmessage = (e) => {
        const m = e.data;
        if (m && m.type === "isolation") {
          isolation = m;
          // AC2 positive control: drive the chamber's real message path in
          // the SAME worker/realm AC1 just probed.
          worker.postMessage({
            type: "init",
            trackers: 1,
            ctx: sampleCtx,
            endpoints: [endpoint],
            workFactor: 0,
          });
          worker.postMessage({
            type: "events",
            batch: [{ type: "page_view", params: { page_location: "https://example.com/" } }],
          });
        } else if (m && m.ready) {
          clearTimeout(timeout);
          worker.terminate();
          resolve({ isolation, mapping: m.ready });
        }
      };
      worker.onerror = (e) => {
        clearTimeout(timeout);
        worker.terminate();
        reject(new Error("worker error: " + (e.message || String(e))));
      };
    }),
  {
    workerUrl: `http://localhost:${port}/rig/isolation-probe.worker.js`,
    sampleCtx: { clientId: "1234567890.1700000000", sessionId: "1724668790" },
    endpoint: "https://t0.example/collect",
  },
  );
  isolation = _r.isolation;
  mapping = _r.mapping;
} catch (err) {
  evalError = err;
} finally {
  // Guarantee teardown on every path (timeout / worker error included) so a
  // headless CI runner never leaks chromium or a dangling server (07-02 craft
  // + arch review nit).
  await browser.close();
  server.close();
}

if (evalError) {
  console.log(JSON.stringify({
    pass: false,
    ac1_isolation: { pass: false, observed: isolation },
    ac2_positive_control: { pass: false, mapped: mapping },
    verdict: "FAIL — " + evalError.message,
  }, null, 2));
  process.exit(1);
}

// --- AC1: bare `document` threw ReferenceError, in the chamber's realm. ---
const ac1 = !!isolation && isolation.domThrew === true && isolation.errName === "ReferenceError";

// --- AC2: the chamber's real mapping path produced its expected output. ---
let mappedBody;
try { mappedBody = mapping && mapping[0] ? JSON.parse(mapping[0].body) : null; } catch { mappedBody = null; }
const ac2 =
  Array.isArray(mapping) &&
  mapping.length === 1 &&
  mapping[0].url === "https://t0.example/collect" &&
  mappedBody?.client_id === "1234567890.1700000000" &&
  mappedBody?.events?.[0]?.name === "page_view" &&
  mappedBody?.events?.[0]?.params?.session_id === "1724668790";

const pass = ac1 && ac2;

const out = {
  question: "in a real browser Worker, does a bare `document` reference throw ReferenceError in the SAME realm that runs the shipped chamber's mapToMp mapping — with no edit to core/chamber.worker.js?",
  pass,
  ac1_isolation: { pass: ac1, observed: isolation },
  ac2_positive_control: { pass: ac2, mapped: mapping },
  verdict: pass
    ? "PASS — bare `document` threw ReferenceError in the chamber's own Worker realm (AC1), and the shipped chamber's real init/events/mapToMp path ran to completion with the expected MP-shaped output in that same realm (AC2)"
    : "FAIL — see ac1_isolation / ac2_positive_control above",
};
 
console.log(JSON.stringify(out, null, 2));
process.exit(pass ? 0 : 1);
