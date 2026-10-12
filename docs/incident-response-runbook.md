# You Paid Incident Response Runbook v0.1

Status: Draft operational runbook
Owner: Security / Operations
Review cadence: Quarterly and after material incidents

## Purpose

Provide a repeatable response process for suspected unauthorized access, data exposure, integrity failures, credential compromise, verification-system abuse, vendor incidents, or other security events affecting You Paid.

## Severity

- **SEV1 — Critical:** material compromise of sensitive member data, widespread unauthorized access, destructive attack, or business-critical outage with security impact.
- **SEV2 — High:** confirmed compromise with limited scope, significant integrity issue, or high-risk vendor incident.
- **SEV3 — Moderate:** suspicious activity or contained issue requiring investigation but without confirmed material exposure.
- **SEV4 — Low:** minor event, false positive, or localized issue with no material security impact.

## Response sequence

1. **Detect and record.** Create an incident record immediately. Preserve timestamps, affected systems, observed indicators, and the person/system that detected the issue.
2. **Triage.** Assign severity, owner, affected systems, likely data categories, and immediate containment priorities.
3. **Contain.** Revoke compromised credentials, isolate affected integrations, disable risky paths, rotate secrets, or suspend transmissions as appropriate.
4. **Preserve evidence.** Do not destroy logs or change evidence needed to understand the incident.
5. **Investigate.** Establish scope, entry point, affected users/data, duration, vendor involvement, and whether integrity or confidentiality was affected.
6. **Notification analysis.** Legal/compliance determines whether contractual, regulatory, consumer, partner, or law-enforcement notice is required and documents the basis.
7. **Recover.** Restore normal operation only after the risky condition is addressed and critical controls are validated.
8. **Correct downstream data.** If verification or reporting integrity was affected, identify every impacted record and destination and issue correction/deletion transmissions where required.
9. **Close.** Record root cause, actions taken, recovery date, notification decision, and closure approval.
10. **Learn.** Document lessons learned, control changes, owner, and target date. Update the Trust & Compliance Readiness Standard where appropriate.

## Non-negotiable rules

- Never conceal a material incident to protect growth metrics or reputation.
- Do not send external reporting data while integrity is materially uncertain.
- Payment status or customer importance never changes incident treatment.
- Use least-privileged access during investigation.
- Do not claim an incident is closed until containment, recovery, and required follow-up are documented.

## Tabletop requirement

Before verification data scales materially, run at least one tabletop scenario covering compromised operator credentials, a vendor data exposure, and incorrect downstream reporting.
