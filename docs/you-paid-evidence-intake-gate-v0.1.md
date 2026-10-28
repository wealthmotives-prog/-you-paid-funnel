# Evidence Intake Gate — Synthetic Research v0.1
- Files: `research/evidence_intake_gate_lab.py`; `tests/test_evidence_intake_gate_lab.py`.
- **OFF by default.** This offline module cannot upload or store files or perform identity verification, and passing a preflight is NOT an antivirus clearance.
- Eleven fictional test cases: disabled gate, PDF/PNG/JPG signatures, MIME mismatch, spoofed signature, unsafe names, empty/large files, bad hash and text masquerading as PDF.
- Source file investigation: existing `supabase/functions/evidence-preflight/index.ts` requires a service-role bearer and only sets `quarantined` after a signature/hash check. That function is a preflight worker, not member authorization, content disarm or malware scanner.
- Source and offline tests do not prove server-side rollout readiness. **No member evidence intake is activated.**
- Before considering any real documents: independent virus scanner, secure private bucket + RLS/access tests, verified member authorization, signed URL/TTL and path ownership, upload quotas and rate limits, retention and deletion policies, consent versioning, operations alerts, and security review.
- Run: `python -m unittest discover -s tests -p 'test_evidence_intake_gate_lab.py' -v`.
- Purpose: support an eventual voluntary pilot; volunteers must not share paystubs or IDs yet.
