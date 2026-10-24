export const BINDING_SHA = "413d468b13fadd530270f0e1198169c5f3de12982750c3ea4e7c96803ac10865";
export const P = Object.freeze({
  bindingSha: BINDING_SHA,
  decisionSha: "e3d566929cbd59ada321391337f433d48f35323c3b07a4798d8ad5e13304e48f",
  decisionDev: 16777231, decisionIno: 540143612, uid: 503,
  indexSha: "3f50d10ac6e49f65cce348c0fb054f81e6181ad6e57c81892a1df71db048cf39",
  manifest: "sha256:5f6d18c1dffb526f36bc30b85e468daf017dfa9531ef9ab3c57bb0d2c64da5cb",
  config: "sha256:d4c19a76851d19b6473bcba5ec21630000c6469fcea58623ec166d19402f207f",
  manifestSize: 1931, configSize: 6802,
  layers: Object.freeze([
    ["21b7accdc53fc02b56a5c1cccd412be04189e5a5e674fd092ffbedc72596be91", 28102190, "b16af4a5daf8ae7d19b05a32bd91b5368256c4ee68e42fc250e6b3568e9bae70"],
    ["20fe36c90b06eba6124d405f4e513afd31d84311d589f8ad891a63623cdc7291", 3311, "b890e871f41de747ea1b3e4fc848a56090635f56a6f820db277e66c57871091f"],
    ["834ee619c58441c86a96c3027444942d537db626d7fda17ca62340b87a36cbf5", 51705103, "b544737189f5f9de22acd9f13f18b1e9cdbecfa97a952d711cde216ba94af945"],
    ["6e6be434a9dd4db18448a267e5a3ccc5c36e6161f1b83027abbe1b350520c028", 1712612, "83f966f1823538f65ae1e516f3d98e6614ebcf95a88311ca38035b5e14d47f1e"],
    ["b95cdfd4dde8fa1e5d494e53dca0971cc3a07e22e26fa3d69b49339083e37323", 445, "f392a20224d5f69bf278b115327b01573c84ad9aa4c5ddf8c9b5eb5c06e345ea"],
  ].map(([digest, size, diff]) => Object.freeze({ digest: "sha256:" + digest, size, diff: "sha256:" + diff }))),
  env: Object.freeze(["PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
    "NODE_VERSION=24.10.0", "YARN_VERSION=1.22.22"]),
  node: "/opt/homebrew/Cellar/node/24.10.0/bin/node",
  archiveMax: 100663296, expandedMax: 314572800, hostReserve: 2147483648,
  responseMax: 1048576, loadMax: 65536, capacityAge: 14400000, guestG: 16, budgetNs: 45000000000n,
});
