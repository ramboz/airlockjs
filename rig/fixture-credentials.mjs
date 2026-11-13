import { readFile, readdir, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// Pre-commit credential check for recorded vendor fixtures (ADR-0061 point 5).
// Vendor-neutral: Adobe, Google and Meta login/session cookies and tokens, plus
// VPN or proxy credentials. Findings carry a rule id and a location, never the
// secret value, so a failing report cannot leak what it found.

const COOKIE_RULES = [
  { id: "google_session_cookie", test: n => /^(SID|HSID|SSID|APISID|SAPISID|LSID|OSID|SIDCC)$/i.test(n)
    || /^__Secure-(1|3)?P?(API)?SID(CC)?$/i.test(n) || /^__Secure-.*PSID/i.test(n) },
  { id: "meta_session_cookie", test: n => /^(c_user|xs|datr|sb)$/.test(n) },
  { id: "adobe_session_cookie", test: n => /^(adobeid_ims_|ims_|AdobeID$|aemauth|login-token$)/i.test(n)
    || /^(ims_sid|relay)$/i.test(n) },
  { id: "generic_session_cookie", test: n => /^(PHPSESSID|JSESSIONID|ASP\.NET_SessionId|connect\.sid|sessionid|session_id|auth_token)$/i.test(n) },
];
const TOKEN_KEYS = /^(authorization|proxy-authorization|x-api-key|x-auth-token|access_token|refresh_token|id_token|client_secret|api_key|apikey|bearer|oauth_token|token)$/i;
const PROXY_KEYS = /^(proxy[-_]?(user(name)?|pass(word)?|auth(orization)?|credentials?)|vpn[-_]?(user(name)?|pass(word)?|secret|key|credentials?)|wg[-_]?private[-_]?key|private[-_]?key|preshared[-_]?key)$/i;
const TEXT_PATTERNS = [
  { id: "bearer_token", re: /\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/ },
  { id: "basic_credentials", re: /\bBasic\s+[A-Za-z0-9+/]{8,}={0,2}(?![A-Za-z0-9+/=])/ },
  { id: "google_oauth_token", re: /\bya29\.[A-Za-z0-9._-]{20,}/ },
  { id: "meta_access_token", re: /\bEAA[A-Za-z0-9]{20,}/ },
  { id: "jwt", re: /\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/ },
  { id: "token_parameter", re: /[?&;"'\s](access_token|refresh_token|id_token|client_secret|api_key)=[^&\s"';]{6,}/i },
  { id: "url_credentials", re: /\b(?:https?|socks[45]h?|ss|ssh|vpn):\/\/[^/\s:@"']+:[^/\s@"']+@[^/\s"']+/i },
  { id: "private_key", re: /-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----/ },
  { id: "vpn_config_secret", re: /^\s*(auth-user-pass|PrivateKey|PresharedKey)\b\s*[=\s]\s*\S+/im },
];

function cookieFinding(name, where) {
  const rule = COOKIE_RULES.find(r => r.test(name));
  return rule ? [{ rule: rule.id, where }] : [];
}
function cookieHeader(value, where, setCookie) {
  const found = [];
  const parts = setCookie ? [value.split(";")[0]] : value.split(";");
  for (const part of parts) {
    const eq = part.indexOf("=");
    if (eq > 0) found.push(...cookieFinding(part.slice(0, eq).trim(), where));
  }
  return found;
}
const filled = v => typeof v === "string" ? v.length > 0 : v !== null && v !== undefined && v !== "";

function walk(value, where, ctx, found) {
  if (Array.isArray(value)) {
    // [name, value] header pairs and cookie pairs.
    if (value.length === 2 && typeof value[0] === "string" && typeof value[1] === "string") {
      const [k, v] = value;
      if (/^cookie$/i.test(k)) found.push(...cookieHeader(v, where, false));
      else if (/^set-cookie$/i.test(k)) found.push(...cookieHeader(v, where, true));
      else if (ctx.cookies) found.push(...cookieFinding(k, where));
      if (TOKEN_KEYS.test(k) && filled(v)) found.push({ rule: "token_field", where });
      if (PROXY_KEYS.test(k) && filled(v)) found.push({ rule: "proxy_or_vpn_credential", where });
    }
    value.forEach((v, i) => walk(v, `${where}[${i}]`, ctx, found));
    return;
  }
  if (value && typeof value === "object") {
    if (typeof value.name === "string" && ctx.cookies) found.push(...cookieFinding(value.name, where));
    for (const [k, v] of Object.entries(value)) {
      const here = `${where}.${k}`;
      if (typeof v === "string") {
        if (/^cookie$/i.test(k)) found.push(...cookieHeader(v, here, false));
        else if (/^set-cookie$/i.test(k)) found.push(...cookieHeader(v, here, true));
      }
      if (TOKEN_KEYS.test(k) && filled(v) && typeof v !== "object") found.push({ rule: "token_field", where: here });
      if (PROXY_KEYS.test(k) && filled(v) && typeof v !== "object")
        found.push({ rule: "proxy_or_vpn_credential", where: here });
      const cookieScope = ctx.cookies || /cookie|storage/i.test(k);
      if (cookieScope && v && typeof v === "object" && !Array.isArray(v) && !("name" in v))
        for (const name of Object.keys(v)) found.push(...cookieFinding(name, `${here}.${name}`));
      walk(v, here, { cookies: cookieScope }, found);
    }
    return;
  }
  if (typeof value === "string") scanText(value, where, found);
}
function scanText(text, where, found) {
  for (const { id, re } of TEXT_PATTERNS) if (re.test(text)) found.push({ rule: id, where });
  // Raw Cookie / Set-Cookie / Authorization lines (non-JSON fixtures, bodies, dumps).
  for (const line of text.split(/\r?\n/)) {
    const m = /^\s*(cookie|set-cookie|authorization|proxy-authorization)\s*:\s*(.+)$/i.exec(line);
    if (!m) continue;
    const name = m[1].toLowerCase();
    if (name === "cookie" || name === "set-cookie") found.push(...cookieHeader(m[2], where, name === "set-cookie"));
    else found.push({ rule: "token_field", where });
  }
}

export function scanFixtureText(text, path = "<text>") {
  const found = [];
  let parsed;
  try { parsed = JSON.parse(text); } catch { parsed = undefined; }
  if (parsed !== undefined) walk(parsed, path, { cookies: false }, found);
  else scanText(text, path, found);
  const seen = new Set();
  return found.filter(f => { const k = `${f.rule}@${f.where}`; return seen.has(k) ? false : (seen.add(k), true); });
}

const SKIP = new Set(["node_modules", ".git"]);
export async function listFiles(root) {
  const out = [];
  async function visit(dir) {
    let entries;
    try { entries = await readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (SKIP.has(e.name)) continue;
      const full = join(dir, e.name);
      if (e.isDirectory()) await visit(full);
      else if (e.isFile()) out.push(full);
    }
  }
  const s = await stat(root).catch(() => null);
  if (s?.isFile()) return [root];
  if (s) await visit(root);
  return out;
}

export async function scanFixtureFiles(paths, base = process.cwd()) {
  const results = [];
  for (const root of paths) {
    for (const file of await listFiles(root)) {
      const body = await readFile(file, "utf8").catch(() => null);
      if (body === null) continue;
      for (const f of scanFixtureText(body, relative(base, file))) results.push({ file: relative(base, file), ...f });
    }
  }
  return results;
}

// Directories where recorded vendor fixtures and capture manifests are committed.
export const FIXTURE_ROOTS = Object.freeze(["test/fixtures", "rig/fixtures", "test/captures", "rig/captures"]);

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  // Usage: node rig/fixture-credentials.mjs <file-or-dir>... (pre-commit hook helper)
  const base = fileURLToPath(new URL("..", import.meta.url));
  const targets = process.argv.length > 2 ? process.argv.slice(2) : FIXTURE_ROOTS.map(p => join(base, p));
  const findings = await scanFixtureFiles(targets, process.cwd());
  for (const f of findings) console.error(`${f.file}: ${f.rule} at ${f.where}`);
  process.exitCode = findings.length ? 1 : 0;
}
