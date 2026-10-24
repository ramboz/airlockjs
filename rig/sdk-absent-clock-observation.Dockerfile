# HISTORICAL, DISABLED derived-image prototype. The no-work SOURCE model now
# selects the pinned bare base and carries the fixed program in Node's argv.
# This file is not selected, built or evidence of prepared runtime/image state.
FROM docker.io/library/node@sha256:5f6d18c1dffb526f36bc30b85e468daf017dfa9531ef9ab3c57bb0d2c64da5cb
COPY --chown=65532:65532 sdk-absent-clock-observation-init.mjs sdk-absent-clock-observation-admission.mjs sdk-absent-clock-observation-protocol.mjs sdk-absent-clock-observation-plan.mjs sdk-absent-clock-observation-program.mjs sdk-absent-clock-observation-io.mjs private-original-file.mjs inspected-meta-record.mjs /airlock/
USER 65532:65532
WORKDIR /case
ENTRYPOINT ["/usr/local/bin/node", "/airlock/sdk-absent-clock-observation-init.mjs"]
