// Only the fixed first-party container's selected, non-secret projection is
// requested. Never dump foreign Env, bind paths, command strings or labels.
import { data, equal, json, record } from "./inspected-meta-record.mjs";
import { digest, fail, freeze } from "./sdk-absent-owned-namespace-io.mjs";
import { namespacePlanEvidence } from "./sdk-absent-owned-namespace.mjs";

export const ENGINE_FORMAT = '{"ID":{{json .ID}},"OSType":{{json .OSType}},"Architecture":{{json .Architecture}},"ServerVersion":{{json .ServerVersion}}}';
export function namespaceAdapterContract(plan) {
  const p = namespacePlanEvidence(plan), raw = p.prepared_identity.adapter_contract;
  if (raw === null) fail("namespace_adapter_contract_NOT_PREPARED");
  const c = record(data(raw), ["schema", "status", "engine_info", "image_env", "mounts"]);
  const e = record(c.engine_info, ["ID", "OSType", "Architecture", "ServerVersion"]);
  if (c.schema !== "airlock.owned-namespace-docker-contract.v2" || c.status !== "SIMULATED_NOT_RUNTIME_PROOF"
    || e.ID !== p.engine_id || e.OSType !== "linux" || !["aarch64", "arm64"].includes(e.Architecture)
    || typeof e.ServerVersion !== "string" || !/^[A-Za-z0-9.+-]{1,64}$/.test(e.ServerVersion)
    || !equal(c.image_env, ["PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
      "NODE_VERSION=24.10.0", "YARN_VERSION=1.22.22"])
    || !Array.isArray(c.mounts) || c.mounts.length > 1) fail("namespace_fixed_adapter_contract");
  if (c.mounts.length) {
    const m = record(c.mounts[0], ["Type", "Source", "Destination", "Mode", "RW", "Propagation"]);
    if (m.Type !== "tmpfs" || m.Source !== "" || m.Destination !== "/case" || m.RW !== true
      || m.Propagation !== "" || m.Mode !== "rw,noexec,nosuid,nodev") fail("namespace_fixed_case_tmpfs");
  }
  return freeze(c);
}
export function normalizeOwnedNamespaceEngine(plan, bytes) {
  const actual = record(json(bytes), ["ID", "OSType", "Architecture", "ServerVersion"]);
  if (!equal(actual, namespaceAdapterContract(plan).engine_info)) fail("namespace_engine_changed");
  return freeze(actual);
}
function inspectionExpected(plan) {
  const p = namespacePlanEvidence(plan), c = namespaceAdapterContract(plan);
  return { p, fields: {
    Id: null, Name: "/airlock-owned-" + p.case_id, Image: p.image_id,
    Case: p.case_id, Nonce: p.labels.nonce, Source: p.source_sha256,
    User: "65532:65532", PidMode: "", IpcMode: "private", NetworkMode: "none",
    UtsMode: "", UsernsMode: "", CgroupnsMode: "private", Privileged: false, ReadonlyRootfs: true,
    AutoRemove: false, Memory: 67108864, MemorySwap: 67108864, NanoCpus: 250000000, PidsLimit: 32, Init: false,
  }, comparisons: {
    EntrypointMatches: [".Config.Entrypoint", ["/usr/local/bin/node"]],
    CmdMatches: [".Config.Cmd", ["/airlock/sdk-absent-owned-namespace-init.mjs"]],
    EnvMatches: [".Config.Env", ["AIRLOCK_CASE=" + p.case_id, "AIRLOCK_NONCE=" + p.labels.nonce, ...c.image_env]],
    WorkingDirMatches: [".Config.WorkingDir", "/case"],
    HealthcheckMatches: [".Config.Healthcheck", { Test: ["NONE"] }],
    VolumesMatches: [".Config.Volumes", null], ExposedPortsMatches: [".Config.ExposedPorts", null],
    LabelsMatches: [".Config.Labels", p.labels], CapDropMatches: [".HostConfig.CapDrop", ["ALL"]],
    CapAddEmpty: [".HostConfig.CapAdd", null], SecurityOptMatches: [".HostConfig.SecurityOpt", ["no-new-privileges"]],
    BindsEmpty: [".HostConfig.Binds", null], HostMountsEmpty: [".HostConfig.Mounts", null],
    MountsMatch: [".Mounts", c.mounts], DevicesEmpty: [".HostConfig.Devices", []],
    DeviceRequestsEmpty: [".HostConfig.DeviceRequests", null], PortBindingsEmpty: [".HostConfig.PortBindings", {}],
    DnsEmpty: [".HostConfig.Dns", []], DnsOptionsEmpty: [".HostConfig.DnsOptions", []],
    DnsSearchEmpty: [".HostConfig.DnsSearch", []], ExtraHostsEmpty: [".HostConfig.ExtraHosts", null],
    GroupAddEmpty: [".HostConfig.GroupAdd", null], LinksEmpty: [".HostConfig.Links", null],
    VolumesFromEmpty: [".HostConfig.VolumesFrom", null],
    TmpfsMatches: [".HostConfig.Tmpfs", p.config.tmpfs],
    RestartPolicyMatches: [".HostConfig.RestartPolicy", { Name: "no", MaximumRetryCount: 0 }],
    LogConfigMatches: [".HostConfig.LogConfig", { Type: "none", Config: {} }],
  } };
}
const expression = {
  Id: ".Id", Name: ".Name", Image: ".Image", Case: '(index .Config.Labels "case_id")',
  Nonce: '(index .Config.Labels "nonce")', Source: '(index .Config.Labels "source_sha256")',
  User: ".Config.User", UtsMode: ".HostConfig.UTSMode", NanoCpus: ".HostConfig.NanoCPUs",
};
export function ownedNamespaceInspectionTemplate(plan) {
  const expected = inspectionExpected(plan), pairs = [];
  for (const key of Object.keys(expected.fields)) {
    pairs.push(JSON.stringify(key) + ":{{json " + (expression[key] ?? ".HostConfig." + key) + "}}");
  }
  for (const [key, [path, value]] of Object.entries(expected.comparisons)) {
    const member = path.replace(".HostConfig.DnsOptions", ".HostConfig.DNSOptions")
      .replace(".HostConfig.DnsSearch", ".HostConfig.DNSSearch").replace(".HostConfig.Dns", ".HostConfig.DNS");
    pairs.push(JSON.stringify(key) + ":{{eq (json " + member + ") " + JSON.stringify(JSON.stringify(data(value))) + "}}");
  }
  pairs.push('"State":{"Status":{{json .State.Status}},"Running":{{json .State.Running}},"Dead":{{json .State.Dead}},"Restarting":{{json .State.Restarting}},"Paused":{{json .State.Paused}},"ExitCode":{{json .State.ExitCode}}}');
  return "{" + pairs.join(",") + "}";
}
export function ownedNamespaceExpectedProjection(plan, cid, status = "created") {
  // Source-fixture constructor as well as the shared exact normalization
  // contract. This constructs NO command and confers no ownership.
  const expected = inspectionExpected(plan);
  return { ...expected.fields, Id: cid, ...Object.fromEntries(Object.keys(expected.comparisons).map(k => [k, true])),
    State: { Status: status, Running: status === "running", Dead: false, Restarting: false, Paused: false, ExitCode: 0 } };
}
export function normalizeOwnedNamespaceInspection(plan, bytes, expectedCid) {
  const expected = inspectionExpected(plan), keys = [...Object.keys(expected.fields), ...Object.keys(expected.comparisons), "State"];
  const r = record(json(bytes), keys), state = record(r.State, ["Status", "Running", "Dead", "Restarting", "Paused", "ExitCode"]);
  if (!digest(r.Id) || (expectedCid !== null && r.Id !== expectedCid)) fail("namespace_foreign_container");
  for (const [key, value] of Object.entries(expected.fields)) {
    if (key !== "Id" && !equal(r[key], value)) fail("namespace_foreign_container");
  }
  if (Object.keys(expected.comparisons).some(key => r[key] !== true)) fail("namespace_foreign_container");
  if (!["created", "running", "exited"].includes(state.Status) || state.Running !== (state.Status === "running")
    || state.Dead !== false || state.Restarting !== false || state.Paused !== false
    || !Number.isInteger(state.ExitCode) || state.ExitCode < 0 || state.ExitCode > 255) fail("namespace_container_state_UNKNOWN");
  return freeze({ cid: r.Id, name: r.Name, image_id: r.Image, endpoint: expected.p.endpoint,
    engine_id: expected.p.engine_id, source_sha256: expected.p.source_sha256,
    labels: expected.p.labels, configuration_projection: r, state });
}

export function ownedNamespaceDockerArgv(plan, kind, cid) {
  const p = namespacePlanEvidence(plan), root = p.prepared_identity.root.path;
  const a = ["--config", root + "/docker-config", "--host", p.endpoint];
  if (kind === "engine-info") return [...a, "info", "--format", ENGINE_FORMAT];
  if (kind === "create") return [...a, "create", "--name", "airlock-owned-" + p.case_id, "--pull=never",
    "--platform=linux/arm64/v8", "--network=none", "--ipc=private", "--read-only", "--user=65532:65532",
    "--cap-drop=ALL", "--security-opt=no-new-privileges", "--privileged=false", "--init=false",
    "--pids-limit=32", "--memory=64m", "--memory-swap=64m", "--cpus=0.25", "--restart=no", "--log-driver=none",
    "--no-healthcheck", "--tmpfs=/case:" + p.config.tmpfs["/case"], "--label=case_id=" + p.case_id,
    "--label=nonce=" + p.labels.nonce, "--label=source_sha256=" + p.source_sha256,
    "--env=AIRLOCK_CASE=" + p.case_id, "--env=AIRLOCK_NONCE=" + p.labels.nonce,
    "--entrypoint=/usr/local/bin/node", p.image_id, "/airlock/sdk-absent-owned-namespace-init.mjs"];
  if (kind === "inspect-name" || kind === "inspect-cid") {
    if (kind === "inspect-cid" && !digest(cid)) fail("namespace_exact_CID_required");
    return [...a, "inspect", "--type=container", "--format", ownedNamespaceInspectionTemplate(plan),
      kind === "inspect-name" ? "airlock-owned-" + p.case_id : cid];
  }
  if (!digest(cid)) fail("namespace_exact_CID_required");
  if (kind === "start") return [...a, "start", "--attach", "--interactive", cid];
  if (kind === "stop" || kind === "stop-after-late-start") return [...a, "stop", "--time=1", cid];
  if (kind === "wait") return [...a, "wait", cid];
  if (kind === "remove") return [...a, "rm", cid];
  fail("namespace_fixed_S_operation");
}
