// Spec 047-01 / ADR-0026 MAP-GROUNDING EXPERIMENT — decompose the OneTrust group→purpose map.
//
// ADR-0026 grounds the resolved SURFACE (OnetrustActiveGroups/cookie flip on opt-out; Status is
// config-default) but leaves the group→purpose MAP shape UNVERIFIED. This probe isolates each
// default-granted group with a SINGLE consent change (from a fresh, cookie-cleared session) and reads
// which Consent Mode v2 signals drop in the site's own resolved CM vector (google_tag_data.ics) — the
// ground-truth oracle. If denying one group cleanly drops a specific subset of CM signals, that group's
// per-purpose entry is grounded; if no single-group change maps cleanly (combinational/conditional),
// the static per-group map is insufficient → ADR-0026's kill-criterion (fall to Option B).
//
// Robust by construction: fresh page + cleared cookies per group (single change, no accumulated state),
// reload-aware settle, and a HARD per-group timeout so a consent-change-triggered reload can't hang the
// run. Consent-STATE-CHANGING and explicitly authorized. Throwaway headless; no login/PII. R5: output
// is group flags + CM signal states only. Raw stays local.
//
// Usage:  REFERENCE_URL=https://erp.intuit.com node rig/onetrust-map-probe.mjs
//         REFERENCE_URL=… GROUPS="4,BG394" node rig/onetrust-map-probe.mjs
import { launch } from "chrome-launcher";
import { chromium } from "playwright";

const REFERENCE_URL = process.env.REFERENCE_URL || process.env.LIVE_URL || "";
if (!REFERENCE_URL) {
  console.error("047-map-probe: set REFERENCE_URL to the intuit-class page.");
  process.exit(2);
}
const GROUPS = (process.env.GROUPS || "4,BG394").split(",").map((s) => s.trim()).filter(Boolean);
// The optional groups granted in the default (US opt-out) state — isolate one by granting the rest.
// UpdateConsent has REPLACE semantics: unlisted groups are denied, so we must pass the full profile.
const DEFAULT_GRANTED = (process.env.DEFAULT_GRANTED || "BG394,4").split(",").map((s) => s.trim()).filter(Boolean);
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const CM = ["ad_storage", "analytics_storage", "ad_user_data", "ad_personalization"];

function snapshot() {
  const g = window;
  const out = { cm: {}, active: null };
  try {
    const ics = g.google_tag_data && g.google_tag_data.ics;
    for (const k of ["ad_storage", "analytics_storage", "ad_user_data", "ad_personalization"]) {
      const e = ics && ics.entries ? ics.entries[k] : null;
      out.cm[k] = !e ? "absent" : e.update !== undefined ? (e.update ? "granted" : "denied") : e.default ? "granted" : "denied";
    }
  } catch (e) {
    out.cmErr = String(e);
  }
  out.active = typeof g.OnetrustActiveGroups === "string" ? g.OnetrustActiveGroups : null;
  return out;
}

async function withTimeout(promise, ms, label) {
  let t;
  const timeout = new Promise((_, rej) => (t = setTimeout(() => rej(new Error("timeout:" + label)), ms)));
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(t);
  }
}

async function probeGroup(ctx, gid) {
  const page = await ctx.newPage();
  try {
    await page.goto(REFERENCE_URL, { waitUntil: "domcontentloaded", timeout: 45000 }).catch(() => {});
    await page.waitForTimeout(4000);
    await page
      .waitForFunction(() => !!(window.OneTrust && typeof window.OneTrust.UpdateConsent === "function"), { timeout: 8000 })
      .catch(() => {});
    const before = await page.evaluate(snapshot);
    // Full profile: grant every default-granted optional group EXCEPT the target (denied). This
    // isolates the target — replace-semantics would otherwise deny everything unlisted.
    const profile = DEFAULT_GRANTED.map((g) => g + ":" + (g === gid ? "0" : "1")).join(",");
    const act = await page
      .evaluate((p) => {
        try {
          window.OneTrust.UpdateConsent("Category", p);
          return "ok";
        } catch (e) {
          return "err:" + String(e);
        }
      }, profile)
      .catch((e) => "context-evicted(reload?):" + String(e).slice(0, 50));
    await page.waitForTimeout(3500); // settle (handles in-place update or reload)
    await page
      .waitForFunction(() => !!(window.OneTrust && window.google_tag_data && window.google_tag_data.ics), { timeout: 6000 })
      .catch(() => {});
    const after = await page.evaluate(snapshot).catch((e) => ({ evalErr: String(e).slice(0, 80) }));
    const dropped = after.cm ? CM.filter((k) => before.cm[k] === "granted" && after.cm[k] === "denied") : [];
    return {
      profile_set: profile,
      updateConsent: act,
      dropped_cm_signals: dropped,
      before: { cm: before.cm, active: before.active },
      after: { cm: after.cm, active: after.active },
    };
  } finally {
    await page.close().catch(() => {});
  }
}

async function main() {
  const chrome = await launch({
    chromeFlags: ["--headless=new", "--no-sandbox", "--disable-gpu", `--user-agent=${UA}`],
  });
  try {
    const browser = await chromium.connectOverCDP(`http://127.0.0.1:${chrome.port}`);
    const ctx = browser.contexts()[0] || (await browser.newContext());
    const results = {};
    for (const gid of GROUPS) {
      await ctx.clearCookies().catch(() => {}); // reset to the default (no-prior-consent) state
      console.error(`047-map-probe: group ${gid} …`);
      try {
        results[gid] = await withTimeout(probeGroup(ctx, gid), 40000, gid);
      } catch (e) {
        results[gid] = { error: String(e).slice(0, 80) };
      }
    }
    console.log(JSON.stringify({ url: REFERENCE_URL, groups: GROUPS, results }, null, 2));
    await browser.close();
  } finally {
    await chrome.kill();
  }
}

main().catch((e) => {
  console.error("047-map-probe failed:", e?.stack || e);
  process.exit(1);
});
