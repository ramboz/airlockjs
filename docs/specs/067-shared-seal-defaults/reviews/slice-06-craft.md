---
slice: 067-06: Limits never drop or delay stock output by default
pass: craft
verdict: pass
reviewer: claude-opus-5.5:jig:reviewer
reviewed_at: 2026-11-14T00:28:42Z
prompt_source: jig:reviewer-agent
---

Round 1 verdict was needs-changes. MEDIUM: `used` only grew in `createCriticalDispatcher`: fixed (released on settle). LOW: an opt-in budget above 64 KiB never fired: fixed (opt-in budget counts all bytes in a separate total). LOW: budget check ran before the ceiling check and mislabelled off-ceiling drops: fixed (ceiling first). LOW: AC6 test does not assert the oldest entry is the one dropped (the 067-02 test pins that) and the unload burst runs with no critical types: noted, not changed.
