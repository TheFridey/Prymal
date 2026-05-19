# ISO 27001 Readiness

This document is a starter evidence pack for Prymal beta operations. It helps scope an ISMS-lite approach for the current product stage.

## ISMS Scope

Suggested scope for Prymal beta:

- Prymal frontend, backend, PostgreSQL, rate limiting, authentication, billing, email, media storage, safety systems, deployment pipeline, and production support operations
- environments: staging and production
- exclusions to state explicitly:
  - personal devices outside documented access controls
  - experimental landing-page projects not connected to customer data

## Asset Register Starter

| Asset | Type | Owner | Location | Confidentiality | Availability | Notes |
|---|---|---|---|---|---|---|
| Prymal backend API | Application | Engineering | VPS | High | High | Handles auth, billing, integrations, WARDEN, SENTINEL |
| Prymal frontend | Application | Engineering | Static host | Medium | High | Public app shell and authenticated UI |
| PostgreSQL database | Data store | Engineering | VPS / managed DB | High | High | Customer data, orgs, workflow state |
| Cloudinary media storage | Supplier SaaS | Engineering | Cloudinary | Medium | Medium | Generated media and reference images |
| Clerk tenant | Supplier SaaS | Engineering | Clerk | High | High | Identity and session management |
| Stripe account | Supplier SaaS | Finance / Engineering | Stripe | High | High | Billing state and payment webhooks |
| GitHub repo and Actions | Supplier SaaS | Engineering | GitHub | High | High | Source, CI, deploy workflow |
| Sentry project | Supplier SaaS | Engineering | Sentry | Medium | Medium | Error monitoring without secrets |

## Supplier Register Starter

| Supplier | Service | Data / Security Relevance | Evidence to Keep |
|---|---|---|---|
| Clerk | Authentication | Sessions, user IDs, email addresses | DPA, security overview, MFA status |
| Stripe | Billing | Subscription and payment metadata | PCI scope notes, webhook config, MFA status |
| Resend | Transactional email | Email addresses and notification content | Domain verification, vendor security docs |
| Cloudinary | Media storage | Generated media and references | Access control settings, retention setup |
| OpenAI | Model provider | Prompt and response processing | account security settings, approved use notes |
| Anthropic | Model provider | Prompt and response processing | account security settings, approved use notes |
| VPS provider | Compute | Production infrastructure | host hardening evidence, account MFA |
| Cloudflare | DNS / TLS / proxy | Edge traffic, TLS posture | Full strict TLS, DNS records, MFA |
| GitHub | Source / CI | Source code, pipeline, secrets | branch protection, secret scanning, audit logs |

## Risk Register Starter

| Risk ID | Risk | Impact | Likelihood | Current Controls | Further Action | Owner |
|---|---|---|---|---|---|---|
| R-001 | Production env misconfiguration exposes unsafe mode | High | Medium | strict env validation, preflight script | evidence each deploy | Engineering |
| R-002 | Admin route abuse by non-staff user | High | Low | Clerk auth, `requireStaff`, permission checks | periodic regression test review | Engineering |
| R-003 | Single VPS failure causes downtime | High | Medium | backups, systemd restart, health checks | document recovery target | Engineering |
| R-004 | Dependency vulnerability in prod path | High | Medium | Dependabot, `npm audit`, CI | patch SLA and tracking | Engineering |
| R-005 | Secret leakage through logs or error payloads | High | Medium | redaction, sanitized error responses, Sentry scrubbing | log review evidence | Engineering |
| R-006 | Lost or untested backups | High | Medium | backup schedule documented | quarterly restore test | Operations |

## Access Review Checklist

- [ ] list current GitHub admins and write access
- [ ] review VPS SSH users and authorized keys
- [ ] review Clerk admin access
- [ ] review Stripe admin/billing access
- [ ] review Cloudflare admin access
- [ ] review Resend and Cloudinary access
- [ ] remove stale accounts
- [ ] record review date and reviewer

## Incident Response Checklist

- [ ] identify incident commander
- [ ] classify severity
- [ ] preserve logs and timeline
- [ ] rotate potentially exposed secrets
- [ ] assess customer/data impact
- [ ] contain affected integrations or routes
- [ ] restore service safely
- [ ] record corrective actions and owner

Suggested severity labels:

- `sev1`: production outage, auth bypass, payment/security incident
- `sev2`: significant feature degradation or degraded controls
- `sev3`: contained defect without customer data impact

## Backup / Restore Evidence Checklist

- [ ] daily backup job log
- [ ] encrypted off-server copy confirmed
- [ ] last restore test date recorded
- [ ] restore test result documented
- [ ] retention period documented

## Change Management Checklist

- [ ] change linked to issue or release note
- [ ] code reviewed before merge
- [ ] CI passed
- [ ] security preflight passed for production-bound changes
- [ ] migration/backout plan documented if schema or billing changes are involved
- [ ] production deployment manually approved

## Statement of Applicability Starter Notes

Suggested Annex A areas to mark as applicable early:

- access control
- logging and monitoring
- backup
- secure development
- supplier security
- vulnerability management
- incident response
- cryptographic controls
- configuration management

Common beta-stage notes:

- some controls are partly procedural and still need operator evidence
- the repo now carries technical controls and runbooks, but formal policy ownership still needs to be assigned
- evidence collection cadence should be defined before public beta opens
