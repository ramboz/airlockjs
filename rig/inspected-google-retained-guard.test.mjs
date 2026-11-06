import { fork } from "node:child_process";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const fixture = fileURLToPath(new URL("./inspected-google-guard-process-fixture.mjs", import.meta.url));
const message = child => new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(Error("fixture_message_timeout")), 5000);
  child.once("message", value => { clearTimeout(timer); resolve(value); });
  child.once("error", error => { clearTimeout(timer); reject(error); });
});
const exited = child => new Promise(resolve => {
  if (child.exitCode !== null || child.signalCode !== null) resolve();
  else child.once("exit", resolve);
});
const listen = (server, port) => new Promise(resolve => {
  server.once("error", error => resolve(error.code));
  server.listen(port, "127.0.0.1", () => resolve("listening"));
});
const withOwnedServers = async (servers, run) => {
  try { return await run(); }
  finally {
    await Promise.all(servers.filter(server => server.listening).map(server =>
      new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()))));
  }
};

it("witnesses process listener loss reaching an independent replacement", async () => {
  const owner = fork(fixture, ["listener"]), producer = fork(fixture, ["producer"]);
  const receiver = createServer(), collision = createServer();
  await withOwnedServers([collision, receiver], async () => {
    try {
      const [address, armed] = await Promise.all([message(owner), message(producer)]);
      expect(address).toMatchObject({ event: "listening", address: "127.0.0.1", family: "IPv4" });
      expect(armed.event).toBe("armed");
      expect(await listen(collision, address.port)).toBe("EADDRINUSE");
      owner.kill("SIGKILL");
      await exited(owner);
      const replacement = await listen(receiver, address.port);
      expect(replacement).toBe("listening");
      const received = new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(Error("replacement_receive_timeout")), 5000);
        receiver.once("connection", socket => {
          let marker = "";
          socket.on("data", bytes => { marker += bytes; });
          socket.once("end", () => { clearTimeout(timer); resolve(marker); });
          socket.once("error", error => { clearTimeout(timer); reject(error); });
        });
      });
      const connected = message(producer);
      producer.send({ port: address.port });
      const [attempt, marker] = await Promise.all([connected, received]);
      await exited(producer);
      console.log(JSON.stringify({ owner_pid: address.pid, owner_loss: owner.signalCode, producer_pid: armed.pid,
        collision_before: "EADDRINUSE", replacement, attempted: attempt.event, marker }));
      expect(attempt.event).toBe("connected");
      expect(marker).toBe("owned-synthetic-marker");
    } finally {
      if (owner.exitCode === null && owner.signalCode === null) owner.kill("SIGKILL");
      if (producer.exitCode === null && producer.signalCode === null) producer.kill("SIGKILL");
      await Promise.all([exited(owner), exited(producer)]);
    }
  });
}, 15000);

it("closes a collision listener even when its assertion fails", async () => {
  const collision = createServer();
  try {
    await expect(withOwnedServers([collision], async () => {
      expect(await listen(collision, 0)).toBe("EADDRINUSE");
    })).rejects.toThrow();
    expect(collision.listening).toBe(false);
  } finally {
    if (collision.listening) await new Promise(resolve => collision.close(resolve));
  }
});
