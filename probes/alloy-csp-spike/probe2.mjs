// Spike 033-01 follow-up — does a WORKER-REALM `default` Trusted Types policy
// unblock the classic importScripts under the boilerplate CSP? And is the
// admission same-origin-only (strict-dynamic host-allowlist ignored)?
//
// Primary server: CSP header on every response (the worker inherits it). Secondary
// server: a DIFFERENT origin serving mark.js, to test a cross-origin importScripts.
//
// Usage: node probes/alloy-csp-spike/probe2.mjs
import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const HERE = dirname(fileURLToPath(import.meta.url));
const MIME = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript" };
const CSP =
  "script-src 'nonce-aem' 'strict-dynamic' 'unsafe-inline' http: https:; " +
  "base-uri 'self'; object-src 'none'; frame-src 'self' https:; require-trusted-types-for 'script';";

// Secondary (cross-origin) server: serves mark.js with permissive headers, NO CSP.
const xServer = http.createServer(async (_req, res) => {
  res.writeHead(200, { "content-type": "text/javascript", "access-control-allow-origin": "*" });
  res.end("self.__RAN = true;");
});
await new Promise((r) => xServer.listen(0, r));
const xPort = xServer.address().port;
const crossOriginMark = `http://127.0.0.1:${xPort}/mark.js`; // 127.0.0.1 vs localhost => different origin

const server = http.createServer(async (req, res) => {
  try {
    const p = decodeURIComponent((req.url || "/").split("?")[0]);
    const file = join(HERE, normalize(p === "/" ? "/harness2.html" : p));
    if (!file.startsWith(HERE)) { res.writeHead(403); return res.end(); }
    const body = await readFile(file);
    res.writeHead(200, { "content-type": MIME[extname(file)] || "application/octet-stream", "content-security-policy": CSP });
    res.end(body);
  } catch (e) { res.writeHead(404); res.end("404 " + e.message); }
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

const browser = await chromium.launch();
const page = await browser.newPage();
const consoleErrors = [];
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
page.on("pageerror", (e) => consoleErrors.push("pageerror: " + String(e)));
// Inject the cross-origin URL before page scripts run (not subject to CSP).
await page.addInitScript((u) => { window.__CROSS_ORIGIN_MARK = u; }, crossOriginMark);

await page.goto(`http://localhost:${port}/harness2.html`);
await page.waitForFunction(() => window.__cspReady === true, { timeout: 15000 }).catch(() => {});
const R = await page.evaluate(() => window.__RESULT || null);
await browser.close();
server.close();
xServer.close();

const enforced = R && R.cspControlRan === false;
const so = R && R.ttFix && R.ttFix.sameOrigin;
const xo = R && R.ttFix && R.ttFix.crossOrigin;
console.log(JSON.stringify({
  question: "Does a worker-realm default TT policy unblock classic importScripts under the boilerplate CSP? Same-origin only?",
  csp_enforced_negative_control: enforced,
  worker_default_tt_policy_installed: R && R.ttFix && R.ttFix.policyInstalled,
  same_origin_importscripts_admitted_after_tt_fix: !!(so && so.executed),
  cross_origin_importscripts_admitted_after_tt_fix: !!(xo && xo.executed),
  main_thread_violations: (R && R.violations) || [],
  detail: { sameOrigin: so, crossOrigin: xo, policyError: R && R.ttFix && R.ttFix.policyError },
  console_errors: consoleErrors,
  verdict: !enforced
    ? "INVALID — CSP not enforced"
    : (so && so.executed)
      ? ("ADMITTED after worker-realm default TT policy — same-origin importScripts runs" + (xo ? ("; cross-origin " + (xo.executed ? "ALSO admitted" : "BLOCKED (" + xo.error + ")")) : ""))
      : ("STILL BLOCKED after TT fix — " + (so && so.error)),
}, null, 2));
