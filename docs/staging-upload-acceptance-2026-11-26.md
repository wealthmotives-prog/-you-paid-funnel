# Staging synthetic upload acceptance report — 2026-11-26

- **Environment:** staging `rzeodkcvljukaaczeibe` only. Production untouched. PRs not merged.
- **Code under test:** PR #2 `02c9533` (functional changes since review `afdafa1`: `9d154ad` body-drain fix, `02c9533` retry-409 fix; both found by this run).
- **Deployed:** `staging-evidence-upload` **v5**, bundle `13e5be42b51585f775bd6aabe0f8977f0f8ace315ee38361e53c05e027606dc7`. `staging-pilot-consent` v5, bundle `0aa8b883…` (unchanged since review).
- **Pre-run check:** PR #2 HEAD `4b7e09c` differed from reviewed `afdafa1` by documentation only. Deployed bundles matched the reviewed builds.
- **Identities (anonymous, server-marked `yp_synthetic_test`):** A `45e7e2fa-7337-4d37-a760-b8784e9022ea`, B `5a9998ae-5569-4dc6-9ad7-46af8ee938e9`, V `e126122b-ec84-457b-9daa-e62c20c19236`. U `5eba81ec-de9f-4032-998c-207e7ca7f812` is unmarked (negative control).
- **Files:** generated in the test harness; every file contains "FICTIONAL TEST DOCUMENT - NOT A REAL PERSON".
- **Fault injection:** temporary staging triggers `yp_test_fault_artifact` / `yp_test_fault_job`, scoped to the fictional employment records `513a005d…` / `a54a556c…` only.

## Results
| ID | Area | Case | Expected | Observed | Result |
|---|---|---|---|---|---|
| UA-01 | Auth | No Authorization header | 401 | 401 UNAUTHORIZED_NO_AUTH_HEADER | PASS |
| UA-02 | Auth | Public anon key as bearer | 401 invalid_session | 401 invalid_session | PASS |
| UA-03 | Auth | Malformed bearer | 401 | 401 INVALID_JWT_FORMAT | PASS |
| UA-04 | Identity | Unmarked anonymous member | 403 anonymous_session_not_permitted | same | PASS |
| UE-03 | Identity | Unmarked member, 2 MiB body | 403 promptly | 403 in 671 ms | PASS |
| UC-01 | Consent | Marked member, no consent | 403 consent_absent | same | PASS |
| UC-03 | Consent | Upload after revocation | 403 consent_revoked | same (revoke 200 → upload 403) | PASS |
| UC-05 | Consent | Other member unaffected by A's revocation | 201 | 201 (artifact `10e54a8d…`) | PASS |
| UH-01 | Headers | Content-Type image/png | 415 pdf_only | same | PASS |
| UE-01 | Headers | Wrong type, 2 MiB body | 415 promptly | 415 in 1177 ms | PASS |
| UH-02 | Headers | Missing X-Employment-Id | 400 employment_id_required | same | PASS |
| UO-01 | Ownership | A → B's employment record | 404 employment_record_not_found | same | PASS |
| UE-02 | Ownership | A → B's record, 2 MiB body | 404 promptly | 404 in 1392 ms | PASS |
| UO-02 | Ownership | Non-existent employment id | 404 | same | PASS |
| UO-03 | Ownership | B → A's employment record | 404 | same | PASS |
| UV-01 | Validation | PNG bytes declared as PDF | 422 not_a_pdf | same | PASS |
| UV-02 | Validation | Truncated (no %%EOF) | 422 pdf_truncated | same | PASS |
| UV-03 | Validation | Too small | 422 file_too_small | same | PASS |
| UV-04 | Validation | Empty body | 422 file_too_small | same | PASS |
| UV-05 | Validation | /OpenAction + /JavaScript | 422 pdf_active_content_rejected | same | PASS |
| UV-06 | Validation | Hex-obfuscated /J#61vaScript | 422 pdf_obfuscated_names_rejected | same | PASS |
| UV-07 | Validation | 10 MiB + 1 byte | 413 file_too_large | **v3: hung >38 s (no response)** → fixed `9d154ad` → v4/v5: 413 in 1381 ms | **FAIL → fixed → PASS** |
| US-01 | Success | Valid fictional PDF | 201 queued, quarantined, scanned:false, approved:false, server SHA = client SHA | exactly that; SHA `7d389a06…` | PASS |
| US-02 | Success | Valid 1 MiB fictional PDF | 201, SHA match | 201 in 2.5 s; SHA `1d052a06…` matches | PASS |
| UD-01 | Duplicates | Identical retry | 200 duplicate, same artifact and job | same | PASS |
| UD-02 | Duplicates | Two identical uploads in parallel | one 201 + one 200/409, one artifact | 201 + 409 concurrent_duplicate; 1 artifact; 0 orphans | PASS |
| UX-01 | Cross-member | B uploads the same bytes to B's record | 201 separate artifact | 201, distinct artifact under B's prefix | PASS |
| UX-02 | Direct access | A downloads own quarantined object | denied | 400/NoSuchKey (object proven to exist in DB, so RLS hid it) | PASS |
| UX-03 | Direct access | A downloads B's object | denied | 400/NoSuchKey (object exists) | PASS |
| UX-04 | Direct access | A creates signed URL for own object | denied | 400/NoSuchKey | PASS |
| UX-05 | Direct access | A direct Storage upload | denied | 403 RLS violation | PASS |
| UX-06 | Direct access | A REST read of evidence_artifacts | denied | 403 42501 | PASS |
| UX-07 | Direct access | A REST insert of inspection job | denied | 403 42501 | PASS |
| UX-08 | Direct access | A REST self-approve own artifact | denied | 403 42501 | PASS |
| UX-09 | Direct access | A REST write to review ledger | denied | 403 42501 | PASS |
| UF-01 | Partial failure | Artifact insert fails after storage write | 500 artifact_record_failed, recorded:false, orphan removed | 500; server log "orphan_removed true"; no artifact row; 0 orphan objects | PASS |
| UF-02 | Partial failure | Job insert fails after artifact insert | 500 inspection_job_failed, artifact flagged | 500; artifacts `962ba2b3…` and `439282a5…` = reconciliation_required, no job | PASS |
| UF-03 | Partial failure | Retry of the job-failed intake | must not read as success | **v4: 200 duplicate (job_state missing)** → fixed `02c9533` → v5: 409 reconciliation_required, no new artifact | **FAIL → fixed → PASS** |

**Totals: 38 cases, 38 PASS on the final build** (2 defects found, fixed, redeployed and re-verified). Part 1 was re-run on v4 after the drain fix: 15/15.

## Integrity read-back (database + Storage)
All 7 new artifacts:
- the stored object exists, object size = recorded size, and mimetype is `application/pdf`
- the path is server-owned `<user_id>/<artifact_id>.pdf`, and the job path matches
- normal intakes have job `queued`, no scanner, no failure code
- metadata records consent v2, text hash `61009cfa…`, the consent owner equals the uploader, and `synthetic:true`

Server SHA-256 equals the client SHA-256 for every success case.

Totals after the run: 11 artifacts (4 pre-existing untouched, 7 new), 9 jobs, 11 objects, **0 orphan objects**, 0 artifacts outside received/reconciliation_required, 0 review events, 0 uploads by unmarked accounts, 0 rows for the artifact-fault record.

**Limitation:** re-hashing the stored bytes independently is the scanner's job (next dependency). Here, integrity rests on the server hashing the exact buffer it stored, plus a size match.

## Defects found and fixed
1. **Early rejections hung on large bodies (UV-07).** The Supabase gateway does not deliver a response until the request body is consumed. Fix `9d154ad`: every pre-body reply drains up to 10 MiB, then cancels. It fails closed throughout, and nothing was written while hung.
2. **A retry of a partial intake returned 200 (UF-03).** Fix `02c9533`: 409 `reconciliation_required`.

Both fixes postdate the independent review and **need re-review** before PR #2 is accepted.

## Test-harness issues (not product defects)
Twice the browser harness lost its in-memory results after its requests had run: one hung request, and one result-recording bug. In both cases the outcomes were recovered from function logs and database state, without re-sending writes, and the missing response bodies were re-verified with non-writing probes (UC-01, UC-03).

## Cleanup status
- Fault-injection triggers: **removed** (owner-approved, 2026-11-26 ~22:35 UTC). Verified: 0 `yp_test_fault_*` triggers and 0 such functions; 0 triggers on the artifact/job tables; review-ledger append-only trigger still enabled.
- `YOU_PAID_STAGING_UPLOAD_ENABLED`: **removed by the owner.** Verified: anon key and marked member B (2 MiB bodies) both get `503 staging_upload_not_enabled` in ~0.6 s. Deployed bundles unchanged after the secret change (upload `13e5be42…`, consent `0aa8b883…`, scanner `3eaa56ab…`); only version numbers bumped.
- Synthetic artifacts remain for the next step (scanner). Remove later with `docs/staging-synthetic-upload-cleanup-runbook.md`.
- Consents: A and B revoked after the run (B: `d64947d8…`). No test member holds an active consent, so no further uploads are possible even while the gate is on.
