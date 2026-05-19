# Compliance Documentation Map

This folder is Prymal's working compliance pack. It is designed to help a founder-led SaaS prepare for Cyber Essentials, Cyber Essentials Plus readiness conversations, and an ISO 27001 gap assessment without turning the repo into bloated shelfware.

## What Each Folder Is For

| Path | Purpose |
| --- | --- |
| `docs/compliance/README.md` | central map and usage guide |
| `docs/compliance/evidence-register.md` | master tracker for what evidence exists, who owns it, and what is still missing |
| `docs/compliance/cyber-essentials-readiness.md` | assessor-ready Cyber Essentials checklist and evidence requirements |
| `docs/compliance/iso-27001-readiness.md` | ISO 27001 starter pack, scope, SoA notes, and governance structure |
| `docs/compliance/policies/` | practical short-form policies for how Prymal operates securely |
| `docs/compliance/registers/` | live operational records such as risks, changes, incidents, reviews, and backups |
| `docs/compliance/runbooks/` | repeatable procedures for reviews, drills, and supplier onboarding |
| `docs/compliance/evidence-output/` | generated local evidence bundles from scripts; gitignored by default |

## Repo Evidence Vs Operational Evidence

### Repo evidence

Evidence that can live safely in Git:

- policies
- registers and runbooks
- redacted command summaries
- dependency review notes
- release review records
- non-secret evidence collector output

### Operational evidence

Evidence that usually lives outside Git or in a restricted evidence store:

- screenshots of MFA settings
- screenshots of Cloudflare SSL mode
- `ufw` and `fail2ban` screenshots
- VPS console screenshots
- backup logs from the live environment
- restore drill records containing environment-specific details

## What Is Still Required Outside The Repo

The repo can prove that controls exist in code and process, but it cannot by itself prove:

- that MFA is enabled in every live cloud account
- that the production VPS is actually hardened and patched
- that backups run and can be restored
- that real access reviews happen on schedule
- that management reviews and corrective actions are being performed

Those must be gathered from the live environment and admin consoles.

## How To Prepare For A Cyber Essentials Assessment

1. Complete the evidence register status fields.
2. Collect MFA screenshots for all cloud services in scope.
3. Capture `ufw`, `fail2ban`, Cloudflare `Full (strict)`, and SSH hardening evidence from the VPS.
4. Run backend env validation, security preflight, and dependency audits.
5. Complete the quarterly access review and record it.
6. Confirm developer endpoint protection and disk encryption evidence exists.

## How To Prepare For An ISO 27001 Gap Assessment

1. Confirm the ISMS scope statement is still correct.
2. Populate the asset, supplier, and risk registers with real owners and dates.
3. Assign policy owners and review dates.
4. Run the monthly and quarterly runbooks at least once and save the outputs.
5. Record at least one backup restore drill and one incident response drill.
6. Hold a lightweight management review and document actions.

## Helpful Commands

Generate a local non-secret evidence bundle:

```bash
cd backend
npm run compliance:evidence
```

Validate the current release-ready security posture:

```bash
cd backend
npm run lint
npm test
npm run schema:check
npm run security:preflight
```
