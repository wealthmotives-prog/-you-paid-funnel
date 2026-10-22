# You Paid — Master Handoff

**Snapshot:** 2026-10-22  
**Operating entity:** 850 Lifestyle LLC (You Paid intended DBA/product brand)  
**Repository:** wealthmotives-prog/-you-paid-funnel — main — currently PUBLIC  
**Supabase:** you-paid-production / xknfxcyezchtypaisieu  
**Vercel:** you-paid / production

## Operating thesis

You Paid is permissioned, source-backed infrastructure for preserving and verifying historical and ongoing work activity.

**Verified Performance = documented satisfaction of a predefined, objective obligation during a defined measurement period.**

Keep Presence, Continuity, Tenure, and Performance separate. Historical event date, source-observed date, You Paid verification date, and membership date must remain distinct.

## Claims boundary

- No claim of live Experian/Equifax/TransUnion furnishing without an actual documented relationship.
- No score, approval, tradeline, underwriting, or deletion guarantees.
- Founder Access is not equity, investment, debt, security, donation, credit account, or tradeline.
- Historical verification is not “backdating.”
- Stripe is sandbox/test mode. Live-money cutover has NOT occurred.
- Secure evidence artifact upload/validation remains a core MVP gap.

## Current product

Public cinematic homepage; member portal; Founder Access; operator command center; How It Works; employer surface; data-network surface; marketing unsubscribe; consent grant/revoke; incident-response runbook; separate Quokka page.

Homepage story: Work exists → evidence → verified record → portable data → financial utility → infrastructure.

## Founder/payment system

Tiers are cumulative: $1 Founding Member, $10 Founding Builder, $100 Founding Cornerstone.

Fresh-user regression passed: **$1 → +$9 → +$90 = $100 cumulative Cornerstone** in Stripe sandbox. The $9 and $90 upgrades completed automatically through the repaired webhook pipeline. The final upgrade correctly charged $90, not another $100.

The fresh $1 transaction exposed missing service-role DML grants. Stripe succeeded, webhook reconciliation failed closed, no false entitlement was granted, permissions were repaired, and the independently verified Stripe payment was reconciled.

Hardening in place:
- payment idempotency on provider_payment_id
- unique payment entitlement reference
- one active checkout per user
- checkout/user/tier/amount webhook reconciliation
- payment event journal + payload hash
- partial/full refund accounting
- service-role-only refund RPC
- payment-integrity metrics in operator console
- Stripe return auth refresh race fixed

## Current infrastructure

GitHub repository: `wealthmotives-prog/-you-paid-funnel`, main, currently **PUBLIC**.

Latest verified production deployment:
- commit `f6ce63dfc10cd6732d35b4d2e6183c9ce22f94d0`
- “Add internal incident response runbook”
- deployment `dpl_GoNG8krnXAykzzcYkHZuhRKGEm8A`
- READY / production

Recent production:
- `df0955f...` marketing unsubscribe self-service
- `e22f345...` member consent grant/revoke controls

Active Supabase Edge Functions:
- capture-funnel v5
- create-founder-checkout v2
- stripe-founder-webhook v7

## Data domains

Member identity; employment/work ledger; monthly work cycles; verification events; Founder money; data providers/authorizations; reporting destinations/transmissions; consumer disputes; privacy requests; data-sharing consents; compliance controls/history; vendor risk; retention; incidents; marketing suppression.

Verification and reporting remain separate. A verified event does not imply it was transmitted anywhere.

## Security state

Supabase currently reports:
- Leaked Password Protection disabled — must be enabled before launch.
- SECURITY DEFINER warnings for authenticated-callable RPCs. Many are intentional and contain auth/admin checks; do not blindly revoke. Refactor privileged internals out of exposed schema where feasible.
- Five RLS-enabled/no-policy tables currently flagged: consumer_report_access_log, incident_response_contacts, incident_tabletop_exercises, marketing_suppressions, permissible_purpose_certifications. Audit grants/exposure.
- anonymous unsubscribe_marketing SECURITY DEFINER RPC requires abuse/rate-limit/input review.

Never expose service_role in frontend code. RLS and Data API grants are separate controls.

## P0 execution queue

1. Enable leaked-password protection and verify Auth configuration.
2. Decide repository visibility; audit git history/frontend for secrets regardless.
3. With owner authorization, perform destructive $90 sandbox refund regression and verify Cornerstone $100 → Builder $10 end-to-end.
4. Add scheduled payment-integrity reconciliation/snapshots and exception alerting.
5. Audit service-only no-policy tables for unintended grants.
6. Harden anonymous unsubscribe against abuse/enumeration.
7. Complete live-mode cutover checklist without activating it.
8. Obtain specialized legal review before real customer money/external furnishing.

## P1 evidence core

Build private evidence storage/upload; artifact hashes; provenance; deterministic decision reasons; immutable correction lineage; YP-WDS 1.0; provider authentication/onboarding; member provenance view.

## P1 compliance/distribution

Operationalize permissible purpose, downstream access logs, dispute workflow, consent revocation enforcement, retention/deletion/legal hold, incident tabletop, and CRA/intermediary BD package only after credible data and controls exist.

## Owner-action gates

Continue autonomously until: destructive sandbox action; unavailable account-level setting; live-money action; legal/business attestation; external contract/purchase; or material owner policy choice.

## Do not re-litigate

Do not restart Founder pricing; do not turn homepage back into generic SaaS cards; do not merge verification/reporting; do not solve grants with reflexive SECURITY DEFINER; do not equate Stripe success with entitlement success; do not assume verified work is bureau-furnishable; do not invent customers/partners/revenue.

## Resume command

Continue building You Paid from this handoff as the current source of truth. Verify live state before changing it. Keep Stripe sandboxed until P0 launch gates are satisfied. Treat money reconciliation, evidence provenance, consent, disputes, correction lineage, downstream access, and incident response as core product infrastructure. Execute autonomously until a destructive action, external account setting, real-money action, legal attestation, paid purchase, or material owner decision is genuinely required.
