// The enforcement inspector's drop-in dev panel — spec 028-03 (MVP5 fixed core, closes 028).
//
// A lightweight, LOCAL, drop-in view over the inspector collector (028-01) and its
// per-beacon chains (028-02). No remote/hosted trace backend, no account (MVP5 no-gos).
// Split for testability in a no-jsdom repo: a PURE view-model (`inspectorModel`) and a
// thin DOM mount (`renderInspectorPanel`) that renders via createElement + textContent —
// XSS-safe by construction (values are text nodes, NEVER innerHTML), so a diagnostic
// `reason` carrying markup renders as inert text.
//
// Zero interaction-path cost: the panel reads the collector via `query()` on a render
// call ONLY — never on capture / push() / the projection fold. It is pull, on demand.

/**
 * Pure view-model over the collector's records: groups by beacon into ordered chains,
 * lists un-correlated records, and counts by disposition.
 * @param {{ query: Function } | object[]} source - an inspector collector, or a record array.
 * @param {{ kind?: string, disposition?: string, purpose?: string, beaconId?: string }} [filter]
 * @returns {{ beacons: Array<{ beaconId: string, destination?: string, chain: Array<{kind?: string, disposition?: string, reason?: string}> }>, loose: object[], counts: { total: number, byDisposition: Record<string, number> } }}
 */
export function inspectorModel(source, filter) {
  const records =
    source && typeof source.query === "function"
      ? source.query(filter)
      : Array.isArray(source)
        ? source
        : [];
  const beacons = new Map(); // insertion order = first-seen (emission) order
  const loose = [];
  const byDisposition = {};
  let total = 0; // count only the VALID records we actually grouped (not raw input length — a direct-array caller could pass nulls)
  for (const r of records) {
    if (!r || typeof r !== "object") continue;
    total += 1;
    const disp = r.disposition || "(none)";
    byDisposition[disp] = (byDisposition[disp] || 0) + 1;
    if (r.beaconId != null && r.beaconId !== "") {
      if (!beacons.has(r.beaconId)) {
        beacons.set(r.beaconId, { beaconId: r.beaconId, destination: r.destination, chain: [] });
      }
      const b = beacons.get(r.beaconId);
      if (b.destination == null && r.destination != null) b.destination = r.destination; // backfill a null/undefined destination
      b.chain.push({ kind: r.kind, disposition: r.disposition, reason: r.reason });
    } else {
      loose.push({ ...r });
    }
  }
  return { beacons: [...beacons.values()], loose, counts: { total, byDisposition } };
}

// Clear a container without innerHTML (which the shim + real DOM both support here).
function clear(el) {
  if (typeof el.replaceChildren === "function") el.replaceChildren();
  else while (el.lastChild) el.removeChild(el.lastChild);
}

/**
 * Mount the panel into `el`. No-op (never throws) if `el` or a document is missing — a
 * dev tool must not crash the page. Returns the rendered model (handy for callers/tests).
 * @param {object} el - a container element (real or the repo's fakeEl shim).
 * @param {{ query: Function } | object[]} collector
 * @param {{ filter?: object, doc?: Document }} [opts]
 */
export function renderInspectorPanel(el, collector, opts = {}) {
  if (!el || typeof el.appendChild !== "function") return null;
  const doc = opts.doc || (typeof document !== "undefined" ? document : null);
  if (!doc || typeof doc.createElement !== "function") return null;

  const model = inspectorModel(collector, opts.filter);
  clear(el);

  const line = (parent, text, cls) => {
    const div = doc.createElement("div");
    div.textContent = text; // TEXT node — never innerHTML: values render inert
    if (cls && typeof div.setAttribute === "function") div.setAttribute("data-role", cls);
    parent.appendChild(div);
    return div;
  };

  // Header: total + per-disposition counts.
  const dispParts = Object.keys(model.counts.byDisposition)
    .sort()
    .map((d) => `${d}:${model.counts.byDisposition[d]}`)
    .join(" ");
  line(el, `airlock inspector — ${model.counts.total} decision(s)${dispParts ? ` [${dispParts}]` : ""}`, "header");

  if (model.counts.total === 0) {
    line(el, "no enforcement decisions this session", "empty");
    return model;
  }

  // One section per beacon chain.
  for (const b of model.beacons) {
    const section = doc.createElement("section");
    if (typeof section.setAttribute === "function") section.setAttribute("data-role", "beacon");
    line(section, `beacon ${b.beaconId}${b.destination ? ` → ${b.destination}` : ""}`, "beacon-head");
    for (const step of b.chain) {
      line(section, `  ${step.kind} ${step.disposition}${step.reason ? ` — ${step.reason}` : ""}`, "step");
    }
    el.appendChild(section);
  }

  // Un-correlated records.
  if (model.loose.length) {
    const section = doc.createElement("section");
    if (typeof section.setAttribute === "function") section.setAttribute("data-role", "loose");
    line(section, `un-correlated (${model.loose.length})`, "loose-head");
    for (const r of model.loose) {
      const label = `${r.kind || "?"} ${r.disposition || ""}`.trim();
      line(section, `  ${label}${r.reason ? ` — ${r.reason}` : ""}`, "loose-item");
    }
    el.appendChild(section);
  }

  return model;
}
