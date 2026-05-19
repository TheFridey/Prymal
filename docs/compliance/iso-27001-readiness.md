# ISO 27001 Readiness

This document is Prymal's practical ISO/IEC 27001:2022 starter pack for beta-stage operations. It is not a certification claim. It is designed to help a founder-led SaaS gather the minimum useful structure for a gap assessment, internal discipline, and future external audit preparation.

## ISMS Scope Statement

Suggested ISMS scope for Prymal beta:

Prymal's ISMS covers the design, development, deployment, operation, support, and security management of the Prymal SaaS platform, including the frontend application, backend API, PostgreSQL data stores, workflow runtime, safety systems, billing integrations, identity provider integrations, media storage, source repository, CI/CD workflow, production VPS, and operational activities used to support staging and production environments.

Suggested exclusions:

- personal devices or accounts not used to administer Prymal
- experimental sites or repositories not connected to Prymal production data
- customer-managed downstream systems outside Prymal's control

## Interested Parties

| Interested party | Needs / expectations | Security relevance |
| --- | --- | --- |
| Customers and beta users | secure service, privacy, uptime, correct billing | confidentiality, integrity, availability |
| Founder / operators | practical controls, low overhead, clear evidence | governance, accountability |
| Payment providers and processors | secure integrations, correct webhook handling | billing integrity |
| Identity provider | secure auth flows and admin posture | access control |
| Regulators and assessors | documented controls, retained evidence, legal compliance | assurance and accountability |
| Suppliers | defined security responsibilities and least-privilege integration use | supplier security |

## Internal and External Issues

### Internal issues

- small team with limited separation of duties
- strong reliance on founder-operated infrastructure knowledge
- evidence collection must be lightweight and repeatable
- optional features such as Trigger.dev should not create hidden control gaps

### External issues

- dependency vulnerability churn in SaaS and JavaScript ecosystems
- reliance on third-party SaaS providers for auth, payments, email, and models
- regulatory expectations around access control, incident handling, and evidence retention
- infrastructure threats affecting public VPS exposure

## Asset Inventory Starter

| Asset | Owner | Type | Location | Classification | CIA priority | Control notes |
| --- | --- | --- | --- | --- | --- | --- |
| Prymal backend | Engineering | Application | VPS | Confidential | H/H/H | env validation, preflight, rate limits, logging redaction |
| Prymal frontend | Engineering | Application | static host | Internal | M/H/H | Clerk auth integration, production API pinning |
| PostgreSQL | Engineering | Data store | VPS/private network | Restricted | H/H/H | localhost/private bind, backups, migrations |
| Clerk tenant | Engineering | Supplier SaaS | Clerk | Restricted | H/H/H | auth, sessions, MFA required |
| Stripe account | Finance / Engineering | Supplier SaaS | Stripe | Restricted | H/H/H | billing, webhooks, MFA required |
| Cloudinary account | Engineering | Supplier SaaS | Cloudinary | Confidential | M/M/M | production media store |
| GitHub repository | Engineering | Supplier SaaS | GitHub | Confidential | H/H/H | branch protection, CI, secret scanning |
| Cloudflare zone | Engineering | Supplier SaaS | Cloudflare | Confidential | M/H/H | DNS, TLS, proxying |

## Data Classification

| Classification | Description | Prymal examples | Minimum handling |
| --- | --- | --- | --- |
| Public | intended for open publication | marketing copy, public pricing pages | no special restriction |
| Internal | operational but not customer-sensitive | runbooks, release notes, non-secret architecture notes | limit to team/admin access |
| Confidential | business-sensitive or limited customer data | support logs, admin metrics, supplier settings | need-to-know access, MFA, no public sharing |
| Restricted | secrets or high-impact data | API keys, encryption keys, webhook secrets, database credentials | never commit, least privilege, secure storage only |

## Supplier Inventory

| Supplier | Service | Data or control impact | Security expectation | Evidence |
| --- | --- | --- | --- | --- |
| Clerk | authentication | user identities, sessions | MFA, admin review, webhook monitoring | supplier register, MFA screenshot |
| Stripe | billing | subscription and payment metadata | MFA, webhook monitoring, least privilege | supplier register, webhook screenshot |
| Cloudinary | media storage | generated and uploaded media | MFA, access review, secure config | supplier register |
| Resend | email | email addresses and transactional content | MFA, domain verification | supplier register |
| OpenAI | model provider | prompt/response processing | MFA, approved usage review | supplier register |
| Anthropic | model provider | prompt/response processing | MFA, approved usage review | supplier register |
| Cloudflare | DNS/TLS/proxy | traffic and TLS posture | MFA, Full strict, least privilege | supplier register |
| VPS provider | compute | infrastructure control plane | MFA, account review | supplier register |
| GitHub | source and CI | source, secrets, change workflow | MFA, branch protection, secret scanning | supplier register |

## Risk Register Starter

| Risk ID | Risk | Asset / process | Likelihood | Impact | Current controls | Treatment | Owner | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R-001 | production env misconfiguration | deployment | Medium | High | env validation, preflight, deploy gate | evidence each release | Engineering | Open |
| R-002 | admin misuse or privilege creep | admin routes / cloud consoles | Medium | High | staff permission model, MFA, access reviews | quarterly review | Engineering | Open |
| R-003 | untested backup restore | database continuity | Medium | High | backup docs, restore register | quarterly restore drill | Operations | Open |
| R-004 | dependency vulnerability in prod path | SDLC | Medium | High | audits, Dependabot, vulnerability register | patch to SLA | Engineering | Open |
| R-005 | supplier compromise or misconfiguration | suppliers | Medium | High | supplier review, MFA, least privilege | annual supplier review | Engineering | Open |
| R-006 | logging of secrets or sensitive payloads | monitoring | Low | High | redaction and sanitization | periodic log review | Engineering | Open |

## Risk Treatment Plan

| Treatment ID | Linked risk | Action | Target date | Owner | Evidence |
| --- | --- | --- | --- | --- | --- |
| RTP-001 | R-001 | retain env validation and preflight output for each deploy | each release | Engineering | evidence register + deploy record |
| RTP-002 | R-002 | complete quarterly access review and capture MFA screenshots | quarterly | Engineering | access review register |
| RTP-003 | R-003 | run documented backup restore drill | quarterly | Operations | backup restore test register |
| RTP-004 | R-004 | review dependency audits monthly and patch to SLA | monthly | Engineering | vulnerability register |
| RTP-005 | R-005 | complete supplier security review for each critical supplier | onboarding and annual | Engineering | supplier register |

## Statement of Applicability Starter

| Control area | Applicable | Repo / operational basis | Status |
| --- | --- | --- | --- |
| Access control | Yes | Clerk auth, staff permissions, access review process | Partial |
| Secure authentication | Yes | live-key validation, webhook secrets, MFA requirement | Partial |
| Supplier relationships | Yes | supplier register, MFA expectations, onboarding review | Partial |
| Logging and monitoring | Yes | redaction, safe logging, Sentry option, journald | Partial |
| Vulnerability management | Yes | audit workflow, risk register, patch SLA | Partial |
| Secure development lifecycle | Yes | CI, code review, manual deploy gates, pre-release review | Partial |
| Configuration management | Yes | env validation, nginx template, systemd path, VPS hardening | Partial |
| Backup and restore | Yes | backup docs, restore register, drill runbook | Partial |
| Incident management | Yes | incident policy, incident register, drill runbook | Partial |
| Cryptography and secrets | Yes | encryption key validation, integration state secret, no-secrets-in-repo controls | Partial |
| Data protection | Yes | classification, redaction, supplier controls, least privilege | Partial |

## Policy Inventory

| Policy | Owner | Review frequency | Evidence |
| --- | --- | --- | --- |
| Information security policy | Founder / Security lead | annual | signed review note |
| Access control policy | Founder / Security lead | quarterly | access review register |
| Secure development policy | Engineering | quarterly | PR / release records |
| Vulnerability management policy | Engineering | monthly | vulnerability register |
| Backup and restore policy | Operations | quarterly | restore test register |
| Incident response policy | Founder / Security lead | annual | drill output, incident register |
| Supplier security policy | Founder / Security lead | annual | supplier register |
| Change management policy | Engineering | quarterly | change register |
| Data classification policy | Founder / Security lead | annual | training note / document review |
| Acceptable use policy | Founder / Security lead | annual | acknowledgement record |

## Internal Audit Schedule

| Period | Focus | Owner | Evidence |
| --- | --- | --- | --- |
| Q1 | access control and MFA | Founder / Security lead | access review output |
| Q2 | backups, restore, and incident handling | Founder / Security lead | drill outputs |
| Q3 | secure development and vulnerability management | Founder / Security lead | dependency review and pre-release review outputs |
| Q4 | supplier reviews and ISMS document refresh | Founder / Security lead | supplier register and management review |

## Management Review Schedule

| Frequency | Inputs | Outputs |
| --- | --- | --- |
| Quarterly | incidents, vulnerabilities, access review outcomes, backup drill outcomes, major changes | action items, priorities, risk acceptance or remediation |

## Continual Improvement Log

| Date | Observation | Improvement action | Owner | Status |
| --- | --- | --- | --- | --- |
| 2026-05-19 | evidence lived in scattered docs only | create unified policies, registers, runbooks, and evidence collector | Engineering | Complete |

## Nonconformity / Corrective Action Log

| ID | Issue | Root cause | Corrective action | Owner | Due date | Status |
| --- | --- | --- | --- | --- | --- | --- |
| CA-001 | evidence was not collected in a repeatable format | documentation existed but no shared structure | add evidence register and collector script | Engineering | 2026-05-19 | Complete |

## Repo Control Mapping To ISO-Style Areas

| Area | Prymal control examples |
| --- | --- |
| Access control | Clerk auth, explicit staff permission middleware, superadmin allowlist requirement |
| Secure authentication | live-key enforcement, webhook secret validation, integration state signing |
| Supplier relationships | supplier register, new-supplier review runbook, MFA requirement list |
| Logging and monitoring | request redaction, safe error handling, Sentry sanitization, journald guidance |
| Vulnerability management | `npm audit`, preflight checks, dependency risk register, review runbook |
| Secure development lifecycle | lint/tests/schema check, manual production preflight, branch protection guidance |
| Configuration management | env validation, nginx template, systemd path, VPS hardening checklist |
| Backup and restore | backup docs, restore test runbook, restore register |
| Incident management | incident response policy, drill runbook, incident register |
| Cryptography and secrets | validated encryption key, state secret, no secrets in repo, `.env` permissions |
| Data protection | data classification policy, log redaction, Cloudinary-only production media, supplier controls |

## Practical Next Step

Treat this document as the map, and keep the live records in:

- `docs/compliance/policies/`
- `docs/compliance/registers/`
- `docs/compliance/runbooks/`
- `docs/compliance/evidence-register.md`
