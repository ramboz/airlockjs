import { scanFixtureText } from "./fixture-credentials.mjs";

// Fixture manifest schema and stored-input-state check (ADR-0061 point 1).
// Shared by Adobe, Google and Meta: a recorded fixture must carry the full
// input state so offline replay can feed exactly those inputs to the chamber.
// Offline and pure: no browser, SDK or network API.

export const VENDORS = Object.freeze(["adobe", "google-ads", "meta-pixel"]);
const REGIONS = ["eea", "non-eea"];
const MODES = ["headed", "headless"];
const PROFILES = ["fresh", "returning"];
const TOP = ["schema_version", "vendor", "captured_at", "input_state"];
const TOP_OPTIONAL = ["settings_state"];
const STATE = ["url", "referrer", "viewport", "locale", "timezone", "egress", "browser", "mode",
  "profile_kind", "loaded_digests", "storage_before", "storage_after"];
const STORAGE = ["cookies", "local_storage", "session_storage"];

const plain = v => v !== null && typeof v === "object" && !Array.isArray(v)
  && Object.getPrototypeOf(v) === Object.prototype;
const text = v => typeof v === "string" && v.length > 0 && v.length <= 4096;
const digest = v => typeof v === "string" && /^[a-f0-9]{64}$/.test(v);
const exact = (v, keys, optional = []) => plain(v) && keys.every(k => Object.hasOwn(v, k))
  && Object.keys(v).every(k => keys.includes(k) || optional.includes(k));
const absoluteUrl = v => { try { return ["http:", "https:"].includes(new URL(v).protocol); } catch { return false; } };
const stringMap = v => plain(v) && Object.values(v).every(x => typeof x === "string");

function storageErrors(s, name, errors) {
  if (!exact(s, STORAGE)) { errors.add(`${name}_shape`); return; }
  if (!Array.isArray(s.cookies) || !s.cookies.every(c => exact(c, ["name", "value"], ["domain", "path"])
    && typeof c.name === "string" && c.name.length > 0 && typeof c.value === "string"))
    errors.add(`${name}_cookies`);
  if (!stringMap(s.local_storage)) errors.add(`${name}_local_storage`);
  if (!stringMap(s.session_storage)) errors.add(`${name}_session_storage`);
}

// Returns { ok, errors } with stable error codes. Never throws on bad input.
export function checkFixtureManifest(manifest) {
  const errors = new Set();
  if (!plain(manifest)) return { ok: false, errors: ["manifest_shape"] };
  for (const k of TOP) if (!Object.hasOwn(manifest, k)) errors.add(k === "input_state" ? "input_state_missing" : `missing_${k}`);
  for (const k of Object.keys(manifest)) if (![...TOP, ...TOP_OPTIONAL].includes(k)) errors.add("unknown_field");
  if (manifest.schema_version !== 1) errors.add("schema_version");
  if (Object.hasOwn(manifest, "vendor") && !VENDORS.includes(manifest.vendor)) errors.add("vendor");
  if (Object.hasOwn(manifest, "captured_at")
    && (!text(manifest.captured_at) || Number.isNaN(Date.parse(manifest.captured_at)))) errors.add("captured_at");
  if (Object.hasOwn(manifest, "settings_state")) {
    const s = manifest.settings_state;
    if (!exact(s, ["label", "set_at", "wait_seconds"]) || !text(s.label) || Number.isNaN(Date.parse(s.set_at))
      || !Number.isInteger(s.wait_seconds) || s.wait_seconds < 0) errors.add("settings_state");
  }
  const st = manifest.input_state;
  if (Object.hasOwn(manifest, "input_state")) {
    if (!plain(st)) errors.add("input_state_shape");
    else {
      for (const k of STATE) if (!Object.hasOwn(st, k)) errors.add(`input_state_missing_${k}`);
      for (const k of Object.keys(st)) if (!STATE.includes(k)) errors.add("unknown_field");
      if (Object.hasOwn(st, "url") && !absoluteUrl(st.url)) errors.add("url");
      if (Object.hasOwn(st, "referrer") && st.referrer !== null && !absoluteUrl(st.referrer)) errors.add("referrer");
      if (Object.hasOwn(st, "viewport") && (!exact(st.viewport, ["width", "height"])
        || ![st.viewport.width, st.viewport.height].every(n => Number.isInteger(n) && n > 0 && n <= 16384)))
        errors.add("viewport");
      if (Object.hasOwn(st, "locale") && !(text(st.locale) && /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(st.locale)))
        errors.add("locale");
      if (Object.hasOwn(st, "timezone") && !(text(st.timezone) && /^[A-Za-z_]+(\/[A-Za-z0-9_+-]+)*$/.test(st.timezone)))
        errors.add("timezone");
      // Region label plus an opaque exit ID only: no hostnames, ports or credentials.
      if (Object.hasOwn(st, "egress") && (!exact(st.egress, ["region", "exit_id"])
        || !REGIONS.includes(st.egress.region) || !/^[A-Za-z0-9_-]{1,64}$/.test(st.egress.exit_id ?? "")))
        errors.add("egress");
      if (Object.hasOwn(st, "browser") && (!exact(st.browser, ["name", "version"])
        || !text(st.browser.name) || !/^[0-9][0-9A-Za-z.+-]*$/.test(st.browser.version ?? ""))) errors.add("browser");
      if (Object.hasOwn(st, "mode") && !MODES.includes(st.mode)) errors.add("mode");
      if (Object.hasOwn(st, "profile_kind") && !PROFILES.includes(st.profile_kind)) errors.add("profile_kind");
      if (Object.hasOwn(st, "loaded_digests") && (!exact(st.loaded_digests, ["script_sha256"], ["config_sha256"])
        || !digest(st.loaded_digests.script_sha256)
        || (Object.hasOwn(st.loaded_digests, "config_sha256")
          && st.loaded_digests.config_sha256 !== null && !digest(st.loaded_digests.config_sha256))))
        errors.add("loaded_digests");
      for (const k of ["storage_before", "storage_after"]) if (Object.hasOwn(st, k)) storageErrors(st[k], k, errors);
    }
  }
  // A manifest is committed unredacted, so it must also pass the credential check.
  for (const f of scanFixtureText(JSON.stringify(manifest), "manifest")) errors.add(`credential_${f.rule}`);
  return { ok: errors.size === 0, errors: [...errors] };
}
