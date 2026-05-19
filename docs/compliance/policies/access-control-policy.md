# Access Control Policy

## Purpose

Define how access to Prymal systems and admin consoles is granted, reviewed, and removed.

## Scope

GitHub, VPS access, Clerk, Stripe, Cloudflare, Cloudinary, Resend, model-provider accounts, and Prymal admin routes.

## Owner

Founder / Security lead

## Review Frequency

Quarterly and when a role changes.

## Requirements

- Access is granted only for a defined business need.
- Admin access must use named accounts, not shared accounts.
- MFA is required for every cloud service in scope.
- Production staff access in the app must use the explicit staff role controls.
- Orphaned, duplicate, and stale access must be removed promptly.
- SSH access must use keys only.

## Evidence Expected

- quarterly access review register
- MFA screenshots
- VPS authorized key review record
- GitHub and cloud-service access lists

## Exceptions Process

Temporary access exceptions must be approved, time-boxed, and logged in the change or corrective action register with an expiry date.
