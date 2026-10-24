# WorkVerify Employer Invitation Security Tests v1
Status: checklist / NOT a passed test suite. No real employer invitations issued.

## Tested in production metadata (2026-10-23)
- Function definition confirms consumption rechecks request consent and independently confirmed contact.
- Anonymous role cannot execute invitation consumption RPC.
- Issued token count remained 0 after the migration.

## Required synthetic integration tests (not yet executed)
1. Service role issues invitation to a synthetic request with independently confirmed contact. Ensure only hash is stored.
2. Valid token + yes/no/unknown + respondent role creates one response, consumes token, returns pending_review and employment_verified=false.
3. Same token again: rejected without second response.
4. Expired or revoked token: rejected without response.
5. Change underlying request contact status to needs_review prior to submission: rejected.
6. Invalid input or missing response: rejected and token remains unused.
7. Simultaneous submissions: exactly one wins under row-level lock.
8. Anonymous and authenticated direct RPC access: denied.
9. No employer data leaked to another member.
10. Test original member-consent withdrawal: an explicit revocation mechanism is still required; consent timestamp alone cannot express withdrawal.
11. Server endpoint: CSRF/origin and rate limit, secret handling, and replay prevention.
12. Product gate: answers remain pending review and not WorkScore verified facts.

## Critical pending prerequisite
Build a first-class member withdrawal state and an authorized revocation function, then check it during issuance and consumption. A historical consent timestamp is not a live permission.
