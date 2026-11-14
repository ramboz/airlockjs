/**
 * Synchronous storage shim for the alloy chamber (spec 067-12). A Web Worker has no
 * localStorage/sessionStorage, so the chamber serves a stock SDK's synchronous reads from an
 * in-worker Map seeded at boot from the main-thread broker (already filtered to the granted
 * keys). When `onWrite` is given, every mutation is mirrored asynchronously back to the main
 * thread as `(key, value)` (`value === null` for a removal), where the trusted host seam
 * (core/wrapped-sdk-host.js) filters it against the grant. Without `onWrite` it is the plain
 * in-memory shim the chamber always had (no message traffic).
 *
 * @param {Record<string, string>} [seed]
 * @param {((key: string, value: (string|null)) => void)|null} [onWrite]
 */
export function createSyncStorage(seed, onWrite) {
  const m = new Map();
  if (seed && typeof seed === "object") {
    for (const [k, v] of Object.entries(seed)) if (typeof v === "string") m.set(k, v);
  }
  const emit = (k, v) => { if (typeof onWrite === "function") onWrite(k, v); };
  const api = {
    getItem: (k) => (m.has(String(k)) ? m.get(String(k)) : null),
    setItem: (k, v) => { const key = String(k); const val = String(v); m.set(key, val); emit(key, val); },
    removeItem: (k) => { const key = String(k); if (m.delete(key)) emit(key, null); },
    clear: () => { const keys = [...m.keys()]; m.clear(); for (const key of keys) emit(key, null); },
    key: (i) => [...m.keys()][i] ?? null,
    get length() { return m.size; },
  };
  return new Proxy(api, {
    get(t, p) { if (p in t) return t[p]; return typeof p === "string" ? m.get(p) : undefined; },
    set(t, p, v) { if (typeof p === "string") { const val = String(v); m.set(p, val); emit(p, val); } return true; },
  });
}
