# Security Policy

## Supported Versions

Prymal is currently supported on the latest `master` branch and the latest production deployment built from it. Older unpublished snapshots are not guaranteed to receive fixes.

## Reporting a Vulnerability

Report security issues privately through a public-facing security contact such as `security@example.com` until a dedicated production contact is finalised.

Do not:

- post exploitable details in public GitHub issues
- include real secrets, session tokens, webhook payloads, or customer data in reports

Include when possible:

- affected area or route
- impact summary
- reproduction steps
- whether authentication or staff access is required
- suggested mitigation if known

## Responsible Disclosure Expectations

- give Prymal reasonable time to triage and remediate before public disclosure
- avoid accessing data that is not your own
- avoid disrupting service availability
- stop testing if you discover active customer data exposure and report immediately

## Incident Triage Categories

- `critical`: auth bypass, remote code execution, secret exposure, payment compromise, admin privilege escalation
- `high`: tenant isolation failure, unsafe webhook/integration bypass, significant sensitive data leak
- `medium`: rate-limit bypass, security header regression, limited info disclosure
- `low`: hardening gap without clear exploit path

## Response Targets

- acknowledgement: within 3 business days
- initial triage: within 5 business days
- severity assignment and next steps: within 10 business days

## Handling Secrets in Reports

- redact API keys, tokens, cookies, and passwords before sending
- if a secret may already be exposed, say so clearly so it can be rotated immediately
