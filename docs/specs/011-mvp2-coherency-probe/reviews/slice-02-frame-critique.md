---
slice: 011-02 — out-of-band write coherency
pass: frame-critique
verdict: pass
reviewer: jig:reviewer (frame-critique subagent, 4 rounds)
reviewed_at: 2026-08-28T17:16:39Z
prompt_source: review.py frame-critique
---

Frame-critique (adversarial, pre-implementation) — 011-02 out-of-band.

Final verdict PASS after 4 rounds. The detection premise (broker learns of a
foreign same-document / second-tab write via cookieStore `change`) is exactly
what the spike MEASURES, not a premise it rests on — a detect miss degrades to
the documented document.cookie-polling fallback (R-006 F3) or the drive/detect
kill-criteria clause. Prior rounds corrected two real flaws: a same-site→cross-site
threat inversion (round 3), then the recognition that BOTH network Set-Cookie
variants are negative boundaries — the identity cookie is only ever JS-written
(R-004), so the positive out-of-band sources are a foreign main-thread script +
a second tab (round 3 final; AC2 fixed from broker-write to foreign-script). DoD
aligned to "driven or detected."
