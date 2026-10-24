# Evidence Inspection Release Gate — 2026-10-23

## Current situation
The database has an evidence inspection queue, guard triggers, service-only job claiming, and file hash checks. The public member upload path remains disabled. No operational malware-scanning worker has been verified. No bureau furnishing or credit-score outcomes are live.

## Required sequence
1. An authorized user consents to a specific evidence purpose and receives a short-lived, member-scoped upload authorization.
2. File goes to private quarantine storage with size and format limits; never serve quarantined files as public links.
3. Server creates artifact metadata and a queued inspection job. No self-declared scan verdict can be accepted.
4. Trusted scanner worker claims the job using service credentials, inspects actual bytes for malware and content-type mismatches, calculates SHA-256 and verifies artifact linkage.
5. Database enforces queued -> scanning -> final clean/rejected/failed transitions; clean requires scanner identity, scan time and matching hash.
6. Only after clean scan may a separate provenance-review workflow authenticate the source. Clean file != authentic pay stub != verified attendance.
7. Authenticate employer/payroll provenance and supported period; reconcile against declared hours, and document exceptions and corrections.
8. Corrections should produce new audit-linked records; do not mutate historical source assertions silently.
9. Run signed-in cross-account, concurrency, malicious-file simulation, retries, expired URL, forged-result and outage tests in staging before enabling the portal.
10. Set up audit alerts and failure queues for scan crashes, processing stalls and mismatched evidence, with a defined retention/deletion policy.

## Current database guarantees
- Normal authenticated accounts have no direct inspection-job update privilege.
- A queued job cannot jump directly to clean/rejected/failed; requires scanning state.
- A completed verdict is not silently transitioned into another outcome.
- A clean verdict needs matching artifact hash, scanner name and scan timestamp.
- These gates protect state transitions; do not establish that any actual scanner exists.

## Unresolved adversarial concerns
- Reinspection after scanner-signature updates needs a new linked job/versioning design. A final verdict remains immutable.
- Scanner trust boundary and independent attestation of executed scan have not been established.
- Offline/large files, suspicious PDFs, OCR/PDF macro concerns and encrypted archives need explicit policy.
- Payroll/employer authenticity is separate from malware safety.
- No direct evidence of external bureau agreements exists; furnishing remains disabled.

## Owner approval gate
No live evidence intake, automated employer outreach, data sharing, paid provider account or credit furnishing without defined authorization, operating protections, and validation.
