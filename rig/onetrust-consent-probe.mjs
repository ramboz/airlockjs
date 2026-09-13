// Spec 047 grounding probe — the OneTrust consent-INPUT surface on the reference site.
//
// Question (spec 047 §A1–§A4): does the reference intuit-class page expose OneTrust's
// resolved consent client-side, through which surface, under which consent model, and how do
// its groups manifest as Google Consent Mode v2 signals? The 047 driver reads that surface and
// maps groups → the core/consent.js purpose vector, so the driver contract can't be pinned until
// this is grounded (047-01 DoR).
//
// Mirrors rig/lh-r010.mjs's launch discipline: no URL hardcoded (REFERENCE_URL env; the page
// lives in the container owner's docs, not this repo), system Chrome via chrome-launcher (reaches
// the site in-sandbox where the in-app browser is org-blocked). Read-only: it inspects JS state,
// it does NOT click the banner / accept / reject (that would change consent + fire beacons).
//
// R5 discipline: OUTPUT IS REDACTED — no raw cookie values, no consentId UUID, no host lists.
// Structural facts only (group ids/names/status, consent model, CM v2 signal states). Raw stays
// local; nothing here is committed as a fixture.
//
// Usage:  REFERENCE_URL=https://<intuit-class-page> node rig/onetrust-consent-probe.mjs
//
// No URL is hardcoded (mirrors rig/lh-r010.mjs): the reference page lives in the container owner's
// docs, not this repo. Confirm it is public + loadable (not an authed app) first.
import { launch } from "chrome-launcher";
import { chromium } from "playwright";

const REFERENCE_URL = process.env.REFERENCE_URL || process.env.LIVE_URL || "";
if (!REFERENCE_URL) {
  console.error(
    "047-probe: set REFERENCE_URL to the intuit-class page to inspect.\n" +
      "  REFERENCE_URL=https://<page> node rig/onetrust-consent-probe.mjs",
  );
  process.exit(2);
}

function probeInPage() {
  const g = window;
  const t = (x) => typeof x;
  const out = { finalUrl: location.href, title: document.title };

  // --- OneTrust runtime surface (§A1) + change-signal surface (§A2) ---
  out.OneTrust_type = t(g.OneTrust);
  out.OnetrustActiveGroups =
    typeof g.OnetrustActiveGroups === "string" ? g.OnetrustActiveGroups : (g.OnetrustActiveGroups ?? null);
  out.OptanonActiveGroups =
    typeof g.OptanonActiveGroups === "string" ? g.OptanonActiveGroups : (g.OptanonActiveGroups ?? null);
  out.OptanonWrapper_type = t(g.OptanonWrapper);
  out.OnConsentChanged_type = g.OneTrust ? t(g.OneTrust.OnConsentChanged) : "no-OneTrust";
  out.GetDomainData_type = g.OneTrust ? t(g.OneTrust.GetDomainData) : "no-OneTrust";
  out.IsAlertBoxClosed_type = g.OneTrust ? t(g.OneTrust.IsAlertBoxClosed) : "no-OneTrust";

  // --- Domain data: groups + consent model (§A3/§A4) ---
  try {
    const dd = g.OneTrust && g.OneTrust.GetDomainData ? g.OneTrust.GetDomainData() : null;
    if (dd) {
      out.consentModel = dd.ConsentModel ? dd.ConsentModel.Name : null; // opt-in / opt-out / implied
      out.showAlertNotice = dd.ShowAlertNotice ?? null;
      out.groups = (dd.Groups || []).map((x) => ({
        customId: x.CustomGroupId, // C0001..C000N
        name: x.GroupName,
        status: x.Status, // active / inactive / always active
        type: x.Type,
        firstPartyCookieCount: (x.FirstPartyCookies || []).length,
        subGroups: (x.SubGroups || []).map((s) => s.CustomGroupId),
      }));
    } else {
      out.groups = "GetDomainData unavailable";
    }
  } catch (e) {
    out.groupsErr = String(e);
  }

  // --- Cookies (§A1/§A4) — REDACTED (names + parsed group flags only) ---
  try {
    const ck = document.cookie.split(";").map((s) => s.trim()).filter(Boolean);
    out.cookieNames = ck.map((c) => c.split("=")[0]);
    const oc = ck.find((c) => c.startsWith("OptanonConsent="));
    if (oc) {
      const val = decodeURIComponent(oc.split("=").slice(1).join("="));
      const p = Object.fromEntries(new URLSearchParams(val));
      out.optanonConsent = {
        groups: p.groups || null, // e.g. "C0001:1,C0002:1,C0003:0,C0004:0"
        isGpcEnabled: p.isGpcEnabled ?? null,
        geolocation: p.geolocation ?? null, // region drives opt-in vs opt-out
        datestampPresent: !!p.datestamp,
        consentIdPresent: !!p.consentId, // UUID redacted — presence only
      };
    }
    out.alertBoxClosedPresent = ck.some((c) => c.startsWith("OptanonAlertBoxClosed="));
  } catch (e) {
    out.cookieErr = String(e);
  }

  // --- Consent Mode v2 manifestation (§A3): how groups become gcs signals ---
  try {
    out.gtag_type = t(g.gtag);
    out.dataLayer_isArray = Array.isArray(g.dataLayer);
    if (Array.isArray(g.dataLayer)) {
      out.dataLayerConsent = g.dataLayer
        .map((a) => (a && a.length && a[0] === "consent" ? { op: a[1], signals: a[2] } : null))
        .filter(Boolean)
        .slice(0, 20);
    }
    const ics = g.google_tag_data && g.google_tag_data.ics;
    if (ics && ics.entries) {
      out.consentModeICS = {};
      for (const k of Object.keys(ics.entries)) {
        const e = ics.entries[k];
        out.consentModeICS[k] = { default: e.default, update: e.update, quiet: e.quiet };
      }
    }
  } catch (e) {
    out.cmErr = String(e);
  }

  // --- Tealium (R-007: OneTrust → CM v2 mapping lives in the Tealium profile) ---
  out.utag_type = t(g.utag);
  try {
    out.utag_profile = g.utag && g.utag.cfg ? g.utag.cfg.utid || null : null;
  } catch (e) {
    /* ignore */
  }
  return out;
}

async function main() {
  const chrome = await launch({ chromeFlags: ["--headless=new", "--no-sandbox", "--disable-gpu"] });
  const consoleErrs = [];
  try {
    const browser = await chromium.connectOverCDP(`http://127.0.0.1:${chrome.port}`);
    const ctx = browser.contexts()[0] || (await browser.newContext());
    const page = await ctx.newPage();
    page.on("console", (m) => {
      if (m.type() === "error") consoleErrs.push(m.text().slice(0, 200));
    });
    console.error(`047-probe: loading ${REFERENCE_URL} …`);
    await page.goto(REFERENCE_URL, { waitUntil: "domcontentloaded", timeout: 60000 }).catch((e) => {
      console.error("  goto warning:", String(e).slice(0, 160));
    });
    // Give the tag manager + OneTrust + gtag time to boot, then poll for OneTrust.
    await page.waitForTimeout(5000);
    await page
      .waitForFunction(() => !!(window.OneTrust || window.OnetrustActiveGroups), { timeout: 8000 })
      .catch(() => console.error("  (OneTrust not detected within poll window)"));
    const result = await page.evaluate(probeInPage);
    result.consoleErrors = consoleErrs.slice(0, 8);
    console.log(JSON.stringify(result, null, 2));
    await browser.close();
  } finally {
    await chrome.kill();
  }
}

main().catch((e) => {
  console.error("047-probe failed:", e?.stack || e);
  process.exit(1);
});
