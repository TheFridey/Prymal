# ICO Registration — Prymal

Prymal processes personal data of UK users and is required to register with the Information Commissioner's Office (ICO) under UK GDPR / Data Protection Act 2018.

---

## Step-by-Step Registration Guide

1. Go to [ico.org.uk/registration](https://ico.org.uk/registration)
2. Select **"Register now"** under the Data Protection Fee
3. Choose **Tier 1** (£40/year) — applicable to most small organisations with turnover under £632,000 or fewer than 10 members of staff
4. Complete the online form with the details below
5. Pay £40 by debit/credit card or direct debit
6. Store the ICO registration certificate and reference number securely in the company records
7. **Set a calendar reminder for annual renewal** — registration lapses if not renewed and failure to register is a criminal offence

---

## Data Controller Details to Provide

| Field | Value |
|-------|-------|
| Organisation name | [COMPANY_LEGAL_NAME] |
| Registered address | [REGISTERED_ADDRESS] |
| Nature of processing | AI SaaS platform providing multi-agent orchestration, workflow automation, and knowledge management services to UK and international business customers |
| Data controller contact | privacy@prymal.io |

---

## Categories of Personal Data Processed

- **Account data**: names, email addresses, organisation names, workspace settings
- **Authentication data**: Clerk user identifiers, session tokens
- **Billing data**: Stripe subscription records, billing history, payment method metadata (Prymal never sees card numbers — these are tokenised by Stripe)
- **Usage and telemetry data**: agent interactions, workflow run logs, feature usage events, session metadata
- **Content data**: prompts submitted to agents, documents uploaded to LORE (knowledge base), workflow inputs and outputs
- **Technical data**: IP addresses, browser type, device identifiers, Railway and Cloudflare infrastructure logs
- **Communications**: support messages, feedback submissions

---

## Purposes of Processing

| Purpose | Legal Basis |
|---------|-------------|
| Service delivery and authentication | Contract performance |
| Billing and subscription management | Contract performance |
| Security monitoring and threat detection (WARDEN audit system) | Legitimate interests |
| Product improvement and analytics (internal product events — not sold to third parties) | Legitimate interests |
| Transactional email (Resend via HERALD) | Contract performance |
| Error monitoring (Sentry) | Legitimate interests |
| Marketing communications | Consent (opt-in only) |
| Legal compliance (billing records, breach reporting) | Legal obligation |

---

## Data Retention Periods

| Data Type | Retention Period | Reason |
|-----------|-----------------|--------|
| User accounts and workspace data | Duration of subscription + 30 days post-cancellation | Service delivery; grace period for data export |
| Execution traces and workflow run logs | 90 days rolling | Operational monitoring and debugging |
| WARDEN audit events | 1 year | Security audit compliance |
| Billing records | 7 years | HMRC legal obligation |
| Support communications | 2 years | Customer service continuity |
| Email event logs (HERALD) | 1 year | Transactional compliance |

---

## Third-Party Processors

All sub-processors are listed here for ICO registration purposes. Customers may also find this list in the Privacy Policy and DPA.

| Processor | Purpose | Location |
|-----------|---------|----------|
| Clerk | User authentication and session management | USA (DPA / SCCs in place) |
| Stripe | Payment processing and subscription billing | USA (DPA / SCCs in place) |
| Railway | Backend hosting and compute infrastructure | USA |
| Cloudflare | CDN, WAF, and DDoS protection | USA |
| Resend | Transactional email delivery | USA |
| Sentry | Application error monitoring and alerting | USA |
| Cloudinary | Media asset storage (generated images and videos) | USA |
| OpenAI | LLM inference for agent responses and transcription | USA |
| Anthropic | LLM inference for agent responses | USA |
| Google (Gemini / Veo) | LLM inference and AI video generation | USA |

---

## Annual Renewal Reminder

ICO registration must be renewed each year. The £40 fee is due on the anniversary of initial registration.

- **Action**: Set a recurring calendar reminder 30 days before the renewal date
- **Failure to renew** is a criminal offence under the Data Protection Act 2018 — treat this as a hard operational deadline
- The ICO will typically send renewal reminders by email, but do not rely on this alone
