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
 * The upsert logic is deliberately byte-for-byte R-004's proven `setCookie`
 * (probes/alloy-worker/worker.js): parse `name=value; attrs`, drop any prior
 * entry of the same name, append the first `name=value` pair. Deliberately no
 * expiry/max-age handling — R-004 confirmed alloy's getTld probe + identity
 * writes round-trip correctly under this exact simple upsert (33 reads / 5
 * writes for one page + one event). Do NOT "improve" it away from the proven
 * shape without re-running the probe.
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
    pairs.push(firstPair);
    jar = pairs.join("; ");
    // Reconcile to the broker's authoritative jar asynchronously (the caller
    // posts this to the main thread). The cache is already updated above, so a
    // synchronous read-after-write is coherent within the chamber.
    onWriteBack(raw);
  }

  return { readSync, writeSync };
}
