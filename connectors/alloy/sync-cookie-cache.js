/**
 * Synchronous cookie cache for the alloy chamber — spec 012-01, AC3.
 *
 * A stock vendor SDK (alloy, R-004) reads `document.cookie` SYNCHRONOUSLY: the
 * getApexDomain / getTld apex-domain probe fires at the very first command, then
 * identity reads follow. A Web Worker has no `document.cookie` (R-006 F1), so the
 * chamber serves those reads from a synchronous in-worker STRING cache — seeded
 * at boot from the main-thread broker's authoritative jar, every write mirrored
 * ASYNCHRONOUSLY back to it (the "sync-cache + async write-back" shape R-004
 * proved, with no SharedArrayBuffer — AD-4).
 *
 * This cache backs the ADDITIVE `GrantedCapabilities.cookies.sync` surface
 * (readSync / writeSync) — see contracts/capability.d.ts. The pinned async
 * `get`/`set` cookie surface is untouched (AC3 additive; AC6 signature-stability).
 *
 * R-004 proved the original simple upsert for its observed writes. This cache
 * also removes immediately expired writes; it does not track future expiry
 * or implement a complete browser cookie jar.
 *
 * @param {string} [seed] the boot cookie string (the broker's jar snapshot).
 * @param {(rawSetCookie: string) => void} [onWriteBack] async reconcile hook —
 *   handed the raw `name=value; attrs` string on every write so the chamber can
 *   post it back to the main thread. Optional; a no-op by default.
 * @returns {{ readSync: () => string, writeSync: (setCookie: string) => void }}
 */
export function createSyncCookieCache(seed = "", onWriteBack = () => {}) {
  // Defensive: a non-string seed (undefined / null / anything) yields an empty
  // jar so the FIRST synchronous read (alloy's getApexDomain probe) never throws.
  let jar = typeof seed === "string" ? seed : "";

  function readSync() {
    return jar;
  }

  function writeSync(setCookie) {
    const raw = String(setCookie);
    const name = raw.split("=")[0].trim();
    const firstPair = raw.split(";")[0];
    const pairs = jar ? jar.split("; ").filter((p) => p.split("=")[0].trim() !== name) : [];
    let maxAge;
    let expires;
    for (const attribute of raw.split(";").slice(1)) {
      const separator = attribute.indexOf("=");
      if (separator < 0) continue;
      const key = attribute.slice(0, separator).trim().toLowerCase();
      const value = attribute.slice(separator + 1).trim();
      if (key === "max-age" && /^-?\d+$/.test(value)) maxAge = Number(value);
      if (key === "expires") {
        const parsed = Date.parse(value);
        if (Number.isFinite(parsed)) expires = parsed;
      }
    }
    const expired = maxAge !== undefined ? maxAge <= 0 : expires !== undefined && expires <= Date.now();
    if (!expired) pairs.push(firstPair);
    jar = pairs.join("; ");
    // Reconcile to the broker's authoritative jar asynchronously (the caller
    // posts this to the main thread). The cache is already updated above, so a
    // synchronous read-after-write is coherent within the chamber.
    onWriteBack(raw);
  }

  return { readSync, writeSync };
}
