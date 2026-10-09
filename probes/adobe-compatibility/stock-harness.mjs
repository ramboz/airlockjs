/**
 * 051-05: fixed local journey, browser-compatible ESM; no SDK/network/DOM imports.
 * Integration is a selection of pinned aem-martech exports, not an override API.
 * Host render/click acknowledgements are trusted fixture observations, NOT SDK proof.
 */
const CASES = ["positive", "no-consent", "no-offer", "non-render"];
const METHODS = [
  "initMartech", "updateUserConsent", "sendEvent", "sendAnalyticsEvent",
  "pushEventToDataLayer", "martechLazy", "martechDelayed",
];
const HTML = '<p>Local stock fixture</p><button type="button">Fixture click</button>';
const SCHEMA = "https://ns.adobe.com/personalization/html-content-item";
const LINK = "web.webinteraction.linkClicks";
const FORBIDDEN_SCOPES = [
  "target-global-mbox", "constructor", "prototype", "__proto__", "toString",
  "hasOwnProperty", "valueOf", "toLocaleString", "isPrototypeOf", "propertyIsEnumerable",
  "__defineGetter__", "__defineSetter__", "__lookupGetter__", "__lookupSetter__",
];

function freeze(value) {
  Object.values(value).forEach(child => {
    if (child && typeof child === "object") freeze(child);
  });
  return Object.freeze(value);
}

function report(caseName) {
  return {
    kind: "airlock.adobe-stock.local-report", schema_version: 1, case: caseName,
    overall: "passed", exit_code: 0,
    phases: { init: "not_started", consent: "not_started", eager: "not_started",
      lazy: "not_started", delayed: "not_started" },
    counts: {
      initializations: 0, consent_updates: 0, attempted_collection: 0, blocked_collection: 0,
      fetch_submissions: 0, page_submissions: 0, custom_submissions: 0, display_submissions: 0,
      interaction_submissions: 0, qualified_propositions: 0, render_attempts: 0, render_confirmed: 0,
      render_blocked: 0, click_attempts: 0, click_confirmed: 0, click_blocked: 0,
    },
    claims: {
      local_fixture_only: true, sdk_execution_verified: false, product_receipt_verified: false,
      deployment_verified: false, activity_activation_performed: false,
    },
  };
}

// Check data descriptors before reading: unknown/accessor inputs never get executed.
function fields(value, required, optional = []) {
  if (!value || typeof value !== "object"
      || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw "invalid_input";
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Reflect.ownKeys(descriptors);
  if (keys.some(key => typeof key !== "string" || ![...required, ...optional].includes(key)
      || !Object.hasOwn(descriptors[key], "value"))
      || required.some(key => !Object.hasOwn(descriptors, key))) throw "invalid_input";
  return Object.fromEntries(keys.map(key => [key, descriptors[key].value]));
}

function functions(value, names) {
  const selected = fields(value, names);
  if (names.some(name => typeof selected[name] !== "function")) throw "invalid_input";
  return selected;
}

function boundedString(value) {
  return typeof value === "string" && value.length > 0 && value.length <= 100
    && ![...value].some(char => {
      const code = char.charCodeAt(0);
      return code <= 32 || (code >= 127 && code <= 159);
    });
}

function validate(input) {
  const o = fields(input, ["integration", "case", "runId", "eventIndex", "pageUrl",
    "decisionScope", "config", "renderer", "timeoutMs"], ["clock"]);
  o.integration = functions(o.integration, METHODS);
  o.renderer = functions(o.renderer, ["render", "click"]);
  o.config = fields(o.config, ["orgId", "datastreamId"]);
  if (!CASES.includes(o.case)
      || typeof o.runId !== "string" || !/^airlock05105-[a-f0-9]{32}$/.test(o.runId)
      || !Number.isInteger(o.eventIndex) || o.eventIndex < 1 || o.eventIndex > 1000
      || !Number.isInteger(o.timeoutMs) || o.timeoutMs < 1 || o.timeoutMs > 10000
      || !boundedString(o.config.orgId) || !boundedString(o.config.datastreamId)
      || typeof o.decisionScope !== "string"
      || !/^[A-Za-z0-9][A-Za-z0-9_.-]{0,99}$/.test(o.decisionScope)
      || FORBIDDEN_SCOPES.includes(o.decisionScope)
      || typeof o.pageUrl !== "string" || o.pageUrl.length > 253) throw "invalid_input";
  const url = new URL(o.pageUrl);
  const hostname = url.hostname;
  if (url.protocol !== "https:" || url.origin + "/" !== o.pageUrl
      || url.username || url.password || url.port || /^\d+(?:\.\d+){3}$/.test(hostname)
      || hostname.split(".").length < 2
      || hostname.split(".").some(label => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))
      || !/[a-z]/.test(hostname.split(".").at(-1))) throw "invalid_input";
  o.clock = Object.hasOwn(o, "clock") ? functions(o.clock, ["setTimeout", "clearTimeout"])
    : { setTimeout, clearTimeout };
  return o;
}

// Read only required SDK fields, never additive payloads/HTML/selector capabilities.
function dataField(value, key) {
  if (!value || typeof value !== "object") throw "invalid_proposition";
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (!descriptor || !Object.hasOwn(descriptor, "value")) throw "invalid_proposition";
  return descriptor.value;
}

function qualify(response, o) {
  const propositions = dataField(response, "propositions");
  if (!Array.isArray(propositions)) throw "invalid_proposition";
  if (o.case === "no-offer") {
    if (propositions.length !== 0) throw "invalid_proposition";
    return null;
  }
  if (propositions.length !== 1) throw "invalid_proposition";
  const p = dataField(propositions, "0");
  const id = dataField(p, "id");
  const scope = dataField(p, "scope");
  const scopeDetails = dataField(p, "scopeDetails");
  const items = dataField(p, "items");
  if (!boundedString(id) || scope !== o.decisionScope
      || dataField(scopeDetails, "decisionProvider") !== "TGT"
      || !Array.isArray(items) || items.length !== 1) throw "invalid_proposition";
  const item = dataField(items, "0");
  if (dataField(item, "id") !== "synthetic-item" || dataField(item, "schema") !== SCHEMA
      || dataField(dataField(item, "data"), "content") !== HTML) throw "invalid_proposition";
  return { proposition: p, identity: { id, scope, scopeDetails } };
}

function confirm(value, expected) {
  try {
    const actual = fields(value, Object.keys(expected));
    return Object.keys(expected).every(key => actual[key] === expected[key]);
  } catch {
    return false;
  }
}

/**
 * Fixed options contract is documented in slice-05's pre-test implementation note.
 * Every awaited invocation has its own 1–10000ms deadline. Timeout stops subsequent
 * harness calls, but cannot recall already dispatched SDK/host work.
 * Return only deeply frozen primitive evidence. No thrown object is inspected.
 */
export async function runStockJourney(input) {
  let o;
  try { o = validate(input); } catch {
    const invalid = report("invalid");
    invalid.overall = "invalid_input"; invalid.exit_code = 2;
    return freeze(invalid);
  }
  const out = report(o.case);
  const c = out.counts;
  const i = o.integration;
  let phase = "init";

  // No side-effecting continuation inside the raced operation; only the winning
  // await in this runner can advance the journey. Rejections are fixed categories.
  function wait(invoke, rejection) {
    return new Promise((resolve, reject) => {
      let settled = false;
      let timer;
      const finish = (ok, value) => {
        if (settled) return;
        settled = true;
        try { o.clock.clearTimeout(timer); } catch { reject("internal_failure"); return; }
        if (ok) resolve(value); else reject(value);
      };
      try { timer = o.clock.setTimeout(() => finish(false, "timeout"), o.timeoutMs); }
      catch { reject("internal_failure"); return; }
      if (settled) return;
      try {
        Promise.resolve(invoke()).then(value => finish(true, value), () => finish(false, rejection));
      } catch { finish(false, rejection); }
    });
  }

  function collect(kind, invoke, display = false) {
    c.attempted_collection++;
    if (o.case === "no-consent") {
      c.blocked_collection++;
      return undefined;
    }
    return invoke(() => {
      c[`${kind}_submissions`]++;
      if (display) c.display_submissions++;
    });
  }

  function decision(identity, event) {
    return { _experience: { decisioning: {
      propositions: [identity], propositionEventType: { [event]: 1 },
    } } };
  }

  try {
    out.phases.init = "running";
    await wait(() => {
      c.initializations++;
      return i.initMartech({
        ...o.config, edgeDomain: "edge.adobedc.net", defaultConsent: "pending", debugEnabled: false,
        thirdPartyCookiesEnabled: false, idMigrationEnabled: false, targetMigrationEnabled: false,
        clickCollectionEnabled: false, autoCollectPropositionInteractions: { AJO: "never", TGT: "never" },
      }, {
        analytics: true, personalization: true, performanceOptimized: true,
        personalizationTimeout: o.timeoutMs, trackPageView: false, dataLayer: true,
        includeDataLayerState: false, launchUrls: [], alloyInstanceName: "alloy",
        dataLayerInstanceName: "adobeDataLayer", decisionScopes: [o.decisionScope],
        shouldProcessEvent: payload => payload?.event === LINK,
      });
    }, "integration_rejected");
    out.phases.init = "complete";
    phase = "consent"; out.phases.consent = "running";
    const granted = o.case !== "no-consent";
    await wait(() => {
      c.consent_updates++;
      return i.updateUserConsent({ collect: granted, personalize: granted, marketing: false, share: false });
    }, "integration_rejected");
    out.phases.consent = "complete";
    phase = "eager"; out.phases.eager = "running";
    const personalization = { defaultPersonalizationEnabled: false, sendDisplayEvent: false };
    const response = await collect("fetch", count => wait(() => {
      count();
      // Alloy 2.31.1 scopes are TOP LEVEL, unlike newer nested SDK options.
      return i.sendEvent({
        type: "decisioning.propositionFetch", renderDecisions: false, decisionScopes: [o.decisionScope],
        personalization, xdm: { web: { webPageDetails: { name: "airlock-stock-local-v1", URL: o.pageUrl } } },
      });
    }, "integration_rejected"));
    let qualified = null;
    let rendered = false;
    if (granted) {
      try { qualified = qualify(response, o); } catch { throw "invalid_proposition"; }
      if (qualified) c.qualified_propositions++;
      if (o.case === "positive") {
        const ack = await wait(() => {
          c.render_attempts++;
          return o.renderer.render(qualified.proposition);
        }, "renderer_rejected");
        if (!confirm(ack, { visible: true, content: HTML })) throw "render_unconfirmed";
        c.render_confirmed++; rendered = true;
      }
    } else c.render_blocked++;
    const label = `${o.runId}-${o.case}-${o.eventIndex}`;
    await collect("page", count => wait(() => {
      count();
      return i.sendAnalyticsEvent({
        eventType: "web.webpagedetails.pageViews",
        web: { webPageDetails: { name: `${label}-page`, URL: o.pageUrl, pageViews: { value: 1 } } },
        ...(rendered ? decision(qualified.identity, "display") : {}),
      }, { __adobe: { analytics: { pageName: `${label}-page`, pageURL: o.pageUrl } } }, {});
    }, "integration_rejected"), rendered);
    out.phases.eager = granted ? "complete" : "blocked";
    phase = "lazy"; out.phases.lazy = "running";
    await wait(() => i.martechLazy(), "integration_rejected");
    if (granted) {
      const ack = await wait(() => {
        c.click_attempts++;
        return o.renderer.click({ rendered, proposition: qualified?.identity ?? null });
      }, "click_rejected");
      if (!confirm(ack, { clicked: true, target: rendered ? "offer-button" : "control-button" }))
        throw "click_unconfirmed";
      c.click_confirmed++;
    } else c.click_blocked++;
    // The pinned ACDL export returns VOID; the lazy listener does not return its
    // sendAnalyticsEvent promise. Only a synchronous submission/rejection is observable.
    collect("custom", count => {
      count();
      let returned;
      try {
        returned = i.pushEventToDataLayer(LINK, {
          web: { webInteraction: { name: `${label}-custom`, type: "other", linkClicks: { value: 1 } } },
        }, { __adobe: { analytics: { linkType: "o", linkName: `${label}-custom` } } }, {});
      } catch { throw "integration_rejected"; }
      if (returned !== undefined) {
        // Absorb invalid thenable rejection, not an acknowledgement or awaited receipt.
        Promise.resolve(returned).catch(() => {});
        throw "invalid_contract";
      }
    });
    if (rendered || !granted) {
      await collect("interaction", count => wait(() => {
        count();
        return i.sendEvent({
          type: "decisioning.propositionInteract", renderDecisions: false, personalization,
          xdm: decision(qualified.identity, "interact"),
        });
      }, "integration_rejected"));
    }
    out.phases.lazy = "complete";
    phase = "delayed"; out.phases.delayed = "running";
    await wait(() => i.martechDelayed(), "integration_rejected");
    out.phases.delayed = "complete";
  } catch (category) {
    const known = ["timeout", "integration_rejected", "renderer_rejected", "click_rejected",
      "invalid_proposition", "render_unconfirmed", "click_unconfirmed", "invalid_contract"];
    out.overall = known.includes(category) ? category : "internal_failure";
    out.exit_code = out.overall === "internal_failure" ? 3 : 1;
    out.phases[phase] = "failed";
  }
  return freeze(out);
}
