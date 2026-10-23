# You Paid Growth Studio — release gates v1
## Campaign states
idea -> researching -> drafted -> fact_checked -> owner_review -> approved -> scheduled -> published -> measured -> archived
No transition to approved without owner authorization. No transition to scheduled/published without separate channel credentials and approval.

## Facts and source check
For every public-facing claim capture claim_text, classification (verified_live, in_development, future_aspiration, unsupported), verification_date, source URL or internal release reference, reviewer, approved copy. Fact checker rejects unsupported claims, unverified partner names, guaranteed score outcomes, credit-bureau availability, and unrestricted document upload claims. Any product change invalidates potentially affected approvals.

## Growth experiment record
id, hypothesis, audience, channel, hook, CTA, landing_path, content_variant, cost_ceiling_usd, start/end, impression_count, click_count, opt_in_count, observed_cost, review_decision. Store no personal user data in creative metadata.

## KPIs
click_through_rate = clicks/impressions if impressions > 0; visitor_to_optin = consented unique optins/unique visitors if denominators known. Avoid fabricated conversion counts and misleading attribution. No automatic retargeting of financially vulnerable people.

## No-publish guard
Internal content-generation tools are permitted; campaign distribution requires a positive separate owner approval, lawful opt-in when applicable, and eligible platform/account setup. Approval to draft is not approval to buy media.
