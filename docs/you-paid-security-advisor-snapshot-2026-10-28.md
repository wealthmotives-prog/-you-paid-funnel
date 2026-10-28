# You Paid — Security Advisor Snapshot (Oct 28, 2026)
Read-only security advisor check, no corrective migrations made for these advisories.

## Observed findings
- INFO: 16 tables have RLS enabled but no policies. This can be an intentional service-only pattern. Evaluate individually before adding grants or policies. [Supabase lint 0008](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)
- WARN: one anonymously callable SECURITY DEFINER function: `public.unsubscribe_marketing(p_email text)`. Review whether access is intentional and whether abuse/rate limiting and narrowly scoped data mutations exist. Do **not** revoke without studying customer unsubscribe behavior. [Supabase lint 0028](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable)
- WARN: 21 callable SECURITY DEFINER functions for authenticated role. These require permission and function-body audits, especially before any sensitive pilot. A blanket revocation may break existing workflows. [Supabase lint 0029](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)
- WARN: leaked password protection is not enabled according to the advisor. Review and enable through authorized Auth settings when feasible. [Supabase password security](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)

## Release impact
Review privileged functions reachable by untrusted users, Auth safeguards, member/owner authorization, and controls on evidence_jobs and artifacts. No sensitive pilot uploads before security owner review.

## Verification limits
Findings reflect the read-only Supabase advisor response on October 28, 2026; no exploit was attempted and no production test data was created. No claim of a fully secure system is made.
