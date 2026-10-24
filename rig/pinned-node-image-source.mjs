import { afterEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { EventEmitter } from "node:events";
import { URL } from "node:url";

const fixture = vi.hoisted(() => ({ pins: null }));
vi.mock("./pinned-node-image-pins.mjs", () => ({ P: fixture.pins }));
const fsMock = vi.hoisted(() => ({
  state: null,
  calls: Object.fromEntries(["openSync", "closeSync", "fstatSync", "lstatSync", "readFileSync", "readSync",
    "writeSync", "fsyncSync", "realpathSync", "readdirSync", "statfsSync"].map(name => [name, vi.fn((...args) => {
    if (!fsMock.state) throw Error("SOURCE filesystem unseeded");
    return fsMock.state[name](...args);
  })])),
}));
vi.mock("node:fs", async original => ({ ...await original(), ...fsMock.calls }));
const runMock = vi.hoisted(() => ({ value: null, handler: null }));
vi.mock("node:process", () => ({ default: {
  getuid: () => runMock.value.uid, cwd: () => runMock.value.cwd,
  get execPath() { return runMock.value.exe; }, get version() { return runMock.value.version; },
  get env() { return runMock.value.env; }, get pid() { return runMock.value.pid; },
  hrtime: { bigint: () => runMock.value.ns },
  get stdin() { return runMock.value.stdin; }, get stdout() { return runMock.value.stdout; },
} }));
vi.mock("node:http", () => ({ request: (...args) => runMock.handler(...args) }));
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

const sha = b => createHash("sha256").update(b).digest("hex");
const raw = v => Buffer.from(JSON.stringify(v));
const streams = Array.from({ length: 5 }, (_, i) => Buffer.from("fixture-layer-" + i));
const layers = streams.map(gzipSync);
const config = raw({
  architecture: "arm64", os: "linux", variant: "v8",
  config: { Env: ["PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
    "NODE_VERSION=24.10.0", "YARN_VERSION=1.22.22"], Entrypoint: ["docker-entrypoint.sh"], Cmd: ["node"] },
  rootfs: { type: "layers", diff_ids: streams.map(b => "sha256:" + sha(b)) },
});
const descriptor = (b, type) => ({ mediaType: "application/vnd.oci.image." + type, digest: "sha256:" + sha(b), size: b.length });
const manifest = raw({ schemaVersion: 2, mediaType: "application/vnd.oci.image.manifest.v1+json",
  config: descriptor(config, "config.v1+json"), layers: layers.map(b => descriptor(b, "layer.v1.tar+gzip")) });
const index = raw({ schemaVersion: 2, mediaType: "application/vnd.oci.image.index.v1+json",
  manifests: [{ ...descriptor(manifest, "manifest.v1+json"), platform: { os: "linux", architecture: "arm64" } }] });
const decision = raw({ schema: "airlock.pinned-image-preparation-owner-decision.v1", owner_response: "you got my approval",
  decision_id: "pinned-node-image-preparation-20261023", pinned_manifest: "sha256:" + sha(manifest),
  pinned_config: "sha256:" + sha(config), operation_issued: false });
const binding = {
  schema: "airlock.pinned-image-import-operator-binding.v1", binding_path: "/unit/binding.json",
  decision_id: "pinned-node-image-preparation-20261023", decision_path: "/unit/decision.json",
  decision_sha256: sha(decision), decision_device: 1, decision_inode: 2, uid: 503,
  case_root: "/unit/actual-one", canonical_reservation_path: "/unit/image-load.reserved", oci_root: "/unit/oci",
  oci_index_sha256: sha(index), capacity_receipt_path: "/unit/capacity.json", capacity_receipt_sha256: "",
  capacity_projection_path: "/unit/projection.json", capacity_projection_sha256: "",
  endpoint: "unix:///unit/docker/socket", engine_version: "28.5.1", engine_api: "1.51",
  manifest_digest: "sha256:" + sha(manifest), config_digest: "sha256:" + sha(config),
  maximum_archive_bytes: 100663296, minimum_host_free_bytes: 2147483648, maximum_capacity_age_ms: 14400000,
  minimum_reported_guest_available_g: 16, maximum_expanded_layer_stream_bytes: 314572800,
  maximum_response_bytes: 1048576, maximum_load_response_bytes: 65536, whole_controller_acceptance_ns: "45000000000",
  single_importer_coordination: "status only; refresh in original job", effect_scope: "exact public base only",
  runtime_qualified: false,
};
const projection = {
  kind: "airlock.private.docker-guest-capacity-mount-projection", schema_version: 1,
  collection_started_utc: "2026-10-23T22:20:32.823661+00:00", collection_finished_utc: "2026-10-23T22:21:16.257340+00:00",
  archive_sha256: "b".repeat(64),
  selected_storage_entries: {
    "vm/docker/info.json": { member: "vm/docker/info.json", sha256: "c".repeat(64), bytes: 3084,
      storage_fields: { DockerRootDir: "/var/lib/docker", Driver: "overlayfs", DriverStatus: [["driver-type", "io.containerd.snapshotter.v1"]] } },
    "vm/system/mount.txt": { member: "vm/system/mount.txt", sha256: "d".repeat(64), bytes: 6129,
      capacity_mount_lines: ["/dev/vda1 on /var/lib type ext4 (rw,relatime,discard)",
        "/dev/vda1 on /var/lib/docker type ext4 (rw,relatime,discard)",
        "overlay on /var/lib/docker/rootfs/overlayfs/test type overlay (rw,lowerdir=/var/lib/desktop-containerd/daemon/io.containerd.snapshotter.v1.overlayfs/snapshots/1/fs)"] },
    "vm/system/df.cmd.txt": { member: "vm/system/df.cmd.txt", sha256: "e".repeat(64), bytes: 5, capacity_text: "df -h" },
    "vm/system/df.txt": { member: "vm/system/df.txt", sha256: "f".repeat(64), bytes: 1187,
      capacity_text: "Filesystem Size Used Avail Use% Mounted on\n/dev/vda1 911G 89G 777G 11% /var/lib\n" },
  },
  only_storage_fields_or_capacity_lines_retained: true, unrelated_log_members_opened: false,
  guest_capacity_snapshot_not_reservation: true, image_import_or_container_start: false, runtime_qualified: false,
};
const capacity = {
  kind: "airlock.private.supported-docker-guest-capacity-observation", schema_version: 1,
  assessed_at: "2026-10-23T22:22:59.120378+00:00",
  collection_interval_utc: [projection.collection_started_utc, projection.collection_finished_utc],
  source_method: "capacity only", archive_sha256: projection.archive_sha256,
  storage_projection: { path: "/unit/projection.json", sha256: sha(raw(projection)) },
  storage_root: "/var/lib/docker", image_store: "io.containerd.snapshotter.v1",
  backing_device: "/dev/vda1", backing_filesystem: "ext4", guest_backing_mount: "/var/lib",
  docker_root_same_device_mount_confirmed: true, containerd_snapshot_paths_observed_under_same_var_lib: true,
  reported_capacity: "911G", reported_used: "89G", reported_available: "777G", reporting_command: "df -h",
  exact_free_bytes_claimed: false, capacity_snapshot_established: true, capacity_reserved: false,
  future_import_or_allocation_admission: false, host_available_bytes_at_assessment: 36781572096,
  host_reserve_bytes_required: 2147483648, actual_collection_exit_code: 0, actual_collection_elapsed_seconds: 43.4,
  archive_bytes: 4835494, diagnostics_uploaded: false, unrelated_log_contents_inspected: false,
  image_imports_or_containers_started: 0, limits: ["snapshot only"],
  runtime_qualified: false, clock_qualified: false, containment_qualified: false, live_authority: false,
};
binding.capacity_projection_sha256 = sha(raw(projection)); binding.capacity_receipt_sha256 = sha(raw(capacity));
fixture.pins = Object.freeze({
  bindingSha: sha(raw(binding)), decisionSha: sha(decision), decisionDev: 1, decisionIno: 2, uid: 503,
  indexSha: sha(index), manifest: "sha256:" + sha(manifest), config: "sha256:" + sha(config),
  layers: layers.map((b, i) => ({ digest: "sha256:" + sha(b), size: b.length, diff: "sha256:" + sha(streams[i]) })),
  configSize: config.length, manifestSize: manifest.length,
  env: JSON.parse(config).config.Env, node: "/opt/homebrew/Cellar/node/24.10.0/bin/node",
  archiveMax: 96 * 1024 ** 2, expandedMax: 300 * 1024 ** 2, hostReserve: 2 * 1024 ** 3,
  responseMax: 1048576, loadMax: 65536, capacityAge: 14400000, guestG: 16, budgetNs: 45000000000n,
});
const entries = () => [
  ["oci-layout", raw({ imageLayoutVersion: "1.0.0" })], ["index.json", index],
  ...[manifest, config, ...layers].map(b => ["blobs/sha256/" + sha(b), b]),
];
const archive = await import("./pinned-node-image-archive.mjs");

describe("closed deterministic archive SOURCE", () => {
  it("encodes exactly nine fixed entries and independently checks content and padding", async () => {
    const tar = archive.encodeImageTar(entries());
    expect(tar.equals(archive.encodeImageTar(entries()))).toBe(true);
    const checked = await archive.verifyImageTar(tar);
    expect(checked.names).toEqual(entries().map(([name]) => name));
    expect(checked.expandedBytes).toBe(streams.reduce((n, b) => n + b.length, 0));
    expect(checked.sha256).toBe(sha(tar));
    expect(tar.subarray(-1024).equals(Buffer.alloc(1024))).toBe(true);
  });

  async function seededController() {
    const fs = memoryFs(), io = await import("./pinned-node-image-io.mjs");
    const controller = await import("./pinned-node-image-import.mjs");
    fs.put("/unit", undefined, "dir"); fs.put("/unit/decision.json", decision);
    fs.put("/unit/binding.json", raw(binding)); fs.put("/unit/capacity.json", raw(capacity)); fs.put("/unit/projection.json", raw(projection));
    fs.put("/unit/actual-one", undefined, "dir"); fs.put("/unit/actual-one/empty-home", undefined, "dir"); fs.put("/unit/actual-one/tmp", undefined, "dir");
    fs.put("/unit/docker", undefined, "dir"); fs.put("/unit/docker/socket", undefined, "socket");
    fs.put("/unit/oci", undefined, "dir");
    for (const [name, bytes] of entries()) fs.put("/unit/oci/" + name, bytes);
    const workspace = controller.IMAGE_WORKSPACE;
    const caller = "/unit/source/image_outer.py", callerTest = "/unit/source/test_image_outer.py";
    fs.put(caller, Buffer.from("fixed caller"));
    fs.put(callerTest, Buffer.from("fixed caller SOURCE tests"));
    fs.put(fixture.pins.node, Buffer.from("fixed Node executable"), "file", 0o755);
    for (const name of controller.IMAGE_SOURCES) fs.put(workspace + "/" + name, Buffer.from("reviewed " + name), "file", 0o644);
    const handle = (path, privateFile = false) => {
      const h = io.imageOriginal(path, { uid: 503, privateFile, maximum: 134217728 });
      try { return h.handle; } finally { h.close(); }
    };
    const directory = io.imageDirectory(binding.case_root, 503);
    const directoryHandle = directory.handle; directory.close();
    const nonce = "1".repeat(64), proof = {
      schema: "airlock.pinned-image-reviewed-source.v1", case_root: binding.case_root, directory: directoryHandle, nonce,
      binding: handle("/unit/binding.json", true), decision: handle("/unit/decision.json", true),
      node: handle(fixture.pins.node), caller: handle(caller, true), caller_test: handle(callerTest, true),
      sources: controller.IMAGE_SOURCES.map(name => ({ name, original: handle(workspace + "/" + name) })),
    };
    fs.put("/unit/actual-one/source-reviewed.json", raw(proof));
    const job = {
      schema: "airlock.pinned-image-job.v1", case_root: binding.case_root, directory: directoryHandle, nonce,
      binding: proof.binding, decision: proof.decision, proof: handle("/unit/actual-one/source-reviewed.json", true),
      caller: proof.caller, caller_test: proof.caller_test, node: proof.node, sources: proof.sources,
      coordination: { checked_at: "2026-10-23T22:59:59Z", peer: "no conflicting own operation; duplicate import deferred",
        scope: "exact image store operation only" },
    };
    fs.put("/unit/actual-one/job.json", raw(job));
    const outerIntent = { schema: "airlock.pinned-image-outer-intent.v1", nonce, job_sha256: sha(raw(job)), proof_sha256: sha(raw(proof)),
      command: [fixture.pins.node, workspace + "/rig/pinned-node-image-cli.mjs", "--binding", binding.binding_path,
        "--job", binding.case_root + "/job.json"], environment: controller.imageEnvironment(binding.case_root),
      sources: proof.sources, node: proof.node, caller: proof.caller, caller_test: proof.caller_test,
      binding: proof.binding, decision: proof.decision, original_started_ns: "1", budget_ns: "45000000000" };
    fs.put("/unit/actual-one/outer-intent.json", raw(outerIntent));
    const stdin = new EventEmitter(), messages = [];
    runMock.value = { uid: 503, cwd: binding.case_root, exe: fixture.pins.node, version: "v24.10.0",
      ns: 1000000000n, pid: 555, stdin,
      env: { PATH: "/opt/homebrew/Cellar/node/24.10.0/bin:/usr/bin:/bin", HOME: binding.case_root + "/empty-home",
        TMPDIR: binding.case_root + "/tmp", LANG: "C", LC_ALL: "C", CI: "1", NO_COLOR: "1" },
      stdout: { write(line, done) {
        const m = JSON.parse(line); messages.push(m); done?.();
        if (m.schema === "airlock.pinned-image-hello.v1") queueMicrotask(() => {
          const issued = { schema: "airlock.pinned-image-outer-issued.v1", pid: 555, nonce, job_sha256: sha(raw(job)),
            outer_intent: handle("/unit/actual-one/outer-intent.json", true) };
          fs.put("/unit/actual-one/outer-issued.json", raw(issued));
          stdin.emit("data", raw({ schema: "airlock.pinned-image-ack.v1", pid: 555, nonce,
            job_sha256: sha(raw(job)), proof_sha256: sha(raw(proof)), issued_sha256: sha(raw(issued)), remaining_ns: "44000000000" }).toString() + "\n");
          queueMicrotask(() => stdin.emit("end"));
        });
        return true;
      } },
    };
    vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-10-23T23:00:00Z"));
    const requests = [], inspect = {
      Id: fixture.pins.manifest, Descriptor: { ...descriptor(manifest, "manifest.v1+json"),
        platform: { os: "linux", architecture: "arm64" } },
      Os: "linux", Architecture: "arm64", Variant: "v8", RootFS: { Type: "layers", Layers: fixture.pins.layers.map(l => l.diff) },
      Config: JSON.parse(config).config, RepoDigests: [], RepoTags: [],
    };
    const reply = (options, callback) => {
      const request = new EventEmitter(), socket = new EventEmitter();
      socket.writableLength = 0; request.writableLength = 0; request.writableFinished = false;
      request.destroy = error => { request.emit("error", error); request.emit("close"); socket.emit("close"); };
      request.end = body => {
        requests.push({ options, body });
        queueMicrotask(() => {
          request.emit("socket", socket); request.writableFinished = true; request.emit("finish");
          const response = new EventEmitter(); response.statusCode = options.path.includes("/images/") && options.method === "GET" && requests.filter(r => r.options.path.includes("/images/") && r.options.method === "GET").length === 1 ? 404 : 200;
          response.httpVersion = "1.1"; response.complete = true; response.readableEnded = true;
          let value;
          if (options.path.endsWith("/version")) value = { Version: "28.5.1", ApiVersion: "1.51", Os: "linux", Arch: "arm64" };
          else if (options.path.endsWith("/info")) value = { ID: "engine-owned-unit", ServerVersion: "28.5.1", DockerRootDir: "/var/lib/docker",
            Driver: "overlayfs", DriverStatus: [["driver-type", "io.containerd.snapshotter.v1"]], OSType: "linux", Architecture: "aarch64" };
          else if (options.method === "POST") {
            const query = new URL(options.path, "http://localhost").searchParams;
            let platform;
            try { platform = JSON.parse(query.get("platform")); } catch { platform = null; }
            if (JSON.stringify(platform) !== JSON.stringify({ os: "linux", architecture: "arm64", variant: "v8" })) {
              response.statusCode = 400;
              value = { message: "invalid platform JSON object" };
            } else value = { stream: "Loaded image ID: " + fixture.pins.manifest + "\n" };
          }
          else value = response.statusCode === 404 ? { message: "No such image: " + fixture.pins.manifest } : inspect;
          const bytes = options.method === "POST" ? Buffer.from(JSON.stringify(value) + "\r\n") : raw(value);
          response.headers = { "content-length": String(bytes.length), "content-type": "application/json" };
          callback(response); response.emit("data", bytes); response.emit("end"); response.emit("close"); request.emit("close"); socket.emit("close");
        });
      };
      return request;
    };
    runMock.handler = reply;
    return { fs, controller, io, proof, job, requests, inspect, messages, reply, handle };
  }
  const planFor = f => f.controller.preparePinnedImage({ binding_path: binding.binding_path, job_path: binding.case_root + "/job.json" });
  const rewrite = (f, path, value) => {
    const file = f.fs.files.get(path); file.bytes = raw(value); file.s.size = file.bytes.length;
  };
  function responseFault(f, action, predicate = options => options.method === "POST") {
    runMock.handler = (options, callback) => f.reply(options, res => {
      if (predicate(options)) action(res, options);
      callback(res);
    });
  }
  function replaceBody(res, bytes) {
    res.headers["content-length"] = String(bytes.length);
    const emit = res.emit;
    res.emit = function (event, ...args) { return emit.call(this, event, ...(event === "data" ? [bytes] : args)); };
  }

  describe("private one-use actual controller with all effects doubled SOURCE", () => {
    it("builds verified content, burns the canonical slot before one fixed POST and returns only image observations", async () => {
      const f = await seededController();
      const plan = f.controller.preparePinnedImage({ binding_path: binding.binding_path, job_path: binding.case_root + "/job.json" });
      const result = await f.controller.runPinnedImage(plan);
      expect(result.status).toBe("IMAGE_AVAILABLE_PENDING_OUTER_CLOSE");
      expect(result.runtime_qualified).toBe(false);
      expect(result.native_qualified).toBe(false);
      expect(result.handler_response_complete).toBe(true);
      expect(f.requests.filter(r => r.options.method === "POST")).toHaveLength(1);
      const post = f.requests.find(r => r.options.method === "POST");
      expect(new URL(post.options.path, "http://localhost").searchParams.get("platform"))
        .toBe('{"os":"linux","architecture":"arm64","variant":"v8"}');
      expect((await archive.verifyImageTar(post.body)).names).toHaveLength(9);
      expect(f.fs.files.has("/unit/image-load.reserved")).toBe(true);
      await expect(f.controller.runPinnedImage(plan)).rejects.toThrow("image_plan_used");
      await expect(f.controller.runPinnedImage({})).rejects.toThrow("image_private_plan");
      expect(f.fs.fds.size).toBe(0);
      vi.restoreAllMocks();
    });

    it("requires ACK EOF, not just a plausible first line", async () => {
      const f = await seededController();
      const write = runMock.value.stdout.write;
      runMock.value.stdout.write = (line, done) => {
        const value = JSON.parse(line);
        if (value.schema === "airlock.pinned-image-hello.v1") {
          write(line, done);
          queueMicrotask(() => { runMock.value.stdin.emit("data", "{}\n"); runMock.value.stdin.emit("end"); });
          return true;
        }
        return write(line, done);
      };
      await expect(f.controller.runPinnedImage(f.controller.preparePinnedImage({
        binding_path: binding.binding_path, job_path: binding.case_root + "/job.json",
      }))).rejects.toThrow("image_ack_frame");
      expect(f.requests).toHaveLength(0);
    });

    it("rechecks the original deadline after HTTP construction before sending load bytes", async () => {
      const f = await seededController();
      runMock.handler = (options, callback) => {
        const req = f.reply(options, callback);
        if (options.method === "POST") runMock.value.ns += fixture.pins.budgetNs;
        return req;
      };
      await expect(f.controller.runPinnedImage(planFor(f))).rejects.toThrow("image_original_budget");
      expect(f.requests.filter(r => r.options.method === "POST")).toHaveLength(0);
      expect(f.fs.files.has(binding.canonical_reservation_path)).toBe(true);
      const unknown = JSON.parse(f.fs.files.get(binding.case_root + "/image-unknown.json").bytes);
      expect(unknown.status).toBe("UNKNOWN");
      expect(unknown.no_retry_or_cleanup).toBe(true);
    });

    it("retains every original intent metadata field, not merely identical bytes", async () => {
      const f = await seededController(), sync = fsMock.state.fsyncSync;
      let changed = false;
      fsMock.state.fsyncSync = fd => {
        sync(fd);
        const intent = f.fs.files.get("/unit/actual-one/operation-intent.json");
        // Change identity after shared publisher's final readback, at the next
        // canonical reservation directory sync.
        if (intent && f.fs.files.has("/unit/image-load.reserved") && !changed) {
          changed = true; intent.s.ctimeMs++; intent.s.ctimeNs += 1000000n;
        }
      };
      const p = f.controller.preparePinnedImage({ binding_path: binding.binding_path, job_path: binding.case_root + "/job.json" });
      await expect(f.controller.runPinnedImage(p)).rejects.toThrow("image_intent_changed");
      expect(f.requests.filter(r => r.options.method === "POST")).toHaveLength(0);
      expect(f.fs.files.has("/unit/image-load.reserved")).toBe(true);
    });

    it("observes a pre-existing exact image without archive publication or import reservation", async () => {
      const f = await seededController();
      responseFault(f, res => { res.statusCode = 200; replaceBody(res, raw(f.inspect)); }, o => o.path.includes("/images/"));
      const result = await f.controller.runPinnedImage(planFor(f));
      expect(result.read_only_already_present).toBe(true);
      expect(result.import_dispatched).toBe(false);
      expect(result.image.repo_digests).toEqual([]);
      expect(f.requests).toHaveLength(3);
      expect(f.fs.files.has("/unit/actual-one/archive.tar")).toBe(false);
      expect(f.fs.files.has("/unit/image-load.reserved")).toBe(false);
    });

    it("returns the synced original result handle separately from its persisted body", async () => {
      const f = await seededController();
      const result = await f.controller.runPinnedImage(planFor(f));
      const original = f.io.imageOriginal(binding.case_root + "/image-result.json", { uid: 503, privateFile: true });
      try {
        expect(result.result_original).toEqual(original.handle);
        expect(result.result_original.sha256).toBe(sha(original.bytes));
        expect(JSON.parse(original.bytes)).not.toHaveProperty("result_original");
        const { result_original, ...body } = result;
        expect(body).toEqual(JSON.parse(original.bytes));
        expect(result_original.pid).toBeUndefined();
      } finally { original.close(); }
      expect(f.fs.fds.size).toBe(0);
    });

    it("carries the actual S publication attestation into the closed CLI END frame", async () => {
      const f = await seededController(), cli = await import("./pinned-node-image-cli.mjs");
      await cli.pinnedImageCli(["--binding", binding.binding_path, "--job", binding.case_root + "/job.json"]);
      expect(f.messages).toHaveLength(2);
      const original = f.io.imageOriginal(binding.case_root + "/image-result.json", { uid: 503, privateFile: true });
      try {
        expect(f.messages[1]).toEqual({ schema: "airlock.pinned-image-end.v1", pid: 555, nonce: f.job.nonce,
          status: "IMAGE_AVAILABLE_PENDING_OUTER_CLOSE", job_sha256: f.handle(binding.case_root + "/job.json").sha256,
          proof_sha256: f.handle(binding.case_root + "/source-reviewed.json").sha256, result_original: original.handle });
      } finally { original.close(); }
      expect(f.fs.fds.size).toBe(0);
    });

    it.each(["identity", "source", "deadline"])("rechecks %s after result sync/readback before returning its attestation", async kind => {
      const f = await seededController(), close = f.fs.closeSync;
      let changed = false;
      f.fs.closeSync = fd => {
        const file = f.fs.fds.get(fd);
        close(fd);
        if (!changed && file === f.fs.files.get(binding.case_root + "/image-result.json")) {
          changed = true;
          if (kind === "identity") { file.s.ctimeMs++; file.s.ctimeNs += 1000000n; }
          if (kind === "source") f.fs.files.get(f.controller.IMAGE_WORKSPACE + "/rig/pinned-node-image-cli.mjs").s.ctimeNs++;
          if (kind === "deadline") runMock.value.ns += 45000000000n;
        }
      };
      await expect(f.controller.runPinnedImage(planFor(f))).rejects.toThrow(
        kind === "deadline" ? "image_original_budget" : kind === "source" ? "image_original_changed" : "private_original_publication_changed");
      expect(f.fs.fds.size).toBe(0);
    });

    it.each([
      ["binding bytes", f => { f.fs.files.get(binding.binding_path).bytes[0] ^= 1; }, "image_binding_hash"],
      ["binding self path", f => f.fs.put("/unit/copied-binding.json", raw(binding)), "image_immutable_binding"],
      ["decision inode", f => { f.fs.files.get("/unit/decision.json").s.ino++; }, "image_genuine_decision_original"],
      ["decision dev", f => { f.fs.files.get("/unit/decision.json").s.dev++; }, "image_genuine_decision_original"],
      ["decision owner", f => { f.fs.files.get("/unit/decision.json").s.uid++; }, "private_original_metadata"],
      ["decision mode", f => { f.fs.files.get("/unit/decision.json").s.mode |= 0o040; }, "private_original_metadata"],
      ["decision link", f => { f.fs.files.get("/unit/decision.json").s.nlink++; }, "private_original_metadata"],
      ["binding private mode", f => { f.fs.files.get(binding.binding_path).s.mode |= 0o004; }, "private_original_metadata"],
      ["binding identity", f => { f.fs.files.get(binding.binding_path).s.ino++; }, "image_original_job_proof"],
      ["case directory original", f => { f.fs.files.get(binding.case_root).s.ino++; }, "image_original_case_directory"],
      ["UID", () => { runMock.value.uid++; }, "image_fixed_runtime_or_environment"],
      ["Node executable path", () => { runMock.value.exe = "/other-node"; }, "image_fixed_runtime_or_environment"],
      ["Node version", () => { runMock.value.version = "v24.10.1"; }, "image_fixed_runtime_or_environment"],
      ["cwd", () => { runMock.value.cwd = "/unit/copied-case"; }, "image_fixed_runtime_or_environment"],
      ["NODE_OPTIONS", () => { runMock.value.env.NODE_OPTIONS = "--import=other"; }, "image_fixed_runtime_or_environment"],
      ["proxy", () => { runMock.value.env.HTTPS_PROXY = "https://proxy.invalid"; }, "image_fixed_runtime_or_environment"],
      ["credentials", () => { runMock.value.env.DOCKER_AUTH_CONFIG = "{}"; }, "image_fixed_runtime_or_environment"],
      ["environment ready", () => { runMock.value.env.READY = "true"; }, "image_fixed_runtime_or_environment"],
      ["source bytes", f => { f.fs.files.get(f.controller.IMAGE_WORKSPACE + "/rig/pinned-node-image-cli.mjs").bytes[0] ^= 1; }, "image_complete_reviewed_source_closure"],
      ["source identity", f => { f.fs.files.get(f.controller.IMAGE_WORKSPACE + "/rig/pinned-node-image-source.mjs").s.ino++; }, "image_complete_reviewed_source_closure"],
      ["caller identity", f => { f.fs.files.get("/unit/source/image_outer.py").s.ctimeNs++; }, "image_reviewed_executable_or_caller"],
      ["caller tests", f => { f.fs.files.get("/unit/source/test_image_outer.py").bytes[0] ^= 1; }, "image_reviewed_executable_or_caller"],
      ["Node identity", f => { f.fs.files.get(fixture.pins.node).s.ino++; }, "image_reviewed_executable_or_caller"],
      ["copied job", f => { const j = structuredClone(f.job); j.case_root = "/copied"; rewrite(f, binding.case_root + "/job.json", j); }, "image_original_job_proof"],
      ["job ready flag", f => rewrite(f, binding.case_root + "/job.json", { ...f.job, ready: true }), "invalid_case_input"],
      ["socket owner", f => { f.fs.files.get("/unit/docker/socket").s.uid++; }, "image_socket_owner_or_mode"],
      ["socket writable", f => { f.fs.files.get("/unit/docker/socket").s.mode |= 0o020; }, "image_socket_owner_or_mode"],
      ["socket directory writable", f => { f.fs.files.get("/unit/docker").s.mode |= 0o002; }, "image_socket_owner_or_mode"],
      ["capacity digest", f => { f.fs.files.get("/unit/capacity.json").bytes[0] ^= 1; }, "image_capacity_original_hash"],
      ["host reserve", f => { f.fs.statfsSync = () => ({ bavail: 1n, bsize: 1n }); }, "image_host_reserve"],
      ["preallocated debris", f => f.fs.put("/unit/actual-one/archive.tar", Buffer.from("partial")), "image_fresh_job_root"],
    ])("refuses %s before even a read-only daemon request", async (name, change, reason) => {
      const f = await seededController(); change(f);
      const input = { binding_path: name === "binding self path" ? "/unit/copied-binding.json" : binding.binding_path,
        job_path: binding.case_root + "/job.json" };
      expect(() => f.controller.preparePinnedImage(input)).toThrow(reason);
      expect(f.requests).toHaveLength(0);
      expect(f.fs.fds.size).toBe(0);
    });

    it("burns an opaque plan before a failed recheck and rejects serializations/copies", async () => {
      const f = await seededController(), plan = planFor(f);
      f.fs.files.get(binding.binding_path).s.ctimeNs++;
      await expect(f.controller.runPinnedImage(plan)).rejects.toThrow("image_original_changed");
      await expect(f.controller.runPinnedImage(plan)).rejects.toThrow("image_plan_used");
      for (const copy of [JSON.parse(JSON.stringify(plan)), { ...plan }, Object.create(plan)])
        await expect(f.controller.runPinnedImage(copy)).rejects.toThrow("image_private_plan");
      expect(f.requests).toHaveLength(0);
    });

    it.each(["pid", "nonce", "job_sha256", "proof_sha256", "issued_sha256", "schema", "remaining_ns", "extra"])(
      "refuses a changed %s ACK without contacting the daemon", async key => {
        const f = await seededController(), emit = runMock.value.stdin.emit;
        runMock.value.stdin.emit = function (event, ...args) {
          if (event === "data") {
            const value = JSON.parse(args[0]);
            value[key] = key === "pid" ? 556 : key === "remaining_ns" ? "45000000001" : "f".repeat(64);
            args[0] = JSON.stringify(value) + "\n";
          }
          return emit.call(this, event, ...args);
        };
        await expect(f.controller.runPinnedImage(planFor(f))).rejects.toThrow();
        expect(f.requests).toHaveLength(0);
      });

    it("charges the pre-HELLO gap and refuses a late ACK without renewal", async () => {
      const f = await seededController(), emit = runMock.value.stdin.emit;
      runMock.value.stdin.emit = function (event, ...args) {
        if (event === "end") runMock.value.ns += 45000000000n;
        return emit.call(this, event, ...args);
      };
      await expect(f.controller.runPinnedImage(planFor(f))).rejects.toThrow("image_ack_original_budget");
      expect(f.requests).toHaveLength(0);
    });

    it("releases handshake timers/listeners even when the stdout writer throws synchronously", async () => {
      const f = await seededController(); vi.useFakeTimers();
      runMock.value.stdout.write = () => { throw Error("broken owned stdout"); };
      await expect(f.controller.runPinnedImage(planFor(f))).rejects.toThrow("image_hello_output");
      expect(vi.getTimerCount()).toBe(0);
      expect(runMock.value.stdin.listenerCount("data")).toBe(0);
      expect(f.requests).toHaveLength(0);
    });

    it.each([
      ["HTTP 200 error", res => replaceBody(res, Buffer.from('{"error":"load failed"}\r\n')), "image_load_application_error"],
      ["HTTP 200 errorDetail", res => replaceBody(res, Buffer.from('{"errorDetail":{"message":"unpack"}}\n')), "image_load_application_error"],
      ["HTTP 200 unpack stream", res => replaceBody(res, Buffer.from('{"stream":"Error unpacking image sha256:bad"}\n')), "image_load_application_error"],
      ["unknown stream", res => replaceBody(res, Buffer.from('{"stream":"accepted"}\n')), "image_load_unexpected_stream"],
      ["truncated JSON", res => replaceBody(res, Buffer.from('{"stream":')), "image_load_response_frame"],
      ["redirect", res => { res.statusCode = 302; }, "image_http_status"],
      ["status failure", res => { res.statusCode = 500; }, "image_http_status"],
      ["aborted body", res => {
        const emit = res.emit; res.emit = function (event, ...args) { if (event === "data") emit.call(this, "aborted"); return emit.call(this, event, ...args); };
      }, "image_http_aborted"],
      ["early close", res => {
        res.complete = false; const emit = res.emit;
        res.emit = function (event, ...args) { return event === "end" ? false : emit.call(this, event, ...args); };
      }, "image_http_incomplete"],
      ["inconsistent readable end", res => { res.readableEnded = false; }, "image_http_incomplete"],
      ["wrong length", res => { res.headers["content-length"] = "0"; }, "image_http_framing"],
      ["double framing", res => { res.headers["transfer-encoding"] = "chunked"; }, "image_http_framing"],
      ["wrong content type", res => { res.headers["content-type"] = "text/html"; }, "image_http_content_type"],
      ["non-JSON", res => replaceBody(res, Buffer.from("not JSON\n")), "invalid_case_json"],
      ["oversized body", res => replaceBody(res, Buffer.alloc(65537, 32)), "image_http_response_bound"],
    ])("keeps %s UNKNOWN, retains the canonical burn, and never retries/cleans up", async (_name, action, reason) => {
      const f = await seededController(); responseFault(f, action);
      const plan = planFor(f);
      await expect(f.controller.runPinnedImage(plan)).rejects.toThrow(reason);
      expect(f.requests.filter(r => r.options.method === "POST")).toHaveLength(1);
      expect(f.requests.some(r => /delete|prune|build|containers|pull|tag/.test(r.options.path))).toBe(false);
      expect(f.fs.files.has("/unit/image-load.reserved")).toBe(true);
      const report = JSON.parse(f.fs.files.get("/unit/actual-one/image-unknown.json").bytes);
      expect(report.status).toBe("UNKNOWN");
      expect(report.daemon_cancellation_or_generic_settlement_claimed).toBe(false);
      await expect(f.controller.runPinnedImage(plan)).rejects.toThrow("image_plan_used");
      expect(f.fs.fds.size).toBe(0);
    });

    it.each(["socket", "engine", "source", "archive", "clock", "duplicate"])(
      "rechecks %s after blocking intent publication and refuses before POST", async name => {
        const f = await seededController();
        let infoCount = 0;
        if (name === "duplicate") f.fs.put("/unit/image-load.reserved", Buffer.from("other owner's irreversible intent"));
        responseFault(f, res => {
          infoCount++;
          if (infoCount === 2) {
            if (name === "socket") f.fs.files.get("/unit/docker/socket").s.ino++;
            if (name === "source") f.fs.files.get(f.controller.IMAGE_WORKSPACE + "/rig/pinned-node-image-cli.mjs").s.ctimeNs++;
            if (name === "archive") f.fs.files.get("/unit/actual-one/archive.tar").bytes[600] ^= 1;
            if (name === "clock") runMock.value.ns += 45000000000n;
            if (name === "engine") replaceBody(res, raw({ ID: "different-engine", ServerVersion: "28.5.1", DockerRootDir: "/var/lib/docker",
              Driver: "overlayfs", DriverStatus: [["driver-type", "io.containerd.snapshotter.v1"]], OSType: "linux", Architecture: "aarch64" }));
          }
        }, o => o.path.endsWith("/info"));
        await expect(f.controller.runPinnedImage(planFor(f))).rejects.toThrow();
        expect(f.requests.filter(r => r.options.method === "POST")).toHaveLength(0);
        expect(f.fs.files.has("/unit/image-load.reserved")).toBe(true);
      });

    it("does not treat request/response close as socket closure or pending writes completion", async () => {
      const f = await seededController();
      let release, reached;
      const pending = new Promise(resolve => { reached = resolve; });
      runMock.handler = (options, cb) => {
        const req = f.reply(options, cb);
        if (options.method === "POST") {
          const emit = req.emit;
          req.emit = function (event, ...args) {
            if (event === "socket") {
              const socket = args[0], socketEmit = socket.emit;
              socket.emit = function (type, ...rest) {
                if (type === "close") { release = () => socketEmit.call(this, type, ...rest); reached(); return false; }
                return socketEmit.call(this, type, ...rest);
              };
            }
            return emit.call(this, event, ...args);
          };
        }
        return req;
      };
      let completed = false;
      const result = f.controller.runPinnedImage(planFor(f)).then(value => { completed = true; return value; });
      await pending;
      expect(completed).toBe(false);
      expect(f.requests.filter(r => r.options.path.endsWith("/json"))).toHaveLength(1);
      release();
      expect((await result).handler_response_complete).toBe(true);
    });

    it.each(["request", "socket"])("refuses pending %s writes even when HTTP body and close events look complete", async kind => {
      const f = await seededController();
      runMock.handler = (options, callback) => {
        const req = f.reply(options, callback);
        if (options.method === "POST") {
          if (kind === "request") req.writableLength = 1;
          else {
            const emit = req.emit;
            req.emit = function (event, ...args) {
              if (event === "socket") args[0].writableLength = 1;
              return emit.call(this, event, ...args);
            };
          }
        }
        return req;
      };
      await expect(f.controller.runPinnedImage(planFor(f))).rejects.toThrow("image_http_incomplete");
      expect(f.requests.filter(r => r.options.method === "POST")).toHaveLength(1);
      expect(f.fs.files.has(binding.canonical_reservation_path)).toBe(true);
    });

    it("persists the irreversible reservation even when POST construction throws", async () => {
      const f = await seededController();
      runMock.handler = (options, cb) => {
        if (options.method === "POST") throw Error("post constructor ambiguity");
        return f.reply(options, cb);
      };
      await expect(f.controller.runPinnedImage(planFor(f))).rejects.toThrow("post constructor ambiguity");
      expect(JSON.parse(f.fs.files.get("/unit/actual-one/image-unknown.json").bytes).status).toBe("UNKNOWN");
      expect(f.fs.files.has("/unit/image-load.reserved")).toBe(true);
    });

    it("retains a timed-out owned POST until client close, never calling it daemon settlement", async () => {
      const f = await seededController();
      vi.useFakeTimers();
      let posted;
      const reached = new Promise(resolve => { posted = resolve; });
      runMock.handler = (options, cb) => {
        if (options.method !== "POST") return f.reply(options, cb);
        const req = new EventEmitter(), socket = new EventEmitter();
        req.writableLength = 0; req.writableFinished = true; socket.writableLength = 0;
        req.end = body => {
          f.requests.push({ options, body });
          queueMicrotask(() => { req.emit("socket", socket); req.emit("finish"); posted(); });
        };
        req.destroy = () => { req.emit("error", Error("owned deadline")); req.emit("close"); socket.emit("close"); };
        return req;
      };
      const result = f.controller.runPinnedImage(planFor(f));
      const rejection = expect(result).rejects.toThrow("image_original_budget");
      await vi.advanceTimersByTimeAsync(0);
      await reached;
      runMock.value.ns += 44000000000n;
      await vi.advanceTimersByTimeAsync(44000);
      await rejection;
      const report = JSON.parse(f.fs.files.get("/unit/actual-one/image-unknown.json").bytes);
      expect(report.status).toBe("UNKNOWN");
      expect(report.daemon_cancellation_or_generic_settlement_claimed).toBe(false);
      expect(f.requests.filter(r => r.options.method === "POST")).toHaveLength(1);
      expect(f.fs.files.has("/unit/image-load.reserved")).toBe(true);
      expect(vi.getTimerCount()).toBe(0);
    });

    it.each([1048576, 1048577])("enforces the actual GET response bound at %i bytes", async size => {
      const f = await seededController();
      const v = JSON.stringify({ Version: "28.5.1", ApiVersion: "1.51", Os: "linux", Arch: "arm64" });
      responseFault(f, res => replaceBody(res, Buffer.from(v + " ".repeat(size - v.length))), o => o.path.endsWith("/version"));
      if (size === 1048576) expect((await f.controller.runPinnedImage(planFor(f))).status).toBe("IMAGE_AVAILABLE_PENDING_OUTER_CLOSE");
      else {
        await expect(f.controller.runPinnedImage(planFor(f))).rejects.toThrow("image_http_response_bound");
        expect(f.requests).toHaveLength(1);
        expect(f.fs.files.has("/unit/image-load.reserved")).toBe(false);
      }
    });

    it("is exclusive for racing canonical reservations and never overwrites another intent", async () => {
      const f = await seededController();
      const results = await Promise.allSettled([1, 2].map(id => Promise.resolve().then(() =>
        f.io.reserveImageImport(binding.canonical_reservation_path, { operation: id }, 503))));
      expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
      expect(results.filter(r => r.status === "rejected")[0].reason.message).toBe("EEXIST");
      expect(JSON.parse(f.fs.files.get(binding.canonical_reservation_path).bytes)).toEqual({ operation: 1 });
    });

    it("does not falsely call a failed reservation publication unspent", async () => {
      const f = await seededController(), sync = f.fs.fsyncSync;
      f.fs.fsyncSync = fd => {
        if (f.fs.fds.get(fd) === f.fs.files.get(binding.canonical_reservation_path)) throw Error("lost reservation ACK");
        sync(fd);
      };
      await expect(f.controller.runPinnedImage(planFor(f))).rejects.toThrow("lost reservation ACK");
      expect(f.fs.files.has(binding.canonical_reservation_path)).toBe(true);
      const report = JSON.parse(f.fs.files.get(binding.case_root + "/image-unknown.json").bytes);
      expect(report.reservation_burned).toBe(null);
      expect(report.reservation_outcome).toBe("UNKNOWN_OR_PREEXISTING");
      expect(report.no_retry_or_cleanup).toBe(true);
      expect(f.requests.filter(r => r.options.method === "POST")).toHaveLength(0);
    });

    it.each([
      ["config ID instead of manifest", v => { v.Id = fixture.pins.config; }],
      ["descriptor", v => { v.Descriptor.digest = fixture.pins.config; }],
      ["descriptor platform", v => { v.Descriptor.platform.architecture = "amd64"; }],
      ["descriptor variant", v => { v.Descriptor.platform.variant = "v9"; }],
      ["descriptor annotations", v => { v.Descriptor.annotations = { invalid: { nested: true } }; }],
      ["platform", v => { v.Architecture = "amd64"; }],
      ["variant", v => { delete v.Variant; }],
      ["Env", v => { v.Config.Env.push("INJECTED=true"); }],
      ["diff IDs", v => { v.RootFS.Layers.reverse(); }],
      ["entrypoint", v => { v.Config.Entrypoint = ["/other"]; }],
      ["Cmd", v => { v.Config.Cmd = ["node", "workload"]; }],
    ])("independently rejects %s inspection even after a complete HTTP 200", async (_name, change) => {
      const f = await seededController(); change(f.inspect);
      await expect(f.controller.runPinnedImage(planFor(f))).rejects.toThrow("image_exact_manifest_inspection");
      expect(f.requests.filter(r => r.options.method === "POST")).toHaveLength(1);
    });
    it("accepts OCI platform metadata on the imported target without exposing nonidentity annotations", async () => {
      const f = await seededController();
      f.inspect.Descriptor.annotations = { "org.opencontainers.image.ref.name": "irrelevant-metadata" };
      const result = await f.controller.runPinnedImage(planFor(f));
      expect(result.image.descriptor).toEqual(descriptor(manifest, "manifest.v1+json"));
      expect(result.image.independently_unpack_verified).toBe(false);
    });
  });

  describe("closed byte and capacity boundary SOURCE oracles", () => {
    function repairChecksum(bytes, at = 0) {
      let sum = 8 * 32;
      for (let i = 0; i < 512; i++) if (i < 148 || i >= 156) sum += bytes[at + i];
      bytes.write(sum.toString(8).padStart(6, "0") + "\0 ", at + 148, "latin1");
    }

    function parsedTarEntries(bytes) {
      const rows = [];
      let at = 0;
      for (let i = 0; i < 9; i++) {
        const name = bytes.subarray(at, at + 100).toString("latin1").split("\0")[0];
        const field = bytes.subarray(at + 124, at + 136).toString("latin1");
        expect(field.slice(0, 11)).toMatch(/^[0-7]{11}$/);
        expect(field.slice(11)).toBe("\0");
        const size = Number.parseInt(field, 8), payload = at + 512;
        rows.push({ name, size, payload });
        at = payload + Math.ceil(size / 512) * 512;
      }
      expect(at + 1024).toBe(bytes.length);
      return rows;
    }

    it.each([
      ["name", b => { b[0] ^= 1; }, "image_tar_name"],
      ["name missing NUL", b => b.fill(65, 0, 100), "image_tar_name"],
      ["name trailing bytes", b => { b[11] = 65; }, "image_tar_name"],
      ["name high-bit encoding", b => { b[0] |= 0x80; }, "image_tar_name"],
      ["mode", b => b.write("0000640\0", 100, "latin1"), "image_tar_header"],
      ["uid", b => b.write("0000001\0", 108, "latin1"), "image_tar_header"],
      ["gid", b => b.write("0000001\0", 116, "latin1"), "image_tar_header"],
      ["mtime", b => b.write("00000000001\0", 136, "latin1"), "image_tar_header"],
      ["type", b => { b[156] = 53; }, "image_tar_header"],
      ["link", b => { b[157] = 65; }, "image_tar_header"],
      ["magic", b => { b[257] ^= 1; }, "image_tar_header"],
      ["magic high-bit encoding", b => { b[257] |= 0x80; }, "image_tar_header"],
      ["ustar version", b => { b[264] = 49; }, "image_tar_header"],
      ["unused uname", b => { b[265] = 1; }, "image_tar_header"],
      ["unused prefix", b => { b[345] = 1; }, "image_tar_header"],
      ["unused tail", b => { b[500] = 1; }, "image_tar_header"],
      ["number base-256", b => { b[124] = 0x80; }, "image_tar_number"],
      ["number high-bit octal alias", b => { b[124] |= 0x80; }, "image_tar_number"],
      ["number non-octal digit", b => { b[124] = 56; }, "image_tar_number"],
      ["number space prefix", b => { b[124] = 32; }, "image_tar_number"],
      ["number missing NUL", b => { b[135] = 32; }, "image_tar_number"],
    ])("independent archive parser catches checksummed %s semantics", async (_name, change, reason) => {
      const b = archive.encodeImageTar(entries()); change(b);
      repairChecksum(b);
      const sum = b.subarray(0, 512).reduce((n, value, at) => n + (at >= 148 && at < 156 ? 32 : value), 0);
      expect(b.subarray(148, 154).toString("latin1")).toMatch(/^[0-7]{6}$/);
      expect(b.subarray(154, 156).toString("latin1")).toBe("\0 ");
      expect(Number.parseInt(b.subarray(148, 154).toString("latin1"), 8)).toBe(sum);
      await expect(archive.verifyImageTar(b)).rejects.toThrow(reason);
    });

    it.each(["wrong octal sum", "high-bit checksum encoding"])("rejects %s in an otherwise intact header", async kind => {
      const b = archive.encodeImageTar(entries());
      if (kind === "wrong octal sum") {
        const sum = Number.parseInt(b.subarray(148, 154).toString("latin1"), 8);
        b.write((sum + 1).toString(8).padStart(6, "0") + "\0 ", 148, "latin1");
        expect(b.subarray(148, 154).toString("latin1")).toMatch(/^[0-7]{6}$/);
        expect(b.subarray(154, 156).toString("latin1")).toBe("\0 ");
      } else b[148] |= 0x80;
      await expect(archive.verifyImageTar(b)).rejects.toThrow("image_tar_checksum");
    });

    it.each(["padding", "blob content", "terminator"])("rejects actual %s bytes with a fault-specific reason", async kind => {
      const b = archive.encodeImageTar(entries()), rows = parsedTarEntries(b);
      let reason;
      if (kind === "padding") {
        const first = rows[0];
        expect(first.size % 512).not.toBe(0);
        b[first.payload + first.size] = 1;
        reason = "image_tar_payload_bound_or_padding";
      } else if (kind === "blob content") {
        const blob = rows.find(row => row.name === "blobs/sha256/" + sha(manifest));
        expect(b.subarray(blob.payload, blob.payload + blob.size).equals(manifest)).toBe(true);
        b[blob.payload] ^= 1;
        reason = "image_blob_content";
      } else {
        b[b.length - 1] = 1;
        reason = "image_tar_terminator";
      }
      await expect(archive.verifyImageTar(b)).rejects.toThrow(reason);
    });

    it("rejects extra entries, tag/ref-name entries, concatenated archives and truncation", async () => {
      const original = entries();
      expect(() => archive.encodeImageTar([...original, ["source-overlay", Buffer.from("code")]])).toThrow("image_closed_entries");
      original[0][0] = "../oci-layout";
      expect(() => archive.encodeImageTar(original)).toThrow("image_closed_entries");
      const b = archive.encodeImageTar(entries());
      await expect(archive.verifyImageTar(Buffer.concat([b, b]))).rejects.toThrow("image_tar_terminator");
      await expect(archive.verifyImageTar(b.subarray(0, -1))).rejects.toThrow("image_tar_length");
    });

    it("tests exact archive and expanded-stream maxima and +1 using the real encoder/parser/gunzip", async () => {
      const original = fixture.pins, bytes = archive.encodeImageTar(entries());
      const expanded = streams.reduce((n, b) => n + b.length, 0);
      try {
        fixture.pins = { ...original, archiveMax: bytes.length, expandedMax: expanded };
        vi.doMock("./pinned-node-image-pins.mjs", () => ({ P: fixture.pins }));
        vi.resetModules();
        const bounded = await import("./pinned-node-image-archive.mjs");
        expect((await bounded.verifyImageTar(bounded.encodeImageTar(entries()))).expandedBytes).toBe(expanded);
        fixture.pins = { ...original, archiveMax: bytes.length - 1, expandedMax: expanded };
        vi.doMock("./pinned-node-image-pins.mjs", () => ({ P: fixture.pins }));
        vi.resetModules();
        const shortArchive = await import("./pinned-node-image-archive.mjs");
        expect(() => shortArchive.encodeImageTar(entries())).toThrow("image_archive_bound");
        fixture.pins = { ...original, archiveMax: bytes.length, expandedMax: expanded - 1 };
        vi.doMock("./pinned-node-image-pins.mjs", () => ({ P: fixture.pins }));
        vi.resetModules();
        const shortExpanded = await import("./pinned-node-image-archive.mjs");
        await expect(shortExpanded.verifyImageTar(bytes)).rejects.toThrow("image_expanded_bound");
      } finally {
        fixture.pins = original;
        vi.doMock("./pinned-node-image-pins.mjs", () => ({ P: fixture.pins }));
        vi.resetModules();
      }
    });

    it.each([
      ["expired", (_r, _p, state) => { state.wall += 14400001; }, "image_capacity_age"],
      ["future", (r, p) => { p.collection_started_utc = p.collection_finished_utc = r.assessed_at = "2030-01-01T00:00:00Z";
        r.collection_interval_utc = [p.collection_started_utc, p.collection_finished_utc]; }, "image_capacity_age"],
      ["interval", r => { r.collection_interval_utc[0] = "2026-10-23T22:20:32Z"; }, "image_capacity_projection"],
      ["device", r => { r.backing_device = "/dev/vda2"; }, "image_capacity_projection"],
      ["mount", (_r, p) => { p.selected_storage_entries["vm/system/mount.txt"].capacity_mount_lines[0] = "/dev/vda2 on /var/lib type ext4 (rw)"; }, "image_capacity_mount"],
      ["root", (_r, p) => { p.selected_storage_entries["vm/docker/info.json"].storage_fields.DockerRootDir = "/elsewhere"; }, "image_capacity_mount"],
      ["standalone ready", (r, p) => { delete p.selected_storage_entries; r.ready = true; }, "invalid_case_input"],
      ["reserved claim", r => { r.capacity_reserved = true; }, "image_capacity_projection"],
      ["exact free-byte claim", r => { r.exact_free_bytes_claimed = true; }, "image_capacity_projection"],
      ["below guest bound", r => { r.reported_available = "15G"; }, "image_capacity_projection"],
      ["wrong unit", r => { r.reported_available = "777GB"; }, "image_capacity_projection"],
      ["df mismatch", (_r, p) => { p.selected_storage_entries["vm/system/df.txt"].capacity_text = "/dev/vda1 911G 89G 778G 11% /var/lib\n"; }, "image_capacity_mount"],
      ["projection archive mismatch", (_r, p) => { p.archive_sha256 = "0".repeat(64); }, "image_capacity_projection"],
      ["extra selected fields", (_r, p) => { p.selected_storage_entries["vm/docker/info.json"].storage_fields.extra = "log"; }, "image_capacity_mount"],
    ])("refuses %s capacity data rather than a ready flag", async (_name, change, reason) => {
      const f = await seededController(), r = structuredClone(capacity), p = structuredClone(projection);
      const state = { wall: Date.parse("2026-10-23T23:00:00Z") };
      change(r, p, state);
      r.storage_projection.sha256 = sha(raw(p));
      const b = { ...binding, capacity_projection_sha256: sha(raw(p)), capacity_receipt_sha256: sha(raw(r)) };
      expect(() => f.controller.validateImageCapacity(b, raw(r), raw(p), state.wall)).toThrow(reason);
    });

    it("accepts only the real response maximum, and a 2 GiB host reserve after staging", async () => {
      const f = await seededController();
      const line = JSON.stringify({ stream: "Loaded image ID: " + fixture.pins.manifest + "\n" });
      const bounded = Buffer.from(line + " ".repeat(65536 - Buffer.byteLength(line) - 1) + "\n");
      expect(f.controller.validateImageLoadResponse(bounded).loaded_manifest).toBe(fixture.pins.manifest);
      expect(() => f.controller.validateImageLoadResponse(Buffer.concat([bounded, Buffer.from("\n")]))).toThrow("image_load_response_bound");
      f.fs.statfsSync = () => ({ bavail: BigInt(fixture.pins.hostReserve), bsize: 1n });
      expect(f.io.imageHostSpace(binding.case_root).available_bytes).toBe(String(fixture.pins.hostReserve));
      expect(() => f.io.imageHostSpace(binding.case_root, 1)).toThrow("image_host_reserve");
    });

    it("rejects duplicate stream keys, hidden errors, progress noise and partial framing", async () => {
      const f = await seededController();
      for (const bytes of [
        Buffer.from('{"stream":"x","stream":"y"}\n'), Buffer.from('{"stream":"x","error":""}\n'),
        Buffer.from('{}\n{}\n'), Buffer.from('{"stream":"progress"}\n'), Buffer.from('{"stream":"x"}'),
      ]) expect(() => f.controller.validateImageLoadResponse(bytes)).toThrow();
    });
  });

  function memoryFs() {
    const files = new Map(), fds = new Map();
    let ino = 1, fd = 20;
    const put = (path, bytes = Buffer.alloc(0), type = "file", mode = type === "dir" ? 0o700 : 0o600) => {
      const s = { dev: 1, ino: ino++, size: bytes.length, mode: (type === "dir" ? 0o040000 : type === "socket" ? 0o140000 : 0o100000) | mode,
        uid: 503, nlink: 1, mtimeMs: 1000, ctimeMs: 1000, mtimeNs: 1000000000n, ctimeNs: 1000000000n,
        isFile: () => type === "file", isDirectory: () => type === "dir", isSymbolicLink: () => false, isSocket: () => type === "socket" };
      files.set(path, { s, bytes: Buffer.from(bytes) }); return files.get(path);
    };
    const get = path => { if (!files.has(path)) throw Object.assign(Error("ENOENT"), { code: "ENOENT" }); return files.get(path); };
    const api = {
      files, fds, put,
      openSync(path, flags) {
        if (flags === "wx") { if (files.has(path)) throw Object.assign(Error("EEXIST"), { code: "EEXIST" }); put(path); }
        fds.set(++fd, get(path)); return fd;
      },
      closeSync(fd) { if (!fds.delete(fd)) throw Error("bad fd"); },
      fstatSync(fd, options) {
        const { s } = fds.get(fd);
        return options?.bigint ? Object.fromEntries(Object.entries(s).map(([k, v]) => [k, typeof v === "number" ? BigInt(v) : v])) : { ...s };
      },
      lstatSync(path, options) {
        const { s } = get(path);
        return options?.bigint ? Object.fromEntries(Object.entries(s).map(([k, v]) => [k, typeof v === "number" ? BigInt(v) : v])) : { ...s };
      },
      readFileSync(fd) { return Buffer.from(typeof fd === "string" ? get(fd).bytes : fds.get(fd).bytes); },
      readSync(fd, b, offset, length, position) { return fds.get(fd).bytes.copy(b, offset, position, position + length); },
      writeSync(fd, b, offset, length) {
        const file = fds.get(fd); file.bytes = Buffer.concat([file.bytes, b.subarray(offset, offset + length)]);
        file.s.size = file.bytes.length; return length;
      },
      fsyncSync() {},
      realpathSync(path) { get(path); return path; },
      readdirSync(path) { return [...files.keys()].filter(p => p.startsWith(path + "/") && !p.slice(path.length + 1).includes("/")).map(p => p.slice(path.length + 1)); },
      statfsSync() { return { bavail: 1000000n, bsize: 4096n }; },
    };
    fsMock.state = api; return api;
  }

  describe("original archive publication SOURCE", () => {
    it("retains checked binary and directory descriptors through exclusive publication and readback", async () => {
      const fs = memoryFs(); fs.put("/case", undefined, "dir");
      const io = await import("./pinned-node-image-io.mjs");
      const bytes = archive.encodeImageTar(entries());
      const held = io.publishImageArchive("/case", bytes, 503);
      expect(held.bytes.equals(bytes)).toBe(true);
      expect(held.handle.sha256).toBe(sha(bytes));
      expect(fs.fds.size).toBe(3);
      held.check(); held.close();
      expect(fs.fds.size).toBe(0);
      expect(() => io.publishImageArchive("/case", bytes, 503)).toThrow("EEXIST");
    });
  });
});
