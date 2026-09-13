// Alloy native `defaultConsent:"pending"` queue+flush — CREDS-FREE grounding rig (spec 045-02).
//
// Grounds the load-bearing claim that alloy's OWN hold-until-consent works: under
// `defaultConsent:"pending"` alloy QUEUES a sendEvent (no interact egresses), and a later
// `setConsent(collect:"y")` — with the set-consent request egressing + returning a valid consent
// handle — FLUSHES the queue (the interact fires, sendEvent resolves with its decisions round-trip).
// This is what 045-02 relies on instead of a hand-rolled buffer or the (infeasible) seam hold+flush
// (the two frame-critiques). It is the vendor's designed mechanism, so airlock uses it (fidelity).
//
// CREDS-FREE (no live Edge / no datastream secret): drives the REAL, probe-local
// `@adobe/alloy@2.35.0` bundle (ADR-0016 adopter-supplied, gitignored under probes/alloy-worker) in a
// real chromium via playwright, on a real local origin, with alloy's Edge interact + set-consent
// requests INTERCEPTED and stubbed (mint interact response / a synthetic consent state:store handle).
// Mirrors rig/alloy-chamber.mjs's creds-free stub-Edge posture. All ids are synthetic — NO live
// identifiers are used or captured.
//
// Usage: node rig/alloy-consent-pending.mjs   (exits non-zero if the queue/flush grounding fails)
//   (requires the probe-local bundle: `cd probes/alloy-worker && npm ci`)
import http from "node:http";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { mintInteractResponse } from "./alloy-mint-stub.js";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const ALLOY_DIST = join(ROOT, "probes/alloy-worker/node_modules/@adobe/alloy/dist/alloy.js");

// Standard @adobe/alloy async base-code snippet: defines window.alloy as a queueing command fn; the
// dist IIFE (loaded after) drains __alloyNS + the queue.
const ALLOY_SNIPPET = `!function(n,o){o.forEach(function(o){n[o]||((n.__alloyNS=n.__alloyNS||[]).push(o),n[o]=function(){var u=arguments;return new Promise(function(i,l){n[o].q.push([i,l,u])})},n[o].q=[])})}(window,["alloy"]);`;

const PAGE = `<!doctype html><html><head><meta charset="utf-8"><title>alloy defaultConsent:pending grounding</title>
<script>${ALLOY_SNIPPET}</script>
<script src="/alloy.js"></script>
</head><body><h1>045-02 grounding</h1>
<script>
  window.__P = { steps: [] };
  // defaultConsent "pending" => alloy holds commands until setConsent resolves (the native queue).
  alloy("configure", { datastreamId: "00000000-0000-0000-0000-000000000000", orgId: "SPIKE@AdobeOrg", defaultConsent: "pending", context: [], debugEnabled: true })
    .then(() => window.__P.steps.push("configured"), (e) => window.__P.steps.push("configure-rejected: " + (e && e.message)));
  // sendEvent under pending — EXPECT it to QUEUE (no interact) until setConsent.
  alloy("sendEvent", { xdm: { eventType: "web.webpagedetails.pageViews", web: { webPageDetails: { URL: "https://airlock.example/pricing", name: "pricing" } } } })
    .then(() => window.__P.steps.push("sendEvent-resolved"), (e) => window.__P.steps.push("sendEvent-rejected: " + (e && e.message)));
  // grant() flips consent to "in" -> alloy should FLUSH the queued sendEvent.
  window.grant = () => alloy("setConsent", { consent: [{ standard: "Adobe", version: "2.0", value: { collect: { val: "y" } } }] })
    .then(() => window.__P.steps.push("setConsent-resolved"), (e) => window.__P.steps.push("setConsent-rejected: " + (e && e.message)));
</script>
</body></html>`;

async function main() {
  const alloyJs = await readFile(ALLOY_DIST, "utf8").catch(() => null);
  if (!alloyJs) {
    console.log(JSON.stringify({ pass: false, verdict: "missing probe-local @adobe/alloy bundle — run `cd probes/alloy-worker && npm ci`" }, null, 2));
    process.exit(2);
  }
  const server = http.createServer(async (req, res) => {
    const p = (req.url || "").split("?")[0];
    if (p === "/" || p === "/index.html") { res.writeHead(200, { "content-type": "text/html" }); return void res.end(PAGE); }
    if (p === "/alloy.js") { res.writeHead(200, { "content-type": "text/javascript" }); return void res.end(alloyJs); }
    res.writeHead(404); res.end("nf");
  });
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;

  const interactHits = [];
  const edgeReqs = [];
  let phase = "pending";
  let browser;
  try {
    browser = await chromium.launch();
    const page = await browser.newPage();
    // Intercept every Adobe Edge request; fulfill INTERACT with a mint response and SET-CONSENT with a
    // synthetic consent state:store handle (an empty response does NOT flush — alloy needs "User consented").
    await page.route((u) => /adobedc\.demdex\.net|edge\.adobedc\.net/.test(u.href), async (route) => {
      const href = route.request().url();
      const isInteract = /\/interact/.test(href);
      const isSetConsent = /set-consent/.test(href);
      const kind = isInteract ? "interact" : isSetConsent ? "set-consent" : "other";
      edgeReqs.push({ phase, kind, method: route.request().method() });
      if (isInteract) interactHits.push({ phase });
      const body = isInteract
        ? JSON.stringify(mintInteractResponse().response)
        : JSON.stringify({ requestId: "grounding-consent", handle: [{ type: "state:store", payload: [{ key: "kndctr_SPIKE_AdobeOrg_consent", value: "general=in", maxAge: 15552000 }] }] });
      await route.fulfill({ status: 200, contentType: "application/json", body });
    });

    await page.goto(`http://localhost:${port}/`, { waitUntil: "load" });
    await page.waitForTimeout(2500); // configure + the pending sendEvent settle/queue
    const stepsPending = await page.evaluate(() => window.__P.steps.slice());
    const interactsBeforeGrant = interactHits.length;

    phase = "granted";
    await page.evaluate(() => window.grant());
    await page.waitForTimeout(4000); // set-consent round-trip THEN the flushed interact
    const stepsAfter = await page.evaluate(() => window.__P.steps.slice());
    const interactsAfterGrant = interactHits.length;

    const pass =
      interactsBeforeGrant === 0 &&                       // queued under defaultConsent:pending
      interactsAfterGrant >= 1 &&                         // flushed on setConsent grant
      stepsAfter.includes("sendEvent-resolved");          // the queued sendEvent completed its round-trip
    const out = {
      pass,
      verdict: pass
        ? "GROUNDED: defaultConsent:pending queued the sendEvent; setConsent(y) + a valid set-consent round-trip flushed it (interact fired, round-trip resolved)."
        : "NOT GROUNDED — see steps/edgeReqs",
      interactsBeforeGrant,
      interactsAfterGrant,
      edgeReqs,
      stepsPending,
      stepsAfter,
    };
    console.log(JSON.stringify(out, null, 2));
    await browser.close();
    server.close();
    process.exit(pass ? 0 : 1);
  } catch (e) {
    console.log(JSON.stringify({ pass: false, error: String((e && e.stack) || e).slice(0, 600) }, null, 2));
    try { await browser?.close(); } catch {}
    server.close();
    process.exit(2);
  }
}
main();
