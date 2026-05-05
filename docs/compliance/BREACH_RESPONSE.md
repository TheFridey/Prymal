# Data Breach Response Procedure — Prymal

**Version**: 1.0  
**Classification**: Internal — Operational  
**Owner**: Rhys Lacy (Data Controller)  
**Required by**: UK GDPR Article 33 / Data Protection Act 2018

---

## What Constitutes a Reportable Breach

A personal data breach is any accidental or unlawful:
- **Destruction** of personal data
- **Loss** of personal data (including loss of access)
- **Alteration** of personal data
- **Unauthorised disclosure** of personal data to a third party
- **Unauthorised access** to personal data

Not all breaches must be reported to the ICO — only those likely to result in a risk to individuals' rights and freedoms. However, all suspected breaches must be assessed and documented regardless of whether ICO notification is required.

---

## Detection Sources

| Source | How to Monitor |
|--------|----------------|
| Sentry | Error monitoring — watch for unexpected data access patterns or auth failures at volume |
| WARDEN audit events | `warden_audit_events` table — anomalous block/hold patterns may indicate attack activity |
| Railway logs | Infrastructure-level access logs; available in Railway dashboard |
| Cloudflare | WAF alerts, bot traffic anomalies, unusual geographic patterns |
| User reports | Emails to support@prymal.io or privacy@prymal.io reporting suspicious activity |
| Staff discovery | Any team member who discovers or suspects a breach |
| Clerk | Unusual sign-in activity, bulk account access, compromised token events |
| Stripe | Unusual billing activity may indicate account compromise |

---

## Response Phases

### Phase 1 — Immediate Response (0–4 hours)

**Goal**: Contain the breach and preserve evidence.

1. **Identify the breach** — determine what happened, what system was affected, and what data may be involved
2. **Contain the breach**:
   - Revoke any compromised API keys, OAuth tokens, or Clerk session tokens
   - Restrict access to affected systems if possible
   - Apply emergency patches if the breach is due to a code vulnerability
   - Suspend affected integrations or user accounts if necessary
3. **Preserve evidence**:
   - Do NOT delete logs, modify database records, or overwrite files related to the incident
   - Export and secure relevant log excerpts (Sentry, Railway, Cloudflare, WARDEN audit trail)
   - Take timestamped screenshots of any relevant dashboards or alerts
4. **Notify the breach lead**:
   - Rhys Lacy (sole operator) is the designated breach lead and data controller
   - All staff discovering a breach must escalate immediately via direct communication

### Phase 2 — Assessment (4–24 hours)

**Goal**: Understand the scope and risk level.

Answer the following:

| Question | Guidance |
|----------|----------|
| What data was affected? | Identify categories (email, billing, content, credentials, etc.) |
| How many users are affected? | Estimate the number of data subjects involved |
| What is the risk level? | High = financial data, credentials, health data, sensitive content; Low = non-sensitive usage statistics |
| Is the breach ongoing? | Is the attacker still active? Is the vulnerability still exploitable? |
| What is the source? | Code vulnerability, misconfiguration, third-party provider, insider access, phishing? |
| Has the data been exfiltrated? | Is there evidence the data was extracted, published, or transmitted to a third party? |

**Risk classification**:
- **High risk**: Data that could result in identity theft, financial harm, discrimination, or reputational damage to individuals (e.g. login credentials, billing data, sensitive content, health or legal information)
- **Medium risk**: Data that could cause inconvenience or limited harm (e.g. email addresses, usage patterns)
- **Low risk**: Aggregated or anonymised data, non-sensitive operational statistics

### Phase 3 — ICO Notification (within 72 hours of discovery, if risk is not low)

**Threshold**: Notify the ICO if the breach is likely to result in a risk to individuals' rights and freedoms. When in doubt, notify — over-reporting is not penalised; under-reporting is.

**How to notify**:
1. Go to [ico.org.uk/make-a-complaint/](https://ico.org.uk/make-a-complaint/) — select "Report a breach to the ICO"
2. Alternatively use the ICO breach reporting form at [ico.org.uk/for-organisations/report-a-breach/](https://ico.org.uk/for-organisations/report-a-breach/)

**Required fields for ICO notification**:
- Nature of the breach (what happened)
- Categories and approximate number of individuals affected
- Categories and approximate volume of personal data records affected
- Name and contact details of the Data Protection Officer or lead contact
- Likely consequences of the breach
- Measures taken or proposed to address the breach and mitigate its effects

**If reporting will be delayed beyond 72 hours**: Document the reasons for the delay in the breach register. The ICO accepts phased reporting if initial information is incomplete — submit what is known within 72 hours and supplement as more is established.

### Phase 4 — User Notification (if high risk to individuals)

**Threshold**: Notify affected users directly if the breach is likely to result in a **high risk** to their rights and freedoms (UK GDPR Article 34).

**How to notify**:
1. Draft a plain-language email explaining:
   - What happened (in clear, non-technical language)
   - What data was involved
   - What steps affected users should take (e.g. change password, monitor accounts)
   - How to contact Prymal: privacy@prymal.io
2. Send via HERALD (Resend) to all affected user email addresses
3. Where a breach affects a business customer's workspace, also notify the organisation admin directly

**Timing**: Notify users without undue delay after becoming aware that a high-risk breach has occurred.

**Tone**: Clear, factual, non-alarmist. Do not minimise genuine risk, but do not speculate on impact.

### Phase 5 — Post-Incident Review

**Goal**: Prevent recurrence and improve controls.

1. **Root cause analysis**:
   - What allowed the breach to occur?
   - Was it a code issue, configuration error, third-party failure, or social engineering?
2. **Control improvements**:
   - What specific technical or procedural change prevents recurrence?
   - Timeline for implementation
3. **Documentation**:
   - Record the full incident in the Breach Register (`BREACH_REGISTER.md`)
   - Record any improvements made as a result
4. **Communication**:
   - If breach affected business customers, notify them of the outcome and controls implemented
   - Update any affected sub-processors if the breach originated from their systems

---

## Contacts

| Role | Contact |
|------|---------|
| Breach lead (data controller) | Rhys Lacy — direct contact |
| ICO breach reporting | ico.org.uk/for-organisations/report-a-breach/ |
| User privacy contact | privacy@prymal.io |
| ICO helpline | 0303 123 1113 |

---

## Key Timelines Summary

| Action | Deadline |
|--------|----------|
| Contain breach | Immediately (0–4 hours) |
| Assess scope | 4–24 hours |
| Notify ICO (if risk not low) | Within 72 hours of discovery |
| Notify affected users (if high risk) | Without undue delay after 72-hour assessment |
| Complete root cause analysis | Within 7 days |
| Document in breach register | Within 7 days |
