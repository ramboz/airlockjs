// Real-Chromium replay of the frozen Adobe capture corpus through the real chamber (spec 064-17).
//
// For one fixture it feeds the recorded before-state (cookies, localStorage, sessionStorage, URL,
// referrer, viewport, screen, locale, timezone) into a real page BEFORE the page loads, boots the
// real `bootAlloy` adapter with the pinned stock Alloy 2.31.1 bundle, runs the recorded scenario,
// and returns what the chamber emitted. No live network: every vendor host is answered from the
// fixture (064-18 adds the response headers and the recorded blocked-network failure). The shared B0 field-rule primitives classify the generated fields.
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { matchesFormat } from "./field-rules.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const OUT = join(ROOT, "rig/out/b1");
export const ALLOY_VERSION = "2.31.1";
export const ALLOY_SHA256 = "7dd09409bb07d47b1b2289eec4ca15d67084a85a3d832bef6c73180889da32e8";
const ALLOY_URL = `https://cdn1.adoberesources.net/alloy/${ALLOY_VERSION}/alloy.min.js`;
const FIXTURES = join(ROOT, "test/fixtures/adobe-capture");
// Headed capture ran with a 15px classic scrollbar: innerWidth = window width - 15 (CAP finding).
export const HEADED_SCROLLBAR_PX = 15;

export async function loadFixture(name) {
  return JSON.parse(await readFile(join(FIXTURES, `${name}.json`), "utf8"));
}

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

/** The pinned bundle: `AIRLOCK_ALLOY_BUNDLE`, else a cached or downloaded copy, always SHA-verified. */
export async function ensureAlloyBundle() {
  const path = process.env.AIRLOCK_ALLOY_BUNDLE || join(OUT, `alloy-${ALLOY_VERSION}.min.js`);
  let bytes = existsSync(path) ? await readFile(path) : null;
  if (!bytes) {
    const res = await fetch(ALLOY_URL);
    if (!res.ok) throw new Error(`alloy ${ALLOY_VERSION} download failed: ${res.status}`);
    bytes = Buffer.from(await res.arrayBuffer());
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, bytes);
  }
  if (sha256(bytes) !== ALLOY_SHA256) throw new Error(`alloy bundle at ${path} does not match the ${ALLOY_VERSION} pin`);
  return bytes;
}

let built = null;
/** Build the real adapter and the (rig-wrapped) real chamber worker once per process. */
export function buildArtifacts() {
  built ||= (async () => {
    const common = { bundle: true, format: "iife", platform: "browser", target: "es2022", write: false, logLevel: "silent" };
    const [adapter, worker] = await Promise.all([
      build({ ...common, entryPoints: [join(ROOT, "adapters/eds/index.js")], globalName: "AirlockEds" }),
      build({ ...common, entryPoints: [join(ROOT, "rig/b1-chamber-entry.js")] }),
    ]);
    return { adapter: adapter.outputFiles[0].text, worker: worker.outputFiles[0].text };
  })();
  return built;
}

const PAGE_SCRIPT = `
window.__diag = [];
for (const level of ["warn", "error"]) {
  const native = console[level].bind(console);
  console[level] = (...a) => { try { for (const x of a) if (x && typeof x === "object" && x.kind) window.__diag.push(JSON.parse(JSON.stringify(x))); } catch (e) {} native(...a); };
}
window.__observed = []; window.__responses = []; window.__results = new Map(); window.__seq = 0;
const NativeWorker = window.Worker;
window.Worker = class extends NativeWorker {
  constructor(...a) {
    super(...a);
    window.__worker = this;
    this.addEventListener("message", (e) => {
      const m = e.data || {};
      if (m.type === "rig-observed") window.__observed.push(m.request);
      if (m.type === "rig-response") window.__responses.push(m.response);
      if (m.type === "rig-command-result") window.__results.get(m.id)?.(m);
    });
  }
};
window.__command = (command, options) => new Promise((resolve) => {
  const id = ++window.__seq; window.__results.set(id, resolve);
  window.__worker.postMessage({ type: "rig-command", id, command, options });
});
`;

const pageHtml = (bootOptions, title, bodyHtml = "", headHtml = "") => `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>${headHtml}
<script src="/rig/airlock-eds.js"></script><script>${PAGE_SCRIPT}</script></head><body>${bodyHtml}
<script>AirlockEds.bootAlloy(${JSON.stringify(bootOptions)}).then((h) => { window.__handle = h; });</script></body></html>`;

/** The recorded page view: the capture page sent this XDM with `sendEvent`. */
export const PAGE_VIEW = { event: "page_view", xdm: { eventType: "web.webpagedetails.pageViews", web: { webPageDetails: { name: "airlock064-page" } } } };

const interactResponses = (fixture) => fixture.requests.filter((r) => r.method === "POST");

/**
 * Replay one fixture.
 * @param {import("playwright").Browser} browser
 * @param {string|object} name fixture file stem, or a synthetic fixture object of the same shape (064-22)
 * @param {{ bootOptions?: object, title?: string, commands?: {command: string, options?: object}[], extraHosts?: string[], respond?: Function, extraCookies?: object[], run?: (page: import("playwright").Page) => Promise<unknown> }} [opts]
 *   `event: null` skips the default page-view push; `run(page)` drives a scenario of its own (064-19) and its value lands in `results.run`.
 *   064-20: `bodyHtml` / `headHtml` seed the replay page (a placement box, a link to click, a prehiding target).
 *   `bootOptions` is merged into the bootAlloy options (a site opt-in such as a reduced `context`).
 *   064-26: `skipSteps` leaves the recorded getIdentity / appendIdentityToUrl steps to `run(page)`, which drives them through `handle.command`.
 *   064-18: `extraHosts` are further vendor hosts answered from the fixture (a first-party edge domain);
 *   `respond(request, index)` may return `{ status, headers, body }` to override the recorded answer.
 */
export async function replayFixture(browser, name, { bootOptions = {}, title = "airlock064-page", seed = true, event = PAGE_VIEW, commands = [], extraHosts = [], respond = null, extraCookies = [], run = null, bodyHtml = "", headHtml = "", skipSteps = false } = {}) {
  // 064-22: a caller may pass a synthetic fixture object instead of a recorded file stem.
  const fixture = typeof name === "object" ? name : await loadFixture(name);
  const { manifest, capture } = fixture;
  const input = manifest.input_state;
  const pageUrl = new URL(input.url);
  const bundle = await ensureAlloyBundle();
  const { adapter, worker } = await buildArtifacts();
  const datastreamId = "23190fa7-9e6b-4250-b87b-abcdc8ebc297";
  const orgId = "908936ED5D35CC220A495CD4@AdobeOrg";

  const headed = input.mode === "headed";
  const context = await browser.newContext({
    viewport: { width: input.viewport.width - (headed ? HEADED_SCROLLBAR_PX : 0), height: input.viewport.height },
    screen: { width: input.viewport.width, height: input.viewport.height },
    deviceScaleFactor: 1,
    locale: input.locale,
    timezoneId: input.timezone,
    userAgent: capture.user_agent,
  });
  try {
    if (extraCookies.length) {
      await context.addCookies(extraCookies.map((c) => ({ path: "/", secure: true, sameSite: "Lax", ...c })));
    }
    if (seed) {
      const before = input.storage_before;
      if (before.cookies.length) {
        await context.addCookies(before.cookies.map((c) => ({ name: c.name, value: c.value, domain: c.domain, path: c.path || "/", secure: true, sameSite: "Lax" })));
      }
      await context.addInitScript(({ local, session, origin }) => {
        if (location.origin !== origin) return;
        for (const [k, v] of Object.entries(local)) localStorage.setItem(k, v);
        for (const [k, v] of Object.entries(session)) sessionStorage.setItem(k, v);
      }, { local: before.local_storage, session: before.session_storage, origin: pageUrl.origin });
    }

    const recorded = interactResponses(fixture);
    const network = [];
    const page = await context.newPage();
    const logs = [];
    page.on("console", (m) => logs.push(m.text()));
    page.on("pageerror", (e) => logs.push(String(e)));
    await page.route("**/*", async (route) => {
      const req = route.request();
      const url = new URL(req.url());
      if (url.origin === pageUrl.origin) {
        if (url.pathname === "/rig/airlock-eds.js") return route.fulfill({ contentType: "text/javascript", body: adapter });
        if (url.pathname === "/rig/chamber.js") return route.fulfill({ contentType: "text/javascript", body: worker });
        if (url.pathname === "/rig/alloy.min.js") return route.fulfill({ contentType: "text/javascript", body: bundle });
        const opts = { datastreamId, orgId, consentHold: false, bundleUrl: `${pageUrl.origin}/rig/alloy.min.js`, workerUrl: "/rig/chamber.js", ...bootOptions };
        return route.fulfill({ contentType: "text/html", body: pageHtml(opts, title, bodyHtml, headHtml) });
      }
      if (/adobedc\.(demdex|net)|edge\.adobedc\.net/.test(url.hostname) || extraHosts.includes(url.hostname)) {
        const headers = await req.allHeaders();
        network.push({ url: req.url(), method: req.method(), headers, body: req.postData() });
        const index = network.length - 1;
        const answer = recorded[index] || recorded[recorded.length - 1];
        const override = respond ? respond(req, index) : null;
        if (override === "abort" || (!override && answer && answer.failure)) return route.abort("blockedbyclient");
        if (override) return route.fulfill(override);
        // The recorded answer carries the CORS headers for the capture page origin and the edge
        // headers the tag reads (`x-adobe-edge`, `Retry-After`); transport framing is dropped.
        const keep = Object.fromEntries(Object.entries((answer && answer.response_headers) || {}).filter(([k]) => !/^(content-encoding|content-length|set-cookie|date|server|via|strict-transport-security)$/i.test(k)));
        return route.fulfill({ status: answer ? answer.status : 200, headers: { ...keep, "content-type": keep["content-type"] || "application/json" }, body: answer ? answer.response_body : "{}" });
      }
      return route.fulfill({ status: 204, body: "" });
    });

    await page.goto(input.url, { referer: input.referrer || undefined, waitUntil: "load" });
    await page.waitForFunction(() => window.__worker && window.__handle, null, { timeout: 15000 });

    const results = {};
    const steps = capture.steps.map((s) => s.step);
    if (steps.includes("sendEvent") && event) {
      await page.evaluate((evt) => window.__handle.push(evt), event);
      await page.waitForFunction(() => window.__observed.length > 0, null, { timeout: 5000 }).catch(() => {});
    }
    for (const step of skipSteps ? [] : steps) {
      if (step === "getIdentity") {
        const r = await page.evaluate(() => window.__command("getIdentity", {}));
        results.getIdentity = r;
      } else if (step === "appendIdentityToUrl") {
        const r = await page.evaluate(() => window.__command("appendIdentityToUrl", { url: "https://destination.example/landing" }));
        results.appendIdentityToUrl = r;
      }
    }
    for (const c of commands) results[c.command] = await page.evaluate((x) => window.__command(x.command, x.options), c);
    if (run) results.run = await run(page);
    await page.waitForTimeout(250);
    const observed = await page.evaluate(() => window.__observed);
    const responses = await page.evaluate(() => window.__responses);
    const diagnostics = await page.evaluate(() => window.__diag);
    const pageCookies = await context.cookies();
    return { fixture, observed, responses, diagnostics, network, results, pageCookies, logs };
  } finally {
    await context.close();
  }
}

const isPlain = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

/** Flatten JSON into `path -> primitive`, array indexes as `[i]`. */
export function flatten(value, prefix = "", out = {}) {
  if (Array.isArray(value)) value.forEach((v, i) => flatten(v, `${prefix}[${i}]`, out));
  else if (isPlain(value)) for (const [k, v] of Object.entries(value)) flatten(v, prefix ? `${prefix}.${k}` : k, out);
  else out[prefix] = value;
  return out;
}

// Generated per request and compared by shape (spec 064 section 2.3): never by value.
const GENERATED = {
  "events[0].xdm.timestamp": (v) => typeof v === "string" && !Number.isNaN(Date.parse(v)),
  "events[0].xdm.placeContext.localTime": (v) => typeof v === "string" && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}[+-]\d\d:\d\d$/.test(v),
  "meta.queueTimeMillis": (v) => Number.isInteger(v) && v >= 0,
};

/** The request URL without its generated `requestId`, plus whether that id has the UUID shape. */
export function splitRequestUrl(url) {
  const u = new URL(url);
  const id = u.searchParams.get("requestId");
  u.searchParams.delete("requestId");
  return { stable: u.toString(), requestIdValid: matchesFormat(id || "", { kind: "uuid" }) };
}

/**
 * Compare a body the chamber emitted with a recorded body. Returns the paths whose values differ
 * once the generated fields are replaced by their shape check.
 */
export function diffBodies(actualText, expectedText) {
  const a = flatten(JSON.parse(actualText));
  const e = flatten(JSON.parse(expectedText));
  const diffs = [];
  for (const path of new Set([...Object.keys(a), ...Object.keys(e)])) {
    const gen = GENERATED[path];
    if (gen) {
      if (!gen(a[path]) || !gen(e[path])) diffs.push(path);
    } else if (a[path] !== e[path]) diffs.push(path);
  }
  return diffs.sort();
}

/** Paths where two recorded bodies differ, generated fields excluded (the exact one-factor delta). */
export const recordedDelta = (baseText, variantText) => diffBodies(variantText, baseText);

export const recordedInteract = (fixture) => fixture.requests.find((r) => r.method === "POST");
