import { checkFixtureManifest } from "./fixture-manifest.mjs";

// Meta-specific capture tooling (spec 066 slice 03, MT0). Offline and pure: no
// browser launch, no network. The manifest schema, stored-input check, credential
// check and native-side field rules are the shared modules on main
// (fixture-manifest.mjs, fixture-credentials.mjs, field-rules.mjs); this file only
// adds the Meta corpus layout, the launch/egress configuration and a no-abort
// native recorder to be attached to a page by the capture session (066-04).

export const META_VENDOR = "meta-pixel";
// Committed recordings live under a root the shared credential check already scans.
export const META_CAPTURE_ROOT = "rig/captures/meta-pixel";
export const RECORDING_KINDS = Object.freeze(["base", "repeat", "eea"]);

// Corpus S0 to S18 (spec 066 section 5). Recordings are base, repeat and EEA unless
// the row lists its own kinds (the one-off owner and restore states).
const row = (id, name, kinds = RECORDING_KINDS) => Object.freeze({ id, name, kinds: Object.freeze([...kinds]) });
export const META_CORPUS = Object.freeze([
  row("S0", "positive-control", ["base"]),
  row("S1", "pageview-fresh"),
  row("S2", "pageview-returning"),
  row("S3", "click-id"),
  row("S4", "standard-events"),
  row("S5", "data-vocabulary"),
  row("S6", "custom-single-two-pixels"),
  row("S7", "consent"),
  row("S8", "manual-identity"),
  row("S9", "automatic-matching"),
  row("S10", "automatic-events"),
  row("S11", "lifecycle"),
  row("S12", "errors"),
  row("S13", "event-id"),
  row("S14", "settings-candidates"),
  row("S15", "second-day-drift", ["base", "eea"]),
  row("S16", "normal-browser-reference", ["base"]),
  row("S17", "restore-confirmation", ["base"]),
  row("S18", "held-out"),
]);

const SEGMENT = /^[a-z0-9][a-z0-9-]{0,63}$/;

export function corpusState(id) {
  const state = META_CORPUS.find(s => s.id === id);
  if (!state) throw new Error(`unknown_state:${id}`);
  return state;
}

// Layout: <root>/<state id>-<name>/<variant>/<kind>/{manifest.json,requests.json}.
// `variant` names the sub-case inside a state (an event, a viewport, a SET label).
export function recordingDir(stateId, kind, variant = "default") {
  const state = corpusState(stateId);
  if (!state.kinds.includes(kind)) throw new Error(`unknown_kind:${stateId}:${kind}`);
  if (!SEGMENT.test(variant)) throw new Error(`bad_variant:${variant}`);
  return `${META_CAPTURE_ROOT}/${state.id}-${state.name}/${variant}/${kind}`;
}

// Egress is recorded as a region label plus an opaque exit ID, never a host or credential.
export function egressLabel(region, exitId) {
  return { region, exit_id: exitId };
}

// Headed and headless are both supported; the ladder (4.2) runs headless first, then headed.
export function launchOptions(mode) {
  if (mode !== "headless" && mode !== "headed") throw new Error(`bad_mode:${mode}`);
  return { headless: mode === "headless" };
}

export function buildMetaManifest({ capturedAt, inputState, settingsState }) {
  const manifest = { schema_version: 1, vendor: META_VENDOR, captured_at: capturedAt, input_state: inputState };
  if (settingsState) manifest.settings_state = settingsState;
  const verdict = checkFixtureManifest(manifest);
  if (!verdict.ok) throw new Error(`manifest_invalid:${verdict.errors.join(",")}`);
  return manifest;
}

const b64 = bytes => Buffer.from(bytes).toString("base64");
// A UTF-8 copy next to the base64 one, so the shared text-based credential scan can see bodies.
const utf8 = bytes => { try { return new TextDecoder("utf-8", { fatal: true }).decode(bytes); } catch { return null; } };
// allHeaders() includes Cookie and Set-Cookie, which headers() hides in Playwright.
const fullHeaders = async o => (o.allHeaders ? o.allHeaders() : o.headers());

// Records every request and its full response fan-out (redirect chain, status line,
// headers, body, zero-length body as such). It subscribes to page events only: it
// never installs a route handler and never aborts, fulfils or continues a request,
// so native traffic is untouched (spec 066 section 4.2).
export function createNativeRecorder(page, { now = () => new Date().toISOString() } = {}) {
  const byRequest = new Map();
  const entries = [];
  const pending = new Set();

  const onRequest = request => {
    const redirected = request.redirectedFrom?.();
    const post = request.postDataBuffer?.() ?? null;
    const entry = {
      index: entries.length,
      url: request.url(),
      method: request.method(),
      resource_type: request.resourceType?.() ?? null,
      request_headers: request.headers(),
      post_data_base64: post ? b64(post) : null,
      post_data_text: post ? utf8(post) : null,
      redirected_from: redirected && byRequest.has(redirected) ? byRequest.get(redirected).index : null,
      started_at: now(),
      response: null,
      failure: null,
    };
    byRequest.set(request, entry);
    entries.push(entry);
  };
  const onResponse = response => {
    const request = response.request();
    const entry = byRequest.get(request);
    if (!entry) return;
    entry.response = {
      status: response.status(),
      status_text: response.statusText?.() ?? "",
      headers: response.headers(),
      body_base64: null,
      body_text: null,
      body_length: null,
      body_error: null,
    };
    const job = Promise.resolve().then(async () => {
      entry.request_headers = await fullHeaders(request);
      entry.response.headers = await fullHeaders(response);
      return response.body();
    }).then(
      body => { entry.response.body_base64 = b64(body); entry.response.body_text = utf8(body); entry.response.body_length = body.length; },
      error => { entry.response.body_error = String(error?.message ?? error).slice(0, 200); },
    ).finally(() => pending.delete(job));
    pending.add(job);
  };
  const onFailed = request => {
    const entry = byRequest.get(request);
    if (entry) entry.failure = request.failure?.()?.errorText ?? "failed";
  };

  page.on("request", onRequest);
  page.on("response", onResponse);
  page.on("requestfailed", onFailed);

  return {
    async settled() { while (pending.size) await Promise.all([...pending]); },
    entries() { return structuredClone(entries); },
    detach() {
      page.off("request", onRequest);
      page.off("response", onResponse);
      page.off("requestfailed", onFailed);
    },
  };
}
