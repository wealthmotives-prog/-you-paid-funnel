# You Paid — Two confirmed Auth test accounts: safe next actions
Status: PREPARATION for synthetic Storage API authorization tests. No production upload enabled.

## What the server verified on November 21, 2026
- The two user-supplied email addresses each match exactly one Supabase Auth user in project `xknfxcyezchtypaisieu`.
- Both have non-null email confirmation timestamps.
- Neither currently owns rows in `public.evidence_artifacts` (aggregate count 0).
- This does not establish they have no *other* product data or that the users are exclusively test identities. Operator must confirm they are safe to use.
- Never commit emails, passwords, JWTs or vendor secrets to source control or share them in chat.

## Build delivered
`tests/workverify_storage_interactive_test.py`:
- Manual opt-in only (`--i-understand`).
- Prompts for both test emails and uses `getpass` to conceal passwords.
- Exchanges credentials with Supabase Auth over HTTPS and confirms distinct real JWT identities.
- Invokes existing synthetic `workverify_storage_negative_http.py` tests.
- Upload-denial tests use only a minimal, clearly fictional file and random filename; expected outcome: 401/403 for both accounts.
- If any upload succeeds or returns an unexpected response, STOP: synthetic object might have been created; inspect and safely remove via trusted operator process. No member uploads are activated.
- Read-denial test is SEPARATE and requires a *verified existing synthetic sentinel object*. A 404 is not accepted as proof of access denial.
- The launcher holds tokens in process memory; it does not log passwords or tokens. Run only on a trusted, updated computer and terminal. This is not a substitute for production privacy/security QA.
- `tests/test_storage_interactive_runner.py` checks static credential-handling safeguards.

## Exactly how to run locally (after confirming dedicated synthetic-only test accounts)
1. On your trusted Windows computer, open Windows PowerShell, navigate to your checked-out You Paid repository, ensure Python 3.12 is installed.
2. Copy the **public/publishable** Supabase API key (not the service-role/secret key) from project API Settings and set it in that local PowerShell session:
   `$env:YP_TEST_ANON_KEY = Read-Host "Enter Supabase publishable/anon key"`
   (Read-Host echo is normal for public key; never use this field for private secrets.)
3. Run `python tests/workverify_storage_interactive_test.py --i-understand --mode upload`.
4. Enter both dedicated test email addresses and their associated Supabase Auth **passwords** at the prompt; passwords won't be echoed. Do not send them to ChatGPT.
5. Record **only** the four HTTP status codes and any generic error. Successful expected upload run returns two 401/403 denials. If identity or authentication fails, the result is inconclusive.
6. Do NOT run `--mode read` yet. It requires a known, existing synthetic sentinel prepared through a trusted operator path without opening member uploads.
7. Clear local public key environment variable when done: `Remove-Item Env:\\YP_TEST_ANON_KEY`.

## Current release blockers
- Cloudmersive production scanner and synthetic probe remain hard-locked, despite deployed code.
- API-key validity has not yet been tested with a Cloudmersive request.
- Consent-backed server upload, signed object ownership, scan-job lease, reviewer authorization and full synthetic E2E security tests not completed.
- Real-person paystubs, bank records and employer contacts must not be collected.

## Important limitations
- Email confirmation does not mean passwords have been set, and accounts created via a dashboard may require a password setup flow first. Never reset credentials on accounts with legitimate other uses without checking.
- No real authenticated HTTP tests were executed when this document was written.
