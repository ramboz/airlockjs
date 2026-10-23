# SOURCE ONLY. Host-staged base bytes are not a prepared daemon image; no build/pull or image
# readiness is implied. A future minimal context must contain ONLY this exact
# first-party dependency closure, never the repository, HOME or workspace.
FROM docker.io/library/node@sha256:5f6d18c1dffb526f36bc30b85e468daf017dfa9531ef9ab3c57bb0d2c64da5cb
COPY --chown=65532:65532 sdk-absent-clock-observation-init.mjs sdk-absent-clock-observation-admission.mjs sdk-absent-clock-observation-protocol.mjs sdk-absent-clock-observation-plan.mjs sdk-absent-clock-observation-io.mjs inspected-meta-record.mjs /airlock/
USER 65532:65532
WORKDIR /case
ENTRYPOINT ["/usr/local/bin/node", "/airlock/sdk-absent-clock-observation-init.mjs"]
