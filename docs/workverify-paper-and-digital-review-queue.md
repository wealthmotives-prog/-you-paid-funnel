# WorkVerify dual-channel employer responses — infrastructure checkpoint
Status: database installed; paper receipt processing and digital submissions NOT live.

## Principle
One factual review standard; two convenient ways to respond. Paper forms and electronic responses remain **unreviewed** until qualified source/authority verification and operator assessment.

## Built 2026-10-23
- public.employer_paper_responses: source request, three yes/no/unknown facts, respondent role, channel (postal_mail, secure_upload, business_fax, in_person), internal source reference, received timestamp, unreviewed state.
- public.employer_response_review_queue: security-invoker union view with source channel digital/paper, shared facts, review status and source reference.
- RLS enforced on paper table, no anonymous or ordinary-member read/write access to queue or paper records; service-role select/insert only.
- No raw scanned pages in this table; private storage and malware-processing must be available before storing actual paper scans or uploads.
- No external delivery, fax number, inbound email address, physical return address or public digital submission endpoint was activated.

## Operator experience to implement
1. A document arrives at independently verified return channel.
2. Approved operator logs receipt and creates a private storage evidence reference only after scanning and access controls.
3. Representative role/organization/source is cross-checked in a proportionate manner.
4. Facts appear in common review queue, marked unreviewed, with digital/paper provenance.
5. Reviewer resolves contradiction, marks verified scope only where substantiated, and provides member correction pathway.
6. Audit logs preserve received-via channel, reviewer actions and source evidence.

## Required remaining tests
- Synthetic paper insert and review queue retrieval with transaction rollback.
- Permission/RLS tests under actual service and member/anonymous sessions.
- Double-submission and contradictory evidence handling.
- Reviewer-authenticated status transitions with audit log.
- Member disputes, retention policy and redaction.
- Secure delivery/receiving and evidence-file malware scan.

## Important distinction
A completed traditional form does not by itself independently authenticate a signer or prove every fact stated.
