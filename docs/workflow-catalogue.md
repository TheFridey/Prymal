# Workflow Catalogue

Workflow Catalogue is Prymal's curated workflow library.

Positioning: "Start from proven workflows, customise them, and build your own."

## V1 Scope

- Browse published official and community workflow listings.
- Install free workflows into an organisation workspace.
- Installed workflows become normal `workflows` rows and run through the existing NEXUS execution engine.
- Users can create draft catalogue listings from workflows they own in their organisation.
- Users can submit listings for staff review.
- Staff can approve, reject, archive, and seed official Prymal workflows.
- Premium workflow structure exists, but purchasing is disabled while marketplace payments are not proven.

## Safety Model

Catalogue definitions are never executed directly. Installation validates the stored definition and creates a normal workspace workflow with `trigger_type=manual`.

Validation blocks:

- API keys, access tokens, webhook secrets, private keys, and signed URLs.
- Tokenized URLs or embedded credentials.
- Exfiltration or policy-bypass instructions.
- Webhook-triggered catalogue definitions.

Validation warns on:

- possible private customer data references
- large workflow graphs
- external URL references
- likely video generation
- scheduled triggers, which are converted to manual on install

## Admin Review

Submissions enter `review_status=pending` and `visibility=submitted`.

Staff review path:

1. Open `/app/admin/workflow-catalogue`.
2. Inspect workflow preview, expected output, required inputs, estimates, and validation warnings.
3. Approve to publish or reject with a clear reason.
4. Rejected workflows return to the creator for edit/resubmission.

## Premium Workflow Notes

Premium support is structural only until:

- `WORKFLOW_CATALOGUE_PREMIUM_ENABLED=true`
- Stripe Checkout is wired for catalogue purchases
- webhook lifecycle proof marks `workflow_catalogue_purchases.status=paid`
- install entitlement checks are proven
- creator payout process is operational

Default revenue share plan:

- platform fee: `WORKFLOW_CATALOGUE_PLATFORM_FEE_BPS=2500`
- creator share: 75%
- payouts manual initially
- no Stripe Connect automation until explicitly implemented and verified

Buying a premium workflow will never include unlimited execution. Runs still use normal Prymal credits, usage policy, burn caps, and concurrency controls.

## Official Seed Workflows

The idempotent seed script creates:

- 30-Day Content Engine
- Website Audit Sprint
- Agency Lead Generation System
- Customer Support Response Builder
- Weekly Business Report

Run:

```bash
cd backend
npm run catalogue:seed
```
