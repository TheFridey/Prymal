# Billing Pricing Audit

This is the internal checklist for keeping public pricing, backend entitlements, and Stripe configuration aligned.

## Canonical Sources

- Public pricing UI: `frontend/src/lib/constants.js`
- Pricing page copy: `frontend/src/features/marketing/PricingPageContent.jsx`
- Backend enforcement: `backend/src/services/billing-catalog.js`
- Stripe checkout and webhook sync: `backend/src/routes/billing.js`
- Environment examples: `backend/.env.example`
- Deployment setup notes: `DEPLOY.md`

## Current Catalog

| Plan | Monthly Price | Founding Price | Execution Credits | AI Video Credits | Seats | Execution Concurrency | Video Concurrency | Daily Video Cap |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Offer Access | £0 | n/a | 50 | 0 | 1 | 1 | 0 | 0 |
| Solo | £49.99 | £39.99 | 500 | 2 | 1 | 1 | 1 | 2 |
| Pro | £99 | £79 | 2,000 | 5 | 1 | 3 | 2 | 5 |
| Teams | £179 | £149 | 6,000 | 15 | 5 | 5 | 4 | 8 |
| Agency | £299 | £249 | 10,000 | 25 | 25 | 8 | 5 | 15 |

Founding Access applies discounted subscription price IDs for the first 3 months only. Standard usage limits apply during the founding period.

## Stripe Price Audit

Required standard recurring prices:

- `STRIPE_PRICE_SOLO`, `STRIPE_PRICE_SOLO_QUARTERLY`, `STRIPE_PRICE_SOLO_YEARLY`
- `STRIPE_PRICE_PRO`, `STRIPE_PRICE_PRO_QUARTERLY`, `STRIPE_PRICE_PRO_YEARLY`
- `STRIPE_PRICE_TEAMS`, `STRIPE_PRICE_TEAMS_QUARTERLY`, `STRIPE_PRICE_TEAMS_YEARLY`
- `STRIPE_PRICE_AGENCY`, `STRIPE_PRICE_AGENCY_QUARTERLY`, `STRIPE_PRICE_AGENCY_YEARLY`

Required Founding Access recurring prices:

- `STRIPE_PRICE_FOUNDING_SOLO`, `STRIPE_PRICE_FOUNDING_SOLO_QUARTERLY`, `STRIPE_PRICE_FOUNDING_SOLO_YEARLY`
- `STRIPE_PRICE_FOUNDING_PRO`, `STRIPE_PRICE_FOUNDING_PRO_QUARTERLY`, `STRIPE_PRICE_FOUNDING_PRO_YEARLY`
- `STRIPE_PRICE_FOUNDING_TEAMS`, `STRIPE_PRICE_FOUNDING_TEAMS_QUARTERLY`, `STRIPE_PRICE_FOUNDING_TEAMS_YEARLY`
- `STRIPE_PRICE_FOUNDING_AGENCY`, `STRIPE_PRICE_FOUNDING_AGENCY_QUARTERLY`, `STRIPE_PRICE_FOUNDING_AGENCY_YEARLY`

Required one-time pack prices:

- `STRIPE_PRICE_EXEC_BOOST_1000`
- `STRIPE_PRICE_EXEC_100`
- `STRIPE_PRICE_EXEC_300`
- `STRIPE_PRICE_EXEC_700`
- `STRIPE_PRICE_VIDEO_PACK_SMALL`
- `STRIPE_PRICE_VIDEO_PACK_PRO`
- `STRIPE_PRICE_VIDEO_15`
- `STRIPE_PRICE_VIDEO_30`
- `STRIPE_PRICE_VIDEO_100`

Required seat add-on price:

- `STRIPE_PRICE_SEAT_ADDON`

Legacy Agency price IDs:

- `STRIPE_PRICE_AGENCY_LEGACY`, `STRIPE_PRICE_AGENCY_LEGACY_QUARTERLY`, and `STRIPE_PRICE_AGENCY_LEGACY_YEARLY` are webhook mapping only for grandfathered subscriptions.
- New checkout must never use legacy Agency price IDs.

## Webhook Audit

Stripe webhook endpoint:

- `POST /api/billing/webhook/stripe`

Subscribed events:

- `checkout.session.completed`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`

Expected sync behaviour:

- Subscription checkout writes the selected plan, interval, Stripe subscription ID, and Founding Access metadata when applicable.
- Credit-pack checkout completes a pending purchase and credits the correct execution or AI video ledger.
- Teams seat add-on checkout increases the organisation seat limit.
- Subscription updates map Stripe Price IDs back to plan/interval entitlements.
- Founding Access subscriptions transition back to standard Stripe Price IDs after the founding window.
- Failed invoices mark billing state as `past_due`.

## Copy Audit

Public copy must not imply:

- unlimited AI runs
- unlimited video generation
- video credits rolling over
- usage packs bypassing fair-use or concurrency limits
- Agency legacy prices being available for new customers
- durable/shared video storage until object storage is implemented

When pricing changes, update:

- `frontend/src/lib/constants.js`
- `backend/src/services/billing-catalog.js`
- `README.md`
- `DEPLOY.md`
- `frontend/src/pages/Terms.jsx`
- `frontend/src/pages/Changelog.jsx`
- `backend/.env.example`
- `backend/scripts/validate-env.mjs`

Run:

```bash
cd backend
npm test
npm run env:validate

cd ../frontend
npm run lint
npm run build
```
