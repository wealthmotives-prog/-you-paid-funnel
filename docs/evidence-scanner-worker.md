# WorkVerify ClamAV worker — prototype (disabled)

This worker is **source code only**, not an operational scanning service. It deliberately does not activate member uploads. Production use requires a trusted isolated runtime with Python 3.11+, ClamAV, current signature updates, monitoring, egress restrictions, secrets provisioning, container file-system limits, and staged authenticated integration tests.

## Run (trusted environment only)
Set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `YP_CLAMSCAN_BIN` and optionally `YP_SCAN_MAX_BYTES`. Invoke `python3 scripts/evidence_scanner_worker.py` on a worker that can access the private quarantine bucket. The worker checks scanner availability **before** claiming jobs; pulls 1 queued job by default; streams bytes into a temporary directory with a 12 MB limit; checks SHA256; invokes ClamAV; records clean/rejected/failed. No clean verdict on scanner error.

## Not yet solved
1. Verified file-type sniffing, archive bomb limits, OS-level sandboxing, and signature freshness enforcement.
2. True end-to-end test with private storage and quarantined EICAR fixture.
3. Scanner isolation and service-role secret security, retry/backoff plus recovering orphaned scanning jobs.
4. Signed job ownership/lease before more than one worker may write a verdict.
5. Confirmation of REST PATCH permissions and actual scan result database transition.
6. Controlled consent and public upload, operator triage, retention and deletion.
7. A clean malware scan is NOT employer verification or positive WorkScore evidence.

## Launch gate
Do not enable public evidence uploads and never grant browser credentials to the service role until these operational protections and tests pass.
