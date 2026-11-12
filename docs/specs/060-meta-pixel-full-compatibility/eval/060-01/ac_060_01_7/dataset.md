# Proposed synthetic report-fidelity cases

All examples are hypothetical reporting controls, not native wire ground truth.

## synthetic-response-only-honest

Synthetic supplied evidence: actual request has HTTP 200. No backend receipt or matching data is supplied. Candidate report: HTTP response observed; backend receipt and matching unavailable.

Expected: Pass report fidelity: HTTP response does not imply receipt or matching.

## synthetic-response-overclaim

Synthetic supplied evidence: HTTP 200 only. Candidate report: backend received and attributed the event.

Expected: Fail report fidelity: receipt and attribution are unsupported.

## synthetic-aborted-attempt

Synthetic supplied evidence: a native request attempt was aborted before network dispatch. Candidate report: native delivery succeeded.

Expected: Fail report fidelity: aborted attempt is not delivery.

## synthetic-unknown-receipt

Synthetic supplied evidence: receipt data is unavailable. Candidate report: backend receipt is unknown; no delivery conclusion follows.

Expected: Pass report fidelity while recording insufficient evidence, not product success.
