# Stripe Founding Access Activation

Status: Integration scaffold deployed; Stripe account connection and secrets still required before charging users.

## Deployed payment functions

- create-founder-checkout — authenticated function that creates a one-time Stripe Checkout Session for the member's currently selected Founding Access amount.
- stripe-founder-webhook — signed webhook receiver that records Stripe events, applies successful founder payments, updates founder entitlements, tracks expiration, and handles refunds.

## Required secrets / configuration

- STRIPE_SECRET_KEY
- STRIPE_WEBHOOK_SECRET
- SITE_URL=https://www.joinyoupaid.com

The Supabase service-role and project URL variables are supplied by the Supabase runtime.

## Stripe webhook endpoint

https://xknfxcyezchtypaisieu.supabase.co/functions/v1/stripe-founder-webhook

Subscribe at minimum to:

- checkout.session.completed
- checkout.session.expired
- charge.refunded

## Checkout rules already enforced

1. Member must authenticate.
2. Founding program must be open.
3. Member must select a valid founder tier.
4. Current Founding Access Terms must be accepted.
5. Checkout amount is sourced from the backend founder intent, not from the browser.
6. Stripe Checkout is one-time payment mode.
7. Successful payment is authoritative only after the signed webhook is processed.
8. Founder membership is recomputed from recorded paid contributions.
9. Refunds can reduce or remove founder entitlements.
10. Payment status never changes work-verification truth.

## Test matrix before live mode

- $1 first purchase
- $10 first purchase
- $100 first purchase
- $1 → $10 upgrade (charge $9)
- $10 → $100 upgrade (charge $90)
- cancelled checkout
- expired checkout
- duplicate webhook delivery
- full refund
- partial refund
- webhook signature failure
- attempt checkout without terms acceptance
- attempt checkout with closed founder program
- payment success followed by member portal refresh
- mobile Safari and Chrome checkout return paths

## Go-live condition

Do not remove public "prelaunch / payments not live" language until a Stripe account is connected, keys are configured, webhook signature verification is confirmed, and the test matrix has passed in Stripe test mode.
