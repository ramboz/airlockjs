# SOURCE ONLY. Never use the repository/rig as the build context.
# A future reviewed preparation must stage ONLY these explicitly named sources
# in a fresh minimal context and prove the derived immutable image separately.
# No build/pull command or prepared-image claim is supplied by this file.
FROM docker.io/library/node@sha256:5f6d18c1dffb526f36bc30b85e468daf017dfa9531ef9ab3c57bb0d2c64da5cb
COPY --chown=65532:65532 sdk-absent-owned-namespace-init.mjs sdk-absent-owned-namespace-payload.mjs sdk-absent-owned-namespace-time.mjs sdk-absent-owned-namespace-io.mjs sdk-absent-owned-namespace-image-admission.mjs sdk-absent-owned-namespace-clock.json inspected-meta-record.mjs /airlock/
USER 65532:65532
WORKDIR /case
ENTRYPOINT ["/usr/local/bin/node", "/airlock/sdk-absent-owned-namespace-init.mjs"]
