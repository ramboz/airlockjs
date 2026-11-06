---
slice: 059-15 - Exact native policy and one-shot stock capture
pass: frame-critique
verdict: pass
reviewer: jig:reviewer (gpt-6.1-sol; 1466dd36-7ec0-42e3-ac00-1a0558cf640b)
reviewed_at: 2026-11-06T00:26:54Z
prompt_source: review.py frame-critique; google-guard-release-frame-prompt.txt; bounded experiment only
---

Reviewer: jig:reviewer, explicitly pinned gpt-6.1-sol
Agent: 1466dd36-7ec0-42e3-ac00-1a0558cf640b
Pass: frame-critique, 059-15 renewed guard-release experiment
Prompt: google-guard-release-frame-prompt.txt
Scope: proposed bounded experiment, before TLS-broker implementation.

VERDICT: pass

REASONING:
The highest-risk assumption is that every TCP route reachable by surviving Chrome work either authenticates the case broker before CONNECT or is independently denied. The retained source research supports HTTPS proxies and one WebRTC TCP route, not exhaustive coverage; a fresh hostname and additive SPKI exception alone cannot establish that boundary. The proposal survives as a bounded experiment because it explicitly preserves these unknowns, blocks on substitution or unclosed routes, and retains the wall stop at 2026-11-06T02:04:58Z. This is not candidate selection, qualification or native-admission readiness.

SPECIFIC ISSUES:
- docs/specs/059-google-ads-full-compatibility/plan.md:87-105: Outstanding condition, not a framing blocker: establish source-backed closure of every reachable surviving TCP route, then corroborate it with matched same-port substitution controls witnessing actual post-stop attempts. If an available direct/loopback route bypasses proxy TLS, a replacement listener can receive application bytes regardless of broker hostname or key. Require that route to be independently denied, and require the defeated control to demonstrate receiver delivery; an unchanged original-broker snapshot proves nothing about the replacement listener.

RECONCILIATION NOTES:
No deviation established by this framing review. Preserve candidate-unselected/unqualified status, unknown/manual descendant cleanup and closed native admission.
