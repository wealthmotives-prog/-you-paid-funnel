# You Paid — Evidence Storage Read/Write Freeze
**October 28, 2026. Live policy migration applied and inspected.**

## Discovery
- Private bucket `you-paid-work-evidence`, 10 MiB maximum.
- A permissive authenticated user-folder INSERT policy was present despite frontend uploads being disabled.
- A permissive authenticated user-folder SELECT policy was also present, allowing the possibility of direct access to quarantined files owned by that user.
- Earlier restrictive INSERT policy `yp_evidence_upload_hard_pause` was already applied.

## Live change
Added `yp_evidence_read_hard_pause`: restrictive SELECT policy scoped to authenticated role and bucket `you-paid-work-evidence`.
Live `pg_policies` confirms both INSERT and SELECT restrictive policies are present with bucket-exclusion predicates.

## What this does and does not do
- Authenticated direct inserts/reads for the specified evidence bucket should fail under storage.objects RLS, even where prior permissive owner policies exist.
- Anonymous access remains governed by existing grants/policies; bucket is private.
- Service-role backends can bypass RLS. Do **not** infer that all service-originated writes, downloads, or signed URLs are blocked.
- We verified policy definitions; **we have not exercised an actual HTTP upload/read as two different authenticated identities**.
- This is a **temporary access freeze**, not a completed secure evidence intake service. It could restrict access to already-stored legitimate member evidence.
- No changes to credit reporting, scores or consumer-account terms.

## Required release prerequisites
1. Security owner verifies authenticated A/B/anonymous negative tests via authenticated storage HTTP API and confirms existing customer impact.
2. Service-side route authenticates member identity and strict record ownership, checks granular consent and request purpose, enforces upload type/size/path and per-member quota.
3. Objects enter private quarantine; independent malware scanning + attested result + human review before any authorized downstream read.
4. Short-lived signed URLs issued only after documented authorization, with audit logs and revocation strategy.
5. Scope-limited correction, withdrawal, retention and incident response procedures with operator permissions verified.
6. Never simply delete the hard-pause policies to restart unguarded uploads or reads; move to a restricted and tested service-mediated release flow.

## Supporting commits
`supabase/migrations/20261028_evidence_upload_hard_pause.sql`
`supabase/migrations/20261028_evidence_read_hard_pause.sql`
`tests/test_evidence_storage_freeze.py`

**No real pilot paystubs, identity documents or financial credentials should be submitted at this checkpoint.**
