# Delivery plan

Keep the normal localhost path unchanged. Add one default-off exact live-test
binding through the prototype adapter, connector and worker, then one narrow
entry using the existing fixture. No cookie authority or stable-core change.

Source permission covers targeted SDK-free work only. Use a fresh isolated
`gpt-6.1-terra` implementer and fresh explicitly pinned `gpt-6.1-sol` reviews.
Start with failing policy/consent/opaque/budget tests, implement the worker and
host changes, then run the owning regression selectors and changed-file ESLint.

Use the owner-corrected `mode: "cors"` with `redirect: "error"`. Real SDK-free
browser tests must cover readable CORS and denied response access after one
intercepted request. The original no-CORS/forbidden-redirect combination did
not dispatch in Chromium; do not restore it or allow redirects as a workaround.

Allowed source files:
`adapters/meta-pixel-prototype.js`,
`connectors/meta-pixel/pageview-prototype.js`,
`connectors/meta-pixel/pageview-prototype.worker.js`,
new `rig/meta-live-delivery.mjs` and directly owning tests. Reuse fixture/recorder
resources; adjust import closure only if directly necessary.

After source review, stop for the selected Pixel's owner-operated Test Events
URL/time readback and separate exact live grant. The slice's numbered criteria
define the one-send budget, observation limits and cleanup. Source-only passes
cannot close the receipt criterion. No automatic retry, SDK run or successor.

## 063-02: owned-site source increment

The owner approved the separate session plan for one inert owned-page entry,
actual test-consent wiring and explicit one-shot arming. Its exact source
contract is in `slice-02-owned-site-poc.md`. Keep the old localhost binding
unchanged and add a separate owned-document/window binding. Stage only the
entry and separately bundled adapter/worker in the isolated site checkout.
Use witnessed tests first, a fresh isolated native Terra writer and fresh
pinned Sol reviews. No remote write, deployment or live action is included.

## 063-03: automatic page-load trial

Reuse the owned entry and one-shot arm internally after the actual initial
site consent signal. Fetch one fixed site-owned JSON file only on eligible
pages. Publish it disabled, then activate one exact document and short window
for one controlled page visit; the operator does not arm or inject the Pixel.
The existing public Pixel is allowed only in site configuration, not Airlock
source or logs. Preserve the old worker/host policy and manual behavior.

Use a fresh isolated native Terra writer and fresh pinned Sol source reviews,
then decoded-byte publication checks, one automatic trial and a forward
config-disable commit/readback. No positive retry or global visitor ledger.
Source-only evidence cannot close the slice's trial/final-disable criteria.
