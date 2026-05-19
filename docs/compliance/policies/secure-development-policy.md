# Secure Development Policy

## Purpose

Ensure new code and production changes are developed and released with repeatable security checks.

## Scope

All code, infrastructure-as-code style config, release scripts, and deployment-affecting documentation in the Prymal repository.

## Owner

Engineering

## Review Frequency

Quarterly.

## Requirements

- Changes must be reviewed before production deployment.
- Production-bound changes must pass lint, tests, schema checks where relevant, env validation, and security preflight.
- Dependency updates must be reviewed for security impact.
- New features must not weaken auth, billing, admin, media, or safety controls.
- Secrets, live tokens, and customer data must never be committed.
- Security findings and release decisions must be documented when risk is accepted.

## Evidence Expected

- PR or review records
- pre-release security review output
- dependency review notes
- vulnerability register

## Exceptions Process

Emergency fixes may be deployed with abbreviated review only when documented afterward in the change register with the missed checks and follow-up actions.
