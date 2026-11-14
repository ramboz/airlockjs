/**
 * Storage-key grant — the localStorage / sessionStorage half of ADR-0062 point 7
 * (spec 067-12), mirroring `resolveCookieGrant` / `scopeSeedCookies` (core/cookie-scope.js).
 * A connector declares its STOCK storage set per area (`{ localStorage?, sessionStorage? }`,
 * each an array of exact keys and `prefix_` entries, the same match rule as cookie names).
 * That set is the default grant, read and write. A site may narrow it to a subset, never widen.
 *
 * Pure and import-light (only cookie-scope), so both the trusted write-back seam
 * (core/wrapped-sdk-host.js) and the EDS boot-seed seam (adapters/eds/index.js) can use it.
 */
import { matchesGrantedName, resolveCookieGrant } from "./cookie-scope.js";

export const STORAGE_AREAS = Object.freeze(["localStorage", "sessionStorage"]);

/**
 * The effective per-area storage grant. `stock` is the connector's declared set (`null`/absent =
 * nothing declared: every area stays ungated and inactive, today's behavior, spec 067 check 8).
 * A declared stock that omits an area grants nothing there (fail closed). `narrowing` names a
 * subset per area; an unmentioned area keeps its stock. Throws TypeError on a malformed or
 * out-of-stock narrowing so a typo can't silently widen the grant. With no stock, any non-empty
 * narrowing entry is out of the (empty) stock and throws.
 * @param {{ localStorage?: readonly string[], sessionStorage?: readonly string[] }|null|undefined} stock
 * @param {{ localStorage?: readonly string[], sessionStorage?: readonly string[] }|undefined} narrowing
 * @returns {{ areas: { localStorage: (readonly string[]|null), sessionStorage: (readonly string[]|null) }, narrowed: boolean, active: boolean }}
 */
export function resolveStorageGrant(stock, narrowing) {
  const declared = stock && typeof stock === "object" ? stock : null;
  if (narrowing !== undefined && (!narrowing || typeof narrowing !== "object" || Array.isArray(narrowing) || Object.keys(narrowing).some((k) => !STORAGE_AREAS.includes(k)))) {
    throw new TypeError("storageGrantNarrowing must be an object keyed by localStorage and/or sessionStorage");
  }
  const areas = {};
  let narrowed = false;
  for (const area of STORAGE_AREAS) {
    const stockNames = declared ? (Array.isArray(declared[area]) ? declared[area] : []) : [];
    const narrow = narrowing ? narrowing[area] : undefined;
    try {
      const r = resolveCookieGrant(stockNames, narrow);
      areas[area] = declared ? r.names : null;
      narrowed = narrowed || r.narrowed;
    } catch (e) {
      throw new TypeError(`storageGrantNarrowing.${area} is invalid or outside the connector's stock ${area} set (narrowing can't widen): ${e.message}`, { cause: e });
    }
  }
  return { areas, narrowed, active: STORAGE_AREAS.some((a) => areas[a] !== null) };
}

/**
 * Whether a key is granted in an area. An ungated (`null`) area grants nothing: with no declared stock the chamber storage stays in memory.
 * @param {{ localStorage: (readonly string[]|null), sessionStorage: (readonly string[]|null) }} areas
 */
export function storageKeyGranted(areas, area, key) {
  if (!STORAGE_AREAS.includes(area) || typeof key !== "string") return false;
  const names = areas[area];
  return names ? matchesGrantedName(key, names) : false;
}

/**
 * The READ-side boot seed: copy only the granted keys out of each page Storage into plain
 * objects that can cross into the chamber. An ungated (`null`) area seeds nothing (no grant, no
 * seed), and an unavailable or throwing Storage seeds nothing rather than throwing.
 * @param {{ localStorage?: object, sessionStorage?: object }} storages
 * @param {{ localStorage: (readonly string[]|null), sessionStorage: (readonly string[]|null) }} areas
 * @returns {{ localStorage: Record<string,string>, sessionStorage: Record<string,string> }}
 */
export function scopeSeedStorage(storages, areas) {
  const seed = { localStorage: {}, sessionStorage: {} };
  for (const area of STORAGE_AREAS) {
    const names = areas[area];
    const store = storages && storages[area];
    if (!names || !store) continue;
    try {
      for (let i = 0; i < store.length; i++) {
        const key = store.key(i);
        if (!matchesGrantedName(key, names)) continue;
        const value = store.getItem(key);
        if (typeof value === "string") seed[area][key] = value;
      }
    } catch (e) { /* storage access can throw (SecurityError); seed nothing more */ }
  }
  return seed;
}
