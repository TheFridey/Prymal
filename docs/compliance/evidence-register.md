# Compliance Evidence Register

Use this register to track what evidence exists, who owns it, where it is stored, and whether it is assessment-ready. Status values should be one of `missing`, `partial`, or `ready`.

## Cyber Essentials Evidence

| Evidence ID | Control mapping | Evidence owner | Frequency | Storage location | Last reviewed | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| CE-FW-001 | Cyber Essentials - Firewalls | Engineering | each deploy | compliance ticket + screenshot archive | YYYY-MM-DD | partial | `ufw status verbose` screenshot for production VPS |
| CE-FW-002 | Cyber Essentials - Firewalls | Engineering | quarterly | evidence archive | YYYY-MM-DD | partial | public port evidence from `ss -tulpn` or provider firewall view |
| CE-FW-003 | Cyber Essentials - Firewalls | Engineering | each deploy | Cloudflare evidence folder | YYYY-MM-DD | partial | Cloudflare `Full (strict)` screenshot |
| CE-SC-001 | Cyber Essentials - Secure configuration | Engineering | each deploy | deploy evidence folder | YYYY-MM-DD | partial | `NODE_ENV=production npm run env:validate` output |
| CE-SC-002 | Cyber Essentials - Secure configuration | Engineering | each deploy | deploy evidence folder | YYYY-MM-DD | partial | `NODE_ENV=production npm run security:preflight` output |
| CE-SC-003 | Cyber Essentials - Secure configuration | Engineering | quarterly | infrastructure evidence folder | YYYY-MM-DD | missing | systemd unit excerpt showing non-root user |
| CE-SC-004 | Cyber Essentials - Secure configuration | Engineering | quarterly | infrastructure evidence folder | YYYY-MM-DD | missing | `.env` permissions screenshot showing `600` |
| CE-SC-005 | Cyber Essentials - Secure configuration | Engineering | quarterly | infrastructure evidence folder | YYYY-MM-DD | missing | SSH hardening screenshot or sanitized config excerpt |
| CE-SU-001 | Cyber Essentials - Security updates | Engineering | monthly | vulnerability review folder | YYYY-MM-DD | partial | backend dependency audit summary |
| CE-SU-002 | Cyber Essentials - Security updates | Engineering | monthly | vulnerability review folder | YYYY-MM-DD | partial | frontend dependency audit summary |
| CE-SU-003 | Cyber Essentials - Security updates | Engineering | monthly | infrastructure evidence folder | YYYY-MM-DD | missing | unattended-upgrades / apt patching evidence |
| CE-UA-001 | Cyber Essentials - User access control | Engineering | quarterly | access review register | YYYY-MM-DD | partial | GitHub access review completed |
| CE-UA-002 | Cyber Essentials - User access control | Engineering | quarterly | access review register | YYYY-MM-DD | partial | VPS SSH access review completed |
| CE-UA-003 | Cyber Essentials - User access control | Engineering | quarterly | access review register | YYYY-MM-DD | missing | Clerk / Stripe / Cloudflare / Cloudinary / Resend / OpenAI / Anthropic / registrar access review |
| CE-MFA-001 | Cyber Essentials - MFA GitHub | Founder / Engineering | quarterly | screenshot archive | YYYY-MM-DD | missing | GitHub MFA screenshot for admin accounts |
| CE-MFA-002 | Cyber Essentials - MFA Cloudflare | Founder / Engineering | quarterly | screenshot archive | YYYY-MM-DD | missing | Cloudflare MFA screenshot |
| CE-MFA-003 | Cyber Essentials - MFA Clerk | Founder / Engineering | quarterly | screenshot archive | YYYY-MM-DD | missing | Clerk MFA screenshot |
| CE-MFA-004 | Cyber Essentials - MFA Stripe | Founder / Finance | quarterly | screenshot archive | YYYY-MM-DD | missing | Stripe MFA screenshot |
| CE-MFA-005 | Cyber Essentials - MFA Cloudinary | Engineering | quarterly | screenshot archive | YYYY-MM-DD | missing | Cloudinary MFA screenshot |
| CE-MFA-006 | Cyber Essentials - MFA OpenAI | Engineering | quarterly | screenshot archive | YYYY-MM-DD | missing | OpenAI MFA screenshot |
| CE-MFA-007 | Cyber Essentials - MFA Anthropic | Engineering | quarterly | screenshot archive | YYYY-MM-DD | missing | Anthropic MFA screenshot |
| CE-MFA-008 | Cyber Essentials - MFA Resend | Engineering | quarterly | screenshot archive | YYYY-MM-DD | missing | Resend MFA screenshot |
| CE-MFA-009 | Cyber Essentials - MFA VPS provider | Founder / Engineering | quarterly | screenshot archive | YYYY-MM-DD | missing | VPS provider MFA screenshot |
| CE-MFA-010 | Cyber Essentials - MFA domain registrar | Founder / Engineering | quarterly | screenshot archive | YYYY-MM-DD | missing | registrar MFA screenshot |
| CE-MD-001 | Cyber Essentials - Malware / device security | Founder / Engineering | quarterly | endpoint evidence folder | YYYY-MM-DD | missing | developer laptop endpoint protection screenshot |
| CE-MD-002 | Cyber Essentials - Malware / device security | Founder / Engineering | quarterly | endpoint evidence folder | YYYY-MM-DD | missing | developer laptop encryption screenshot |
| CE-MD-003 | Cyber Essentials - Malware / device security | Engineering | quarterly | backup evidence folder | YYYY-MM-DD | partial | backup and restore test record |

## ISO 27001 Evidence

| Evidence ID | Control mapping | Evidence owner | Frequency | Storage location | Last reviewed | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ISO-SCOPE-001 | ISO 27001 - ISMS scope | Founder / Security lead | annual | `docs/compliance/iso-27001-readiness.md` | YYYY-MM-DD | partial | scope statement documented |
| ISO-ASSET-001 | ISO 27001 - Asset management | Engineering | quarterly | `docs/compliance/registers/asset-register.md` | YYYY-MM-DD | partial | starter register exists, needs live values |
| ISO-SUP-001 | ISO 27001 - Supplier relationships | Engineering | annual | `docs/compliance/registers/supplier-register.md` | YYYY-MM-DD | partial | starter supplier register exists |
| ISO-RISK-001 | ISO 27001 - Risk assessment | Founder / Security lead | quarterly | `docs/compliance/registers/risk-register.md` | YYYY-MM-DD | partial | starter risk register exists |
| ISO-SOA-001 | ISO 27001 - Statement of Applicability | Founder / Security lead | annual | `docs/compliance/iso-27001-readiness.md` | YYYY-MM-DD | partial | starter SoA table exists |
| ISO-ACC-001 | ISO 27001 - Access reviews | Engineering | quarterly | `docs/compliance/registers/access-review-register.md` | YYYY-MM-DD | partial | runbook and register added |
| ISO-BKP-001 | ISO 27001 - Backup and restore | Engineering | quarterly | `docs/compliance/registers/backup-restore-test-register.md` | YYYY-MM-DD | partial | restore drill needs live evidence |
| ISO-INC-001 | ISO 27001 - Incident response tests | Founder / Security lead | annual | `docs/compliance/registers/incident-register.md` | YYYY-MM-DD | partial | drill runbook exists |
| ISO-VULN-001 | ISO 27001 - Vulnerability management | Engineering | monthly | `docs/compliance/registers/vulnerability-register.md` | YYYY-MM-DD | partial | dependency and VPS findings should be logged |
| ISO-CHG-001 | ISO 27001 - Change management | Engineering | each release | `docs/compliance/registers/change-register.md` | YYYY-MM-DD | partial | release review records required |
| ISO-AUDIT-001 | ISO 27001 - Internal audit | Founder / Security lead | quarterly | compliance review folder | YYYY-MM-DD | missing | internal audit record not yet captured |
| ISO-MGMT-001 | ISO 27001 - Management review | Founder / Security lead | quarterly | compliance review folder | YYYY-MM-DD | missing | management review minutes needed |
| ISO-CA-001 | ISO 27001 - Corrective actions | Founder / Security lead | as needed | `docs/compliance/registers/corrective-action-register.md` | YYYY-MM-DD | partial | register created, needs live entries |
