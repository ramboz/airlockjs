import { fail, hash, utc } from "./contract.mjs";

const schema = condition => { if (!condition) fail("schema_error"); };
const match = condition => { if (!condition) fail("scope_mismatch", "blocked"); };
const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
// eslint-disable-next-line no-control-regex -- explicitly reject control characters in consumed API scalars
const nonempty = value => typeof value === "string" && value.length > 0 && !/[\u0000-\u001f\u007f]/u.test(value);
const integer = value => Number.isSafeInteger(value) && value >= 0;
const id = value => { schema(Number.isSafeInteger(value) && value > 0); return String(value); };
function collection(value, limit) {
  schema(Array.isArray(value));
  if (value.length > limit) fail("limit_exceeded");
}
function strings(value) {
  schema(Array.isArray(value) && value.every(nonempty));
  schema(new Set(value).size === value.length);
}
export function checkResponseError(body) {
  schema(object(body));
  if (body.errorCode !== undefined || body.errors !== undefined) {
    const codes = [];
    if (body.errorCode !== undefined) { schema(nonempty(body.errorCode)); codes.push(body.errorCode); }
    if (body.errors !== undefined) {
      schema(Array.isArray(body.errors));
      for (const error of body.errors) { schema(object(error) && nonempty(error.errorCode)); codes.push(error.errorCode); }
    }
    for (const code of codes) {
      if (["Forbidden", "forbidden", "access_denied"].includes(code)) fail("access_denied", "blocked");
      if (["unauthorized", "invalid_token"].includes(code)) fail("authentication_rejected", "blocked");
      if (["rate_limit_exceeded", "too_many_requests"].includes(code)) fail("rate_limited");
      if (["invalid_request", "metric_not_available"].includes(code)) fail("request_contract_error");
    }
    if (codes.length) fail("schema_error");
  }
}
export function validateResponse(operation, body, context) {
  const { input, limits, start, deadline, offer } = context;
  const s = input.selectors, t = s.target;
  checkResponseError(body);
  switch (operation) {
    case "ims.token":
      schema(nonempty(body.access_token) && typeof body.token_type === "string" && body.token_type.toLowerCase() === "bearer" &&
        Number.isSafeInteger(body.expires_in) && body.expires_in > 0);
      if (body.expires_in * 1000 <= deadline - start) fail("stale_evidence");
      return body.access_token;
    case "analytics.discovery": {
      collection(body.imsOrgs, limits.max_items);
      let count = body.imsOrgs.length, pairs = 0;
      for (const org of body.imsOrgs) {
        schema(object(org) && nonempty(org.imsOrgId));
        collection(org.companies, limits.max_items);
        count += org.companies.length;
        if (count > limits.max_items) fail("limit_exceeded");
        for (const company of org.companies) {
          schema(object(company) && nonempty(company.globalCompanyId));
          if (org.imsOrgId === s.ims_org_id && company.globalCompanyId === s.global_company_id) pairs++;
        }
      }
      if (body.next || body.nextPage) fail("partial_enumeration");
      if (pairs > 1) fail("schema_error");
      match(pairs === 1);
      return;
    }
    case "analytics.suite": {
      schema(nonempty(body.rsid) && nonempty(body.currency) && nonempty(body.timezoneZoneinfo));
      match(body.rsid === s.report_suite_id);
      let formatter;
      try {
        formatter = new Intl.DateTimeFormat("en-CA", { timeZone: body.timezoneZoneinfo, year: "numeric", month: "2-digit", day: "2-digit",
          hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
      } catch { fail("schema_error"); }
      const parts = Object.fromEntries(formatter.formatToParts(start).map(part => [part.type, part.value]));
      const local = `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
      if (input.report_window.end >= local || input.report_window.start >= local) fail("invalid_configuration");
      return;
    }
    case "analytics.reporting":
      schema(object(body.summaryData) && Array.isArray(body.summaryData.totals) && body.summaryData.totals.length === 1 &&
        typeof body.summaryData.totals[0] === "number" && Number.isFinite(body.summaryData.totals[0]) && body.summaryData.totals[0] >= 0);
      if (body.rows !== undefined) {
        schema(Array.isArray(body.rows));
        if (body.rows.length) fail("partial_response");
      }
      if (body.columns !== undefined) {
        schema(object(body.columns));
        if (body.columns.columnErrors !== undefined) {
          schema(Array.isArray(body.columns.columnErrors));
          if (body.columns.columnErrors.length) fail("partial_response");
        }
      }
      return;
    case "target.environment":
      match(id(body.id) === t.environment_id);
      schema(typeof body.default === "boolean" && typeof body.serveInactiveActivities === "boolean");
      if (body.default || body.serveInactiveActivities) fail("unsafe_configuration", "blocked");
      return;
    case "target.property":
      match(id(body.id) === t.property_id);
      schema(nonempty(body.channel)); strings(body.workspaces); schema(nonempty(body.token));
      match(body.channel === "web" && body.workspaces.length === 1 && body.workspaces[0] === t.workspace_id);
      return body.token;
    case "target.properties": {
      schema(integer(body.total));
      collection(body.properties, limits.max_items);
      const ids = new Set();
      let selected = 0, assigned = 0, omitted = false, wrongSelectedScope = false;
      for (const property of body.properties) {
        schema(object(property));
        const propertyId = id(property.id);
        if (ids.has(propertyId)) fail("partial_enumeration");
        ids.add(propertyId);
        if (!Object.hasOwn(property, "workspaces") && propertyId !== t.property_id) {
          // Absence is unknown, not []; continue scanning for explicit scope conflicts.
          omitted = true;
          continue;
        }
        strings(property.workspaces);
        if (propertyId === t.property_id) {
          selected++;
          wrongSelectedScope = property.workspaces.length !== 1 || property.workspaces[0] !== t.workspace_id;
        }
        if (property.workspaces.includes(t.workspace_id)) assigned++;
      }
      if (body.total !== ids.size || selected !== 1 || body.next || body.nextPage || body.nextPageToken ||
          body.hasMore === true || body.truncated === true) fail("partial_enumeration");
      match(!wrongSelectedScope && assigned === 1);
      // Private structural result only: no raw API rows or inferred assignments reach reports.
      return { assignmentsComplete: !omitted };
    }
    case "target.activity": {
      match(id(body.id) === t.activity_id);
      schema(nonempty(body.workspace)); match(body.workspace === t.workspace_id);
      schema(Array.isArray(body.propertyIds));
      const properties = body.propertyIds.map(id);
      match(properties.length === 1 && properties[0] === t.property_id);
      schema(nonempty(body.state) && Number.isFinite(utc(body.startsAt)) && Number.isFinite(utc(body.endsAt)));
      if (body.state !== "saved" || utc(body.startsAt) <= start || utc(body.endsAt) <= utc(body.startsAt)) {
        fail("unsafe_configuration", "blocked", "restore_inactive_fixture");
      }
      schema(object(body.locations));
      collection(body.locations.mboxes, limits.max_items);
      const locationIds = new Set();
      for (const location of body.locations.mboxes) {
        schema(object(location) && integer(location.locationLocalId) && nonempty(location.name));
        schema(!locationIds.has(location.locationLocalId)); locationIds.add(location.locationLocalId);
        match(location.name === t.decision_scope);
      }
      match(locationIds.size === 1);
      collection(body.options, limits.max_items);
      const optionIds = new Map(), offers = [];
      for (const option of body.options) {
        schema(object(option) && integer(option.optionLocalId) && !optionIds.has(option.optionLocalId));
        const offerId = id(option.offerId); optionIds.set(option.optionLocalId, offerId); offers.push(offerId);
      }
      match(offers.length === 2 && new Set(offers).size === 2 && offers.every(value => t.offers.some(item => item.id === value)));
      collection(body.experiences, limits.max_items);
      const experiences = new Set(), resolvedOffers = new Set();
      schema(body.experiences.length > 0);
      for (const experience of body.experiences) {
        schema(object(experience) && integer(experience.experienceLocalId) && !experiences.has(experience.experienceLocalId));
        experiences.add(experience.experienceLocalId);
        collection(experience.optionLocations, limits.max_items);
        schema(experience.optionLocations.length > 0);
        for (const link of experience.optionLocations) {
          schema(object(link) && integer(link.locationLocalId) && integer(link.optionLocalId));
          match(locationIds.has(link.locationLocalId) && optionIds.has(link.optionLocalId));
          resolvedOffers.add(optionIds.get(link.optionLocalId));
        }
      }
      match(resolvedOffers.size === 2);
      return;
    }
    case "target.offer":
      match(id(body.id) === offer.id);
      schema(nonempty(body.workspace) && typeof body.content === "string");
      match(body.workspace === t.workspace_id && hash(body.content) === offer.content_sha256);
      return;
    case "site.status":
      schema(typeof body.webPath === "string" && object(body.preview) && Number.isSafeInteger(body.preview.status) && nonempty(body.preview.url));
      match(body.webPath === "/" && body.preview.url === s.site.preview_origin + "/");
      if (body.preview.status !== 200) fail(body.preview.status === 403 ? "access_denied" : "transport_failure", body.preview.status === 403 ? "blocked" : "unverified");
      if (body.live !== undefined) {
        schema(object(body.live));
        if (body.live.url !== undefined) {
          schema(nonempty(body.live.url));
          match(body.live.url === s.site.preview_origin.replace(".aem.page", ".aem.live") + "/");
        }
      }
      return;
    default: fail("internal_failure");
  }
}
