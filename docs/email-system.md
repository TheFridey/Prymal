# Prymal Transactional Email System

Prymal sends transactional emails from the backend through Resend. Email failures are recorded and logged, but they must not block onboarding, billing webhooks, workflow installs or workspace actions.

## Brand System

Every launch template uses the shared Prymal email layout:

- Prymal logo from `EMAIL_LOGO_URL`, falling back to the inline CID `prymal-logo`
- Brand line: `AI operating system for business execution`
- Dark card styling with cyan and purple accents
- Herald signature on every email
- Plain-text fallback

If `EMAIL_HERALD_AVATAR_URL` is configured, the signature shows Herald's avatar. If not, it falls back to the inline CID `herald-avatar`, then renders safely with a text fallback if the email client blocks remote media.

The inline CID images are attached from:

- `frontend/src/assets/brand/prymal-character.webp`
- `frontend/src/assets/agents/herald.webp`

Public copies also live under `frontend/public/assets/email/` for deployed URL fallback use.

## Environment

Required for live delivery:

- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL` or legacy `EMAIL_FROM`
- `REPLY_TO_EMAIL` or legacy `INVITE_EMAIL_REPLY_TO`
- `APP_URL` or `FRONTEND_URL`

Optional:

- `EMAIL_LOGO_URL`
- `EMAIL_HERALD_AVATAR_URL`
- `EMAIL_EMBED_INLINE_ASSETS`

Verify the sender domain in Resend before production.

## Templates

Implemented templates:

- `welcome`
- `workflow-catalogue`
- `lore-starter`
- `team-invite`
- `subscription-started`
- `subscription-updated`
- `payment-failed`
- `billing-receipt`
- `credits-low`
- `usage-cap`
- `workflow-installed`
- `workflow-run-failed`
- `founder-access`
- `feedback-reply`
- `workspace-alert`

Template-only until a clean product trigger exists:

- `workflow-catalogue`
- `lore-starter`
- `billing-receipt`, if Stripe receipts are enabled
- `subscription-updated`
- `workflow-run-failed`
- `feedback-reply`
- `workspace-alert`

Live triggers:

- Welcome email after onboarding completion
- Team invite email on invite and resend
- Subscription started email after successful subscription checkout webhook sync
- Payment failed email after Stripe `invoice.payment_failed`
- Credits low email when execution usage crosses a new 70 percent or 85 percent threshold
- Usage cap email when execution usage is blocked by usage policy
- Founder Access email after Founder Access activation
- Workflow installed email after catalogue install

## Idempotency

Email sends are tracked in `email_events`.

Operational expectation:

- Email delivery failures should be visible to staff through admin traces or email event records.
- Delivery failure must never block onboarding, billing reconciliation, workflow catalogue installs, or workspace actions.

Important idempotency keys:

- Welcome: `welcome:{orgId}:{userId}`
- Team invite: `team-invite:{inviteId}`
- Subscription started: `subscription-started:{subscriptionId or checkoutSessionId}`
- Payment failed: `payment-failed:{invoiceId or paymentIntentId}`
- Credits low: `credits-low:{orgId}:{threshold}:{billingPeriodKey}`
- Usage cap: `usage-cap:{orgId}:{capState}:{billingPeriodKey}`
- Workflow installed: `workflow-installed:{installedWorkflowId}`
- Founder Access: `founder-access:{orgId}:{claimId or subscriptionId}`

If a matching event is already `sent` or `skipped`, the service does not resend.

## Testing

Render and send a test email:

```bash
cd backend
npm run email:test -- --to you@example.com --type welcome
```

Supported test types include:

- `welcome`
- `workflow-catalogue`
- `lore-starter`
- `subscription-started`
- `payment-failed`
- `credits-low`
- `workflow-installed`

Run template and service tests:

```bash
cd backend
npm test -- src/services/email/email-service.test.js
```

## Adding A Future Email

1. Add a builder to `backend/src/services/email/email-copy.js`.
2. Add a thin template export in `backend/src/services/email/templates/`.
3. Add a send helper in `backend/src/services/email/email-service.js`.
4. Add an idempotency key rule.
5. Add tests that check subject, preview text, HTML, text, logo, Herald signature and safe copy rules.
6. Wire the trigger only if it is safe, idempotent and non-blocking.
