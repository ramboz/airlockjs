---
slice: 026-05 — live-shippability: the `pixel-chamber.worker.js` bundle entry + N-worker build assertion
pass: craft
verdict: pass
reviewer: jig:reviewer (independent)
reviewed_at: 2026-09-03T02:07:05Z
prompt_source: review.py pr-review
substrate: non-interactive
---

Craft (026-05) — PASS, no blockers. The N-worker generalization is correct + verified against the emitted eds.js:
matchAll captures exactly the two real specifiers, each checked known-and-emitted, blob/data scanned across entry +
all worker chunks; all realistic breakage (dropped entry, hashed rename, a new unlisted worker) produces a loud BUILD
failure; the GA4 default path is preserved byte-for-byte. Path derivations (workerOut, EXPECTED_WORKER_SPECIFIERS,
spec.replace) internally consistent. Strengths: derived-not-hardcoded (one source list → adding a worker is one line);
the header comment accurately states what's bundled + why dom-chamber is excluded + both CSP directions. Nits (applied
or dispositioned): the regex scans raw emitted text incl. preserved comments — the airlock.js grep-trap literal was
statement-leading (esbuild-stripped, absent from eds.js), and the close-out REMOVED that trap literal at the source;
the /\bblob:|\bdata:/ substring check anchored to a URL context (["'`]-prefixed scheme) to avoid a future {data:} object-key
false-fail; the redundant emit-check branch + the derived-signal tautology kept as harmless defensive/documentary code.
