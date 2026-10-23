import { data, equal, json, record } from "./inspected-meta-record.mjs";
import { digest, fail } from "./sdk-absent-clock-observation-io.mjs";

export const ENGINE_FORMAT = '{"ID":{{json .ID}},"OSType":{{json .OSType}},"Architecture":{{json .Architecture}},"ServerVersion":{{json .ServerVersion}}}';
export function observationText(bytes) {
  try { return new TextDecoder("utf-8", { fatal: true }).decode(bytes); } catch { fail("observation_output_UTF8"); }
}
export function observationJSONLine(bytes) {
  const text = observationText(bytes);
  if (!text.endsWith("\n") || text.slice(0, -1).includes("\n") || text.includes("\r")) fail("observation_complete_single_LF_JSON");
  return json(bytes);
}
export const observationLabels = (p, b) => ({
  case_id: p.case_id, run_id: b.run_id, nonce: b.nonce, ticket: b.ticket,
  source_sha256: p.source_sha256, cohort_sha256: p.cohort_sha256,
});
export function observationInitEnv(p, b) {
  return { AIRLOCK_OBSERVATION_CASE: p.case_id, AIRLOCK_OBSERVATION_RUN: b.run_id,
    AIRLOCK_OBSERVATION_NONCE: b.nonce, AIRLOCK_OBSERVATION_TICKET: b.ticket,
    AIRLOCK_OBSERVATION_SOURCE: p.source_sha256, AIRLOCK_OBSERVATION_COHORT: p.cohort_sha256,
    AIRLOCK_OBSERVATION_IMAGE: p.image_id, AIRLOCK_OBSERVATION_ENGINE: p.engine.ID, HOME: "/case" };
}
function expected(p, b) {
  const env = [...p.image_env, ...Object.entries(observationInitEnv(p, b)).map(([k, v]) => k + "=" + v)];
  return {
    Entrypoint: [".Config.Entrypoint", ["/usr/local/bin/node"]],
    Cmd: [".Config.Cmd", ["/airlock/sdk-absent-clock-observation-init.mjs"]],
    Env: [".Config.Env", env], Labels: [".Config.Labels", observationLabels(p, b)],
    Hostname: [".Config.Hostname", "airlock-clock-" + p.case_id],
    WorkingDir: [".Config.WorkingDir", "/case"], User: [".Config.User", "65532:65532"],
    Healthcheck: [".Config.Healthcheck", { Test: ["NONE"] }], Volumes: [".Config.Volumes", null],
    ExposedPorts: [".Config.ExposedPorts", null],
    PidMode: [".HostConfig.PidMode", ""], IpcMode: [".HostConfig.IpcMode", "private"],
    NetworkMode: [".HostConfig.NetworkMode", "none"], UTSMode: [".HostConfig.UTSMode", ""],
    UsernsMode: [".HostConfig.UsernsMode", ""], CgroupnsMode: [".HostConfig.CgroupnsMode", "private"],
    Privileged: [".HostConfig.Privileged", false], ReadonlyRootfs: [".HostConfig.ReadonlyRootfs", true],
    AutoRemove: [".HostConfig.AutoRemove", false], Init: [".HostConfig.Init", false],
    CapDrop: [".HostConfig.CapDrop", ["ALL"]], CapAdd: [".HostConfig.CapAdd", null],
    SecurityOpt: [".HostConfig.SecurityOpt", ["no-new-privileges"]],
    Binds: [".HostConfig.Binds", null], HostMounts: [".HostConfig.Mounts", null], Mounts: [".Mounts", []],
    Devices: [".HostConfig.Devices", []], DeviceRequests: [".HostConfig.DeviceRequests", null],
    PortBindings: [".HostConfig.PortBindings", {}], DNS: [".HostConfig.DNS", []],
    DNSOptions: [".HostConfig.DNSOptions", []], DNSSearch: [".HostConfig.DNSSearch", []],
    ExtraHosts: [".HostConfig.ExtraHosts", null], GroupAdd: [".HostConfig.GroupAdd", null],
    Links: [".HostConfig.Links", null], VolumesFrom: [".HostConfig.VolumesFrom", null],
    Tmpfs: [".HostConfig.Tmpfs", null], PidsLimit: [".HostConfig.PidsLimit", 16],
    Memory: [".HostConfig.Memory", 67108864], MemorySwap: [".HostConfig.MemorySwap", 67108864],
    NanoCpus: [".HostConfig.NanoCPUs", 250000000],
    RestartPolicy: [".HostConfig.RestartPolicy", { Name: "no", MaximumRetryCount: 0 }],
    LogConfig: [".HostConfig.LogConfig", { Type: "none", Config: {} }],
  };
}
export function expectedClockObservationInspection(p, cid, status, b = null) {
  // The fixture may obtain the binding from the fixed create operation; this
  // constructor is NOT an ownership or readiness grant.
  if (b === null) fail("observation_inspection_binding_required");
  return { Id: cid, Name: "/airlock-clock-" + p.case_id, Image: p.image_id,
    ...Object.fromEntries(Object.keys(expected(p, b)).map(k => [k, true])),
    State: { Status: status, Running: status === "running", Dead: false, Restarting: false, Paused: false, ExitCode: 0 } };
}
export function observationInspectionTemplate(p, b) {
  const pairs = ['"Id":{{json .Id}}', '"Name":{{json .Name}}', '"Image":{{json .Image}}'];
  for (const [k, [path, value]] of Object.entries(expected(p, b)))
    pairs.push(JSON.stringify(k) + ":{{eq (json " + path + ") " + JSON.stringify(JSON.stringify(data(value))) + "}}");
  pairs.push('"State":{"Status":{{json .State.Status}},"Running":{{json .State.Running}},"Dead":{{json .State.Dead}},"Restarting":{{json .State.Restarting}},"Paused":{{json .State.Paused}},"ExitCode":{{json .State.ExitCode}}}');
  return "{" + pairs.join(",") + "}";
}
export function normalizeObservationInspection(p, b, bytes, cid) {
  const keys = ["Id", "Name", "Image", ...Object.keys(expected(p, b)), "State"];
  const r = record(observationJSONLine(bytes), keys);
  const s = record(r.State, ["Status", "Running", "Dead", "Restarting", "Paused", "ExitCode"]);
  if (!digest(r.Id) || (cid !== null && r.Id !== cid) || r.Name !== "/airlock-clock-" + p.case_id || r.Image !== p.image_id
    || Object.keys(expected(p, b)).some(k => r[k] !== true)
    || !["created", "running", "exited"].includes(s.Status) || s.Running !== (s.Status === "running")
    || s.Dead !== false || s.Restarting !== false || s.Paused !== false || s.ExitCode !== 0)
    fail("observation_exact_owned_CID_configuration");
  return r;
}
export function normalizeObservationEngine(p, bytes) {
  const e = record(observationJSONLine(bytes), ["ID", "OSType", "Architecture", "ServerVersion"]);
  if (!equal(e, p.engine)) fail("observation_engine_substitution");
  return e;
}
export function clockObservationDockerArgv(p, b, kind, cid) {
  const a = ["--config", p.root + "/docker-config", "--host", p.endpoint];
  if (kind === "engine") return [...a, "info", "--format", ENGINE_FORMAT];
  if (kind === "create") return [...a, "create", "--name", "airlock-clock-" + p.case_id,
    "--hostname=airlock-clock-" + p.case_id, "--pull=never",
    "--platform=linux/arm64/v8", "--network=none", "--ipc=private", "--read-only", "--user=65532:65532",
    "--cap-drop=ALL", "--security-opt=no-new-privileges", "--privileged=false", "--init=false",
    "--pids-limit=16", "--memory=64m", "--memory-swap=64m", "--cpus=0.25", "--restart=no", "--log-driver=none",
    "--no-healthcheck", ...Object.entries(observationLabels(p, b)).map(([k, v]) => "--label=" + k + "=" + v),
    ...Object.entries(observationInitEnv(p, b)).map(([k, v]) => "--env=" + k + "=" + v),
    "--entrypoint=/usr/local/bin/node", p.image_id, "/airlock/sdk-absent-clock-observation-init.mjs"];
  if (kind === "inspect-name") return [...a, "inspect", "--type=container", "--format", observationInspectionTemplate(p, b), "airlock-clock-" + p.case_id];
  if (!digest(cid)) fail("observation_exact_CID_required");
  if (kind === "inspect") return [...a, "inspect", "--type=container", "--format", observationInspectionTemplate(p, b), cid];
  if (kind === "start") return [...a, "start", "--attach", "--interactive", cid];
  if (kind === "stop" || kind === "stop-after-late-start") return [...a, "stop", "--time=1", cid];
  if (kind === "wait") return [...a, "wait", cid];
  if (kind === "remove") return [...a, "rm", cid];
  fail("observation_fixed_S_operation");
}
