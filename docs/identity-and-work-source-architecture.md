# You Paid — Identity and Work Source Architecture (Draft 1)

Status: architecture / sandbox-ready preparation only. No third-party integration, contract, identity check, or live data ingestion is represented as active.

## Separate assurances

1. **Account authentication**: Supabase session; not evidence of real-world identity.
2. **Identity verification**: provider-verified identity, proofing method, provider session reference, timestamps, expiry, and manual review outcome. Never place ID images, facial templates, complete SSNs or provider secrets in public tables.
3. **Source authorization**: specific scopes and purpose, authorized connection, revocation, provider terms, employer-vs-consumer consent distinction.
4. **Source authenticity**: verify webhook signatures / retrieve results server-to-server; never accept browser-submitted "verified" claims.
5. **Work-event verification**: objective statement, original event date, source-observed date, verification date, and evidence reference.
6. **Downstream distribution**: separate consent, permissible purpose, recipient contract, transmitted record version, and correction mechanisms.

## Source tiers

- Payroll-direct (Plaid Payroll Income, Argyle, Pinwheel, Truv): employee-directed payroll connection; inspect exact paystub/time fields available for each connection.
- Employer-authorized (Finch or Merge HRIS): organization authorizes data and You Paid separately documents worker-specific scope and permitted uses.
- Bank payroll (Plaid Bank Income): corroborates payroll deposits; does **not** by itself prove attendance or a particular number of workdays.
- Uploaded documents: untrusted until scanned, provenance reviewed, metadata reconciled and accepted by an authorized operator.
- Equifax The Work Number/Truework: specialized verification; credentialing, permissible-purpose and downstream use limitations must be reviewed.

## Stored records

- `identity_verification_sessions`: service-only IDV session and outcome.
- `source_connection_sessions`: service-only provider connection, scopes, and consent provenance.
- `source_observation_receipts`: service-only provider observation digest and timeline.
- `verification_events` / `evidence_artifacts`: existing evidence and review machinery.
- `provider_authorizations`, `data_sharing_consents`: maintain consent and revocation in the existing operating model.

Provider codes are internal categories, **not** assertions of active partnerships.

## Integration adapter contract

`begin(user, scopes, purpose)` -> server-generated connection session and provider client token

`complete(connection_id, provider_reference)` -> signature-verified or server-confirmed connection status

`fetch(connection_id)` -> raw source observation in restricted processing memory with minimal necessary persistence

`normalize(observation)` -> standardized assertion:
- source provider/system and immutable external id hash
- subject identity matching result
- employer identifier/name
- relationship start/end and source timestamp
- payroll period / pay date / observed hours or workday counts **only where supplied**
- measurement semantics and units
- evidence type, digest, and validation status
- source observation timestamp and ingestion timestamp
- explicit conflict/correction reference

`revoke(connection_id)` -> prevent future refreshes and downstream processing as required; preserve permitted historical audit facts, subject to retention/deletion obligations.

## Launch gates

- Legal review: approved purpose, FCRA/CRA roles, GLBA/privacy, biometrics, consent, redisclosure and derivative data permissions.
- Identity provider sandbox: identity mismatches, duplicates, failed/liveness, review, expiration, and recovery.
- Payroll provider sandbox: link, error, account mismatch, source availability, historical lookback, refresh, and revocation.
- Secure webhook: signature validation, deduplication, replay protection, backoff, and no raw secrets in logs.
- Safety: sensitive payload encryption, retention classifications, access logs, strict RLS and service-only access.
- Work claims: no verified status without independent source assessment; no inferred workdays from payroll amount alone.
- **Do not activate live access or claim credit bureau reporting without approved contracts and operational controls.**

## Shortlist to evaluate

Identity: Stripe Identity (pilot), Persona (configurable workflow), Alloy (orchestration).
Worker-connected payroll: Plaid Income, Argyle, Truv, Pinwheel, Atomic.
Employer HRIS: Finch, Merge.
Specialty VOE: Truework and Equifax The Work Number.
Fallback corroboration: bank income and scanned + reviewed documents.

## Vendor diligence questions

1. Are employment and payroll data available for standalone verification and longitudinal member records, not exclusively a single lending use?
2. Are storage, transformed/derived attributes, historical retention, and onward redistribution permitted? Under what consent and contract?
3. Which dates/fields are source-observed vs inferred? Can a provider show workdays/clock-ins or only pay periods?
4. What is actual coverage by payroll provider and segment for our test cohort? What is historical lookback?
5. What are pricing per link, refresh, re-verification, minimum commitment, sandbox access, and failed-link charges?
6. Does the integration involve consumer reports or FCRA obligations? Which party acts as CRA, user, furnisher or service provider?
7. Are identity assertions supported and how can they be securely matched to payroll accounts without overcollecting SSNs?
8. What are data subject request, source correction, incident notification, webhook signing, and retention requirements?
