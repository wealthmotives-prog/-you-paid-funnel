# You Paid — Cloudmersive Virus Scan Integration, v0.1
Updated November 21, 2026. User confirmed registration for Cloudmersive's $19.99 plan.

## What has been built
Staged Supabase Edge Function source:
`supabase/functions/evidence-cloudmersive-scanner/index.ts`.
- Disabled by default unless server-only `YOU_PAID_CLOUDMERSIVE_SCANNER_ENABLED=true` is configured. **Do not enable yet.**
- Service-role-only access, not callable by member JWTs (still use gateway JWT verification when deployed).
- Takes a server-side job UUID only. Never accepts a document from a public request.
- Downloads the exact previously quarantined Supabase object, verifies the linked storage path, 10 MiB limit, allowed PDF/JPG/PNG signatures and exact SHA-256 against evidence_artifacts.
- Invokes `POST https://api.cloudmersive.com/virus/scan/file` with `Apikey` header and multipart field `inputFile` from the backend only.
- Treats `CleanResult:true` with no reported viruses as a clean scan signal, false as infected, all other/error/timeout as indeterminate.
- Writes scanner name / timestamp / reason code to existing inspection job; does NOT mark evidence approved or make it readable.
- No logs of document payload or API key.
- Static and Node VM tests in `tests/test_cloudmersive_worker_contract.py` (no network calls); connected to offline CI.

## Operator configuration — private, NOT in chat
1. In Cloudmersive Management Portal, open API Keys. Create or select a separate API key for You Paid. Do not paste it into chats, screenshots, browser code, GitHub or logs.
2. In Supabase project `xknfxcyezchtypaisieu`, open **Edge Functions → Secrets** and securely add:
   - Name: `CLOUDMERSIVE_API_KEY`
   - Value: the secret key from Cloudmersive
   Leave `YOU_PAID_CLOUDMERSIVE_SCANNER_ENABLED` unset/false. Supabase secrets docs: https://supabase.com/docs/guides/functions/secrets
3. Confirm which region/vendor terms apply to third-party payroll data before any real transmission, including the plan's maximum file size, privacy/DPA and permitted use. The initial scanner uses Cloudmersive's public cloud endpoint.
4. Tell the engineering team **'Cloudmersive secret configured'** without sharing the value; review deployment and synthetic E2E QA before changing the enable flag.
5. If key is accidentally disclosed, rotate it in Cloudmersive and Supabase immediately.

## Important remaining release gates
- This is **staged code only** until explicit deployment; API key provisioning is not verified.
- A passing vendor response is not proof the content is harmless. Plan for malware scanner policy version, scanning errors, vendor rate limits, file format abuse checks and monitoring.
- Preflight and vendor scanning must be tied atomically to an immutable stored object and consent records, with lease/unique scan job claim and operator reviewer role. The current staged worker uses an optimistic update to avoid duplicate DB acceptance but concurrent requests can consume vendor calls; it is NOT an exactly-once job processor.
- Indeterminate verdicts intentionally remain quarantined and require manual retry workflow, which is not implemented.
- Actual two-account storage negative tests, secure signed consent intake, privacy review, contract review, and production human approval still required.
- Source code uses standard basic Virus Scan endpoint. Advanced content security rules are a later option after verifying plan support and API contract.
- Never upload the volunteer's personal paystubs to Cloudmersive test console at this stage.

## Vendor references
https://api.cloudmersive.com/docs/virus.asp
https://cloudmersive.com/blog/Testing-Cloudmersive-APIs-with-cURL

## Verification
GitHub commit confirms source change; Vercel deployment status only reflects website build, NOT an Edge Function deployment or an authenticated scanning request. No real document or API credential processed.
