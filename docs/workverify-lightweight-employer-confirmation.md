# WorkVerify Lightweight Employer Confirmation — v1
Status: database draft infrastructure only; no automatic outreach or confirmed-employment workflow live.

## Operating principle
Make it easy for a willing employer to confirm narrow factual questions. A legitimate company website and company-issued work email are helpful preliminary signals, not conclusive proof of employment or attendance.

## Tiered evidence
1. Company identity: independent public registry, website and/or official domain. A domain match may move company_check to domain_match, not confirm employment.
2. Contact: company-issued contact address and reply. Check domain alignment and independently available contact channel when reasonably possible; free domains, contractors and small businesses may require tailored alternatives, not categorical exclusion.
3. Fact response: dates, status, hours or shifts, with clear questions, source authority and evidence limitation. A responder should be able to confirm only what they know; select partial confirmation rather than fabricating certainty.
4. High-impact claims: when contradictory, unusual, unverifiable or used in external furnishing contexts, escalate to supplementary evidence and applicable program/legal requirements.

## Low-friction sample employer interaction (future, after consent and secure channel)
- Member grants specific, revocable contact authorization.
- WorkVerify validates employer identity and delivers brief single-use, expiring link.
- Contact sees minimal necessary employee-identifying facts and three yes/no/unknown questions with optional dates.
- Employer authenticates by authorized channel, confirms their role, reviews claims, submits response.
- System logs delivery, authentication signals, timestamp, question set, respondent role, response and contradictions.
- Member sees status and has a correction route.
- No employer account purchase, contract, API key or ongoing portal usage required for an ordinary confirmation.
- No automatic outbound correspondence while prelaunch draft-only gate is active.

## Safety and fraud-resistance
- Business email is an identity clue rather than proof of payroll or employment.
- Never trust a member-supplied email alone when it might be a lookalike domain or alias; corroborate company contact by another reasonable source.
- Avoid collection of government ID/SSN just to verify routine employment.
- Do not imply that legal employer access or partner agreements have been secured.
- Never recategorize self-declared evidence as verified without actually recorded, attributable confirmation.
- Record disputes, alternate employer structures, staffing agencies and legitimate contract work as cases requiring nuance.
- Credit bureau reporting remains disabled. No credit-score impact promises.

## Current foundation
Table: public.employer_verification_requests. Members can insert/read only their own drafts with linked employment; no member update or public read. Insert guard prohibits outreach_state other than draft_only. Administrative status changes and contact delivery are not yet wired.
