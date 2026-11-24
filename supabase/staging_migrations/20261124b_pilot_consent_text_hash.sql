-- STAGING ONLY, for Supabase project rzeodkcvljukaaczeibe. Additive and reversible.
-- Records the SHA-256 of the exact consent language the member affirmatively accepted.
-- Existing rows keep NULL, and the consent service treats NULL as unverified (deny).
alter table public.pilot_evidence_consents
  add column if not exists consent_text_sha256 text
  check (consent_text_sha256 is null or consent_text_sha256 ~ '^[a-f0-9]{64}$');

-- Rollback:
--   alter table public.pilot_evidence_consents drop column if exists consent_text_sha256;
