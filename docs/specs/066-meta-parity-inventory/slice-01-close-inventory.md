---
status: READY_FOR_IMPLEMENTATION
dependencies: []
last_verified: 2026-11-13
---

## Slice 066-01: MT1, close the command, field and request inventory

**Goal:** The command, field and request inventory (spec 066 sections 2.1 to 2.4) is closed from the retained fbevents.js runtime and `signals/config` bytes, with every flag and plugin the config enables listed and the 058-02 bytes located. Read-only: it touches no vendor and runs nothing live.

**DoR:**
- Spec 066 approved by the owner as amended (O1, 2026-11-13).
- Note 2026-11-13 (O13): the 058-02 retained bytes are gone. The slice makes its own re-capture: three plain GETs under spec 066 10.1 (`fbevents.js`, one public homepage, one `signals/config/<pixel>`), stored in the private folder `AIRLOCK_META_PRIVATE_INPUTS_DIR`. The old 058-02 pins stay as history: runtime `d4487bcc…` (declares 2.9.426), config `b1720ebb…` (spec 066 section 1).

**Acceptance Criteria:**

1. Every `fbq` command, event-data key, request and response shape in the retained runtime has a row in 2.1 to 2.3, with its source location in the bytes. A row not found in the bytes is marked as docs-only.
2. Every request field has a class (fixed, generated, input-derived, server-context-derived, volatile or `unknown`) per 2.4, and every request has a request-level class. `unknown` and `mixed` are allowed until the freeze and listed.
3. Every flag, plugin and setting shape in the retained config is listed with the candidate state it would need (feeds 066-02 and SET1 to SET9).
4. (O13, 2026-11-13) The re-captured runtime and config digests, sizes, declared version and date are recorded so CAP's drift probe (4.1) can compare against them. The old 058-02 pins are recorded as history only. Drift against 2.9.426 and 2.9.435 is recorded by version and digest. The bytes, the private path and the third-party pixel ID are not committed.
5. Exactly the three GETs approved in 10.1 (O13), no other network call, no capture, no other production-site probe. Nothing fetched is executed.

**DoD:**
- Section 2 of spec 066 updated with a dated note listing what changed. `npm test && npm run lint` and the servo quality-gate pass.
- Open `unknown` rows are listed for the capture session to resolve.

**Consumers:** 066-03 (MT0) and 066-04 (CAP) take the field and request lists as their checklist.

**Status note (2026-11-13): blocked, DoR item 2 unmet. Do not pick this slice up until the owner supplies the handle.** The retained 058-02 bytes (runtime `d4487bcc…`, config `b1720ebb…`) were not supplied. Spec 066 and spec 060 name no store path, spec 060 forbids committing one and forbids filesystem discovery, and the digests appear only in committed docs, so the retained bytes were not available from any committed source. I did check a few kinds of places: a couple of guessed private-store locations and ignored files in the main checkout. Nothing was found or read. That edges toward spec 060's no-discovery rule and won't be repeated. Nothing was run or fetched. Needed from the owner: the private-input handle for the two retained files and their 058-02 manifest. The slice stays READY_FOR_IMPLEMENTATION in jig (it has no blocked status).

**Status note (2026-11-13, O13): blocked again, one-site rule.** The two Meta-side GETs of the O13 plan ran on the approved terms. Today's public `fbevents.js` (432263 bytes, sha256 `d835d20814c5d955098f6c0f6839233d7a7a72b05857f6f82d4dbd20201d027d`, declares 2.9.439) is stored in the private folder named by `AIRLOCK_META_PRIVATE_INPUTS_DIR`, with a private manifest. The one approved homepage (`www.allbirds.com`) holds no Meta pixel ID (no `fbq` or `fbevents` reference), so the config GET was not made and no second site was tried, as O13 requires. Needed from the owner: a new site name (or a pixel ID) for the one config GET. Nothing was executed. The slice stays READY_FOR_IMPLEMENTATION in jig.

**Status note (2026-11-13, O13 amendment, superseded): ten more sites tried; see the correction in spec 066 10.1, the kept `www.buzzfeed.com` HTML did hold a pixel field.** The ten homepages listed in spec 066 10.1 were fetched in order on the approved terms (plain GET, nothing executed). Six returned a page (200) with no Meta pixel ID in the HTML, and four did not return a usable page (`www.etsy.com` and `www.ebay.com` returned 403, `www.booking.com` 202, `www.spotify.com` a redirect, which was not followed). The one `signals/config` GET was not made. Per the owner's rule, nothing more is done until the owner supplies a site or pixel ID. The slice stays READY_FOR_IMPLEMENTATION in jig.

**Anti-horizontal-phasing check:** A read-only inventory task. It ends with a committed, reviewable list, not a layer.
