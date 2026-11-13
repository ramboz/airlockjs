---
status: READY_FOR_IMPLEMENTATION
dependencies: []
last_verified: 2026-11-13
---

## Slice 066-01: MT1, close the command, field and request inventory

**Goal:** The command, field and request inventory (spec 066 sections 2.1 to 2.4) is closed from the retained fbevents.js runtime and `signals/config` bytes, with every flag and plugin the config enables listed and the 058-02 bytes located. Read-only: it touches no vendor and runs nothing live.

**DoR:**
- Spec 066 approved by the owner as amended (O1, 2026-11-13).
- The retained bytes (058-02, spec 060, 2026-10-16) are readable from the private store. Pins: runtime `d4487bcc…` (declares 2.9.426), config `b1720ebb…` (spec 066 section 1).

**Acceptance Criteria:**

1. Every `fbq` command, event-data key, request and response shape in the retained runtime has a row in 2.1 to 2.3, with its source location in the bytes. A row not found in the bytes is marked as docs-only.
2. Every request field has a class (fixed, generated, input-derived, server-context-derived, volatile or `unknown`) per 2.4, and every request has a request-level class. `unknown` and `mixed` are allowed until the freeze and listed.
3. Every flag, plugin and setting shape in the retained config is listed with the candidate state it would need (feeds 066-02 and SET1 to SET9).
4. The location of the retained 058-02 bytes and their digests are recorded so CAP's drift probe (4.1) can compare against them. The bytes themselves are not committed.
5. No network call, no capture, no production-site probe. Reading repo and private-store bytes only.

**DoD:**
- Section 2 of spec 066 updated with a dated note listing what changed. `npm test && npm run lint` and the servo quality-gate pass.
- Open `unknown` rows are listed for the capture session to resolve.

**Consumers:** 066-03 (MT0) and 066-04 (CAP) take the field and request lists as their checklist.

**Status note (2026-11-13): blocked, DoR item 2 unmet. Do not pick this slice up until the owner supplies the handle.** The retained 058-02 bytes (runtime `d4487bcc…`, config `b1720ebb…`) were not supplied. Spec 066 and spec 060 name no store path, spec 060 forbids committing one and forbids filesystem discovery, and the digests appear only in committed docs, so no discovery was attempted beyond checking that the repository holds only docs for those digests. Nothing was run or fetched. Needed from the owner: the private-input handle for the two retained files and their 058-02 manifest. The slice stays READY_FOR_IMPLEMENTATION in jig (it has no blocked status).

**Anti-horizontal-phasing check:** A read-only inventory task. It ends with a committed, reviewable list, not a layer.
