---
status: READY_FOR_IMPLEMENTATION
dependencies: [065-01, 065-02, 065-03, 065-04]
last_verified: 2026-11-13
---

## Slice 065-05: CAP: Capture session

**Goal:** Run the one capture session of section 4 and freeze the inventory. This is the only slice that runs vendor calls, and only after the owner's go.

**DoR:**
- T1 to T3 and G0 done. The shared tooling 064-03 is on main. The 067 main slices for the consent hold and warning (067-02) and transport and limits (067-06) are on main.
- Owner decisions D1 to D3 answered (done). D7: the peer domain name (`<PEER-DOMAIN-TBD>`) is given one working day before CAP. D8: the console check of enhanced conversions, website calls and new-customer acquisition is done early in the settings window, so S9 and S10 are re-planned (or `blocked: account-ineligible`) before CAP starts.
- Adobe's EEA exit is up for both Google days (D2). The settings window is about 3 hours on the same day as the Adobe window, hard cap 4, with a pre-authorised second window of up to 2 hours (D3).

**Acceptance Criteria:**

1. Run order of 4.7 is followed: drift probe A, positive control, drift probe B, agent-only states, the owner settings window, a restore step, then day 2.
2. Every recording has its stored-input manifest and the script digest. The credential check passes before each commit.
3. The corpus stays within 150 recordings (about 137 planned) and one settings window plus at most the second one. Held-out check (4.5) passes, or kill criterion 3 applies.
4. The owner's one normal-browser reference capture (S2, non-EEA, fresh never-signed-in profile, D9) is compared field by field, with fixed or generated differences going to the owner first.
5. Live-only rows are tagged. The freeze note lists every exemption and every `blocked` state. Slice files for G1 to G14 are then written.

**DoD:**
- Frozen inventory and corpus committed with manifests. `npm test && npm run lint` and the servo quality-gate pass.
- Spec 065 review log records the capture session outcome and the pilot counts (extra captures needed by G1).

**Source:** spec 065 section 9 and the owner answers in section 12.
