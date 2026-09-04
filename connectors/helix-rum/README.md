# helix-rum connector — airlock as your governed RUM authority

> Adopter contract for **replacing** the Adobe EDS `sampleRUM` tag with airlock. Read this
> before you switch a page from inline `sampleRUM` to `bootHelixRum`. It states — honestly —
> **what "replace" covers, what it does not, and the one gate that stands between the in-repo
> demonstration and a real production cutover.**
>
> Decisions of record: [helix-rum adoption: replace (core checkpoints)](../../docs/decisions/lightweight-decisions.md)
> · [RUM is a distinct governance class](../../docs/decisions/lightweight-decisions.md) ·
> [CWV via web-vitals](../../docs/decisions/lightweight-decisions.md) ·
> [governance exemplar, not full reproduction](../../docs/decisions/lightweight-decisions.md).

## What this connector is

The `helix-rum` connector makes airlock a **governed, off-main-thread RUM authority**. It emits the
**core** EDS RUM checkpoints natively and sends them to the same collector the AEM RUM pipeline reads:

| checkpoint | when | source |
|---|---|---|
| `top` | page load | `bootHelixRum` on boot |
| `error` | `error` / `unhandledrejection` / `securitypolicyviolation` | main-thread listeners |
| `cwv` | LCP / CLS / **INP at page-hide** | Google `web-vitals/attribution` (main-thread capture) |

**Governance class** (distinct from GA4/alloy — a deliberate decision, not an oversight):

- **Confined** — egress is pinned to `ot.aem.live` by the host endpoint ceiling; a compromised or
  misconfigured chamber **cannot** widen it (a re-pointed beacon is held at the seal).
- **NOT consent-gated** — RUM is performance telemetry with an **ephemeral per-page** id
  (`crypto.randomUUID().slice(-9)`, not a cross-site/persistent identifier) and no PII, so it fires
  regardless of consent — exactly as unmodified `sampleRUM` does. (Consent-gating it would collect
  *less* than the stock page and defeat the parity goal.)
- **Off-thread mapped** — all mapping + egress happen behind the airlock; the main thread only
  captures and enqueues. CWV is captured on the main thread (web-vitals needs real DOM/PerformanceObserver
  APIs) and its values feed the chamber.

## Three adoption modes — and why **replace** is the default

| mode | what runs | double-count? | governed? |
|---|---|---|---|
| **replace** (recommended) | airlock only; inline `sampleRUM` egress neutralized | **no** | **yes** |
| **feed** | airlock forwards into a still-present `sampleRUM` | no | partial |
| **coexist** | both airlock and inline `sampleRUM` fire | **yes** | partial |

**Replace** is the recommended default because it is the only mode that gives **one** governed
authority **without double-counting** the AEM pipeline. Feed and coexist remain available when a
deployment has a reason (e.g. it needs the enhancer's full checkpoint set — see the boundary below —
and only wants airlock to govern a subset).

## The honest boundary — what "replace" does NOT cover

**"Replace" covers the core checkpoints (`top`/`error`/`cwv`) only.** It does **NOT** reproduce the
rum-enhancer's **interaction/lifecycle** checkpoint set:

> `click` · `viewblock` · `viewmedia` · `enter` · `leave` · `navigate` · `formsubmit` · `missingresource` · … (an evolving, plugin-extended set)

airlock deliberately does **not** chase full native parity with Adobe's enhancer (a large, evolving
surface — the wrong bet for a *governance* runtime; see the 2026-09-01 "governance exemplar"
decision). Those checkpoints are **deferred** to either:

- the future **worker-dom compatibility layer** (host the real enhancer off-thread and govern its
  egress/mutations), or
- a **community-contributed** connector.

**If your deployment needs the interaction/lifecycle checkpoints today, do not replace** — keep
`sampleRUM` (coexist), or wait for the compat layer. Replacing will silently stop collecting them.

## Before a real production cutover — the creds-gated live gate

**The in-repo demonstration is not a live verification.** The 030-03 rig proves the *page-side*
story — exactly one governed beacon per checkpoint, no double-count — with `ot.aem.live`
**network-stubbed** (hermetic). It does **not** prove the live collector accepts airlock's payload.

> **HARD GATE (never verified live):** airlock's `cwv` beacon is a **superset** of the stock
> enhancer's — it carries the `web-vitals/attribution` build's extra fields (LCP element + sub-part
> timings, CLS shift sources, INP interaction target). A real cutover **must first confirm the live
> `ot.aem.live` collector accepts that superset shape** (extra fields tolerated, not rejected/truncated
> in a way that breaks the pipeline). This requires collector credentials/access and has **not** been
> checked. Treat "replace is demonstrated" as *page-side demonstrated*, not *live-verified*.

Until that check passes for your environment, run **coexist** (accept the temporary double-count) or
stay on `sampleRUM`.

## The integrator drop-in path (sampleRUM → bootHelixRum)

Airlock does not auto-disable `sampleRUM`; the integrator neutralizes it and boots airlock. The
mechanism the testbed uses (see `probes/eds-testbed/`, spec 030-03):

1. **Neutralize inline `sampleRUM`'s egress.** `sampleRUM` funnels every checkpoint through one
   `sampleRUM.sendPing`. Guard it so airlock owns RUM — in `aem.js`, at the top of `sendPing`:

   ```js
   sampleRUM.sendPing = (ck, time, pingData = {}) => {
     if (window.__airlockOwnsRum) return; // airlock owns RUM — no inline egress (no double-count)
     // …unchanged…
   };
   ```

   Set the flag **before `aem.js` loads** (its `init()` fires the inline `top` at import time) — a
   nonce'd inline `<script>` in `head.html` / the page `<head>`:

   ```html
   <script nonce="aem">window.__airlockOwnsRum = true;</script>
   ```

   (The testbed gates this on `?rum=airlock` for an opt-in demonstration; a production integrator sets
   it unconditionally.)

2. **Boot airlock's RUM** from `scripts.js` (or wherever analytics boots), guarded by the same flag:

   ```js
   if (window.__airlockOwnsRum) {
     const { bootHelixRum } = await import('./airlock/eds.js');
     bootHelixRum(); // top on load + error listeners + CWV (incl. INP at page-hide)
   }
   ```

   `bootHelixRum(opts)` accepts: `collectBaseURL` (default `https://ot.aem.live`), `rate`
   (`on`/`high`/`medium`/`low`) **or** `weight` (direct), and `referer` (defaults to
   `document.referrer`). It returns a handle (`{ push, pushCritical, setConsent, getState, flushNow,
   stats, dispose, sampled }`); an unsampled page-load returns an inert handle and emits nothing
   (`sampleRUM` parity).

**Sampling parity note.** `bootHelixRum` mints the per-page sampling `{ weight, id, isSelected }`
**once on the main thread** and hands it to the worker connector, the endpoint ceiling, and the
page-hide unload mapper — so all three agree (main↔worker use the same `id`, and the endpoint ceiling
byte-matches the connector's `rumUrl(base, weight)`; a mismatch would ceiling-hold every beacon). The
testbed demonstration uses `forceSelect: true` to make the sample deterministic — that is a
**testbed-only** seam, not for production (production honors the real sampling weight).

## Files

- [`connector.js`](connector.js) — `createHelixRumConnector` (the chamber-hosted connector).
- [`map.js`](map.js) — `mapToRum` (checkpoint → RUM wire shape), `rumUrl`, `resolveWeight`.
- [`cwv-capture.js`](cwv-capture.js) — `startCwvCapture` (main-thread web-vitals subscription, DI seam).
- `bootHelixRum` lives in [`adapters/eds/index.js`](../../adapters/eds/index.js) (the page adapter).
