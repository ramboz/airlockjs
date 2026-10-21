import { realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

const load = () => import("./native-stock-egress.mjs");
const observeEmptyHeaders = (capture, id) => {
  capture.begin(id);
  capture.headers(id, "response", {});
  capture.headers(id, "extra", {});
};
const controls = {
  positive: 1, enforced: 0, bypass: 1, unauthenticated: "proxy_auth_required",
  wrong_auth: "proxy_auth_required", wrong_authority: "authority_denied", no_ticket: "ticket_required",
  same_tunnel_unknown_denied: 0, same_tunnel_unknown_bypass: 1,
  same_tunnel_marker_denied: 0, same_tunnel_marker_bypass: 1, redirect_denied: 0, redirect_bypass: 1,
  same_tunnel_reused: true, proxy_auth_at_sink: false, original_positive_matches: true,
  cookie_effect_observed: true, intended_scope_denials: true,
};
const witness = protocol => ({
  protocol, complete: true, controls: { ...controls },
  headers: { staged_bytes: 65528, final_bytes: 65800, sink_bytes: 65800, arrivals: 1 },
  response: { paused_original_bytes: 2097153, paused_original_matches: true,
    paused_renderer_denied: true, stream_renderer_completed_bytes: 2097153 },
});

describe("059-15 declared preconnected transport cohort", () => {
  it("irreversibly ends priming and never permits a replacement cold tunnel", async () => {
    const { createPreconnectLatch } = await load();
    const latch = createPreconnectLatch();
    expect(latch.register("t1")).toBe(true);
    expect(latch.seal({ httpRequests: 0, cookies: 0 })).toBe(true);
    expect(latch.register("t2")).toBe(false);
    expect(latch.seal({ httpRequests: 0, cookies: 0 })).toBe(false);
    expect(latch.snapshot()).toMatchObject({ phase: "sealed", primed_tunnel_ids: ["t1"] });
    const contaminated = createPreconnectLatch();
    expect(contaminated.seal({ httpRequests: 1, cookies: 0 })).toBe(false);
    expect(contaminated.register("late")).toBe(false);
    await expect((await load()).qualifyPreconnectedFirstParty({ outputDir: "/unused", native: true }))
      .rejects.toThrow("invalid_preconnect_options");
  });

  it.runIf(process.env.AIRLOCK_EGRESS_PRECONNECT_QUALIFICATION === "1")(
    "witnesses the new preconnect boundary without seeding HTTP or calling it a qualified cohort", async () => {
      const { mkdirSync, chmodSync, writeFileSync, unlinkSync, readFileSync, openSync, fsyncSync, closeSync } =
        await import("node:fs");
      const { execFileSync } = await import("node:child_process");
      const { randomBytes, createHash } = await import("node:crypto");
      const root = join(realpathSync(tmpdir()), "059-15-preconnect-test-" + randomBytes(8).toString("hex"));
      mkdirSync(root, { mode: 0o700 });
      execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", root + "/key.pem",
        "-out", root + "/certificate.pem", "-days", "1", "-subj", "/CN=collector.test.invalid",
        "-addext", "subjectAltName=DNS:collector.test.invalid"], { stdio: "ignore" });
      chmodSync(root + "/key.pem", 0o600); chmodSync(root + "/certificate.pem", 0o600);
      const source_pin = createHash("sha256").update(readFileSync("rig/native-stock-egress.mjs")).digest("hex");
      let result;
      try { result = await (await load()).qualifyPreconnectedFirstParty({ outputDir: root }); }
      finally { unlinkSync(root + "/key.pem"); }
      writeFileSync(root + "/report.json", JSON.stringify({ source_pin, whole_source_pinned: false, ...result }, null, 2)
        + "\n", { mode: 0o600, flag: "wx" });
      for (const path of [root + "/report.json", root]) {
        const fd = openSync(path, "r"); fsyncSync(fd); closeSync(fd);
      }
      console.log("PRIVATE_PRECONNECT_RECEIPT " + root);
      expect(result.errors).toEqual([]);
      expect(Object.values(result.cleanup).every(Boolean)).toBe(true);
      expect(result.top_origin).not.toBe(result.collector_origin);
      expect(result.general_cold_qualified).toBe(false);
      expect(result.preconnected_cohort_qualified).toBe(false);
      expect(result.native_execution_qualified).toBe(false);
      expect(result.http_warmups).toBe(0);
      expect(result.cookie_or_identity_seeds).toBe(0);
      expect(result.tls_broker_controls).toHaveLength(2);
      for (const control of result.tls_broker_controls)
        expect(control).toMatchObject({ authenticated_tls: true, http_arrivals: 0,
          browser_connection_pool_primed: false });
      expect(result.rows).toHaveLength(12);
      for (const row of result.rows) {
        expect(row.before_seal).toMatchObject({ http_arrivals: 0, cookies: 0, tunnel_ids: [],
          handshakes: [], h2_sessions: [], proxy_auth_callbacks: 0 });
        expect(row.before_seal.proxy_auth_challenges).toBeGreaterThan(0);
        expect(row.arrivals).toHaveLength(0);
        expect(row.new_tunnels_denied_after_seal).toBeGreaterThan(0);
        expect(row.tls_only_reuse_witnessed).toBe(false);
        expect(row.guards_removed_after_context_close).toBe(true);
        if (row.kind === "priming-http-denial") {
          expect(row.priming_attempt).toBe(false);
          expect(row.denials.some(denial => denial.reason === "http_during_priming")).toBe(true);
        }
      }
      expect(result.blockers).toContain("preconnect_proxy_auth_challenge_without_callback");
    }, 70000);
});

describe("059-15 conservative opaque TLS alternative", () => {
  it("never forwards a type-23 record, including fragmented/coalesced records", async () => {
    const { createTls13HandshakeFence } = await load();
    const extension = Buffer.from([0, 43, 0, 3, 2, 3, 4]);
    const helloBody = Buffer.concat([Buffer.from([3, 3]), Buffer.alloc(32), Buffer.from([0, 0, 2, 19, 1, 1, 0,
      0, extension.length]), extension]);
    const handshake = Buffer.concat([Buffer.from([1, 0, 0, helloBody.length]), helloBody]);
    const record = (type, bytes) => Buffer.concat([Buffer.from([type, 3, 3, bytes.length >> 8, bytes.length & 255]), bytes]);
    const hello = record(22, handshake), ccs = record(20, Buffer.from([1]));
    const encrypted = record(23, Buffer.alloc(30, 65));
    const combined = Buffer.concat([hello, ccs, encrypted]);
    for (let split = 0; split <= combined.length; split++) {
      const fence = createTls13HandshakeFence();
      const forwarded = [...fence.push(combined.subarray(0, split)), ...fence.push(combined.subarray(split))];
      expect(Buffer.concat(forwarded)).toEqual(Buffer.concat([hello, ccs]));
      expect(fence.snapshot()).toMatchObject({ blocked: true, reason: "encrypted_handshake_or_application",
        held_bytes: encrypted.length });
    }
  });

  it.each([[41, "tls_resumption_ambiguous"], [42, "tls_early_data_present"],
    [49, "tls_post_handshake_authentication"], [65037, "tls_ech_ambiguous"]])(
    "rejects ambiguous ClientHello extension %s rather than forwarding an encrypted Finished guess", async (type, reason) => {
      const { createTls13HandshakeFence } = await load();
      const extension = Buffer.from([0, 43, 0, 3, 2, 3, 4, type >> 8, type & 255, 0, 0]);
      const body = Buffer.concat([Buffer.from([3, 3]), Buffer.alloc(32), Buffer.from([0, 0, 2, 19, 1, 1, 0,
        0, extension.length]), extension]);
      const handshake = Buffer.concat([Buffer.from([1, 0, 0, body.length]), body]);
      const record = Buffer.concat([Buffer.from([22, 3, 3, 0, handshake.length]), handshake]);
      const fence = createTls13HandshakeFence();
      const forwarded = [...record].flatMap(byte => fence.push(Buffer.from([byte])));
      expect(forwarded).toEqual([]);
      expect(fence.snapshot()).toMatchObject({ blocked: true, reason, forwarded_bytes: 0 });
    });
});

describe("059-15 fixed first-party TLS falsification", () => {
  it("elides proxy authentication before retaining or counting object and paused header observations", async () => {
    const { elideProxyAuthorization, headerBytes } = await load();
    const secret = "Basic synthetic-only-must-not-be-retained";
    expect(elideProxyAuthorization({ a: "b", "pRoXy-AuThOrIzAtIoN": secret })).toEqual({ a: "b" });
    expect(elideProxyAuthorization([{ name: "Set-Cookie", value: "a=b" },
      { name: "Proxy-Authorization", value: secret }])).toEqual([{ name: "Set-Cookie", value: "a=b" }]);
    expect(headerBytes({ a: "b", "Proxy-Authorization": secret })).toBe(headerBytes({ a: "b" }));
  });

  it("counts UTF-8 final headers consistently with a receiving sink, not JS characters", async () => {
    const { headerBytes } = await load();
    expect(headerBytes({ Test: "é" })).toBe(Buffer.byteLength('[["test","é"]]'));
    expect(headerBytes({ A: "one", b: "two" })).toBe(headerBytes({ B: "two", a: "one" }));
  });

  describe("059-15 final-header transport hold", () => {
    it("binds final ExtraInfo to the single actual staged request and case before release", async () => {
      const { createFinalHeaderHold } = await load();
      const hold = createFinalHeaderHold();
      expect(hold.final({ caseId: "one", networkId: "n1", headers: { a: "b" } }).accepted).toBe(false);
      expect(hold.stage({ caseId: "one", networkId: "n1", requestId: "f1",
        headers: { a: "b" }, bodyBytes: 4 }).accepted).toBe(true);
      expect(hold.final({ caseId: "other", networkId: "n1", headers: { a: "b" } }).accepted).toBe(false);
      expect(hold.final({ caseId: "one", networkId: "wrong", headers: { a: "b" } }).accepted).toBe(false);
      expect(hold.final({ caseId: "one", networkId: "n1", headers: { a: "b" } }))
        .toMatchObject({ accepted: true, requestId: "f1", bytes: 15 });
      expect(hold.final({ caseId: "one", networkId: "n1", headers: { a: "b" } }).accepted).toBe(false);
    });

    describe("059-15 bounded original decoded retention", () => {
      it("charges every retained response header representation inside, not outside, the 2 MiB cap", async () => {
        const { createDecodedRetention, headerBytes } = await load();
        const capture = createDecodedRetention(() => {});
        capture.begin("one");
        const headers = { "content-type": "application/octet-stream" };
        capture.headers("one", "response", headers);
        capture.headers("one", "extra", headers);
        expect(capture.snapshot().responses[0].retained_header_bytes).toBe(2 * headerBytes(headers));
        capture.enabled("one", { bufferedData: "" });
        capture.data("one", { dataLength: 2097152, data: Buffer.alloc(2097152, 65).toString("base64") });
        expect(capture.snapshot()).toMatchObject({ stopped: true, reason: "response_overflow", retained_bytes: 0 });
        expect(capture.parts("one")).toEqual([]);
      });

      it("permits a completed-body fallback only after counted bounded completion, never on an active stream", async () => {
        const { createDecodedRetention } = await load();
        const capture = createDecodedRetention(() => {});
        observeEmptyHeaders(capture, "one");
        expect(capture.canReadCompleted("one")).toBe(false);
        capture.data("one", { dataLength: 4 });
        capture.finish("one");
        expect(capture.canReadCompleted("one")).toBe(true);
        capture.enabled("one", { bufferedData: "AP+AQQ==" });
        expect(capture.parts("one")).toEqual([Buffer.from([0, 255, 128, 65])]);
      });

      it("counts an oversized buffered reply before decoding/retaining and cancels synchronously", async () => {
        const { createDecodedRetention } = await load();
        const cancellations = [];
        const capture = createDecodedRetention(reason => cancellations.push(reason));
        observeEmptyHeaders(capture, "one");
        const bufferedData = Buffer.alloc(2097153, 65).toString("base64");
        const originalFrom = Buffer.from;
        let base64Decodes = 0;
        const spy = vi.spyOn(Buffer, "from").mockImplementation((...args) => {
          if (args[1] === "base64") base64Decodes++;
          return originalFrom(...args);
        });
        try { capture.enabled("one", { bufferedData }); } finally { spy.mockRestore(); }
        expect(base64Decodes).toBe(0);
        expect(cancellations).toEqual(["response_overflow"]);
        expect(capture.snapshot()).toMatchObject({ stopped: true, retained_bytes: 0,
          peak_retained_bytes: 4, reason: "response_overflow" });
        expect(capture.parts("one")).toEqual([]);
        expect(capture.begin("follow-up")).toBe(false);
      });

      it.runIf(process.env.AIRLOCK_EGRESS_QUALIFICATION === "1")(
        "receiving H1/H2 sinks witness cold deadlock, enforced warm headers and bounded originals", async () => {
          const { mkdirSync, chmodSync, writeFileSync, unlinkSync, readFileSync, openSync, fsyncSync, closeSync } =
            await import("node:fs");
          const { execFileSync } = await import("node:child_process");
          const { createHash, randomBytes } = await import("node:crypto");
          const root = join(realpathSync(tmpdir()), "059-15-egress-test-" + randomBytes(8).toString("hex"));
          mkdirSync(root, { mode: 0o700 });
          execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", root + "/key.pem",
            "-out", root + "/certificate.pem", "-days", "1", "-subj", "/CN=collector.test.invalid",
            "-addext", "subjectAltName=DNS:collector.test.invalid"], { stdio: "ignore" });
          chmodSync(root + "/key.pem", 0o600); chmodSync(root + "/certificate.pem", 0o600);
          const source_pin = createHash("sha256").update(readFileSync("rig/native-stock-egress.mjs")).digest("hex");
          let result;
          try { result = await (await load()).qualifyFirstParty({ outputDir: root }); }
          finally { unlinkSync(root + "/key.pem"); }
          writeFileSync(root + "/report.json", JSON.stringify({ source_pin, whole_source_pinned: false, ...result }, null, 2)
            + "\n", { mode: 0o600, flag: "wx" });
          for (const path of [root + "/report.json", root]) {
            const fd = openSync(path, "r"); fsyncSync(fd); closeSync(fd);
          }
          console.log("PRIVATE_EGRESS_RECEIPT " + root);
          expect(result.errors).toEqual([]);
          expect(Object.values(result.cleanup).every(Boolean)).toBe(true);
          expect(result.native_execution_qualified).toBe(false);
          for (const protocol of result.protocols) {
            const find = kind => protocol.cases.find(row => row.kind === kind);
            expect(find("cold-connect-wait")).toMatchObject({ arrivals: [], upstream_sockets: 0, finals: [],
              connect_wait_expired: true });
            expect(find("cold-connect-bypass").arrivals).toHaveLength(1);
            expect(find("cold-tls-record-fence")).toMatchObject({ arrivals: [], upstream_sockets: 1,
              finals: [], final_headers_deadline: true, tls_fence: { native_handshake_boundary_qualified: false } });
            expect(find("warm-positive").arrivals).toHaveLength(2);
            expect(find("warm-enforced").arrivals).toHaveLength(1);
            expect(find("warm-header-overflow").arrivals).toHaveLength(2);
            expect(find("warm-header-overflow").staged.at(-1)).toMatchObject({ bytes: 65528,
              final: { accepted: false, reason: "final_request_overflow", forwarded_since_stage: 0, arrivals_since_stage: 0 } });
            expect(find("warm-header-bypass").arrivals).toHaveLength(3);
            expect(find("warm-header-exact").staged.at(-1).final).toMatchObject({ accepted: true, bytes: 65536,
              forwarded_since_stage: 0, arrivals_since_stage: 0 });
            expect(find("warm-body-exact").staged.at(-1)).toMatchObject({ bodyBytes: 4,
              final: { accepted: true, bytes: 65536, forwarded_since_stage: 0, arrivals_since_stage: 0 } });
            expect(find("warm-body-exact").arrivals).toHaveLength(3);
            expect(find("warm-body-overflow").staged.at(-1)).toMatchObject({ bodyBytes: 4,
              final: { accepted: false, bytes: 65537, forwarded_since_stage: 0, arrivals_since_stage: 0 } });
            expect(find("warm-body-overflow").arrivals).toHaveLength(2);
            for (const scope of ["unknown", "marker"]) {
              expect(find(`warm-${scope}-denied`).arrivals).toHaveLength(1);
              expect(find(`warm-${scope}-bypass`).arrivals).toHaveLength(2);
              expect(find(`warm-${scope}-bypass`).tunnels).toBe(1);
            }
            for (const corrupt of ["warm-wrongcase", "warm-wrong-network"]) {
              expect(find(corrupt).arrivals).toHaveLength(1);
              expect(find(corrupt).final_headers_deadline).toBe(true);
            }
            for (const kind of ["response-exact", "response-buffered-race"]) {
              expect(find(kind).retention.stopped).toBe(false);
              const original = find(kind).originals.at(-1);
              expect(original.response_bytes).toBe(2097152);
              expect(original.bytes + original.header_bytes).toBe(2097152);
              expect(original.bytes).toBeLessThan(2097152);
              expect(find(kind).retained_originals_match_sink).toBe(true);
            }
            for (const kind of ["response-exact", "response-overflow"]) {
              expect(find(kind).response_observation_facts.at(-1))
                .toMatchObject({ has_content_length: false, gzip: true });
            }
            for (const kind of ["response-inclusive-one-over", "response-body-at-cap"]) {
              const target = find(kind);
              expect(target.retention).toMatchObject({ stopped: true, reason: "response_overflow" });
              expect(target.originals.some(original => original.url.includes(kind))).toBe(false);
              expect(target.arrivals.some(arrival => arrival.url === "/followup?owned=probe")).toBe(false);
              expect(target.retention.responses.at(-1)).toMatchObject({ state: "inconclusive",
                retained_header_bytes: 0, retained_body_bytes: 0 });
            }
            expect(find("response-overflow").retention).toMatchObject({ stopped: true, reason: "response_overflow" });
            expect(find("response-overflow").capture_availability).toBe("inconclusive");
            expect(find("response-overflow").retention.peak_response_bytes).toBeLessThanOrEqual(2097152);
            expect(find("response-overflow").response_headers.some(response =>
              response.networkId === find("response-overflow").retention.responses.at(-1).id)).toBe(false);
            expect(find("response-overflow").denied.some(row => row.reason === "stopped")).toBe(true);
            expect(find("response-overflow").arrivals.some(row => row.url === "/followup?owned=probe")).toBe(false);
            expect(find("response-overflow-bypass").arrivals.some(row => row.url === "/followup?owned=probe")).toBe(true);
            expect(find("response-aggregate").retention).toMatchObject({ stopped: true, reason: "aggregate_overflow" });
            expect(find("response-aggregate").retention.peak_retained_bytes).toBeLessThanOrEqual(8388608);
            expect(find("response-aggregate").arrivals.some(row => row.url === "/followup?owned=probe")).toBe(false);
            for (const kind of ["response-missing-api", "response-missing-data", "response-truncated"])
              expect(find(kind).retention.stopped).toBe(true);
            expect(protocol.cases.every(row => row.retained_originals_match_sink
              && row.guards_removed_after_context_close)).toBe(true);
            // Deliberate stopped/bypass observations are not complete accepted
            // captures; only their already-complete originals can be compared.
            expect(protocol.cases.filter(row => !row.retention.stopped)
              .every(row => row.final_headers_match_sink && row.response_headers_match_sink)).toBe(true);
            expect(find("warm-positive").cookie_effect_observed).toBe(true);
            expect(find("warm-positive").arrivals[1].headers.cookie).toBe("first=one; second=two");
            if (protocol.protocol === "h2")
              expect(find("warm-concurrent").concurrent_second_before_first_complete).toBe(true);
          }
        }, 70000);

      it("accepts the exact header-plus-decoded-body limit with data/finish racing the buffered API reply", async () => {
        const { createDecodedRetention } = await load();
        const capture = createDecodedRetention(() => { throw new Error("unexpected cancellation"); });
        // Each actually retained empty header representation costs two bytes.
        const head = Buffer.alloc(2097147, 65), tail = Buffer.from([255]);
        observeEmptyHeaders(capture, "one");
        capture.data("one", { dataLength: head.length });
        capture.data("one", { dataLength: 1, data: tail.toString("base64") });
        capture.finish("one");
        expect(capture.parts("one")).toEqual([]);
        capture.enabled("one", { bufferedData: head.toString("base64") });
        expect(capture.snapshot()).toMatchObject({ stopped: false, retained_bytes: 2097152,
          peak_retained_bytes: 2097152, peak_response_bytes: 2097152 });
        expect(capture.parts("one")).toEqual([head, tail]);
      });

      it("never completes before final headers, and discards body parts if late headers cross the combined cap", async () => {
        const { createDecodedRetention } = await load();
        const capture = createDecodedRetention(() => {});
        capture.begin("one"); capture.headers("one", "response", {});
        capture.enabled("one", { bufferedData: "" });
        capture.data("one", { dataLength: 2097150, data: Buffer.alloc(2097150, 65).toString("base64") });
        capture.finish("one");
        expect(capture.parts("one")).toEqual([]);
        expect(capture.snapshot().responses[0].state).not.toBe("complete");
        capture.headers("one", "extra", {});
        expect(capture.snapshot()).toMatchObject({ stopped: true, reason: "response_overflow", retained_bytes: 0 });
      });

      it("includes retained original URL, request headers and request body in aggregate accounting", async () => {
        const { createDecodedRetention, headerBytes } = await load();
        const capture = createDecodedRetention(() => {});
        const urlBytes = Buffer.byteLength("https://collector.test.invalid/known?owned=probe");
        const requestBytes = headerBytes({ "content-type": "application/octet-stream" }) + 4;
        capture.reserve(urlBytes + requestBytes);
        observeEmptyHeaders(capture, "one");
        capture.enabled("one", { bufferedData: "" });
        capture.data("one", { dataLength: 1, data: "YQ==" }); capture.finish("one");
        expect(capture.snapshot().retained_bytes).toBe(urlBytes + requestBytes + 4 + 1);
        capture.reserve(8388608 - capture.snapshot().retained_bytes);
        expect(capture.reserve(1)).toBe(false);
        expect(capture.snapshot().reason).toBe("aggregate_overflow");
      });

      it("does not substitute empty headers for malformed or missing original header observations", async () => {
        const { createDecodedRetention, elideProxyAuthorization } = await load();
        expect(() => elideProxyAuthorization([{ value: "unreadable-header-name" }]))
          .toThrow("invalid_header_observation");
        const capture = createDecodedRetention(() => {});
        capture.begin("one");
        capture.headers("one", "response", undefined);
        expect(capture.snapshot()).toMatchObject({ stopped: true, reason: "original_response_headers_unavailable" });
        expect(capture.parts("one")).toEqual([]);
      });

      it("discards incomplete streamed parts and latches before the cancellation callback admits another response", async () => {
        const { createDecodedRetention } = await load();
        let admitted;
        const capture = createDecodedRetention(() => { admitted = capture.begin("follow-up"); });
        observeEmptyHeaders(capture, "one"); capture.enabled("one", { bufferedData: "" });
        capture.data("one", { dataLength: 2097148, data: Buffer.alloc(2097148, 65).toString("base64") });
        capture.data("one", { dataLength: 1, data: "YQ==" });
        expect(admitted).toBe(false);
        expect(capture.snapshot()).toMatchObject({ stopped: true, reason: "response_overflow",
          retained_bytes: 0, peak_retained_bytes: 2097152 });
        expect(capture.parts("one")).toEqual([]);
      });

      it("keeps exactly 8 MiB across complete originals, then denies one extra metadata byte", async () => {
        const { createDecodedRetention } = await load();
        const cancelled = [];
        const capture = createDecodedRetention(reason => cancelled.push(reason));
        const data = Buffer.alloc(2097148, 65).toString("base64");
        for (let i = 0; i < 4; i++) {
          observeEmptyHeaders(capture, String(i)); capture.enabled(String(i), { bufferedData: "" });
          capture.data(String(i), { dataLength: 2097148, data }); capture.finish(String(i));
        }
        expect(capture.snapshot()).toMatchObject({ stopped: false, retained_bytes: 8388608 });
        expect(capture.reserve(1)).toBe(false);
        expect(cancelled).toEqual(["aggregate_overflow"]);
        expect(capture.snapshot().retained_bytes).toBe(8388608);
      });

      it.each(["missing-api", "missing-buffer", "truncated-buffer", "missing-data", "wrong-chunk-length",
        "invalid-base64", "loading-failed"])("never accepts %s as complete/empty", async kind => {
        const { createDecodedRetention } = await load();
        const capture = createDecodedRetention(() => {});
        observeEmptyHeaders(capture, "one");
        if (kind === "missing-api") capture.unavailable();
        else if (kind === "missing-buffer") capture.enabled("one", {});
        else if (kind === "truncated-buffer") {
          capture.data("one", { dataLength: 2 });
          capture.enabled("one", { bufferedData: "YQ==" });
        } else {
          capture.enabled("one", { bufferedData: "" });
          if (kind === "missing-data") capture.data("one", { dataLength: 1 });
          if (kind === "wrong-chunk-length") capture.data("one", { dataLength: 2, data: "YQ==" });
          if (kind === "invalid-base64") capture.data("one", { dataLength: 1, data: "!!==" });
          if (kind === "loading-failed") capture.failed();
        }
        capture.finish("one");
        expect(capture.snapshot().stopped).toBe(true);
        expect(capture.parts("one")).toEqual([]);
      });
    });

    it("includes original body bytes at the exact ceiling and rejects final native additions", async () => {
      const { createFinalHeaderHold } = await load();
      const headers = { "x-padding": "a".repeat(65510) };
      const exactBody = 65536 - (await load()).headerBytes(headers);
      const hold = createFinalHeaderHold();
      expect(hold.stage({ caseId: "one", networkId: "n1", requestId: "f1", headers, bodyBytes: exactBody })
        .accepted).toBe(true);
      expect(hold.stage({ caseId: "one", networkId: "n2", requestId: "f2", headers, bodyBytes: 0 }).reason)
        .toBe("stage_busy");
      expect(hold.final({ caseId: "one", networkId: "n1", headers: { ...headers, cookie: "native=one" } }))
        .toMatchObject({ accepted: false, reason: "final_request_overflow" });
      expect(hold.stage({ caseId: "one", networkId: "n1", requestId: "f3", headers, bodyBytes: 0 }).reason)
        .toBe("invalid_stage");
      expect(hold.stage({ caseId: "one", networkId: "n2", requestId: "f2", headers, bodyBytes: exactBody }).accepted)
        .toBe(true);
      expect(hold.final({ caseId: "one", networkId: "n2", headers }))
        .toMatchObject({ accepted: true, bytes: 65536 });
    });

    it("keeps the follow-up qualification fixed and separate from the old diagnostic", async () => {
      const { qualifyFirstParty } = await load();
      await expect(qualifyFirstParty({ outputDir: "/unused", native: true }))
        .rejects.toThrow("invalid_qualification_options");
    });
  });

  it("AC3: refuses arbitrary destination/proxy/program options before starting resources", async () => {
    const { probeFirstParty } = await load();
    await expect(probeFirstParty({ url: "https://example.invalid" })).rejects.toThrow("invalid_probe_options");
    await expect(probeFirstParty({ outputDir: "/unused", proxy: "http://127.0.0.1:1" }))
      .rejects.toThrow("invalid_probe_options");
  });

  it("cannot call a missing/truncated response a witnessed byte-limit blocker", async () => {
    const { classifyProbe } = await load();
    expect(classifyProbe([])).toEqual({ witnessed: false, blockers: [], errors: ["incomplete_probe"] });
    expect(classifyProbe([{ protocol: "h2", complete: false }]).witnessed).toBe(false);
  });

  it("does not treat a byte count at the ceiling as an over-limit witness", async () => {
    const { classifyProbe } = await load();
    const row = {
      protocol: "h2", complete: true, controls: { ...controls },
      headers: { staged_bytes: 65536, final_bytes: 65536, sink_bytes: 65536, arrivals: 1 },
      response: { paused_original_bytes: 2097152, paused_original_matches: true,
        paused_renderer_denied: true, stream_renderer_completed_bytes: 2097152 },
    };
    expect(classifyProbe([row, { ...row, protocol: "h1" }]).witnessed).toBe(false);
  });

  it.each(Object.keys(controls))("requires the matched positive/control %s, not a generic failed command", async key => {
    const { classifyProbe } = await load();
    const bad = witness("h2");
    bad.controls[key] = null;
    expect(classifyProbe([witness("h1"), bad]).witnessed).toBe(false);
  });

  it("requires exactly H1 and H2, never a second invented transport", async () => {
    const { classifyProbe } = await load();
    expect(classifyProbe([witness("h1"), witness("h3")]).witnessed).toBe(false);
  });

  it.each(["paused_original_matches", "paused_renderer_denied", "paused_original_bytes"])(
    "does not promote missing/truncated original field %s", async key => {
      const { classifyProbe } = await load();
      const bad = witness("h2");
      delete bad.response[key];
      expect(classifyProbe([witness("h1"), bad]).witnessed).toBe(false);
    });
});
