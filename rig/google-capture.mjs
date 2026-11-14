import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { plain, sha256 } from "./attempt-evidence-io.mjs";
import { CAPS, createPrivateOutput } from "./chamber-capture.mjs";
import { FORMAT_KINDS, evaluateFieldRule, fieldRuleShape, matchesFormat, protectedTarget } from "./field-rules.mjs";
import { scanFixtureText } from "./fixture-credentials.mjs";
import { checkFixtureManifest } from "./fixture-manifest.mjs";

// Google-specific capture tooling (spec 065 slice 04, G0). Offline and pure: it never
// launches a browser or touches the network. The manifest schema, stored-input check,
// credential check and native-side field rules are the shared modules from 064-03
// (fixture-manifest, fixture-credentials, field-rules); the private-output and size
// caps are 059-16's (chamber-capture), the byte digest is attempt-evidence-io's.
// This file adds only what is Google-specific: the drift probe (spec 4.1 parts A and
// B), the request and field classifier, the cookie-name allow-list seed (3.4) and a
// driver that records through an injected page and stores through the shared checks.
// Row lists, regions and seed classes are data, not hard-coded to today's inventory.

export const GOOGLE_VENDOR = "google-ads";
// Committed recordings live under a root the shared credential check already scans.
export const GOOGLE_CAPTURE_ROOT = "rig/captures/google-ads";

// Seed classes from spec 3.2. The corpus confirms or changes them (ADR-0061 point 10);
// pass a different table to `classifyRecordings` to follow the frozen set.
export const GOOGLE_SEED_CLASSES = Object.freeze({
  dma: Object.freeze({ class: "server_context", context: "egress_region" }),
  ...Object.fromEntries(["rnd", "rcb", "tft", "tfd", "_p", "fst", "random"]
    .map(name => [name, Object.freeze({ class: "generated" })])),
});


// ---- Drift probe part A: bytes only (4.1 step 1) ----

const cut = (bytes, region) => Buffer.concat([bytes.subarray(0, region.start), bytes.subarray(region.end)]);

// First and last differing offsets: a coarse "what moved" report, never the bytes themselves.
function moved(a, b) {
  const max = Math.min(a.length, b.length);
  let head = 0;
  while (head < max && a[head] === b[head]) head++;
  let tail = 0;
  while (tail < max - head && a[a.length - 1 - tail] === b[b.length - 1 - tail]) tail++;
  return { first_diff_offset: head, retained_changed_bytes: a.length - head - tail,
    served_changed_bytes: b.length - head - tail };
}

// `locateConfig(bytes)` returns the per-id config region `{start, end}` of a loader, or null.
// `retained` is the private-manifest expectation `{ library_length, library_sha256 }` and
// may carry `bytes` to produce a diff. `priorConfigSha256` is a same-id baseline (day 2).
export function recordDriftProbeA({ served, locateConfig, retained, priorConfigSha256 = null }) {
  const bytes = Buffer.from(served);
  const region = locateConfig(bytes);
  const valid = region && Number.isInteger(region.start) && Number.isInteger(region.end)
    && region.start >= 0 && region.start <= region.end && region.end <= bytes.length;
  const library = valid ? cut(bytes, region) : bytes;
  const config = valid ? bytes.subarray(region.start, region.end) : null;
  const record = {
    served: { length: bytes.length, sha256: sha256(bytes),
      library: { length: library.length, sha256: sha256(library) },
      config: config && { length: config.length, sha256: sha256(config) } },
    config_region: valid ? "located" : "unlocated",
  };
  const lengthMatch = retained ? library.length === retained.library_length : null;
  const digestMatch = retained ? record.served.library.sha256 === retained.library_sha256 : null;
  record.library = { length_matches: lengthMatch, sha256_matches: digestMatch, diff: null };
  if (retained?.bytes && digestMatch === false) {
    const old = Buffer.from(retained.bytes);
    const oldRegion = locateConfig(old);
    record.library.diff = moved(oldRegion ? cut(old, oldRegion) : old, library);
  }
  // No same-id baseline on day 1: the config region is recorded, then checked later.
  record.config = !config ? "unlocated" : priorConfigSha256 === null ? "baseline_recorded"
    : priorConfigSha256 === record.served.config.sha256 ? "unchanged" : "changed";
  // A moved library region means the retained bytes can no longer derive rules (ADR-0040 item 1).
  record.status = !valid ? "unresolved" : retained === undefined || retained === null ? "recorded"
    : lengthMatch && digestMatch ? "match" : "library_changed";
  record.retained_bytes_usable = record.status === "match" ? true : record.status === "library_changed" ? false : null;
  return record;
}

// ---- Request parsing shared by part B and the classifier ----

export function queryPairs(url) {
  const out = [];
  for (const [name, value] of new URL(url).searchParams) out.push([name, value]);
  return out;
}
const slotKey = r => { const u = new URL(r.url); return `${r.method ?? "GET"} ${u.host}${u.pathname}`; };

// ---- Drift probe part B: field noise floor (4.1 step 3) ----

// `loads` is [{ region, requests: [{ method, url, body? }] }], same state loaded repeatedly.
// Per region and per request slot (method, host, path, occurrence) records which query
// fields differ across loads. Also reports fields that are stable inside each region
// but differ between regions.
export function recordFieldNoise({ loads }) {
  const byRegion = new Map();
  for (const load of loads) {
    if (!byRegion.has(load.region)) byRegion.set(load.region, []);
    byRegion.get(load.region).push(load);
  }
  const regions = {};
  for (const [region, group] of byRegion) {
    const slots = new Map();
    for (const load of group) {
      const seen = new Map();
      for (const request of load.requests) {
        const base = slotKey(request);
        const n = seen.get(base) ?? 0;
        seen.set(base, n + 1);
        const slot = `${base}#${n}`;
        const entry = slots.get(slot) ?? { fields: new Map(), bodies: [], loads: 0 };
        slots.set(slot, entry);
        entry.loads++;
        const counts = new Map();
        for (const [name, value] of queryPairs(request.url)) {
          const i = counts.get(name) ?? 0;
          counts.set(name, i + 1);
          const key = i === 0 ? name : `${name}#${i}`;
          const f = entry.fields.get(key) ?? { values: new Set(), present: 0, first: value };
          f.values.add(value);
          f.present++;
          entry.fields.set(key, f);
        }
        entry.bodies.push(request.body ?? "");
      }
    }
    regions[region] = { loads: group.length, slots: Object.fromEntries([...slots].map(([slot, e]) => [slot, {
      loads: e.loads,
      fields: Object.fromEntries([...e.fields].sort(([a], [b]) => a.localeCompare(b)).map(([name, f]) => [name, {
        present_in: f.present, distinct_values: f.values.size, varies: f.values.size > 1 || f.present < e.loads,
          first: f.first }])),
      body_varies: new Set(e.bodies).size > 1,
    }])) };
  }
  const names = Object.keys(regions);
  const cross = new Set();
  for (const slot of new Set(names.flatMap(r => Object.keys(regions[r].slots))))
    for (const name of new Set(names.flatMap(r => Object.keys(regions[r].slots[slot]?.fields ?? {})))) {
      const per = names.map(r => regions[r].slots[slot]?.fields[name]);
      if (per.some(f => !f || f.varies)) continue;
      if (new Set(per.map(f => f.first)).size > 1) cross.add(`${slot} ${name}`);
    }
  for (const region of names) for (const slot of Object.values(regions[region].slots))
    for (const f of Object.values(slot.fields)) delete f.first;
  return { regions, region_dependent: [...cross].sort() };
}

// ---- Request and field classifier (3.1, output shaped for the shared comparator) ----

const selectorShape = s => {
  if (!plain(s) || s.field !== "query" || !Number.isInteger(s.request) || !Number.isInteger(s.index))
    throw new Error("invalid_rule_selector");
};

function inferFormat(values) {
  for (const kind of ["uuid", "epoch_ms", "epoch_s", "decimal", "hex", "base64url", "token"]) {
    if (!FORMAT_KINDS.includes(kind)) continue;
    const format = { kind };
    if (!["uuid", "epoch_ms", "epoch_s"].includes(kind)) {
      const lengths = values.map(v => v.length);
      format.min = Math.max(1, Math.min(...lengths));
      format.max = Math.max(...lengths);
    }
    if (values.every(v => matchesFormat(v, format))) return format;
  }
  return null;
}

// `recordings` is [{ sha256, region, requests: [{ method, url, body? }] }]: file-byte
// digests of the frozen recordings plus the same request sequence in each.
// `requestClasses` is [{ name, host?, pathPrefix?, method? }] (first match wins).
// `seeds` maps a query name to a seed `{ class, ... }` (default: GOOGLE_SEED_CLASSES).
// Returns the shared comparator's `rules.fields` array plus what stays fixed, what is
// unstable (goes to the owner, 3.1) and request classes, or `{ ok:false, issues }`.
export function classifyRecordings({ recordings, requestClasses = [], seeds = GOOGLE_SEED_CLASSES }) {
  const issues = new Set();
  if (!Array.isArray(recordings) || recordings.length < 2 || !recordings.every(r => /^[a-f0-9]{64}$/.test(r?.sha256)))
    return { ok: false, issues: ["recordings_invalid"] };
  const ref = recordings[0].requests;
  const sequence = r => r.requests.map(slotKey).join("|");
  if (!recordings.every(r => sequence(r) === sequence(recordings[0])))
    return { ok: false, issues: ["sequence_mismatch"] };
  const pairs = recordings.map(r => r.requests.map(q => queryPairs(q.url)));
  const requests = ref.map((q, request) => {
    const u = new URL(q.url);
    const match = requestClasses.find(c => (!c.method || c.method === (q.method ?? "GET"))
      && (!c.host || c.host === u.host) && (!c.pathPrefix || u.pathname.startsWith(c.pathPrefix)));
    return { request, method: q.method ?? "GET", host: u.host, path: u.pathname, class: match?.name ?? null };
  });
  const rules = [], fixed = [], unstable = [];
  ref.forEach((_, request) => {
    const layout = pairs[0][request];
    if (!pairs.every(p => p[request].length === layout.length && p[request].every(([n], i) => n === layout[i][0]))) {
      unstable.push({ request, field: "query", reason: "layout_differs" });
      return;
    }
    if (new Set(recordings.map(r => r.requests[request].body ?? "")).size > 1)
      unstable.push({ request, field: "body_utf8", reason: "body_differs" });
    const varying = new Map();
    layout.forEach(([name], index) => {
      const values = pairs.map(p => p[request][index][1]);
      if (new Set(values).size === 1) { fixed.push({ request, name, index }); return; }
      if (!varying.has(name)) varying.set(name, []);
      varying.get(name).push({ index, values });
    });
    for (const [name, group] of varying) {
      const seed = Object.hasOwn(seeds, name) ? seeds[name] : null;
      const unstableField = reason => group.forEach(g => unstable.push({ request, field: "query", name, index: g.index, reason }));
      if (!seed || seed.class === "fixed") { unstableField(seed ? "fixed_varies" : "no_class"); continue; }
      const all = group.flatMap(g => g.values);
      const rule = { class: seed.class, selectors: group.map(g => ({ request, field: "query", index: g.index })),
        derived_from: recordings.map(r => r.sha256) };
      if (seed.class === "generated" || seed.class === "volatile") {
        rule.format = seed.format ?? inferFormat(all);
        if (!rule.format) { unstableField("no_format"); continue; }
        if (seed.class === "generated") rule.relation = seed.relation ?? "none";
      } else if (seed.class === "server_context") {
        rule.context = seed.context;
        rule.allowed = [...new Set(all)].sort();
      } else if (seed.class === "input_derived") {
        const at = seed.source?.request ?? request;
        const index = pairs[0][at]?.findIndex(([n]) => n === seed.source?.name) ?? -1;
        if (index < 0) { unstableField("source_pending"); continue; }
        rule.source = { request: at, field: "query", index };
        rule.transform = seed.transform;
      } else { unstableField("unknown_class"); continue; }
      try { fieldRuleShape(rule, selectorShape); } catch (e) { unstableField(e.message); continue; }
      if (protectedTarget(rule, name)) { unstableField("protected_field"); continue; }
      const holds = recordings.every((_, r) => evaluateFieldRule(rule, 0, group.map(g => g.values[r]),
        rule.class === "input_derived" ? pairs[r][rule.source.request][rule.source.index][1] : undefined).valid);
      if (!holds) { unstableField("rule_does_not_hold"); continue; }
      rules.push(rule);
    }
  });
  const sources = rules.filter(r => r.class === "input_derived").map(r => r.source);
  const key = s => `${s.request}:${s.index}`;
  const targeted = new Set(rules.flatMap(r => r.selectors.map(key)));
  if (sources.some(s => targeted.has(key(s)))) issues.add("overlapping_rules");
  if (rules.length > 32) issues.add("rule_limit");
  for (const u of unstable) issues.add(`unstable:${u.reason}`);
  return { ok: unstable.length === 0 && !issues.has("overlapping_rules") && !issues.has("rule_limit"), issues: [...issues].sort(), requests, rules: { fields: rules }, fixed, unstable };
}

// ---- Cookie-name allow-list (spec 3.4). A name check; it does not decide whether a value is safe ----

// Options name the configured prefix (the manifest schema has no field for it, so the
// session passes it), whether GA4 is page input and whether the state sets a first-party
// endpoint base. Login/session names are denied by the shared check.
export function cookieAllowed(name, { prefix = "_gcl", ga4 = false, firstPartyMode = false, vendorDomain = false } = {}) {
  if (typeof name !== "string") return false;
  if (name === "_gcl_au" || name.startsWith("_gac_")) return true;
  if (name.startsWith(`${prefix}_`)) return true;
  if (ga4 && (name === "_ga" || name.startsWith("_ga_"))) return true;
  if (firstPartyMode && (name === "FPAU" || name === "FPGCLAW")) return true;
  return vendorDomain && name === "test_cookie";
}

export function unlistedCookies(storage, options) {
  return (storage?.cookies ?? []).filter(c => !cookieAllowed(c.name, { ...options,
    vendorDomain: Boolean(c.domain && /(^|\.)doubleclick\.net$/.test(c.domain)) })).map(c => c.name);
}

// ---- Capture driver ----

export function recordingDir(state, kind, variant = "default") {
  const seg = /^[A-Za-z0-9][A-Za-z0-9-]{0,63}$/;
  if (![state, kind, variant].every(s => seg.test(s))) throw new Error("bad_path_segment");
  return `${GOOGLE_CAPTURE_ROOT}/${state}/${variant}/${kind}`;
}

const b64 = bytes => Buffer.from(bytes).toString("base64");
const utf8 = bytes => { try { return new TextDecoder("utf-8", { fatal: true }).decode(bytes); } catch { return null; } };

// Records requests and responses from page events only. It never installs a route handler
// and never aborts, fulfils or continues a request, so native traffic is untouched.
// Bodies past the 059-16 response cap are recorded as a length, not stored.
export function createNativeRecorder(page, { now = () => new Date().toISOString() } = {}) {
  const byRequest = new Map(), entries = [], pending = new Set();
  const onRequest = request => {
    const post = request.postDataBuffer?.() ?? null;
    const entry = { index: entries.length, url: request.url(), method: request.method(),
      request_headers: request.headers(), post_data_base64: post ? b64(post) : null,
      post_data_text: post ? utf8(post) : null, started_at: now(), response: null, failure: null };
    byRequest.set(request, entry); entries.push(entry);
  };
  const onResponse = response => {
    const request = response.request(), entry = byRequest.get(request);
    if (!entry) return;
    entry.response = { status: response.status(), headers: response.headers(), body_base64: null,
      body_text: null, body_length: null, body_error: null };
    const job = Promise.resolve().then(() => response.body()).then(body => {
      entry.response.body_length = body.length;
      if (body.length <= CAPS.response_bytes) { entry.response.body_base64 = b64(body); entry.response.body_text = utf8(body); }
    }, error => { entry.response.body_error = String(error?.message ?? error).slice(0, 200); })
      .finally(() => pending.delete(job));
    pending.add(job);
  };
  const onFailed = request => {
    const entry = byRequest.get(request);
    if (entry) entry.failure = request.failure?.()?.errorText ?? "failed";
  };
  page.on("request", onRequest); page.on("response", onResponse); page.on("requestfailed", onFailed);
  return {
    async settled() { while (pending.size) await Promise.all([...pending]); },
    entries: () => structuredClone(entries),
    detach() { page.off("request", onRequest); page.off("response", onResponse); page.off("requestfailed", onFailed); },
  };
}

export function buildGoogleManifest({ capturedAt, inputState, settingsState }) {
  const manifest = { schema_version: 1, vendor: GOOGLE_VENDOR, captured_at: capturedAt, input_state: inputState };
  if (settingsState) manifest.settings_state = settingsState;
  const verdict = checkFixtureManifest(manifest);
  if (!verdict.ok) throw new Error(`manifest_invalid:${verdict.errors.join(",")}`);
  return manifest;
}

// Runs the 4.1 probes in order through injected functions (no browser or network here):
// part A over `fetchServed()`, then `loadState(region)` for each region and repeat.
export async function runDriftProbes({ fetchServed, locateConfig, retained, priorConfigSha256, loadState, regions, repeats = 3 }) {
  const part_a = recordDriftProbeA({ served: await fetchServed(), locateConfig, retained, priorConfigSha256 });
  const loads = [];
  for (const region of regions) for (let i = 0; i < repeats; i++) loads.push({ region, requests: await loadState(region, i) });
  return { part_a, part_b: recordFieldNoise({ loads }) };
}

// Gates a recording through the shared checks, then writes it to a new private directory:
// manifest schema, cookie allow-list, then the credential scan over every stored byte.
export async function storeRecording({ outputDir, manifest, entries, cookieOptions }) {
  const verdict = checkFixtureManifest(manifest);
  if (!verdict.ok) throw new Error(`manifest_invalid:${verdict.errors.join(",")}`);
  const unlisted = [...unlistedCookies(manifest.input_state.storage_before, cookieOptions),
    ...unlistedCookies(manifest.input_state.storage_after, cookieOptions)];
  if (unlisted.length) throw new Error(`cookie_not_allow_listed:${[...new Set(unlisted)].join(",")}`);
  const files = { "manifest.json": JSON.stringify(manifest, null, 2), "requests.json": JSON.stringify(entries, null, 2) };
  for (const [file, text] of Object.entries(files)) {
    const found = scanFixtureText(text, file);
    if (found.length) throw new Error(`credential_found:${found.map(f => f.rule).join(",")}`);
  }
  createPrivateOutput(outputDir);
  const digests = {};
  for (const [file, text] of Object.entries(files)) {
    await writeFile(join(outputDir, file), text, { flag: "wx", mode: 0o600 });
    digests[file] = sha256(Buffer.from(text));
  }
  return digests;
}
