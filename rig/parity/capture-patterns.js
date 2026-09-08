/**
 * The BEACON capture pattern set — spec 038-01 DoR/AC1. `rig/lh-r010.mjs`'s `DEFAULT_BLOCK`
 * matches vendor RUNTIME LOADERS (`*connect.facebook.net*` = `fbevents.js`), not Meta's `/tr`
 * BEACON (`www.facebook.com/tr`) — a distinct request this slice's capture step must recognize
 * to extract + redact a container's Meta beacon from a network log (grounded correction,
 * 038-01 DoR). This module is a small, separate, vendor-generic pattern registry for that job —
 * mirroring `rig/lh-r010.mjs`'s own `matchesPattern` matcher, deliberately NOT importing that
 * file (it calls `process.exit(2)` at import time when `REFERENCE_URL` is unset).
 */

/** vendor -> beacon URL glob patterns (`*a*b*` = every non-`*` fragment appears in the URL). */
export const BEACON_CAPTURE_PATTERNS = Object.freeze({
  meta: ["*facebook.com/tr*"],
});

/** `*a*b*` -> every non-`*` fragment appears in `url`, order-independent contains (mirrors
 * rig/lh-r010.mjs's own `matchesPattern`). */
export function matchesPattern(url, pattern) {
  const frags = pattern.split("*").filter(Boolean);
  return frags.every((f) => url.includes(f));
}

/** True if `url` matches any capture pattern declared for `vendor`. An unknown vendor key
 * matches nothing (fails safe, never throws). */
export function matchesVendorBeacon(vendor, url) {
  const patterns = BEACON_CAPTURE_PATTERNS[vendor] || [];
  return patterns.some((p) => matchesPattern(url, p));
}
