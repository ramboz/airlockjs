#!/usr/bin/env node
/**
 * Local invented fixtures ONLY. No credentials, file inputs, environment hooks,
 * SDK imports, transport interface or network. This executable cannot go live.
 */
import { runStockJourney } from "./stock-harness.mjs";

const CASES = ["positive", "no-consent", "no-offer", "non-render"];
const HTML = '<p>Local stock fixture</p><button type="button">Fixture click</button>';
const argv = process.argv.slice(2);

if (argv.length === 1 && argv[0] === "--help") {
  process.stdout.write("Stock local fixture only: --case <positive|no-consent|no-offer|non-render> | --help\n");
} else {
  const valid = argv.length === 2 && argv[0] === "--case" && CASES.includes(argv[1]);
  let result;
  if (!valid) {
    // Reuse the harness's fixed empty failure shape; do not copy any CLI value.
    const invalid = await runStockJourney(null);
    result = Object.freeze({ ...invalid, overall: "invalid_invocation", exit_code: 2 });
  } else {
    const caseName = argv[1];
    const proposition = {
      id: "synthetic-proposition", scope: "fixture.scope",
      scopeDetails: { decisionProvider: "TGT" },
      items: [{
        id: "synthetic-item", schema: "https://ns.adobe.com/personalization/html-content-item",
        data: { content: HTML },
      }],
    };
    // A tiny stateful invented host and integration, not a loaded Alloy simulator.
    let configured = false, consent = false, lazy = false, plugin, visible = false;
    const integration = {
      async initMartech(_webSDKConfig, martechConfig = {}) {
        if (configured) throw null;
        configured = true; plugin = martechConfig;
      },
      async updateUserConsent(value) {
        if (!configured) throw null;
        consent = value.collect && value.personalize;
      },
      async sendEvent(payload) {
        if (!configured || !consent) throw null;
        return payload.type === "decisioning.propositionFetch"
          ? { propositions: caseName === "no-offer" ? [] : [proposition] } : {};
      },
      async sendAnalyticsEvent(_xdmData, _dataMapping = {}, _configOverrides = {}) {
        if (!configured || !consent) throw null;
        return {};
      },
      pushEventToDataLayer(event, xdm, data, configOverrides) {
        if (!lazy || !consent) throw null;
        if (plugin.shouldProcessEvent({ event, xdm, data, configOverrides }))
          void integration.sendAnalyticsEvent({ eventType: event, ...xdm }, data, configOverrides);
      },
      async martechLazy() {
        if (!configured) throw null;
        lazy = true;
      },
      async martechDelayed() {
        if (!configured || plugin.launchUrls.length !== 0) throw null;
      },
    };
    result = await runStockJourney({
      integration, case: caseName, runId: "airlock05105-" + "a".repeat(32), eventIndex: 1,
      pageUrl: "https://fixture.invalid/", decisionScope: "fixture.scope",
      config: { orgId: "invented-org", datastreamId: "invented-stream" }, timeoutMs: 1000,
      renderer: {
        async render(p) {
          if (p.items[0].data.content !== HTML) throw null;
          visible = true;
          return { visible, content: HTML };
        },
        async click(binding) {
          if (!lazy || binding.rendered !== visible) throw null;
          return { clicked: true, target: visible ? "offer-button" : "control-button" };
        },
      },
    });
  }
  process.stdout.write(JSON.stringify(result) + "\n");
  if (result.exit_code) process.stderr.write(result.overall + "\n");
  process.exitCode = result.exit_code;
}
