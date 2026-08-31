# Inbox

> Status: Draft (wizard-generated)
>
> Thin capture layer for unresolved ideas, observations, and items that surfaced during
> sessions but aren't ready for a spec. Triage during reconciliation or session end:
> (a) promote to a spec, (b) promote to an ADR, (c) drop.
>
> This is NOT a task list. Items here are parked thoughts, not committed work.

<!-- Add items below. Format: - [date] description -->

- [2026-08-31] **Real customer prod martech stack captured as the breadth-validation benchmark** → [R-007](research/R-007-real-prod-stack-breadth.md). 21 tools classified by airlock-fit: ~14 fit the two proven archetypes (wire-protocol/pixel + wrapped-SDK), forms + a OneTrust consent driver are new patterns, and session-replay/chat/identity/RUM are architecturally excluded by design. Feeds the MVP5 breadth Split + the post-MVP5 connector roadmap. Open decisions parked in R-007: a generic **pixel** connector archetype (the big leverage win, ~10 vendors), **Segment** host-vs-replace, **mPulse** host-vs-subsume-into-airlock-diagnostics.
