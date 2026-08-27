// Delivery-under-teardown measurement (OQ10 fast path). Models the unload window:
// a keepalive request ALREADY ISSUED to the network survives page teardown; a
// request still mid worker-round-trip (idle-drain → postMessage → worker map →
// postMessage → fetch) does not. So "delivered within a teardown-sized window" is
// the faithful OQ10 metric — it is exactly what would survive if the page closed
// TEARDOWN_MS after the event.
//
// Three scenarios, worker mode:
//   1. enqueued last beacon  — push() (normal worker path): lost inside the window
//   2. critical last beacon  — pushCritical() (synchronous fast path): delivered
//   3. ring tail at unload   — visibilitychange→hidden flushes the un-drained ring
//
// Usage: TRACKERS=5 WORK=30000 TEARDOWN_MS=100 RING_K=10 node rig/teardown.mjs
import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const MIME = {
  ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript",
  ".json": "application/json", ".css": "text/css",
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

const TRACKERS = Number(process.env.TRACKERS || 5);
const WORK = Number(process.env.WORK || 30000); // µs/tracker of worker map cost
const TEARDOWN_MS = Number(process.env.TEARDOWN_MS || 100); // < worker time, so the enqueued path is mid-flight
const RING_K = Number(process.env.RING_K || 10);

const browser = await chromium.launch();
const page = await browser.newPage();
let egress = 0;
await page.route("**/collect*", (route) => { egress++; return route.fulfill({ status: 204, body: "" }); });
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(String(e)));

const url = `http://localhost:${port}/rig/harness.html?mode=worker&trackers=${TRACKERS}&work=${WORK}`;

async function measure(label, expected, driver) {
  egress = 0;
  await page.goto(url); // fresh runtime + empty state per scenario
  await page.waitForFunction(() => window.__rig, { timeout: 10000 });
  await driver();
  await page.waitForTimeout(TEARDOWN_MS);
  const inWindow = egress; // what a teardown at +TEARDOWN_MS would have delivered
  // Then let it settle to prove the enqueued path is a TIMING loss, not a bug.
  let prev = -1, stable = 0;
  for (let i = 0; i < 30 && stable < 4; i++) {
    await page.waitForTimeout(150);
    await page.evaluate(() => window.__rig.snapshot()); // drain worker path if any
    if (egress === prev) stable++; else { stable = 0; prev = egress; }
  }
  return {
    scenario: label,
    expected,
    delivered_in_teardown_window: inWindow,
    delivered_after_settle: egress,
    survives_teardown: inWindow >= expected,
  };
}

const results = [];
results.push(await measure(
  "1. enqueued last beacon — push() via the worker round-trip",
  TRACKERS,
  () => page.evaluate(() => window.__rig.push({ type: "page_view", params: { scenario: "enqueued" } })),
));
results.push(await measure(
  "2. critical last beacon — pushCritical() synchronous fast path",
  TRACKERS,
  () => page.evaluate(() => window.__rig.pushCritical({ type: "page_view", params: { scenario: "critical" } })),
));
results.push(await measure(
  "3. ring tail flushed at visibilitychange -> hidden",
  RING_K * TRACKERS,
  () => page.evaluate((K) => {
    for (let i = 0; i < K; i++) window.__rig.push({ type: "spike_interaction", params: { i } });
    // Go hidden BEFORE the idle drain runs: the ring still holds all K, so the
    // synchronous unloadFlush is what delivers them.
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    document.dispatchEvent(new Event("visibilitychange", { bubbles: true }));
  }, RING_K),
));

const out = {
  config: { trackers: TRACKERS, work_us: WORK, teardown_ms: TEARDOWN_MS, ring_k: RING_K },
  results,
  verdict: {
    enqueued_lost_in_window: results[0].delivered_in_teardown_window < results[0].expected,
    critical_delivered_in_window: results[1].delivered_in_teardown_window >= results[1].expected,
    ring_tail_delivered_in_window: results[2].delivered_in_teardown_window >= results[2].expected,
  },
};
if (pageErrors.length) out.pageErrors = pageErrors;
console.log(JSON.stringify(out, null, 2));

await browser.close();
server.close();
