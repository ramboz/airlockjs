import { createServer, connect } from "node:net";

if (process.argv[2] === "listener") {
  const server = createServer(socket => socket.destroy());
  server.listen(0, "127.0.0.1", () => process.send({ event: "listening", pid: process.pid, ...server.address() }));
} else if (process.argv[2] === "producer") {
  process.send({ event: "armed", pid: process.pid });
  process.on("message", ({ port }) => {
    const socket = connect({ host: "127.0.0.1", port });
    socket.once("connect", () => {
      process.send({ event: "connected" });
      socket.end("owned-synthetic-marker");
    });
    socket.once("error", error => process.send({ event: "connect-error", code: error.code }));
    socket.once("close", () => process.disconnect());
  });
} else {
  process.exitCode = 2;
}
