// Live before/after CWV harness — spec 036-01. Answers "does adopting airlock preserve
// Core Web Vitals?" against a REAL EDS (Edge Delivery Services) site, reusing
// rig/lh-eds.mjs's proven interleaved-median/delta/band engine — now extracted into
// rig/lh-core.mjs (AC1) so BOTH rigs share ONE engine, not a parallel re-implementation.
//
// PRIMARY mode — query-gated SINGLE deployment (frame-critique fork A, ratified). ONE
// operator-supplied live URL, measured OFF (the plain URL — a bare no-airlock page) vs ON
// (URL?<QUERY_PARAM>=1). Same URL -> cache/edge/content/origin held CONSTANT, so the tight
// TBT/CLS band (carried from lh-eds) stays meaningful (exactly lh-eds's own invariant).
// This rig does NOT implement the gate itself — it is operator-side scaffolding on a
// THROWAWAY validation branch covering BOTH airlock entrypoints (scripts.js:184 eager +
// :246 lazy) — see docs/real-site-validation.md. This rig is URL-agnostic (no hardcoded
// host); the query-param name is configurable (QUERY_PARAM, default "airlock").
//
// FALLBACK mode — two distinct deployments (BASELINE_URL + ADOPTED_URL). Ships with the
// acceptance band EXPLICITLY WITHHELD: a FIXED between-deployment bias (CDN warmth, edge
// PoP, hostname routing) is not cancelled by interleaving, which only cancels TIME-VARYING
// drift against one server. Answers "grossly regressed?", not "preserved within 50ms".
//
// LOCAL DRY-RUN (no LIVE_URL / BASELINE_URL+ADOPTED_URL given) — spec 036-01 AC5, frame-
// critique fork B: drives the query-gate mode against the local testbed, extending
// lh-eds.mjs's local server to gate BOTH airlock entrypoints on the SAME ?<QUERY_PARAM>=1
// the live procedure uses, read from the entry page's OWN request query string (not an
// externally-flipped toggle) — so the local run faithfully exercises the real client-side
// gate semantics, not just plumbing. PROFILE=ga4 (default) reuses the existing testbed
// index.html byte-for-byte (a no-op OFF vs the real bundle ON, exactly lh-eds.mjs's
// substrate). PROFILE=alloy-analytics / PROFILE=personalization serve the AUTHORED
// probes/eds-testbed/index-alloy.html fixture, injecting a window.__airlockConfig with a
// STUB bundleUrl (rig/alloy-csp-stub-bundle.js, reused verbatim from spec 033-02's CSP
// rig — NOT the real ~766 KB @adobe/alloy, NOT a live Adobe Edge round-trip) so the
// eager-reserve pre-`appear` PATH runs locally too.
//
// PROFILE (operator-declared; the harness cannot introspect a remote site's
// window.__airlockConfig): "ga4" (no __airlockConfig -> LCP delta ~0 BY CONSTRUCTION, the
// tight band is the pass/fail read) | "alloy-analytics" (__airlockConfig, no placements ->
// LCP is a MEASURED delta, no by-construction claim; CLS should hold) | "personalization"
// (__airlockConfig with placements -> LCP measured; CLS should hold/IMPROVE — an
// improvement is a PASS signal). See rig/lh-core.mjs's bandDisposition for the decision.
//
// Usage:
//   node rig/lh-live.mjs                                    # local dry-run, PROFILE=ga4
//   PROFILE=alloy-analytics node rig/lh-live.mjs             # local dry-run, alloy fixture (no placements)
//   PROFILE=personalization node rig/lh-live.mjs             # local dry-run, alloy fixture (placements)
//   PROFILE=ga4 LIVE_URL=https://main--site--org.aem.page/ node rig/lh-live.mjs   # query-gate PRIMARY (live)
//   BASELINE_URL=https://main--... ADOPTED_URL=https://airlock--... node rig/lh-live.mjs  # two-deployment FALLBACK
//   LH_N=5 QUERY_PARAM=airlock node rig/lh-live.mjs          # tunables (defaults shown)
import http from "node:http";
import { readFile } from "node:fs/promises";
import { execSync } from "node:child_process";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { launch } from "chrome-launcher";
import lighthouse from "lighthouse";
import { chromium } from "playwright";
import { armSummary, buildResult, normalizeProfile, runLighthouseOnce } from "./lh-core.mjs";

const REPO = fileURLToPath(new URL("..", import.meta.url));
const TESTBED_ROOT = join(REPO, "probes/eds-testbed");
const LH_N = Number(process.env.LH_N || 5);
const QUERY_PARAM = process.env.QUERY_PARAM || "airlock";
const PROFILE = normalizeProfile(process.env.PROFILE);

const LIVE_URL = process.env.LIVE_URL || null;
const BASELINE_URL = process.env.BASELINE_URL || null;
const ADOPTED_URL = process.env.ADOPTED_URL || null;

if ((BASELINE_URL && !ADOPTED_URL) || (!BASELINE_URL && ADOPTED_URL)) {
  console.error("rig/lh-live.mjs: BASELINE_URL and ADOPTED_URL must both be set (two-deployment FALLBACK) or both left unset.");
  process.exit(1);
}
if (LIVE_URL && BASELINE_URL) {
  console.error("rig/lh-live.mjs: set EITHER LIVE_URL (query-gate PRIMARY) OR BASELINE_URL+ADOPTED_URL (two-deployment FALLBACK), not both.");
  process.exit(1);
}

const mode = BASELINE_URL ? "two-deployment" : "query-gate";
const isLocalDryRun = mode === "query-gate" && !LIVE_URL;

const MIME = {
  ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript",
  ".json": "application/json", ".css": "text/css", ".svg": "image/svg+xml",
  ".png": "image/png", ".ico": "image/x-icon",
};
const BOILERPLATE_CSP =
  "script-src 'nonce-aem' 'strict-dynamic' 'unsafe-inline' http: https:; " +
  "base-uri 'self'; object-src 'none'; frame-src 'self' https:; " +
  "require-trusted-types-for 'script';";
// The no-airlock control module (OFF arm) — byte-identical to lh-eds.mjs's own.
const NOOP_EDS = "export function bootEdsAnalytics(){}\nexport default bootEdsAnalytics;\n";
const EDS_ENTRY = "/scripts/airlock/eds.js";
const ALLOY_STUB_PATH = "/rig-fixtures/alloy-stub.js";

// A minimal, VALID alloy connector config (ADR-0016: a stub bundleUrl — NOT the real
// ~766 KB @adobe/alloy, NOT a live Adobe Edge endpoint; this proves the LOCAL eager-reserve
// pre-appear path, not a live wire round-trip, which is the operator's creds-gated step).
function alloyConfig(profile) {
  const connector = { type: "alloy", bundleUrl: ALLOY_STUB_PATH, datastreamId: "harness-local-stub" };
  if (profile === "personalization") {
    connector.placements = [{ scope: "airlock-harness-promo", selector: "#airlock-harness-promo-slot", minHeight: 200 }];
  }
  return { connectors: [connector] };
}

// fork B (AC5) — the local dry-run server: extends lh-eds.mjs's single-server no-op-OFF
// vs real-ON substrate to gate BOTH airlock entrypoints on the entry page's OWN
// ?<queryParam>=1, so driving the SAME two URLs the live procedure drives exercises the
// real client-side gate semantics, not just plumbing.
async function startLocalDryRunServer({ profile, queryParam }) {
  // Fresh rebuild (034-02:117 pre-flight) — the ON arm serves it verbatim, matching lh-eds.mjs.
  execSync("npm run build", { cwd: REPO, stdio: "inherit" });

  const entryPath = profile === "ga4" ? "/index.html" : "/index-alloy.html";
  const alloyTemplate = profile === "ga4" ? null : await readFile(join(TESTBED_ROOT, "index-alloy.html"), "utf8");

  let arm = "off"; // derived from the most recent entry-page request's OWN query string

  const server = http.createServer(async (req, res) => {
    try {
      const reqUrl = new URL(req.url || "/", "http://internal");
      let p = decodeURIComponent(reqUrl.pathname);
      if (p === "/") p = entryPath;

      // The gate: the entry page's OWN request carries the query flag (the same shape a
      // live throwaway branch's client-side check would read from location.search) —
      // derive the "arm" from it, driving BOTH entrypoints below.
      if (p === entryPath) {
        arm = reqUrl.searchParams.get(queryParam) === "1" ? "on" : "off";
      }

      // Entrypoint :246 (the lazy boot) — OFF swaps in a real no-op module (covers BOTH
      // the `boot(config)` and `bootEdsAnalytics()` branches scripts.js may import).
      if (arm === "off" && p === EDS_ENTRY) {
        res.writeHead(200, { "content-type": "text/javascript", "content-security-policy": BOILERPLATE_CSP });
        return res.end(NOOP_EDS);
      }

      // The alloy stub bundle (ADR-0016 adopter-supplied `bundleUrl`) — served from rig/,
      // outside the testbed root, so it needs its own route.
      if (p === ALLOY_STUB_PATH) {
        const body = await readFile(join(REPO, "rig/alloy-csp-stub-bundle.js"));
        res.writeHead(200, { "content-type": "text/javascript", "content-security-policy": BOILERPLATE_CSP });
        return res.end(body);
      }

      // Entrypoint :184 (the eager reserve) — gates on window.__airlockConfig PRESENCE.
      // OFF omits the config script entirely (a genuinely bare page); ON injects it BEFORE
      // aem.js/scripts.js load (the placeholder sits ahead of both <script> tags).
      if (alloyTemplate && p === "/index-alloy.html") {
        const configScript = arm === "on"
          ? `<script nonce="aem">window.__airlockConfig = ${JSON.stringify(alloyConfig(profile))};</script>`
          : "";
        const body = alloyTemplate.replace("<!--AIRLOCK_CONFIG-->", configScript);
        res.writeHead(200, { "content-type": "text/html", "content-security-policy": BOILERPLATE_CSP });
        return res.end(body);
      }

      const file = join(TESTBED_ROOT, normalize(p));
      if (!file.startsWith(TESTBED_ROOT)) { res.writeHead(403); return res.end(); }
      const body = await readFile(file);
      res.writeHead(200, {
        "content-type": MIME[extname(file)] || "application/octet-stream",
        "content-security-policy": BOILERPLATE_CSP,
      });
      res.end(body);
    } catch (e) { res.writeHead(404); res.end("404 " + e.message); }
  });
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;
  const base = `http://localhost:${port}${entryPath}`;
  return {
    offUrl: base,
    onUrl: `${base}?${queryParam}=1`,
    close: () => server.close(),
    note:
      `local dry-run (fork B) — the entry page's OWN ?${queryParam}=1 query string gates BOTH airlock ` +
      "entrypoints (scripts.js :184 eager + :246 lazy), a faithful analog of the live query-gate.",
  };
}

async function main() {
  let offUrl, onUrl, closeLocal = async () => {}, localDryRunNote = null;

  if (mode === "two-deployment") {
    offUrl = BASELINE_URL;
    onUrl = ADOPTED_URL;
  } else if (LIVE_URL) {
    const on = new URL(LIVE_URL);
    on.searchParams.set(QUERY_PARAM, "1");
    offUrl = new URL(LIVE_URL).toString();
    onUrl = on.toString();
  } else {
    const started = await startLocalDryRunServer({ profile: PROFILE, queryParam: QUERY_PARAM });
    offUrl = started.offUrl;
    onUrl = started.onUrl;
    closeLocal = started.close;
    localDryRunNote = started.note;
  }

  const chrome = await launch({ chromePath: chromium.executablePath(), chromeFlags: ["--headless=new", "--no-sandbox"] });
  try {
    const arms = { off: [], on: [] };
    for (let i = 0; i < LH_N; i++) {
      arms.off.push(await runLighthouseOnce(lighthouse, offUrl, { port: chrome.port }));
      arms.on.push(await runLighthouseOnce(lighthouse, onUrl, { port: chrome.port }));
    }

    const off = armSummary(arms.off);
    const on = armSummary(arms.on);
    const config = {
      mode,
      profile: PROFILE,
      lh_n: LH_N,
      form_factor: "desktop",
      screen_emulation: "disabled",
      query_param: QUERY_PARAM,
      iteration_order: "interleaved (off, on, off, …)",
      off_url: offUrl,
      on_url: onUrl,
      ...(isLocalDryRun ? { local_dry_run: localDryRunNote } : {}),
    };
    const out = buildResult({ mode, profile: PROFILE, config, off, on });
    console.log(JSON.stringify(out, null, 2));
  } finally {
    await chrome.kill();
    await closeLocal();
  }
}

await main();
