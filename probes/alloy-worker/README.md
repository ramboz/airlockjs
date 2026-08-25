# Probe: Alloy in a Web Worker

Executable probe for
[R-004](../../docs/research/R-004-alloy-in-worker.md) — **findings live in
the note**; this directory is only the harness. Grounds
[ADR-0001](../../docs/decisions/adr-0001-chamber-isolation-strength.md).

## Method

`@adobe/alloy@2.35.0`, unmodified `dist/alloy.js`, loaded via
`importScripts` in a classic Web Worker ([worker.js](worker.js)) against
instrumented shim globals installed before load:

- `window` / `document` / `navigator` / `screen` as logging Proxies (every
  unstubbed access recorded);
- in-memory `sessionStorage` / `localStorage`;
- `document.cookie` backed by a **synchronous in-worker string cache** seeded
  from the main thread, every write mirrored asynchronously to the real
  `document.cookie` ([index.html](index.html)) — the "sync-cache + async
  write-back" shim under test;
- `fetch` stubbed to log egress and return a minimal Edge Network response
  (`identity:result` + `state:store`) so the identity round-trip completes
  offline.

Boot sequence: base-code queue snippet → load bundle →
`configure({datastreamId, orgId, context: [], debugEnabled: true})` →
`sendEvent({renderDecisions: false, xdm: {pageView}})`.

## Reproduce

```bash
npm install
node server.mjs   # http://localhost:8117/
```

Open the page; the summary (cookie access log with stacks, storage use,
egress payloads, unstubbed-global list) renders on-page and in
`window.__SPIKE_RESULT__`.
