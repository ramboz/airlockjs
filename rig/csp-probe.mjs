// CSP / Trusted-Types probe (spec 004-01, risk-first). Answers: does
// `new Worker({ type: "module" })` — the airlock's off-thread boundary —
// instantiate AND run one cycle under the EDS boilerplate's real CSP
// (script-src 'nonce-aem' 'strict-dynamic' ...; NO worker-src) with
// `require-trusted-types-for 'script'` active? If blocked, which minimal
// accommodation unblocks it?
//
// The CSP is delivered as an HTTP RESPONSE HEADER (faithful to the boilerplate's
// move-to-http-header="true"), across three variants tested in sequence:
//   boilerplate  — exactly the testbed CSP (head.html), no worker-src
//   worker-self  — boilerplate + worker-src 'self'
//   worker-blob  — boilerplate + worker-src 'self' blob:
//
// Usage: node rig/csp-probe.mjs
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

const BOILERPLATE =
  "script-src 'nonce-aem' 'strict-dynamic' 'unsafe-inline' http: https:; " +
  "base-uri 'self'; object-src 'none'; frame-src 'self' https:; " +
  "require-trusted-types-for 'script';";
const CSP = {
  boilerplate: BOILERPLATE,
  "worker-self": BOILERPLATE + " worker-src 'self';",
  "worker-blob": BOILERPLATE + " worker-src 'self' blob:;",
};

async function probe(csp) {
  const server = http.createServer(async (req, res) => {
    try {
      const p = decodeURIComponent((req.url || "/").split("?")[0]);
      const file = join(ROOT, normalize(p));
      if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
      const body = await readFile(file);
      // CSP header on EVERY response (models a CDN applying it globally).
      res.writeHead(200, {
        "content-type": MIME[extname(file)] || "application/octet-stream",
        "content-security-policy": csp,
      });
      res.end(body);
    } catch (e) { res.writeHead(404); res.end("404 " + e.message); }
  });
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;

  const browser = await chromium.launch();
  const page = await browser.newPage();
  let egress = 0;
  await page.route("**/collect*", (route) => { egress++; return route.fulfill({ status: 204, body: "" }); });
  const consoleErrors = [];
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
  page.on("pageerror", (e) => consoleErrors.push("pageerror: " + String(e)));

  await page.goto(`http://localhost:${port}/rig/csp-probe.html`);
  await page.waitForFunction(() => window.__cspReady === true, { timeout: 10000 }).catch(() => {});
  // give a worker cycle time to complete (or fail)
  await page.waitForTimeout(600);

  const state = await page.evaluate(() => window.__csp || null);
  // NEGATIVE CONTROL: the non-nonce'd inline script must have been blocked.
  const controlRan = await page.evaluate(() => window.__cspControlRan === true);
  const cspEnforced = controlRan === false;
  const workerCycled = egress > 0;
  await browser.close();
  server.close();

  return {
    csp,
    csp_enforced: cspEnforced, // false => header not applied, verdict is INVALID
    importedRuntime: state?.importedRuntime ?? null,
    ttPolicyInstalled: state?.ttPolicyInstalled ?? null,
    workerConstructed: state?.workerConstructed ?? null,
    worker_cycled: workerCycled,
    egress,
    violations: state?.violations ?? [],
    errors: (state?.errors ?? []).concat(consoleErrors),
    verdict: !cspEnforced
      ? "INVALID — CSP not enforced (negative control ran); result cannot be trusted"
      : workerCycled
        ? "RUNS — worker constructed and cycled a mapped request under an ENFORCED CSP"
        : state?.workerConstructed === false
          ? "BLOCKED at construction (CSP/Trusted-Types)"
          : "CONSTRUCTED but cycle did not complete (async worker load blocked or slow)",
  };
}

const results = {};
results.boilerplate = await probe(CSP.boilerplate);
// Only escalate to accommodations if the real boilerplate CSP did not run the worker.
if (!results.boilerplate.worker_cycled) {
  results["worker-self"] = await probe(CSP["worker-self"]);
  if (!results["worker-self"].worker_cycled) {
    results["worker-blob"] = await probe(CSP["worker-blob"]);
  }
}

const runsUnderBoilerplate =
  results.boilerplate.csp_enforced && results.boilerplate.worker_cycled;
const minimalAccommodation = runsUnderBoilerplate
  ? "none — runs under the unmodified EDS boilerplate CSP"
  : results["worker-self"]?.worker_cycled
    ? "worker-src 'self'"
    : results["worker-blob"]?.worker_cycled
      ? "worker-src 'self' blob:"
      : "UNRESOLVED — none of the tested CSP variants ran the worker";

console.log(JSON.stringify({
  question: "new Worker({type:module}) under EDS boilerplate CSP + Trusted Types?",
  csp_enforced: results.boilerplate.csp_enforced, // negative control: must be true for a valid run
  runs_under_boilerplate: runsUnderBoilerplate,
  minimal_accommodation: minimalAccommodation,
  results,
}, null, 2));
