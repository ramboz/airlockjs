import process from "node:process";
import { fileURLToPath } from "node:url";
import { preparePinnedImage, runPinnedImage } from "./pinned-node-image-import.mjs";

export async function pinnedImageCli(args) {
  if (args.length !== 4 || args[0] !== "--binding" || args[2] !== "--job") throw Error("image_fixed_cli");
  const result = await runPinnedImage(preparePinnedImage({ binding_path: args[1], job_path: args[3] }));
  await new Promise((resolve, reject) => {
    process.stdout.write(JSON.stringify({ schema: "airlock.pinned-image-end.v1", pid: process.pid, nonce: result.nonce,
      status: result.status, job_sha256: result.job.sha256, proof_sha256: result.proof.sha256,
      result_original: result.result_original }) + "\n", error => error ? reject(error) : resolve());
  });
}
if (process.argv?.[1] === fileURLToPath(import.meta.url)) {
  try { await pinnedImageCli(process.argv.slice(2)); }
  catch (error) {
    process.stderr.write("pinned image operation refused or UNKNOWN: " + error.message + "\n");
    process.exitCode = 1;
  }
}
