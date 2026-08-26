// Lighthouse pass (spec 003-03): confirm loading the airlock runtime doesn't
// regress lab CWV (the "100 Lighthouse" half of the bet). Lighthouse measures
// page LOAD (LCP/CLS/TBT/FCP), not interaction — the interaction cost (INP) is
// measured separately by rig/measure.mjs. Uses Playwright's chromium.
// Usage: MODE=worker|naive|deferred node rig/lh.mjs
import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { launch } from "chrome-launcher";
import lighthouse from "lighthouse";
import { chromium } from "playwright";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const MIME = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".css": "text/css" };
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

const MODE = process.env.MODE || "worker";
const url = `http://localhost:${port}/rig/harness.html?mode=${MODE}&trackers=5&work=30000`;

const chrome = await launch({ chromePath: chromium.executablePath(), chromeFlags: ["--headless=new", "--no-sandbox"] });
const res = await lighthouse(url, {
  port: chrome.port,
  onlyCategories: ["performance"],
  formFactor: "desktop",
  screenEmulation: { disabled: true },
});
const a = res.lhr.audits;
console.log(JSON.stringify({
  mode: MODE,
  performance: Math.round(res.lhr.categories.performance.score * 100),
  FCP_ms: Math.round(a["first-contentful-paint"].numericValue),
  LCP_ms: Math.round(a["largest-contentful-paint"].numericValue),
  TBT_ms: Math.round(a["total-blocking-time"].numericValue),
  CLS: a["cumulative-layout-shift"].numericValue,
}, null, 2));

await chrome.kill();
server.close();
