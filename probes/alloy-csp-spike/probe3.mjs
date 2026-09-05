// Spike 033-01 follow-up #2 — confirm the EXPLICIT named-policy pattern (the one
// I'd recommend shipping, more surgical than clobbering `default`): the worker
// creates a NAMED policy and passes importScripts a TrustedScriptURL from its
// createScriptURL, under the enforced boilerplate CSP.
//
// Everything inline (worker via blob is itself CSP-gated, so we serve a worker
// file). Usage: node probes/alloy-csp-spike/probe3.mjs
import http from "node:http";
import { chromium } from "playwright";

const CSP =
  "script-src 'nonce-aem' 'strict-dynamic' 'unsafe-inline' http: https:; " +
  "base-uri 'self'; object-src 'none'; frame-src 'self' https:; require-trusted-types-for 'script';";

const WORKER = `
self.onmessage = (ev) => {
  const url = ev.data && ev.data.url;
  let policyCreated = false, executed = false, threw = false, error = null;
  try {
    const p = self.trustedTypes.createPolicy("airlock-worker", { createScriptURL: (s) => s });
    policyCreated = true;
    self.__RAN = false;
    self.importScripts(p.createScriptURL(url)); // explicit TrustedScriptURL
    executed = self.__RAN === true;
  } catch (e) { threw = true; error = String((e && (e.message || e.name)) || e); }
  self.postMessage({ policyCreated, executed, threw, error });
};`;
const MARK = "self.__RAN = true;";
const HARNESS = `<!doctype html><meta charset=utf-8>
<script>window.__cspControlRan=true;</script>
<script type=module nonce=aem>
const R={cspControlRan:null,constructed:null,res:null};window.__RESULT=R;
if(window.trustedTypes&&window.trustedTypes.createPolicy){try{window.trustedTypes.createPolicy("default",{createScriptURL:s=>s,createHTML:s=>s,createScript:s=>s});}catch(e){}}
await new Promise((resolve)=>{let w;try{w=new Worker(new URL("./w.js",import.meta.url));R.constructed=true;}catch(e){R.constructed=false;R.res={constructError:String(e)};return resolve();}
w.onmessage=(ev)=>{R.res=ev.data;resolve();};w.onerror=(e)=>{R.res={onerror:String(e&&(e.message||e.type))};resolve();};
w.postMessage({url:new URL("./mark.js",import.meta.url).href});setTimeout(resolve,4000);});
R.cspControlRan=window.__cspControlRan===true;window.__cspReady=true;
</script>`;

const server = http.createServer((req, res) => {
  const p = (req.url || "/").split("?")[0];
  const send = (ct, body) => { res.writeHead(200, { "content-type": ct, "content-security-policy": CSP }); res.end(body); };
  if (p === "/w.js") return send("text/javascript", WORKER);
  if (p === "/mark.js") return send("text/javascript", MARK);
  return send("text/html", HARNESS);
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`http://localhost:${port}/`);
await page.waitForFunction(() => window.__cspReady === true, { timeout: 15000 }).catch(() => {});
const R = await page.evaluate(() => window.__RESULT || null);
await browser.close();
server.close();

const enforced = R && R.cspControlRan === false;
console.log(JSON.stringify({
  question: "Explicit named TT policy + createScriptURL unblocks classic importScripts under boilerplate CSP?",
  csp_enforced_negative_control: enforced,
  worker_constructed: R && R.constructed,
  named_policy_created_in_worker: R && R.res && R.res.policyCreated,
  importscripts_executed: R && R.res && R.res.executed,
  detail: R && R.res,
  verdict: !enforced ? "INVALID — CSP not enforced"
    : (R && R.res && R.res.executed) ? "ADMITTED — explicit named-policy createScriptURL wrapping works"
    : "BLOCKED — " + JSON.stringify(R && R.res),
}, null, 2));
