// Reuse the existing read/hash-only source-vector boundary. It denies process,
// network and filesystem effects. Its private proof-root variable is not an
// execution-enabling flag, and this config cannot select actual controls.
import "./sdk-absent-clock-observation-integration.setup.mjs";
