# You Paid — Quarantine-to-Release Research Gate (v0.1)
Date: October 28, 2026. **Fictional/offline only.** No real files uploaded, no scanning service deployed, no production data release pathway enabled.

## State progression
`quarantined` -> `awaiting_review` after independent scanner pass -> `approved` after separate reviewer approval -> `revoked` on consent withdrawal. Scanner may instead mark `scan_rejected`. No transitions from rejected or revoked back to approved.

## Release predicates
Evidence is releasable in the **model only** if:
1. state is approved;
2. scanner evidence was recorded;
3. separate reviewer identity was recorded;
4. current consent remains active; and
5. requester matches the fictional owner.

The model's `actor` string is **not authentication**: production must cryptographically authenticate scanner service identity, validate scan result is bound to exact object hash, make the state transitions atomic, prevent stale consent/TOCTOU races, and enforce access via a server authorization route. Human review and malware scan must be independently logged; file signature/hash preflight is not antivirus scanning.

## Synthetic fixtures
Eleven tests cover quarantine default-deny, scanner-only deny, scanned-and-reviewed release, cross-owner deny, withdrawn consent, revocation irreversibility, untrusted actor rejection, missing scan proof, premature approval, rejected scan and untrusted reviewer. All records fictional.

## Production release blockers
- Direct member read/write evidence-bucket restrictions remain in force.
- Complete user ownership and consent authorization; service role never trusted merely because it holds a credential.
- Deploy independent scanning and verify isolated quarantine/approved buckets or object-visibility policies.
- Apply expiration, idempotency, dedicated service accounts, server-side audit logs, storage encryption, deletion/retention and privacy review.
- Perform actual HTTP A/B negative tests with isolated synthetic identities.
- Obtain explicit operator security signoff before any volunteer evidence.

This checkpoint is a specification and executable **state-machine unit**, not security certification. Consumer-account furnishing and grade/payment status remain separate.
