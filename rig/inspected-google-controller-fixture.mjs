import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { connect as netConnect } from "node:net";
import { join, resolve } from "node:path";
import { connect as tlsConnect, createServer as tlsServer } from "node:tls";
import { fileURLToPath } from "node:url";
import { currentGoogleCohort } from "./inspected-google-cohort.mjs";
import { createLocalGoogleController, reserveLocalGoogleSlot } from "./inspected-google-controller.mjs";
import { inspectedMetaSourcePins } from "./inspected-meta-stock.mjs";
import { writeMetaPrivate } from "./native-stock-meta.mjs";

const hash = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const primary = "https://www.googleadservices.com/pagead/conversion/000000000/"
  + "?label=synthetic&value=1&currency_code=USD&oid=synthetic-transaction"
  + "&url=https%3A%2F%2Fowned.example%2Finspection&auid=synthetic-auid";

async function fixture(id) {
  if (!/^[a-f0-9]{16}$/.test(id)) throw Error("invalid_google_fixture_id");
  const parent = resolve("rig/out"), directory = join(parent, `google-node-${id}`);
  const result = join(parent, `google-result-${id}`), slot = join(parent, `google-slot-${id}`);
  const sourceBefore = inspectedMetaSourcePins(), cohortBefore = currentGoogleCohort();
  reserveLocalGoogleSlot(slot);
  mkdirSync(directory, { mode: 0o700 });
  let sink, transport;
  try {
    const key = join(directory, "key.pem"), cert = join(directory, "cert.pem");
    execFileSync("/usr/bin/openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "1",
      "-keyout", key, "-out", cert, "-subj", "/CN=www.googleadservices.com",
      "-addext", "subjectAltName=DNS:www.googleadservices.com"], { stdio: "ignore", timeout: 10000 });
    const credentials = { key: readFileSync(key), cert: readFileSync(cert) };
    let received = "";
    sink = tlsServer({ ...credentials, ALPNProtocols: ["http/1.1"] }, socket => {
      socket.on("error", () => {});
      socket.on("data", bytes => { received += bytes; socket.end("HTTP/1.1 200 OK\r\nContent-Length: 2\r\n\r\nok"); });
    });
    sink.on("tlsClientError", () => {});
    await new Promise((resolve, reject) => {
      sink.once("error", reject); sink.listen(0, "127.0.0.1", resolve);
    });
    const controller = createLocalGoogleController();
    for (const command of ["initialize", "configure", "conversion"]) controller.command(command);
    controller.observe({ network_id: "synthetic-node", url: primary, method: "GET", resource_type: "XHR" });
    transport = await controller.startLocalTransport({ inspector: credentials,
      receiver: { port: sink.address().port, certificate: credentials.cert }, protocol: "h1" });
    const socket = netConnect({ host: "127.0.0.1", port: transport.port });
    const status = await new Promise((resolve, reject) => {
      socket.setTimeout(5000, () => socket.destroy(Error("google_node_timeout")));
      socket.once("error", reject);
      socket.once("connect", () => socket.write("CONNECT www.googleadservices.com:443 HTTP/1.1\r\nHost: www.googleadservices.com:443\r\n\r\n"));
      socket.once("data", bytes => resolve(bytes.toString()));
    });
    if (!status.startsWith("HTTP/1.1 200 ")) throw Error("google_node_connect_failed");
    const secure = tlsConnect({ socket, servername: "www.googleadservices.com", ca: credentials.cert,
      ALPNProtocols: ["http/1.1"] });
    const url = new URL(primary), request = `GET ${url.pathname + url.search} HTTP/1.1\r\nHost: ${url.host}\r\n\r\n`;
    const response = await new Promise((resolve, reject) => {
      let output = "";
      secure.once("error", reject);
      secure.once("secureConnect", () => secure.write(request));
      secure.on("data", bytes => { output += bytes; });
      secure.once("end", () => resolve(output));
    });
    if (received !== request || !response.endsWith("\r\n\r\nok")) throw Error("google_node_receiver_mismatch");
    const report = await controller.finish(result);
    if (report.outcome !== "inconclusive" || report.capture_complete !== true) throw Error("google_node_capture_incomplete");
    const sourceAfter = inspectedMetaSourcePins(), cohortAfter = currentGoogleCohort();
    writeMetaPrivate(join(result, "source-binding.json"), {
      source_before: hash(sourceBefore), source_after: hash(sourceAfter),
      cohort_before: hash(cohortBefore), cohort_after: hash(cohortAfter),
    });
  } finally {
    if (transport) await transport.close();
    if (sink) await new Promise(resolve => sink.close(resolve));
    rmSync(directory, { recursive: true, force: true });
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try { await fixture(process.argv[2]); }
  catch { console.error("sdk_absent_google_node_fixture_failed"); process.exitCode = 1; }
}
