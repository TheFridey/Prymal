# Change Management Policy

## Purpose

Keep production changes controlled, reviewable, and reversible.

## Scope

Code releases, infrastructure changes, supplier configuration changes, schema changes, and security-setting changes affecting Prymal environments.

## Owner

Engineering

## Review Frequency

Quarterly.

## Requirements

- Production changes must be recorded in the change register.
- Risky changes need a rollback plan before deployment.
- Database-affecting changes require a backup before deployment.
- Changes must be validated with the appropriate checks before release.
- Emergency changes must be documented after the fact if not before.

## Evidence Expected

- change register
- pre-release security review output
- deploy records
- backup evidence for risky changes

## Exceptions Process

Emergency changes may bypass the normal cadence only when logged afterward with reason, impact, and approval.
