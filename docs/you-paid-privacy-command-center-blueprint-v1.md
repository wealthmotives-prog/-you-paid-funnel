# You Paid — Privacy & Member Data Control Blueprint v1
Date: October 24, 2026
Status: design specification only; NOT a published privacy notice, NOT implemented account controls.

## Inspiration and original design
Reference: Robinhood US User Privacy Statement, effective August 18 2026, https://robinhood.com/us/en/support/articles/privacy-policy/, plus user-provided screenshots showing Privacy > Manage your data, personal data download, data use permissions, affiliate sharing, strictly necessary/performance/functional/marketing controls.
Borrow the principles of understandable navigation, contextual explanations and member agency, NOT their legal representations, trade dress, consent assumptions, regulatory status, or exact copy.

## You Paid original north-star statement
"Your work has value. Your records deserve accuracy. You should understand how your information is used, who receives it, and which choices belong to you."

## Member-facing sections (proposed)
1. Privacy overview: plain-language explanation, most recent policy revision and choices.
2. Data access: authenticated request for export of relevant account, work-declaration, consent, verification correspondence and audit-disclosure records; securely deliver with expiring link after identity recheck and logging.
3. Permissions: specific verification requests, purpose, recipient, categories, authorization and revocation status; separate service consent from marketing.
4. Marketing/technology choices: necessary technology clearly differentiated from optional analytics, functionality and marketing. Present applicable rights appropriately, avoid opt-out controls that do not actually function.
5. Sharing history: member-readable disclosures and timing for supported events, excluding security secrets and confidential investigation data. No claims of bureau-furnishing until agreements and production operations exist.
6. Corrections, disputes and deletion: secure authenticated request flows, identity validation, relevant legal retention holds, appeal/review timeline and human support.

## Proposed UX copy (not live until supported)
Title: "Your data. Your decisions."
Intro: "Review the information connected to your You Paid account, understand why it is used, and manage the choices available to you."
Self-declared label: "Provided by you — not independently verified."
Employer label (only after validation): "Employer response received — awaiting review."
Review complete (only when supported): "Reviewed confirmation — see source and scope."
Retention: "Some information may need to be retained for applicable legal, security, accounting or dispute purposes. We will explain what can be deleted and what must be retained."

## Design to operations mapping
- Optional analytics and marketing toggles: default according to jurisdiction and legal basis. Must prevent downstream SDK/pixel activity before showing a working control; server-side preference store and enforcement audit required.
- Verification data sharing: show each target and purpose; check member consent status at action time; revocation affects future nonrequired sharing, not previously lawful disclosures or required retention.
- Data export: asynchronous privacy request queue, verified identity, least-privilege archive job, encryption at rest/in transit, short-lived link, expiration and access logs. Never invent a 30-day or weeks-long SLA by copying a competitor.
- Affiliates: only add affiliate-sharing setting if legal entity relationships, actual recipients and applicable notice/opt-out requirements are known. No broad fictional affiliates.
- Security: authenticated request submission; role and owner-scoped record access; throttling, event logging, privacy request status, secure delivery, deletion schedule and accountable operator review.
- Future credit furnishing: privacy language must distinguish consent and legal authority, actual account/credit terms, furnishing to CRAs, inquiry/access rights, FCRA furnisher duties, disputes/corrections, permissible disclosures, retention and consumer notices. Furnishing isn't purely an optional marketing toggle.
- GLBA, FCRA, FTC Safeguards Rule and state privacy rules: assess applicability with qualified counsel against actual company activities; never transplant Robinhood's financial-institution claims.

## Proposed routes and build phases
A. Preflight inventory: read existing privacy disclosures, analytics/pixels, cookies, Supabase RLS and request/ticket capabilities. Track existing third-party processors.
B. Static information architecture and original copy: member Account > Privacy; no fake functional toggles.
C. Implement preference persistence, audit and enforcement, with test coverage for consent changes and blocked tracking.
D. Authenticated data export and privacy request management, with reviewed retention policy and encryption.
E. Furnishing-specific notices, rights and data lineage when account substance and bureau relationship are settled.

## Launch gating
Do NOT publish a privacy statement asserting non-sale, data deletion SLA, affiliate transfer, non-sharing, no trackers, customer export rights or regulator-supervised status unless independently verified for You Paid and technically supported.
Do NOT expose real financial or employment data in frontend preview or logs.
