import { Buffer } from "node:buffer";
import { closeSync, constants, fsyncSync, fstatSync, lstatSync, mkdirSync,
  openSync, writeSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { performance } from "node:perf_hooks";

const CASES = Object.freeze(["google-stock", "google-chamber", "meta-stock", "meta-chamber"]);
const LIMITS = Object.freeze({
  observed_requests: 64, google_dispatches: 20, meta_dispatches: 8,
  url_bytes: 2048, request_bytes: 65536, response_bytes: 2097152,
  retained_bytes: 8388608, duration_ms: 60000,
});
const own = (object, key) => Object.hasOwn(object, key);
const record = value => value !== null && typeof value === "object"
  && [Object.prototype, null].includes(Object.getPrototypeOf(value));
function keys(value, required, optional = []) {
  return record(value) && Reflect.ownKeys(value).every(key => required.includes(key) || optional.includes(key))
    && required.every(key => own(value, key));
}
const text = (value, maximum = 128) => typeof value === "string" && value.length > 0
  && value.isWellFormed() && Buffer.byteLength(value) <= maximum;
const digest = value => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const revision = value => typeof value === "string" && /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(value);
const id = value => typeof value === "string" && /^[a-z][a-z0-9-]{0,63}$/.test(value);
const finite = value => typeof value === "number" && Number.isFinite(value) && value >= 0;
const byteLength = Object.getOwnPropertyDescriptor(
  Object.getPrototypeOf(Uint8Array.prototype), "byteLength").get;
const bufferBytes = value => byteLength.call(value);

function validUrl(value, layer) {
  if (!text(value, LIMITS.url_bytes) || /[\s\\]/.test(value) || value.includes("#")) return false;
  let parsed;
  try {
    parsed = new URL(value); // Parsing only; never normalize the matched string.
  } catch (error) {
    if (error instanceof TypeError) return false;
    // eslint-disable-next-line preserve-caught-error -- A raw cause can contain private authority URLs.
    throw new Error("authority_invalid");
  }
  if (parsed.username || parsed.password || parsed.hash) return false;
  return layer === "local-control"
    ? /^http:\/\/127\.0\.0\.1(?::[0-9]+)?(?:\/|\?|$)/.test(value)
      && parsed.protocol === "http:" && parsed.hostname === "127.0.0.1"
    : value.startsWith("https://") && parsed.protocol === "https:";
}

// Validate primitives and construct a detached, frozen policy. Never retain an
// authority/case/scope/limits object supplied by the caller.
function policySnapshot(authority) {
  if (!keys(authority, ["schema_version", "status", "evidence_layer", "authority_id",
    "source_revision", "expires_at_ms", "journal_dir", "limits", "cases"])
    || authority.schema_version !== 1 || authority.status !== "approved"
    || !["local-control", "operator-attestation"].includes(authority.evidence_layer)
    || !text(authority.authority_id) || !revision(authority.source_revision)
    || !finite(authority.expires_at_ms) || !text(authority.journal_dir, 4096)
    || authority.journal_dir.includes("\0") || !isAbsolute(authority.journal_dir)
    || resolve(authority.journal_dir) !== authority.journal_dir
    || !keys(authority.limits, Object.keys(LIMITS))
    || !Object.entries(LIMITS).every(([key, value]) => authority.limits[key] === value)
    || !Array.isArray(authority.cases) || authority.cases.length < 1 || authority.cases.length > 4)
    return null;
  const cases = [];
  for (const item of authority.cases) {
    if (!keys(item, ["case_name", "input_digest", "ownership_marker", "scopes"])
      || !CASES.includes(item.case_name) || cases.some(c => c.case_name === item.case_name)
      || !digest(item.input_digest) || !text(item.ownership_marker)
      || !Array.isArray(item.scopes) || !item.scopes.length || item.scopes.length > 64) return null;
    const scopes = [];
    for (const scope of item.scopes) {
      if (!keys(scope, ["id", "url", "method", "transport", "resource", "mode",
        "parent_scope", "required_response"])
        || !id(scope.id) || !validUrl(scope.url, authority.evidence_layer)
        || !["GET", "POST", "HEAD", "OPTIONS", "PUT", "PATCH", "DELETE"].includes(scope.method)
        || !["fetch", "xhr", "beacon", "image", "script", "document"].includes(scope.transport)
        || !["Fetch", "XHR", "Ping", "Image", "Script", "Document"].includes(scope.resource)
        || !["dispatch", "local"].includes(scope.mode)
        || !(scope.parent_scope === null || id(scope.parent_scope))
        || typeof scope.required_response !== "boolean"
        || scopes.some(s => s.id === scope.id || (s.url === scope.url && s.method === scope.method
          && s.transport === scope.transport && s.resource === scope.resource))) return null;
      scopes.push(Object.freeze({
        id: scope.id, url: scope.url, method: scope.method, transport: scope.transport,
        resource: scope.resource, mode: scope.mode, parent_scope: scope.parent_scope,
        required_response: scope.required_response,
      }));
    }
    for (const scope of scopes) {
      const seen = new Set([scope.id]);
      let parent = scope.parent_scope;
      while (parent !== null) {
        const ancestor = scopes.find(s => s.id === parent);
        if (!ancestor || seen.has(parent)) return null;
        seen.add(parent);
        parent = ancestor.parent_scope;
      }
    }
    cases.push(Object.freeze({
      case_name: item.case_name, input_digest: item.input_digest,
      ownership_marker: item.ownership_marker, scopes: Object.freeze(scopes),
    }));
  }
  return Object.freeze({
    evidence_layer: authority.evidence_layer, source_revision: authority.source_revision,
    expires_at_ms: authority.expires_at_ms, journal_dir: authority.journal_dir,
    cases: Object.freeze(cases),
  });
}

function privateTarget(stat, mode, directory = false) {
  return (directory ? stat.isDirectory() : stat.isFile() && stat.nlink === 1)
    && (stat.mode & 0o7777) === mode
    && (typeof process.getuid !== "function" || stat.uid === process.getuid());
}
// Only filesystem exceptions cross this narrow boundary. Never expose their
// messages, paths, causes or stacks, and never recover them as success.
function filesystem(operation) {
  try {
    return operation();
  } catch (error) {
    if (error && typeof error.code === "string" && typeof error.syscall === "string")
      return { category: "journal_invalid" };
    // eslint-disable-next-line preserve-caught-error -- Never surface raw filesystem paths through a cause.
    throw new Error("journal_invalid");
  }
}
function withDescriptor(path, flags, operation) {
  const fd = openSync(path, flags, 0o600);
  try {
    return operation(fd);
  } finally {
    closeSync(fd);
  }
}
function writeAll(fd, value) {
  const bytes = Buffer.from(JSON.stringify(value) + "\n");
  let offset = 0;
  while (offset < bytes.length) {
    const written = writeSync(fd, bytes, offset, bytes.length - offset);
    if (written === 0) throw new Error("journal_invalid");
    offset += written;
  }
  fsyncSync(fd);
}
function reserveLedger(policy, name) {
  return filesystem(() => {
    let created = false;
    try {
      mkdirSync(policy.journal_dir, { mode: 0o700 });
      created = true;
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
    }
    if (!privateTarget(lstatSync(policy.journal_dir), 0o700, true)) return { category: "journal_invalid" };
    if (created) withDescriptor(dirname(policy.journal_dir),
      constants.O_RDONLY | constants.O_NOFOLLOW, fd => fsyncSync(fd));
    const path = join(policy.journal_dir, `${name}.reserved`);
    let reservation;
    try {
      reservation = withDescriptor(path,
        constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, fd => {
          const stat = fstatSync(fd);
          if (!privateTarget(stat, 0o600)) return { category: "journal_invalid" };
          writeAll(fd, { schema_version: 1, case_name: name, state: "spent" });
          return { path, dev: stat.dev, ino: stat.ino };
        });
    } catch (error) {
      if (!["EEXIST", "ELOOP"].includes(error.code)) throw error;
      return { category: privateTarget(lstatSync(path), 0o600) ? "slot_spent" : "journal_invalid" };
    }
    if (reservation.category) return reservation;
    // Both the spent file and its directory entry must be durable before any
    // dispatch permission. No ledger is ever removed/refunded by this module.
    withDescriptor(policy.journal_dir, constants.O_RDONLY | constants.O_NOFOLLOW, fd => fsyncSync(fd));
    return reservation;
  });
}
function closeLedger(policy, reservation) {
  return filesystem(() => {
    if (!privateTarget(lstatSync(policy.journal_dir), 0o700, true)
      || !privateTarget(lstatSync(reservation.path), 0o600)) return { category: "journal_invalid" };
    return withDescriptor(reservation.path, constants.O_WRONLY | constants.O_APPEND | constants.O_NOFOLLOW, fd => {
      const stat = fstatSync(fd);
      if (!privateTarget(stat, 0o600) || stat.dev !== reservation.dev || stat.ino !== reservation.ino)
        return { category: "journal_invalid" };
      // Deliberately not a success/eligibility certificate.
      writeAll(fd, { schema_version: 1, state: "closed" });
      return {};
    });
  });
}

/**
 * Synchronous reservation/admission utility, not a dispatcher or interceptor.
 * Input/response/cleanup observations are supplied by a cooperating executor.
 * See first-journey-admission.md for the closed schema and trust boundary.
 */
export function reserveCase(options) {
  let state = "reserved", category = "reserved", policy = null, selected = null;
  let reservation = null, terminated = false, start = null, lastMono = null, lastWall = null;
  let monotonic = () => performance.now(), wall = () => Date.now();
  const counts = {
    observed_requests: 0, admitted_requests: 0, dispatches: 0, local_fulfillments: 0,
    completed_responses: 0, retained_bytes: 0,
  };
  const admitted = [];
  const name = record(options) && CASES.includes(options.case_name) ? options.case_name : null;
  function fail(reason) {
    if (state !== "failed") {
      state = "failed";
      category = reason;
    }
    return false;
  }
  function snapshot() {
    return {
      schema_version: 1, case_name: name, evidence_layer: policy?.evidence_layer ?? "none",
      state, category, counts: { ...counts },
      live_guard_qualified: false, vendor_dispatch_proved: false, vendor_receipt_proved: false,
      chamber_compatibility_proved: false, attribution_proved: false, candidate_eligibility_proved: false,
    };
  }
  function checkTime() {
    if (state === "failed") return false;
    let mono, now;
    try {
      mono = monotonic();
      now = wall();
    } catch {
      // Clock-provider exceptions alone; no general execution catch/fallback.
      return fail("clock_invalid");
    }
    if (!finite(mono) || !finite(now) || (lastMono !== null && mono < lastMono)
      || (lastWall !== null && now < lastWall)) return fail("clock_invalid");
    if (start === null) start = mono;
    lastMono = mono;
    lastWall = now;
    if (mono - start > LIMITS.duration_ms) return fail("deadline");
    if (policy && now >= policy.expires_at_ms) return fail("authority_expired");
    return true;
  }
  function active() {
    if (state === "failed") return false;
    if (terminated) return fail("already_terminated");
    return checkTime();
  }
  function report() {
    if (!terminated) checkTime();
    return snapshot();
  }
  function admit(request) {
    const stop = () => ({ allowed: false, action: "stop", ordinal: null, result: snapshot() });
    if (!active()) return stop();
    counts.observed_requests++;
    if (counts.observed_requests > LIMITS.observed_requests) {
      fail("observed_limit");
      return stop();
    }
    if (!keys(request, ["url", "method", "transport", "resource", "ownership_marker",
      "parent_ordinal", "headers", "body"])
      || !Buffer.isBuffer(request.headers) || !Buffer.isBuffer(request.body)
      || typeof request.url !== "string" || !request.url.isWellFormed()) {
      fail("request_invalid");
      return stop();
    }
    const urlBytes = Buffer.byteLength(request.url);
    if (urlBytes > LIMITS.url_bytes) {
      fail("url_limit");
      return stop();
    }
    const scope = selected.scopes.find(s => s.url === request.url && s.method === request.method
      && s.transport === request.transport && s.resource === request.resource);
    if (!scope || request.ownership_marker !== selected.ownership_marker) {
      fail("scope_mismatch");
      return stop();
    }
    const parent = request.parent_ordinal;
    if (scope.parent_scope === null ? parent !== null
      : !Number.isSafeInteger(parent) || parent < 0 || parent >= admitted.length
        || admitted[parent].scope.id !== scope.parent_scope) {
      fail("parent_invalid");
      return stop();
    }
    const bytes = bufferBytes(request.headers) + bufferBytes(request.body);
    if (bytes > LIMITS.request_bytes) {
      fail("request_limit");
      return stop();
    }
    const retained = urlBytes + bytes;
    if (counts.retained_bytes + retained > LIMITS.retained_bytes) {
      fail("retained_limit");
      return stop();
    }
    const dispatchLimit = name.startsWith("google-") ? LIMITS.google_dispatches : LIMITS.meta_dispatches;
    if (scope.mode === "dispatch" && counts.dispatches >= dispatchLimit) {
      fail("dispatch_limit");
      return stop();
    }
    const ordinal = admitted.length;
    admitted.push({ scope, completed: false });
    counts.admitted_requests++;
    counts.retained_bytes += retained;
    if (scope.mode === "dispatch") counts.dispatches++;
    else counts.local_fulfillments++;
    state = "active";
    category = "admitted";
    return { allowed: true, action: scope.mode, ordinal, result: snapshot() };
  }
  function complete(response) {
    if (!active()) return snapshot();
    if (!keys(response, ["ordinal", "headers", "body", "complete"])
      || !Number.isSafeInteger(response.ordinal) || response.ordinal < 0
      || response.ordinal >= admitted.length || response.complete !== true
      || !Buffer.isBuffer(response.headers) || !Buffer.isBuffer(response.body)) {
      fail("response_invalid");
      return snapshot();
    }
    const row = admitted[response.ordinal];
    if (row.completed) fail("response_duplicate");
    else {
      const bytes = bufferBytes(response.headers) + bufferBytes(response.body);
      if (bytes > LIMITS.response_bytes) fail("response_limit");
      else if (counts.retained_bytes + bytes > LIMITS.retained_bytes) fail("retained_limit");
      else {
        counts.retained_bytes += bytes;
        counts.completed_responses++;
        row.completed = true;
        category = "completed";
      }
    }
    return snapshot();
  }
  function terminate(evidence) {
    if (terminated) {
      fail("already_terminated");
      return snapshot();
    }
    if (active()) {
      const fields = ["observers_removed", "pending_requests_settled", "owned_resources_closed"];
      if (!keys(evidence, fields) || !fields.every(key => evidence[key] === true)) fail("cleanup_invalid");
      else if (admitted.some(row => row.scope.required_response && !row.completed)) fail("response_missing");
      else if (!admitted.some(row => row.scope.mode === "dispatch" && row.completed)) fail("empty_case");
    }
    if (reservation) {
      const closed = closeLedger(policy, reservation);
      if (closed.category) fail(closed.category);
    }
    checkTime(); // Deadline and expiry include durable termination, not just validation.
    terminated = true;
    if (state !== "failed") {
      state = "succeeded";
      category = "success";
    }
    return snapshot();
  }
  const api = Object.freeze({ admit, complete, terminate, report });
  if (!keys(options, ["authority", "case_name", "source_revision", "input_digest", "prerequisites"], ["clock"])) {
    fail("authority_invalid");
    return api;
  }
  if (own(options, "clock")) {
    if (!keys(options.clock, ["monotonic", "wall"]) || typeof options.clock.monotonic !== "function"
      || typeof options.clock.wall !== "function") {
      fail("clock_invalid");
      return api;
    }
    monotonic = options.clock.monotonic;
    wall = options.clock.wall;
  }
  // Start before any validation/filesystem work; no post-reservation clock reset.
  if (!checkTime()) return api;
  policy = policySnapshot(options.authority);
  selected = policy?.cases.find(c => c.case_name === name);
  if (!selected || options.source_revision !== policy.source_revision || options.input_digest !== selected.input_digest) {
    fail("authority_invalid");
    return api;
  }
  if (name.endsWith("-chamber")) {
    if (!keys(options.prerequisites, ["stock_completed", "candidate_eligible"])
      || options.prerequisites.stock_completed !== true || options.prerequisites.candidate_eligible !== true) {
      fail("candidate_prerequisite");
      return api;
    }
  } else if (options.prerequisites !== null) {
    fail("authority_invalid");
    return api;
  }
  if (!checkTime()) return api;
  const reserved = reserveLedger(policy, name);
  if (reserved.category) fail(reserved.category);
  else reservation = reserved;
  checkTime();
  return api;
}
