/* Boilerplate scripts.js (aem-boilerplate @ d75bfd2) + the aem-experimentation
 * v2 wiring from its README, + a passive timing probe (window.__flicker) that
 * only records performance marks; it never mutates the page. */
import {
  loadHeader,
  loadFooter,
  decorateIcons,
  decorateSections,
  decorateBlocks,
  decorateTemplateAndTheme,
  waitForFirstImage,
  loadSection,
  loadSections,
  loadCSS,
} from './aem.js';
import {
  runExperimentation,
  runExperimentationLazy,
} from './experiment-loader.js';

/* --- spike timing probe (passive) --- */
window.__flicker = { events: [], rum: [] };
const rec = (name) => {
  performance.mark(name);
  window.__flicker.events.push({ name, t: performance.now() });
};
rec('scripts:module-start');
document.addEventListener('aem:experimentation', (e) => {
  rec(`exp-applied:${e.detail.experiment}:${e.detail.variant}`);
});
try {
  new PerformanceObserver((list) => {
    list.getEntries().forEach((en) => {
      window.__flicker.events.push({ name: `paint:${en.name}`, t: en.startTime });
    });
  }).observe({ type: 'paint', buffered: true });
} catch (e) { /* no paint observer */ }
// capture the RUM exposure checkpoint without changing its behavior
if (window.hlx?.rum?.sampleRUM) {
  const orig = window.hlx.rum.sampleRUM;
  window.hlx.rum.sampleRUM = (...args) => {
    window.__flicker.rum.push({ t: performance.now(), args: JSON.parse(JSON.stringify(args)) });
    return orig(...args);
  };
}
/* --- end probe --- */

const experimentationConfig = {
  prodHost: 'www.example-prod-host.test',
  audiences: {
    mobile: () => window.innerWidth < 600,
    desktop: () => window.innerWidth >= 600,
  },
};

if (window.trustedTypes && window.trustedTypes.createPolicy) {
  const innerTT = window.trustedTypes.createPolicy('tt-inner', {
    createHTML: (s) => s, // avoid stack overflow
  });

  window.trustedTypes.createPolicy('default', {
    createHTML: (input, type, sink) => {
      let processedInput = input;
      if (/srcdoc\s*=/i.test(processedInput)) {
        const doc = new DOMParser().parseFromString(innerTT.createHTML(processedInput), 'text/html');
        doc.querySelectorAll('iframe[srcdoc]').forEach((el) => el.removeAttribute('srcdoc'));
        processedInput = doc.body.innerHTML;
      }
      if (sink.includes('createContextualFragment') || sink.includes('Document write')) {
        const doc = new DOMParser().parseFromString(innerTT.createHTML(processedInput), 'text/html');
        doc.querySelectorAll('script').forEach((el) => el.remove());
        processedInput = doc.body.innerHTML;
      }
      return processedInput;
    },
    createScriptURL: (input) => input,
    createScript: (input) => input,
  });
}

/**
 * load fonts.css and set a session storage flag
 */
async function loadFonts() {
  await loadCSS(`${window.hlx.codeBasePath}/styles/fonts.css`);
  try {
    if (!window.location.hostname.includes('localhost')) sessionStorage.setItem('fonts-loaded', 'true');
  } catch (e) {
    // do nothing
  }
}

/**
 * Builds all synthetic blocks in a container element.
 * @param {Element} main The container element
 */
function buildAutoBlocks() {
  try {
    // no auto blocks in the testbed
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Auto Blocking failed', error);
  }
}

/**
 * Decorates formatted links to style them as buttons.
 * @param {HTMLElement} main The main container element
 */
function decorateButtons(main) {
  main.querySelectorAll('p a[href]').forEach((a) => {
    a.title = a.title || a.textContent;
    const p = a.closest('p');
    const text = a.textContent.trim();

    if (a.querySelector('img') || p.textContent.trim() !== text) return;

    try {
      if (new URL(a.href).href === new URL(text, window.location).href) return;
    } catch { /* continue */ }

    const strong = a.closest('strong');
    const em = a.closest('em');
    if (!strong && !em) return;

    p.className = 'button-wrapper';
    a.className = 'button';
    if (strong && em) {
      a.classList.add('accent');
      const outer = strong.contains(em) ? strong : em;
      outer.replaceWith(a);
    } else if (strong) {
      a.classList.add('primary');
      strong.replaceWith(a);
    } else {
      a.classList.add('secondary');
      em.replaceWith(a);
    }
  });
}

/**
 * Decorates the main element.
 * @param {Element} main The main element
 */
// eslint-disable-next-line import/prefer-default-export
export function decorateMain(main) {
  decorateIcons(main);
  buildAutoBlocks(main);
  decorateSections(main);
  decorateBlocks(main);
  decorateButtons(main);
}

/**
 * Loads everything needed to get to LCP.
 * @param {Element} doc The container element
 */
async function loadEager(doc) {
  document.documentElement.lang = 'en';
  decorateTemplateAndTheme();

  rec('experimentation:start');
  await runExperimentation(doc, experimentationConfig);
  rec('experimentation:done');

  const main = doc.querySelector('main');
  if (main) {
    decorateMain(main);
    document.body.classList.add('appear');
    rec('body:appear');
    await loadSection(main.querySelector('.section'), waitForFirstImage);
  }

  try {
    /* if desktop (proxy for fast connection) or fonts already loaded, load fonts.css */
    if (window.innerWidth >= 900 || sessionStorage.getItem('fonts-loaded')) {
      loadFonts();
    }
  } catch (e) {
    // do nothing
  }
}

/**
 * Loads everything that doesn't need to be delayed.
 * @param {Element} doc The container element
 */
async function loadLazy(doc) {
  loadHeader(doc.querySelector('body > header'));

  const main = doc.querySelector('main');
  await loadSections(main);

  const { hash } = window.location;
  const element = hash ? doc.getElementById(hash.substring(1)) : false;
  if (hash && element) element.scrollIntoView();

  loadFooter(doc.querySelector('body > footer'));

  loadCSS(`${window.hlx.codeBasePath}/styles/lazy-styles.css`);
  loadFonts();

  await runExperimentationLazy(doc, experimentationConfig);

  // Airlock GA4 analytics — booted in the LAZY phase (AD-8: analytics is lazy), AFTER
  // body.appear (set in loadEager). Imports the BUNDLED runtime emitted into this
  // testbed's served tree by `npm run build` (repo-root build.mjs →
  // scripts/airlock/eds.js + sibling chamber.worker.js — same-origin file worker per
  // the 004-01 CSP verdict). Dynamic import keeps it off the eager/LCP path. The
  // rec('airlock:init') mark makes the ordering observable — body:appear precedes
  // airlock:init (spec 004-02 AC2). Boot is ASYNC since 004-03 (it sources the real
  // _ga cookie ctx — generating + persisting a first-party _ga when absent — before
  // creating the runtime), so it is awaited: airlock:init marks a COMPLETED boot.
  // Boot must never break the page, so a failed load OR a rejected boot is caught —
  // but VISIBLY: window.__airlockBootFailed lets a rig distinguish a failed boot
  // from a silent no-op. (004-04 wires the real GA4 endpoint + the
  // interaction→beacon path.)
  try {
    const { bootEdsAnalytics } = await import(`${window.hlx.codeBasePath}/scripts/airlock/eds.js`);
    await bootEdsAnalytics();
    rec('airlock:init');
  } catch (e) {
    window.__airlockBootFailed = String(e);
    // eslint-disable-next-line no-console
    console.warn('airlock analytics boot FAILED (page unaffected):', e);
  }
}

/**
 * Loads everything that happens a lot later,
 * without impacting the user experience.
 */
function loadDelayed() {
  // consent-check omitted in the testbed (no consent banner content locally)
}

async function loadPage() {
  await loadEager(document);
  await loadLazy(document);
  loadDelayed();
}

loadPage();
