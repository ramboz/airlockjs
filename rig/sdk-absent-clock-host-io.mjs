import {
  closeSync, constants, fstatSync, fsyncSync, lstatSync, openSync, writeSync,
} from "node:fs";
import { data, equal } from "./inspected-meta-record.mjs";
import { fail, hash, observationDirectory, observationRead } from "./sdk-absent-clock-observation-io.mjs";

const identity = s => Object.fromEntries([
  ["dev", s.dev], ["ino", s.ino], ["size", s.size], ["mode", s.mode], ["uid", s.uid], ["nlink", s.nlink],
  ["mtime_ms", s.mtimeMs], ["ctime_ms", s.ctimeMs],
]);
const NAMES = ["host-request.json", "host-intent.json", "host-issued.json", "fixture-output.json", "host-close.json", "host-unknown.json",
  "pending-outer-tool-close.json"];
// Exclusive final names avoid a hardlink/unlink ctime exception altogether.
// An incomplete file is diagnostic debris, never an acknowledged publication
// or a reason to retry. The child cannot start until request+intent settle.
export function publishClockHostOriginal(root, name, value, uid) {
  const directory = observationDirectory(root, uid), bytes = Buffer.from(JSON.stringify(data(value)) + "\n");
  if (!NAMES.includes(name) || bytes.length > 65536) fail("host_fixed_publication_bound");
  const path = root + "/" + name;
  const fd = openSync(path, "wx", 0o600);
  try {
    const allocated = identity(fstatSync(fd));
    for (let offset = 0; offset < bytes.length;) {
      const n = writeSync(fd, bytes, offset, bytes.length - offset);
      if (!Number.isSafeInteger(n) || n <= 0 || n > bytes.length - offset) fail("host_publication_short_write");
      offset += n;
    }
    const written = identity(fstatSync(fd));
    if (written.dev !== allocated.dev || written.ino !== allocated.ino || written.nlink !== 1
      || written.uid !== uid || (written.mode & 0o777) !== 0o600 || written.size !== bytes.length)
      fail("host_publication_original_changed");
    fsyncSync(fd);
    const dfd = openSync(root, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
    try {
      const directoryFd = () => {
        const held = fstatSync(dfd);
        if (!held.isDirectory() || held.dev !== directory.dev || held.ino !== directory.ino
          || held.uid !== directory.uid || held.uid !== uid || held.mode !== directory.mode
          || (held.mode & 0o777) !== 0o700) fail("host_publication_directory_fd_changed");
      };
      // Directory entry counts/timestamps can change during our own publication;
      // descriptor custody cannot. Original FILE metadata remains exact below.
      directoryFd();
      fsyncSync(dfd);
      directoryFd();
      const after = observationDirectory(root, uid);
      const fresh = observationRead(path, { uid, maximum: 65536 });
      if (after.dev !== directory.dev || after.ino !== directory.ino
        || !equal(written, identity(fstatSync(fd))) || !equal(written, identity(lstatSync(path)))
        || !equal(fresh.handle, { path, ...written, sha256: hash(bytes) }) || !fresh.bytes.equals(bytes))
        fail("host_publication_original_changed");
      directoryFd();
      return fresh.handle;
    } finally { closeSync(dfd); }
  } finally { closeSync(fd); }
}
