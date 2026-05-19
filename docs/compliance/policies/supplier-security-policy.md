# Supplier Security Policy

## Purpose

Set the minimum security expectations for third-party services used by Prymal.

## Scope

Critical SaaS and infrastructure suppliers including auth, billing, hosting, media, DNS, email, model providers, source control, and registrar services.

## Owner

Founder / Security lead

## Review Frequency

Annually and when onboarding a new critical supplier.

## Requirements

- Critical suppliers must be recorded in the supplier register.
- MFA must be enabled for supplier admin access where supported.
- Access must be least-privilege and reviewed.
- Security-relevant configuration such as webhooks, TLS, and admin roles must be checked periodically.
- New critical suppliers should be reviewed before use in production.

## Evidence Expected

- supplier register
- new supplier review outputs
- MFA screenshots
- access review records

## Exceptions Process

If a supplier lacks a preferred control such as MFA, document the risk, compensating controls, and review date before use.
