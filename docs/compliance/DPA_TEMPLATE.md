# Data Processing Agreement — Prymal

**Version**: 1.0  
**Effective date**: [DATE]

This Data Processing Agreement ("DPA") forms part of the agreement between the parties identified below and supplements the Prymal Terms of Service available at prymal.io/terms.

---

## Parties

**Data Controller**: [CUSTOMER_LEGAL_NAME], a company registered at [CUSTOMER_REGISTERED_ADDRESS] ("Controller")

**Data Processor**: [COMPANY_LEGAL_NAME], operating the Prymal platform, registered at [REGISTERED_ADDRESS] ("Processor" or "Prymal")

---

## 1. Subject Matter and Duration

1.1 This DPA governs the processing of personal data by Prymal on behalf of the Controller in connection with the provision of the Prymal service ("Service").

1.2 This DPA is effective from the date the Controller accepts the Terms of Service and remains in force until the Service Agreement is terminated, plus any post-termination retention period described in clause 11.

---

## 2. Nature and Purpose of Processing

2.1 Prymal processes personal data solely for the purpose of delivering the Service, including:

- User authentication and workspace access management
- AI agent task execution, workflow orchestration, and knowledge retrieval
- Billing and subscription management
- Security monitoring and safety enforcement (WARDEN input firewall, SENTINEL output validation)
- Technical operations, error monitoring, and service reliability

2.2 Prymal acts only on the documented instructions of the Controller, as set out in this DPA and the Terms of Service. If Prymal is required by applicable law to process personal data beyond those instructions, Prymal will notify the Controller before such processing unless prohibited from doing so by law.

---

## 3. Categories of Personal Data

Personal data processed under this DPA may include:

- **Identity and contact data**: names, email addresses, job titles, organisation names
- **Authentication data**: Clerk user identifiers, session credentials
- **Workspace content**: prompts submitted to agents, documents uploaded to the knowledge layer (LORE), workflow inputs, outputs, and associated metadata
- **Usage data**: agent interaction logs, workflow execution records, product events, API key usage
- **Billing data**: subscription tier, billing history (Stripe manages card data directly)
- **Technical data**: IP addresses, browser identifiers, device metadata, infrastructure logs

---

## 4. Categories of Data Subjects

- The Controller's employees, contractors, and authorised workspace members
- The Controller's end users or customers, where their personal data is processed within the Prymal workspace

---

## 5. Controller Instructions

5.1 The Controller instructs Prymal to process personal data to the extent necessary to provide the Service, including the categories and purposes described in clauses 2 and 3.

5.2 The Controller is responsible for ensuring it has the legal basis to provide personal data to Prymal and that its own use of the Service complies with applicable data protection law.

5.3 The Controller must not instruct Prymal to process special category data (as defined under UK GDPR Article 9) or data relating to criminal convictions unless explicitly agreed in writing.

---

## 6. Confidentiality

6.1 Prymal shall ensure that all personnel authorised to process personal data are bound by appropriate confidentiality obligations and are informed of the relevant data protection requirements.

6.2 Prymal limits access to personal data to those personnel who require access to perform their duties in relation to the Service.

---

## 7. Security Measures

Prymal implements the following technical and organisational measures:

- **Input safety**: WARDEN v2 multi-module input safety firewall covering 12 enforcement modules including prompt injection detection, malicious content classification, and recursive metadata sanitisation
- **Output validation**: SENTINEL output gating with PASS/REPAIR/HOLD verdicts; HOLD verdicts suppress outputs before delivery
- **Authentication**: Clerk-managed authentication with organisation-level RBAC; MFA enforced for staff access
- **Transit encryption**: TLS 1.2+ enforced across all service endpoints via Cloudflare and Railway
- **Infrastructure security**: Railway container isolation; Cloudflare WAF and DDoS protection
- **Monitoring**: Sentry error tracking; WARDEN audit event log with 1-year retention
- **Credential management**: All secrets managed via environment variables; no hardcoded credentials
- **Dependency security**: Dependabot configured for automated vulnerability scanning

---

## 8. Sub-processors

By using the Service, the Controller accepts the engagement of the following sub-processors:

| Sub-processor | Purpose | Location |
|--------------|---------|----------|
| Clerk | Authentication and identity management | USA |
| Stripe | Payment processing and billing | USA |
| Railway | Backend compute hosting | USA |
| Cloudflare | CDN, WAF, and DDoS protection | USA |
| Resend | Transactional email delivery | USA |
| Sentry | Application error monitoring | USA |
| Cloudinary | Generated media asset storage | USA |
| OpenAI | LLM inference and transcription | USA |
| Anthropic | LLM inference | USA |
| Google (Gemini / Veo) | LLM inference and AI video generation | USA |

8.1 Prymal will notify the Controller of any intended changes to sub-processors with reasonable notice via email or in-product notification, giving the Controller the opportunity to object.

8.2 All sub-processors are bound by data processing terms no less protective than this DPA.

---

## 9. Data Subject Rights

9.1 Prymal will assist the Controller in fulfilling data subject rights requests under UK GDPR, including access, rectification, erasure, restriction, portability, and objection.

9.2 Where Prymal receives a data subject rights request directly, Prymal will forward it to the Controller within 5 business days without responding to the data subject directly.

9.3 The Controller is responsible for responding to data subject requests within the applicable statutory timeframe (typically 1 calendar month under UK GDPR).

---

## 10. Breach Notification

10.1 Prymal will notify the Controller without undue delay, and in any event within 72 hours of becoming aware of a personal data breach affecting the Controller's data.

10.2 Prymal will provide the Controller with sufficient information to meet its own ICO notification obligations, including:
- Nature of the breach
- Categories and approximate number of data subjects affected
- Categories and approximate volume of personal data affected
- Likely consequences
- Measures taken or proposed

10.3 Where a breach affects multiple customers, Prymal may provide a common notification that describes the nature of the incident without disclosing other customers' details.

---

## 11. Deletion on Termination

11.1 Upon termination of the Service Agreement, Prymal will retain the Controller's personal data for a period of 30 days.

11.2 During this period, the Controller may request an export of their workspace data by contacting privacy@prymal.io.

11.3 After 30 days, personal data will be deleted or anonymised, except where Prymal is required to retain data by applicable law (e.g. billing records retained for 7 years per HMRC requirements).

---

## 12. Audit Rights

12.1 The Controller may request written confirmation of Prymal's compliance with this DPA once per calendar year.

12.2 Where required by applicable law, Prymal will make available to the Controller all information necessary to demonstrate compliance with this DPA.

12.3 The Controller agrees to exercise audit rights in a manner that minimises disruption to Prymal's operations and to treat any information obtained during an audit as confidential.

---

## 13. International Transfers

13.1 Prymal operates from the United Kingdom. Personal data may be transferred to sub-processors located in countries outside the UK.

13.2 All international transfers are made in compliance with UK GDPR Chapter V, including where applicable via Standard Contractual Clauses (UK Addendum) or other appropriate transfer mechanisms.

---

## 14. Governing Law

14.1 This DPA is governed by the laws of England and Wales.

14.2 Any dispute arising under this DPA shall be subject to the exclusive jurisdiction of the courts of England and Wales.

---

## 15. Signatures

**On behalf of the Controller**:

Name: ___________________________  
Title: ___________________________  
Signature: ___________________________  
Date: ___________________________  

**On behalf of Prymal ([COMPANY_LEGAL_NAME])**:

Name: ___________________________  
Title: ___________________________  
Signature: ___________________________  
Date: ___________________________  

---

*To request a signed DPA, email privacy@prymal.io with subject line "DPA Request — [Company Name]".*
