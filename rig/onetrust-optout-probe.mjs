// Spec 047 / ADR-0026 GROUNDING EXPERIMENT — the discriminating opt-out probe.
//
// The read-only probe (rig/onetrust-consent-probe.mjs) could not tell whether a given OneTrust
// surface reflects the USER's resolved consent or OneTrust's CONFIGURED DEFAULT, because it ran
// pre-interaction on an opt-out/default-granted page. This probe changes consent (opts OUT of the
// optional groups via OneTrust's own API — the privacy-preserving direction), then diffs every
// surface BEFORE vs AFTER. The surface(s) whose ad-group flags flip active→denied are the
// resolved-consent surface; a surface that stays active is a configured default (unsafe to read).
//
// Consent-STATE-CHANGING and explicitly authorized for this run. Throwaway headless session, no
// login, no PII. Mirrors lh-r010's discipline (no hardcoded URL; system Chrome via chrome-launcher,
// which reaches the site in-sandbox). R5: OUTPUT REDACTED — group flags + statuses only, no
// consentId/cookie values. Raw stays local.
//
// Usage:  REFERENCE_URL=https://erp.intuit.com node rig/onetrust-optout-probe.mjs
import { launch } from "chrome-launcher";
import { chromium } from "playwright";

const REFERENCE_URL = process.env.REFERENCE_URL || process.env.LIVE_URL || "";
if (!REFERENCE_URL) {
  console.error("047-optout-probe: set REFERENCE_URL to the intuit-class page.");
  process.exit(2);
}
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

// Snapshot the four candidate resolved-consent surfaces (redacted to flags/statuses).
function snapshot() {
  const g = window;
  const out = {};
  out.OnetrustActiveGroups = typeof g.OnetrustActiveGroups === "string" ? g.OnetrustActiveGroups : null;
  try {
    const ck = document.cookie.split(";").map((s) => s.trim());
    const oc = ck.find((c) => c.startsWith("OptanonConsent="));
    if (oc) {
      const p = Object.fromEntries(new URLSearchParams(decodeURIComponent(oc.split("=").slice(1).join("="))));
      out.cookieGroups = p.groups || null; // "1:1,BG394:1,4:1,..."
    }
  } catch (e) {
    out.cookieErr = String(e);
  }
  try {
    const dd = g.OneTrust && g.OneTrust.GetDomainData ? g.OneTrust.GetDomainData() : null;
    if (dd) out.getDomainDataStatus = Object.fromEntries((dd.Groups || []).map((x) => [x.CustomGroupId, x.Status]));
  } catch (e) {
    out.statusErr = String(e);
  }
  try {
    const ics = g.google_tag_data && g.google_tag_data.ics;
    if (ics && ics.entries) {
      out.consentModeICS = Object.fromEntries(
        Object.keys(ics.entries).map((k) => [k, { default: ics.entries[k].default, update: ics.entries[k].update }]),
      );
    }
  } catch (e) {
    out.cmErr = String(e);
  }
  try {
    if (Array.isArray(g.dataLayer)) {
      const ups = g.dataLayer.filter((a) => a && a.length && a[0] === "consent" && a[1] === "update").map((a) => a[2]);
      out.lastCmUpdate = ups[ups.length - 1] || null;
    }
  } catch (e) {
    /* ignore */
  }
  return out;
}

async function main() {
  const chrome = await launch({
    chromeFlags: ["--headless=new", "--no-sandbox", "--disable-gpu", `--user-agent=${UA}`],
  });
  const consoleErrs = [];
  try {
    const browser = await chromium.connectOverCDP(`http://127.0.0.1:${chrome.port}`);
    const ctx = browser.contexts()[0] || (await browser.newContext());
    const page = await ctx.newPage();
    page.on("console", (m) => {
      if (m.type() === "error") consoleErrs.push(m.text().slice(0, 160));
    });
    console.error(`047-optout-probe: loading ${REFERENCE_URL} …`);
    await page.goto(REFERENCE_URL, { waitUntil: "domcontentloaded", timeout: 60000 }).catch((e) =>
      console.error("  goto warn:", String(e).slice(0, 140)),
    );
    await page.waitForTimeout(5000);
    await page
      .waitForFunction(() => !!(window.OneTrust && window.OneTrust.GetDomainData), { timeout: 8000 })
      .catch(() => console.error("  (OneTrust.GetDomainData not ready)"));

    const before = await page.evaluate(snapshot);
    const api = await page.evaluate(() => ({
      RejectAll: !!(window.OneTrust && typeof window.OneTrust.RejectAll === "function"),
      UpdateConsent: !!(window.OneTrust && typeof window.OneTrust.UpdateConsent === "function"),
      AllowAll: !!(window.OneTrust && typeof window.OneTrust.AllowAll === "function"),
    }));

    // Opt OUT of the optional groups via OneTrust's own API (privacy-preserving direction).
    const acted = await page.evaluate(() => {
      try {
        if (window.OneTrust && typeof window.OneTrust.RejectAll === "function") {
          window.OneTrust.RejectAll();
          return "RejectAll()";
        }
        if (window.OneTrust && typeof window.OneTrust.UpdateConsent === "function") {
          window.OneTrust.UpdateConsent("Category", "4:0,41:0,42:0,3:0");
          return "UpdateConsent(4/41/42/3 -> 0)";
        }
      } catch (e) {
        return "opt-out-error: " + String(e);
      }
      return "no-opt-out-api";
    });
    await page.waitForTimeout(3500);
    const after = await page.evaluate(snapshot);

    console.log(JSON.stringify({ url: page.url(), api, acted, consoleErrs: consoleErrs.slice(0, 6), before, after }, null, 2));
    await browser.close();
  } finally {
    await chrome.kill();
  }
}

main().catch((e) => {
  console.error("047-optout-probe failed:", e?.stack || e);
  process.exit(1);
});
