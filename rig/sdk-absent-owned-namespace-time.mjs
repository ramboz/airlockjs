import { data, record } from "./inspected-meta-record.mjs";
import { fail, freeze } from "./sdk-absent-owned-namespace-io.mjs";

export const TOTAL_MS = 45000;
export const WORK_MS = 35000;
export const PREPERMIT_MS = 1000;
export const tick = value => {
  if (!Number.isFinite(value) || value < 0 || value > Number.MAX_SAFE_INTEGER - TOTAL_MS)
    fail("namespace_monotonic_time");
  return value;
};
export function clockBounds(value) {
  const c = record(data(value), ["schema", "status", "minimum_init_ticks_per_supervisor_tick",
    "maximum_init_ticks_per_supervisor_tick", "conservative_margin_ms", "evidence_sha256"]);
  if (c.schema !== "airlock.owned-namespace-clock-bounds.v1" || c.status !== "SIMULATED_NOT_PROVEN"
    || !Number.isFinite(c.minimum_init_ticks_per_supervisor_tick)
    || c.minimum_init_ticks_per_supervisor_tick <= 0 || c.minimum_init_ticks_per_supervisor_tick > 1
    || !Number.isFinite(c.maximum_init_ticks_per_supervisor_tick)
    || c.maximum_init_ticks_per_supervisor_tick < 1 || c.maximum_init_ticks_per_supervisor_tick > 2
    || !Number.isFinite(c.conservative_margin_ms) || c.conservative_margin_ms <= 0 || c.conservative_margin_ms >= PREPERMIT_MS
    || !/^[a-f0-9]{64}$/.test(c.evidence_sha256)) fail("namespace_clock_bounds_UNPROVED");
  return freeze(c);
}
export function conservativeArm({ case_id, nonce, tau0_ms, now_ms, work_deadline_ms, total_deadline_ms, clock }) {
  const c = clockBounds(clock);
  [tau0_ms, now_ms, work_deadline_ms, total_deadline_ms].forEach(tick);
  const remaining = fence => Math.floor((fence - now_ms) * c.minimum_init_ticks_per_supervisor_tick - c.conservative_margin_ms);
  const work = remaining(work_deadline_ms), total = remaining(total_deadline_ms);
  if (work <= 0 || total <= work || total > TOTAL_MS) fail("namespace_original_deadline_expired");
  return freeze({ type: "ARM", case_id, nonce, tau0_ms, work_remaining_ms: work, total_remaining_ms: total,
    clock_evidence_sha256: c.evidence_sha256 });
}

const inits = new WeakMap();
const token = () => Object.freeze(Object.create(null));
export function createNamespaceInitModel(value) {
  const v = record(data(value), ["case_id", "nonce", "tau0_ms", "clock"]);
  if (!/^[a-z0-9-]{1,48}$/.test(v.case_id) || !/^[a-f0-9]{64}$/.test(v.nonce)) fail("namespace_init_identity");
  tick(v.tau0_ms);
  const handle = token();
  inits.set(handle, { ...v, clock: clockBounds(v.clock), last: v.tau0_ms, armed: false, worked: false, closed: false,
    watchdog_armed: false, work_deadline_ms: null, total_deadline_ms: null });
  return handle;
}
function local(handle, now) {
  const s = inits.get(handle);
  if (!s) fail("private_namespace_init");
  tick(now);
  if (now < s.last) { s.closed = true; fail("namespace_clock_reversed"); }
  s.last = now;
  if (s.closed) fail("namespace_init_closed");
  const fence = s.armed ? s.total_deadline_ms : s.tau0_ms + PREPERMIT_MS;
  if (now >= fence) { s.closed = true; fail("namespace_init_deadline"); }
  return s;
}
export function namespaceInitHello(handle, now) {
  const s = local(handle, now);
  if (s.hello_sent) fail("namespace_duplicate_hello");
  s.hello_sent = true;
  return freeze({ type: "HELLO", case_id: s.case_id, nonce: s.nonce, tau0_ms: s.tau0_ms });
}
export function namespaceInitArm(handle, value, now) {
  const s = local(handle, now), p = record(data(value),
    ["type", "case_id", "nonce", "tau0_ms", "work_remaining_ms", "total_remaining_ms", "clock_evidence_sha256"]);
  if (!s.hello_sent || s.armed || p.type !== "ARM" || p.case_id !== s.case_id || p.nonce !== s.nonce
    || p.tau0_ms !== s.tau0_ms || p.clock_evidence_sha256 !== s.clock.evidence_sha256
    || !Number.isSafeInteger(p.work_remaining_ms) || p.work_remaining_ms <= 0
    || !Number.isSafeInteger(p.total_remaining_ms) || p.total_remaining_ms <= p.work_remaining_ms
    || p.total_remaining_ms > TOTAL_MS) { s.closed = true; fail("namespace_invalid_or_renewed_arm"); }
  // Durations are anchored to retained pre-HELLO tau0, NOT ARM receipt.
  s.work_deadline_ms = s.tau0_ms + p.work_remaining_ms;
  s.total_deadline_ms = s.tau0_ms + p.total_remaining_ms;
  if (now >= s.work_deadline_ms) { s.closed = true; fail("namespace_expired_arm"); }
  s.armed = true;
  return freeze({ arm_watchdog_until_ms: s.total_deadline_ms });
}
export function namespaceInitWatchdogArmed(handle, now) {
  const s = local(handle, now);
  if (!s.armed || s.watchdog_armed) fail("namespace_watchdog_order");
  s.watchdog_armed = true;
  return freeze({ type: "ARMED", case_id: s.case_id, nonce: s.nonce, tau0_ms: s.tau0_ms });
}
export function namespaceInitWork(handle, value, now) {
  const s = local(handle, now), v = record(data(value), ["type", "case_id", "nonce", "tau0_ms", "control"]);
  if (!s.watchdog_armed || s.worked || v.type !== "WORK" || v.case_id !== s.case_id || v.nonce !== s.nonce
    || v.tau0_ms !== s.tau0_ms     || !["normal", "late-detached-orphan"].includes(v.control)
    || now >= s.work_deadline_ms) { s.closed = true; fail("namespace_work_fence_or_permit"); }
  s.worked = true;
  return freeze({ control: v.control, work_deadline_ms: s.work_deadline_ms, total_deadline_ms: s.total_deadline_ms });
}
